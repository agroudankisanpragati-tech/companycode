from datetime import timedelta
from decimal import Decimal

from django.db.models import Sum
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import FarmerProfile, User
from apps.procurement.models import (
    CapacityReservation,
    CropCatalogue,
    FarmerCrop,
    OfficerAssignment,
    ProcurementAppointment,
    ProcurementCenter,
    ProcurementRequest,
)


class ProcurementWorkflowApiTests(APITestCase):
    def setUp(self):
        self.farmer = self._create_user("farmer.one@example.com", User.Role.FARMER)
        self.other_farmer = self._create_user("farmer.two@example.com", User.Role.FARMER)
        self.officer = self._create_user(
            "officer.one@example.com", User.Role.PROCUREMENT_OFFICER
        )
        self.other_officer = self._create_user(
            "officer.two@example.com", User.Role.PROCUREMENT_OFFICER
        )
        self.admin = self._create_user("admin@example.com", User.Role.ADMIN, is_staff=True)
        self._complete_profile(self.farmer, "Durg")
        self._complete_profile(self.other_farmer, "Raipur")

        self.center = self._create_center("DURG-01", "Durg Centre", "1000.00")
        self.other_center = self._create_center("RAIPUR-01", "Raipur Centre", "1000.00")
        self.crop = CropCatalogue.objects.create(
            code="PADDY",
            name="Paddy",
            category=CropCatalogue.Category.CEREAL,
        )
        self.farmer_crop = self._create_farmer_crop(self.farmer, "900.00", FarmerCrop.Season.KHARIF)
        self.other_farmer_crop = self._create_farmer_crop(
            self.other_farmer,
            "900.00",
            FarmerCrop.Season.RABI,
        )
        OfficerAssignment.objects.create(
            officer=self.officer,
            procurement_center=self.center,
            employee_id="EMP-001",
            assigned_by=self.admin,
        )
        OfficerAssignment.objects.create(
            officer=self.other_officer,
            procurement_center=self.other_center,
            employee_id="EMP-002",
            assigned_by=self.admin,
        )
        self.tomorrow = timezone.localdate() + timedelta(days=1)

    def _create_user(self, email, role, **extra):
        return User.objects.create_user(
            email=email,
            password="StrongPass@123",
            first_name=email.split("@")[0].replace(".", " ").title(),
            role=role,
            **extra,
        )

    def _complete_profile(self, farmer, district):
        profile = FarmerProfile.objects.get(user=farmer)
        profile.village = "Test village"
        profile.district = district
        profile.state = "Chhattisgarh"
        profile.pincode = "491001"
        profile.land_area_acres = Decimal("4.00")
        profile.save()

    def _create_center(self, code, name, capacity):
        return ProcurementCenter.objects.create(
            code=code,
            name=name,
            center_type=ProcurementCenter.CenterType.PACS,
            address_line="Test address",
            village_or_city=name.split()[0],
            district=name.split()[0],
            state="Chhattisgarh",
            pincode="491001",
            daily_capacity_kg=Decimal(capacity),
            created_by=self.admin,
        )

    def _create_farmer_crop(self, farmer, quantity, season):
        return FarmerCrop.objects.create(
            farmer=farmer,
            crop=self.crop,
            season=season,
            harvest_year=timezone.localdate().year,
            cultivated_area_acres=Decimal("2.00"),
            estimated_quantity_kg=Decimal(quantity),
            available_quantity_kg=Decimal(quantity),
        )

    def _authenticate(self, user):
        self.client.force_authenticate(user=user)

    def _submit_request(
        self,
        farmer=None,
        farmer_crop=None,
        center=None,
        quantity="500.00",
    ):
        farmer = farmer or self.farmer
        farmer_crop = farmer_crop or self.farmer_crop
        center = center or self.center
        self._authenticate(farmer)
        return self.client.post(
            reverse("procurement-request-list"),
            {
                "farmer_crop": str(farmer_crop.id),
                "procurement_center": str(center.id),
                "intended_quantity_kg": quantity,
                "preferred_date": self.tomorrow.isoformat(),
                "farmer_notes": "Ready after harvest.",
            },
            format="json",
        )

    def _review(self, request_id, actor, action="APPROVE", **overrides):
        self._authenticate(actor)
        payload = {
            "action": action,
            "scheduled_date": self.tomorrow.isoformat(),
            "slot_start_time": "10:00",
            "slot_end_time": "11:00",
            "quantity_kg": "500.00",
            "review_notes": "Capacity verified.",
            **overrides,
        }
        return self.client.post(
            reverse("procurement-request-review", kwargs={"pk": request_id}),
            payload,
            format="json",
        )

    def test_submission_requires_complete_profile_and_uses_authenticated_owner(self):
        profile = self.farmer.farmer_profile
        profile.village = ""
        profile.save(update_fields=["village", "updated_at"])

        incomplete = self._submit_request()
        self.assertEqual(incomplete.status_code, status.HTTP_400_BAD_REQUEST)

        profile.village = "Test village"
        profile.save(update_fields=["village", "updated_at"])
        self._authenticate(self.farmer)
        forged_crop = self.client.post(
            reverse("procurement-request-list"),
            {
                "farmer": str(self.other_farmer.id),
                "farmer_crop": str(self.other_farmer_crop.id),
                "procurement_center": str(self.center.id),
                "intended_quantity_kg": "100.00",
                "preferred_date": self.tomorrow.isoformat(),
            },
            format="json",
        )
        self.assertEqual(forged_crop.status_code, status.HTTP_400_BAD_REQUEST)

        created = self._submit_request()
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        procurement_request = ProcurementRequest.objects.get(pk=created.data["id"])
        self.assertEqual(procurement_request.farmer, self.farmer)
        self.assertEqual(procurement_request.status, ProcurementRequest.Status.SUBMITTED)
        self.assertEqual(procurement_request.status_events.count(), 1)
        self.assertEqual(CapacityReservation.objects.count(), 0)
        self.assertEqual(ProcurementAppointment.objects.count(), 0)

    def test_requests_are_visible_only_inside_farmer_or_center_scope(self):
        created = self._submit_request()
        request_id = created.data["id"]

        self._authenticate(self.other_farmer)
        other_farmer_list = self.client.get(reverse("procurement-request-list"))
        self.assertEqual(other_farmer_list.data["count"], 0)
        hidden_detail = self.client.get(
            reverse("procurement-request-detail", kwargs={"pk": request_id})
        )
        self.assertEqual(hidden_detail.status_code, status.HTTP_404_NOT_FOUND)

        self._authenticate(self.officer)
        officer_list = self.client.get(reverse("procurement-request-list"))
        self.assertEqual(officer_list.data["count"], 1)

        self._authenticate(self.other_officer)
        other_officer_list = self.client.get(reverse("procurement-request-list"))
        self.assertEqual(other_officer_list.data["count"], 0)
        forbidden_review = self._review(request_id, self.other_officer)
        self.assertEqual(forbidden_review.status_code, status.HTTP_404_NOT_FOUND)

    def test_review_and_approval_create_one_reservation_appointment_and_token(self):
        created = self._submit_request()
        request_id = created.data["id"]

        started = self._review(request_id, self.officer, action="START_REVIEW")
        self.assertEqual(started.status_code, status.HTTP_200_OK)
        self.assertEqual(started.data["status"], ProcurementRequest.Status.UNDER_REVIEW)

        approved = self._review(request_id, self.officer)
        self.assertEqual(approved.status_code, status.HTTP_200_OK)
        self.assertEqual(approved.data["status"], ProcurementRequest.Status.APPROVED)
        self.assertEqual(approved.data["appointment"]["queue_number"], 1)
        self.assertTrue(approved.data["appointment"]["token_code"].startswith("DAPP-"))
        self.assertEqual(
            CapacityReservation.objects.filter(status=CapacityReservation.Status.ACTIVE).count(),
            1,
        )
        self.assertEqual(
            ProcurementAppointment.objects.filter(
                status=ProcurementAppointment.Status.SCHEDULED
            ).count(),
            1,
        )
        self.assertEqual(ProcurementRequest.objects.get(pk=request_id).status_events.count(), 3)

        self._authenticate(self.farmer)
        capacity = self.client.get(
            reverse("procurement-centre-capacity", kwargs={"pk": self.center.id}),
            {"date": self.tomorrow.isoformat()},
        )
        self.assertEqual(capacity.status_code, status.HTTP_200_OK)
        self.assertEqual(capacity.data["reserved_quantity_kg"], Decimal("500.00"))
        self.assertEqual(capacity.data["available_quantity_kg"], Decimal("500.00"))

    def test_center_overbooking_is_rejected_without_partial_writes(self):
        first = self._submit_request(quantity="800.00")
        approved = self._review(
            first.data["id"],
            self.officer,
            quantity_kg="800.00",
        )
        self.assertEqual(approved.status_code, status.HTTP_200_OK)

        second = self._submit_request(
            farmer=self.other_farmer,
            farmer_crop=self.other_farmer_crop,
            quantity="300.00",
        )
        rejected = self._review(
            second.data["id"],
            self.officer,
            quantity_kg="300.00",
        )
        self.assertEqual(rejected.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            ProcurementRequest.objects.get(pk=second.data["id"]).status,
            ProcurementRequest.Status.SUBMITTED,
        )
        self.assertFalse(
            CapacityReservation.objects.filter(request_id=second.data["id"]).exists()
        )
        self.assertEqual(
            CapacityReservation.objects.filter(status=CapacityReservation.Status.ACTIVE).aggregate(
                total=Sum("quantity_kg")
            )["total"],
            Decimal("800.00"),
        )

    def test_farmer_crop_cannot_be_reserved_beyond_available_quantity(self):
        first = self._submit_request(quantity="600.00")
        first_approved = self._review(
            first.data["id"],
            self.admin,
            quantity_kg="600.00",
        )
        self.assertEqual(first_approved.status_code, status.HTTP_200_OK)

        second = self._submit_request(
            center=self.other_center,
            quantity="400.00",
        )
        second_review = self._review(
            second.data["id"],
            self.admin,
            quantity_kg="400.00",
        )
        self.assertEqual(second_review.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(
            CapacityReservation.objects.filter(request_id=second.data["id"]).exists()
        )

    def test_reschedule_preserves_history_and_replaces_active_token(self):
        created = self._submit_request(quantity="500.00")
        approved = self._review(created.data["id"], self.officer)
        first_token = approved.data["appointment"]["token_code"]

        rescheduled_date = self.tomorrow + timedelta(days=1)
        rescheduled = self._review(
            created.data["id"],
            self.officer,
            action="RESCHEDULE",
            scheduled_date=rescheduled_date.isoformat(),
            slot_start_time="13:00",
            slot_end_time="14:00",
            quantity_kg="450.00",
            review_notes="Farmer requested a later arrival.",
        )
        self.assertEqual(rescheduled.status_code, status.HTTP_200_OK)
        self.assertEqual(rescheduled.data["status"], ProcurementRequest.Status.RESCHEDULED)
        self.assertNotEqual(rescheduled.data["appointment"]["token_code"], first_token)
        self.assertEqual(
            CapacityReservation.objects.filter(
                request_id=created.data["id"],
                status=CapacityReservation.Status.RELEASED,
            ).count(),
            1,
        )
        self.assertEqual(
            ProcurementAppointment.objects.filter(
                request_id=created.data["id"],
                status=ProcurementAppointment.Status.CANCELLED,
            ).count(),
            1,
        )
        self.assertEqual(
            CapacityReservation.objects.get(
                request_id=created.data["id"],
                status=CapacityReservation.Status.ACTIVE,
            ).quantity_kg,
            Decimal("450.00"),
        )

    def test_farmer_cancellation_releases_capacity_and_cancels_token(self):
        created = self._submit_request()
        self._review(created.data["id"], self.officer)

        self._authenticate(self.farmer)
        cancelled = self.client.post(
            reverse("procurement-request-cancel", kwargs={"pk": created.data["id"]}),
            {"reason": "I cannot reach the centre on this date."},
            format="json",
        )
        self.assertEqual(cancelled.status_code, status.HTTP_200_OK)
        self.assertEqual(cancelled.data["status"], ProcurementRequest.Status.CANCELLED)
        self.assertFalse(
            CapacityReservation.objects.filter(
                request_id=created.data["id"],
                status=CapacityReservation.Status.ACTIVE,
            ).exists()
        )
        self.assertFalse(
            ProcurementAppointment.objects.filter(
                request_id=created.data["id"],
                status=ProcurementAppointment.Status.SCHEDULED,
            ).exists()
        )

    def test_active_reservations_protect_farmer_crop_availability(self):
        created = self._submit_request()
        self._review(created.data["id"], self.officer)

        self._authenticate(self.farmer)
        reduce_below_reserved = self.client.patch(
            reverse("farmer-crop-detail", kwargs={"pk": self.farmer_crop.id}),
            {"available_quantity_kg": "400.00"},
            format="json",
        )
        self.assertEqual(reduce_below_reserved.status_code, status.HTTP_400_BAD_REQUEST)

        archive = self.client.patch(
            reverse("farmer-crop-detail", kwargs={"pk": self.farmer_crop.id}),
            {"is_active": False},
            format="json",
        )
        self.assertEqual(archive.status_code, status.HTTP_400_BAD_REQUEST)
        self.farmer_crop.refresh_from_db()
        self.assertEqual(self.farmer_crop.available_quantity_kg, Decimal("900.00"))
        self.assertTrue(self.farmer_crop.is_active)

    def test_rejection_requires_reason_and_workflow_records_cannot_be_deleted(self):
        created = self._submit_request()
        missing_reason = self._review(
            created.data["id"],
            self.officer,
            action="REJECT",
            review_notes="",
        )
        self.assertEqual(missing_reason.status_code, status.HTTP_400_BAD_REQUEST)

        rejected = self._review(
            created.data["id"],
            self.officer,
            action="REJECT",
            review_notes="Crop is outside the current intake window.",
        )
        self.assertEqual(rejected.status_code, status.HTTP_200_OK)
        self.assertEqual(rejected.data["status"], ProcurementRequest.Status.REJECTED)

        delete_request = self.client.delete(
            reverse("procurement-request-detail", kwargs={"pk": created.data["id"]})
        )
        self.assertEqual(delete_request.status_code, status.HTTP_403_FORBIDDEN)

        self._authenticate(self.farmer)
        appointment_delete = self.client.delete(
            reverse("procurement-appointment-detail", kwargs={"pk": "00000000-0000-0000-0000-000000000000"})
        )
        self.assertEqual(appointment_delete.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_role_summaries_include_live_request_and_capacity_metrics(self):
        created = self._submit_request()
        self._review(created.data["id"], self.officer)

        self._authenticate(self.farmer)
        farmer_summary = self.client.get(reverse("dashboard-summary"))
        self.assertEqual(farmer_summary.data["active_requests"], 1)
        self.assertEqual(farmer_summary.data["scheduled_appointments"], 1)
        self.assertEqual(farmer_summary.data["reserved_quantity_kg"], Decimal("500.00"))

        self._authenticate(self.officer)
        officer_summary = self.client.get(reverse("dashboard-summary"))
        self.assertEqual(officer_summary.data["appointments_today"], 0)
        self.assertEqual(
            officer_summary.data["remaining_capacity_today_kg"],
            Decimal("1000.00"),
        )

        self._authenticate(self.admin)
        admin_summary = self.client.get(reverse("dashboard-summary"))
        self.assertEqual(admin_summary.data["upcoming_appointments"], 1)
        self.assertEqual(admin_summary.data["open_requests"], 0)
