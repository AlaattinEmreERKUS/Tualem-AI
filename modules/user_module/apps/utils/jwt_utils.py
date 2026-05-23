from django.conf import settings
from shared.jwt_utils import (
    generate_access_token as _generate_access_token,
    generate_refresh_token as _generate_refresh_token,
    decode_token as _decode_token,
    TokenExpiredError,
    InvalidTokenError,
)
from apps.exceptions.user_exceptions import TokenExpiredException, InvalidTokenException


def generate_access_token(user) -> str:
    return _generate_access_token(
        user_id=str(user.id),
        username=user.username,
        email=user.email,
        secret=settings.JWT_SECRET,
        lifetime_minutes=settings.JWT_ACCESS_TOKEN_LIFETIME_MINUTES,
    )


def generate_refresh_token(user) -> str:
    return _generate_refresh_token(
        user_id=str(user.id),
        secret=settings.JWT_SECRET,
        lifetime_days=settings.JWT_REFRESH_TOKEN_LIFETIME_DAYS,
    )


def decode_token(token: str) -> dict:
    try:
        return _decode_token(token, settings.JWT_SECRET)
    except TokenExpiredError:
        raise TokenExpiredException()
    except InvalidTokenError:
        raise InvalidTokenException()


def generate_token_pair(user) -> dict:
    return {
        "access_token": generate_access_token(user),
        "refresh_token": generate_refresh_token(user),
    }
