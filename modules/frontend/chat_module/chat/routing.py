from django.urls import re_path
from .consumers import ResearchChatConsumer

websocket_urlpatterns = [
  re_path(r'^ws/graph/chat/(?P<room_id>\d+)/$', ResearchChatConsumer.as_asgi()),
]