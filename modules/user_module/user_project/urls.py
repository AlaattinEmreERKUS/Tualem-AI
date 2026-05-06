from django.contrib import admin
from django.urls import path
import apps.views 

urlpatterns = [
    path('admin/', admin.site.urls),
    path("login/", apps.views.login_view, name="login"),
    path("register/", apps.views.register_view, name="register"),
    path("dashboard/", apps.views.dashboard_view, name="dashboard"),
    path("logout/", apps.views.logout_view, name="logout"),
]