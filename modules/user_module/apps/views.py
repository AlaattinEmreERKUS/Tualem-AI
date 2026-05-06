from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.contrib import messages
from .models import CustomUser

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
        
        # Sisteme yanlış bir kayıt gerçekleştdiğinde sayfa yeniden render'landığı için tekrar her şeyin doldurulması gerekiyor. Render sisteminin düzeltilmesi gerekiyor.
        
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