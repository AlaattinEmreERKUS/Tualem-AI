from django.contrib import admin
from django.urls import path
from apps.views import (
    DocumentListView,
    DocumentDetailView,
    DocumentTaskStatusView,
    DocumentChunkListView,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/documents/', DocumentListView.as_view()),
    path('api/documents/<uuid:document_id>/', DocumentDetailView.as_view()),
    path('api/documents/<uuid:document_id>/status/', DocumentTaskStatusView.as_view()),
    path('api/documents/<uuid:document_id>/chunks/', DocumentChunkListView.as_view()),
]
