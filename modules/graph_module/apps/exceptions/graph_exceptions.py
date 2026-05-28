class GraphBaseException(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(self.message)


# --- Document ---

class DocumentNotFoundException(GraphBaseException):
    def __init__(self, document_id=None):
        msg = f"Doküman bulunamadı: {document_id}" if document_id else "Doküman bulunamadı."
        super().__init__(msg)

class DocumentSaveException(GraphBaseException):
    def __init__(self):
        super().__init__("Doküman kaydedilemedi.")

class DocumentDeleteException(GraphBaseException):
    def __init__(self):
        super().__init__("Doküman silinemedi.")

class DocumentAccessDeniedException(GraphBaseException):
    def __init__(self):
        super().__init__("Bu dokümana erişim yetkiniz yok.")


# --- Chunk ---

class ChunkCreationException(GraphBaseException):
    def __init__(self):
        super().__init__("Chunk'lar oluşturulamadı.")

class ChunkNotFoundException(GraphBaseException):
    def __init__(self):
        super().__init__("Chunk bulunamadı.")


# --- GraphTask ---

class TaskCreationException(GraphBaseException):
    def __init__(self):
        super().__init__("Pipeline görevi oluşturulamadı.")

class TaskNotFoundException(GraphBaseException):
    def __init__(self):
        super().__init__("Görev bulunamadı.")


# --- Neo4j ---

class Neo4jConnectionException(GraphBaseException):
    def __init__(self):
        super().__init__("Neo4j bağlantısı kurulamadı.")

class Neo4jWriteException(GraphBaseException):
    def __init__(self, detail: str = ""):
        msg = f"Neo4j yazma hatası: {detail}" if detail else "Neo4j yazma hatası."
        super().__init__(msg)


# --- Pipeline ---

class PipelineException(GraphBaseException):
    def __init__(self, step: str, detail: str = ""):
        self.step = step
        msg = f"Pipeline hatası [{step}]: {detail}" if detail else f"Pipeline hatası [{step}]."
        super().__init__(msg)

class EntityExtractionException(GraphBaseException):
    def __init__(self):
        super().__init__("LLM'den entity çıkarma başarısız oldu.")


# --- Literature Search ---

class LiteratureSearchException(GraphBaseException):
    def __init__(self, detail: str = ""):
        msg = f"Literatür araması başarısız: {detail}" if detail else "Literatür araması başarısız."
        super().__init__(msg)


# --- RAG ---

class NoRelevantChunksException(GraphBaseException):
    def __init__(self):
        super().__init__("Henüz yüklenmiş kaynak yok veya soruyla eşleşen içerik bulunamadı. Önce kaynak ekleyin.")

class RAGQueryException(GraphBaseException):
    def __init__(self, detail: str = ""):
        msg = f"RAG sorgusu başarısız: {detail}" if detail else "RAG sorgusu başarısız."
        super().__init__(msg)
