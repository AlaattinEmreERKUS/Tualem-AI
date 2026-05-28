import json
import os
from neo4j import GraphDatabase
from typing import List, Dict, Any
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.prompts import PromptTemplate
from langchain_openai import ChatOpenAI
from apps.exceptions.graph_exceptions import (
    Neo4jConnectionException,
    Neo4jWriteException,
    EntityExtractionException,
)


OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


def _build_llm(provider: str = ""):
    resolved = (provider or os.getenv("LLM_PROVIDER", "")).lower()

    if resolved == "groq" or (not resolved and os.getenv("GROQ_API_KEY")):
        from langchain_groq import ChatGroq
        return ChatGroq(
            model=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
            api_key=os.getenv("GROQ_API_KEY"),
            temperature=0,
        )

    if resolved == "ollama" or (not resolved and os.getenv("OLLAMA_BASE_URL")):
        from langchain_ollama import ChatOllama
        return ChatOllama(
            model=os.getenv("OLLAMA_MODEL", "llama3.2"),
            base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
            temperature=0,
        )

    return ChatOpenAI(
        model=os.getenv("EXTRACTION_MODEL", "openai/gpt-4o-mini"),
        openai_api_key=os.getenv("OPENROUTER_API_KEY"),
        openai_api_base=OPENROUTER_BASE_URL,
        temperature=0,
    )

EXTRACTION_PROMPT = PromptTemplate(
    input_variables=["text"],
    template="""
Aşağıdaki metni analiz et ve içindeki entity'leri ile aralarındaki ilişkileri çıkar.
Yanıtı SADECE aşağıdaki JSON formatında ver, başka hiçbir açıklama ekleme.

{{
  "entities": [
    {{
      "name": "entity adı",
      "type": "Person | Organization | Location | Concept | Event | Product",
      "properties": {{
        "anahtar": "değer"
      }}
    }}
  ],
  "relationships": [
    {{
      "source": "kaynak entity adı",
      "target": "hedef entity adı",
      "type": "İLİŞKİ_TÜRÜ",
      "properties": {{}}
    }}
  ]
}}

Kurallar:
- Entity adları tutarlı ve tekil olmalı (aynı entity farklı yazılmamalı).
- İlişki türleri BÜYÜK_HARF ve alt çizgi kullan (örn. WORKS_AT, LOCATED_IN).
- Eğer entity veya ilişki yoksa ilgili listeyi boş bırak.
- Sadece metinde açıkça geçen bilgileri kullan, çıkarım yapma.

Metin:
{text}
""",
)


class Neo4jClient:

    def __init__(self, neo4j_uri: str, neo4j_user: str, neo4j_password: str):
        try:
            self.driver = GraphDatabase.driver(neo4j_uri, auth=(neo4j_user, neo4j_password))
            self.driver.verify_connectivity()
        except Exception as e:
            raise Neo4jConnectionException() from e

        self.text_splitter = RecursiveCharacterTextSplitter(
            separators=["\n\n", "\n", ". ", " ", ""],
            chunk_size=2000,
            chunk_overlap=400,
        )
        self.llm = _build_llm()

    def close(self):
        self.driver.close()

    def chunk_text(self, text: str) -> List[str]:
        return self.text_splitter.split_text(text)

    def extract_graph_data(self, chunk: str) -> Dict[str, Any]:
        chain = EXTRACTION_PROMPT | self.llm
        try:
            response = chain.invoke({"text": chunk})
            content = response.content.strip()

            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]

            return json.loads(content.strip())

        except json.JSONDecodeError:
            raise EntityExtractionException()
        except Exception as e:
            raise EntityExtractionException() from e

    def create_nodes(self, entities: List[Dict[str, Any]]):
        with self.driver.session() as session:
            for entity in entities:
                name = entity.get("name", "")
                entity_type = entity.get("type", "Entity")
                props = {k.replace(" ", "_"): v for k, v in entity.get("properties", {}).items()}

                props_str = ", ".join([f"{k}: ${k}" for k in props.keys()])
                params = {"name": name, **props}

                query = f"""
                MERGE (n:{entity_type} {{name: $name}})
                SET n += {{{props_str}}}
                RETURN n
                """
                try:
                    session.run(query, params)
                except Exception as e:
                    raise Neo4jWriteException(f"Node oluşturma hatası ({name}): {e}") from e

    def create_chunk_node(self, chunk_id: str) -> None:
        try:
            with self.driver.session() as session:
                session.run("MERGE (c:Chunk {id: $id})", {"id": chunk_id})
        except Exception:
            pass

    def create_chunk_with_entities(self, chunk_id: str, entities: List[Dict], relationships: List[Dict]) -> None:
        with self.driver.session() as session:
            session.run("MERGE (c:Chunk {id: $id})", {"id": chunk_id})

            for entity in entities:
                name = entity.get("name", "")
                entity_type = entity.get("type", "Entity")
                props = {k.replace(" ", "_"): v for k, v in entity.get("properties", {}).items()}
                props_str = ", ".join([f"{k}: ${k}" for k in props.keys()])
                set_clause = f"SET e += {{{props_str}}}" if props_str else ""
                params = {"name": name, "chunk_id": chunk_id, **props}
                try:
                    session.run(
                        f"""
                        MERGE (e:{entity_type} {{name: $name}})
                        {set_clause}
                        WITH e
                        MATCH (c:Chunk {{id: $chunk_id}})
                        MERGE (c)-[:CONTAINS]->(e)
                        """,
                        params,
                    )
                except Exception as e:
                    raise Neo4jWriteException(f"Entity yazma hatası ({name}): {e}") from e

            for rel in relationships:
                source = rel.get("source", "")
                target = rel.get("target", "")
                rel_type = rel.get("type", "RELATED_TO").replace(" ", "_").upper()
                props = {k.replace(" ", "_"): v for k, v in rel.get("properties", {}).items()}
                props_str = ", ".join([f"`{k}`: ${k}" for k in props.keys()])
                props_clause = f"SET r += {{{props_str}}}" if props_str else ""
                params = {"source": source, "target": target, **props}
                try:
                    session.run(
                        f"""
                        MATCH (a {{name: $source}})
                        MATCH (b {{name: $target}})
                        MERGE (a)-[r:{rel_type}]->(b)
                        {props_clause}
                        """,
                        params,
                    )
                except Exception as e:
                    raise Neo4jWriteException(f"İlişki yazma hatası ({source}->{target}): {e}") from e

    def get_graph_context_by_chunks(self, chunk_ids: List[str]) -> List[Dict[str, Any]]:
        query = """
        MATCH (c:Chunk)-[:CONTAINS]->(e)
        WHERE c.id IN $chunk_ids
        OPTIONAL MATCH (e)-[r]-(neighbor)
        RETURN e.name AS entity, labels(e)[0] AS entity_type, type(r) AS rel_type, neighbor.name AS neighbor
        LIMIT 150
        """
        try:
            with self.driver.session() as session:
                result = session.run(query, {"chunk_ids": chunk_ids})
                return [dict(record) for record in result]
        except Exception:
            return []

    def delete_chunks(self, chunk_ids: List[str]) -> None:
        query = """
        MATCH (c:Chunk)
        WHERE c.id IN $chunk_ids
        DETACH DELETE c
        """
        try:
            with self.driver.session() as session:
                session.run(query, {"chunk_ids": chunk_ids})
        except Exception:
            pass

    def create_relationships(self, relationships: List[Dict[str, Any]]):
        with self.driver.session() as session:
            for rel in relationships:
                source = rel.get("source", "")
                target = rel.get("target", "")
                rel_type = rel.get("type", "RELATED_TO").replace(" ", "_").upper()
                props = {k.replace(" ", "_"): v for k, v in rel.get("properties", {}).items()}

                props_str = ", ".join([f"`{k}`: ${k}" for k in props.keys()])
                props_clause = f"SET r += {{{props_str}}}" if props_str else ""
                params = {"source": source, "target": target, **props}

                query = f"""
                MATCH (a {{name: $source}})
                MATCH (b {{name: $target}})
                MERGE (a)-[r:{rel_type}]->(b)
                {props_clause}
                RETURN r
                """
                try:
                    session.run(query, params)
                except Exception as e:
                    raise Neo4jWriteException(f"İlişki oluşturma hatası ({source}->{target}): {e}") from e
