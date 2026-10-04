from django.core.exceptions import ObjectDoesNotExist
from rest_framework.permissions import BasePermission

from .models import User


class HasRole(BasePermission):
    allowed_roles: tuple[str, ...] = ()

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in self.allowed_roles
        )


class IsFarmer(HasRole):
    allowed_roles = (User.Role.FARMER,)


class IsProcurementOfficer(HasRole):
    allowed_roles = (User.Role.PROCUREMENT_OFFICER,)


class IsAdministrator(HasRole):
    allowed_roles = (User.Role.ADMIN,)


class IsOwnerOrAssignedOfficerOrAdministrator(BasePermission):
    """Deny by default unless ownership or centre assignment is provable."""

    def has_object_permission(self, request, view, obj):
        if request.user.role == User.Role.ADMIN:
            return True
        if request.user.role == User.Role.FARMER:
            owner_id = getattr(obj, "farmer_id", None) or getattr(obj, "user_id", None)
            return owner_id == request.user.id
        if request.user.role == User.Role.PROCUREMENT_OFFICER:
            try:
                assigned_centre_id = request.user.officer_profile.procurement_center_id
            except (AttributeError, ObjectDoesNotExist):
                return False
            object_centre_id = getattr(obj, "procurement_center_id", None)
            return bool(object_centre_id and object_centre_id == assigned_centre_id)
        return False
