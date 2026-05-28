from django.conf import settings
from channels.middleware import BaseMiddleware
from shared.jwt_utils import decode_token, TokenExpiredError, InvalidTokenError


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        query_string = scope.get("query_string", b"").decode("utf-8")
        query_params = dict(qp.split("=") for qp in query_string.split("&") if "=" in qp)
        token = query_params.get("token")

        if token:
            try:
                payload = decode_token(token, settings.JWT_SECRET)
                scope["user_id"] = payload.get("user_id")
                scope["token"] = token
            except (TokenExpiredError, InvalidTokenError):
                scope["user_id"] = None
                scope["token"] = None
        else:
            scope["user_id"] = None
            scope["token"] = None

        return await super().__call__(scope, receive, send)