from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken


class UserProxy:
    """Lightweight user proxy — holds user_id from JWT without DB lookup."""
    is_authenticated = True

    def __init__(self, user_id: int):
        self.id = user_id
        self.pk = user_id


class RemoteJWTAuthentication(JWTAuthentication):
    """Validates JWT issued by user-service without requiring a local User table.
    SECRET_KEY must match user-service's SECRET_KEY for signature verification."""

    def get_user(self, validated_token):
        try:
            user_id = validated_token["user_id"]
        except KeyError:
            raise InvalidToken("Token has no user_id claim")
        return UserProxy(user_id)
