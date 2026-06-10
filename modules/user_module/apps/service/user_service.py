from django.contrib.auth import authenticate
from django.contrib.auth.models import update_last_login
from apps.repositories.user_repository import UserRepository
from apps.utils.jwt_utils import generate_token_pair, generate_access_token, decode_token
from apps.utils.token_blacklist import is_blacklisted
from apps.utils import verification
from apps.utils.email_service import send_verification_email
from apps.exceptions.user_exceptions import (
    InvalidCredentialsException,
    UserAlreadyExistsException,
    InvalidTokenException,
    InvalidVerificationCodeException,
    ResendCooldownException,
    UserBaseException,
)


def _serialize_user(user) -> dict:
    return {
        "id": str(user.id),
        "username": user.username,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "fullname": user.fullname,
    }


class UserService:

    @staticmethod
    def register(first_name: str, last_name: str, username: str, email: str, password: str) -> dict:
        # --- E-posta doğrulama (domain hazır olunca aç) ---
        # inactive = UserRepository.get_inactive_by_email(email)
        # if inactive:
        #     if not verification.can_resend(email):
        #         raise ResendCooldownException()
        #     code = verification.generate_code()
        #     verification.store_code(email, code)
        #     verification.mark_resend(email)
        #     send_verification_email(email, code)
        #     return {"requires_verification": True, "email": email}

        if UserRepository.username_taken(username):
            raise UserAlreadyExistsException("kullanıcı adı")

        if UserRepository.exists_by_email(email) or UserRepository.get_inactive_by_email(email):
            raise UserAlreadyExistsException("e-posta")

        # E-posta doğrulama kapalıyken direkt aktif oluştur
        user = UserRepository.create(first_name, last_name, username, email, password, is_active=True)
        if not user:
            raise InvalidCredentialsException()

        # --- Doğrulama kodu gönderimi (domain hazır olunca aç) ---
        # code = verification.generate_code()
        # verification.store_code(email, code)
        # verification.mark_resend(email)
        # send_verification_email(email, code)
        # return {"requires_verification": True, "email": email}

        update_last_login(None, user)
        return {"user": _serialize_user(user), **generate_token_pair(user)}

    @staticmethod
    def verify_email(email: str, code: str) -> dict:
        stored = verification.get_code(email)
        if not stored or stored != code:
            raise InvalidVerificationCodeException()

        UserRepository.activate(email)
        verification.clear_code(email)

        user = UserRepository.get_by_email(email)
        if not user:
            raise InvalidCredentialsException()

        update_last_login(None, user)
        return {"user": _serialize_user(user), **generate_token_pair(user)}

    @staticmethod
    def resend_code(email: str) -> dict:
        user = UserRepository.get_by_email(email)
        if not user or user.is_active:
            # Numaralandırma sızıntısını önle — yine de başarı dön
            return {"detail": "Kod gönderildi."}
        if not verification.can_resend(email):
            raise ResendCooldownException()

        code = verification.generate_code()
        verification.store_code(email, code)
        verification.mark_resend(email)
        send_verification_email(email, code)
        return {"detail": "Kod gönderildi."}

    @staticmethod
    def login(identifier: str, password: str) -> dict:
        user = authenticate(username=identifier, password=password)
        if not user:
            existing = UserRepository.get_by_username(identifier) or UserRepository.get_by_email(identifier)
            if existing and not existing.is_active and existing.check_password(password):
                UserRepository.activate(existing.email)
                existing.is_active = True
                user = existing
            else:
                raise InvalidCredentialsException()

        update_last_login(None, user)
        return {"user": _serialize_user(user), **generate_token_pair(user)}

    @staticmethod
    def refresh(refresh_token: str) -> dict:
        payload = decode_token(refresh_token)

        if payload.get("type") != "refresh":
            raise InvalidTokenException()

        jti = payload.get("jti")
        if jti and is_blacklisted(jti):
            raise InvalidTokenException()

        user = UserRepository.get_by_id(payload["user_id"])
        if not user:
            raise InvalidTokenException()

        return {"access_token": generate_access_token(user)}
    
    @staticmethod
    def get_profile(user_id, request=None) -> dict:
        user = UserRepository.get_by_id(user_id)
        if not user:
            raise InvalidCredentialsException()
        photo_url = None
        if user.profile_photo:
            try:
                photo_url = request.build_absolute_uri(user.profile_photo.url) if request else user.profile_photo.url
            except Exception:
                pass
        return {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "fullname": user.fullname,
            "profile_photo": photo_url,
        }

    @staticmethod
    def update_profile(user_id, first_name=None, last_name=None, username=None, old_password=None, new_password=None, profile_photo=None) -> dict:
        user = UserRepository.get_by_id(user_id)
        if not user:
            raise InvalidCredentialsException()

        if username:
            if UserRepository.username_taken(username, exclude_id=user.id):
                raise UserAlreadyExistsException("kullanıcı adı")
            user.username = username

        if first_name is not None:
            user.first_name = first_name
        if last_name is not None:
            user.last_name = last_name
        if first_name is not None or last_name is not None:
            user.fullname = f"{user.first_name} {user.last_name}".strip()

        if old_password and new_password:
            if not user.check_password(old_password):
                raise UserBaseException("Mevcut şifre yanlış.")
            user.set_password(new_password)

        if profile_photo:
            user.profile_photo = profile_photo

        UserRepository.save(user)
        return {"detail": "Profil güncellendi."}

    @staticmethod
    def verify(token: str) -> dict:
        payload = decode_token(token)
        if not payload or payload.get("type") != "access":
            raise InvalidTokenException()

        user = UserRepository.get_by_id(payload["user_id"])
        if not user:
            raise InvalidTokenException()

        return {"valid": True, "user_id": user.id}
