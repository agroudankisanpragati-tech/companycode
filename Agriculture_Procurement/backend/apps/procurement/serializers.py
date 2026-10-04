from datetime import date
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import FarmerProfile, User

from .models import (
    CapacityReservation,
    CropCatalogue,
    FarmerCrop,
    OfficerAssignment,
    ProcurementAppointment,
    ProcurementCenter,
    ProcurementRequest,
    RequestStatusEvent,
)
from .intake_serializers import (
    AcceptanceDecisionSerializer,
    ArrivalCheckInSerializer,
    ProcurementReceiptSerializer,
    ProcurementTransactionSerializer,
    QualityInspectionSerializer,
    WeighmentSerializer,
)


class ProcurementCenterSerializer(serializers.ModelSerializer):
    center_type_label = serializers.CharField(source="get_center_type_display", read_only=True)

    class Meta:
        model = ProcurementCenter
        fields = (
            "id",
            "code",
            "name",
            "center_type",
            "center_type_label",
            "address_line",
            "village_or_city",
            "block",
            "district",
            "state",
            "pincode",
            "contact_phone",
            "latitude",
            "longitude",
            "daily_capacity_kg",
            "operating_start_time",
            "operating_end_time",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_code(self, value):
        value = value.upper().strip()
        queryset = ProcurementCenter.objects.filter(code=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("A procurement centre with this code already exists.")
        return value

    def validate(self, attrs):
        start = attrs.get("operating_start_time", getattr(self.instance, "operating_start_time", None))
        end = attrs.get("operating_end_time", getattr(self.instance, "operating_end_time", None))
        if start and end and start >= end:
            raise serializers.ValidationError(
                {"operating_end_time": "Closing time must be later than opening time."}
            )
        return attrs


class CropCatalogueSerializer(serializers.ModelSerializer):
    category_label = serializers.CharField(source="get_category_display", read_only=True)

    class Meta:
        model = CropCatalogue
        fields = (
            "id",
            "code",
            "name",
            "name_hi",
            "category",
            "category_label",
            "unit",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "unit", "created_at", "updated_at")

    def validate_code(self, value):
        value = value.upper().strip()
        queryset = CropCatalogue.objects.filter(code=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("A crop with this code already exists.")
        return value

    def validate_name(self, value):
        value = value.strip()
        queryset = CropCatalogue.objects.filter(name__iexact=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("A crop with this name already exists.")
        return value


class FarmerCropSerializer(serializers.ModelSerializer):
    farmer_name = serializers.CharField(source="farmer.get_full_name", read_only=True)
    farmer_code = serializers.CharField(source="farmer.farmer_profile.farmer_code", read_only=True)
    crop_name = serializers.CharField(source="crop.name", read_only=True)
    crop_name_hi = serializers.CharField(source="crop.name_hi", read_only=True)
    crop_code = serializers.CharField(source="crop.code", read_only=True)
    season_label = serializers.CharField(source="get_season_display", read_only=True)

    class Meta:
        model = FarmerCrop
        fields = (
            "id",
            "farmer",
            "farmer_name",
            "farmer_code",
            "crop",
            "crop_name",
            "crop_name_hi",
            "crop_code",
            "season",
            "season_label",
            "harvest_year",
            "cultivated_area_acres",
            "estimated_quantity_kg",
            "available_quantity_kg",
            "harvest_date",
            "notes",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "farmer",
            "farmer_name",
            "farmer_code",
            "crop_name",
            "crop_name_hi",
            "crop_code",
            "season_label",
            "created_at",
            "updated_at",
        )
        validators = []

    def validate_crop(self, value):
        if not value.is_active:
            raise serializers.ValidationError("Select an active crop from the catalogue.")
        return value

    def validate_harvest_year(self, value):
        if value < 2000 or value > date.today().year + 1:
            raise serializers.ValidationError(
                f"Harvest year must be between 2000 and {date.today().year + 1}."
            )
        return value

    def validate(self, attrs):
        estimated = attrs.get(
            "estimated_quantity_kg",
            getattr(self.instance, "estimated_quantity_kg", None),
        )
        available = attrs.get("available_quantity_kg")
        if available is None:
            available = (
                getattr(self.instance, "available_quantity_kg", None)
                if self.instance
                else estimated
            )
            attrs["available_quantity_kg"] = available
        if estimated is not None and available is not None and available > estimated:
            raise serializers.ValidationError(
                {"available_quantity_kg": "Available quantity cannot exceed estimated quantity."}
            )
        if self.instance:
            reserved = (
                CapacityReservation.objects.filter(
                    request__farmer_crop=self.instance,
                    status=CapacityReservation.Status.ACTIVE,
                ).aggregate(total=Sum("quantity_kg"))["total"]
                or Decimal("0.00")
            )
            if available is not None and available < reserved:
                raise serializers.ValidationError(
                    {
                        "available_quantity_kg": (
                            f"Available quantity cannot be lower than the {reserved} kg "
                            "already reserved for active arrival tokens."
                        )
                    }
                )
            is_active = attrs.get("is_active", self.instance.is_active)
            if not is_active and reserved > 0:
                raise serializers.ValidationError(
                    {
                        "is_active": (
                            "Cancel the crop's active procurement requests before archiving it."
                        )
                    }
                )
        farmer = self.instance.farmer if self.instance else self.context["request"].user
        crop = attrs.get("crop", getattr(self.instance, "crop", None))
        season = attrs.get("season", getattr(self.instance, "season", None))
        harvest_year = attrs.get("harvest_year", getattr(self.instance, "harvest_year", None))
        if crop and season and harvest_year:
            duplicates = FarmerCrop.objects.filter(
                farmer=farmer,
                crop=crop,
                season=season,
                harvest_year=harvest_year,
            )
            if self.instance:
                duplicates = duplicates.exclude(pk=self.instance.pk)
            if duplicates.exists():
                raise serializers.ValidationError(
                    {"detail": "This crop is already registered for the selected season and year."}
                )
        return attrs

    def create(self, validated_data):
        try:
            with transaction.atomic():
                return super().create(validated_data)
        except IntegrityError as exc:
            raise serializers.ValidationError(
                {"detail": "This crop is already registered for the selected season and year."}
            ) from exc


class OfficerAssignmentSerializer(serializers.ModelSerializer):
    officer_email = serializers.EmailField(source="officer.email", read_only=True)
    officer_name = serializers.CharField(source="officer.get_full_name", read_only=True)
    center_code = serializers.CharField(source="procurement_center.code", read_only=True)
    center_name = serializers.CharField(source="procurement_center.name", read_only=True)

    class Meta:
        model = OfficerAssignment
        fields = (
            "id",
            "officer",
            "officer_email",
            "officer_name",
            "procurement_center",
            "center_code",
            "center_name",
            "employee_id",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "officer_email",
            "officer_name",
            "center_code",
            "center_name",
            "created_at",
            "updated_at",
        )

    def validate_officer(self, value):
        if value.role != User.Role.PROCUREMENT_OFFICER:
            raise serializers.ValidationError("Select a PROCUREMENT_OFFICER account.")
        return value

    def validate_procurement_center(self, value):
        if not value.is_active:
            raise serializers.ValidationError("An officer cannot be assigned to an inactive centre.")
        return value

    def validate_employee_id(self, value):
        value = value.upper().strip()
        queryset = OfficerAssignment.objects.filter(employee_id=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("This employee ID is already assigned.")
        return value

    def validate(self, attrs):
        center = attrs.get(
            "procurement_center",
            getattr(self.instance, "procurement_center", None),
        )
        is_active = attrs.get("is_active", getattr(self.instance, "is_active", True))
        if is_active and center and not center.is_active:
            raise serializers.ValidationError(
                {"procurement_center": "An active assignment requires an active centre."}
            )
        return attrs


class RequestStatusEventSerializer(serializers.ModelSerializer):
    from_status_label = serializers.SerializerMethodField()
    to_status_label = serializers.CharField(source="get_to_status_display", read_only=True)
    actor_name = serializers.SerializerMethodField()
    actor_role = serializers.CharField(source="actor.role", read_only=True, allow_null=True)

    class Meta:
        model = RequestStatusEvent
        fields = (
            "id",
            "from_status",
            "from_status_label",
            "to_status",
            "to_status_label",
            "actor_name",
            "actor_role",
            "note",
            "created_at",
        )
        read_only_fields = fields

    def get_from_status_label(self, obj):
        if not obj.from_status:
            return "New request"
        return ProcurementRequest.Status(obj.from_status).label

    def get_actor_name(self, obj):
        if not obj.actor:
            return "System"
        return obj.actor.get_full_name() or obj.actor.email


class ProcurementAppointmentSerializer(serializers.ModelSerializer):
    request_number = serializers.CharField(source="request.request_number", read_only=True)
    farmer_name = serializers.SerializerMethodField()
    farmer_code = serializers.CharField(
        source="request.farmer.farmer_profile.farmer_code",
        read_only=True,
    )
    crop_name = serializers.CharField(source="request.farmer_crop.crop.name", read_only=True)
    crop_code = serializers.CharField(source="request.farmer_crop.crop.code", read_only=True)
    center_code = serializers.CharField(source="procurement_center.code", read_only=True)
    center_name = serializers.CharField(source="procurement_center.name", read_only=True)
    scheduled_quantity_kg = serializers.DecimalField(
        source="capacity_reservation.quantity_kg",
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    request_status = serializers.CharField(source="request.status", read_only=True)
    request_status_label = serializers.CharField(
        source="request.get_status_display", read_only=True
    )
    reservation_status = serializers.CharField(
        source="capacity_reservation.status", read_only=True
    )
    reservation_status_label = serializers.CharField(
        source="capacity_reservation.get_status_display", read_only=True
    )
    processing = serializers.SerializerMethodField()
    next_action = serializers.SerializerMethodField()

    class Meta:
        model = ProcurementAppointment
        fields = (
            "id",
            "request",
            "request_number",
            "farmer_name",
            "farmer_code",
            "crop_name",
            "crop_code",
            "procurement_center",
            "center_code",
            "center_name",
            "scheduled_date",
            "slot_start_time",
            "slot_end_time",
            "scheduled_quantity_kg",
            "queue_number",
            "token_code",
            "status",
            "status_label",
            "request_status",
            "request_status_label",
            "reservation_status",
            "reservation_status_label",
            "processing",
            "next_action",
            "cancelled_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_farmer_name(self, obj):
        farmer = obj.request.farmer
        return farmer.get_full_name() or farmer.email

    def _records(self, obj):
        check_in = getattr(obj, "check_in", None)
        inspection = getattr(check_in, "inspection", None) if check_in else None
        weighment = getattr(inspection, "weighment", None) if inspection else None
        decision = getattr(weighment, "acceptance_decision", None) if weighment else None
        transaction_record = getattr(decision, "procurement_transaction", None) if decision else None
        receipt = getattr(transaction_record, "receipt", None) if transaction_record else None
        return check_in, inspection, weighment, decision, transaction_record, receipt

    def get_processing(self, obj):
        check_in, inspection, weighment, decision, transaction_record, receipt = self._records(obj)
        return {
            "check_in": ArrivalCheckInSerializer(check_in).data if check_in else None,
            "inspection": QualityInspectionSerializer(inspection).data if inspection else None,
            "weighment": WeighmentSerializer(weighment).data if weighment else None,
            "decision": AcceptanceDecisionSerializer(decision).data if decision else None,
            "transaction": (
                ProcurementTransactionSerializer(transaction_record).data
                if transaction_record
                else None
            ),
            "receipt": ProcurementReceiptSerializer(receipt).data if receipt else None,
        }

    def get_next_action(self, obj):
        if obj.status in (
            ProcurementAppointment.Status.COMPLETED,
            ProcurementAppointment.Status.REJECTED,
            ProcurementAppointment.Status.CANCELLED,
        ):
            return "COMPLETE"
        check_in, inspection, weighment, decision, _, _ = self._records(obj)
        if not check_in:
            return "WAITING" if obj.scheduled_date > timezone.localdate() else "CHECK_IN"
        if not inspection:
            return "INSPECT"
        if inspection.result == inspection.Result.REJECTED:
            return "COMPLETE"
        if not weighment:
            return "WEIGH"
        if not decision:
            return "DECIDE"
        return "COMPLETE"


class ProcurementRequestSerializer(serializers.ModelSerializer):
    farmer_name = serializers.SerializerMethodField()
    farmer_code = serializers.CharField(
        source="farmer.farmer_profile.farmer_code",
        read_only=True,
    )
    crop_name = serializers.CharField(source="farmer_crop.crop.name", read_only=True)
    crop_code = serializers.CharField(source="farmer_crop.crop.code", read_only=True)
    crop_available_quantity_kg = serializers.DecimalField(
        source="farmer_crop.available_quantity_kg",
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )
    center_code = serializers.CharField(source="procurement_center.code", read_only=True)
    center_name = serializers.CharField(source="procurement_center.name", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    reviewed_by_name = serializers.SerializerMethodField()
    appointment = serializers.SerializerMethodField()
    status_events = RequestStatusEventSerializer(many=True, read_only=True)
    can_cancel = serializers.SerializerMethodField()
    can_review = serializers.SerializerMethodField()

    class Meta:
        model = ProcurementRequest
        fields = (
            "id",
            "request_number",
            "farmer",
            "farmer_name",
            "farmer_code",
            "farmer_crop",
            "crop_name",
            "crop_code",
            "crop_available_quantity_kg",
            "procurement_center",
            "center_code",
            "center_name",
            "intended_quantity_kg",
            "preferred_date",
            "farmer_notes",
            "status",
            "status_label",
            "submitted_at",
            "reviewed_by",
            "reviewed_by_name",
            "reviewed_at",
            "review_notes",
            "appointment",
            "status_events",
            "can_cancel",
            "can_review",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "request_number",
            "farmer",
            "status",
            "submitted_at",
            "reviewed_by",
            "reviewed_at",
            "review_notes",
            "created_at",
            "updated_at",
        )

    def get_farmer_name(self, obj):
        return obj.farmer.get_full_name() or obj.farmer.email

    def get_reviewed_by_name(self, obj):
        if not obj.reviewed_by:
            return None
        return obj.reviewed_by.get_full_name() or obj.reviewed_by.email

    def get_appointment(self, obj):
        appointments = list(obj.appointments.all())
        if not appointments:
            return None
        active = [
            appointment
            for appointment in appointments
            if appointment.status
            in (
                ProcurementAppointment.Status.SCHEDULED,
                ProcurementAppointment.Status.CHECKED_IN,
            )
        ]
        selected = max(active or appointments, key=lambda appointment: appointment.created_at)
        return ProcurementAppointmentSerializer(selected, context=self.context).data

    def get_can_cancel(self, obj):
        request = self.context.get("request")
        return bool(
            request
            and request.user.role == User.Role.FARMER
            and obj.farmer_id == request.user.id
            and obj.status
            in (
                ProcurementRequest.Status.SUBMITTED,
                ProcurementRequest.Status.UNDER_REVIEW,
                ProcurementRequest.Status.APPROVED,
                ProcurementRequest.Status.RESCHEDULED,
            )
        )

    def get_can_review(self, obj):
        request = self.context.get("request")
        return bool(
            request
            and request.user.role in (User.Role.PROCUREMENT_OFFICER, User.Role.ADMIN)
            and obj.status
            in (
                ProcurementRequest.Status.SUBMITTED,
                ProcurementRequest.Status.UNDER_REVIEW,
                ProcurementRequest.Status.APPROVED,
                ProcurementRequest.Status.RESCHEDULED,
            )
        )

    def validate_farmer_crop(self, value):
        request = self.context["request"]
        if value.farmer_id != request.user.id:
            raise serializers.ValidationError("Select one of your own crop records.")
        if not value.is_active or not value.crop.is_active:
            raise serializers.ValidationError("Select an active crop record.")
        return value

    def validate_procurement_center(self, value):
        if not value.is_active:
            raise serializers.ValidationError("Select an active procurement centre.")
        return value

    def validate_preferred_date(self, value):
        if value < timezone.localdate():
            raise serializers.ValidationError("Preferred date cannot be in the past.")
        return value

    def validate(self, attrs):
        request = self.context["request"]
        if request.user.role != User.Role.FARMER:
            raise serializers.ValidationError(
                {"detail": "Only farmers can submit procurement requests."}
            )
        profile, _ = FarmerProfile.objects.get_or_create(user=request.user)
        if not profile.is_complete:
            raise serializers.ValidationError(
                {"detail": "Complete your farmer profile before submitting a request."}
            )
        farmer_crop = attrs.get("farmer_crop")
        quantity = attrs.get("intended_quantity_kg")
        if farmer_crop and quantity and quantity > farmer_crop.available_quantity_kg:
            raise serializers.ValidationError(
                {
                    "intended_quantity_kg": (
                        "Intended quantity cannot exceed the crop's available quantity."
                    )
                }
            )
        return attrs

    def create(self, validated_data):
        with transaction.atomic():
            procurement_request = super().create(validated_data)
            RequestStatusEvent.objects.create(
                request=procurement_request,
                from_status="",
                to_status=ProcurementRequest.Status.SUBMITTED,
                actor=procurement_request.farmer,
                note="Procurement request submitted by farmer.",
            )
            return procurement_request


class ReviewActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(
        choices=("START_REVIEW", "APPROVE", "RESCHEDULE", "REJECT")
    )
    scheduled_date = serializers.DateField(required=False)
    slot_start_time = serializers.TimeField(required=False)
    slot_end_time = serializers.TimeField(required=False)
    quantity_kg = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0.01"),
        required=False,
    )
    review_notes = serializers.CharField(max_length=500, required=False, allow_blank=True)

    def validate(self, attrs):
        action = attrs["action"]
        if action in ("APPROVE", "RESCHEDULE"):
            missing = [
                field
                for field in (
                    "scheduled_date",
                    "slot_start_time",
                    "slot_end_time",
                    "quantity_kg",
                )
                if field not in attrs
            ]
            if missing:
                raise serializers.ValidationError(
                    {field: "This field is required for scheduling." for field in missing}
                )
        if action == "REJECT" and not attrs.get("review_notes", "").strip():
            raise serializers.ValidationError(
                {"review_notes": "Explain why the request is being rejected."}
            )
        return attrs


class CancelRequestSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=500, min_length=3)


class CapacityQuerySerializer(serializers.Serializer):
    date = serializers.DateField()

    def validate_date(self, value):
        if value < timezone.localdate():
            raise serializers.ValidationError("Capacity is available only for today or later.")
        return value
