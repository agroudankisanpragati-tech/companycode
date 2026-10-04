from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import User


class Command(BaseCommand):
    help = "Create or update one development user for each DAPP role."

    def add_arguments(self, parser):
        parser.add_argument("--password", required=True, help="Password assigned to all demo accounts.")

    def handle(self, *args, **options):
        password = options["password"]
        if len(password) < 8:
            raise CommandError("The demo password must contain at least 8 characters.")

        users = (
            ("farmer@dapp.local", "Demo", "Farmer", User.Role.FARMER),
            ("officer@dapp.local", "Demo", "Officer", User.Role.PROCUREMENT_OFFICER),
            ("admin@dapp.local", "Demo", "Administrator", User.Role.ADMIN),
        )

        for email, first_name, last_name, role in users:
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "first_name": first_name,
                    "last_name": last_name,
                    "role": role,
                    "is_verified": True,
                },
            )
            user.first_name = first_name
            user.last_name = last_name
            user.role = role
            user.is_verified = True
            user.is_staff = role == User.Role.ADMIN
            user.is_superuser = role == User.Role.ADMIN
            user.set_password(password)
            user.save()
            action = "Created" if created else "Updated"
            self.stdout.write(self.style.SUCCESS(f"{action} {email} ({role})"))
