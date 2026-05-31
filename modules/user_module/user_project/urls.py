from django.contrib import admin
from django.urls import path
from django.conf import settings
from django.conf.urls.static import static
from apps.views import (
    login_view,
    register_view,
    dashboard_view,
    logout_view,
    RegisterView,
    LoginView,
    RefreshTokenView,
    TokenVerifyView,
    LogoutView,
    ProfileView,
    VerifyEmailView,
    ResendCodeView,
)

urlpatterns = [
    path('admin/', admin.site.urls),

    path('login/', login_view, name='login'),
    path('register/', register_view, name='register'),
    path('dashboard/', dashboard_view, name='dashboard'),
    path('logout/', logout_view, name='logout'),

    path('api/auth/register/', RegisterView.as_view()),
    path('api/auth/login/', LoginView.as_view()),
    path('api/auth/verify-email/', VerifyEmailView.as_view()),
    path('api/auth/resend-code/', ResendCodeView.as_view()),
    path('api/auth/refresh/', RefreshTokenView.as_view()),
    path('api/auth/verify/', TokenVerifyView.as_view()),
    path('api/auth/logout/', LogoutView.as_view()),
    path('api/auth/profile/', ProfileView.as_view()),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
