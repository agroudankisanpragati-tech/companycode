import datetime
import uuid
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP

from django.db.models import Q, Sum
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models import User

from .models import Grievance, OfficerAssignment, PaymentRecord, ProcurementTransaction


def _parse_date(value, fallback, field):
    if not value:
        return fallback
    try:
        return datetime.date.fromisoformat(value)
    except ValueError as exc:
        raise ValidationError({field: "Use ISO date format YYYY-MM-DD."}) from exc


def _money(value):
    return str((value or Decimal("0.00")).quantize(Decimal("0.01")))


def _quantity(value):
    return str((value or Decimal("0.00")).quantize(Decimal("0.01")))


def _uuid_filter(value, field):
    if not value:
        return None
    try:
        return uuid.UUID(value)
    except (TypeError, ValueError, AttributeError) as exc:
        raise ValidationError({field: "Use a valid UUID."}) from exc


def procurement_analytics(*, actor, params, today):
    date_to = _parse_date(params.get("date_to"), today, "date_to")
    date_from = _parse_date(params.get("date_from"), date_to - datetime.timedelta(days=29), "date_from")
    if date_from > date_to:
        raise ValidationError({"date_from": "Start date cannot be later than end date."})
    if (date_to - date_from).days > 365:
        raise ValidationError({"date_to": "Analytics range cannot exceed 366 days."})

    transactions = ProcurementTransaction.objects.select_related(
        "procurement_center", "farmer_crop__crop", "acceptance_decision__weighment"
    ).filter(procured_at__date__range=(date_from, date_to))
    if actor.role == User.Role.PROCUREMENT_OFFICER:
        center_id = OfficerAssignment.objects.filter(
            officer=actor,
            is_active=True,
            procurement_center__is_active=True,
        ).values_list("procurement_center_id", flat=True).first()
        if center_id is None:
            raise PermissionDenied("No active procurement centre is assigned to this officer.")
        transactions = transactions.filter(procurement_center_id=center_id)
    elif actor.role != User.Role.ADMIN:
        raise PermissionDenied("Analytics is available to officers and administrators.")

    center_filter = _uuid_filter(params.get("center"), "center")
    crop_filter = _uuid_filter(params.get("crop"), "crop")
    if center_filter:
        transactions = transactions.filter(procurement_center_id=center_filter)
    if crop_filter:
        transactions = transactions.filter(farmer_crop__crop_id=crop_filter)
    transactions = transactions.order_by("procured_at")

    aggregates = transactions.aggregate(
        quantity=Sum("accepted_quantity_kg"),
        net_quantity=Sum("acceptance_decision__weighment__net_weight_kg"),
        payable=Sum("total_amount"),
    )
    transaction_ids = list(transactions.values_list("id", flat=True))
    payments = PaymentRecord.objects.filter(transaction_id__in=transaction_ids)
    settled_amount = payments.filter(status=PaymentRecord.Status.SETTLED).aggregate(
        total=Sum("amount")
    )["total"] or Decimal("0.00")
    payable = aggregates["payable"] or Decimal("0.00")
    quantity = aggregates["quantity"] or Decimal("0.00")
    net_quantity = aggregates["net_quantity"] or Decimal("0.00")
    count = len(transaction_ids)
    settlement_rate = (
        (settled_amount / payable * 100).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if payable else Decimal("0.00")
    )
    acceptance_rate = (
        (quantity / net_quantity * 100).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if net_quantity else Decimal("0.00")
    )

    grievance_scope = Q(transaction_id__in=transaction_ids) | Q(payment__transaction_id__in=transaction_ids)
    request_ids = transactions.values_list("request_id", flat=True)
    grievance_scope |= Q(request_id__in=request_ids)
    grievances = Grievance.objects.filter(grievance_scope).distinct()

    daily = {}
    cursor = date_from
    while cursor <= date_to:
        daily[cursor] = {
            "date": cursor.isoformat(),
            "transactions": 0,
            "quantity_kg": Decimal("0.00"),
            "payable_amount": Decimal("0.00"),
            "settled_amount": Decimal("0.00"),
        }
        cursor += datetime.timedelta(days=1)
    crop_rows = defaultdict(lambda: {"transactions": 0, "quantity": Decimal("0.00"), "payable": Decimal("0.00")})
    center_rows = defaultdict(lambda: {"transactions": 0, "quantity": Decimal("0.00"), "payable": Decimal("0.00")})
    transaction_rows = list(transactions.values(
        "id", "procured_at", "accepted_quantity_kg", "total_amount",
        "farmer_crop__crop__code", "farmer_crop__crop__name",
        "procurement_center__code", "procurement_center__name",
    ))
    for row in transaction_rows:
        day = row["procured_at"].date()
        daily[day]["transactions"] += 1
        daily[day]["quantity_kg"] += row["accepted_quantity_kg"]
        daily[day]["payable_amount"] += row["total_amount"]
        crop_key = (row["farmer_crop__crop__code"], row["farmer_crop__crop__name"])
        center_key = (row["procurement_center__code"], row["procurement_center__name"])
        for bucket, key in ((crop_rows, crop_key), (center_rows, center_key)):
            bucket[key]["transactions"] += 1
            bucket[key]["quantity"] += row["accepted_quantity_kg"]
            bucket[key]["payable"] += row["total_amount"]
    for payment in payments.filter(
        status=PaymentRecord.Status.SETTLED,
        settled_at__date__range=(date_from, date_to),
    ):
        daily[payment.settled_at.date()]["settled_amount"] += payment.amount

    payment_counts = {status: 0 for status in PaymentRecord.Status.values}
    for row in payments.values("status"):
        payment_counts[row["status"]] += 1
    payment_status = [{"status": "UNINITIATED", "count": count - payments.count()}]
    payment_status.extend({"status": key, "count": payment_counts[key]} for key in PaymentRecord.Status.values)

    grievance_counts = {status: 0 for status in Grievance.Status.values}
    for row in grievances.values("status"):
        grievance_counts[row["status"]] += 1

    return {
        "filters": {
            "date_from": date_from.isoformat(),
            "date_to": date_to.isoformat(),
            "center": str(center_filter) if center_filter else None,
            "crop": str(crop_filter) if crop_filter else None,
        },
        "totals": {
            "transaction_count": count,
            "accepted_quantity_kg": _quantity(quantity),
            "payable_amount": _money(payable),
            "settled_amount": _money(settled_amount),
            "outstanding_amount": _money(payable - settled_amount),
            "settlement_rate": str(settlement_rate),
            "acceptance_rate": str(acceptance_rate),
            "open_grievances": grievances.filter(
                status__in=(Grievance.Status.OPEN, Grievance.Status.UNDER_REVIEW)
            ).count(),
            "failed_payments": payments.filter(status=PaymentRecord.Status.FAILED).count(),
        },
        "daily_trend": [
            {
                **row,
                "quantity_kg": _quantity(row["quantity_kg"]),
                "payable_amount": _money(row["payable_amount"]),
                "settled_amount": _money(row["settled_amount"]),
            }
            for row in daily.values()
        ],
        "crop_breakdown": [
            {
                "crop_code": key[0], "crop_name": key[1], "transactions": row["transactions"],
                "quantity_kg": _quantity(row["quantity"]), "payable_amount": _money(row["payable"]),
            }
            for key, row in sorted(crop_rows.items())
        ],
        "center_breakdown": [
            {
                "center_code": key[0], "center_name": key[1], "transactions": row["transactions"],
                "quantity_kg": _quantity(row["quantity"]), "payable_amount": _money(row["payable"]),
            }
            for key, row in sorted(center_rows.items())
        ],
        "payment_status_breakdown": payment_status,
        "grievance_status_breakdown": [
            {"status": key, "count": grievance_counts[key]} for key in Grievance.Status.values
        ],
    }
