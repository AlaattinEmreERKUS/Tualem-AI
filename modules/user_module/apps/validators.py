import re
from django.core.exceptions import ValidationError

class CustomPasswordValidator:
    def validate(self, password, user=None):
        if not any(char.isupper() for char in password):
            raise ValidationError("Şifre en az bir büyük harf içermelidir.")
        
        if not any(char.islower() for char in password):
            raise ValidationError("Şifre en az bir küçük harf içermelidir.")
            
        if not any(char.isdigit() for char in password):
            raise ValidationError("Şifre en az bir rakam içermelidir.")

        special_characters = r"[@_!#$%^&*()<>?/\|}{~:]"
        if not any(char in special_characters for char in password):
            raise ValidationError("Şifre en az bir özel karakter içermelidir.")

    def get_help_text(self):
        return "Şifreniz en az bir büyük harf, bir küçük harf, bir rakam ve bir özel karakter içermelidir."