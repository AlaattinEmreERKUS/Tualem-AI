from django.db import models

class ChatRoom(models.Model):

    user_id = models.CharField(max_length=100, db_index=True)
    title = models.CharField(max_length=255, default="Yeni Araştırma Seansı")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"Oda: {self.title} (User: {self.user_id})"


class ChatMessage(models.Model):

    ROLE_CHOICES = [
        ('user', 'Kullanıcı'),
        ('assistant', 'Yapay Zeka Asistanı'),
        ('system', 'Sistem'),
    ]

    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name='messages')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='user')
    content = models.TextField(help_text="Mesaj metni veya AI yanıtı")
    
    sources = models.JSONField(default=dict, blank=True, help_text="RAG kaynak döküman referansları")
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.role}: {self.content[:30]}..."
