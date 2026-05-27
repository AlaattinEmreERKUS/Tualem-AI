from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.contrib import messages

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from apps.models import CustomUser
from apps.service.user_service import UserService
from apps.serializers.user_serializers import (
    RegisterSerializer,
    LoginSerializer,
    RefreshTokenSerializer,
)
from apps.exceptions.user_exceptions import (
    UserBaseException,
    InvalidCredentialsException,
    UserAlreadyExistsException,
    TokenExpiredException,
    InvalidTokenException,
)


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

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        try:
            result = UserService.register(
                fullname=data["fullname"],
                username=data["username"],
                email=data["email"],
                password=data["password"],
            )
            return Response(result, status=status.HTTP_201_CREATED)
        except UserAlreadyExistsException as e:
            return Response({"error": e.message}, status=status.HTTP_409_CONFLICT)
        except UserBaseException as e:
            return Response({"error": e.message}, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):

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


class RefreshTokenView(APIView):

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