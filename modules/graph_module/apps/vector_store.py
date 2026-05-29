from typing import List, Dict, Any, Optional
from sentence_transformers import SentenceTransformer
from pgvector.django import CosineDistance

_encoder_cache: Optional[SentenceTransformer] = None
EMBEDDING_DIM = 768
_MODEL_NAME = "intfloat/multilingual-e5-base"


def _get_encoder() -> SentenceTransformer:
    global _encoder_cache
    if _encoder_cache is None:
        _encoder_cache = SentenceTransformer(_MODEL_NAME)
    return _encoder_cache


class VectorStore:

    def __init__(self):
        self.encoder = _get_encoder()

    def embed(self, text: str, is_query: bool = False) -> List[float]:
        # multilingual-e5 modeli query/passage prefix gerektirir
        prefix = "query: " if is_query else "passage: "
        return self.encoder.encode(prefix + text).tolist()

    def embed_chunk(self, chunk_id: str, text: str) -> None:
        from apps.models import ContentChunk
        embedding = self.embed(text, is_query=False)
        ContentChunk.objects.filter(id=chunk_id).update(
            embedding=embedding,
            is_embedded=True,
        )

    def embed_chunks_bulk(self, chunks: List[Dict[str, Any]]) -> None:
        """chunks: [{"id": str, "content": str}]"""
        from apps.models import ContentChunk
        for chunk in chunks:
            embedding = self.embed(chunk["content"], is_query=False)
            ContentChunk.objects.filter(id=chunk["id"]).update(
                embedding=embedding,
                is_embedded=True,
            )

    def search(
        self,
        query: str,
        user_id: str,
        top_k: int = 5,
        room_id: str = None,
    ) -> List[Dict[str, Any]]:
        from apps.models import ContentChunk
        query_embedding = self.embed(query, is_query=True)
        qs = ContentChunk.objects.filter(is_embedded=True)
        if room_id:
            qs = qs.filter(document__room_id=str(room_id))
        elif user_id:
            qs = qs.filter(document__user_id=str(user_id))
        results = (
            qs
            .alias(distance=CosineDistance("embedding", query_embedding))
            .filter(distance__lte=0.65)
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
