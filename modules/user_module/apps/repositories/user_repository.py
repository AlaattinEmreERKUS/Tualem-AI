from apps.models import CustomUser


class UserRepository:

    @staticmethod
    def get_by_id(user_id):
        try:
            return CustomUser.objects.filter(id=user_id).first()
        except Exception:
            return None

    @staticmethod
    def get_by_username(username: str):
        try:
            return CustomUser.objects.filter(username=username).first()
        except Exception:
            return None

    @staticmethod
    def get_by_email(email: str):
        try:
            return CustomUser.objects.filter(email=email).first()
        except Exception:
            return None

    @staticmethod
    def exists_by_username(username: str) -> bool:
        try:
            return CustomUser.objects.filter(username=username).exists()
        except Exception:
            return False

    @staticmethod
    def exists_by_email(email: str) -> bool:
        try:
            return CustomUser.objects.filter(email=email).exists()
        except Exception:
            return False

    @staticmethod
    def save(user) -> bool:
        try:
            user.save()
            return True
        except Exception:
            return False

    @staticmethod
    def username_taken(username: str, exclude_id=None) -> bool:
        try:
            qs = CustomUser.objects.filter(username=username)
            if exclude_id:
                qs = qs.exclude(id=exclude_id)
            return qs.exists()
        except Exception:
            return False

    @staticmethod
    def create(fullname: str, username: str, email: str, password: str):
        try:
            user = CustomUser.objects.create_user(
                username=username,
                email=email,
                password=password,
            )
            user.fullname = fullname
            user.save()
            return user
        except Exception:
            return None
