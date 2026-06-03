import os
import time
import logging
from langchain_core.prompts import PromptTemplate

logger = logging.getLogger('graph_module')

from apps.repositories.rag_repository import RAGRepository
from apps.repositories.graph_repository import GraphRepository
from apps.neo4j_client import _build_llm
from apps.exceptions.graph_exceptions import (
    NoRelevantChunksException,
    RAGQueryException,
)

RAG_PROMPT = PromptTemplate(
    input_variables=["context", "question"],
    template="""Sen bir belge analiz asistanısın. Yalnızca verilen bağlam bilgilerini kullanarak soruyu yanıtla. Bağlamda bulunmayan bilgileri kesinlikle üretme.

Bağlam:
{context}

Soru: {question}

Yanıt:""",
)

ACTION_PROMPTS = {
    "ozet": PromptTemplate(
        input_variables=["context"],
        template="""Aşağıdaki belge içeriğini kapsamlı şekilde özetle. Başlıklar ve maddeler kullan.

Belge İçeriği:
{context}

Özet:""",
    ),
    "test": PromptTemplate(
        input_variables=["context"],
        template="""Aşağıdaki belge içeriğine dayanarak çoktan seçmeli 5 soru üret.
YALNIZCA aşağıdaki JSON formatında yanıt ver, başka açıklama ekleme:
{{"questions":[{{"question":"<soru>","options":{{"A":"<şık>","B":"<şık>","C":"<şık>","D":"<şık>"}},"answer":"<A|B|C|D>","explanation":"<kısa açıklama>"}}]}}

Belge İçeriği:
{context}""",
    ),
    "yolharitasi": PromptTemplate(
        input_variables=["context"],
        template="""Aşağıdaki belge içeriğine dayanarak 5-8 adımlı öğrenme yol haritası oluştur. Her adım için 2-4 alt adım ekle.
YALNIZCA aşağıdaki JSON formatında yanıt ver, başka açıklama ekleme:
{{"title":"<başlık>","steps":[{{"title":"<adım>","description":"<açıklama>","duration":"<süre>","substeps":[{{"title":"<alt adım>","detail":"<ne yapılacak>"}}]}}]}}

Belge İçeriği:
{context}""",
    ),
}


def _build_context(chunks: list, graph_triples: list) -> str:
    parts = ["=== Doküman Parçaları ==="]
    for i, chunk in enumerate(chunks, 1):
        parts.append(f"[{i}] {chunk['content']}")

    if graph_triples:
        parts.append("=== Bilgi Grafı ===")
        for triple in graph_triples:
            entity = triple.get("entity", "")
            rel = triple.get("rel_type") or ""
            neighbor = triple.get("neighbor") or ""
            if entity and neighbor:
                parts.append(f"• {entity} --[{rel}]--> {neighbor}")
            elif entity:
                parts.append(f"• {entity} ({triple.get('entity_type', '')})")

    return "\n\n".join(parts)


_PAYLOAD_TOO_LARGE_PATTERNS = [
    "413", "payload too large", "context_length_exceeded",
    "maximum context length", "too many tokens", "request too large",
    "reduce the length", "token limit",
]


def _is_payload_too_large(err: str) -> bool:
    err_lower = err.lower()
    return any(p in err_lower for p in _PAYLOAD_TOO_LARGE_PATTERNS)


def _truncate_context(input_vars: dict, ratio: float) -> dict:
    result = dict(input_vars)
    if "context" in result and isinstance(result["context"], str):
        ctx = result["context"]
        cutoff = max(500, int(len(ctx) * ratio))
        result["context"] = ctx[:cutoff] + "\n\n[Bağlam token limiti nedeniyle kısaltıldı]"
    return result


def _call_llm(prompt_template, input_vars: dict, provider: str, model: str) -> str:
    last_exc = None
    current_vars = input_vars
    for attempt in range(3):
        try:
            llm = _build_llm(provider, model)
            return (prompt_template | llm).invoke(current_vars).content.strip()
        except Exception as e:
            err = str(e)
            last_exc = e
            if ("429" in err or "rate" in err.lower()) and attempt < 2:
                wait = 2 ** attempt
                logger.warning("Rate limit, retry %d/3, %ds bekliyor | model=%s", attempt + 1, wait, model)
                time.sleep(wait)
                continue
            if _is_payload_too_large(err) and attempt < 2:
                ratio = 0.6 if attempt == 0 else 0.3
                current_vars = _truncate_context(input_vars, ratio)
                logger.warning(
                    "Payload too large, retry %d/3, bağlam %.0f%%'e kısaltıldı | model=%s",
                    attempt + 1, ratio * 100, model,
                )
                continue
            if "401" in err or "auth" in err.lower() or "api key" in err.lower():
                raise RAGQueryException("API anahtarı geçersiz.") from e
            logger.error("LLM call failed | model=%s | error=%s", model, err[:300])
            raise RAGQueryException(f"LLM hatası: {err[:200]}") from e
    raise RAGQueryException(
        f"Model rate limit aşıldı veya bağlam çok büyük ({model or 'default'}). Daha büyük context'li model seçin."
    ) from last_exc


class GraphRAGService:

    @staticmethod
    def cleanup_document(document_id: str) -> None:
        chunks = GraphRepository.get_chunks_by_document(document_id)
        chunk_ids = [str(c['id']) for c in chunks] if chunks else []
        if chunk_ids:
            RAGRepository.delete_chunk_nodes(chunk_ids)
        RAGRepository.delete_document_embeddings(document_id)

    @staticmethod
    def query(user_id: str, question: str, top_k: int = 5, provider: str = "", model: str = "", action: str = "", room_id: str = None, excluded_doc_ids: list = None) -> dict:
        logger.info("[rag] query | user=%s room=%s model=%s/%s action=%s", user_id, room_id, provider, model, action or "chat")
        k = 10 if action else top_k
        try:
            chunks = RAGRepository.vector_search(question, user_id, k, room_id=room_id, excluded_doc_ids=excluded_doc_ids or [])
        except Exception as e:
            logger.error("[rag] vector_search failed | user=%s | error=%s", user_id, e)
            raise RAGQueryException(f"Vektör arama hatası: {e}") from e
        logger.info("[rag] vector_search | chunks=%d", len(chunks) if chunks else 0)
        if not chunks:
            raise NoRelevantChunksException()

        chunk_ids = [str(c["id"]) for c in chunks]
        try:
            graph_triples = RAGRepository.get_graph_context(chunk_ids)
        except Exception as e:
            logger.warning("[rag] get_graph_context failed (devam ediliyor) | error=%s", e)
            graph_triples = []
        context = _build_context(chunks, graph_triples)
        logger.info("[rag] context built | chars=%d triples=%d", len(context), len(graph_triples))

        if action and action in ACTION_PROMPTS:
            logger.info("[rag] LLM call (action=%s) | provider=%s model=%s", action, provider, model)
            raw = _call_llm(ACTION_PROMPTS[action], {"context": context}, provider, model)
            if action in ("test", "yolharitasi"):
                import json as _json
                try:
                    cleaned = raw.strip()
                    if cleaned.startswith("```"):
                        parts = cleaned.split("```")
                        cleaned = parts[1] if len(parts) >= 2 else cleaned
                        if cleaned.startswith("json"):
                            cleaned = cleaned[4:].strip()
                    answer = _json.dumps(_json.loads(cleaned), ensure_ascii=False)
                except Exception:
                    answer = raw
            else:
                answer = raw
        else:
            logger.info("[rag] LLM call (chat) | provider=%s model=%s", provider, model)
            answer = _call_llm(RAG_PROMPT, {"context": context, "question": question}, provider, model)

        from apps.models import Document
        doc_ids = {str(c["document_id"]) for c in chunks}
        doc_name_map = {
            str(d.id): d.file_name
            for d in Document.objects.filter(id__in=doc_ids).only("id", "file_name")
        }

        return {
            "answer": answer,
            "action_type": action or "",
            "provider": provider or os.getenv("LLM_PROVIDER", "auto"),
            "sources": [
                {
                    "chunk_index": c["chunk_index"],
                    "content": c["content"],
                    "document_id": str(c["document_id"]),
                    "file_name": doc_name_map.get(str(c["document_id"]), "Bilinmeyen Kaynak"),
                }
                for c in chunks
            ],
        }
