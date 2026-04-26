from rest_framework import generics, status
from rest_framework.response import Response
from .services import DocumentService


class DocumentListCreateView(generics.ListCreateAPIView):
    def get_queryset(self):
        pass

    def perform_create(self, serializer):
        pass


class DocumentDetailView(generics.RetrieveDestroyAPIView):
    def get_queryset(self):
        pass
