from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import (
    AcceptanceDecision,
    ArrivalCheckIn,
    CapacityReservation,
    FarmerCrop,
    ProcurementAppointment,
    ProcurementCenter,
    ProcurementReceipt,
    ProcurementRequest,
    ProcurementTransaction,
    QualityInspection,
    Weighment,
)
from .services import _lock_and_validate_reviewer, _record_status_event


def _lock_physical_context(appointment_id, actor):
    reference = ProcurementAppointment.objects.values(
        "request_id",
        "procurement_center_id",
        "capacity_reservation_id",
    ).get(pk=appointment_id)
    procurement_request = ProcurementRequest.objects.select_for_update().get(
        pk=reference["request_id"]
    )
    center = ProcurementCenter.objects.select_for_update().get(
        pk=reference["procurement_center_id"]
    )
    farmer_crop = FarmerCrop.objects.select_for_update().get(
        pk=procurement_request.farmer_crop_id
    )
    appointment = (
        ProcurementAppointment.objects.select_for_update()
        .select_related("capacity_reservation")
        .get(pk=appointment_id)
    )
    reservation = CapacityReservation.objects.select_for_update().get(
        pk=reference["capacity_reservation_id"]
    )
    _lock_and_validate_reviewer(actor, center)
    if not center.is_active:
        raise ValidationError({"procurement_center": "The procurement centre is inactive."})
    return procurement_request, center, farmer_crop, appointment, reservation


def _release_reservation(reservation: CapacityReservation, actor) -> None:
    now = timezone.now()
    reservation.status = CapacityReservation.Status.RELEASED
    reservation.released_at = now
    reservation.released_by = actor
    reservation.save(
        update_fields=["status", "released_at", "released_by", "updated_at"]
    )


@transaction.atomic
def check_in_appointment(
    appointment_id,
    actor,
    *,
    transport_mode: str,
    vehicle_number: str = "",
    arrival_notes: str = "",
) -> ProcurementAppointment:
    procurement_request, center, _, appointment, reservation = _lock_physical_context(
        appointment_id, actor
    )
    if procurement_request.status not in (
        ProcurementRequest.Status.APPROVED,
        ProcurementRequest.Status.RESCHEDULED,
    ):
        raise ValidationError({"status": "Only an approved request can be checked in."})
    if appointment.status != ProcurementAppointment.Status.SCHEDULED:
        raise ValidationError({"status": "This appointment is not awaiting check-in."})
    if reservation.status != CapacityReservation.Status.ACTIVE:
        raise ValidationError({"capacity_reservation": "The arrival reservation is not active."})
    if appointment.scheduled_date > timezone.localdate():
        raise ValidationError(
            {"scheduled_date": "A farmer cannot be checked in before the scheduled date."}
        )
    if ArrivalCheckIn.objects.filter(appointment=appointment).exists():
        raise ValidationError({"appointment": "This appointment is already checked in."})

    ArrivalCheckIn.objects.create(
        appointment=appointment,
        request=procurement_request,
        procurement_center=center,
        transport_mode=transport_mode,
        vehicle_number=vehicle_number,
        arrival_notes=arrival_notes,
        checked_in_by=actor,
    )
    previous_status = procurement_request.status
    procurement_request.status = ProcurementRequest.Status.CHECKED_IN
    procurement_request.save(update_fields=["status", "updated_at"])
    appointment.status = ProcurementAppointment.Status.CHECKED_IN
    appointment.save(update_fields=["status", "updated_at"])
    note = f"Farmer checked in with token {appointment.token_code}."
    if vehicle_number.strip():
        note = f"{note} Vehicle {vehicle_number.upper().strip()}."
    _record_status_event(procurement_request, actor, previous_status, note)
    return appointment


@transaction.atomic
def inspect_appointment(
    appointment_id,
    actor,
    *,
    result: str,
    grade: str,
    moisture_percentage=None,
    foreign_matter_percentage=None,
    damaged_percentage=None,
    sample_reference: str = "",
    inspection_notes: str = "",
    rejection_reason: str = "",
) -> ProcurementAppointment:
    procurement_request, _, _, appointment, reservation = _lock_physical_context(
        appointment_id, actor
    )
    if procurement_request.status != ProcurementRequest.Status.CHECKED_IN:
        raise ValidationError({"status": "Check-in must be completed before inspection."})
    if appointment.status != ProcurementAppointment.Status.CHECKED_IN:
        raise ValidationError({"status": "This appointment is not in physical processing."})
    check_in = ArrivalCheckIn.objects.select_for_update().get(appointment=appointment)
    if QualityInspection.objects.filter(check_in=check_in).exists():
        raise ValidationError({"inspection": "An inspection is already recorded."})
    if result == QualityInspection.Result.REJECTED and not rejection_reason.strip():
        raise ValidationError({"rejection_reason": "A rejected inspection needs a reason."})

    QualityInspection.objects.create(
        check_in=check_in,
        result=result,
        grade=grade,
        moisture_percentage=moisture_percentage,
        foreign_matter_percentage=foreign_matter_percentage,
        damaged_percentage=damaged_percentage,
        sample_reference=sample_reference,
        inspection_notes=inspection_notes,
        rejection_reason=rejection_reason.strip(),
        inspected_by=actor,
    )
    previous_status = procurement_request.status
    if result == QualityInspection.Result.REJECTED:
        _release_reservation(reservation, actor)
        appointment.status = ProcurementAppointment.Status.REJECTED
        appointment.save(update_fields=["status", "updated_at"])
        procurement_request.status = ProcurementRequest.Status.INSPECTION_REJECTED
        event_note = f"Quality inspection rejected: {rejection_reason.strip()}"
    else:
        procurement_request.status = ProcurementRequest.Status.INSPECTION_PASSED
        event_note = f"Quality inspection passed with grade {grade}."
    procurement_request.save(update_fields=["status", "updated_at"])
    _record_status_event(procurement_request, actor, previous_status, event_note)
    from .milestone5_services import create_notification
    from .models import Notification

    create_notification(
        recipient=procurement_request.farmer,
        category=Notification.Category.QUALITY,
        title="Quality inspection recorded",
        message=(
            f"{procurement_request.request_number} passed quality inspection with grade {grade}."
            if result == QualityInspection.Result.PASSED
            else f"{procurement_request.request_number} was rejected at inspection: {rejection_reason.strip()}"
        ),
        request=procurement_request,
    )
    return appointment


@transaction.atomic
def weigh_appointment(
    appointment_id,
    actor,
    *,
    gross_weight_kg: Decimal,
    tare_weight_kg: Decimal,
    bag_count=None,
    weighbridge_reference: str = "",
    weighment_notes: str = "",
) -> ProcurementAppointment:
    procurement_request, _, _, appointment, reservation = _lock_physical_context(
        appointment_id, actor
    )
    if procurement_request.status != ProcurementRequest.Status.INSPECTION_PASSED:
        raise ValidationError({"status": "A passed inspection is required before weighment."})
    if appointment.status != ProcurementAppointment.Status.CHECKED_IN:
        raise ValidationError({"status": "This appointment is not in physical processing."})
    if reservation.status != CapacityReservation.Status.ACTIVE:
        raise ValidationError({"capacity_reservation": "The arrival reservation is not active."})
    check_in = ArrivalCheckIn.objects.select_for_update().get(appointment=appointment)
    inspection = QualityInspection.objects.select_for_update().get(check_in=check_in)
    if inspection.result != QualityInspection.Result.PASSED:
        raise ValidationError({"inspection": "Only passed produce can be weighed."})
    if Weighment.objects.filter(inspection=inspection).exists():
        raise ValidationError({"weighment": "A weighment is already recorded."})
    if gross_weight_kg <= tare_weight_kg:
        raise ValidationError({"gross_weight_kg": "Gross weight must exceed tare weight."})

    net_weight = (gross_weight_kg - tare_weight_kg).quantize(Decimal("0.01"))
    Weighment.objects.create(
        inspection=inspection,
        gross_weight_kg=gross_weight_kg,
        tare_weight_kg=tare_weight_kg,
        net_weight_kg=net_weight,
        bag_count=bag_count,
        weighbridge_reference=weighbridge_reference,
        weighment_notes=weighment_notes,
        weighed_by=actor,
    )
    previous_status = procurement_request.status
    procurement_request.status = ProcurementRequest.Status.WEIGHED
    procurement_request.save(update_fields=["status", "updated_at"])
    _record_status_event(
        procurement_request,
        actor,
        previous_status,
        f"Gross {gross_weight_kg} kg, tare {tare_weight_kg} kg, net {net_weight} kg.",
    )
    return appointment


@transaction.atomic
def decide_appointment(
    appointment_id,
    actor,
    *,
    accepted_quantity_kg: Decimal,
    rate_per_kg: Decimal | None = None,
    decision_reason: str = "",
) -> ProcurementAppointment:
    procurement_request, center, farmer_crop, appointment, reservation = (
        _lock_physical_context(appointment_id, actor)
    )
    if procurement_request.status != ProcurementRequest.Status.WEIGHED:
        raise ValidationError({"status": "Weighment must be completed before acceptance."})
    if appointment.status != ProcurementAppointment.Status.CHECKED_IN:
        raise ValidationError({"status": "This appointment is not in physical processing."})
    if reservation.status != CapacityReservation.Status.ACTIVE:
        raise ValidationError({"capacity_reservation": "The arrival reservation is not active."})

    check_in = ArrivalCheckIn.objects.select_for_update().get(appointment=appointment)
    inspection = QualityInspection.objects.select_for_update().get(check_in=check_in)
    weighment = Weighment.objects.select_for_update().get(inspection=inspection)
    if AcceptanceDecision.objects.filter(weighment=weighment).exists():
        raise ValidationError({"decision": "An acceptance decision is already recorded."})
    if accepted_quantity_kg < 0:
        raise ValidationError({"accepted_quantity_kg": "Accepted quantity cannot be negative."})
    if accepted_quantity_kg > weighment.net_weight_kg:
        raise ValidationError(
            {"accepted_quantity_kg": "Accepted quantity cannot exceed net weight."}
        )
    if accepted_quantity_kg > reservation.quantity_kg:
        raise ValidationError(
            {"accepted_quantity_kg": "Accepted quantity cannot exceed reserved capacity."}
        )
    if accepted_quantity_kg > farmer_crop.available_quantity_kg:
        raise ValidationError(
            {"accepted_quantity_kg": "Accepted quantity exceeds current crop availability."}
        )

    rejected_quantity = weighment.net_weight_kg - accepted_quantity_kg
    if accepted_quantity_kg == 0:
        outcome = AcceptanceDecision.Outcome.REJECTED
    elif rejected_quantity == 0:
        outcome = AcceptanceDecision.Outcome.ACCEPTED
    else:
        outcome = AcceptanceDecision.Outcome.PARTIALLY_ACCEPTED
    if outcome != AcceptanceDecision.Outcome.ACCEPTED and not decision_reason.strip():
        raise ValidationError(
            {"decision_reason": "Record a reason for rejected or partially accepted quantity."}
        )
    if accepted_quantity_kg > 0 and (rate_per_kg is None or rate_per_kg <= 0):
        raise ValidationError({"rate_per_kg": "A positive rate is required for accepted produce."})

    decision = AcceptanceDecision.objects.create(
        weighment=weighment,
        outcome=outcome,
        accepted_quantity_kg=accepted_quantity_kg,
        rejected_quantity_kg=rejected_quantity,
        decision_reason=decision_reason.strip(),
        decided_by=actor,
    )
    previous_status = procurement_request.status

    if outcome == AcceptanceDecision.Outcome.REJECTED:
        _release_reservation(reservation, actor)
        appointment.status = ProcurementAppointment.Status.REJECTED
        appointment.save(update_fields=["status", "updated_at"])
        procurement_request.status = ProcurementRequest.Status.PROCUREMENT_REJECTED
        procurement_request.save(update_fields=["status", "updated_at"])
        _record_status_event(
            procurement_request,
            actor,
            previous_status,
            f"Entire net quantity rejected: {decision_reason.strip()}",
        )
        from .milestone5_services import create_notification
        from .models import Notification

        create_notification(
            recipient=procurement_request.farmer,
            category=Notification.Category.PROCUREMENT,
            title="Procurement rejected",
            message=f"{procurement_request.request_number} was rejected after weighment: {decision_reason.strip()}",
            request=procurement_request,
        )
        return appointment

    total_amount = (accepted_quantity_kg * rate_per_kg).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )
    procurement_transaction = ProcurementTransaction.objects.create(
        request=procurement_request,
        appointment=appointment,
        acceptance_decision=decision,
        farmer=procurement_request.farmer,
        farmer_crop=farmer_crop,
        procurement_center=center,
        accepted_quantity_kg=accepted_quantity_kg,
        rate_per_kg=rate_per_kg,
        total_amount=total_amount,
        acceptance_notes=decision_reason.strip(),
        recorded_by=actor,
    )
    ProcurementReceipt.objects.create(transaction=procurement_transaction)

    now = timezone.now()
    reservation.status = CapacityReservation.Status.CONSUMED
    reservation.consumed_at = now
    reservation.consumed_by = actor
    reservation.save(
        update_fields=["status", "consumed_at", "consumed_by", "updated_at"]
    )
    farmer_crop.available_quantity_kg -= accepted_quantity_kg
    if farmer_crop.available_quantity_kg == 0:
        farmer_crop.is_active = False
    farmer_crop.save(update_fields=["available_quantity_kg", "is_active", "updated_at"])
    appointment.status = ProcurementAppointment.Status.COMPLETED
    appointment.save(update_fields=["status", "updated_at"])
    procurement_request.status = ProcurementRequest.Status.PROCURED
    procurement_request.save(update_fields=["status", "updated_at"])
    _record_status_event(
        procurement_request,
        actor,
        previous_status,
        (
            f"{accepted_quantity_kg} kg procured at INR {rate_per_kg}/kg; "
            f"amount payable INR {total_amount}."
        ),
    )
    from .milestone5_services import create_notification
    from .models import Notification

    create_notification(
        recipient=procurement_request.farmer,
        category=Notification.Category.PROCUREMENT,
        title="Procurement completed",
        message=(
            f"{procurement_transaction.transaction_number} recorded {accepted_quantity_kg} kg "
            f"with INR {total_amount} payable."
        ),
        request=procurement_request,
        transaction=procurement_transaction,
    )
    return appointment
