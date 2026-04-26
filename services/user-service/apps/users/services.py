from .repositories import UserRepository


class UserService:
    def __init__(self):
        self.repo = UserRepository()

    def get_profile(self, user_id: int):
        pass

    def update_profile(self, user_id: int, **kwargs):
        pass
