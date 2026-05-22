from django.conf import settings
from shared.jwt_utils import (
    decode_token as _decode_token,
    TokenExpiredError,
    InvalidTokenError,
)
from apps.exceptions.graph_exceptions import GraphBaseException


class AuthenticationException(GraphBaseException):
    def __init__(self, message="Kimlik doğrulama başarısız."):
        super().__init__(message)


def verify_token(token: str) -> dict:
    try:
        payload = _decode_token(token, settings.JWT_SECRET)
        if payload.get("type") != "access":
            raise AuthenticationException("Geçersiz token türü.")
        return payload
    except TokenExpiredError:
        raise AuthenticationException("Oturum süresi doldu.")
    except InvalidTokenError:
        raise AuthenticationException("Geçersiz token.")
