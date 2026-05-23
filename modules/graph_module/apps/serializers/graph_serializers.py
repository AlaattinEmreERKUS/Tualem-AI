from rest_framework import serializers
from apps.models import Document, ContentChunk, GraphTask


class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = ['id', 'file_name', 'file_type', 'status', 'uploaded_at', 'updated_at']
        read_only_fields = ['id', 'status', 'uploaded_at', 'updated_at']


class DocumentUploadSerializer(serializers.Serializer):
    file = serializers.FileField()

    def validate_file(self, value):
        allowed_types = ['application/pdf', 'text/plain', 'application/msword',
                         'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
        if value.content_type not in allowed_types:
            raise serializers.ValidationError("Desteklenmeyen dosya türü. PDF, TXT veya DOCX yükleyin.")
        if value.size > 20 * 1024 * 1024:
            raise serializers.ValidationError("Dosya boyutu 20MB'ı geçemez.")
        return value


class ContentChunkSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContentChunk
        fields = ['id', 'chunk_index', 'content', 'is_embedded']
        read_only_fields = ['id', 'chunk_index', 'is_embedded']


class GraphTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = GraphTask
        fields = ['id', 'current_step', 'error_message', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


LLM_PROVIDER_CHOICES = ["groq", "ollama", "openrouter"]


class QueryRequestSerializer(serializers.Serializer):
    question = serializers.CharField(min_length=3, max_length=1000)
    top_k = serializers.IntegerField(min_value=1, max_value=20, default=5)
    provider = serializers.ChoiceField(choices=LLM_PROVIDER_CHOICES, required=False, default="")


class QuerySourceSerializer(serializers.Serializer):
    chunk_index = serializers.IntegerField()
    content = serializers.CharField()
    document_id = serializers.UUIDField()


class QueryResponseSerializer(serializers.Serializer):
    answer = serializers.CharField()
    provider = serializers.CharField()
    sources = QuerySourceSerializer(many=True)
