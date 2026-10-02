from __future__ import annotations

from typing import Any

from rag.chroma_store import get_collection
from rag.embedding_provider import embed_query


def retrieve_chunks(
    domain: str,
    query: str,
    top_k: int = 5,
    document_id: str | None = None,
) -> list[dict[str, Any]]:
    """Retrieve nearest chunks while preferring coverage across source articles."""
    collection = get_collection(domain)
    count = collection.count()
    if count == 0:
        return []

    query_options: dict[str, Any] = {
        "query_embeddings": [embed_query(query).tolist()],
        "n_results": min(count, 100),
        "include": ["documents", "metadatas", "distances"],
    }
    if document_id:
        query_options["where"] = {"document_id": document_id}
    result = collection.query(
        **query_options,
    )
    docs = (result.get("documents") or [[]])[0] or []
    metas = (result.get("metadatas") or [[]])[0] or []
    distances = (result.get("distances") or [[]])[0] or []
    candidates: list[dict[str, Any]] = []
    for text, metadata, distance in zip(docs, metas, distances):
        meta = metadata or {}
        source_document_id = str(meta.get("document_id", ""))
        if not text or not source_document_id:
            continue
        candidates.append({
            "document_id": source_document_id,
            "title": str(meta.get("title", "Knowledge article")),
            "section_path": str(meta.get("section_path", "")),
            "source": str(meta.get("source_url", meta.get("source_path", ""))),
            "review_status": str(meta.get("review_status", "draft")),
            "distance": float(distance),
            "text": str(text),
        })

    limit = max(1, min(top_k, 10))
    selected: list[dict[str, Any]] = []
    selected_ids: set[str] = set()
    per_document: dict[str, int] = {}

    # Targeted website-guide requests need several useful chunks from that
    # article. General searches still favor breadth across source articles.
    if document_id:
        return candidates[:limit]

    # First pass gives every relevant source article a chance to appear.
    for item in candidates:
        if item["document_id"] in selected_ids:
            continue
        selected.append(item)
        selected_ids.add(item["document_id"])
        per_document[item["document_id"]] = 1
        if len(selected) >= limit:
            return selected

    # Only use a second chunk from an article when the corpus has fewer unique
    # matching articles than the requested result count.
    for item in candidates:
        document_id = item["document_id"]
        if per_document.get(document_id, 0) >= 2:
            continue
        selected.append(item)
        per_document[document_id] = per_document.get(document_id, 0) + 1
        if len(selected) >= limit:
            break
    return selected
