from django.contrib import admin
from django.urls import path
from apps.views import (
    login_view,
    register_view,
    dashboard_view,
    logout_view,
    RegisterView,
    LoginView,
    RefreshTokenView,
    TokenVerifyView,
)

urlpatterns = [
    path('admin/', admin.site.urls),

    path('login/', login_view, name='login'),
    path('register/', register_view, name='register'),
    path('dashboard/', dashboard_view, name='dashboard'),
    path('logout/', logout_view, name='logout'),

    path('api/auth/register/', RegisterView.as_view()),
    path('api/auth/login/', LoginView.as_view()),
    path('api/auth/refresh/', RefreshTokenView.as_view()),
    path('api/auth/verify/', TokenVerifyView.as_view()),
    
]
