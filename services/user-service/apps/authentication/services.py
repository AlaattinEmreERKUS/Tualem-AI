from .repositories import UserRepository


class AuthService:
    def __init__(self):
        self.repo = UserRepository()

    def register(self, email: str, password: str, **kwargs):
        pass

    def login(self, email: str, password: str):
        pass
