from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User

from .analytics import procurement_analytics
from .milestone5_serializers import (
    CreateGrievanceSerializer,
    GrievanceActionSerializer,
    GrievanceSerializer,
    InitiatePaymentSerializer,
    NotificationSerializer,
    PaymentActionSerializer,
    PaymentRecordSerializer,
)
from .milestone5_services import (
    create_grievance,
    initiate_payment,
    transition_grievance,
    transition_payment,
)
from .models import Grievance, Notification, PaymentRecord
from .payment_receipts import build_payment_receipt_pdf


class PaymentRecordViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "head", "options"]

    def get_serializer_class(self):
        if self.action == "create":
            return InitiatePaymentSerializer
        if self.action == "transition":
            return PaymentActionSerializer
        return PaymentRecordSerializer

    def get_queryset(self):
        queryset = PaymentRecord.objects.select_related(
            "transaction", "transaction__request", "transaction__farmer",
            "transaction__farmer__farmer_profile", "transaction__farmer_crop__crop",
            "transaction__procurement_center", "initiated_by", "settlement_receipt",
        ).prefetch_related("events", "events__actor")
        user = self.request.user
        if user.role == User.Role.FARMER:
            return queryset.filter(transaction__farmer=user)
        if user.role == User.Role.PROCUREMENT_OFFICER:
            return queryset.filter(
                transaction__procurement_center__officer_assignments__officer=user,
                transaction__procurement_center__officer_assignments__is_active=True,
                transaction__procurement_center__is_active=True,
            ).distinct()
        if user.role == User.Role.ADMIN:
            return queryset
        return queryset.none()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        payment = initiate_payment(
            transaction_id=data["transaction"].id,
            actor=request.user,
            method=data["method"],
            beneficiary_reference=data.get("beneficiary_reference", ""),
            note=data.get("note", ""),
            idempotency_key=request.headers.get("Idempotency-Key", ""),
        )
        output = PaymentRecordSerializer(self.get_queryset().get(pk=payment.pk))
        return Response(output.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def transition(self, request, pk=None):
        scoped = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = transition_payment(
            payment_id=scoped.id,
            actor=request.user,
            idempotency_key=request.headers.get("Idempotency-Key", ""),
            **serializer.validated_data,
        )
        return Response(PaymentRecordSerializer(self.get_queryset().get(pk=payment.pk)).data)

    @action(detail=True, methods=["get"])
    def receipt(self, request, pk=None):
        payment = self.get_object()
        if payment.status != PaymentRecord.Status.SETTLED or not hasattr(payment, "settlement_receipt"):
            return Response(
                {"detail": "Settlement proof is available only after verified settlement."},
                status=status.HTTP_409_CONFLICT,
            )
        pdf = build_payment_receipt_pdf(payment)
        filename = f"{payment.settlement_receipt.receipt_number}.pdf"
        response = HttpResponse(pdf, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response["X-Content-Type-Options"] = "nosniff"
        return response


class NotificationViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        queryset = Notification.objects.filter(recipient=self.request.user)
        unread = self.request.query_params.get("unread", "").lower()
        if unread == "true":
            queryset = queryset.filter(read_at__isnull=True)
        return queryset

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        if notification.read_at is None:
            notification.read_at = timezone.now()
            notification.save(update_fields=["read_at"])
        return Response(self.get_serializer(notification).data)

    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request):
        updated = self.get_queryset().filter(read_at__isnull=True).update(read_at=timezone.now())
        return Response({"marked_read": updated})


class GrievanceViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "head", "options"]

    def get_serializer_class(self):
        if self.action == "create":
            return CreateGrievanceSerializer
        if self.action == "transition":
            return GrievanceActionSerializer
        return GrievanceSerializer

    def get_queryset(self):
        queryset = Grievance.objects.select_related(
            "farmer", "request", "transaction", "payment", "payment__transaction", "assigned_to"
        ).prefetch_related("events", "events__actor")
        user = self.request.user
        if user.role == User.Role.FARMER:
            queryset = queryset.filter(farmer=user)
        elif user.role == User.Role.PROCUREMENT_OFFICER:
            queryset = queryset.filter(
                Q(request__procurement_center__officer_assignments__officer=user,
                  request__procurement_center__officer_assignments__is_active=True)
                | Q(transaction__procurement_center__officer_assignments__officer=user,
                    transaction__procurement_center__officer_assignments__is_active=True)
                | Q(payment__transaction__procurement_center__officer_assignments__officer=user,
                    payment__transaction__procurement_center__officer_assignments__is_active=True)
            )
        elif user.role != User.Role.ADMIN:
            queryset = queryset.none()
        status_filter = self.request.query_params.get("status")
        if status_filter in Grievance.Status.values:
            queryset = queryset.filter(status=status_filter)
        return queryset.distinct()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        grievance = create_grievance(farmer=request.user, data=serializer.validated_data)
        return Response(
            GrievanceSerializer(self.get_queryset().get(pk=grievance.pk)).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def transition(self, request, pk=None):
        scoped = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        grievance = transition_grievance(
            grievance_id=scoped.id,
            actor=request.user,
            **serializer.validated_data,
        )
        return Response(GrievanceSerializer(self.get_queryset().get(pk=grievance.pk)).data)


class ProcurementAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            procurement_analytics(
                actor=request.user,
                params=request.query_params,
                today=timezone.localdate(),
            )
        )
