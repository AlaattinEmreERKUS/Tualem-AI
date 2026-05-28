from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from apps.utils.jwt_utils import verify_token
from apps.exceptions.graph_exceptions import GraphBaseException


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
            payload = verify_token(token)
        except GraphBaseException as e:
            raise AuthenticationFailed(e.message)
        return (JWTUser(payload), token)
