from rest_framework.throttling import UserRateThrottle


class _JWTUserRateThrottle(UserRateThrottle):
    def get_cache_key(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return None
        user_id = getattr(user, 'id', None) or getattr(user, 'pk', None)
        if not user_id:
            return None
        return self.cache_format % {'scope': self.scope, 'ident': user_id}


class QueryThrottle(_JWTUserRateThrottle):
    scope = 'query'


class UploadThrottle(_JWTUserRateThrottle):
    scope = 'upload'


class LiteratureThrottle(_JWTUserRateThrottle):
    scope = 'literature'
