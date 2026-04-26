from .models import User


class UserRepository:
    def get_by_id(self, user_id: int):
        return User.objects.filter(id=user_id).first()

    def get_by_email(self, email: str):
        return User.objects.filter(email=email).first()

    def update(self, user: User, **kwargs):
        for field, value in kwargs.items():
            setattr(user, field, value)
        user.save()
        return user
