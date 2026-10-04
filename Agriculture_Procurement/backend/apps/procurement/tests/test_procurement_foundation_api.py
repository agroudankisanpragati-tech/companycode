from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.procurement.models import CropCatalogue, FarmerCrop, OfficerAssignment, ProcurementCenter


class ProcurementFoundationApiTests(APITestCase):
    def setUp(self):
        self.farmer = User.objects.create_user(
            email="farmer.one@example.com",
            password="StrongPass@123",
            first_name="Farmer",
            last_name="One",
            role=User.Role.FARMER,
        )
        self.other_farmer = User.objects.create_user(
            email="farmer.two@example.com",
            password="StrongPass@123",
            first_name="Farmer",
            last_name="Two",
            role=User.Role.FARMER,
        )
        self.officer = User.objects.create_user(
            email="officer@example.com",
            password="StrongPass@123",
            role=User.Role.PROCUREMENT_OFFICER,
        )
        self.admin = User.objects.create_user(
            email="admin@example.com",
            password="StrongPass@123",
            role=User.Role.ADMIN,
            is_staff=True,
        )
        self.center = ProcurementCenter.objects.create(
            code="DURG-01",
            name="Durg Test Centre",
            center_type=ProcurementCenter.CenterType.PACS,
            address_line="Test address",
            village_or_city="Durg",
            district="Durg",
            state="Chhattisgarh",
            pincode="491001",
            daily_capacity_kg=Decimal("25000.00"),
            created_by=self.admin,
        )
        self.inactive_center = ProcurementCenter.objects.create(
            code="RAIPUR-OLD",
            name="Inactive Test Centre",
            center_type=ProcurementCenter.CenterType.WAREHOUSE,
            address_line="Test address",
            village_or_city="Raipur",
            district="Raipur",
            state="Chhattisgarh",
            pincode="492001",
            daily_capacity_kg=Decimal("12000.00"),
            is_active=False,
            created_by=self.admin,
        )
        self.crop = CropCatalogue.objects.create(
            code="PADDY",
            name="Paddy",
            name_hi="धान",
            category=CropCatalogue.Category.CEREAL,
        )
        self.other_crop = CropCatalogue.objects.create(
            code="OLD-CROP",
            name="Inactive crop",
            category=CropCatalogue.Category.OTHER,
            is_active=False,
        )
        self.farmer_crop = FarmerCrop.objects.create(
            farmer=self.farmer,
            crop=self.crop,
            season=FarmerCrop.Season.KHARIF,
            harvest_year=2026,
            cultivated_area_acres=Decimal("2.00"),
            estimated_quantity_kg=Decimal("3000.00"),
            available_quantity_kg=Decimal("2500.00"),
        )
        FarmerCrop.objects.create(
            farmer=self.other_farmer,
            crop=self.crop,
            season=FarmerCrop.Season.RABI,
            harvest_year=2026,
            cultivated_area_acres=Decimal("1.00"),
            estimated_quantity_kg=Decimal("1500.00"),
            available_quantity_kg=Decimal("1400.00"),
        )
        OfficerAssignment.objects.create(
            officer=self.officer,
            procurement_center=self.center,
            employee_id="EMP-001",
            assigned_by=self.admin,
        )

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_farmer_profile_is_private_and_editable_by_owner(self):
        self.authenticate(self.farmer)
        response = self.client.patch(
            reverse("farmer-profile"),
            {
                "village": "Kumhari",
                "district": "Durg",
                "state": "Chhattisgarh",
                "pincode": "490042",
                "land_area_acres": "4.25",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_complete"])
        self.assertEqual(response.data["farmer_code"], self.farmer.farmer_profile.farmer_code)

        self.authenticate(self.admin)
        denied = self.client.get(reverse("farmer-profile"))
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

    def test_farmer_crop_list_never_exposes_another_farmer(self):
        self.authenticate(self.farmer)
        response = self.client.get(reverse("farmer-crop-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], str(self.farmer_crop.id))

    def test_farmer_cannot_forge_crop_owner(self):
        self.authenticate(self.farmer)
        response = self.client.post(
            reverse("farmer-crop-list"),
            {
                "farmer": str(self.other_farmer.id),
                "crop": str(self.crop.id),
                "season": FarmerCrop.Season.ZAID,
                "harvest_year": 2026,
                "cultivated_area_acres": "1.25",
                "estimated_quantity_kg": "900.00",
                "available_quantity_kg": "850.00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = FarmerCrop.objects.get(id=response.data["id"])
        self.assertEqual(created.farmer, self.farmer)

    def test_farmer_crop_quantity_duplicate_and_catalogue_rules(self):
        self.authenticate(self.farmer)
        base_payload = {
            "crop": str(self.crop.id),
            "season": FarmerCrop.Season.ZAID,
            "harvest_year": 2026,
            "cultivated_area_acres": "1.00",
            "estimated_quantity_kg": "500.00",
        }

        excessive = self.client.post(
            reverse("farmer-crop-list"),
            {**base_payload, "available_quantity_kg": "501.00"},
            format="json",
        )
        self.assertEqual(excessive.status_code, status.HTTP_400_BAD_REQUEST)

        duplicate = self.client.post(
            reverse("farmer-crop-list"),
            {
                **base_payload,
                "season": FarmerCrop.Season.KHARIF,
                "available_quantity_kg": "400.00",
            },
            format="json",
        )
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)

        inactive = self.client.post(
            reverse("farmer-crop-list"),
            {
                **base_payload,
                "crop": str(self.other_crop.id),
                "available_quantity_kg": "400.00",
            },
            format="json",
        )
        self.assertEqual(inactive.status_code, status.HTTP_400_BAD_REQUEST)

    def test_officer_has_no_direct_farmer_crop_access(self):
        self.authenticate(self.officer)
        response = self.client.get(reverse("farmer-crop-list"))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_audit_but_not_create_farmer_crop(self):
        self.authenticate(self.admin)
        listing = self.client.get(reverse("farmer-crop-list"))
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        self.assertEqual(listing.data["count"], 2)

        create = self.client.post(
            reverse("farmer-crop-list"),
            {
                "crop": str(self.crop.id),
                "season": FarmerCrop.Season.ZAID,
                "harvest_year": 2026,
                "cultivated_area_acres": "1.00",
                "estimated_quantity_kg": "100.00",
            },
            format="json",
        )
        self.assertEqual(create.status_code, status.HTTP_403_FORBIDDEN)

    def test_center_visibility_matches_role_scope(self):
        self.authenticate(self.farmer)
        farmer_response = self.client.get(reverse("procurement-centre-list"))
        self.assertEqual(farmer_response.data["count"], 1)

        self.authenticate(self.officer)
        officer_response = self.client.get(reverse("procurement-centre-list"))
        self.assertEqual(officer_response.data["count"], 1)
        self.assertEqual(officer_response.data["results"][0]["id"], str(self.center.id))

        my_center = self.client.get(reverse("my-procurement-centre"))
        self.assertEqual(my_center.status_code, status.HTTP_200_OK)
        self.assertEqual(my_center.data["code"], "DURG-01")

        self.authenticate(self.admin)
        admin_response = self.client.get(reverse("procurement-centre-list"))
        self.assertEqual(admin_response.data["count"], 2)

    def test_deactivated_center_closes_officer_scope(self):
        self.center.is_active = False
        self.center.save(update_fields=["is_active", "updated_at"])
        self.authenticate(self.officer)

        center_list = self.client.get(reverse("procurement-centre-list"))
        self.assertEqual(center_list.status_code, status.HTTP_200_OK)
        self.assertEqual(center_list.data["count"], 0)

        my_center = self.client.get(reverse("my-procurement-centre"))
        self.assertEqual(my_center.status_code, status.HTTP_404_NOT_FOUND)

        summary = self.client.get(reverse("dashboard-summary"))
        self.assertFalse(summary.data["center_assigned"])

        self.authenticate(self.admin)
        admin_summary = self.client.get(reverse("dashboard-summary"))
        self.assertEqual(admin_summary.data["assigned_officers"], 0)

    def test_only_admin_can_change_reference_data(self):
        self.authenticate(self.farmer)
        denied_center = self.client.post(
            reverse("procurement-centre-list"),
            {
                "code": "FORGED",
                "name": "Forbidden centre",
                "center_type": "OTHER",
                "address_line": "Nowhere",
                "village_or_city": "Durg",
                "district": "Durg",
                "state": "Chhattisgarh",
                "pincode": "491001",
                "daily_capacity_kg": "1000.00",
            },
            format="json",
        )
        self.assertEqual(denied_center.status_code, status.HTTP_403_FORBIDDEN)

        catalogue = self.client.get(reverse("crop-catalogue-list"))
        self.assertEqual(catalogue.data["count"], 1)

        self.authenticate(self.admin)
        created_crop = self.client.post(
            reverse("crop-catalogue-list"),
            {
                "code": "GRAM",
                "name": "Gram",
                "name_hi": "चना",
                "category": "PULSE",
            },
            format="json",
        )
        self.assertEqual(created_crop.status_code, status.HTTP_201_CREATED)

    def test_operational_records_are_archived_instead_of_deleted(self):
        self.authenticate(self.farmer)
        crop_delete = self.client.delete(
            reverse("farmer-crop-detail", kwargs={"pk": self.farmer_crop.id})
        )
        self.assertEqual(crop_delete.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertTrue(FarmerCrop.objects.filter(pk=self.farmer_crop.id).exists())

        self.authenticate(self.admin)
        catalogue_delete = self.client.delete(
            reverse("crop-catalogue-detail", kwargs={"pk": self.crop.id})
        )
        self.assertEqual(catalogue_delete.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertTrue(CropCatalogue.objects.filter(pk=self.crop.id).exists())

    def test_dashboard_summary_contains_only_role_relevant_totals(self):
        self.authenticate(self.farmer)
        farmer_summary = self.client.get(reverse("dashboard-summary"))
        self.assertEqual(farmer_summary.status_code, status.HTTP_200_OK)
        self.assertEqual(farmer_summary.data["registered_crops"], 1)
        self.assertEqual(farmer_summary.data["available_quantity_kg"], Decimal("2500.00"))

        self.authenticate(self.officer)
        officer_summary = self.client.get(reverse("dashboard-summary"))
        self.assertTrue(officer_summary.data["center_assigned"])
        self.assertNotIn("registered_farmers", officer_summary.data)
