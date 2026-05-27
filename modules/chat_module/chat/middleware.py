import jwt
from django.conf import settings
from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser

class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        query_string = scope.get("query_string", b"").decode("utf-8")
        query_params = dict(qp.split("=") for qp in query_string.split("&") if "=" in qp)
        token = query_params.get("token")

        if token:
            try:
                payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
                
                scope["user_id"] = payload.get("user_id")
            except (jwt.ExpiredSignatureError, jwt.DecodeError):
                scope["user_id"] = None
        else:
            scope["user_id"] = None

        return await super().__call__(scope, receive, send)