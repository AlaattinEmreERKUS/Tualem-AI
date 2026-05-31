import jwt
import uuid
from datetime import datetime, timezone, timedelta


def generate_access_token(user_id: str, username: str, email: str, secret: str, lifetime_minutes: int) -> str:
    payload = {
        "jti": str(uuid.uuid4()),
        "user_id": user_id,
        "username": username,
        "email": email,
        "type": "access",
        "iat": datetime.now(tz=timezone.utc),
        "exp": datetime.now(tz=timezone.utc) + timedelta(minutes=lifetime_minutes),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def generate_refresh_token(user_id: str, secret: str, lifetime_days: int) -> str:
    payload = {
        "jti": str(uuid.uuid4()),
        "user_id": user_id,
        "type": "refresh",
        "iat": datetime.now(tz=timezone.utc),
        "exp": datetime.now(tz=timezone.utc) + timedelta(days=lifetime_days),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def decode_token(token: str, secret: str) -> dict:
    try:
        return jwt.decode(token, secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise TokenExpiredError()
    except jwt.InvalidTokenError:
        raise InvalidTokenError()


class TokenExpiredError(Exception):
    pass


class InvalidTokenError(Exception):
    pass
