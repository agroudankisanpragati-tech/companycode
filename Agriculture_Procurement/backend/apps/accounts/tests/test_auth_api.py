from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from apps.accounts.models import User


class AuthenticationApiTests(APITestCase):
    registration_payload = {
        "email": "farmer@example.com",
        "first_name": "Asha",
        "last_name": "Verma",
        "phone_number": "9876543210",
        "preferred_language": "hi",
        "password": "StrongPass@123",
        "password_confirm": "StrongPass@123",
    }

    def test_farmer_registration_assigns_safe_role_and_cookies(self):
        payload = {**self.registration_payload, "role": User.Role.ADMIN}

        response = self.client.post(reverse("register"), payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email=self.registration_payload["email"])
        self.assertEqual(user.role, User.Role.FARMER)
        self.assertFalse(user.is_verified)
        self.assertTrue(hasattr(user, "farmer_profile"))
        self.assertFalse(response.data["profile_completed"])
        self.assertIn("dapp_access", response.cookies)
        self.assertIn("dapp_refresh", response.cookies)
        self.assertTrue(response.cookies["dapp_access"]["httponly"])
        self.assertNotIn("password", response.data)

    def test_me_rejects_anonymous_request(self):
        response = self.client.get(reverse("me"))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_me_update_and_logout_flow(self):
        user = User.objects.create_user(
            email="officer@example.com",
            password="StrongPass@123",
            first_name="Procurement",
            role=User.Role.PROCUREMENT_OFFICER,
            is_verified=True,
        )

        login_response = self.client.post(
            reverse("login"),
            {"email": user.email, "password": "StrongPass@123"},
            format="json",
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)

        me_response = self.client.get(reverse("me"))
        self.assertEqual(me_response.status_code, status.HTTP_200_OK)
        self.assertEqual(me_response.data["role"], User.Role.PROCUREMENT_OFFICER)
        self.assertTrue(me_response.data["profile_completed"])

        update_response = self.client.patch(
            reverse("me"),
            {"first_name": "Updated", "role": User.Role.ADMIN},
            format="json",
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertEqual(user.first_name, "Updated")
        self.assertEqual(user.role, User.Role.PROCUREMENT_OFFICER)

        logout_response = self.client.post(reverse("logout"))
        self.assertEqual(logout_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(logout_response.cookies["dapp_access"]["max-age"], 0)

    def test_invalid_login_does_not_issue_cookies(self):
        response = self.client.post(
            reverse("login"),
            {"email": "missing@example.com", "password": "wrong-password"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertNotIn("dapp_access", response.cookies)

    def test_cookie_authentication_requires_csrf_for_unsafe_requests(self):
        user = User.objects.create_user(
            email="csrf.farmer@example.com",
            password="StrongPass@123",
            role=User.Role.FARMER,
        )
        csrf_client = APIClient(enforce_csrf_checks=True)

        rejected_login = csrf_client.post(
            reverse("login"),
            {"email": user.email, "password": "StrongPass@123"},
            format="json",
        )
        self.assertEqual(rejected_login.status_code, status.HTTP_403_FORBIDDEN)

        token_response = csrf_client.get(reverse("csrf-token"))
        csrf_token = token_response.data["csrf_token"]
        login = csrf_client.post(
            reverse("login"),
            {"email": user.email, "password": "StrongPass@123"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK)

        rejected_update = csrf_client.patch(
            reverse("me"),
            {"first_name": "Rejected"},
            format="json",
        )
        self.assertEqual(rejected_update.status_code, status.HTTP_403_FORBIDDEN)

        accepted_update = csrf_client.patch(
            reverse("me"),
            {"first_name": "Protected"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.assertEqual(accepted_update.status_code, status.HTTP_200_OK)

    def test_custom_user_admin_add_form_uses_email_identity(self):
        administrator = User.objects.create_superuser(
            email="system.admin@example.com",
            password="StrongPass@123",
        )
        self.client.force_login(administrator)

        response = self.client.get(reverse("admin:accounts_user_add"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertContains(response, 'name="email"')
        self.assertNotContains(response, 'name="username"')
