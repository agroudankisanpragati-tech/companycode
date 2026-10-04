from decimal import Decimal

from rest_framework import serializers

from .models import (
    AcceptanceDecision,
    ArrivalCheckIn,
    ProcurementReceipt,
    ProcurementTransaction,
    QualityInspection,
    Weighment,
)


def _actor_name(actor) -> str | None:
    if actor is None:
        return None
    return actor.get_full_name() or actor.email


class ArrivalCheckInSerializer(serializers.ModelSerializer):
    transport_mode_label = serializers.CharField(
        source="get_transport_mode_display", read_only=True
    )
    checked_in_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ArrivalCheckIn
        fields = (
            "id",
            "transport_mode",
            "transport_mode_label",
            "vehicle_number",
            "arrival_notes",
            "checked_in_by",
            "checked_in_by_name",
            "checked_in_at",
        )
        read_only_fields = fields

    def get_checked_in_by_name(self, obj):
        return _actor_name(obj.checked_in_by)


class QualityInspectionSerializer(serializers.ModelSerializer):
    result_label = serializers.CharField(source="get_result_display", read_only=True)
    grade_label = serializers.CharField(source="get_grade_display", read_only=True)
    inspected_by_name = serializers.SerializerMethodField()

    class Meta:
        model = QualityInspection
        fields = (
            "id",
            "result",
            "result_label",
            "grade",
            "grade_label",
            "moisture_percentage",
            "foreign_matter_percentage",
            "damaged_percentage",
            "sample_reference",
            "inspection_notes",
            "rejection_reason",
            "inspected_by",
            "inspected_by_name",
            "inspected_at",
        )
        read_only_fields = fields

    def get_inspected_by_name(self, obj):
        return _actor_name(obj.inspected_by)


class WeighmentSerializer(serializers.ModelSerializer):
    weighed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Weighment
        fields = (
            "id",
            "gross_weight_kg",
            "tare_weight_kg",
            "net_weight_kg",
            "bag_count",
            "weighbridge_reference",
            "weighment_notes",
            "weighed_by",
            "weighed_by_name",
            "weighed_at",
        )
        read_only_fields = fields

    def get_weighed_by_name(self, obj):
        return _actor_name(obj.weighed_by)


class AcceptanceDecisionSerializer(serializers.ModelSerializer):
    outcome_label = serializers.CharField(source="get_outcome_display", read_only=True)
    decided_by_name = serializers.SerializerMethodField()

    class Meta:
        model = AcceptanceDecision
        fields = (
            "id",
            "outcome",
            "outcome_label",
            "accepted_quantity_kg",
            "rejected_quantity_kg",
            "decision_reason",
            "decided_by",
            "decided_by_name",
            "decided_at",
        )
        read_only_fields = fields

    def get_decided_by_name(self, obj):
        return _actor_name(obj.decided_by)


class ProcurementReceiptSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProcurementReceipt
        fields = ("id", "receipt_number", "verification_code", "issued_at")
        read_only_fields = fields


class ProcurementTransactionSerializer(serializers.ModelSerializer):
    request_number = serializers.CharField(source="request.request_number", read_only=True)
    farmer_name = serializers.SerializerMethodField()
    farmer_code = serializers.CharField(
        source="farmer.farmer_profile.farmer_code", read_only=True
    )
    crop_name = serializers.CharField(source="farmer_crop.crop.name", read_only=True)
    crop_code = serializers.CharField(source="farmer_crop.crop.code", read_only=True)
    center_code = serializers.CharField(source="procurement_center.code", read_only=True)
    center_name = serializers.CharField(source="procurement_center.name", read_only=True)
    token_code = serializers.CharField(source="appointment.token_code", read_only=True)
    scheduled_date = serializers.DateField(source="appointment.scheduled_date", read_only=True)
    net_weight_kg = serializers.DecimalField(
        source="acceptance_decision.weighment.net_weight_kg",
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )
    rejected_quantity_kg = serializers.DecimalField(
        source="acceptance_decision.rejected_quantity_kg",
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )
    outcome = serializers.CharField(source="acceptance_decision.outcome", read_only=True)
    outcome_label = serializers.CharField(
        source="acceptance_decision.get_outcome_display", read_only=True
    )
    recorded_by_name = serializers.SerializerMethodField()
    receipt = ProcurementReceiptSerializer(read_only=True)
    payment_status = serializers.SerializerMethodField()
    payment_id = serializers.SerializerMethodField()

    class Meta:
        model = ProcurementTransaction
        fields = (
            "id",
            "transaction_number",
            "request",
            "request_number",
            "appointment",
            "token_code",
            "scheduled_date",
            "farmer",
            "farmer_name",
            "farmer_code",
            "farmer_crop",
            "crop_name",
            "crop_code",
            "procurement_center",
            "center_code",
            "center_name",
            "outcome",
            "outcome_label",
            "net_weight_kg",
            "accepted_quantity_kg",
            "rejected_quantity_kg",
            "rate_per_kg",
            "total_amount",
            "acceptance_notes",
            "recorded_by",
            "recorded_by_name",
            "procured_at",
            "receipt",
            "payment_status",
            "payment_id",
        )
        read_only_fields = fields

    def get_farmer_name(self, obj):
        return _actor_name(obj.farmer)

    def get_recorded_by_name(self, obj):
        return _actor_name(obj.recorded_by)

    def get_payment_status(self, obj):
        try:
            return obj.payment.status
        except ProcurementTransaction.payment.RelatedObjectDoesNotExist:
            return "UNINITIATED"

    def get_payment_id(self, obj):
        try:
            return obj.payment.id
        except ProcurementTransaction.payment.RelatedObjectDoesNotExist:
            return None


class CheckInActionSerializer(serializers.Serializer):
    transport_mode = serializers.ChoiceField(
        choices=ArrivalCheckIn.TransportMode.choices,
        default=ArrivalCheckIn.TransportMode.TRACTOR,
    )
    vehicle_number = serializers.CharField(max_length=20, required=False, allow_blank=True)
    arrival_notes = serializers.CharField(max_length=500, required=False, allow_blank=True)


class InspectionActionSerializer(serializers.Serializer):
    result = serializers.ChoiceField(choices=QualityInspection.Result.choices)
    grade = serializers.ChoiceField(
        choices=QualityInspection.Grade.choices,
        required=False,
    )
    moisture_percentage = serializers.DecimalField(
        max_digits=5,
        decimal_places=2,
        min_value=Decimal("0"),
        max_value=Decimal("100"),
        required=False,
        allow_null=True,
    )
    foreign_matter_percentage = serializers.DecimalField(
        max_digits=5,
        decimal_places=2,
        min_value=Decimal("0"),
        max_value=Decimal("100"),
        required=False,
        allow_null=True,
    )
    damaged_percentage = serializers.DecimalField(
        max_digits=5,
        decimal_places=2,
        min_value=Decimal("0"),
        max_value=Decimal("100"),
        required=False,
        allow_null=True,
    )
    sample_reference = serializers.CharField(max_length=60, required=False, allow_blank=True)
    inspection_notes = serializers.CharField(max_length=500, required=False, allow_blank=True)
    rejection_reason = serializers.CharField(max_length=500, required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs["result"] == QualityInspection.Result.REJECTED:
            if not attrs.get("rejection_reason", "").strip():
                raise serializers.ValidationError(
                    {"rejection_reason": "A rejected inspection needs a reason."}
                )
            attrs["grade"] = QualityInspection.Grade.NOT_APPLICABLE
        else:
            attrs.setdefault("grade", QualityInspection.Grade.FAQ)
        return attrs


class WeighmentActionSerializer(serializers.Serializer):
    gross_weight_kg = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0.01"),
    )
    tare_weight_kg = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0"),
    )
    bag_count = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    weighbridge_reference = serializers.CharField(
        max_length=60, required=False, allow_blank=True
    )
    weighment_notes = serializers.CharField(max_length=500, required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs["gross_weight_kg"] <= attrs["tare_weight_kg"]:
            raise serializers.ValidationError(
                {"gross_weight_kg": "Gross weight must exceed tare weight."}
            )
        return attrs


class AcceptanceActionSerializer(serializers.Serializer):
    accepted_quantity_kg = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0"),
    )
    rate_per_kg = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal("0.01"),
        required=False,
        allow_null=True,
    )
    decision_reason = serializers.CharField(max_length=500, required=False, allow_blank=True)

    def validate(self, attrs):
        accepted = attrs["accepted_quantity_kg"]
        if accepted > 0 and attrs.get("rate_per_kg") is None:
            raise serializers.ValidationError(
                {"rate_per_kg": "A positive rate is required for accepted produce."}
            )
        if accepted == 0 and not attrs.get("decision_reason", "").strip():
            raise serializers.ValidationError(
                {"decision_reason": "Record a reason when the entire quantity is rejected."}
            )
        return attrs
