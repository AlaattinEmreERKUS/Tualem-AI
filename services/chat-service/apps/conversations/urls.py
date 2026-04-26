from django.urls import path
from .views import ConversationListCreateView, ConversationDetailView, ChatView

urlpatterns = [
    path("", ConversationListCreateView.as_view(), name="conversation-list-create"),
    path("<int:pk>/", ConversationDetailView.as_view(), name="conversation-detail"),
    path("<int:conv_id>/chat/", ChatView.as_view(), name="chat"),
]
