from django.contrib.auth.models import AbstractUser
from django.db import models

class CustomUser(AbstractUser):
    fullname = models.CharField(max_length=255, verbose_name="Ad Soyad")
    
    email = models.EmailField(unique=True, verbose_name="E-posta Adresi")

    profile_photo = models.ImageField(upload_to='avatars/', null=True, blank=True)

    def __str__(self):
        return f"{self.fullname} ({self.username})"