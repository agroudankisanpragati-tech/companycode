import datetime
import decimal
import django.core.validators
import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("accounts", "0002_farmerprofile"),
    ]

    operations = [
        migrations.CreateModel(
            name="CropCatalogue",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("code", models.CharField(max_length=20, unique=True)),
                ("name", models.CharField(max_length=100, unique=True)),
                ("name_hi", models.CharField(blank=True, max_length=100)),
                (
                    "category",
                    models.CharField(
                        choices=[
                            ("CEREAL", "Cereal"),
                            ("PULSE", "Pulse"),
                            ("OILSEED", "Oilseed"),
                            ("MILLET", "Millet"),
                            ("COMMERCIAL", "Commercial crop"),
                            ("OTHER", "Other"),
                        ],
                        max_length=16,
                    ),
                ),
                ("unit", models.CharField(default="kg", editable=False, max_length=8)),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={
                "ordering": ["category", "name"],
                "indexes": [
                    models.Index(fields=["category", "is_active"], name="crop_category_active_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="ProcurementCenter",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("code", models.CharField(max_length=20, unique=True)),
                ("name", models.CharField(max_length=160)),
                (
                    "center_type",
                    models.CharField(
                        choices=[
                            ("PACS", "Primary Agricultural Credit Society"),
                            ("MANDI", "Agricultural Market (Mandi)"),
                            ("WAREHOUSE", "Warehouse"),
                            ("OTHER", "Other"),
                        ],
                        max_length=16,
                    ),
                ),
                ("address_line", models.CharField(max_length=220)),
                ("village_or_city", models.CharField(max_length=120)),
                ("block", models.CharField(blank=True, max_length=120)),
                ("district", models.CharField(max_length=120)),
                ("state", models.CharField(default="Chhattisgarh", max_length=120)),
                (
                    "pincode",
                    models.CharField(
                        max_length=6,
                        validators=[django.core.validators.RegexValidator(r"^\d{6}$", "Enter a valid 6-digit PIN code.")],
                    ),
                ),
                (
                    "contact_phone",
                    models.CharField(
                        blank=True,
                        max_length=10,
                        validators=[django.core.validators.RegexValidator(r"^[6-9]\d{9}$", "Enter a valid 10-digit Indian mobile number.")],
                    ),
                ),
                (
                    "latitude",
                    models.DecimalField(
                        blank=True,
                        decimal_places=6,
                        max_digits=9,
                        null=True,
                        validators=[
                            django.core.validators.MinValueValidator(-90),
                            django.core.validators.MaxValueValidator(90),
                        ],
                    ),
                ),
                (
                    "longitude",
                    models.DecimalField(
                        blank=True,
                        decimal_places=6,
                        max_digits=10,
                        null=True,
                        validators=[
                            django.core.validators.MinValueValidator(-180),
                            django.core.validators.MaxValueValidator(180),
                        ],
                    ),
                ),
                (
                    "daily_capacity_kg",
                    models.DecimalField(
                        decimal_places=2,
                        max_digits=12,
                        validators=[django.core.validators.MinValueValidator(1)],
                    ),
                ),
                ("operating_start_time", models.TimeField(default=datetime.time(9, 0))),
                ("operating_end_time", models.TimeField(default=datetime.time(17, 0))),
                ("is_active", models.BooleanField(default=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        limit_choices_to={"role": "ADMIN"},
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="procurement_centers_created",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["district", "name"],
                "constraints": [
                    models.CheckConstraint(
                        condition=models.Q(daily_capacity_kg__gt=0),
                        name="centre_daily_capacity_gt_zero",
                    ),
                ],
                "indexes": [
                    models.Index(fields=["district", "is_active"], name="centre_district_active_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="FarmerCrop",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                (
                    "season",
                    models.CharField(
                        choices=[
                            ("KHARIF", "Kharif"),
                            ("RABI", "Rabi"),
                            ("ZAID", "Zaid"),
                            ("PERENNIAL", "Perennial"),
                        ],
                        max_length=12,
                    ),
                ),
                ("harvest_year", models.PositiveSmallIntegerField()),
                (
                    "cultivated_area_acres",
                    models.DecimalField(
                        decimal_places=2,
                        max_digits=9,
                        validators=[django.core.validators.MinValueValidator(decimal.Decimal("0.01"))],
                    ),
                ),
                (
                    "estimated_quantity_kg",
                    models.DecimalField(
                        decimal_places=2,
                        max_digits=12,
                        validators=[django.core.validators.MinValueValidator(decimal.Decimal("0.01"))],
                    ),
                ),
                (
                    "available_quantity_kg",
                    models.DecimalField(
                        decimal_places=2,
                        max_digits=12,
                        validators=[django.core.validators.MinValueValidator(0)],
                    ),
                ),
                ("harvest_date", models.DateField(blank=True, null=True)),
                ("notes", models.TextField(blank=True, max_length=500)),
                ("is_active", models.BooleanField(default=True)),
                (
                    "crop",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="farmer_crops",
                        to="procurement.cropcatalogue",
                    ),
                ),
                (
                    "farmer",
                    models.ForeignKey(
                        limit_choices_to={"role": "FARMER"},
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="farmer_crops",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-harvest_year", "season", "crop__name"],
                "indexes": [
                    models.Index(fields=["farmer", "is_active"], name="farmer_crop_owner_active_idx"),
                ],
                "constraints": [
                    models.UniqueConstraint(
                        fields=("farmer", "crop", "season", "harvest_year"),
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
                ],
            },
        ),
        migrations.CreateModel(
            name="OfficerAssignment",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("employee_id", models.CharField(max_length=40, unique=True)),
                ("is_active", models.BooleanField(default=True)),
                (
                    "assigned_by",
                    models.ForeignKey(
                        blank=True,
                        limit_choices_to={"role": "ADMIN"},
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="officer_assignments_created",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "officer",
                    models.OneToOneField(
                        limit_choices_to={"role": "PROCUREMENT_OFFICER"},
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="officer_profile",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "procurement_center",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="officer_assignments",
                        to="procurement.procurementcenter",
                    ),
                ),
            ],
            options={
                "ordering": ["procurement_center__name", "employee_id"],
            },
        ),
    ]
