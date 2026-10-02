from __future__ import annotations

import chromadb

from rag.config import CHROMA_PATH, COLLECTIONS, EMBEDDING_MODEL, EMBEDDING_REVISION


def get_client():
    CHROMA_PATH.mkdir(parents=True, exist_ok=True)
    return chromadb.PersistentClient(path=str(CHROMA_PATH))


def get_collection(domain: str):
    if domain not in COLLECTIONS:
        raise ValueError(f"Unknown domain {domain!r}; choose one of {sorted(COLLECTIONS)}")
    client = get_client()
    name = COLLECTIONS[domain]
    existing = {item.name for item in client.list_collections()}
    if name in existing:
        collection = client.get_collection(name=name)
        recorded_model = (collection.metadata or {}).get("embedding_model")
        recorded_revision = (collection.metadata or {}).get("embedding_revision")
        if recorded_model != EMBEDDING_MODEL or recorded_revision != EMBEDDING_REVISION:
            raise RuntimeError(
                f"Collection {name} was built with {recorded_model}@{recorded_revision}; "
                f"configured model is {EMBEDDING_MODEL}@{EMBEDDING_REVISION}. "
                "Use a new collection version and re-ingest; vectors must not be mixed."
            )
        return collection
    return client.create_collection(
        name=name,
        metadata={
            "domain": domain,
            "environment": "local-draft",
            "embedding_model": EMBEDDING_MODEL,
            "embedding_revision": EMBEDDING_REVISION,
            "distance_note": "unit-normalized embeddings; Chroma default L2 gives cosine-equivalent ranking",
        },
    )
