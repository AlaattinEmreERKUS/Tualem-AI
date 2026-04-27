from sentence_transformers import SentenceTransformer
from typing import List, Dict, Any, Optional
import os
import uuid
from pinecone import Pinecone, ServerlessSpec
from dotenv import load_dotenv

load_dotenv()

_encoder_cache: Optional[SentenceTransformer] = None

INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "tualem-docs")
EMBEDDING_DIM = 384


def _get_encoder() -> SentenceTransformer:
    global _encoder_cache
    if _encoder_cache is None:
        _encoder_cache = SentenceTransformer("all-MiniLM-L6-v2")
    return _encoder_cache


class VectorStore:
    def __init__(self):
        api_key = os.getenv("PINECONE_API_KEY")
        if not api_key:
            raise ValueError("PINECONE_API_KEY not set")

        self.pc = Pinecone(api_key=api_key)
        self._ensure_index()
        self.index = self.pc.Index(INDEX_NAME)
        self.encoder = _get_encoder()

    def _ensure_index(self):
        existing = [i.name for i in self.pc.list_indexes()]
        if INDEX_NAME not in existing:
            self.pc.create_index(
                name=INDEX_NAME,
                dimension=EMBEDDING_DIM,
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-east-1"),
            )

    def add_document(
        self,
        text: str,
        user_id: str,
        doc_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        vec_id = doc_id or str(uuid.uuid4())
        embedding = self.encoder.encode(text).tolist()

        meta = metadata or {}
        meta.update({"user_id": user_id, "text": text})

        self.index.upsert(vectors=[{"id": vec_id, "values": embedding, "metadata": meta}])
        return vec_id

    def add_documents(
        self,
        documents: List[Dict[str, Any]],
        user_id: str,
    ) -> List[str]:
        """documents: list of {"text": str, "doc_id": str (opt), "metadata": dict (opt)}"""
        ids = []
        vectors = []

        for doc in documents:
            vec_id = doc.get("doc_id") or str(uuid.uuid4())
            embedding = self.encoder.encode(doc["text"]).tolist()
            meta = doc.get("metadata") or {}
            meta.update({"user_id": user_id, "text": doc["text"]})
            vectors.append({"id": vec_id, "values": embedding, "metadata": meta})
            ids.append(vec_id)

        self.index.upsert(vectors=vectors)
        return ids

    def search(
        self,
        query: str,
        user_id: str,
        top_k: int = 5,
    ) -> List[Dict[str, Any]]:
        embedding = self.encoder.encode(query).tolist()
        results = self.index.query(
            vector=embedding,
            top_k=top_k,
            filter={"user_id": {"$eq": user_id}},
            include_metadata=True,
        )
        return [
            {
                "id": match.id,
                "score": match.score,
                "text": match.metadata.get("text", ""),
                "metadata": match.metadata,
            }
            for match in results.matches
        ]

    def delete_document(self, doc_id: str) -> None:
        self.index.delete(ids=[doc_id])

    def delete_user_documents(self, user_id: str) -> None:
        self.index.delete(filter={"user_id": {"$eq": user_id}})
