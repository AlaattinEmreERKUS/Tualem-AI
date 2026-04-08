from django.shortcuts import render, redirect
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login, logout


def register_view(request):
    if request.method == "POST":
        fullname = request.POST.get("fullname")
        username = request.POST.get("username")
        email = request.POST.get("email")
        password = request.POST.get("password")
        confirm_password = request.POST.get("confirm_password")

        if password != confirm_password:
            return render(request, "users/register.html", {
                "error": "Şifreler eşleşmiyor."
            })

        if User.objects.filter(username=username).exists():
            return render(request, "users/register.html", {
                "error": "Bu kullanıcı adı zaten kayıtlı."
            })

        if User.objects.filter(email=email).exists():
            return render(request, "users/register.html", {
                "error": "Bu email zaten kullanımda."
            })

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password
        )

        user.first_name = fullname
        user.save()

        return redirect("/login/")

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
            return render(request, "users/login.html", {
                "error": "Kullanıcı adı veya şifre hatalı."
            })

    return render(request, "users/login.html")


def dashboard_view(request):
    if not request.user.is_authenticated:
        return redirect("/login/")

    return render(request, "users/dashboard.html")


def logout_view(request):
    logout(request)
    return redirect("/login/")
