import uuid
from django.db import models
from pgvector.django import VectorField

class Document(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.CharField(max_length=100)
    file_name = models.CharField(max_length=300)
    file_type = models.CharField(max_length=300)
    file = models.FileField(upload_to='documents/')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('processing', 'Processing'),
            ('completed', 'Completed'),
            ('failed', 'Failed'),
        ],
        default='pending'
    )
    class Meta:
        app_label = 'apps'

class ContentChunk(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='chunks')
    content = models.TextField()
    chunk_index = models.IntegerField()
    embedding = VectorField(dimensions=384, null=True, blank=True)
    is_embedded = models.BooleanField(default=False)
    class Meta:
        app_label = 'apps'

class GraphTask(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='tasks')
    current_step = models.CharField(
        max_length=50,
        choices=[
            ('text_extraction', 'Metin Çıkarma'),
            ('chunking', 'Parçalama'),
            ('entity_extraction', 'Entity Çıkarma'),
            ('neo4j_write', "Neo4j'e Yazma"),
            ('vector_write', 'Vektöre Yazma'),
            ('completed', 'Tamamlandı'),
            ('failed', 'Başarısız'),
        ],
        default='text_extraction'   
    )
    error_message = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        app_label = 'apps'
