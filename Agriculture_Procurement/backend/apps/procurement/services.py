from decimal import Decimal

from django.db import transaction
from django.db.models import Max, Sum
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models import User

from .models import (
    CapacityReservation,
    FarmerCrop,
    OfficerAssignment,
    ProcurementAppointment,
    ProcurementCenter,
    ProcurementRequest,
    RequestStatusEvent,
)


def _lock_and_validate_reviewer(actor, center: ProcurementCenter) -> None:
    if actor.role == User.Role.ADMIN:
        return
    if actor.role != User.Role.PROCUREMENT_OFFICER:
        raise PermissionDenied("Only a procurement officer or administrator can review requests.")

    has_assignment = (
        OfficerAssignment.objects.select_for_update()
        .filter(
            officer=actor,
            procurement_center=center,
            is_active=True,
            procurement_center__is_active=True,
        )
        .exists()
    )
    if not has_assignment:
        raise PermissionDenied("This request is outside your active centre assignment.")


def _record_status_event(
    request: ProcurementRequest,
    actor,
    from_status: str,
    note: str = "",
) -> None:
    RequestStatusEvent.objects.create(
        request=request,
        from_status=from_status,
        to_status=request.status,
        actor=actor,
        note=note,
    )


def _release_active_schedule(request: ProcurementRequest, actor) -> None:
    now = timezone.now()
    CapacityReservation.objects.filter(
        request=request,
        status=CapacityReservation.Status.ACTIVE,
    ).update(
        status=CapacityReservation.Status.RELEASED,
        released_at=now,
        released_by=actor,
        updated_at=now,
    )
    ProcurementAppointment.objects.filter(
        request=request,
        status=ProcurementAppointment.Status.SCHEDULED,
    ).update(
        status=ProcurementAppointment.Status.CANCELLED,
        cancelled_at=now,
        updated_at=now,
    )


def capacity_snapshot(center: ProcurementCenter, reservation_date) -> dict[str, Decimal]:
    reserved = (
        CapacityReservation.objects.filter(
            procurement_center=center,
            reservation_date=reservation_date,
            status=CapacityReservation.Status.ACTIVE,
        ).aggregate(total=Sum("quantity_kg"))["total"]
        or Decimal("0.00")
    )
    consumed = (
        CapacityReservation.objects.filter(
            procurement_center=center,
            reservation_date=reservation_date,
            status=CapacityReservation.Status.CONSUMED,
        ).aggregate(total=Sum("quantity_kg"))["total"]
        or Decimal("0.00")
    )
    allocated = reserved + consumed
    return {
        "daily_capacity_kg": center.daily_capacity_kg,
        "reserved_quantity_kg": reserved,
        "consumed_quantity_kg": consumed,
        "allocated_quantity_kg": allocated,
        "available_quantity_kg": max(center.daily_capacity_kg - allocated, Decimal("0.00")),
    }


@transaction.atomic
def start_review(request_id, actor, note: str = "") -> ProcurementRequest:
    procurement_request = (
        ProcurementRequest.objects.select_for_update()
        .select_related("procurement_center")
        .get(pk=request_id)
    )
    center = ProcurementCenter.objects.select_for_update().get(
        pk=procurement_request.procurement_center_id
    )
    _lock_and_validate_reviewer(actor, center)

    if procurement_request.status != ProcurementRequest.Status.SUBMITTED:
        raise ValidationError(
            {"status": "Only a submitted request can be moved under review."}
        )

    previous_status = procurement_request.status
    procurement_request.status = ProcurementRequest.Status.UNDER_REVIEW
    procurement_request.reviewed_by = actor
    procurement_request.reviewed_at = timezone.now()
    procurement_request.review_notes = note
    procurement_request.save(
        update_fields=[
            "status",
            "reviewed_by",
            "reviewed_at",
            "review_notes",
            "updated_at",
        ]
    )
    _record_status_event(procurement_request, actor, previous_status, note)
    return procurement_request


@transaction.atomic
def schedule_request(
    request_id,
    actor,
    *,
    action: str,
    scheduled_date,
    slot_start_time,
    slot_end_time,
    quantity_kg: Decimal,
    note: str = "",
) -> ProcurementRequest:
    procurement_request = (
        ProcurementRequest.objects.select_for_update()
        .select_related("procurement_center", "farmer_crop__crop")
        .get(pk=request_id)
    )
    center = ProcurementCenter.objects.select_for_update().get(
        pk=procurement_request.procurement_center_id
    )
    farmer_crop = (
        FarmerCrop.objects.select_for_update()
        .select_related("crop")
        .get(pk=procurement_request.farmer_crop_id)
    )
    _lock_and_validate_reviewer(actor, center)

    if action == "APPROVE":
        valid_statuses = (
            ProcurementRequest.Status.SUBMITTED,
            ProcurementRequest.Status.UNDER_REVIEW,
        )
        next_status = ProcurementRequest.Status.APPROVED
    elif action == "RESCHEDULE":
        valid_statuses = (
            ProcurementRequest.Status.APPROVED,
            ProcurementRequest.Status.RESCHEDULED,
        )
        next_status = ProcurementRequest.Status.RESCHEDULED
    else:
        raise ValidationError({"action": "Choose APPROVE or RESCHEDULE."})

    if procurement_request.status not in valid_statuses:
        raise ValidationError(
            {"status": f"A {procurement_request.get_status_display().lower()} request cannot be {action.lower()}d."}
        )
    if not center.is_active:
        raise ValidationError({"procurement_center": "The procurement centre is inactive."})
    if not farmer_crop.is_active or not farmer_crop.crop.is_active:
        raise ValidationError({"farmer_crop": "The farmer crop is no longer active."})
    if farmer_crop.farmer_id != procurement_request.farmer_id:
        raise ValidationError({"farmer_crop": "The crop does not belong to this farmer."})
    if scheduled_date < timezone.localdate():
        raise ValidationError({"scheduled_date": "The arrival date cannot be in the past."})
    if slot_start_time >= slot_end_time:
        raise ValidationError({"slot_end_time": "Slot end time must be later than start time."})
    if slot_start_time < center.operating_start_time:
        raise ValidationError({"slot_start_time": "The slot starts before the centre opens."})
    if slot_end_time > center.operating_end_time:
        raise ValidationError({"slot_end_time": "The slot ends after the centre closes."})
    if quantity_kg <= 0:
        raise ValidationError({"quantity_kg": "Scheduled quantity must be greater than zero."})
    if quantity_kg > procurement_request.intended_quantity_kg:
        raise ValidationError(
            {"quantity_kg": "Scheduled quantity cannot exceed the farmer's intended quantity."}
        )

    center_reserved = (
        CapacityReservation.objects.filter(
            procurement_center=center,
            reservation_date=scheduled_date,
            status__in=(
                CapacityReservation.Status.ACTIVE,
                CapacityReservation.Status.CONSUMED,
            ),
        )
        .exclude(request=procurement_request)
        .aggregate(total=Sum("quantity_kg"))["total"]
        or Decimal("0.00")
    )
    if center_reserved + quantity_kg > center.daily_capacity_kg:
        remaining = max(center.daily_capacity_kg - center_reserved, Decimal("0.00"))
        raise ValidationError(
            {
                "quantity_kg": (
                    f"Only {remaining} kg remains at this centre on {scheduled_date}."
                )
            }
        )

    crop_reserved = (
        CapacityReservation.objects.filter(
            request__farmer_crop=farmer_crop,
            status=CapacityReservation.Status.ACTIVE,
        )
        .exclude(request=procurement_request)
        .aggregate(total=Sum("quantity_kg"))["total"]
        or Decimal("0.00")
    )
    if crop_reserved + quantity_kg > farmer_crop.available_quantity_kg:
        remaining = max(farmer_crop.available_quantity_kg - crop_reserved, Decimal("0.00"))
        raise ValidationError(
            {
                "quantity_kg": (
                    f"Only {remaining} kg remains unreserved on this farmer crop record."
                )
            }
        )

    _release_active_schedule(procurement_request, actor)
    reservation = CapacityReservation.objects.create(
        request=procurement_request,
        procurement_center=center,
        reservation_date=scheduled_date,
        quantity_kg=quantity_kg,
    )
    next_queue_number = (
        ProcurementAppointment.objects.filter(
            procurement_center=center,
            scheduled_date=scheduled_date,
        ).aggregate(last=Max("queue_number"))["last"]
        or 0
    ) + 1
    appointment = ProcurementAppointment.objects.create(
        request=procurement_request,
        capacity_reservation=reservation,
        procurement_center=center,
        scheduled_date=scheduled_date,
        slot_start_time=slot_start_time,
        slot_end_time=slot_end_time,
        queue_number=next_queue_number,
    )

    previous_status = procurement_request.status
    procurement_request.status = next_status
    procurement_request.reviewed_by = actor
    procurement_request.reviewed_at = timezone.now()
    procurement_request.review_notes = note
    procurement_request.save(
        update_fields=[
            "status",
            "reviewed_by",
            "reviewed_at",
            "review_notes",
            "updated_at",
        ]
    )
    event_note = (
        f"{quantity_kg} kg scheduled for {scheduled_date} "
        f"from {slot_start_time.strftime('%H:%M')} to {slot_end_time.strftime('%H:%M')}."
    )
    if note:
        event_note = f"{event_note} {note}"
    _record_status_event(procurement_request, actor, previous_status, event_note)
    from .milestone5_services import create_notification
    from .models import Notification

    create_notification(
        recipient=procurement_request.farmer,
        category=Notification.Category.APPOINTMENT,
        title="Arrival slot confirmed" if action == "APPROVE" else "Arrival slot rescheduled",
        message=(
            f"Token {appointment.token_code} is scheduled for {scheduled_date} "
            f"from {slot_start_time.strftime('%H:%M')} to {slot_end_time.strftime('%H:%M')}."
        ),
        request=procurement_request,
    )
    return procurement_request


@transaction.atomic
def reject_request(request_id, actor, note: str) -> ProcurementRequest:
    procurement_request = (
        ProcurementRequest.objects.select_for_update()
        .select_related("procurement_center")
        .get(pk=request_id)
    )
    center = ProcurementCenter.objects.select_for_update().get(
        pk=procurement_request.procurement_center_id
    )
    _lock_and_validate_reviewer(actor, center)

    if procurement_request.status not in (
        ProcurementRequest.Status.SUBMITTED,
        ProcurementRequest.Status.UNDER_REVIEW,
    ):
        raise ValidationError({"status": "Only a pending request can be rejected."})
    if not note.strip():
        raise ValidationError({"review_notes": "Explain why the request is being rejected."})

    previous_status = procurement_request.status
    procurement_request.status = ProcurementRequest.Status.REJECTED
    procurement_request.reviewed_by = actor
    procurement_request.reviewed_at = timezone.now()
    procurement_request.review_notes = note.strip()
    procurement_request.save(
        update_fields=[
            "status",
            "reviewed_by",
            "reviewed_at",
            "review_notes",
            "updated_at",
        ]
    )
    _record_status_event(procurement_request, actor, previous_status, note.strip())
    from .milestone5_services import create_notification
    from .models import Notification

    create_notification(
        recipient=procurement_request.farmer,
        category=Notification.Category.APPOINTMENT,
        title="Procurement request rejected",
        message=f"{procurement_request.request_number} was rejected: {note.strip()}",
        request=procurement_request,
    )
    return procurement_request


@transaction.atomic
def cancel_request(request_id, farmer, reason: str) -> ProcurementRequest:
    procurement_request = ProcurementRequest.objects.select_for_update().get(pk=request_id)
    if farmer.role != User.Role.FARMER or procurement_request.farmer_id != farmer.id:
        raise PermissionDenied("Only the farmer who submitted this request can cancel it.")
    if procurement_request.status not in (
        ProcurementRequest.Status.SUBMITTED,
        ProcurementRequest.Status.UNDER_REVIEW,
        ProcurementRequest.Status.APPROVED,
        ProcurementRequest.Status.RESCHEDULED,
    ):
        raise ValidationError({"status": "This request can no longer be cancelled."})

    ProcurementCenter.objects.select_for_update().get(
        pk=procurement_request.procurement_center_id
    )
    previous_status = procurement_request.status
    _release_active_schedule(procurement_request, farmer)
    procurement_request.status = ProcurementRequest.Status.CANCELLED
    procurement_request.save(update_fields=["status", "updated_at"])
    _record_status_event(procurement_request, farmer, previous_status, reason.strip())
    return procurement_request
