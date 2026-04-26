from .extractors import ExtractorFactory


class ProcessorService:
    def extract_text(self, file_path: str, file_type: str) -> str:
        extractor = ExtractorFactory.get(file_type)
        return extractor.extract(file_path)

    def extract_concepts(self, text: str) -> list[dict]:
        """Call Gemini API — extract nodes and relationships."""
        pass

    def chunk_text(self, text: str, chunk_size: int = 512) -> list[str]:
        pass
