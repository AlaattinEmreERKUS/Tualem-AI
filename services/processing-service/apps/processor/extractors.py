from abc import ABC, abstractmethod


class BaseExtractor(ABC):
    """Strategy pattern — one extractor per file type."""

    @abstractmethod
    def extract(self, file_path: str) -> str:
        pass


class PDFExtractor(BaseExtractor):
    def extract(self, file_path: str) -> str:
        pass


class MarkdownExtractor(BaseExtractor):
    def extract(self, file_path: str) -> str:
        pass


class ExtractorFactory:
    _registry: dict[str, type[BaseExtractor]] = {
        "pdf": PDFExtractor,
        "md": MarkdownExtractor,
    }

    @classmethod
    def get(cls, file_type: str) -> BaseExtractor:
        extractor_cls = cls._registry.get(file_type.lower())
        if not extractor_cls:
            raise ValueError(f"No extractor for file type: {file_type}")
        return extractor_cls()
