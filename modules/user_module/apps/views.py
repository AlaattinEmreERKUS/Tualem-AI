import logging
from django.shortcuts import render, redirect

logger = logging.getLogger('user_module')
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.contrib import messages

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

from apps.models import CustomUser
from apps.service.user_service import UserService
from apps.serializers.user_serializers import (
    RegisterSerializer,
    LoginSerializer,
    RefreshTokenSerializer,
    ProfileUpdateSerializer,
    VerifyEmailSerializer,
    ResendCodeSerializer,
)
from apps.exceptions.user_exceptions import (
    UserBaseException,
    InvalidCredentialsException,
    UserAlreadyExistsException,
    TokenExpiredException,
    InvalidTokenException,

    InvalidVerificationCodeException,
    ResendCooldownException,
)
from apps.utils.token_blacklist import blacklist_token
from apps.utils.jwt_utils import decode_token as _decode_token
from django.conf import settings as django_settings
import math


# --- Template Views ---

def register_view(request):
    if request.method == "POST":
        fullname = request.POST.get("fullname")
        username = request.POST.get("username")
        email = request.POST.get("email")
        password = request.POST.get("password")
        confirm_password = request.POST.get("confirm_password")

        if password != confirm_password:
            messages.error(request, "Şifreler eşleşmiyor.")
            return render(request, "users/register.html")

        if CustomUser.objects.filter(username=username).exists():
            messages.error(request, "Bu kullanıcı adı zaten kayıtlı.")
            return render(request, "users/register.html")

        if CustomUser.objects.filter(email=email).exists():
            messages.error(request, "Bu email zaten kullanımda.")
            return render(request, "users/register.html")

        try:
            validate_password(password)
            user = CustomUser.objects.create_user(
                username=username,
                email=email,
                password=password,
            )
            user.fullname = fullname
            user.save()
            messages.success(request, "Kayıt başarıyla tamamlandı!")
            return redirect("login")
        except ValidationError as e:
            for error in e.messages:
                messages.error(request, error)
            return render(request, "users/register.html")

    return render(request, "users/register.html")


def login_view(request):
    if request.method == "POST":
        username = request.POST.get("username")
        password = request.POST.get("password")
        user = authenticate(request, username=username, password=password)
        if user is not None:
            login(request, user)
            return redirect("/dashboard/")
        else:
            return render(request, "users/login.html", {"error": "Kullanıcı adı veya şifre hatalı."})
    return render(request, "users/login.html")


def dashboard_view(request):
    if not request.user.is_authenticated:
        return redirect("/login/")
    return render(request, "users/dashboard.html")


def logout_view(request):
    logout(request)
    return redirect("/login/")



class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        try:
            result = UserService.register(
                first_name=data["first_name"],
                last_name=data["last_name"],
                username=data["username"],
                email=data["email"],
                password=data["password"],
            )
            return Response(result, status=status.HTTP_200_OK)
        except UserAlreadyExistsException as e:
            return Response({"error": e.message}, status=status.HTTP_409_CONFLICT)
        except UserBaseException as e:
            return Response({"error": e.message}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error("register unexpected error: %s", e, exc_info=True)
            return Response({"error": "Kayıt işlemi başarısız. Lütfen tekrar deneyin."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        try:
            result = UserService.login(
                identifier=data["identifier"],
                password=data["password"],
            )
            return Response(result, status=status.HTTP_200_OK)
        except InvalidCredentialsException as e:
            return Response({"error": e.message}, status=status.HTTP_401_UNAUTHORIZED)
        except UserBaseException as e:
            return Response({"error": e.message}, status=status.HTTP_400_BAD_REQUEST)


class VerifyEmailView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = VerifyEmailSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data
        try:
            result = UserService.verify_email(email=data["email"], code=data["code"])
            return Response(result, status=status.HTTP_200_OK)
        except InvalidVerificationCodeException as e:
            return Response({"error": e.message}, status=status.HTTP_400_BAD_REQUEST)
        except UserBaseException as e:
            return Response({"error": e.message}, status=status.HTTP_400_BAD_REQUEST)


class ResendCodeView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResendCodeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            result = UserService.resend_code(email=serializer.validated_data["email"])
            return Response(result, status=status.HTTP_200_OK)
        except ResendCooldownException as e:
            return Response({"error": e.message}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        except UserBaseException as e:
            return Response({"error": e.message}, status=status.HTTP_400_BAD_REQUEST)


class RefreshTokenView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RefreshTokenSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = UserService.refresh(
                refresh_token=serializer.validated_data["refresh_token"]
            )
            return Response(result, status=status.HTTP_200_OK)
        except TokenExpiredException as e:
            return Response({"error": e.message}, status=status.HTTP_401_UNAUTHORIZED)
        except InvalidTokenException as e:
            return Response({"error": e.message}, status=status.HTTP_401_UNAUTHORIZED)
        except UserBaseException as e:
            return Response({"error": e.message}, status=status.HTTP_400_BAD_REQUEST)

class TokenVerifyView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.data.get("token")
        if not token:
            return Response({"error": "Token sağlanmadı."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = UserService.verify(token)
            return Response(result, status=status.HTTP_200_OK)
        except InvalidTokenException as e:
            return Response({"valid": False, "error": e.message}, status=status.HTTP_401_UNAUTHORIZED)
        except UserBaseException as e:
            return Response({"valid": False, "error": e.message}, status=status.HTTP_400_BAD_REQUEST)


class ProfileView(APIView):

    def get(self, request):
        try:
            profile = UserService.get_profile(request.user.id, request=request)
            return Response(profile, status=status.HTTP_200_OK)
        except UserBaseException as e:
            return Response({"error": e.message}, status=status.HTTP_404_NOT_FOUND)

    def patch(self, request):
        serializer = ProfileUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data
        try:
            # request.data üzerinden al — PATCH multipart'ta request.FILES güvenilmez
            profile_photo = data.get("profile_photo") or request.FILES.get("profile_photo")
            result = UserService.update_profile(
                user_id=request.user.id,
                first_name=data.get("first_name") or None,
                last_name=data.get("last_name") or None,
                username=data.get("username") or None,
                old_password=data.get("old_password") or None,
                new_password=data.get("new_password") or None,
                profile_photo=profile_photo,
            )
            return Response(result, status=status.HTTP_200_OK)
        except UserAlreadyExistsException as e:
            return Response({"error": e.message}, status=status.HTTP_409_CONFLICT)
        except UserBaseException as e:
            return Response({"error": e.message}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            import logging
            logging.getLogger('django').error("update_profile unexpected: %s", e, exc_info=True)
            return Response({"error": f"Profil güncellenemedi: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class LogoutView(APIView):
    def post(self, request):
        token = request.data.get("token") or request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
        if not token:
            return Response({"error": "Token sağlanmadı."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from shared.jwt_utils import decode_token as _shared_decode
            payload = _shared_decode(token, django_settings.JWT_SECRET)
            jti = payload.get("jti")
            exp = payload.get("exp", 0)
            now = int(__import__("time").time())
            ttl = max(exp - now, 0)
            if jti and ttl > 0:
                blacklist_token(jti, ttl)
        except Exception:
            pass

        return Response({"detail": "Çıkış yapıldı."}, status=status.HTTP_200_OK)