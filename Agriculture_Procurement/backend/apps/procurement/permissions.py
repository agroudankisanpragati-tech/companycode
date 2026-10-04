from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.accounts.models import User


class IsAdministratorOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.role == User.Role.ADMIN


class IsFarmerOwnerOrAdministratorReadOnly(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return request.user.role in (User.Role.FARMER, User.Role.ADMIN)
        return request.user.role == User.Role.FARMER

    def has_object_permission(self, request, view, obj):
        if request.user.role == User.Role.ADMIN:
            return request.method in SAFE_METHODS
        return obj.farmer_id == request.user.id


class IsAdministrator(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == User.Role.ADMIN
        )


class ProcurementRequestPermission(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return request.user.role in (
                User.Role.FARMER,
                User.Role.PROCUREMENT_OFFICER,
                User.Role.ADMIN,
            )
        if view.action in ("create", "cancel"):
            return request.user.role == User.Role.FARMER
        if view.action == "review":
            return request.user.role in (
                User.Role.PROCUREMENT_OFFICER,
                User.Role.ADMIN,
            )
        return False


class ProcurementAppointmentPermission(BasePermission):
    """Allow scoped reads and officer/admin physical-processing actions."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return request.user.role in (
                User.Role.FARMER,
                User.Role.PROCUREMENT_OFFICER,
                User.Role.ADMIN,
            )
        if view.action in ("check_in", "inspect", "weigh", "decide"):
            return request.user.role in (
                User.Role.PROCUREMENT_OFFICER,
                User.Role.ADMIN,
            )
        # Let the viewset return a precise 405 for unsupported mutation methods.
        return request.user.role in (
            User.Role.FARMER,
            User.Role.PROCUREMENT_OFFICER,
            User.Role.ADMIN,
        )
