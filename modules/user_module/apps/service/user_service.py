from django.contrib.auth import authenticate
from apps.repositories.user_repository import UserRepository
from apps.utils.jwt_utils import generate_token_pair, generate_access_token, decode_token
from apps.exceptions.user_exceptions import (
    InvalidCredentialsException,
    UserAlreadyExistsException,
    InvalidTokenException,
)


def _serialize_user(user) -> dict:
    return {
        "id": str(user.id),
        "username": user.username,
        "email": user.email,
        "fullname": user.fullname,
    }


class UserService:

    @staticmethod
    def register(fullname: str, username: str, email: str, password: str) -> dict:
        if UserRepository.exists_by_username(username):
            raise UserAlreadyExistsException("kullanıcı adı")

        if UserRepository.exists_by_email(email):
            raise UserAlreadyExistsException("e-posta")

        user = UserRepository.create(fullname, username, email, password)
        if not user:
            raise InvalidCredentialsException()

        return {"user": _serialize_user(user), **generate_token_pair(user)}

    @staticmethod
    def login(identifier: str, password: str) -> dict:
        user = authenticate(username=identifier, password=password)
        if not user:
            raise InvalidCredentialsException()

        return {"user": _serialize_user(user), **generate_token_pair(user)}

    @staticmethod
    def refresh(refresh_token: str) -> dict:
        payload = decode_token(refresh_token)

        if payload.get("type") != "refresh":
            raise InvalidTokenException()

        user = UserRepository.get_by_id(payload["user_id"])
        if not user:
            raise InvalidTokenException()

        return {"access_token": generate_access_token(user)}
    
    @staticmethod
    def verify(token: str) -> dict:
        payload = decode_token(token)
        if not payload or payload.get("type") != "access":
            raise InvalidTokenException()

        user = UserRepository.get_by_id(payload["user_id"])
        if not user:
            raise InvalidTokenException()

        return {"valid": True, "user_id": user.id}
