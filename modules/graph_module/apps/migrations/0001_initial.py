import uuid
import django.db.models.deletion
import pgvector.django.vector
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='Document',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('user_id', models.UUIDField()),
                ('file_name', models.CharField(max_length=300)),
                ('file_type', models.CharField(max_length=300)),
                ('file', models.FileField(upload_to='documents/')),
                ('uploaded_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('status', models.CharField(
                    choices=[
                        ('pending', 'Pending'),
                        ('processing', 'Processing'),
                        ('completed', 'Completed'),
                        ('failed', 'Failed'),
                    ],
                    default='pending',
                    max_length=20,
                )),
            ],
        ),
        migrations.CreateModel(
            name='ContentChunk',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('content', models.TextField()),
                ('chunk_index', models.IntegerField()),
                ('embedding', pgvector.django.vector.VectorField(blank=True, dimensions=384, null=True)),
                ('is_embedded', models.BooleanField(default=False)),
                ('document', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='chunks',
                    to='graph.document',
                )),
            ],
        ),
        migrations.CreateModel(
            name='GraphTask',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('current_step', models.CharField(
                    choices=[
                        ('text_extraction', 'Metin Çıkarma'),
                        ('chunking', 'Parçalama'),
                        ('entity_extraction', 'Entity Çıkarma'),
                        ('neo4j_write', "Neo4j'e Yazma"),
                        ('vector_write', 'Vektöre Yazma'),
                        ('completed', 'Tamamlandı'),
                        ('failed', 'Başarısız'),
                    ],
                    default='text_extraction',
                    max_length=50,
                )),
                ('error_message', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('document', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='tasks',
                    to='graph.document',
                )),
            ],
        ),
    ]
