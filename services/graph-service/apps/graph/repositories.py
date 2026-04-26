from .neo4j_client import Neo4jClient


class GraphRepository:
    def ingest(self, payload: dict, user_id: int) -> None:
        driver = Neo4jClient.get_driver()
        with driver.session() as session:
            session.run(
                "MERGE (d:Document {id: $doc_id, user_id: $user_id}) SET d.title = $title",
                doc_id=payload["document_id"],
                user_id=user_id,
                title=payload.get("title", ""),
            )
            for concept in payload.get("concepts", []):
                session.run(
                    """
                    MERGE (c:Concept {name: $name, user_id: $user_id})
                    SET c.description = $description
                    WITH c
                    MATCH (d:Document {id: $doc_id, user_id: $user_id})
                    MERGE (c)-[:EXTRACTED_FROM]->(d)
                    """,
                    name=concept["name"],
                    description=concept.get("description", ""),
                    user_id=user_id,
                    doc_id=payload["document_id"],
                )
            for rel in payload.get("relationships", []):
                session.run(
                    """
                    MATCH (a:Concept {name: $from_name, user_id: $user_id})
                    MATCH (b:Concept {name: $to_name, user_id: $user_id})
                    MERGE (a)-[:RELATED_TO {type: $rel_type}]->(b)
                    """,
                    from_name=rel["from"],
                    to_name=rel["to"],
                    rel_type=rel.get("type", "RELATED_TO"),
                    user_id=user_id,
                )

    def search_nodes(self, query: str, user_id: int) -> list[dict]:
        terms = [t.strip() for t in query.split() if len(t.strip()) > 2]
        if not terms:
            return []
        driver = Neo4jClient.get_driver()
        with driver.session() as session:
            result = session.run(
                """
                MATCH (c:Concept {user_id: $user_id})-[:EXTRACTED_FROM]->(d:Document)
                WHERE any(term IN $terms
                          WHERE toLower(c.name) CONTAINS toLower(term)
                             OR toLower(coalesce(c.description, '')) CONTAINS toLower(term))
                OPTIONAL MATCH (c)-[:RELATED_TO]-(related:Concept {user_id: $user_id})
                RETURN c.name AS name,
                       c.description AS description,
                       d.title AS document,
                       collect(DISTINCT related.name)[0..3] AS related_concepts
                LIMIT 10
                """,
                user_id=user_id,
                terms=terms,
            )
            return [dict(record) for record in result]

    def get_subgraph(self, user_id: int) -> dict:
        driver = Neo4jClient.get_driver()
        with driver.session() as session:
            nodes_result = session.run(
                "MATCH (c:Concept {user_id: $user_id}) RETURN c.name AS name, c.description AS description",
                user_id=user_id,
            )
            edges_result = session.run(
                """
                MATCH (a:Concept {user_id: $user_id})-[r:RELATED_TO]->(b:Concept {user_id: $user_id})
                RETURN a.name AS from_node, b.name AS to_node, r.type AS rel_type
                """,
                user_id=user_id,
            )
            return {
                "nodes": [dict(r) for r in nodes_result],
                "edges": [dict(r) for r in edges_result],
            }
