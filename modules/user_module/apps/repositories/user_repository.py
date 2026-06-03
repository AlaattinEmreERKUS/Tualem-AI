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
            return CustomUser.objects.filter(username=username, is_active=True).exists()
        except Exception:
            return False

    @staticmethod
    def exists_by_email(email: str) -> bool:
        try:
            return CustomUser.objects.filter(email=email, is_active=True).exists()
        except Exception:
            return False

    @staticmethod
    def get_inactive_by_email(email: str):
        try:
            return CustomUser.objects.filter(email__iexact=email, is_active=False).first()
        except Exception:
            return None

    @staticmethod
    def save(user) -> bool:
        import logging
        try:
            user.save()
            return True
        except Exception as e:
            logging.getLogger('django').error("UserRepository.save failed: %s", e, exc_info=True)
            raise

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
    def create(first_name: str, last_name: str, username: str, email: str, password: str, is_active: bool = True):
        try:
            user = CustomUser.objects.create_user(
                username=username,
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
            )
            user.fullname = f"{first_name} {last_name}".strip()
            user.is_active = is_active
            user.save()
            return user
        except Exception:
            return None

    @staticmethod
    def activate(email: str) -> bool:
        try:
            return CustomUser.objects.filter(email__iexact=email).update(is_active=True) > 0
        except Exception:
            return False
