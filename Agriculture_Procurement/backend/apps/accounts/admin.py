from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import FarmerProfile, User


class FarmerProfileInline(admin.StackedInline):
    model = FarmerProfile
    extra = 0
    can_delete = False


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    inlines = (FarmerProfileInline,)
    ordering = ("email",)
    list_display = ("email", "first_name", "last_name", "role", "is_verified", "is_active")
    list_filter = ("role", "is_verified", "is_active", "is_staff")
    search_fields = ("email", "first_name", "last_name", "phone_number")
    readonly_fields = ("last_login", "date_joined")

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal information", {"fields": ("first_name", "last_name", "phone_number", "preferred_language")}),
        ("DAPP access", {"fields": ("role", "is_verified")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "first_name",
                    "last_name",
                    "phone_number",
                    "role",
                    "password1",
                    "password2",
                    "is_active",
                    "is_staff",
                ),
            },
        ),
    )


@admin.register(FarmerProfile)
class FarmerProfileAdmin(admin.ModelAdmin):
    list_display = ("farmer_code", "user", "village", "district", "state", "is_complete")
    search_fields = ("farmer_code", "user__email", "user__first_name", "user__last_name", "village", "district")
    list_filter = ("state", "district")
    readonly_fields = ("farmer_code", "created_at", "updated_at")
