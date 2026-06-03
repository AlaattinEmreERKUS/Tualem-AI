from django.contrib import admin
from django.urls import path
from django.http import JsonResponse
from apps.views import DocumentListView


def health_check(request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path('health', health_check, name='health'),
    path('admin/', admin.site.urls),
    path('api/graph/documents/', DocumentListView.as_view(), name='documents'),
]

