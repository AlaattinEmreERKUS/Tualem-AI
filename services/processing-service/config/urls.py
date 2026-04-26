from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/processor/", include("apps.processor.urls")),
    path("api/v1/tasks/", include("apps.tasks.urls")),
]
