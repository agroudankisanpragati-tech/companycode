from datetime import time
from decimal import Decimal

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import FarmerProfile, User
from apps.procurement.models import (
    AcceptanceDecision,
    ArrivalCheckIn,
    CapacityReservation,
    CropCatalogue,
    FarmerCrop,
    Grievance,
    GrievanceEvent,
    Notification,
    OfficerAssignment,
    PaymentEvent,
    PaymentReceipt,
    PaymentRecord,
    ProcurementAppointment,
    ProcurementCenter,
    ProcurementReceipt,
    ProcurementRequest,
    ProcurementTransaction,
    QualityInspection,
    Weighment,
)


class MilestoneFiveOperationsApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.farmer = cls._user("farmer.m5@example.com", User.Role.FARMER)
        cls.other_farmer = cls._user("other.farmer.m5@example.com", User.Role.FARMER)
        cls.officer = cls._user("officer.m5@example.com", User.Role.PROCUREMENT_OFFICER)
        cls.other_officer = cls._user("other.officer.m5@example.com", User.Role.PROCUREMENT_OFFICER)
        cls.admin = cls._user("admin.m5@example.com", User.Role.ADMIN, is_staff=True)
        cls.center = cls._center("M5-DURG", "Milestone Five Durg", cls.admin)
        cls.other_center = cls._center("M5-RAIPUR", "Milestone Five Raipur", cls.admin)
        OfficerAssignment.objects.create(
            officer=cls.officer, procurement_center=cls.center, employee_id="M5-EMP-1", assigned_by=cls.admin
        )
        OfficerAssignment.objects.create(
            officer=cls.other_officer, procurement_center=cls.other_center, employee_id="M5-EMP-2", assigned_by=cls.admin
        )
        cls.crop = CropCatalogue.objects.create(
            code="M5-PADDY", name="Milestone Five Paddy", category=CropCatalogue.Category.CEREAL
        )
        cls.transaction_record = cls._transaction(cls.farmer, cls.center, cls.crop, cls.officer, "M5-A", "1000.00")
        cls.other_transaction = cls._transaction(
            cls.other_farmer, cls.other_center, cls.crop, cls.other_officer, "M5-B", "500.00"
        )

    @classmethod
    def _user(cls, email, role, **extra):
        user = User.objects.create_user(
            email=email, password="StrongPass@123", first_name=email.split("@")[0].title(), role=role, **extra
        )
        if role == User.Role.FARMER:
            profile = FarmerProfile.objects.get(user=user)
            profile.village = "Kumhari"
            profile.district = "Durg"
            profile.state = "Chhattisgarh"
            profile.pincode = "491001"
            profile.save()
        return user

    @classmethod
    def _center(cls, code, name, admin):
        return ProcurementCenter.objects.create(
            code=code,
            name=name,
            center_type=ProcurementCenter.CenterType.PACS,
            address_line="Procurement campus",
            village_or_city="Durg",
            district="Durg",
            state="Chhattisgarh",
            pincode="491001",
            daily_capacity_kg=Decimal("5000.00"),
            created_by=admin,
        )

    @classmethod
    def _transaction(cls, farmer, center, crop, officer, prefix, total):
        farmer_crop = FarmerCrop.objects.create(
            farmer=farmer,
            crop=crop,
            season=FarmerCrop.Season.KHARIF,
            harvest_year=timezone.localdate().year,
            cultivated_area_acres=Decimal("5.00"),
            estimated_quantity_kg=Decimal("1000.00"),
            available_quantity_kg=Decimal("900.00"),
        )
        request_record = ProcurementRequest.objects.create(
            farmer=farmer,
            farmer_crop=farmer_crop,
            procurement_center=center,
            intended_quantity_kg=Decimal("100.00"),
            preferred_date=timezone.localdate(),
            status=ProcurementRequest.Status.PROCURED,
        )
        reservation = CapacityReservation.objects.create(
            request=request_record,
            procurement_center=center,
            reservation_date=timezone.localdate(),
            quantity_kg=Decimal("100.00"),
            status=CapacityReservation.Status.CONSUMED,
        )
        appointment = ProcurementAppointment.objects.create(
            request=request_record,
            capacity_reservation=reservation,
            procurement_center=center,
            scheduled_date=timezone.localdate(),
            slot_start_time=time(10, 0),
            slot_end_time=time(11, 0),
            queue_number=1,
            status=ProcurementAppointment.Status.COMPLETED,
        )
        check_in = ArrivalCheckIn.objects.create(
            appointment=appointment,
            request=request_record,
            procurement_center=center,
            checked_in_by=officer,
        )
        inspection = QualityInspection.objects.create(
            check_in=check_in,
            result=QualityInspection.Result.PASSED,
            grade=QualityInspection.Grade.FAQ,
            inspected_by=officer,
        )
        weighment = Weighment.objects.create(
            inspection=inspection,
            gross_weight_kg=Decimal("150.00"),
            tare_weight_kg=Decimal("50.00"),
            net_weight_kg=Decimal("100.00"),
            weighed_by=officer,
        )
        decision = AcceptanceDecision.objects.create(
            weighment=weighment,
            outcome=AcceptanceDecision.Outcome.ACCEPTED,
            accepted_quantity_kg=Decimal("100.00"),
            rejected_quantity_kg=Decimal("0.00"),
            decided_by=officer,
        )
        transaction_record = ProcurementTransaction.objects.create(
            request=request_record,
            appointment=appointment,
            acceptance_decision=decision,
            farmer=farmer,
            farmer_crop=farmer_crop,
            procurement_center=center,
            accepted_quantity_kg=Decimal("100.00"),
            rate_per_kg=Decimal(total) / Decimal("100.00"),
            total_amount=Decimal(total),
            recorded_by=officer,
        )
        ProcurementReceipt.objects.create(transaction=transaction_record)
        return transaction_record

    def _initiate(self, actor=None, transaction_record=None, key="m5-init-1", **overrides):
        self.client.force_authenticate(user=actor or self.officer)
        payload = {
            "transaction": str((transaction_record or self.transaction_record).id),
            "method": "DBT",
            "beneficiary_reference": "Verified farmer account",
            "note": "Queued after procurement verification.",
            **overrides,
        }
        return self.client.post(
            reverse("payment-list"), payload, format="json", HTTP_IDEMPOTENCY_KEY=key
        )

    def _transition(self, payment, actor, action, key, **payload):
        self.client.force_authenticate(user=actor)
        return self.client.post(
            reverse("payment-transition", kwargs={"pk": payment.id}),
            {"action": action, **payload},
            format="json",
            HTTP_IDEMPOTENCY_KEY=key,
        )

    def test_officer_initiates_exact_transaction_linked_payment(self):
        response = self._initiate()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        payment = PaymentRecord.objects.get()
        self.assertEqual(payment.amount, self.transaction_record.total_amount)
        self.assertEqual(payment.status, PaymentRecord.Status.INITIATED)
        self.assertEqual(payment.events.count(), 1)
        self.assertEqual(Notification.objects.filter(recipient=self.farmer, payment=payment).count(), 1)

    def test_farmer_and_outside_officer_cannot_initiate_payment(self):
        self.assertEqual(self._initiate(actor=self.farmer).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self._initiate(actor=self.other_officer, key="m5-init-outside").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(PaymentRecord.objects.count(), 0)

    def test_initiation_is_idempotent_and_key_reuse_is_guarded(self):
        first = self._initiate()
        replay = self._initiate()
        conflict = self._initiate(key="m5-init-1", method="NEFT")
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(replay.status_code, status.HTTP_201_CREATED)
        self.assertEqual(replay.data["id"], first.data["id"])
        self.assertEqual(conflict.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(PaymentRecord.objects.count(), 1)
        self.assertEqual(PaymentEvent.objects.count(), 1)

    def test_payment_list_and_transaction_status_are_role_scoped(self):
        payment = PaymentRecord.objects.create(
            transaction=self.transaction_record,
            amount=self.transaction_record.total_amount,
            initiated_by=self.officer,
        )
        for actor, count in ((self.farmer, 1), (self.other_farmer, 0), (self.officer, 1), (self.other_officer, 0), (self.admin, 1)):
            self.client.force_authenticate(user=actor)
            response = self.client.get(reverse("payment-list"))
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(response.data["count"], count)
        self.client.force_authenticate(user=self.farmer)
        transaction_response = self.client.get(
            reverse("procurement-transaction-detail", kwargs={"pk": self.transaction_record.id})
        )
        self.assertEqual(transaction_response.data["payment_status"], "INITIATED")
        self.assertEqual(str(transaction_response.data["payment_id"]), str(payment.id))

    def test_only_admin_can_reconcile_and_settlement_mints_proof(self):
        self._initiate()
        payment = PaymentRecord.objects.get()
        processing = self._transition(payment, self.officer, "START_PROCESSING", "m5-processing")
        self.assertEqual(processing.status_code, status.HTTP_200_OK)
        forbidden = self._transition(
            payment, self.officer, "SETTLE", "m5-forbidden-settle", bank_reference="UTR-M5-1"
        )
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)
        settled = self._transition(
            payment, self.admin, "SETTLE", "m5-settle", bank_reference="UTR-M5-1", note="Bank confirmation matched."
        )
        self.assertEqual(settled.status_code, status.HTTP_200_OK)
        payment.refresh_from_db()
        self.assertEqual(payment.status, PaymentRecord.Status.SETTLED)
        self.assertEqual(payment.bank_reference, "UTR-M5-1")
        self.assertTrue(PaymentReceipt.objects.filter(payment=payment).exists())

    def test_payment_proof_is_unavailable_before_settlement_and_pdf_after(self):
        self._initiate()
        payment = PaymentRecord.objects.get()
        self.client.force_authenticate(user=self.farmer)
        pending = self.client.get(reverse("payment-receipt", kwargs={"pk": payment.id}))
        self.assertEqual(pending.status_code, status.HTTP_409_CONFLICT)
        self._transition(payment, self.officer, "START_PROCESSING", "m5-pdf-processing")
        self._transition(payment, self.admin, "SETTLE", "m5-pdf-settle", bank_reference="UTR-M5-PDF")
        self.client.force_authenticate(user=self.farmer)
        proof = self.client.get(reverse("payment-receipt", kwargs={"pk": payment.id}))
        self.assertEqual(proof.status_code, status.HTTP_200_OK)
        self.assertEqual(proof["Content-Type"], "application/pdf")
        self.assertTrue(proof.content.startswith(b"%PDF"))

    def test_failed_payment_can_retry_but_invalid_transitions_do_not_mutate(self):
        self._initiate()
        payment = PaymentRecord.objects.get()
        invalid = self._transition(payment, self.admin, "SETTLE", "m5-early-settle", bank_reference="UTR-EARLY")
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
        failed = self._transition(payment, self.admin, "FAIL", "m5-fail", failure_reason="Bank validation failed.")
        self.assertEqual(failed.status_code, status.HTTP_200_OK)
        retried = self._transition(payment, self.officer, "RETRY", "m5-retry", note="Beneficiary revalidated.")
        self.assertEqual(retried.status_code, status.HTTP_200_OK)
        payment.refresh_from_db()
        self.assertEqual(payment.status, PaymentRecord.Status.INITIATED)
        self.assertEqual(payment.attempt_count, 2)
        self.assertEqual(payment.last_failure_reason, "Bank validation failed.")

    def test_notifications_are_private_and_support_read_controls(self):
        mine = Notification.objects.create(
            recipient=self.farmer, category=Notification.Category.SYSTEM, title="Mine", message="Private"
        )
        Notification.objects.create(
            recipient=self.other_farmer, category=Notification.Category.SYSTEM, title="Other", message="Hidden"
        )
        self.client.force_authenticate(user=self.farmer)
        listing = self.client.get(reverse("notification-list"))
        self.assertEqual(listing.data["count"], 1)
        marked = self.client.post(reverse("notification-mark-read", kwargs={"pk": mine.id}), {}, format="json")
        self.assertTrue(marked.data["is_read"])
        all_read = self.client.post(reverse("notification-mark-all-read"), {}, format="json")
        self.assertEqual(all_read.data["marked_read"], 0)

    def test_farmer_lodges_linked_grievance_with_audit_event(self):
        self.client.force_authenticate(user=self.farmer)
        response = self.client.post(
            reverse("grievance-list"),
            {
                "category": "PROCUREMENT",
                "subject": "Accepted quantity query",
                "description": "Please review the recorded accepted quantity.",
                "priority": "NORMAL",
                "transaction": str(self.transaction_record.id),
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        grievance = Grievance.objects.get()
        self.assertEqual(grievance.farmer, self.farmer)
        self.assertEqual(grievance.events.get().action, GrievanceEvent.Action.CREATED)
        self.assertTrue(Notification.objects.filter(recipient=self.farmer, grievance=grievance).exists())

    def test_grievance_cannot_reference_another_farmers_transaction(self):
        self.client.force_authenticate(user=self.farmer)
        response = self.client.post(
            reverse("grievance-list"),
            {
                "category": "PROCUREMENT", "subject": "Invalid link",
                "description": "This link is not mine.", "transaction": str(self.other_transaction.id),
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Grievance.objects.count(), 0)

    def test_grievance_queue_is_center_scoped_and_resolution_is_audited(self):
        grievance = Grievance.objects.create(
            farmer=self.farmer,
            category=Grievance.Category.PROCUREMENT,
            subject="Review transaction",
            description="Please review.",
            transaction=self.transaction_record,
        )
        for actor, count in ((self.officer, 1), (self.other_officer, 0), (self.admin, 1)):
            self.client.force_authenticate(user=actor)
            listing = self.client.get(reverse("grievance-list"))
            self.assertEqual(listing.data["count"], count)
        self.client.force_authenticate(user=self.officer)
        reviewed = self.client.post(
            reverse("grievance-transition", kwargs={"pk": grievance.id}),
            {"action": "START_REVIEW", "note": "Ledger review started."}, format="json",
        )
        self.assertEqual(reviewed.status_code, status.HTTP_200_OK)
        resolved = self.client.post(
            reverse("grievance-transition", kwargs={"pk": grievance.id}),
            {"action": "RESOLVE", "note": "Quantity matches the signed weighment."}, format="json",
        )
        self.assertEqual(resolved.status_code, status.HTTP_200_OK)
        grievance.refresh_from_db()
        self.assertEqual(grievance.status, Grievance.Status.RESOLVED)
        self.assertEqual(grievance.events.count(), 2)

    def test_analytics_reports_settlement_outstanding_and_blocks_farmer(self):
        payment = PaymentRecord.objects.create(
            transaction=self.transaction_record,
            amount=self.transaction_record.total_amount,
            initiated_by=self.officer,
            status=PaymentRecord.Status.SETTLED,
            bank_reference="UTR-M5-ANALYTICS",
            settled_at=timezone.now(),
        )
        PaymentReceipt.objects.create(payment=payment, issued_by=self.admin)
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(reverse("procurement-analytics"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["totals"]["transaction_count"], 2)
        self.assertEqual(response.data["totals"]["payable_amount"], "1500.00")
        self.assertEqual(response.data["totals"]["settled_amount"], "1000.00")
        self.assertEqual(response.data["totals"]["outstanding_amount"], "500.00")
        self.client.force_authenticate(user=self.farmer)
        forbidden = self.client.get(reverse("procurement-analytics"))
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)
