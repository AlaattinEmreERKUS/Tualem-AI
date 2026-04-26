from rest_framework.views import APIView
from rest_framework.response import Response
from .tasks import process_document


class TaskStatusView(APIView):
    def get(self, request, task_id: str):
        pass
