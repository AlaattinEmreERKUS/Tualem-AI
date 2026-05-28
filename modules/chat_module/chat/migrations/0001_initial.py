import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='ChatRoom',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('user_id', models.IntegerField(db_index=True, help_text="İstek atan kullanıcının ID'si")),
                ('title', models.CharField(default='Yeni Araştırma Seansı', max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ['-updated_at'],
            },
        ),
        migrations.CreateModel(
            name='ChatMessage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('role', models.CharField(
                    choices=[
                        ('user', 'Kullanıcı'),
                        ('assistant', 'Yapay Zeka Asistanı'),
                        ('system', 'Sistem'),
                    ],
                    default='user',
                    max_length=10,
                )),
                ('content', models.TextField(help_text='Mesaj metni veya AI yanıtı')),
                ('sources', models.JSONField(blank=True, default=dict, help_text='RAG kaynak döküman referansları')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('room', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='messages',
                    to='chat.chatroom',
                )),
            ],
            options={
                'ordering': ['created_at'],
            },
        ),
    ]
