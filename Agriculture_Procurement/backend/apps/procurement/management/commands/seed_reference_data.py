from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import FarmerProfile, User
from apps.procurement.models import CropCatalogue, OfficerAssignment, ProcurementCenter


class Command(BaseCommand):
    help = "Create a small, clearly labelled development catalogue and centre dataset."

    @transaction.atomic
    def handle(self, *args, **options):
        crops = (
            ("PADDY", "Paddy", "धान", CropCatalogue.Category.CEREAL),
            ("WHEAT", "Wheat", "गेहूँ", CropCatalogue.Category.CEREAL),
            ("MAIZE", "Maize", "मक्का", CropCatalogue.Category.CEREAL),
            ("GRAM", "Gram", "चना", CropCatalogue.Category.PULSE),
            ("MUSTARD", "Mustard", "सरसों", CropCatalogue.Category.OILSEED),
            ("SOYBEAN", "Soybean", "सोयाबीन", CropCatalogue.Category.OILSEED),
        )
        for code, name, name_hi, category in crops:
            CropCatalogue.objects.update_or_create(
                code=code,
                defaults={
                    "name": name,
                    "name_hi": name_hi,
                    "category": category,
                    "is_active": True,
                },
            )

        administrator = User.objects.filter(role=User.Role.ADMIN).first()
        center, _ = ProcurementCenter.objects.update_or_create(
            code="DEMO-DURG-01",
            defaults={
                "name": "Demo Durg Procurement Centre",
                "center_type": ProcurementCenter.CenterType.PACS,
                "address_line": "Demonstration address",
                "village_or_city": "Durg",
                "district": "Durg",
                "state": "Chhattisgarh",
                "pincode": "491001",
                "daily_capacity_kg": Decimal("50000.00"),
                "is_active": True,
                "created_by": administrator,
            },
        )

        farmer = User.objects.filter(email="farmer@dapp.local", role=User.Role.FARMER).first()
        if farmer:
            FarmerProfile.objects.update_or_create(
                user=farmer,
                defaults={
                    "village": "Demo Village",
                    "gram_panchayat": "Demo Panchayat",
                    "block": "Durg",
                    "district": "Durg",
                    "state": "Chhattisgarh",
                    "pincode": "491001",
                    "land_area_acres": Decimal("3.50"),
                },
            )

        officer = User.objects.filter(
            email="officer@dapp.local",
            role=User.Role.PROCUREMENT_OFFICER,
        ).first()
        if officer:
            OfficerAssignment.objects.update_or_create(
                officer=officer,
                defaults={
                    "procurement_center": center,
                    "employee_id": "DEMO-OFFICER-01",
                    "is_active": True,
                    "assigned_by": administrator,
                },
            )

        self.stdout.write(
            self.style.SUCCESS(
                "Reference crops and the clearly labelled demo procurement centre are ready."
            )
        )
