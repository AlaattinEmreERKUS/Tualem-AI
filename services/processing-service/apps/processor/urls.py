from django.urls import path
from .views import TriggerProcessingView

urlpatterns = [
    path("trigger/", TriggerProcessingView.as_view(), name="trigger-processing"),
]
