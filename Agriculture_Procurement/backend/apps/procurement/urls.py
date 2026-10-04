from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    CropCatalogueViewSet,
    DashboardSummaryView,
    FarmerCropViewSet,
    MyProcurementCenterView,
    OfficerAssignmentViewSet,
    ProcurementAppointmentViewSet,
    ProcurementCenterViewSet,
    ProcurementRequestViewSet,
    ProcurementTransactionViewSet,
)
from .milestone5_views import (
    GrievanceViewSet,
    NotificationViewSet,
    PaymentRecordViewSet,
    ProcurementAnalyticsView,
)

router = DefaultRouter()
router.register("centres", ProcurementCenterViewSet, basename="procurement-centre")
router.register("crop-catalogue", CropCatalogueViewSet, basename="crop-catalogue")
router.register("farmer-crops", FarmerCropViewSet, basename="farmer-crop")
router.register("officer-assignments", OfficerAssignmentViewSet, basename="officer-assignment")
router.register("procurement-requests", ProcurementRequestViewSet, basename="procurement-request")
router.register("appointments", ProcurementAppointmentViewSet, basename="procurement-appointment")
router.register(
    "procurement-transactions",
    ProcurementTransactionViewSet,
    basename="procurement-transaction",
)
router.register("payments", PaymentRecordViewSet, basename="payment")
router.register("notifications", NotificationViewSet, basename="notification")
router.register("grievances", GrievanceViewSet, basename="grievance")

urlpatterns = [
    path("dashboard/summary/", DashboardSummaryView.as_view(), name="dashboard-summary"),
    path("officer/me/centre/", MyProcurementCenterView.as_view(), name="my-procurement-centre"),
    path("analytics/summary/", ProcurementAnalyticsView.as_view(), name="procurement-analytics"),
    *router.urls,
]
