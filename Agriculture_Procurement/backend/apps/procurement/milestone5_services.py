import hashlib
import json
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models import User

from .models import (
    Grievance,
    GrievanceEvent,
    Notification,
    OfficerAssignment,
    PaymentEvent,
    PaymentReceipt,
    PaymentRecord,
    ProcurementRequest,
    ProcurementTransaction,
)


def create_notification(*, recipient, category, title, message, **references) -> Notification:
    return Notification.objects.create(
        recipient=recipient,
        category=category,
        title=title,
        message=message,
        **references,
    )


def _canonical(value):
    if isinstance(value, Decimal):
        return str(value)
    if hasattr(value, "hex"):
        return str(value)
    return value


def _fingerprint(payload: dict) -> str:
    encoded = json.dumps(
        payload,
        sort_keys=True,
        separators=(",", ":"),
        default=_canonical,
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _validate_idempotency_key(value: str) -> str:
    key = value.strip()
    if not key:
        raise ValidationError({"idempotency_key": "Provide an Idempotency-Key header."})
    if len(key) > 64:
        raise ValidationError({"idempotency_key": "Idempotency-Key cannot exceed 64 characters."})
    return key


def _active_center_id(actor):
    assignment = OfficerAssignment.objects.filter(
        officer=actor,
        is_active=True,
        procurement_center__is_active=True,
    ).values_list("procurement_center_id", flat=True).first()
    if assignment is None:
        raise PermissionDenied("No active procurement centre is assigned to this officer.")
    return assignment


def _validate_payment_operator(actor, transaction_record, *, reconciliation=False):
    if actor.role == User.Role.ADMIN:
        return
    if reconciliation:
        raise PermissionDenied("Only an administrator can reconcile payment settlement.")
    if actor.role != User.Role.PROCUREMENT_OFFICER:
        raise PermissionDenied("Only a procurement officer or administrator can operate payments.")
    if transaction_record.procurement_center_id != _active_center_id(actor):
        raise PermissionDenied("This transaction belongs to a different procurement centre.")


def _find_replay(*, key, action, fingerprint, payment=None, transaction_record=None):
    event = PaymentEvent.objects.select_related("payment", "payment__transaction").filter(
        idempotency_key=key
    ).first()
    if event is None:
        return None
    same_target = payment is not None and event.payment_id == payment.id
    if transaction_record is not None:
        same_target = event.payment.transaction_id == transaction_record.id
    if event.action != action or event.payload_fingerprint != fingerprint or not same_target:
        raise ValidationError(
            {"idempotency_key": "This key was already used for a different payment operation."}
        )
    return event.payment


@transaction.atomic
def initiate_payment(
    *,
    transaction_id,
    actor,
    method: str,
    beneficiary_reference: str,
    note: str,
    idempotency_key: str,
) -> PaymentRecord:
    key = _validate_idempotency_key(idempotency_key)
    transaction_record = ProcurementTransaction.objects.select_for_update().select_related(
        "farmer", "procurement_center"
    ).get(pk=transaction_id)
    _validate_payment_operator(actor, transaction_record)
    payload = {
        "transaction": str(transaction_record.id),
        "method": method,
        "beneficiary_reference": beneficiary_reference.strip(),
        "note": note.strip(),
    }
    fingerprint = _fingerprint(payload)
    replay = _find_replay(
        key=key,
        action=PaymentEvent.Action.INITIATE,
        fingerprint=fingerprint,
        transaction_record=transaction_record,
    )
    if replay:
        return replay
    if PaymentRecord.objects.filter(transaction=transaction_record).exists():
        raise ValidationError({"transaction": "A payment already exists for this transaction."})

    payment = PaymentRecord.objects.create(
        transaction=transaction_record,
        amount=transaction_record.total_amount,
        method=method,
        beneficiary_reference=beneficiary_reference.strip() or "Verified farmer account",
        initiated_by=actor,
    )
    PaymentEvent.objects.create(
        payment=payment,
        action=PaymentEvent.Action.INITIATE,
        from_status="",
        to_status=PaymentRecord.Status.INITIATED,
        actor=actor,
        note=note.strip(),
        idempotency_key=key,
        payload_fingerprint=fingerprint,
    )
    create_notification(
        recipient=transaction_record.farmer,
        category=Notification.Category.PAYMENT,
        title="Payment initiated",
        message=f"Payment {payment.payment_number} for INR {payment.amount} has been initiated.",
        request=transaction_record.request,
        transaction=transaction_record,
        payment=payment,
    )
    return payment


@transaction.atomic
def transition_payment(
    *,
    payment_id,
    actor,
    action: str,
    idempotency_key: str,
    note: str = "",
    bank_reference: str = "",
    failure_reason: str = "",
) -> PaymentRecord:
    key = _validate_idempotency_key(idempotency_key)
    payment = PaymentRecord.objects.select_for_update().select_related(
        "transaction", "transaction__farmer", "transaction__request", "transaction__procurement_center"
    ).get(pk=payment_id)
    reconciliation = action in (PaymentEvent.Action.SETTLE, PaymentEvent.Action.FAIL)
    _validate_payment_operator(actor, payment.transaction, reconciliation=reconciliation)
    payload = {
        "payment": str(payment.id),
        "action": action,
        "note": note.strip(),
        "bank_reference": bank_reference.strip(),
        "failure_reason": failure_reason.strip(),
    }
    fingerprint = _fingerprint(payload)
    replay = _find_replay(
        key=key,
        action=action,
        fingerprint=fingerprint,
        payment=payment,
    )
    if replay:
        return replay

    allowed = {
        PaymentEvent.Action.START_PROCESSING: (PaymentRecord.Status.INITIATED, PaymentRecord.Status.PROCESSING),
        PaymentEvent.Action.SETTLE: (PaymentRecord.Status.PROCESSING, PaymentRecord.Status.SETTLED),
        PaymentEvent.Action.FAIL: (
            (PaymentRecord.Status.INITIATED, PaymentRecord.Status.PROCESSING),
            PaymentRecord.Status.FAILED,
        ),
        PaymentEvent.Action.RETRY: (PaymentRecord.Status.FAILED, PaymentRecord.Status.INITIATED),
    }
    if action not in allowed:
        raise ValidationError({"action": "Unsupported payment action."})
    expected, target = allowed[action]
    expected_values = expected if isinstance(expected, tuple) else (expected,)
    if payment.status not in expected_values:
        raise ValidationError(
            {"status": f"{action.replace('_', ' ').title()} is not allowed from {payment.get_status_display()}."}
        )
    if action == PaymentEvent.Action.SETTLE and not bank_reference.strip():
        raise ValidationError({"bank_reference": "A bank reference is required for settlement."})
    if action == PaymentEvent.Action.SETTLE and PaymentRecord.objects.exclude(pk=payment.pk).filter(
        bank_reference=bank_reference.strip().upper()
    ).exists():
        raise ValidationError({"bank_reference": "This bank reference is already reconciled."})
    if action == PaymentEvent.Action.FAIL and not failure_reason.strip():
        raise ValidationError({"failure_reason": "A failure reason is required."})

    now = timezone.now()
    previous = payment.status
    payment.status = target
    update_fields = ["status", "updated_at"]
    if action == PaymentEvent.Action.START_PROCESSING:
        payment.processing_at = now
        update_fields.append("processing_at")
    elif action == PaymentEvent.Action.SETTLE:
        payment.settled_at = now
        payment.bank_reference = bank_reference.strip().upper()
        update_fields.extend(["settled_at", "bank_reference"])
    elif action == PaymentEvent.Action.FAIL:
        payment.last_failed_at = now
        payment.last_failure_reason = failure_reason.strip()
        update_fields.extend(["last_failed_at", "last_failure_reason"])
    elif action == PaymentEvent.Action.RETRY:
        payment.attempt_count += 1
        payment.processing_at = None
        update_fields.extend(["attempt_count", "processing_at"])
    payment.save(update_fields=update_fields)

    event_note = failure_reason.strip() if action == PaymentEvent.Action.FAIL else note.strip()
    PaymentEvent.objects.create(
        payment=payment,
        action=action,
        from_status=previous,
        to_status=target,
        actor=actor,
        note=event_note,
        external_reference=payment.bank_reference if action == PaymentEvent.Action.SETTLE else "",
        idempotency_key=key,
        payload_fingerprint=fingerprint,
    )
    if action == PaymentEvent.Action.SETTLE:
        PaymentReceipt.objects.create(payment=payment, issued_by=actor)

    labels = {
        PaymentEvent.Action.START_PROCESSING: ("Payment processing", "is now being processed"),
        PaymentEvent.Action.SETTLE: ("Payment settled", "has been settled successfully"),
        PaymentEvent.Action.FAIL: ("Payment needs attention", "could not be completed"),
        PaymentEvent.Action.RETRY: ("Payment retry initiated", "has been queued for another attempt"),
    }
    title, phrase = labels[action]
    create_notification(
        recipient=payment.transaction.farmer,
        category=Notification.Category.PAYMENT,
        title=title,
        message=f"Payment {payment.payment_number} {phrase}.",
        request=payment.transaction.request,
        transaction=payment.transaction,
        payment=payment,
    )
    return payment


def _validate_grievance_references(*, farmer, request_record=None, transaction_record=None, payment=None):
    if request_record and request_record.farmer_id != farmer.id:
        raise ValidationError({"request": "The request must belong to you."})
    if transaction_record and transaction_record.farmer_id != farmer.id:
        raise ValidationError({"transaction": "The transaction must belong to you."})
    if payment and payment.transaction.farmer_id != farmer.id:
        raise ValidationError({"payment": "The payment must belong to you."})
    if payment and transaction_record and payment.transaction_id != transaction_record.id:
        raise ValidationError({"payment": "The payment does not match the transaction."})
    if transaction_record and request_record and transaction_record.request_id != request_record.id:
        raise ValidationError({"transaction": "The transaction does not match the request."})


@transaction.atomic
def create_grievance(*, farmer, data: dict) -> Grievance:
    if farmer.role != User.Role.FARMER:
        raise PermissionDenied("Only a farmer can lodge a grievance.")
    request_record = data.get("request")
    transaction_record = data.get("transaction")
    payment = data.get("payment")
    _validate_grievance_references(
        farmer=farmer,
        request_record=request_record,
        transaction_record=transaction_record,
        payment=payment,
    )
    grievance = Grievance.objects.create(farmer=farmer, **data)
    GrievanceEvent.objects.create(
        grievance=grievance,
        action=GrievanceEvent.Action.CREATED,
        from_status="",
        to_status=Grievance.Status.OPEN,
        actor=farmer,
        note="Grievance lodged by farmer.",
    )
    create_notification(
        recipient=farmer,
        category=Notification.Category.GRIEVANCE,
        title="Grievance received",
        message=f"Grievance {grievance.grievance_number} has been lodged and is awaiting review.",
        request=request_record,
        transaction=transaction_record,
        payment=payment,
        grievance=grievance,
    )
    return grievance


@transaction.atomic
def transition_grievance(*, grievance_id, actor, action: str, note: str = "") -> Grievance:
    # Lock only the grievance row.  Joining its optional references here creates
    # nullable outer joins, which PostgreSQL cannot include in SELECT ... FOR UPDATE.
    grievance = Grievance.objects.select_for_update().get(pk=grievance_id)
    if actor.role not in (User.Role.PROCUREMENT_OFFICER, User.Role.ADMIN):
        raise PermissionDenied("Only an officer or administrator can review grievances.")
    if actor.role == User.Role.PROCUREMENT_OFFICER:
        center_id = _active_center_id(actor)
        linked_center_ids = {
            grievance.request.procurement_center_id if grievance.request_id else None,
            grievance.transaction.procurement_center_id if grievance.transaction_id else None,
            grievance.payment.transaction.procurement_center_id if grievance.payment_id else None,
        }
        if center_id not in linked_center_ids:
            raise PermissionDenied("This grievance is not linked to your assigned centre.")

    transitions = {
        GrievanceEvent.Action.START_REVIEW: ((Grievance.Status.OPEN,), Grievance.Status.UNDER_REVIEW),
        GrievanceEvent.Action.RESOLVE: (
            (Grievance.Status.OPEN, Grievance.Status.UNDER_REVIEW),
            Grievance.Status.RESOLVED,
        ),
        GrievanceEvent.Action.REJECT: (
            (Grievance.Status.OPEN, Grievance.Status.UNDER_REVIEW),
            Grievance.Status.REJECTED,
        ),
    }
    if action not in transitions:
        raise ValidationError({"action": "Unsupported grievance action."})
    expected, target = transitions[action]
    if grievance.status not in expected:
        raise ValidationError({"status": "This grievance transition is not allowed."})
    if target in (Grievance.Status.RESOLVED, Grievance.Status.REJECTED) and not note.strip():
        raise ValidationError({"note": "A resolution is required to close a grievance."})

    previous = grievance.status
    grievance.status = target
    grievance.assigned_to = actor
    fields = ["status", "assigned_to", "updated_at"]
    if target in (Grievance.Status.RESOLVED, Grievance.Status.REJECTED):
        grievance.resolution = note.strip()
        grievance.resolved_at = timezone.now()
        fields.extend(["resolution", "resolved_at"])
    grievance.save(update_fields=fields)
    GrievanceEvent.objects.create(
        grievance=grievance,
        action=action,
        from_status=previous,
        to_status=target,
        actor=actor,
        note=note.strip(),
    )
    create_notification(
        recipient=grievance.farmer,
        category=Notification.Category.GRIEVANCE,
        title=f"Grievance {grievance.get_status_display().lower()}",
        message=f"{grievance.grievance_number} is now {grievance.get_status_display().lower()}.",
        request=grievance.request,
        transaction=grievance.transaction,
        payment=grievance.payment,
        grievance=grievance,
    )
    return grievance
