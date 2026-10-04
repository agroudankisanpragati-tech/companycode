import datetime
import secrets
import uuid
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator, RegexValidator
from django.db import models
from django.utils import timezone

from apps.accounts.models import User


def generate_request_number() -> str:
    return f"DAPP-RQ-{uuid.uuid4().hex[:12].upper()}"


def generate_token_code() -> str:
    return f"DAPP-{secrets.token_hex(5).upper()}"


def generate_transaction_number() -> str:
    return f"DAPP-TX-{uuid.uuid4().hex[:12].upper()}"


def generate_receipt_number() -> str:
    return f"DAPP-RC-{uuid.uuid4().hex[:12].upper()}"


def generate_payment_number() -> str:
    return f"DAPP-PY-{uuid.uuid4().hex[:12].upper()}"


def generate_payment_receipt_number() -> str:
    return f"DAPP-PR-{uuid.uuid4().hex[:12].upper()}"


def generate_grievance_number() -> str:
    return f"DAPP-GR-{uuid.uuid4().hex[:12].upper()}"


def generate_verification_code() -> str:
    return secrets.token_hex(8).upper()


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class ProcurementCenter(TimeStampedModel):
    class CenterType(models.TextChoices):
        PACS = "PACS", "Primary Agricultural Credit Society"
        MANDI = "MANDI", "Agricultural Market (Mandi)"
        WAREHOUSE = "WAREHOUSE", "Warehouse"
        OTHER = "OTHER", "Other"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=160)
    center_type = models.CharField(max_length=16, choices=CenterType.choices)
    address_line = models.CharField(max_length=220)
    village_or_city = models.CharField(max_length=120)
    block = models.CharField(max_length=120, blank=True)
    district = models.CharField(max_length=120)
    state = models.CharField(max_length=120, default="Chhattisgarh")
    pincode = models.CharField(
        max_length=6,
        validators=[RegexValidator(r"^\d{6}$", "Enter a valid 6-digit PIN code.")],
    )
    contact_phone = models.CharField(
        max_length=10,
        blank=True,
        validators=[RegexValidator(r"^[6-9]\d{9}$", "Enter a valid 10-digit Indian mobile number.")],
    )
    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        validators=[MinValueValidator(-90), MaxValueValidator(90)],
    )
    longitude = models.DecimalField(
        max_digits=10,
        decimal_places=6,
        null=True,
        blank=True,
        validators=[MinValueValidator(-180), MaxValueValidator(180)],
    )
    daily_capacity_kg = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(1)],
    )
    operating_start_time = models.TimeField(default=datetime.time(9, 0))
    operating_end_time = models.TimeField(default=datetime.time(17, 0))
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="procurement_centers_created",
        limit_choices_to={"role": User.Role.ADMIN},
    )

    class Meta:
        ordering = ["district", "name"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(daily_capacity_kg__gt=0),
                name="centre_daily_capacity_gt_zero",
            ),
        ]
        indexes = [
            models.Index(fields=["district", "is_active"], name="centre_district_active_idx"),
        ]

    def clean(self):
        super().clean()
        if (
            self.operating_start_time
            and self.operating_end_time
            and self.operating_start_time >= self.operating_end_time
        ):
            raise ValidationError({"operating_end_time": "Closing time must be later than opening time."})
        if self.created_by_id and self.created_by.role != User.Role.ADMIN:
            raise ValidationError({"created_by": "Only an administrator can create a procurement centre."})

    def save(self, *args, **kwargs):
        self.code = self.code.upper().strip()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.code} — {self.name}"


class CropCatalogue(TimeStampedModel):
    class Category(models.TextChoices):
        CEREAL = "CEREAL", "Cereal"
        PULSE = "PULSE", "Pulse"
        OILSEED = "OILSEED", "Oilseed"
        MILLET = "MILLET", "Millet"
        COMMERCIAL = "COMMERCIAL", "Commercial crop"
        OTHER = "OTHER", "Other"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=100, unique=True)
    name_hi = models.CharField(max_length=100, blank=True)
    category = models.CharField(max_length=16, choices=Category.choices)
    unit = models.CharField(max_length=8, default="kg", editable=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["category", "name"]
        indexes = [
            models.Index(fields=["category", "is_active"], name="crop_category_active_idx"),
        ]

    def save(self, *args, **kwargs):
        self.code = self.code.upper().strip()
        self.name = self.name.strip()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name


class FarmerCrop(TimeStampedModel):
    class Season(models.TextChoices):
        KHARIF = "KHARIF", "Kharif"
        RABI = "RABI", "Rabi"
        ZAID = "ZAID", "Zaid"
        PERENNIAL = "PERENNIAL", "Perennial"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    farmer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="farmer_crops",
        limit_choices_to={"role": User.Role.FARMER},
    )
    crop = models.ForeignKey(CropCatalogue, on_delete=models.PROTECT, related_name="farmer_crops")
    season = models.CharField(max_length=12, choices=Season.choices)
    harvest_year = models.PositiveSmallIntegerField()
    cultivated_area_acres = models.DecimalField(
        max_digits=9,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    estimated_quantity_kg = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    available_quantity_kg = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(0)],
    )
    harvest_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True, max_length=500)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-harvest_year", "season", "crop__name"]
        constraints = [
            models.UniqueConstraint(
                fields=["farmer", "crop", "season", "harvest_year"],
                name="unique_farmer_crop_season_year",
            ),
            models.CheckConstraint(
                condition=models.Q(available_quantity_kg__lte=models.F("estimated_quantity_kg")),
                name="farmer_crop_available_lte_estimated",
            ),
            models.CheckConstraint(
                condition=models.Q(cultivated_area_acres__gt=0),
                name="farmer_crop_area_gt_zero",
            ),
            models.CheckConstraint(
                condition=models.Q(estimated_quantity_kg__gt=0),
                name="farmer_crop_estimated_gt_zero",
            ),
            models.CheckConstraint(
                condition=models.Q(available_quantity_kg__gte=0),
                name="farmer_crop_available_gte_zero",
            ),
        ]
        indexes = [
            models.Index(fields=["farmer", "is_active"], name="farmer_crop_owner_active_idx"),
        ]

    def clean(self):
        super().clean()
        if self.farmer_id and self.farmer.role != User.Role.FARMER:
            raise ValidationError({"farmer": "A crop record can belong only to a FARMER user."})
        if (
            self.available_quantity_kg is not None
            and self.estimated_quantity_kg is not None
            and self.available_quantity_kg > self.estimated_quantity_kg
        ):
            raise ValidationError(
                {"available_quantity_kg": "Available quantity cannot exceed estimated quantity."}
            )

    def __str__(self) -> str:
        return f"{self.farmer.email} — {self.crop.name} ({self.season} {self.harvest_year})"


class OfficerAssignment(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    officer = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="officer_profile",
        limit_choices_to={"role": User.Role.PROCUREMENT_OFFICER},
    )
    procurement_center = models.ForeignKey(
        ProcurementCenter,
        on_delete=models.PROTECT,
        related_name="officer_assignments",
    )
    employee_id = models.CharField(max_length=40, unique=True)
    is_active = models.BooleanField(default=True)
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="officer_assignments_created",
        limit_choices_to={"role": User.Role.ADMIN},
    )

    class Meta:
        ordering = ["procurement_center__name", "employee_id"]

    def clean(self):
        super().clean()
        if self.officer_id and self.officer.role != User.Role.PROCUREMENT_OFFICER:
            raise ValidationError({"officer": "Only a PROCUREMENT_OFFICER user can be assigned."})
        if self.assigned_by_id and self.assigned_by.role != User.Role.ADMIN:
            raise ValidationError({"assigned_by": "Only an administrator can assign officers."})

    def save(self, *args, **kwargs):
        self.employee_id = self.employee_id.upper().strip()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.employee_id} — {self.officer.email} @ {self.procurement_center.code}"


class ProcurementRequest(TimeStampedModel):
    class Status(models.TextChoices):
        SUBMITTED = "SUBMITTED", "Submitted"
        UNDER_REVIEW = "UNDER_REVIEW", "Under review"
        APPROVED = "APPROVED", "Approved"
        RESCHEDULED = "RESCHEDULED", "Rescheduled"
        REJECTED = "REJECTED", "Rejected"
        CANCELLED = "CANCELLED", "Cancelled"
        EXPIRED = "EXPIRED", "Expired"
        CHECKED_IN = "CHECKED_IN", "Checked in"
        INSPECTION_PASSED = "INSPECTION_PASSED", "Inspection passed"
        INSPECTION_REJECTED = "INSPECTION_REJECTED", "Inspection rejected"
        WEIGHED = "WEIGHED", "Weighed"
        PROCURED = "PROCURED", "Procured"
        PROCUREMENT_REJECTED = "PROCUREMENT_REJECTED", "Procurement rejected"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request_number = models.CharField(
        max_length=20,
        unique=True,
        default=generate_request_number,
        editable=False,
    )
    farmer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="procurement_requests",
        limit_choices_to={"role": User.Role.FARMER},
    )
    farmer_crop = models.ForeignKey(
        FarmerCrop,
        on_delete=models.PROTECT,
        related_name="procurement_requests",
    )
    procurement_center = models.ForeignKey(
        ProcurementCenter,
        on_delete=models.PROTECT,
        related_name="procurement_requests",
    )
    intended_quantity_kg = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    preferred_date = models.DateField()
    farmer_notes = models.TextField(blank=True, max_length=500)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SUBMITTED,
    )
    submitted_at = models.DateTimeField(default=timezone.now)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="procurement_requests_reviewed",
        limit_choices_to={
            "role__in": [User.Role.PROCUREMENT_OFFICER, User.Role.ADMIN],
        },
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(blank=True, max_length=500)

    class Meta:
        ordering = ["-submitted_at", "request_number"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(intended_quantity_kg__gt=0),
                name="request_quantity_gt_zero",
            ),
        ]
        indexes = [
            models.Index(fields=["farmer", "status"], name="request_farmer_status_idx"),
            models.Index(
                fields=["procurement_center", "status", "preferred_date"],
                name="request_center_status_date_idx",
            ),
        ]

    def clean(self):
        super().clean()
        if self.farmer_id and self.farmer.role != User.Role.FARMER:
            raise ValidationError({"farmer": "A procurement request must belong to a farmer."})
        if self.farmer_crop_id and self.farmer_id and self.farmer_crop.farmer_id != self.farmer_id:
            raise ValidationError({"farmer_crop": "The crop record must belong to the same farmer."})
        if self.reviewed_by_id and self.reviewed_by.role not in (
            User.Role.PROCUREMENT_OFFICER,
            User.Role.ADMIN,
        ):
            raise ValidationError({"reviewed_by": "Only an officer or administrator can review."})

    def __str__(self) -> str:
        return f"{self.request_number} — {self.farmer.email}"


class CapacityReservation(TimeStampedModel):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        RELEASED = "RELEASED", "Released"
        CONSUMED = "CONSUMED", "Consumed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request = models.ForeignKey(
        ProcurementRequest,
        on_delete=models.PROTECT,
        related_name="capacity_reservations",
    )
    procurement_center = models.ForeignKey(
        ProcurementCenter,
        on_delete=models.PROTECT,
        related_name="capacity_reservations",
    )
    reservation_date = models.DateField()
    quantity_kg = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.ACTIVE)
    released_at = models.DateTimeField(null=True, blank=True)
    released_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="capacity_reservations_released",
    )
    consumed_at = models.DateTimeField(null=True, blank=True)
    consumed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="capacity_reservations_consumed",
    )

    class Meta:
        ordering = ["-reservation_date", "created_at"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantity_kg__gt=0),
                name="reservation_quantity_gt_zero",
            ),
            models.UniqueConstraint(
                fields=["request"],
                condition=models.Q(status="ACTIVE"),
                name="one_active_reservation_request",
            ),
        ]
        indexes = [
            models.Index(
                fields=["procurement_center", "reservation_date", "status"],
                name="reservation_center_date_idx",
            ),
        ]

    def clean(self):
        super().clean()
        if (
            self.request_id
            and self.procurement_center_id
            and self.request.procurement_center_id != self.procurement_center_id
        ):
            raise ValidationError({"procurement_center": "Reservation centre must match the request."})

    def __str__(self) -> str:
        return f"{self.request.request_number} — {self.reservation_date} — {self.quantity_kg} kg"


class ProcurementAppointment(TimeStampedModel):
    class Status(models.TextChoices):
        SCHEDULED = "SCHEDULED", "Scheduled"
        CHECKED_IN = "CHECKED_IN", "Checked in"
        COMPLETED = "COMPLETED", "Completed"
        REJECTED = "REJECTED", "Rejected"
        CANCELLED = "CANCELLED", "Cancelled"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request = models.ForeignKey(
        ProcurementRequest,
        on_delete=models.PROTECT,
        related_name="appointments",
    )
    capacity_reservation = models.OneToOneField(
        CapacityReservation,
        on_delete=models.PROTECT,
        related_name="appointment",
    )
    procurement_center = models.ForeignKey(
        ProcurementCenter,
        on_delete=models.PROTECT,
        related_name="procurement_appointments",
    )
    scheduled_date = models.DateField()
    slot_start_time = models.TimeField()
    slot_end_time = models.TimeField()
    queue_number = models.PositiveIntegerField()
    token_code = models.CharField(
        max_length=15,
        unique=True,
        default=generate_token_code,
        editable=False,
    )
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.SCHEDULED)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["scheduled_date", "slot_start_time", "queue_number"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(slot_start_time__lt=models.F("slot_end_time")),
                name="appointment_start_before_end",
            ),
            models.UniqueConstraint(
                fields=["request"],
                condition=models.Q(status__in=["SCHEDULED", "CHECKED_IN"]),
                name="one_open_appt_request",
            ),
            models.UniqueConstraint(
                fields=["procurement_center", "scheduled_date", "queue_number"],
                name="unique_center_date_queue",
            ),
        ]
        indexes = [
            models.Index(
                fields=["procurement_center", "scheduled_date", "status"],
                name="appointment_center_date_idx",
            ),
        ]

    def clean(self):
        super().clean()
        if self.slot_start_time and self.slot_end_time and self.slot_start_time >= self.slot_end_time:
            raise ValidationError({"slot_end_time": "Slot end time must be later than start time."})
        if self.procurement_center_id:
            center = self.procurement_center
            if self.slot_start_time and self.slot_start_time < center.operating_start_time:
                raise ValidationError({"slot_start_time": "Slot starts before the centre opens."})
            if self.slot_end_time and self.slot_end_time > center.operating_end_time:
                raise ValidationError({"slot_end_time": "Slot ends after the centre closes."})
        if self.request_id and self.procurement_center_id:
            if self.request.procurement_center_id != self.procurement_center_id:
                raise ValidationError({"procurement_center": "Appointment centre must match the request."})
        if self.capacity_reservation_id and self.request_id:
            if self.capacity_reservation.request_id != self.request_id:
                raise ValidationError({"capacity_reservation": "Reservation must belong to the request."})

    def __str__(self) -> str:
        return f"{self.token_code} — {self.scheduled_date} #{self.queue_number}"


class RequestStatusEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request = models.ForeignKey(
        ProcurementRequest,
        on_delete=models.CASCADE,
        related_name="status_events",
    )
    from_status = models.CharField(
        max_length=20,
        choices=ProcurementRequest.Status.choices,
        blank=True,
    )
    to_status = models.CharField(max_length=20, choices=ProcurementRequest.Status.choices)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="procurement_request_events",
    )
    note = models.TextField(blank=True, max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]
        indexes = [
            models.Index(fields=["request", "created_at"], name="request_event_time_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.request.request_number}: {self.from_status or 'NEW'} → {self.to_status}"


class ArrivalCheckIn(models.Model):
    class TransportMode(models.TextChoices):
        TRACTOR = "TRACTOR", "Tractor"
        TRUCK = "TRUCK", "Truck"
        PICKUP = "PICKUP", "Pickup vehicle"
        OTHER = "OTHER", "Other"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    appointment = models.OneToOneField(
        ProcurementAppointment,
        on_delete=models.PROTECT,
        related_name="check_in",
    )
    request = models.OneToOneField(
        ProcurementRequest,
        on_delete=models.PROTECT,
        related_name="check_in",
    )
    procurement_center = models.ForeignKey(
        ProcurementCenter,
        on_delete=models.PROTECT,
        related_name="arrival_check_ins",
    )
    transport_mode = models.CharField(
        max_length=12,
        choices=TransportMode.choices,
        default=TransportMode.TRACTOR,
    )
    vehicle_number = models.CharField(max_length=20, blank=True)
    arrival_notes = models.TextField(blank=True, max_length=500)
    checked_in_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="arrival_check_ins_recorded",
        limit_choices_to={
            "role__in": [User.Role.PROCUREMENT_OFFICER, User.Role.ADMIN],
        },
    )
    checked_in_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-checked_in_at"]
        indexes = [
            models.Index(
                fields=["procurement_center", "checked_in_at"],
                name="checkin_center_time_idx",
            ),
        ]

    def clean(self):
        super().clean()
        if self.appointment_id and self.request_id:
            if self.appointment.request_id != self.request_id:
                raise ValidationError({"appointment": "Appointment must belong to the request."})
        if self.appointment_id and self.procurement_center_id:
            if self.appointment.procurement_center_id != self.procurement_center_id:
                raise ValidationError(
                    {"procurement_center": "Check-in centre must match the appointment."}
                )

    def save(self, *args, **kwargs):
        self.vehicle_number = self.vehicle_number.upper().strip()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.appointment.token_code} checked in at {self.checked_in_at}"


class QualityInspection(models.Model):
    class Result(models.TextChoices):
        PASSED = "PASSED", "Passed"
        REJECTED = "REJECTED", "Rejected"

    class Grade(models.TextChoices):
        FAQ = "FAQ", "Fair Average Quality"
        GRADE_A = "GRADE_A", "Grade A"
        GRADE_B = "GRADE_B", "Grade B"
        OTHER = "OTHER", "Other"
        NOT_APPLICABLE = "NA", "Not applicable"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    check_in = models.OneToOneField(
        ArrivalCheckIn,
        on_delete=models.PROTECT,
        related_name="inspection",
    )
    result = models.CharField(max_length=8, choices=Result.choices)
    grade = models.CharField(max_length=8, choices=Grade.choices, default=Grade.FAQ)
    moisture_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    foreign_matter_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    damaged_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    sample_reference = models.CharField(max_length=60, blank=True)
    inspection_notes = models.TextField(blank=True, max_length=500)
    rejection_reason = models.TextField(blank=True, max_length=500)
    inspected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="quality_inspections_recorded",
        limit_choices_to={
            "role__in": [User.Role.PROCUREMENT_OFFICER, User.Role.ADMIN],
        },
    )
    inspected_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-inspected_at"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(moisture_percentage__isnull=True)
                    | models.Q(moisture_percentage__gte=0, moisture_percentage__lte=100)
                ),
                name="inspection_moisture_range",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(foreign_matter_percentage__isnull=True)
                    | models.Q(
                        foreign_matter_percentage__gte=0,
                        foreign_matter_percentage__lte=100,
                    )
                ),
                name="inspection_foreign_range",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(damaged_percentage__isnull=True)
                    | models.Q(damaged_percentage__gte=0, damaged_percentage__lte=100)
                ),
                name="inspection_damaged_range",
            ),
        ]

    def clean(self):
        super().clean()
        if self.result == self.Result.REJECTED and not self.rejection_reason.strip():
            raise ValidationError({"rejection_reason": "A rejected inspection needs a reason."})

    def __str__(self) -> str:
        return f"{self.check_in.appointment.token_code} — {self.get_result_display()}"


class Weighment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    inspection = models.OneToOneField(
        QualityInspection,
        on_delete=models.PROTECT,
        related_name="weighment",
    )
    gross_weight_kg = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    tare_weight_kg = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(0)],
    )
    net_weight_kg = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    bag_count = models.PositiveIntegerField(null=True, blank=True)
    weighbridge_reference = models.CharField(max_length=60, blank=True)
    weighment_notes = models.TextField(blank=True, max_length=500)
    weighed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="weighments_recorded",
        limit_choices_to={
            "role__in": [User.Role.PROCUREMENT_OFFICER, User.Role.ADMIN],
        },
    )
    weighed_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-weighed_at"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(gross_weight_kg__gt=models.F("tare_weight_kg")),
                name="weighment_gross_gt_tare",
            ),
            models.CheckConstraint(
                condition=models.Q(net_weight_kg__gt=0),
                name="weighment_net_gt_zero",
            ),
        ]

    def clean(self):
        super().clean()
        if self.gross_weight_kg is not None and self.tare_weight_kg is not None:
            expected_net = self.gross_weight_kg - self.tare_weight_kg
            if expected_net <= 0:
                raise ValidationError({"gross_weight_kg": "Gross weight must exceed tare weight."})
            if self.net_weight_kg is not None and self.net_weight_kg != expected_net:
                raise ValidationError({"net_weight_kg": "Net weight must equal gross minus tare."})

    def __str__(self) -> str:
        return f"{self.inspection.check_in.appointment.token_code} — {self.net_weight_kg} kg"


class AcceptanceDecision(models.Model):
    class Outcome(models.TextChoices):
        ACCEPTED = "ACCEPTED", "Accepted"
        PARTIALLY_ACCEPTED = "PARTIAL", "Partially accepted"
        REJECTED = "REJECTED", "Rejected"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    weighment = models.OneToOneField(
        Weighment,
        on_delete=models.PROTECT,
        related_name="acceptance_decision",
    )
    outcome = models.CharField(max_length=8, choices=Outcome.choices)
    accepted_quantity_kg = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(0)],
    )
    rejected_quantity_kg = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(0)],
    )
    decision_reason = models.TextField(blank=True, max_length=500)
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="acceptance_decisions_recorded",
        limit_choices_to={
            "role__in": [User.Role.PROCUREMENT_OFFICER, User.Role.ADMIN],
        },
    )
    decided_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-decided_at"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(accepted_quantity_kg__gte=0),
                name="decision_accepted_gte_zero",
            ),
            models.CheckConstraint(
                condition=models.Q(rejected_quantity_kg__gte=0),
                name="decision_rejected_gte_zero",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(outcome="REJECTED", accepted_quantity_kg=0)
                    | models.Q(
                        outcome__in=["ACCEPTED", "PARTIAL"],
                        accepted_quantity_kg__gt=0,
                    )
                ),
                name="decision_outcome_quantity",
            ),
        ]

    def clean(self):
        super().clean()
        if self.weighment_id:
            total = self.accepted_quantity_kg + self.rejected_quantity_kg
            if total != self.weighment.net_weight_kg:
                raise ValidationError(
                    {"accepted_quantity_kg": "Accepted plus rejected quantity must equal net weight."}
                )
        if self.outcome != self.Outcome.ACCEPTED and not self.decision_reason.strip():
            raise ValidationError({"decision_reason": "Record a reason for non-full acceptance."})

    def __str__(self) -> str:
        return f"{self.weighment} — {self.get_outcome_display()}"


class ProcurementTransaction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    transaction_number = models.CharField(
        max_length=20,
        unique=True,
        default=generate_transaction_number,
        editable=False,
    )
    request = models.OneToOneField(
        ProcurementRequest,
        on_delete=models.PROTECT,
        related_name="procurement_transaction",
    )
    appointment = models.OneToOneField(
        ProcurementAppointment,
        on_delete=models.PROTECT,
        related_name="procurement_transaction",
    )
    acceptance_decision = models.OneToOneField(
        AcceptanceDecision,
        on_delete=models.PROTECT,
        related_name="procurement_transaction",
    )
    farmer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="procurement_transactions",
        limit_choices_to={"role": User.Role.FARMER},
    )
    farmer_crop = models.ForeignKey(
        FarmerCrop,
        on_delete=models.PROTECT,
        related_name="procurement_transactions",
    )
    procurement_center = models.ForeignKey(
        ProcurementCenter,
        on_delete=models.PROTECT,
        related_name="procurement_transactions",
    )
    accepted_quantity_kg = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    rate_per_kg = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    total_amount = models.DecimalField(
        max_digits=16,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    acceptance_notes = models.TextField(blank=True, max_length=500)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="procurement_transactions_recorded",
        limit_choices_to={
            "role__in": [User.Role.PROCUREMENT_OFFICER, User.Role.ADMIN],
        },
    )
    procured_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-procured_at", "transaction_number"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(accepted_quantity_kg__gt=0),
                name="transaction_accepted_gt_zero",
            ),
            models.CheckConstraint(
                condition=models.Q(rate_per_kg__gt=0),
                name="transaction_rate_gt_zero",
            ),
            models.CheckConstraint(
                condition=models.Q(total_amount__gt=0),
                name="transaction_total_gt_zero",
            ),
        ]
        indexes = [
            models.Index(fields=["farmer", "procured_at"], name="transaction_farmer_time_idx"),
            models.Index(
                fields=["procurement_center", "procured_at"],
                name="transaction_center_time_idx",
            ),
        ]

    def clean(self):
        super().clean()
        if self.acceptance_decision_id:
            if self.accepted_quantity_kg != self.acceptance_decision.accepted_quantity_kg:
                raise ValidationError(
                    {"accepted_quantity_kg": "Quantity must match the acceptance decision."}
                )
        if self.rate_per_kg is not None and self.accepted_quantity_kg is not None:
            expected_total = (self.rate_per_kg * self.accepted_quantity_kg).quantize(
                Decimal("0.01")
            )
            if self.total_amount is not None and self.total_amount != expected_total:
                raise ValidationError({"total_amount": "Total must equal quantity multiplied by rate."})

    def __str__(self) -> str:
        return f"{self.transaction_number} — {self.accepted_quantity_kg} kg"


class ProcurementReceipt(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    receipt_number = models.CharField(
        max_length=20,
        unique=True,
        default=generate_receipt_number,
        editable=False,
    )
    transaction = models.OneToOneField(
        ProcurementTransaction,
        on_delete=models.PROTECT,
        related_name="receipt",
    )
    verification_code = models.CharField(
        max_length=16,
        unique=True,
        default=generate_verification_code,
        editable=False,
    )
    issued_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-issued_at"]

    def __str__(self) -> str:
        return self.receipt_number


class PaymentRecord(TimeStampedModel):
    class Status(models.TextChoices):
        INITIATED = "INITIATED", "Initiated"
        PROCESSING = "PROCESSING", "Processing"
        SETTLED = "SETTLED", "Settled"
        FAILED = "FAILED", "Failed"

    class Method(models.TextChoices):
        DBT = "DBT", "Direct Benefit Transfer"
        NEFT = "NEFT", "NEFT"
        RTGS = "RTGS", "RTGS"
        OTHER = "OTHER", "Other"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payment_number = models.CharField(
        max_length=20,
        unique=True,
        default=generate_payment_number,
        editable=False,
    )
    transaction = models.OneToOneField(
        ProcurementTransaction,
        on_delete=models.PROTECT,
        related_name="payment",
    )
    amount = models.DecimalField(
        max_digits=16,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    method = models.CharField(max_length=8, choices=Method.choices, default=Method.DBT)
    beneficiary_reference = models.CharField(
        max_length=120,
        default="Verified farmer account",
    )
    status = models.CharField(
        max_length=12,
        choices=Status.choices,
        default=Status.INITIATED,
    )
    attempt_count = models.PositiveIntegerField(default=1)
    initiated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="payments_initiated",
        limit_choices_to={
            "role__in": [User.Role.PROCUREMENT_OFFICER, User.Role.ADMIN],
        },
    )
    initiated_at = models.DateTimeField(default=timezone.now)
    processing_at = models.DateTimeField(null=True, blank=True)
    settled_at = models.DateTimeField(null=True, blank=True)
    last_failed_at = models.DateTimeField(null=True, blank=True)
    bank_reference = models.CharField(max_length=80, blank=True)
    last_failure_reason = models.TextField(blank=True, max_length=500)

    class Meta:
        ordering = ["-initiated_at", "payment_number"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gt=0),
                name="payment_amount_gt_zero",
            ),
            models.CheckConstraint(
                condition=models.Q(attempt_count__gte=1),
                name="payment_attempt_gte_one",
            ),
            models.UniqueConstraint(
                fields=["bank_reference"],
                condition=~models.Q(bank_reference=""),
                name="unique_nonblank_bank_reference",
            ),
        ]
        indexes = [
            models.Index(fields=["status", "initiated_at"], name="payment_status_time_idx"),
        ]

    def clean(self):
        super().clean()
        if self.transaction_id and self.amount != self.transaction.total_amount:
            raise ValidationError({"amount": "Payment amount must match the procurement total."})
        if self.status == self.Status.SETTLED:
            if not self.bank_reference.strip():
                raise ValidationError({"bank_reference": "A settled payment needs a bank reference."})
            if self.settled_at is None:
                raise ValidationError({"settled_at": "A settled payment needs a settlement time."})

    def __str__(self) -> str:
        return f"{self.payment_number} - {self.get_status_display()}"


class PaymentEvent(models.Model):
    class Action(models.TextChoices):
        INITIATE = "INITIATE", "Initiate"
        START_PROCESSING = "START_PROCESSING", "Start processing"
        SETTLE = "SETTLE", "Settle"
        FAIL = "FAIL", "Fail"
        RETRY = "RETRY", "Retry"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payment = models.ForeignKey(PaymentRecord, on_delete=models.PROTECT, related_name="events")
    action = models.CharField(max_length=20, choices=Action.choices)
    from_status = models.CharField(max_length=12, choices=PaymentRecord.Status.choices, blank=True)
    to_status = models.CharField(max_length=12, choices=PaymentRecord.Status.choices)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="payment_events_recorded",
    )
    note = models.TextField(blank=True, max_length=500)
    external_reference = models.CharField(max_length=80, blank=True)
    idempotency_key = models.CharField(max_length=64, unique=True)
    payload_fingerprint = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]
        indexes = [models.Index(fields=["payment", "created_at"], name="payment_event_time_idx")]

    def __str__(self) -> str:
        return f"{self.payment.payment_number}: {self.action}"


class PaymentReceipt(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    receipt_number = models.CharField(
        max_length=20,
        unique=True,
        default=generate_payment_receipt_number,
        editable=False,
    )
    payment = models.OneToOneField(
        PaymentRecord,
        on_delete=models.PROTECT,
        related_name="settlement_receipt",
    )
    verification_code = models.CharField(
        max_length=16,
        unique=True,
        default=generate_verification_code,
        editable=False,
    )
    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="payment_receipts_issued",
        limit_choices_to={"role": User.Role.ADMIN},
    )
    issued_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-issued_at"]

    def clean(self):
        super().clean()
        if self.payment_id and self.payment.status != PaymentRecord.Status.SETTLED:
            raise ValidationError({"payment": "Settlement proof can be issued only after settlement."})

    def __str__(self) -> str:
        return self.receipt_number


class Grievance(TimeStampedModel):
    class Category(models.TextChoices):
        SCHEDULING = "SCHEDULING", "Scheduling"
        QUALITY = "QUALITY", "Quality inspection"
        PROCUREMENT = "PROCUREMENT", "Procurement"
        PAYMENT = "PAYMENT", "Payment"
        OTHER = "OTHER", "Other"

    class Priority(models.TextChoices):
        LOW = "LOW", "Low"
        NORMAL = "NORMAL", "Normal"
        HIGH = "HIGH", "High"

    class Status(models.TextChoices):
        OPEN = "OPEN", "Open"
        UNDER_REVIEW = "UNDER_REVIEW", "Under review"
        RESOLVED = "RESOLVED", "Resolved"
        REJECTED = "REJECTED", "Rejected"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    grievance_number = models.CharField(
        max_length=20,
        unique=True,
        default=generate_grievance_number,
        editable=False,
    )
    farmer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="grievances",
        limit_choices_to={"role": User.Role.FARMER},
    )
    category = models.CharField(max_length=16, choices=Category.choices)
    subject = models.CharField(max_length=160)
    description = models.TextField(max_length=2000)
    priority = models.CharField(max_length=8, choices=Priority.choices, default=Priority.NORMAL)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)
    request = models.ForeignKey(
        ProcurementRequest,
        on_delete=models.PROTECT,
        related_name="grievances",
        null=True,
        blank=True,
    )
    transaction = models.ForeignKey(
        ProcurementTransaction,
        on_delete=models.PROTECT,
        related_name="grievances",
        null=True,
        blank=True,
    )
    payment = models.ForeignKey(
        PaymentRecord,
        on_delete=models.PROTECT,
        related_name="grievances",
        null=True,
        blank=True,
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="grievances_assigned",
        null=True,
        blank=True,
        limit_choices_to={
            "role__in": [User.Role.PROCUREMENT_OFFICER, User.Role.ADMIN],
        },
    )
    resolution = models.TextField(blank=True, max_length=2000)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "grievance_number"]
        indexes = [
            models.Index(fields=["farmer", "status"], name="grievance_farmer_status_idx"),
            models.Index(fields=["status", "priority", "created_at"], name="grievance_queue_idx"),
        ]

    def clean(self):
        super().clean()
        if self.farmer_id and self.farmer.role != User.Role.FARMER:
            raise ValidationError({"farmer": "A grievance must belong to a farmer."})
        if self.request_id and self.request.farmer_id != self.farmer_id:
            raise ValidationError({"request": "The request must belong to the same farmer."})
        if self.transaction_id and self.transaction.farmer_id != self.farmer_id:
            raise ValidationError({"transaction": "The transaction must belong to the same farmer."})
        if self.payment_id and self.payment.transaction.farmer_id != self.farmer_id:
            raise ValidationError({"payment": "The payment must belong to the same farmer."})
        if self.payment_id and self.transaction_id and self.payment.transaction_id != self.transaction_id:
            raise ValidationError({"payment": "The payment must match the selected transaction."})
        if self.transaction_id and self.request_id and self.transaction.request_id != self.request_id:
            raise ValidationError({"transaction": "The transaction must match the selected request."})
        if self.status in (self.Status.RESOLVED, self.Status.REJECTED) and not self.resolution.strip():
            raise ValidationError({"resolution": "A terminal grievance needs a resolution."})

    def __str__(self) -> str:
        return f"{self.grievance_number} - {self.subject}"


class GrievanceEvent(models.Model):
    class Action(models.TextChoices):
        CREATED = "CREATED", "Created"
        START_REVIEW = "START_REVIEW", "Start review"
        RESOLVE = "RESOLVE", "Resolve"
        REJECT = "REJECT", "Reject"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    grievance = models.ForeignKey(Grievance, on_delete=models.PROTECT, related_name="events")
    action = models.CharField(max_length=16, choices=Action.choices)
    from_status = models.CharField(max_length=16, choices=Grievance.Status.choices, blank=True)
    to_status = models.CharField(max_length=16, choices=Grievance.Status.choices)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="grievance_events_recorded",
    )
    note = models.TextField(blank=True, max_length=2000)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]
        indexes = [models.Index(fields=["grievance", "created_at"], name="grievance_event_time_idx")]

    def __str__(self) -> str:
        return f"{self.grievance.grievance_number}: {self.action}"


class Notification(models.Model):
    class Category(models.TextChoices):
        APPOINTMENT = "APPOINTMENT", "Appointment"
        QUALITY = "QUALITY", "Quality"
        PROCUREMENT = "PROCUREMENT", "Procurement"
        PAYMENT = "PAYMENT", "Payment"
        GRIEVANCE = "GRIEVANCE", "Grievance"
        SYSTEM = "SYSTEM", "System"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    category = models.CharField(max_length=16, choices=Category.choices)
    title = models.CharField(max_length=160)
    message = models.TextField(max_length=1000)
    request = models.ForeignKey(
        ProcurementRequest,
        on_delete=models.SET_NULL,
        related_name="notifications",
        null=True,
        blank=True,
    )
    transaction = models.ForeignKey(
        ProcurementTransaction,
        on_delete=models.SET_NULL,
        related_name="notifications",
        null=True,
        blank=True,
    )
    payment = models.ForeignKey(
        PaymentRecord,
        on_delete=models.SET_NULL,
        related_name="notifications",
        null=True,
        blank=True,
    )
    grievance = models.ForeignKey(
        Grievance,
        on_delete=models.SET_NULL,
        related_name="notifications",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "id"]
        indexes = [
            models.Index(fields=["recipient", "read_at", "created_at"], name="notification_inbox_idx"),
        ]

    @property
    def is_read(self) -> bool:
        return self.read_at is not None

    def __str__(self) -> str:
        return f"{self.recipient.email}: {self.title}"
