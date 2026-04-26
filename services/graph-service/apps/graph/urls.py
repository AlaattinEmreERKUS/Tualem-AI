from django.urls import path
from .views import IngestConceptsView, UserGraphView, GraphSearchView

urlpatterns = [
    path("ingest/", IngestConceptsView.as_view(), name="graph-ingest"),
    path("", UserGraphView.as_view(), name="user-graph"),
    path("search/", GraphSearchView.as_view(), name="graph-search"),
]
