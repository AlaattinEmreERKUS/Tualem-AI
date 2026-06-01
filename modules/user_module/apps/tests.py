"""
user_module test suite — gerçek senaryo akışları.

Mock edilenler (sadece bunlar):
  - SMTP e-posta gönderimi
  - Redis doğrulama kodu (store/get/clear/can_resend/mark_resend)
  - Redis token blacklist

Geri kalan her şey gerçek: DB, JWT üretimi/doğrulaması, şifre hash'i,
  inactive user kontrolü, serializer validasyonu.
"""

from django.test import TestCase
from django.urls import reverse
from django.core.exceptions import ValidationError
from unittest import mock
from rest_framework.test import APIClient

from .validators import CustomPasswordValidator
from .backends import EmailOrUsernameModelBackend
from .models import CustomUser

# ── URL sabitleri ────────────────────────────────────────────────────────────
REGISTER  = "/api/auth/register/"
LOGIN     = "/api/auth/login/"
VERIFY    = "/api/auth/verify-email/"
RESEND    = "/api/auth/resend-code/"
REFRESH   = "/api/auth/refresh/"
LOGOUT    = "/api/auth/logout/"
PROFILE   = "/api/auth/profile/"


# ── Yardımcı fonksiyonlar ────────────────────────────────────────────────────

def _make_active_user(username="user1", email="user1@example.com", password="TestPass1@"):
    user = CustomUser.objects.create_user(
        username=username, email=email, password=password,
        first_name="Ad", last_name="Soyad",
    )
    user.is_active = True
    user.save()
    return user


def _make_inactive_user(username="inactive1", email="inactive1@example.com", password="TestPass1@"):
    user = CustomUser.objects.create_user(
        username=username, email=email, password=password,
    )
    user.is_active = False
    user.save()
    return user


def _get_token(user):
    """Gerçek access token üretir."""
    from apps.utils.jwt_utils import generate_token_pair
    return generate_token_pair(user)["access_token"]


def _auth(user):
    """Test istemcisine Authorization header ekler."""
    return {"HTTP_AUTHORIZATION": f"Bearer {_get_token(user)}"}


# ── 1. Validator ─────────────────────────────────────────────────────────────

class CustomPasswordValidatorTest(TestCase):
    def setUp(self):
        self.v = CustomPasswordValidator()

    def test_gecerli_sifre_gecilir(self):
        self.v.validate("ValidPass1@")  # exception yoksa geçti

    def test_buyuk_harf_eksik(self):
        with self.assertRaises(ValidationError) as ctx:
            self.v.validate("validpass1@")
        self.assertIn("büyük harf", ctx.exception.message)

    def test_kucuk_harf_eksik(self):
        with self.assertRaises(ValidationError) as ctx:
            self.v.validate("VALIDPASS1@")
        self.assertIn("küçük harf", ctx.exception.message)

    def test_rakam_eksik(self):
        with self.assertRaises(ValidationError) as ctx:
            self.v.validate("ValidPass@")
        self.assertIn("rakam", ctx.exception.message)

    def test_ozel_karakter_eksik(self):
        with self.assertRaises(ValidationError) as ctx:
            self.v.validate("ValidPass1")
        self.assertIn("özel karakter", ctx.exception.message)

    def test_yardim_metni_dolu(self):
        text = self.v.get_help_text()
        self.assertIsInstance(text, str)
        self.assertGreater(len(text), 0)

    def test_tum_ozel_karakterler_kabul_edilir(self):
        for ch in "@_!#$%^&*()":
            self.v.validate(f"ValidPass1{ch}")


# ── 2. Auth Backend ───────────────────────────────────────────────────────────

class EmailOrUsernameBackendTest(TestCase):
    def setUp(self):
        self.backend = EmailOrUsernameModelBackend()
        self.user = _make_active_user()

    def test_username_ile_giris(self):
        user = self.backend.authenticate(None, username="user1", password="TestPass1@")
        self.assertEqual(user, self.user)

    def test_email_ile_giris(self):
        user = self.backend.authenticate(None, username="user1@example.com", password="TestPass1@")
        self.assertEqual(user, self.user)

    def test_yanlis_sifre_none_doner(self):
        user = self.backend.authenticate(None, username="user1", password="YanlisSifre1@")
        self.assertIsNone(user)

    def test_olmayan_kullanici_none_doner(self):
        user = self.backend.authenticate(None, username="hayalet", password="TestPass1@")
        self.assertIsNone(user)

    def test_passive_kullanici_engellenir(self):
        self.user.is_active = False
        self.user.save()
        user = self.backend.authenticate(None, username="user1", password="TestPass1@")
        self.assertIsNone(user)


# ── 3. Template view'ları (legacy) ───────────────────────────────────────────

class RegisterTemplateViewTest(TestCase):
    PAYLOAD = {
        "fullname": "Test User", "username": "tmpl_user",
        "email": "tmpl@example.com", "password": "TestPass1@",
        "confirm_password": "TestPass1@",
    }

    def test_get_200_doner(self):
        self.assertEqual(self.client.get(reverse("register")).status_code, 200)

    def test_basarili_kayit_login_a_yonlendirir(self):
        self.assertRedirects(self.client.post(reverse("register"), self.PAYLOAD), reverse("login"))

    def test_sifre_uyusmuyor_200_doner(self):
        p = {**self.PAYLOAD, "confirm_password": "Farkli1@"}
        self.assertEqual(self.client.post(reverse("register"), p).status_code, 200)
        self.assertFalse(CustomUser.objects.filter(username="tmpl_user").exists())

    def test_zayif_sifre_200_doner(self):
        p = {**self.PAYLOAD, "password": "weak", "confirm_password": "weak"}
        self.assertEqual(self.client.post(reverse("register"), p).status_code, 200)


class LoginTemplateViewTest(TestCase):
    def setUp(self):
        self.user = _make_active_user(username="tmpl_login", email="tmpllogin@example.com")

    def test_get_200_doner(self):
        self.assertEqual(self.client.get(reverse("login")).status_code, 200)

    def test_dogru_giris_dashboard_a_yonlendirir(self):
        res = self.client.post(reverse("login"), {"username": "tmpl_login", "password": "TestPass1@"})
        self.assertRedirects(res, "/dashboard/", fetch_redirect_response=False)

    def test_yanlis_sifre_200_doner(self):
        res = self.client.post(reverse("login"), {"username": "tmpl_login", "password": "Yanlis1@"})
        self.assertEqual(res.status_code, 200)


# ── 4. API: Tam kayıt → doğrulama → giriş → profil akışı ────────────────────

class RegistrationAndLoginFlowTest(TestCase):
    """
    Senaryo:
      1. Kayıt → kullanıcı pasif oluşur, doğrulama kodu üretilir
      2. Pasif kullanıcı login'e çalışır → 403 + requires_verification
      3. Yanlış kod → 400
      4. Doğru kod → kullanıcı aktif, access token alır
      5. Token ile profile erişilir → 200
      6. Logout → token blacklist'e eklenir
    """

    REGISTER_PAYLOAD = {
        "first_name": "Emre", "last_name": "Test",
        "username": "emretest", "email": "emre@flow.com",
        "password": "TestPass1@",
    }

    def setUp(self):
        self.client = APIClient()
        self._verification_code = "847291"  # sabit test kodu

    @mock.patch("apps.utils.email_service.send_verification_email")
    @mock.patch("apps.utils.verification.mark_resend")
    @mock.patch("apps.utils.verification.can_resend", return_value=True)
    @mock.patch("apps.utils.verification.store_code")
    def test_tam_kayit_ve_giris_akisi(self, m_store, m_can, m_mark, m_email):
        # 1. Kayıt
        res = self.client.post(REGISTER, self.REGISTER_PAYLOAD, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertTrue(res.json()["requires_verification"])
        m_email.assert_called_once()

        # 2. Kullanıcı DB'de pasif oluştu
        user = CustomUser.objects.get(email="emre@flow.com")
        self.assertFalse(user.is_active)

        # 3. Pasif kullanıcı login edemez
        res = self.client.post(LOGIN, {"identifier": "emretest", "password": "TestPass1@"}, format="json")
        self.assertEqual(res.status_code, 403)
        self.assertTrue(res.json().get("requires_verification"))

        # 4. Yanlış kodla doğrulama başarısız
        with mock.patch("apps.utils.verification.get_code", return_value=self._verification_code):
            res = self.client.post(VERIFY, {"email": "emre@flow.com", "code": "000000"}, format="json")
        self.assertEqual(res.status_code, 400)

        # 5. Doğru kodla doğrulama
        with mock.patch("apps.utils.verification.get_code", return_value=self._verification_code), \
             mock.patch("apps.utils.verification.clear_code"):
            res = self.client.post(VERIFY, {"email": "emre@flow.com", "code": self._verification_code}, format="json")
        self.assertEqual(res.status_code, 200)
        access_token = res.json().get("access_token")
        self.assertIsNotNone(access_token)

        # 6. Kullanıcı artık aktif
        user.refresh_from_db()
        self.assertTrue(user.is_active)

        # 7. Token ile profil erişimi
        with mock.patch("apps.utils.token_blacklist.is_blacklisted", return_value=False):
            res = self.client.get(PROFILE, HTTP_AUTHORIZATION=f"Bearer {access_token}")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["email"], "emre@flow.com")

        # 8. Aktif kullanıcı artık login olabilir
        res = self.client.post(LOGIN, {"identifier": "emretest", "password": "TestPass1@"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertIn("access_token", res.json())


# ── 5. API: Kayıt edge case'leri ─────────────────────────────────────────────

class RegisterAPIEdgeCasesTest(TestCase):
    VALID = {
        "first_name": "Ad", "last_name": "Soyad",
        "username": "edgeuser", "email": "edge@example.com",
        "password": "TestPass1@",
    }

    def setUp(self):
        self.client = APIClient()
        self._patches = [
            mock.patch("apps.utils.verification.store_code"),
            mock.patch("apps.utils.verification.mark_resend"),
            mock.patch("apps.utils.verification.can_resend", return_value=True),
            mock.patch("apps.utils.email_service.send_verification_email"),
        ]
        for p in self._patches:
            p.start()

    def tearDown(self):
        for p in self._patches:
            p.stop()

    def test_aktif_email_ile_kayit_409(self):
        _make_active_user(username="baska", email="edge@example.com")
        res = self.client.post(REGISTER, self.VALID, format="json")
        self.assertEqual(res.status_code, 409)

    def test_aktif_username_ile_kayit_409(self):
        _make_active_user(username="edgeuser", email="baska@example.com")
        res = self.client.post(REGISTER, self.VALID, format="json")
        self.assertEqual(res.status_code, 409)

    def test_pasif_email_ile_kayit_yeni_kullanici_olusturmaz(self):
        """Doğrulanmamış hesap varsa → yeni kullanıcı oluşturmadan kod gönderir."""
        _make_inactive_user(username="baska2", email="edge@example.com")
        onceki_sayi = CustomUser.objects.count()
        res = self.client.post(REGISTER, self.VALID, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(CustomUser.objects.count(), onceki_sayi)  # yeni kullanıcı YOK

    def test_zayif_sifre_400(self):
        res = self.client.post(REGISTER, {**self.VALID, "password": "kisa"}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_eksik_alan_400(self):
        res = self.client.post(REGISTER, {"username": "sadece"}, format="json")
        self.assertEqual(res.status_code, 400)


# ── 6. API: Kimlik doğrulama güvenliği ───────────────────────────────────────

class AuthSecurityTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = _make_active_user()

    def test_token_olmadan_profile_403(self):
        res = self.client.get(PROFILE)
        self.assertIn(res.status_code, [401, 403])

    def test_gecersiz_token_ile_profile_403(self):
        res = self.client.get(PROFILE, HTTP_AUTHORIZATION="Bearer bu.gecersiz.token")
        self.assertIn(res.status_code, [401, 403])

    def test_blacklisted_token_ile_profile_403(self):
        with mock.patch("apps.utils.token_blacklist.is_blacklisted", return_value=True):
            res = self.client.get(PROFILE, HTTP_AUTHORIZATION=f"Bearer {_get_token(self.user)}")
        self.assertIn(res.status_code, [401, 403])

    def test_gecerli_token_ile_profile_200(self):
        with mock.patch("apps.utils.token_blacklist.is_blacklisted", return_value=False):
            res = self.client.get(PROFILE, **_auth(self.user))
        self.assertEqual(res.status_code, 200)


# ── 7. API: Profil güncelleme ─────────────────────────────────────────────────

class ProfileUpdateTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = _make_active_user()
        self._bl = mock.patch("apps.utils.token_blacklist.is_blacklisted", return_value=False)
        self._bl.start()

    def tearDown(self):
        self._bl.stop()

    def test_username_guncellenir(self):
        res = self.client.patch(PROFILE, {"username": "yeniisim"}, format="json", **_auth(self.user))
        self.assertEqual(res.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, "yeniisim")

    def test_dolu_username_cakisma_409(self):
        _make_active_user(username="mesgul", email="mesgul@example.com")
        res = self.client.patch(PROFILE, {"username": "mesgul"}, format="json", **_auth(self.user))
        self.assertEqual(res.status_code, 409)

    def test_sifre_degisimi_eski_sifre_yanlis_400(self):
        res = self.client.patch(
            PROFILE,
            {"old_password": "YanlisSifre1@", "new_password": "YeniSifre1@"},
            format="json", **_auth(self.user),
        )
        self.assertEqual(res.status_code, 400)

    def test_sifre_degisimi_basarili_eski_sifre_ile_login_edilemez(self):
        self.client.patch(
            PROFILE,
            {"old_password": "TestPass1@", "new_password": "YeniSifre1@"},
            format="json", **_auth(self.user),
        )
        # Eski şifre artık çalışmıyor
        res = self.client.post(LOGIN, {"identifier": "user1", "password": "TestPass1@"}, format="json")
        self.assertEqual(res.status_code, 401)
        # Yeni şifre çalışıyor
        res = self.client.post(LOGIN, {"identifier": "user1", "password": "YeniSifre1@"}, format="json")
        self.assertEqual(res.status_code, 200)


# ── 8. API: Token yenileme ────────────────────────────────────────────────────

class RefreshTokenTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = _make_active_user()

    def test_gecerli_refresh_token_yeni_access_token_uretir(self):
        from apps.utils.jwt_utils import generate_token_pair
        tokens = generate_token_pair(self.user)
        res = self.client.post(REFRESH, {"refresh_token": tokens["refresh_token"]}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertIn("access_token", res.json())

    def test_access_token_ile_refresh_401(self):
        """Access token refresh endpoint'inde kabul edilmez (type != refresh)."""
        res = self.client.post(REFRESH, {"refresh_token": _get_token(self.user)}, format="json")
        self.assertEqual(res.status_code, 401)

    def test_bozuk_token_ile_refresh_401(self):
        res = self.client.post(REFRESH, {"refresh_token": "bozuk.token.burada"}, format="json")
        self.assertEqual(res.status_code, 401)


# ── 9. API: Kod yeniden gönderme ──────────────────────────────────────────────

class ResendCodeTest(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_pasif_kullanici_kod_alir(self):
        _make_inactive_user()
        with mock.patch("apps.utils.verification.can_resend", return_value=True), \
             mock.patch("apps.utils.verification.store_code"), \
             mock.patch("apps.utils.verification.mark_resend"), \
             mock.patch("apps.utils.email_service.send_verification_email") as m_mail:
            res = self.client.post(RESEND, {"email": "inactive1@example.com"}, format="json")
        self.assertEqual(res.status_code, 200)
        m_mail.assert_called_once()

    def test_cooldown_aktifse_429(self):
        _make_inactive_user()
        with mock.patch("apps.utils.verification.can_resend", return_value=False):
            res = self.client.post(RESEND, {"email": "inactive1@example.com"}, format="json")
        self.assertEqual(res.status_code, 429)

    def test_aktif_kullaniciya_kod_gonderilmez(self):
        _make_active_user()
        with mock.patch("apps.utils.email_service.send_verification_email") as m_mail:
            res = self.client.post(RESEND, {"email": "user1@example.com"}, format="json")
        self.assertEqual(res.status_code, 200)
        m_mail.assert_not_called()
