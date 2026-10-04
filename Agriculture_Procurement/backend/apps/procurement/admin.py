from django.contrib import admin

from .models import (
    AcceptanceDecision,
    ArrivalCheckIn,
    CapacityReservation,
    CropCatalogue,
    FarmerCrop,
    OfficerAssignment,
    ProcurementAppointment,
    ProcurementCenter,
    ProcurementReceipt,
    ProcurementRequest,
    ProcurementTransaction,
    QualityInspection,
    RequestStatusEvent,
    Weighment,
    Grievance,
    GrievanceEvent,
    Notification,
    PaymentEvent,
    PaymentReceipt,
    PaymentRecord,
)


@admin.register(ProcurementCenter)
class ProcurementCenterAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "center_type", "district", "daily_capacity_kg", "is_active")
    list_filter = ("center_type", "is_active", "state", "district")
    search_fields = ("code", "name", "village_or_city", "district")
    readonly_fields = ("created_at", "updated_at")


@admin.register(CropCatalogue)
class CropCatalogueAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "name_hi", "category", "unit", "is_active")
    list_filter = ("category", "is_active")
    search_fields = ("code", "name", "name_hi")
    readonly_fields = ("created_at", "updated_at")


@admin.register(FarmerCrop)
class FarmerCropAdmin(admin.ModelAdmin):
    list_display = (
        "farmer",
        "crop",
        "season",
        "harvest_year",
        "estimated_quantity_kg",
        "available_quantity_kg",
        "is_active",
    )
    list_filter = ("season", "harvest_year", "is_active", "crop__category")
    search_fields = ("farmer__email", "farmer__first_name", "farmer__last_name", "crop__name")
    readonly_fields = ("created_at", "updated_at")


@admin.register(OfficerAssignment)
class OfficerAssignmentAdmin(admin.ModelAdmin):
    list_display = ("employee_id", "officer", "procurement_center", "is_active", "updated_at")
    list_filter = ("is_active", "procurement_center__district")
    search_fields = ("employee_id", "officer__email", "procurement_center__code", "procurement_center__name")
    readonly_fields = ("created_at", "updated_at")


@admin.register(ProcurementRequest)
class ProcurementRequestAdmin(admin.ModelAdmin):
    list_display = (
        "request_number",
        "farmer",
        "procurement_center",
        "intended_quantity_kg",
        "preferred_date",
        "status",
    )
    list_filter = ("status", "preferred_date", "procurement_center")
    search_fields = (
        "request_number",
        "farmer__email",
        "farmer__first_name",
        "farmer__last_name",
        "farmer_crop__crop__name",
    )
    readonly_fields = (
        "request_number",
        "farmer",
        "farmer_crop",
        "procurement_center",
        "intended_quantity_kg",
        "preferred_date",
        "farmer_notes",
        "status",
        "submitted_at",
        "reviewed_by",
        "reviewed_at",
        "review_notes",
        "created_at",
        "updated_at",
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(CapacityReservation)
class CapacityReservationAdmin(admin.ModelAdmin):
    list_display = (
        "request",
        "procurement_center",
        "reservation_date",
        "quantity_kg",
        "status",
    )
    list_filter = ("status", "reservation_date", "procurement_center")
    search_fields = ("request__request_number", "request__farmer__email")
    readonly_fields = (
        "request",
        "procurement_center",
        "reservation_date",
        "quantity_kg",
        "status",
        "released_at",
        "released_by",
        "consumed_at",
        "consumed_by",
        "created_at",
        "updated_at",
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ProcurementAppointment)
class ProcurementAppointmentAdmin(admin.ModelAdmin):
    list_display = (
        "token_code",
        "request",
        "procurement_center",
        "scheduled_date",
        "slot_start_time",
        "queue_number",
        "status",
    )
    list_filter = ("status", "scheduled_date", "procurement_center")
    search_fields = ("token_code", "request__request_number", "request__farmer__email")
    readonly_fields = (
        "request",
        "capacity_reservation",
        "procurement_center",
        "scheduled_date",
        "slot_start_time",
        "slot_end_time",
        "queue_number",
        "token_code",
        "status",
        "cancelled_at",
        "created_at",
        "updated_at",
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(RequestStatusEvent)
class RequestStatusEventAdmin(admin.ModelAdmin):
    list_display = ("request", "from_status", "to_status", "actor", "created_at")
    list_filter = ("to_status", "created_at")
    search_fields = ("request__request_number", "actor__email", "note")
    readonly_fields = (
        "request",
        "from_status",
        "to_status",
        "actor",
        "note",
        "created_at",
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class ImmutableProcurementRecordAdmin(admin.ModelAdmin):
    """Physical procurement records are append-only outside the atomic service layer."""

    def get_readonly_fields(self, request, obj=None):
        return tuple(field.name for field in self.model._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return bool(request.user and request.user.is_active and request.user.is_staff)

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ArrivalCheckIn)
class ArrivalCheckInAdmin(ImmutableProcurementRecordAdmin):
    list_display = ("appointment", "procurement_center", "transport_mode", "checked_in_at")
    list_filter = ("transport_mode", "procurement_center")
    search_fields = ("appointment__token_code", "request__request_number", "vehicle_number")


@admin.register(QualityInspection)
class QualityInspectionAdmin(ImmutableProcurementRecordAdmin):
    list_display = ("check_in", "result", "grade", "inspected_by", "inspected_at")
    list_filter = ("result", "grade", "inspected_at")
    search_fields = ("check_in__appointment__token_code", "sample_reference")


@admin.register(Weighment)
class WeighmentAdmin(ImmutableProcurementRecordAdmin):
    list_display = ("inspection", "gross_weight_kg", "tare_weight_kg", "net_weight_kg", "weighed_at")
    list_filter = ("weighed_at",)
    search_fields = ("inspection__check_in__appointment__token_code", "weighbridge_reference")


@admin.register(AcceptanceDecision)
class AcceptanceDecisionAdmin(ImmutableProcurementRecordAdmin):
    list_display = ("weighment", "outcome", "accepted_quantity_kg", "rejected_quantity_kg", "decided_at")
    list_filter = ("outcome", "decided_at")
    search_fields = ("weighment__inspection__check_in__appointment__token_code",)


@admin.register(ProcurementTransaction)
class ProcurementTransactionAdmin(ImmutableProcurementRecordAdmin):
    list_display = ("transaction_number", "farmer", "procurement_center", "accepted_quantity_kg", "total_amount", "procured_at")
    list_filter = ("procurement_center", "procured_at")
    search_fields = ("transaction_number", "request__request_number", "farmer__email")


@admin.register(ProcurementReceipt)
class ProcurementReceiptAdmin(ImmutableProcurementRecordAdmin):
    list_display = ("receipt_number", "transaction", "verification_code", "issued_at")
    search_fields = ("receipt_number", "transaction__transaction_number", "verification_code")


@admin.register(PaymentRecord)
class PaymentRecordAdmin(ImmutableProcurementRecordAdmin):
    list_display = ("payment_number", "transaction", "amount", "method", "status", "initiated_at")
    list_filter = ("status", "method", "initiated_at")
    search_fields = ("payment_number", "transaction__transaction_number", "bank_reference")


@admin.register(PaymentEvent)
class PaymentEventAdmin(ImmutableProcurementRecordAdmin):
    list_display = ("payment", "action", "from_status", "to_status", "actor", "created_at")
    list_filter = ("action", "to_status", "created_at")
    search_fields = ("payment__payment_number", "idempotency_key", "external_reference")


@admin.register(PaymentReceipt)
class PaymentReceiptAdmin(ImmutableProcurementRecordAdmin):
    list_display = ("receipt_number", "payment", "verification_code", "issued_at")
    search_fields = ("receipt_number", "payment__payment_number", "verification_code")


@admin.register(Grievance)
class GrievanceAdmin(ImmutableProcurementRecordAdmin):
    list_display = ("grievance_number", "farmer", "category", "priority", "status", "created_at")
    list_filter = ("category", "priority", "status", "created_at")
    search_fields = ("grievance_number", "farmer__email", "subject")


@admin.register(GrievanceEvent)
class GrievanceEventAdmin(ImmutableProcurementRecordAdmin):
    list_display = ("grievance", "action", "from_status", "to_status", "actor", "created_at")
    list_filter = ("action", "to_status", "created_at")
    search_fields = ("grievance__grievance_number", "actor__email", "note")


@admin.register(Notification)
class NotificationAdmin(ImmutableProcurementRecordAdmin):
    list_display = ("recipient", "category", "title", "created_at", "read_at")
    list_filter = ("category", "created_at", "read_at")
    search_fields = ("recipient__email", "title", "message")
