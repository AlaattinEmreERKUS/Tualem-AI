from django.contrib import admin
from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenVerifyView
import apps.views

urlpatterns = [
    path('admin/', admin.site.urls),
    path("login/", apps.views.login_view, name="login"),
    path("register/", apps.views.register_view, name="register"),
    path("dashboard/", apps.views.dashboard_view, name="dashboard"),
    path("logout/", apps.views.logout_view, name="logout"),
    path("api/token/", TokenObtainPairView.as_view(), name="token-obtain"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("api/token/verify/", TokenVerifyView.as_view(), name="token-verify"),
]