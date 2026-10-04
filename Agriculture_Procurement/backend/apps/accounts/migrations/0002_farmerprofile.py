import django.core.validators
import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models

import apps.accounts.models


def create_profiles_for_existing_farmers(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    FarmerProfile = apps.get_model("accounts", "FarmerProfile")
    for user_id in User.objects.filter(role="FARMER").values_list("id", flat=True):
        FarmerProfile.objects.get_or_create(user_id=user_id)


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="FarmerProfile",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                (
                    "farmer_code",
                    models.CharField(
                        default=apps.accounts.models.generate_farmer_code,
                        editable=False,
                        max_length=14,
                        unique=True,
                    ),
                ),
                ("village", models.CharField(blank=True, max_length=120)),
                ("gram_panchayat", models.CharField(blank=True, max_length=120)),
                ("block", models.CharField(blank=True, max_length=120)),
                ("district", models.CharField(blank=True, max_length=120)),
                ("state", models.CharField(default="Chhattisgarh", max_length=120)),
                (
                    "pincode",
                    models.CharField(
                        blank=True,
                        max_length=6,
                        validators=[django.core.validators.RegexValidator(r"^\d{6}$", "Enter a valid 6-digit PIN code.")],
                    ),
                ),
                (
                    "land_area_acres",
                    models.DecimalField(
                        blank=True,
                        decimal_places=2,
                        max_digits=9,
                        null=True,
                        validators=[django.core.validators.MinValueValidator(0)],
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.OneToOneField(
                        limit_choices_to={"role": "FARMER"},
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="farmer_profile",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["user__first_name", "user__last_name", "farmer_code"],
            },
        ),
        migrations.RunPython(
            create_profiles_for_existing_farmers,
            migrations.RunPython.noop,
        ),
    ]
