import uuid

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator, RegexValidator
from django.db import models

from .managers import UserManager


class User(AbstractUser):
    class Role(models.TextChoices):
        FARMER = "FARMER", "Farmer"
        PROCUREMENT_OFFICER = "PROCUREMENT_OFFICER", "Procurement Officer"
        ADMIN = "ADMIN", "Administrator"

    class Language(models.TextChoices):
        ENGLISH = "en", "English"
        HINDI = "hi", "Hindi"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = None
    email = models.EmailField(unique=True)
    phone_number = models.CharField(max_length=10, unique=True, null=True, blank=True)
    role = models.CharField(max_length=24, choices=Role.choices, default=Role.FARMER)
    preferred_language = models.CharField(
        max_length=2,
        choices=Language.choices,
        default=Language.ENGLISH,
    )
    is_verified = models.BooleanField(default=False)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    objects = UserManager()

    class Meta:
        ordering = ["email"]

    def save(self, *args, **kwargs):
        self.email = self.email.lower().strip()
        if self.is_superuser:
            self.role = self.Role.ADMIN
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.email


def generate_farmer_code() -> str:
    return f"FMR-{uuid.uuid4().hex[:10].upper()}"


class FarmerProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="farmer_profile",
        limit_choices_to={"role": User.Role.FARMER},
    )
    farmer_code = models.CharField(max_length=14, unique=True, default=generate_farmer_code, editable=False)
    village = models.CharField(max_length=120, blank=True)
    gram_panchayat = models.CharField(max_length=120, blank=True)
    block = models.CharField(max_length=120, blank=True)
    district = models.CharField(max_length=120, blank=True)
    state = models.CharField(max_length=120, default="Chhattisgarh")
    pincode = models.CharField(
        max_length=6,
        blank=True,
        validators=[RegexValidator(r"^\d{6}$", "Enter a valid 6-digit PIN code.")],
    )
    land_area_acres = models.DecimalField(
        max_digits=9,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)],
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["user__first_name", "user__last_name", "farmer_code"]

    @property
    def is_complete(self) -> bool:
        return bool(
            self.village
            and self.district
            and self.state
            and self.pincode
            and self.land_area_acres is not None
            and self.land_area_acres > 0
        )

    def clean(self):
        super().clean()
        if self.user_id and self.user.role != User.Role.FARMER:
            from django.core.exceptions import ValidationError

            raise ValidationError({"user": "A farmer profile can belong only to a FARMER user."})

    def __str__(self) -> str:
        return f"{self.farmer_code} — {self.user.get_full_name() or self.user.email}"
