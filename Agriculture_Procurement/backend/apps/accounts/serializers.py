import re

from django.contrib.auth import authenticate, password_validation
from rest_framework import serializers

from .models import FarmerProfile, User


def normalize_phone_number(value):
    if value in (None, ""):
        return None
    normalized = re.sub(r"\D", "", value)
    if not re.fullmatch(r"[6-9]\d{9}", normalized):
        raise serializers.ValidationError("Enter a valid 10-digit Indian mobile number.")
    return normalized


class UserSerializer(serializers.ModelSerializer):
    profile_completed = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "phone_number",
            "preferred_language",
            "role",
            "is_verified",
            "profile_completed",
        )
        read_only_fields = ("id", "email", "role", "is_verified", "profile_completed")

    def validate_phone_number(self, value):
        return normalize_phone_number(value)

    def get_profile_completed(self, obj):
        if obj.role != User.Role.FARMER:
            return True
        try:
            return obj.farmer_profile.is_complete
        except FarmerProfile.DoesNotExist:
            return False


class FarmerProfileSerializer(serializers.ModelSerializer):
    farmer_name = serializers.CharField(source="user.get_full_name", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    phone_number = serializers.CharField(source="user.phone_number", read_only=True)
    is_complete = serializers.BooleanField(read_only=True)

    class Meta:
        model = FarmerProfile
        fields = (
            "id",
            "farmer_code",
            "farmer_name",
            "email",
            "phone_number",
            "village",
            "gram_panchayat",
            "block",
            "district",
            "state",
            "pincode",
            "land_area_acres",
            "is_complete",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "farmer_code",
            "farmer_name",
            "email",
            "phone_number",
            "is_complete",
            "created_at",
            "updated_at",
        )

    def validate_land_area_acres(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError("Land area must be greater than zero.")
        return value


class FarmerRegistrationSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    phone_number = serializers.CharField(max_length=10)
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "phone_number",
            "preferred_language",
            "password",
            "password_confirm",
        )
        read_only_fields = ("id",)

    def validate_email(self, value):
        return value.lower().strip()

    def validate_phone_number(self, value):
        return normalize_phone_number(value)

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("password_confirm"):
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        password_validation.validate_password(attrs["password"])
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        return User.objects.create_user(
            password=password,
            role=User.Role.FARMER,
            **validated_data,
        )


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        user = authenticate(
            request=self.context.get("request"),
            email=attrs["email"].lower().strip(),
            password=attrs["password"],
        )
        if user is None:
            raise serializers.ValidationError({"detail": "Invalid email address or password."})
        if not user.is_active:
            raise serializers.ValidationError({"detail": "This account is inactive."})
        attrs["user"] = user
        return attrs
