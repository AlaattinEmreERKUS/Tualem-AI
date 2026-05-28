from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.conf import settings
from shared.jwt_utils import decode_token, TokenExpiredError, InvalidTokenError
from shared.token_blacklist import is_blacklisted


class JWTUser:
    def __init__(self, payload: dict):
        self.id = payload.get('user_id')
        self.username = payload.get('username', '')
        self.email = payload.get('email', '')
        self.is_authenticated = True
        self.is_active = True


class JWTAuthentication(BaseAuthentication):
    def authenticate(self, request):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return None
        token = auth_header.split(' ', 1)[1]
        try:
            payload = decode_token(token, settings.JWT_SECRET)
        except TokenExpiredError:
            raise AuthenticationFailed('Token süresi doldu.')
        except InvalidTokenError:
            raise AuthenticationFailed('Geçersiz token.')
        jti = payload.get('jti')
        if jti and is_blacklisted(jti):
            raise AuthenticationFailed('Token geçersiz kılındı.')
        return (JWTUser(payload), token)
