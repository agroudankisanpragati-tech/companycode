from django.conf import settings
from django.middleware.csrf import get_token
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken, TokenError

from .models import FarmerProfile, User
from .permissions import IsFarmer
from .serializers import (
    FarmerProfileSerializer,
    FarmerRegistrationSerializer,
    LoginSerializer,
    UserSerializer,
)


class CsrfProtectedAPIView(APIView):
    """Apply Django's CSRF check to otherwise sessionless public auth writes."""

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        SessionAuthentication().enforce_csrf(request)


def set_auth_cookies(response: Response, access_token: str, refresh_token: str | None = None) -> None:
    common = {
        "httponly": True,
        "secure": settings.JWT_COOKIE_SECURE,
        "samesite": settings.JWT_COOKIE_SAMESITE,
        "path": "/",
    }
    response.set_cookie(
        settings.JWT_ACCESS_COOKIE,
        access_token,
        max_age=settings.JWT_ACCESS_COOKIE_MAX_AGE,
        **common,
    )
    if refresh_token:
        response.set_cookie(
            settings.JWT_REFRESH_COOKIE,
            refresh_token,
            max_age=settings.JWT_REFRESH_COOKIE_MAX_AGE,
            **common,
        )


def delete_auth_cookies(response: Response) -> None:
    response.delete_cookie(
        settings.JWT_ACCESS_COOKIE,
        path="/",
        samesite=settings.JWT_COOKIE_SAMESITE,
    )
    response.delete_cookie(
        settings.JWT_REFRESH_COOKIE,
        path="/",
        samesite=settings.JWT_COOKIE_SAMESITE,
    )


def authenticated_response(user: User, response_status: int = status.HTTP_200_OK) -> Response:
    refresh = RefreshToken.for_user(user)
    response = Response(UserSerializer(user).data, status=response_status)
    set_auth_cookies(response, str(refresh.access_token), str(refresh))
    return response


class CsrfTokenView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"csrf_token": get_token(request)})


class RegisterView(CsrfProtectedAPIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = FarmerRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return authenticated_response(user, status.HTTP_201_CREATED)


class LoginView(CsrfProtectedAPIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        return authenticated_response(serializer.validated_data["user"])


class RefreshView(CsrfProtectedAPIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.COOKIES.get(settings.JWT_REFRESH_COOKIE)
        if not refresh_token:
            return Response(
                {"detail": "Authentication required."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        serializer = TokenRefreshSerializer(data={"refresh": refresh_token})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError:
            response = Response(
                {"detail": "Your session has expired. Please sign in again."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
            delete_auth_cookies(response)
            return response

        response = Response({"detail": "Session refreshed."})
        set_auth_cookies(
            response,
            serializer.validated_data["access"],
            serializer.validated_data.get("refresh"),
        )
        return response


class LogoutView(CsrfProtectedAPIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.COOKIES.get(settings.JWT_REFRESH_COOKIE)
        if refresh_token:
            try:
                RefreshToken(refresh_token).blacklist()
            except TokenError:
                pass

        response = Response(status=status.HTTP_204_NO_CONTENT)
        delete_auth_cookies(response)
        return response


class MeView(RetrieveUpdateAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class FarmerProfileView(RetrieveUpdateAPIView):
    serializer_class = FarmerProfileSerializer
    permission_classes = [IsFarmer]

    def get_object(self):
        profile, _ = FarmerProfile.objects.get_or_create(user=self.request.user)
        return profile
