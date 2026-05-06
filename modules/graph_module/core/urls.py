from django.contrib import admin
from django.urls import path
from apps.views import (
    DocumentListView,
    DocumentDetailView,
    ContentChunkListView,
    ContentChunkDetailView,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/documents/', DocumentListView.as_view(), name='document-list'),
    path('api/documents/<str:document_id>/', DocumentDetailView.as_view(), name='document-detail'),
    path('api/documents/<str:document_id>/chunks/', ContentChunkListView.as_view(), name='contentchunk-list'),
    path('api/documents/<str:document_id>/chunks/<str:contentchunk_id>/', ContentChunkDetailView.as_view(), name='contentchunk-detail'),
]
