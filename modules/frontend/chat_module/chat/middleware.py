from channels.middleware import BaseMiddleware


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        scope["user_id"] = None
        scope["token"] = None
        return await super().__call__(scope, receive, send)
