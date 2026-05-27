import os
import django
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from django.urls import re_path
from chat.consumers import ResearchChatConsumer 

django_asgi_app = get_asgi_application()

websocket_urlpatterns = [
    re_path(r'ws/chat/(?P<room_id>\d+)/$', ResearchChatConsumer.as_view()),
]

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(
        URLRouter(
            websocket_urlpatterns
        )
    ),
})