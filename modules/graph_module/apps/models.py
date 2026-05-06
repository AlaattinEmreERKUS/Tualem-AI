import uuid
from django.db import models

class Document(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    file_name = models.CharField(max_length=300)
    file_type = models.CharField(max_length=300)
    file = models.FileField()
    uploaded_at = models.DateTimeField()
    status = models.CharField(max_length=20, choices=[('pending', 'Pending'), ('processing', 'Processing'), ('completed', 'Completed')])

class ContentChunk(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document_id = models.ForeignKey(Document,on_delete=models.CASCADE, related_name='chunks')
    content = models.TextField()

class GraphTask(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document_id = models.ForeignKey(Document, on_delete=models.CASCADE)
    current_step = models.CharField(max_length=50, choices=[
        ('metin_cikarma', 'Metin Çıkarma'),
        ('parcalama', 'Parçalama'),
        ('entity_cikarma', 'Entity Çıkarma'),
        ('neo4j_yazma', "Neo4j'e Yazma"),
    ])