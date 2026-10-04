from datetime import time, timedelta
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
    OfficerAssignment,
    ProcurementAppointment,
    ProcurementCenter,
    ProcurementReceipt,
    ProcurementRequest,
    ProcurementTransaction,
    QualityInspection,
    RequestStatusEvent,
    Weighment,
)


class PhysicalProcurementApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.farmer = cls._user("farmer.m4@example.com", User.Role.FARMER)
        cls.other_farmer = cls._user("other.farmer.m4@example.com", User.Role.FARMER)
        cls.officer = cls._user("officer.m4@example.com", User.Role.PROCUREMENT_OFFICER)
        cls.other_officer = cls._user(
            "other.officer.m4@example.com", User.Role.PROCUREMENT_OFFICER
        )
        cls.admin = cls._user("admin.m4@example.com", User.Role.ADMIN, is_staff=True)

        profile = FarmerProfile.objects.get(user=cls.farmer)
        profile.village = "Kumhari"
        profile.district = "Durg"
        profile.state = "Chhattisgarh"
        profile.pincode = "491001"
        profile.land_area_acres = Decimal("5.00")
        profile.save()

        cls.center = cls._center("M4-DURG", "Milestone Four Durg", cls.admin)
        cls.other_center = cls._center("M4-RAIPUR", "Milestone Four Raipur", cls.admin)
        cls.crop = CropCatalogue.objects.create(
            code="M4-PADDY",
            name="Milestone Four Paddy",
            category=CropCatalogue.Category.CEREAL,
        )
        cls.farmer_crop = FarmerCrop.objects.create(
            farmer=cls.farmer,
            crop=cls.crop,
            season=FarmerCrop.Season.KHARIF,
            harvest_year=timezone.localdate().year,
            cultivated_area_acres=Decimal("3.00"),
            estimated_quantity_kg=Decimal("900.00"),
            available_quantity_kg=Decimal("900.00"),
        )
        OfficerAssignment.objects.create(
            officer=cls.officer,
            procurement_center=cls.center,
            employee_id="M4-EMP-1",
            assigned_by=cls.admin,
        )
        OfficerAssignment.objects.create(
            officer=cls.other_officer,
            procurement_center=cls.other_center,
            employee_id="M4-EMP-2",
            assigned_by=cls.admin,
        )

    @classmethod
    def _user(cls, email, role, **extra):
        return User.objects.create_user(
            email=email,
            password="StrongPass@123",
            first_name=email.split("@")[0].replace(".", " ").title(),
            role=role,
            **extra,
        )

    @classmethod
    def _center(cls, code, name, admin):
        return ProcurementCenter.objects.create(
            code=code,
            name=name,
            center_type=ProcurementCenter.CenterType.PACS,
            address_line="Test procurement campus",
            village_or_city="Durg",
            district="Durg",
            state="Chhattisgarh",
            pincode="491001",
            daily_capacity_kg=Decimal("1000.00"),
            created_by=admin,
        )

    def _appointment(self, *, scheduled_date=None, quantity="500.00"):
        scheduled_date = scheduled_date or timezone.localdate()
        procurement_request = ProcurementRequest.objects.create(
            farmer=self.farmer,
            farmer_crop=self.farmer_crop,
            procurement_center=self.center,
            intended_quantity_kg=Decimal(quantity),
            preferred_date=scheduled_date,
            status=ProcurementRequest.Status.APPROVED,
            reviewed_by=self.officer,
            reviewed_at=timezone.now(),
        )
        RequestStatusEvent.objects.create(
            request=procurement_request,
            from_status=ProcurementRequest.Status.UNDER_REVIEW,
            to_status=ProcurementRequest.Status.APPROVED,
            actor=self.officer,
            note="Test appointment scheduled.",
        )
        reservation = CapacityReservation.objects.create(
            request=procurement_request,
            procurement_center=self.center,
            reservation_date=scheduled_date,
            quantity_kg=Decimal(quantity),
        )
        return ProcurementAppointment.objects.create(
            request=procurement_request,
            capacity_reservation=reservation,
            procurement_center=self.center,
            scheduled_date=scheduled_date,
            slot_start_time=time(10, 0),
            slot_end_time=time(11, 0),
            queue_number=1,
        )

    def _post(self, actor, route, appointment, payload):
        self.client.force_authenticate(user=actor)
        return self.client.post(
            reverse(route, kwargs={"pk": appointment.id}),
            payload,
            format="json",
        )

    def _check_in(self, appointment, actor=None):
        return self._post(
            actor or self.officer,
            "procurement-appointment-check-in",
            appointment,
            {
                "transport_mode": ArrivalCheckIn.TransportMode.TRACTOR,
                "vehicle_number": "cg 07 ab 1234",
                "arrival_notes": "Token verified at gate.",
            },
        )

    def _pass_inspection(self, appointment, actor=None):
        return self._post(
            actor or self.officer,
            "procurement-appointment-inspect",
            appointment,
            {
                "result": QualityInspection.Result.PASSED,
                "grade": QualityInspection.Grade.FAQ,
                "moisture_percentage": "12.50",
                "foreign_matter_percentage": "1.20",
                "damaged_percentage": "0.50",
                "sample_reference": "M4-SAMPLE-1",
            },
        )

    def _weigh(self, appointment, actor=None):
        return self._post(
            actor or self.officer,
            "procurement-appointment-weigh",
            appointment,
            {
                "gross_weight_kg": "650.00",
                "tare_weight_kg": "150.00",
                "bag_count": 25,
                "weighbridge_reference": "WB-M4-1",
            },
        )

    def _to_weighed(self, appointment):
        self.assertEqual(self._check_in(appointment).status_code, status.HTTP_200_OK)
        self.assertEqual(self._pass_inspection(appointment).status_code, status.HTTP_200_OK)
        self.assertEqual(self._weigh(appointment).status_code, status.HTTP_200_OK)

    def _accept(self, appointment, accepted="480.00", rate="23.50", reason="20 kg below grade"):
        return self._post(
            self.officer,
            "procurement-appointment-decide",
            appointment,
            {
                "accepted_quantity_kg": accepted,
                "rate_per_kg": rate,
                "decision_reason": reason,
            },
        )

    def test_future_arrival_cannot_check_in(self):
        appointment = self._appointment(scheduled_date=timezone.localdate() + timedelta(days=1))
        response = self._check_in(appointment)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(ArrivalCheckIn.objects.count(), 0)
        appointment.refresh_from_db()
        self.assertEqual(appointment.status, ProcurementAppointment.Status.SCHEDULED)

    def test_only_assigned_officer_or_admin_can_process_arrival(self):
        appointment = self._appointment()
        farmer_attempt = self._check_in(appointment, self.farmer)
        self.assertEqual(farmer_attempt.status_code, status.HTTP_403_FORBIDDEN)
        outside_assignment = self._check_in(appointment, self.other_officer)
        self.assertEqual(outside_assignment.status_code, status.HTTP_404_NOT_FOUND)
        admin_attempt = self._check_in(appointment, self.admin)
        self.assertEqual(admin_attempt.status_code, status.HTTP_200_OK)
        self.assertEqual(admin_attempt.data["next_action"], "INSPECT")

    def test_partial_acceptance_atomically_creates_transaction_and_receipt(self):
        appointment = self._appointment()
        self._to_weighed(appointment)
        response = self._accept(appointment)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], ProcurementAppointment.Status.COMPLETED)
        self.assertEqual(response.data["request_status"], ProcurementRequest.Status.PROCURED)
        self.assertEqual(response.data["next_action"], "COMPLETE")
        self.assertEqual(response.data["processing"]["decision"]["outcome"], "PARTIAL")

        transaction_record = ProcurementTransaction.objects.select_related("receipt").get()
        self.assertEqual(transaction_record.accepted_quantity_kg, Decimal("480.00"))
        self.assertEqual(transaction_record.total_amount, Decimal("11280.00"))
        self.assertTrue(transaction_record.transaction_number.startswith("DAPP-TX-"))
        self.assertTrue(transaction_record.receipt.receipt_number.startswith("DAPP-RC-"))

        self.farmer_crop.refresh_from_db()
        appointment.capacity_reservation.refresh_from_db()
        self.assertEqual(self.farmer_crop.available_quantity_kg, Decimal("420.00"))
        self.assertEqual(
            appointment.capacity_reservation.status,
            CapacityReservation.Status.CONSUMED,
        )
        self.assertIsNotNone(appointment.capacity_reservation.consumed_at)

        self.client.force_authenticate(user=self.farmer)
        capacity = self.client.get(
            reverse("procurement-centre-capacity", kwargs={"pk": self.center.id}),
            {"date": timezone.localdate().isoformat()},
        )
        self.assertEqual(capacity.data["reserved_quantity_kg"], Decimal("0.00"))
        self.assertEqual(capacity.data["consumed_quantity_kg"], Decimal("500.00"))
        self.assertEqual(capacity.data["allocated_quantity_kg"], Decimal("500.00"))
        self.assertEqual(capacity.data["available_quantity_kg"], Decimal("500.00"))

        receipt = self.client.get(
            reverse(
                "procurement-transaction-receipt",
                kwargs={"pk": transaction_record.id},
            )
        )
        self.assertEqual(receipt.status_code, status.HTTP_200_OK)
        self.assertEqual(receipt["Content-Type"], "application/pdf")
        self.assertTrue(receipt.content.startswith(b"%PDF"))
        self.assertIn(transaction_record.receipt.receipt_number, receipt["Content-Disposition"])

    def test_failed_inspection_releases_capacity_without_changing_crop(self):
        appointment = self._appointment()
        self.assertEqual(self._check_in(appointment).status_code, status.HTTP_200_OK)
        rejected = self._post(
            self.officer,
            "procurement-appointment-inspect",
            appointment,
            {"result": "REJECTED", "rejection_reason": "Moisture above limit."},
        )
        self.assertEqual(rejected.status_code, status.HTTP_200_OK)
        self.assertEqual(rejected.data["status"], ProcurementAppointment.Status.REJECTED)
        self.assertEqual(
            rejected.data["request_status"],
            ProcurementRequest.Status.INSPECTION_REJECTED,
        )
        appointment.capacity_reservation.refresh_from_db()
        self.farmer_crop.refresh_from_db()
        self.assertEqual(appointment.capacity_reservation.status, CapacityReservation.Status.RELEASED)
        self.assertEqual(self.farmer_crop.available_quantity_kg, Decimal("900.00"))
        self.assertEqual(Weighment.objects.count(), 0)
        self.assertEqual(ProcurementTransaction.objects.count(), 0)

    def test_invalid_weighment_rolls_back_and_can_be_retried(self):
        appointment = self._appointment()
        self.assertEqual(self._check_in(appointment).status_code, status.HTTP_200_OK)
        self.assertEqual(self._pass_inspection(appointment).status_code, status.HTTP_200_OK)
        invalid = self._post(
            self.officer,
            "procurement-appointment-weigh",
            appointment,
            {"gross_weight_kg": "100.00", "tare_weight_kg": "150.00"},
        )
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Weighment.objects.count(), 0)
        appointment.request.refresh_from_db()
        self.assertEqual(
            appointment.request.status,
            ProcurementRequest.Status.INSPECTION_PASSED,
        )
        self.assertEqual(self._weigh(appointment).status_code, status.HTTP_200_OK)

    def test_full_rejection_creates_decision_but_not_transaction(self):
        appointment = self._appointment()
        self._to_weighed(appointment)
        rejected = self._accept(
            appointment,
            accepted="0.00",
            rate=None,
            reason="Produce failed the final acceptance check.",
        )
        self.assertEqual(rejected.status_code, status.HTTP_200_OK)
        self.assertEqual(rejected.data["status"], ProcurementAppointment.Status.REJECTED)
        self.assertEqual(
            rejected.data["request_status"],
            ProcurementRequest.Status.PROCUREMENT_REJECTED,
        )
        self.assertEqual(AcceptanceDecision.objects.count(), 1)
        self.assertEqual(ProcurementTransaction.objects.count(), 0)
        self.assertEqual(ProcurementReceipt.objects.count(), 0)
        appointment.capacity_reservation.refresh_from_db()
        self.farmer_crop.refresh_from_db()
        self.assertEqual(appointment.capacity_reservation.status, CapacityReservation.Status.RELEASED)
        self.assertEqual(self.farmer_crop.available_quantity_kg, Decimal("900.00"))

    def test_acceptance_cannot_exceed_net_or_reservation_and_duplicate_steps_fail(self):
        appointment = self._appointment(quantity="450.00")
        self._to_weighed(appointment)
        too_large = self._accept(appointment, accepted="500.00", reason="")
        self.assertEqual(too_large.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(AcceptanceDecision.objects.count(), 0)
        valid = self._accept(appointment, accepted="450.00", reason="50 kg over reservation")
        self.assertEqual(valid.status_code, status.HTTP_200_OK)
        duplicate = self._accept(appointment, accepted="450.00", reason="duplicate")
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(ProcurementTransaction.objects.count(), 1)
        duplicate_check_in = self._check_in(appointment)
        self.assertEqual(duplicate_check_in.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(ArrivalCheckIn.objects.count(), 1)

    def test_transaction_history_is_role_scoped_and_read_only(self):
        appointment = self._appointment()
        self._to_weighed(appointment)
        self.assertEqual(self._accept(appointment).status_code, status.HTTP_200_OK)
        transaction_record = ProcurementTransaction.objects.get()

        for actor, expected_count in (
            (self.farmer, 1),
            (self.other_farmer, 0),
            (self.officer, 1),
            (self.other_officer, 0),
            (self.admin, 1),
        ):
            self.client.force_authenticate(user=actor)
            response = self.client.get(reverse("procurement-transaction-list"))
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(response.data["count"], expected_count)

        self.client.force_authenticate(user=self.farmer)
        deletion = self.client.delete(
            reverse("procurement-transaction-detail", kwargs={"pk": transaction_record.id})
        )
        self.assertEqual(deletion.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertTrue(ProcurementTransaction.objects.filter(pk=transaction_record.id).exists())

    def test_dashboard_reports_actual_procurements_not_sale_intent(self):
        appointment = self._appointment()
        self._to_weighed(appointment)
        self.assertEqual(self._accept(appointment).status_code, status.HTTP_200_OK)

        self.client.force_authenticate(user=self.farmer)
        farmer_summary = self.client.get(reverse("dashboard-summary"))
        self.assertEqual(farmer_summary.data["total_procurements"], 1)
        self.assertEqual(farmer_summary.data["procured_quantity_kg"], Decimal("480.00"))
        self.assertEqual(farmer_summary.data["amount_payable"], Decimal("11280.00"))

        self.client.force_authenticate(user=self.officer)
        officer_summary = self.client.get(reverse("dashboard-summary"))
        self.assertEqual(officer_summary.data["procurements_today"], 1)
        self.assertEqual(officer_summary.data["procured_today_kg"], Decimal("480.00"))
        self.assertEqual(officer_summary.data["amount_recorded_today"], Decimal("11280.00"))

        self.client.force_authenticate(user=self.admin)
        admin_summary = self.client.get(reverse("dashboard-summary"))
        self.assertEqual(admin_summary.data["total_procurements"], 1)
        self.assertEqual(admin_summary.data["amount_recorded_total"], Decimal("11280.00"))
