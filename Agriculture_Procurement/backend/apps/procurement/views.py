from decimal import Decimal

from django.db import transaction
from django.db.models import Prefetch, Q, Sum
from django.http import Http404, HttpResponse
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import FarmerProfile, User
from apps.accounts.permissions import IsProcurementOfficer

from .models import (
    CapacityReservation,
    CropCatalogue,
    FarmerCrop,
    OfficerAssignment,
    ProcurementAppointment,
    ProcurementCenter,
    ProcurementTransaction,
    ProcurementRequest,
    RequestStatusEvent,
    Grievance,
    Notification,
    PaymentRecord,
)
from .permissions import (
    IsAdministrator,
    IsAdministratorOrReadOnly,
    IsFarmerOwnerOrAdministratorReadOnly,
    ProcurementAppointmentPermission,
    ProcurementRequestPermission,
)
from .intake_serializers import (
    AcceptanceActionSerializer,
    CheckInActionSerializer,
    InspectionActionSerializer,
    ProcurementTransactionSerializer,
    WeighmentActionSerializer,
)
from .intake_services import (
    check_in_appointment,
    decide_appointment,
    inspect_appointment,
    weigh_appointment,
)
from .receipts import build_procurement_receipt_pdf
from .serializers import (
    CancelRequestSerializer,
    CapacityQuerySerializer,
    CropCatalogueSerializer,
    FarmerCropSerializer,
    OfficerAssignmentSerializer,
    ProcurementAppointmentSerializer,
    ProcurementCenterSerializer,
    ProcurementRequestSerializer,
    ReviewActionSerializer,
)
from .services import (
    cancel_request,
    capacity_snapshot,
    reject_request,
    schedule_request,
    start_review,
)


class ProcurementCenterViewSet(viewsets.ModelViewSet):
    serializer_class = ProcurementCenterSerializer
    permission_classes = [IsAdministratorOrReadOnly]
    http_method_names = ["get", "post", "put", "patch", "head", "options"]

    def get_queryset(self):
        queryset = ProcurementCenter.objects.select_related("created_by")
        user = self.request.user
        if user.role == User.Role.ADMIN:
            return queryset
        if user.role == User.Role.PROCUREMENT_OFFICER:
            return queryset.filter(
                officer_assignments__officer=user,
                officer_assignments__is_active=True,
                is_active=True,
            )
        return queryset.filter(is_active=True)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["get"])
    def capacity(self, request, pk=None):
        center = self.get_object()
        query = CapacityQuerySerializer(data={"date": request.query_params.get("date")})
        query.is_valid(raise_exception=True)
        reservation_date = query.validated_data["date"]
        return Response(
            {
                "procurement_center": center.id,
                "center_code": center.code,
                "center_name": center.name,
                "date": reservation_date,
                **capacity_snapshot(center, reservation_date),
            }
        )


class CropCatalogueViewSet(viewsets.ModelViewSet):
    serializer_class = CropCatalogueSerializer
    permission_classes = [IsAdministratorOrReadOnly]
    http_method_names = ["get", "post", "put", "patch", "head", "options"]

    def get_queryset(self):
        queryset = CropCatalogue.objects.all()
        if self.request.user.role == User.Role.ADMIN:
            return queryset
        return queryset.filter(is_active=True)


class FarmerCropViewSet(viewsets.ModelViewSet):
    serializer_class = FarmerCropSerializer
    permission_classes = [IsFarmerOwnerOrAdministratorReadOnly]
    http_method_names = ["get", "post", "put", "patch", "head", "options"]

    def get_queryset(self):
        queryset = FarmerCrop.objects.select_related("farmer", "farmer__farmer_profile", "crop")
        user = self.request.user
        if user.role == User.Role.ADMIN:
            return queryset
        if user.role == User.Role.FARMER:
            return queryset.filter(farmer=user)
        return queryset.none()

    def perform_create(self, serializer):
        serializer.save(farmer=self.request.user)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        scoped_instance = self.get_object()
        instance = FarmerCrop.objects.select_for_update().get(pk=scoped_instance.pk)
        serializer = self.get_serializer(
            instance,
            data=request.data,
            partial=kwargs.pop("partial", False),
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class OfficerAssignmentViewSet(viewsets.ModelViewSet):
    queryset = OfficerAssignment.objects.select_related("officer", "procurement_center", "assigned_by")
    serializer_class = OfficerAssignmentSerializer
    permission_classes = [IsAdministrator]
    http_method_names = ["get", "post", "put", "patch", "head", "options"]

    def perform_create(self, serializer):
        serializer.save(assigned_by=self.request.user)


class MyProcurementCenterView(APIView):
    permission_classes = [IsProcurementOfficer]

    def get(self, request):
        try:
            assignment = OfficerAssignment.objects.select_related("procurement_center").get(
                officer=request.user,
                is_active=True,
                procurement_center__is_active=True,
            )
        except OfficerAssignment.DoesNotExist as exc:
            raise Http404("No active procurement centre is assigned to this officer.") from exc
        return Response(ProcurementCenterSerializer(assignment.procurement_center).data)


class ProcurementRequestViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = ProcurementRequestSerializer
    permission_classes = [ProcurementRequestPermission]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        status_filter = self.request.query_params.get("status")
        queryset = (
            ProcurementRequest.objects.select_related(
                "farmer",
                "farmer__farmer_profile",
                "farmer_crop",
                "farmer_crop__crop",
                "procurement_center",
                "reviewed_by",
            )
            .prefetch_related(
                Prefetch(
                    "appointments",
                    queryset=ProcurementAppointment.objects.select_related(
                        "capacity_reservation",
                        "procurement_center",
                        "request__farmer",
                        "request__farmer__farmer_profile",
                        "request__farmer_crop__crop",
                    ),
                ),
                Prefetch(
                    "status_events",
                    queryset=RequestStatusEvent.objects.select_related("actor"),
                ),
            )
        )
        user = self.request.user
        if user.role == User.Role.FARMER:
            queryset = queryset.filter(farmer=user)
        elif user.role == User.Role.PROCUREMENT_OFFICER:
            queryset = queryset.filter(
                procurement_center__officer_assignments__officer=user,
                procurement_center__officer_assignments__is_active=True,
                procurement_center__is_active=True,
            )
        elif user.role != User.Role.ADMIN:
            queryset = queryset.none()

        if status_filter in ProcurementRequest.Status.values:
            queryset = queryset.filter(status=status_filter)
        return queryset.distinct()

    def perform_create(self, serializer):
        serializer.save(farmer=self.request.user)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        procurement_request = self.get_object()
        action_serializer = CancelRequestSerializer(data=request.data)
        action_serializer.is_valid(raise_exception=True)
        cancel_request(
            procurement_request.id,
            request.user,
            action_serializer.validated_data["reason"],
        )
        refreshed = self.get_queryset().get(pk=procurement_request.pk)
        return Response(self.get_serializer(refreshed).data)

    @action(detail=True, methods=["post"])
    def review(self, request, pk=None):
        procurement_request = self.get_object()
        action_serializer = ReviewActionSerializer(data=request.data)
        action_serializer.is_valid(raise_exception=True)
        data = action_serializer.validated_data
        action_name = data["action"]
        review_notes = data.get("review_notes", "")

        if action_name == "START_REVIEW":
            start_review(procurement_request.id, request.user, review_notes)
        elif action_name == "REJECT":
            reject_request(procurement_request.id, request.user, review_notes)
        else:
            schedule_request(
                procurement_request.id,
                request.user,
                action=action_name,
                scheduled_date=data["scheduled_date"],
                slot_start_time=data["slot_start_time"],
                slot_end_time=data["slot_end_time"],
                quantity_kg=data["quantity_kg"],
                note=review_notes,
            )

        refreshed = self.get_queryset().get(pk=procurement_request.pk)
        return Response(self.get_serializer(refreshed).data, status=status.HTTP_200_OK)


class ProcurementAppointmentViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ProcurementAppointmentSerializer
    permission_classes = [ProcurementAppointmentPermission]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        queryset = ProcurementAppointment.objects.select_related(
            "request",
            "request__farmer",
            "request__farmer__farmer_profile",
            "request__farmer_crop__crop",
            "capacity_reservation",
            "procurement_center",
            "check_in",
            "check_in__checked_in_by",
            "check_in__inspection",
            "check_in__inspection__inspected_by",
            "check_in__inspection__weighment",
            "check_in__inspection__weighment__weighed_by",
            "check_in__inspection__weighment__acceptance_decision",
            "check_in__inspection__weighment__acceptance_decision__decided_by",
            "check_in__inspection__weighment__acceptance_decision__procurement_transaction",
            "check_in__inspection__weighment__acceptance_decision__procurement_transaction__recorded_by",
            "check_in__inspection__weighment__acceptance_decision__procurement_transaction__receipt",
        )
        user = self.request.user
        if user.role == User.Role.FARMER:
            queryset = queryset.filter(request__farmer=user)
        elif user.role == User.Role.PROCUREMENT_OFFICER:
            queryset = queryset.filter(
                procurement_center__officer_assignments__officer=user,
                procurement_center__officer_assignments__is_active=True,
                procurement_center__is_active=True,
            )
        elif user.role != User.Role.ADMIN:
            queryset = queryset.none()

        appointment_status = self.request.query_params.get("status")
        if appointment_status in ProcurementAppointment.Status.values:
            queryset = queryset.filter(status=appointment_status)
        if self.request.query_params.get("operational", "").lower() == "true":
            queryset = queryset.filter(
                status__in=(
                    ProcurementAppointment.Status.SCHEDULED,
                    ProcurementAppointment.Status.CHECKED_IN,
                )
            )
        return queryset.distinct()

    def _run_action(self, request, pk, action_serializer_class, service):
        appointment = self.get_object()
        action_serializer = action_serializer_class(data=request.data)
        action_serializer.is_valid(raise_exception=True)
        service(appointment.id, request.user, **action_serializer.validated_data)
        refreshed = self.get_queryset().get(pk=appointment.pk)
        return Response(self.get_serializer(refreshed).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="check-in")
    def check_in(self, request, pk=None):
        return self._run_action(request, pk, CheckInActionSerializer, check_in_appointment)

    @action(detail=True, methods=["post"])
    def inspect(self, request, pk=None):
        return self._run_action(request, pk, InspectionActionSerializer, inspect_appointment)

    @action(detail=True, methods=["post"])
    def weigh(self, request, pk=None):
        return self._run_action(request, pk, WeighmentActionSerializer, weigh_appointment)

    @action(detail=True, methods=["post"])
    def decide(self, request, pk=None):
        return self._run_action(request, pk, AcceptanceActionSerializer, decide_appointment)


class ProcurementTransactionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ProcurementTransactionSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "head", "options"]

    def get_queryset(self):
        queryset = ProcurementTransaction.objects.select_related(
            "request",
            "appointment",
            "farmer",
            "farmer__farmer_profile",
            "farmer_crop",
            "farmer_crop__crop",
            "procurement_center",
            "acceptance_decision",
            "acceptance_decision__weighment",
            "recorded_by",
            "receipt",
            "payment",
        )
        user = self.request.user
        if user.role == User.Role.FARMER:
            return queryset.filter(farmer=user)
        if user.role == User.Role.PROCUREMENT_OFFICER:
            return queryset.filter(
                procurement_center__officer_assignments__officer=user,
                procurement_center__officer_assignments__is_active=True,
                procurement_center__is_active=True,
            ).distinct()
        if user.role == User.Role.ADMIN:
            return queryset
        return queryset.none()

    @action(detail=True, methods=["get"])
    def receipt(self, request, pk=None):
        transaction_record = self.get_object()
        pdf = build_procurement_receipt_pdf(transaction_record)
        filename = f"{transaction_record.receipt.receipt_number}.pdf"
        response = HttpResponse(pdf, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response["X-Content-Type-Options"] = "nosniff"
        return response


class DashboardSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        today = timezone.localdate()
        if user.role == User.Role.FARMER:
            crops = FarmerCrop.objects.filter(farmer=user, is_active=True)
            totals = crops.aggregate(available_quantity_kg=Sum("available_quantity_kg"))
            profile, _ = FarmerProfile.objects.get_or_create(user=user)
            active_requests = ProcurementRequest.objects.filter(
                farmer=user,
                status__in=(
                    ProcurementRequest.Status.SUBMITTED,
                    ProcurementRequest.Status.UNDER_REVIEW,
                    ProcurementRequest.Status.APPROVED,
                    ProcurementRequest.Status.RESCHEDULED,
                    ProcurementRequest.Status.CHECKED_IN,
                    ProcurementRequest.Status.INSPECTION_PASSED,
                    ProcurementRequest.Status.WEIGHED,
                ),
            )
            reservations = CapacityReservation.objects.filter(
                request__farmer=user,
                status=CapacityReservation.Status.ACTIVE,
            )
            procurements = ProcurementTransaction.objects.filter(farmer=user)
            procurement_totals = procurements.aggregate(
                quantity=Sum("accepted_quantity_kg"),
                amount=Sum("total_amount"),
            )
            settled_amount = PaymentRecord.objects.filter(
                transaction__farmer=user,
                status=PaymentRecord.Status.SETTLED,
            ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
            payable_amount = procurement_totals["amount"] or Decimal("0.00")
            return Response(
                {
                    "role": user.role,
                    "profile_completed": profile.is_complete,
                    "farmer_code": profile.farmer_code,
                    "registered_crops": crops.count(),
                    "available_quantity_kg": totals["available_quantity_kg"] or 0,
                    "active_centers": ProcurementCenter.objects.filter(is_active=True).count(),
                    "active_requests": active_requests.count(),
                    "scheduled_appointments": ProcurementAppointment.objects.filter(
                        request__farmer=user,
                        status=ProcurementAppointment.Status.SCHEDULED,
                        scheduled_date__gte=today,
                    ).count(),
                    "reserved_quantity_kg": reservations.aggregate(total=Sum("quantity_kg"))[
                        "total"
                    ]
                    or 0,
                    "total_procurements": procurements.count(),
                    "procured_quantity_kg": procurement_totals["quantity"] or 0,
                    "amount_payable": procurement_totals["amount"] or 0,
                    "amount_settled": settled_amount,
                    "amount_outstanding": payable_amount - settled_amount,
                    "unread_notifications": Notification.objects.filter(
                        recipient=user, read_at__isnull=True
                    ).count(),
                    "open_grievances": Grievance.objects.filter(
                        farmer=user,
                        status__in=(Grievance.Status.OPEN, Grievance.Status.UNDER_REVIEW),
                    ).count(),
                }
            )

        if user.role == User.Role.PROCUREMENT_OFFICER:
            assignment = (
                OfficerAssignment.objects.select_related("procurement_center")
                .filter(
                    officer=user,
                    is_active=True,
                    procurement_center__is_active=True,
                )
                .first()
            )
            pending_requests = 0
            appointments_today = 0
            reserved_today = Decimal("0.00")
            remaining_capacity_today = Decimal("0.00")
            processing_arrivals = 0
            procurements_today = 0
            procured_today = Decimal("0.00")
            amount_recorded_today = Decimal("0.00")
            unsettled_payments = 0
            open_grievances = 0
            if assignment:
                center = assignment.procurement_center
                pending_requests = ProcurementRequest.objects.filter(
                    procurement_center=center,
                    status__in=(
                        ProcurementRequest.Status.SUBMITTED,
                        ProcurementRequest.Status.UNDER_REVIEW,
                    ),
                ).count()
                appointments_today = ProcurementAppointment.objects.filter(
                    procurement_center=center,
                    scheduled_date=today,
                    status__in=(
                        ProcurementAppointment.Status.SCHEDULED,
                        ProcurementAppointment.Status.CHECKED_IN,
                    ),
                ).count()
                processing_arrivals = ProcurementAppointment.objects.filter(
                    procurement_center=center,
                    status=ProcurementAppointment.Status.CHECKED_IN,
                ).count()
                today_transactions = ProcurementTransaction.objects.filter(
                    procurement_center=center,
                    procured_at__date=today,
                )
                transaction_totals = today_transactions.aggregate(
                    quantity=Sum("accepted_quantity_kg"),
                    amount=Sum("total_amount"),
                )
                procurements_today = today_transactions.count()
                procured_today = transaction_totals["quantity"] or Decimal("0.00")
                amount_recorded_today = transaction_totals["amount"] or Decimal("0.00")
                snapshot = capacity_snapshot(center, today)
                reserved_today = snapshot["reserved_quantity_kg"]
                remaining_capacity_today = snapshot["available_quantity_kg"]
                unsettled_payments = PaymentRecord.objects.filter(
                    transaction__procurement_center=center,
                    status__in=(
                        PaymentRecord.Status.INITIATED,
                        PaymentRecord.Status.PROCESSING,
                        PaymentRecord.Status.FAILED,
                    ),
                ).count()
                open_grievances = Grievance.objects.filter(
                    Q(request__procurement_center=center)
                    | Q(transaction__procurement_center=center)
                    | Q(payment__transaction__procurement_center=center),
                    status__in=(Grievance.Status.OPEN, Grievance.Status.UNDER_REVIEW),
                ).distinct().count()
            return Response(
                {
                    "role": user.role,
                    "center_assigned": assignment is not None,
                    "assigned_center": (
                        ProcurementCenterSerializer(assignment.procurement_center).data
                        if assignment
                        else None
                    ),
                    "active_catalogue_crops": CropCatalogue.objects.filter(is_active=True).count(),
                    "pending_requests": pending_requests,
                    "appointments_today": appointments_today,
                    "reserved_today_kg": reserved_today,
                    "remaining_capacity_today_kg": remaining_capacity_today,
                    "processing_arrivals": processing_arrivals,
                    "procurements_today": procurements_today,
                    "procured_today_kg": procured_today,
                    "amount_recorded_today": amount_recorded_today,
                    "unsettled_payments": unsettled_payments,
                    "open_grievances": open_grievances,
                    "unread_notifications": Notification.objects.filter(
                        recipient=user, read_at__isnull=True
                    ).count(),
                }
            )

        all_transactions = ProcurementTransaction.objects.all()
        admin_transaction_totals = all_transactions.aggregate(
            quantity=Sum("accepted_quantity_kg"),
            amount=Sum("total_amount"),
        )
        settled_total = PaymentRecord.objects.filter(
            status=PaymentRecord.Status.SETTLED
        ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
        recorded_total = admin_transaction_totals["amount"] or Decimal("0.00")
        return Response(
            {
                "role": user.role,
                "registered_farmers": User.objects.filter(role=User.Role.FARMER).count(),
                "active_centers": ProcurementCenter.objects.filter(is_active=True).count(),
                "catalogue_crops": CropCatalogue.objects.count(),
                "assigned_officers": OfficerAssignment.objects.filter(
                    is_active=True,
                    procurement_center__is_active=True,
                ).count(),
                "open_requests": ProcurementRequest.objects.filter(
                    status__in=(
                        ProcurementRequest.Status.SUBMITTED,
                        ProcurementRequest.Status.UNDER_REVIEW,
                    )
                ).count(),
                "upcoming_appointments": ProcurementAppointment.objects.filter(
                    status=ProcurementAppointment.Status.SCHEDULED,
                    scheduled_date__gte=today,
                ).count(),
                "reserved_today_kg": CapacityReservation.objects.filter(
                    status=CapacityReservation.Status.ACTIVE,
                    reservation_date=today,
                ).aggregate(total=Sum("quantity_kg"))["total"]
                or 0,
                "total_procurements": all_transactions.count(),
                "procured_today_kg": ProcurementTransaction.objects.filter(
                    procured_at__date=today
                ).aggregate(total=Sum("accepted_quantity_kg"))["total"]
                or 0,
                "procured_quantity_kg": admin_transaction_totals["quantity"] or 0,
                "amount_recorded_total": admin_transaction_totals["amount"] or 0,
                "amount_settled_total": settled_total,
                "amount_outstanding_total": recorded_total - settled_total,
                "failed_payments": PaymentRecord.objects.filter(
                    status=PaymentRecord.Status.FAILED
                ).count(),
                "open_grievances": Grievance.objects.filter(
                    status__in=(Grievance.Status.OPEN, Grievance.Status.UNDER_REVIEW)
                ).count(),
                "unread_notifications": Notification.objects.filter(
                    recipient=user, read_at__isnull=True
                ).count(),
            }
        )
