import arxiv
import httpx
from django.core.files.base import ContentFile

from apps.repositories.graph_repository import GraphRepository
from apps.exceptions.graph_exceptions import LiteratureSearchException


class LiteratureSearchService:

    MAX_RESULTS_LIMIT = 10

    @staticmethod
    def search_and_import(user_id: str, topic: str, max_results: int = 5) -> list:
        max_results = min(max_results, LiteratureSearchService.MAX_RESULTS_LIMIT)

        client = arxiv.Client()
        search = arxiv.Search(
            query=topic,
            max_results=max_results,
            sort_by=arxiv.SortCriterion.Relevance,
        )

        results = []
        for paper in client.results(search):
            try:
                result = LiteratureSearchService._import_paper(user_id, paper)
                results.append(result)
            except Exception:
                continue

        if not results:
            raise LiteratureSearchException(f'"{topic}" konusu için indirilebilir makale bulunamadı.')

        return results

    @staticmethod
    def _import_paper(user_id: str, paper) -> dict:
        arxiv_id = paper.entry_id.split("/")[-1]
        file_name = f"arxiv_{arxiv_id}.pdf"

        response = httpx.get(paper.pdf_url, follow_redirects=True, timeout=60.0)
        response.raise_for_status()

        file_content = ContentFile(response.content, name=file_name)

        document = GraphRepository.create_document(
            user_id=user_id,
            file_name=file_name,
            file_type="application/pdf",
            file=file_content,
        )

        try:
            task = GraphRepository.create_task(document.id)
        except Exception:
            GraphRepository.update_document_status(document.id, "failed")
            raise

        from apps.tasks import run_graph_pipeline
        run_graph_pipeline.delay(str(document.id), str(task.id))

        return {
            "document_id": str(document.id),
            "task_id": str(task.id),
            "title": paper.title,
            "authors": [a.name for a in paper.authors[:3]],
            "arxiv_id": arxiv_id,
            "summary": paper.summary[:300] if paper.summary else "",
            "published": paper.published.isoformat() if paper.published else None,
        }
