from typing import List, Dict, Any, Optional
from sentence_transformers import SentenceTransformer
from pgvector.django import CosineDistance

_encoder_cache: Optional[SentenceTransformer] = None
EMBEDDING_DIM = 384


def _get_encoder() -> SentenceTransformer:
    global _encoder_cache
    if _encoder_cache is None:
        _encoder_cache = SentenceTransformer("all-MiniLM-L6-v2")
    return _encoder_cache


class VectorStore:

    def __init__(self):
        self.encoder = _get_encoder()

    def embed(self, text: str) -> List[float]:
        return self.encoder.encode(text).tolist()

    def embed_chunk(self, chunk_id: str, text: str) -> None:
        from apps.models import ContentChunk
        embedding = self.embed(text)
        ContentChunk.objects.filter(id=chunk_id).update(
            embedding=embedding,
            is_embedded=True,
        )

    def embed_chunks_bulk(self, chunks: List[Dict[str, Any]]) -> None:
        """chunks: [{"id": str, "content": str}]"""
        from apps.models import ContentChunk
        for chunk in chunks:
            embedding = self.embed(chunk["content"])
            ContentChunk.objects.filter(id=chunk["id"]).update(
                embedding=embedding,
                is_embedded=True,
            )

    def search(
        self,
        query: str,
        user_id: str,
        top_k: int = 5,
    ) -> List[Dict[str, Any]]:
        from apps.models import ContentChunk
        query_embedding = self.embed(query)
        results = (
            ContentChunk.objects
            .filter(document__user_id=user_id, is_embedded=True)
            .alias(distance=CosineDistance("embedding", query_embedding))
            .filter(distance__lte=0.7)
            .order_by(CosineDistance("embedding", query_embedding))
            [:top_k]
            .values("id", "content", "chunk_index", "document_id")
        )
        return list(results)

    def delete_document_embeddings(self, document_id: str) -> None:
        from apps.models import ContentChunk
        ContentChunk.objects.filter(document_id=document_id).update(
            embedding=None,
            is_embedded=False,
        )
