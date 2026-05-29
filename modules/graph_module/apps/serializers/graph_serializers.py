from pathlib import Path
from rest_framework import serializers
from apps.models import Document, ContentChunk, GraphTask


class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = ['id', 'file_name', 'file_type', 'status', 'uploaded_at', 'updated_at']
        read_only_fields = ['id', 'status', 'uploaded_at', 'updated_at']


_ALLOWED_EXTENSIONS = {'.pdf', '.txt', '.docx', '.pptx', '.ppt'}
_ALLOWED_MIME_TYPES = {
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
}
_MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


class DocumentUploadSerializer(serializers.Serializer):
    file = serializers.FileField()

    def validate_file(self, value):
        ext = Path(value.name).suffix.lower()
        if ext not in _ALLOWED_EXTENSIONS:
            raise serializers.ValidationError(
                f"Desteklenmeyen dosya uzantısı '{ext}'. PDF, TXT veya DOCX yükleyin."
            )
        if value.content_type not in _ALLOWED_MIME_TYPES:
            raise serializers.ValidationError("Desteklenmeyen dosya türü. PDF, TXT veya DOCX yükleyin.")
        if value.size > _MAX_FILE_SIZE:
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
    provider = serializers.ChoiceField(choices=LLM_PROVIDER_CHOICES, required=False, allow_blank=True, default="")
    model = serializers.CharField(required=False, allow_blank=True, default="", max_length=100)
    action = serializers.ChoiceField(choices=["", "ozet", "test", "yolharitasi"], required=False, allow_blank=True, default="")
    room_id = serializers.CharField(required=False, allow_blank=True, allow_null=True, default=None)
    excluded_doc_ids = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )


class LiteratureSearchRequestSerializer(serializers.Serializer):
    topic = serializers.CharField(min_length=3, max_length=200)
    max_results = serializers.IntegerField(min_value=1, max_value=10, default=5)


class LiteratureSearchResultSerializer(serializers.Serializer):
    document_id = serializers.UUIDField()
    task_id = serializers.UUIDField()
    title = serializers.CharField()
    authors = serializers.ListField(child=serializers.CharField())
    arxiv_id = serializers.CharField()
    summary = serializers.CharField()
    published = serializers.CharField(allow_null=True)


class QuerySourceSerializer(serializers.Serializer):
    chunk_index = serializers.IntegerField()
    content = serializers.CharField()
    document_id = serializers.UUIDField()


class QueryResponseSerializer(serializers.Serializer):
    answer = serializers.CharField()
    provider = serializers.CharField()
    sources = QuerySourceSerializer(many=True)
