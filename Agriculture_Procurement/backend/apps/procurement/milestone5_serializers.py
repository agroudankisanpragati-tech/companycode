from rest_framework import serializers

from .models import (
    Grievance,
    GrievanceEvent,
    Notification,
    PaymentEvent,
    PaymentReceipt,
    PaymentRecord,
    ProcurementRequest,
    ProcurementTransaction,
)


def _actor_name(actor):
    if actor is None:
        return None
    return actor.get_full_name() or actor.email


class PaymentEventSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()
    action_label = serializers.CharField(source="get_action_display", read_only=True)

    class Meta:
        model = PaymentEvent
        fields = (
            "id", "action", "action_label", "from_status", "to_status", "actor_name",
            "note", "external_reference", "created_at",
        )
        read_only_fields = fields

    def get_actor_name(self, obj):
        return _actor_name(obj.actor)


class PaymentReceiptSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentReceipt
        fields = ("id", "receipt_number", "verification_code", "issued_at")
        read_only_fields = fields


class PaymentRecordSerializer(serializers.ModelSerializer):
    transaction_number = serializers.CharField(source="transaction.transaction_number", read_only=True)
    request_number = serializers.CharField(source="transaction.request.request_number", read_only=True)
    farmer_name = serializers.SerializerMethodField()
    farmer_code = serializers.CharField(source="transaction.farmer.farmer_profile.farmer_code", read_only=True)
    crop_name = serializers.CharField(source="transaction.farmer_crop.crop.name", read_only=True)
    center_code = serializers.CharField(source="transaction.procurement_center.code", read_only=True)
    center_name = serializers.CharField(source="transaction.procurement_center.name", read_only=True)
    method_label = serializers.CharField(source="get_method_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    events = PaymentEventSerializer(many=True, read_only=True)
    receipt = PaymentReceiptSerializer(source="settlement_receipt", read_only=True)

    class Meta:
        model = PaymentRecord
        fields = (
            "id", "payment_number", "transaction", "transaction_number", "request_number",
            "farmer_name", "farmer_code", "crop_name", "center_code", "center_name",
            "amount", "method", "method_label", "beneficiary_reference", "status",
            "status_label", "attempt_count", "initiated_at", "processing_at", "settled_at",
            "last_failed_at", "bank_reference", "last_failure_reason", "events", "receipt",
            "created_at", "updated_at",
        )
        read_only_fields = fields

    def get_farmer_name(self, obj):
        return _actor_name(obj.transaction.farmer)


class InitiatePaymentSerializer(serializers.Serializer):
    transaction = serializers.PrimaryKeyRelatedField(queryset=ProcurementTransaction.objects.all())
    method = serializers.ChoiceField(choices=PaymentRecord.Method.choices, default=PaymentRecord.Method.DBT)
    beneficiary_reference = serializers.CharField(max_length=120, required=False, allow_blank=True)
    note = serializers.CharField(max_length=500, required=False, allow_blank=True)


class PaymentActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(
        choices=(
            PaymentEvent.Action.START_PROCESSING,
            PaymentEvent.Action.SETTLE,
            PaymentEvent.Action.FAIL,
            PaymentEvent.Action.RETRY,
        )
    )
    note = serializers.CharField(max_length=500, required=False, allow_blank=True)
    bank_reference = serializers.CharField(max_length=80, required=False, allow_blank=True)
    failure_reason = serializers.CharField(max_length=500, required=False, allow_blank=True)


class GrievanceEventSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()
    action_label = serializers.CharField(source="get_action_display", read_only=True)

    class Meta:
        model = GrievanceEvent
        fields = (
            "id", "action", "action_label", "from_status", "to_status", "actor_name", "note", "created_at",
        )
        read_only_fields = fields

    def get_actor_name(self, obj):
        return _actor_name(obj.actor)


class GrievanceSerializer(serializers.ModelSerializer):
    farmer_name = serializers.SerializerMethodField()
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    priority_label = serializers.CharField(source="get_priority_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    request_number = serializers.CharField(source="request.request_number", read_only=True, allow_null=True)
    transaction_number = serializers.CharField(source="transaction.transaction_number", read_only=True, allow_null=True)
    payment_number = serializers.CharField(source="payment.payment_number", read_only=True, allow_null=True)
    assigned_to_name = serializers.SerializerMethodField()
    events = GrievanceEventSerializer(many=True, read_only=True)

    class Meta:
        model = Grievance
        fields = (
            "id", "grievance_number", "farmer", "farmer_name", "category", "category_label",
            "subject", "description", "priority", "priority_label", "status", "status_label",
            "request", "request_number", "transaction", "transaction_number", "payment",
            "payment_number", "assigned_to_name", "resolution", "resolved_at", "events",
            "created_at", "updated_at",
        )
        read_only_fields = fields

    def get_farmer_name(self, obj):
        return _actor_name(obj.farmer)

    def get_assigned_to_name(self, obj):
        return _actor_name(obj.assigned_to)


class CreateGrievanceSerializer(serializers.Serializer):
    category = serializers.ChoiceField(choices=Grievance.Category.choices)
    subject = serializers.CharField(max_length=160)
    description = serializers.CharField(max_length=2000)
    priority = serializers.ChoiceField(choices=Grievance.Priority.choices, default=Grievance.Priority.NORMAL)
    request = serializers.PrimaryKeyRelatedField(queryset=ProcurementRequest.objects.all(), required=False, allow_null=True)
    transaction = serializers.PrimaryKeyRelatedField(queryset=ProcurementTransaction.objects.all(), required=False, allow_null=True)
    payment = serializers.PrimaryKeyRelatedField(queryset=PaymentRecord.objects.all(), required=False, allow_null=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            farmer = request.user
            self.fields["request"].queryset = ProcurementRequest.objects.filter(farmer=farmer)
            self.fields["transaction"].queryset = ProcurementTransaction.objects.filter(farmer=farmer)
            self.fields["payment"].queryset = PaymentRecord.objects.filter(transaction__farmer=farmer)


class GrievanceActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(
        choices=(GrievanceEvent.Action.START_REVIEW, GrievanceEvent.Action.RESOLVE, GrievanceEvent.Action.REJECT)
    )
    note = serializers.CharField(max_length=2000, required=False, allow_blank=True)


class NotificationSerializer(serializers.ModelSerializer):
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    is_read = serializers.BooleanField(read_only=True)

    class Meta:
        model = Notification
        fields = (
            "id", "category", "category_label", "title", "message", "request", "transaction",
            "payment", "grievance", "created_at", "read_at", "is_read",
        )
        read_only_fields = fields
