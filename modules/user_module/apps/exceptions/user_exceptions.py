class UserBaseException(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(self.message)


# --- Auth ---

class InvalidCredentialsException(UserBaseException):
    def __init__(self):
        super().__init__("Kullanıcı adı veya şifre hatalı.")

class UserAlreadyExistsException(UserBaseException):
    def __init__(self, field: str = ""):
        msg = f"Bu {field} zaten kullanımda." if field else "Kullanıcı zaten mevcut."
        super().__init__(msg)

class UserNotFoundException(UserBaseException):
    def __init__(self):
        super().__init__("Kullanıcı bulunamadı.")


# --- Token ---

class TokenExpiredException(UserBaseException):
    def __init__(self):
        super().__init__("Oturum süresi doldu, tekrar giriş yapın.")

class InvalidTokenException(UserBaseException):
    def __init__(self):
        super().__init__("Geçersiz token.")


# --- E-posta doğrulama ---

class EmailNotVerifiedException(UserBaseException):
    def __init__(self):
        super().__init__("E-posta adresiniz doğrulanmamış. Lütfen e-postanızı doğrulayın.")

class InvalidVerificationCodeException(UserBaseException):
    def __init__(self):
        super().__init__("Doğrulama kodu hatalı veya süresi dolmuş.")

class ResendCooldownException(UserBaseException):
    def __init__(self):
        super().__init__("Çok sık kod talep ediyorsunuz. Lütfen biraz bekleyin.")


# --- Password ---

class PasswordMismatchException(UserBaseException):
    def __init__(self):
        super().__init__("Şifreler eşleşmiyor.")

class WeakPasswordException(UserBaseException):
    def __init__(self, detail: str = ""):
        msg = f"Şifre çok zayıf: {detail}" if detail else "Şifre güvenlik gereksinimlerini karşılamıyor."
        super().__init__(msg)
