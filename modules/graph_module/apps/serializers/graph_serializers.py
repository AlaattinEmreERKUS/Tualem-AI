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
