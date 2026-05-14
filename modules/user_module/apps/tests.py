from django.test import TestCase
from django.urls import reverse
from django.core.exceptions import ValidationError

from .validators import CustomPasswordValidator
from .backends import EmailOrUsernameModelBackend
from .models import CustomUser


# ─── Validator ─────────────────────────────────────────────────────────────────

class CustomPasswordValidatorTest(TestCase):
    def setUp(self):
        self.v = CustomPasswordValidator()

    def test_valid_password_passes(self):
        """Geçerli şifre testi"""
        self.v.validate("ValidPass1@")

    def test_missing_uppercase_raises(self):
        """Büyük harf içermeyen şifre testi"""
        with self.assertRaises(ValidationError) as ctx:
            self.v.validate("validpass1@")
        self.assertIn("büyük harf", ctx.exception.message)

    def test_missing_lowercase_raises(self):        
        """Küçük harf içermeyen şifre testi"""
        with self.assertRaises(ValidationError) as ctx:
            self.v.validate("VALIDPASS1@")
        self.assertIn("küçük harf", ctx.exception.message)

    def test_missing_digit_raises(self):
        """Sayı içermeyen şifre testi"""
        with self.assertRaises(ValidationError) as ctx:
            self.v.validate("ValidPass@")
        self.assertIn("rakam", ctx.exception.message)

    def test_missing_special_char_raises(self):        
        """Özel karakter içermeyen şifre testi"""
        with self.assertRaises(ValidationError) as ctx:
            self.v.validate("ValidPass1")
        self.assertIn("özel karakter", ctx.exception.message)

    def test_get_help_text_returns_nonempty_string(self):        
        """Şifre yardım metninin kontrol testi"""
        text = self.v.get_help_text()
        self.assertIsInstance(text, str)
        self.assertGreater(len(text), 0)

    def test_all_special_chars_accepted(self):
        """Bütün özel karakterlerin geçerliliğinin kontrol testi"""
        for char in "@_!#$%^&*()":
            self.v.validate(f"ValidPass1{char}")


# ─── Auth Backend ──────────────────────────────────────────────────────────────

class EmailOrUsernameBackendTest(TestCase):
    def setUp(self):
        self.backend = EmailOrUsernameModelBackend()
        self.user = CustomUser.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="TestPass1@",
        )

    def test_authenticate_with_username(self):        
        """Kullanıcı ismiyle giriş testi"""
        user = self.backend.authenticate(None, username="testuser", password="TestPass1@")
        self.assertEqual(user, self.user)

    def test_authenticate_with_email(self):        
        """Kullanıcı mailiyle giriş testi"""
        user = self.backend.authenticate(None, username="test@example.com", password="TestPass1@")
        self.assertEqual(user, self.user)

    def test_wrong_password_returns_none(self):     
        """Yanlış şifre ile kullanıcı girişinin geçerli olmadığının testi"""
        user = self.backend.authenticate(None, username="testuser", password="WrongPass1@")
        self.assertIsNone(user)

    def test_nonexistent_user_returns_none(self):     
        """Olmayan hesapla giriş testi"""
        user = self.backend.authenticate(None, username="ghost", password="TestPass1@")
        self.assertIsNone(user)

    def test_inactive_user_returned_by_backend(self):     
        """Aktif olmayan kullanıcı bilgileriyle giriş testi"""
        self.user.is_active = False
        self.user.save()
        user = self.backend.authenticate(None, username="testuser", password="TestPass1@")
        self.assertEqual(user, self.user)


# ─── Register View ─────────────────────────────────────────────────────────────

class RegisterViewTest(TestCase):
    VALID_PAYLOAD = {
        "fullname": "Test User",
        "username": "newuser",
        "email": "new@example.com",
        "password": "TestPass1@",
        "confirm_password": "TestPass1@",
    }

    def test_get_returns_200(self):
        response = self.client.get(reverse("register"))
        self.assertEqual(response.status_code, 200)

    def test_post_valid_redirects_to_login(self):
        """Doğru kayıt yapıldığında giriş sayfasına yönlendirilme testi"""
        response = self.client.post(reverse("register"), self.VALID_PAYLOAD)
        self.assertRedirects(response, reverse("login"))

    def test_post_valid_creates_user(self):
        """Doğru kayıt yapıldığının kontrol testi"""
        self.client.post(reverse("register"), self.VALID_PAYLOAD)
        self.assertTrue(CustomUser.objects.filter(username="newuser").exists())

    def test_post_password_mismatch_returns_200(self):
        """Yanlış şifrenin döndürdüğü http kodunun testi"""
        payload = {**self.VALID_PAYLOAD, "confirm_password": "Different1@"}
        response = self.client.post(reverse("register"), payload)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(CustomUser.objects.filter(username="newuser").exists())

    def test_post_duplicate_username_returns_200(self):
        """Var olan kullanıcı isimlerinin döndürdüğü http kodunun testi"""
        CustomUser.objects.create_user(username="newuser", email="other@example.com", password="x")
        response = self.client.post(reverse("register"), self.VALID_PAYLOAD)
        self.assertEqual(response.status_code, 200)

    def test_post_duplicate_email_returns_200(self):
        """Var olan mail ile kayıt olmanın döndürdüğü http kodunun testi"""
        CustomUser.objects.create_user(username="other", email="new@example.com", password="x")
        response = self.client.post(reverse("register"), self.VALID_PAYLOAD)
        self.assertEqual(response.status_code, 200)

    def test_post_weak_password_returns_200(self):
        """Zayıf şifre ile kayıt olmanın döndürdüğü http kodunun testi"""
        payload = {**self.VALID_PAYLOAD, "password": "weakpass", "confirm_password": "weakpass"}
        response = self.client.post(reverse("register"), payload)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(CustomUser.objects.filter(username="newuser").exists())


# ─── Login View ────────────────────────────────────────────────────────────────

class LoginViewTest(TestCase):
    def setUp(self):
        self.user = CustomUser.objects.create_user(
            username="loginuser",
            email="login@example.com",
            password="TestPass1@",
        )

    def test_get_returns_200(self):
        response = self.client.get(reverse("login"))
        self.assertEqual(response.status_code, 200)

    def test_post_valid_username_redirects_to_dashboard(self):
        """Kullanıcı adı ile doğru girişin dashboarda yönlendirmesinin testi"""
        response = self.client.post(reverse("login"), {
            "username": "loginuser",
            "password": "TestPass1@",
        })
        self.assertRedirects(response, "/dashboard/", fetch_redirect_response=False)

    def test_post_valid_email_redirects_to_dashboard(self):
        """Email ile doğru girişin dashboarda yönlendirmesinin testi"""
        response = self.client.post(reverse("login"), {
            "username": "login@example.com",
            "password": "TestPass1@",
        })
        self.assertRedirects(response, "/dashboard/", fetch_redirect_response=False)

    def test_post_wrong_password_returns_200(self):
        """Yanlış şifrenin döndürdüğü http kodunun testi"""
        response = self.client.post(reverse("login"), {
            "username": "loginuser",
            "password": "WrongPass1@",
        })
        self.assertEqual(response.status_code, 200)

    def test_post_nonexistent_user_returns_200(self):
        """Var olmayan kullanıcı bilgilerinin döndürdüğü http kodunun testi"""
        response = self.client.post(reverse("login"), {
            "username": "nobody",
            "password": "TestPass1@",
        })
        self.assertEqual(response.status_code, 200)


# ─── Dashboard View ────────────────────────────────────────────────────────────

class DashboardViewTest(TestCase):
    def setUp(self):
        self.user = CustomUser.objects.create_user(
            username="dashuser",
            email="dash@example.com",
            password="TestPass1@",
        )

    def test_unauthenticated_redirects_to_login(self):
        """Giriş yapmamış kullanıcının giriş sayfasına geri yönlendirilmesinin testi"""
        response = self.client.get(reverse("dashboard"))
        self.assertRedirects(response, "/login/", fetch_redirect_response=False)

    def test_authenticated_returns_200(self):
        """Giriş yapmış kullanıcının geri döndürdüğü http kodunun testi"""
        self.client.force_login(self.user)
        response = self.client.get(reverse("dashboard"))
        self.assertEqual(response.status_code, 200)


# ─── Logout View ───────────────────────────────────────────────────────────────

class LogoutViewTest(TestCase):
    def setUp(self):
        self.user = CustomUser.objects.create_user(
            username="logoutuser",
            email="logout@example.com",
            password="TestPass1@",
        )

    def test_logout_redirects_to_login(self):
        """Hesaptan çıkış yapmış kullanıcıyı giriş sayfasına yönlendirmesinin kontrol testi"""        
        self.client.force_login(self.user)
        response = self.client.get(reverse("logout"))
        self.assertRedirects(response, "/login/", fetch_redirect_response=False)

    def test_logout_clears_session(self):
        """Çıkış yapmış kullanıcının oturumunun temizlendiğinin testi"""
        self.client.force_login(self.user)
        self.client.get(reverse("logout"))
        dashboard = self.client.get(reverse("dashboard"))
        self.assertRedirects(dashboard, "/login/", fetch_redirect_response=False)
