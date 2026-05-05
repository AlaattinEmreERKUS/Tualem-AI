import json
import os
from neo4j import GraphDatabase
from typing import List, Dict, Any
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.prompts import PromptTemplate
from langchain_openai import ChatOpenAI

class Neo4jClient:

    def __init__(self, neo4j_uri: str, neo4j_user: str, neo4j_password: str):
        self.driver = GraphDatabase.driver(neo4j_uri, auth=(neo4j_user, neo4j_password))
        self.text_splitter = RecursiveCharacterTextSplitter(
            separators=["\n\n", "\n", ". ", " ", ""],
            chunk_size = 2000,
            chunk_overlap = 400
        )
    
    def close(self):
        self.driver.close()

    def chunk_text(self, text: str) -> List[str]:
        chunks = self.text_splitter.split_text(text)
        return chunks
    
    def extract_graph_data(self, chunk:str, llm: ChatOpenAI) -> Dict[str, Any]:
        """Girilen dokümanın verilerini çıkartır."""
        prompt = PromptTemplate(
            input_variables=["text"],
            template="""

        """
        )

        chain = prompt | llm
        response = chain.invoke({"text": chunk})

        try:
            content = response.content.strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

            result = json.loads(content)
            return result
        
        except json.JSONDecodeError as e:
            print(f"⚠ JSON parse hatası: {e}")
            print(f"Response: {response.content[:200]}...")
            return {"entities": [], "relationships": []}
        
    def create_nodes(self, entities: List[Dict[str, Any]]):
        """Neo4J'de düğümleri oluşturur."""
        with self.driver.session() as session:
            for entity in entities:
                name = entity.get("name", "")
                entity_type = entity.get("type", "Entity")
                props = entity.get("properties", {})

                cleaned_props = {k.replace(" ", "_"): v for k, v in props.items()}

                propts_str = ", ".join([f"{k}: ${k}" for k in cleaned_props.keys()])
                params = {"name": name, **cleaned_props}

                query = f"""
                MERGE (n:{entity_type} {{name: $name}})
                SET n += {{{propts_str}}}
                RETURN n
                """

                try:
                    session.run(query, params)
                except Exception as e:
                    print(f"Node oluşturma hatası ({name}): {e}")

    def create_relationships(self, relationships: List[Dict[str, Any]]):
        """Neo4J'de ilişkileri oluşturur."""
        with self.driver.session() as session:
            for rel in relationships:
                source = rel.get("source", "")
                target = rel.get("target", "")
                rel_type = rel.get("type", "RELATED_TO").replace(" ", "_").upper()
                props = rel.get("properties", {})
                
                cleaned_props = {k.replace(" ", "_"): v for k, v in props.items()}
                props_str = ", ".join([f"`{k}`: ${k}" for k in cleaned_props.keys()])
                params = {"source": source, "target": target, **cleaned_props}
                
                if props_str:
                    props_clause = f"SET r += {{{props_str}}}"
                else:
                    props_clause = ""
                
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
                    print(f"⚠ İlişki oluşturma hatası ({source}->{target}): {e}")

    