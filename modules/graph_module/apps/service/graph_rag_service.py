import os
from langchain_core.prompts import PromptTemplate

from apps.repositories.rag_repository import RAGRepository
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


class GraphRAGService:

    @staticmethod
    def query(user_id: str, question: str, top_k: int = 5, provider: str = "") -> dict:
        chunks = RAGRepository.vector_search(question, user_id, top_k)
        if not chunks:
            raise NoRelevantChunksException()

        chunk_ids = [str(c["id"]) for c in chunks]
        graph_triples = RAGRepository.get_graph_context(chunk_ids)

        context = _build_context(chunks, graph_triples)

        try:
            llm = _build_llm(provider)
            chain = RAG_PROMPT | llm
            response = chain.invoke({"context": context, "question": question})
        except Exception as e:
            raise RAGQueryException(str(e)) from e

        return {
            "answer": response.content.strip(),
            "provider": provider or os.getenv("LLM_PROVIDER", "auto"),
            "sources": [
                {
                    "chunk_index": c["chunk_index"],
                    "content": c["content"],
                    "document_id": str(c["document_id"]),
                }
                for c in chunks
            ],
        }
