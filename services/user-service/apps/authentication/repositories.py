from django.contrib.auth import get_user_model

User = get_user_model()


class UserRepository:
    def get_by_email(self, email: str):
        return User.objects.filter(email=email).first()

    def create(self, **kwargs):
        return User.objects.create_user(**kwargs)
