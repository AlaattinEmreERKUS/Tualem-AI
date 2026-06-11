from django.urls import path
from django.http import JsonResponse
from apps.views import (
    DocumentListView,
    DocumentDetailView,
    DocumentTaskStatusView,
    LiteratureSearchView,
    QueryView,
)


def health_check(request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path('health', health_check, name='health'),
    path('api/documents/', DocumentListView.as_view(), name='document-list'),
    path('api/documents/search/', LiteratureSearchView.as_view(), name='document-search'),
    path('api/documents/<uuid:document_id>/', DocumentDetailView.as_view(), name='document-detail'),
    path('api/documents/<uuid:document_id>/status/', DocumentTaskStatusView.as_view(), name='document-status'),
    path('api/query/', QueryView.as_view(), name='query'),
]
