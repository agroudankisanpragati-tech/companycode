from __future__ import annotations

import json
from datetime import datetime, timezone

from rag.chroma_store import get_collection
from rag.config import BATCH_SIZE, COLLECTIONS, EMBEDDING_MODEL, EMBEDDING_REVISION, MANIFEST_DIR
from rag.embedding_provider import embed_passages, tokenizer
from rag.markdown_chunker import chunk_document
from rag.source_loader import load_sources


def main() -> None:
    docs, excluded = load_sources()
    tok = tokenizer()
    by_domain = {"website": [], "agriculture": []}
    for doc in docs:
        by_domain[doc.domain].append(doc)

    summary = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "embedding_model": EMBEDDING_MODEL,
        "embedding_revision": EMBEDDING_REVISION,
        "collections": {},
        "excluded": excluded,
        "warning": "Local draft index only; not approved for farmer-facing answers.",
    }

    for domain, collection_name in COLLECTIONS.items():
        collection = get_collection(domain)
        domain_docs = by_domain[domain]
        chunk_records = []
        for doc in domain_docs:
            chunk_records.extend((doc, chunk) for chunk in chunk_document(doc, tok))

        # Replace only records belonging to source articles in this domain.
        if chunk_records:
            ids_to_replace = sorted({doc.document_id for doc, _ in chunk_records})
            for document_id in ids_to_replace:
                collection.delete(where={"document_id": document_id})

            for start in range(0, len(chunk_records), BATCH_SIZE):
                batch = chunk_records[start:start + BATCH_SIZE]
                texts = [chunk.text for _, chunk in batch]
                vectors = embed_passages(texts)
                collection.add(
                    ids=[chunk.chunk_id for _, chunk in batch],
                    documents=texts,
                    metadatas=[chunk.metadata for _, chunk in batch],
                    embeddings=vectors.tolist(),
                )

        summary["collections"][domain] = {
            "name": collection_name,
            "source_documents": len(domain_docs),
            "chunks_written": len(chunk_records),
            "collection_count": collection.count(),
        }

    MANIFEST_DIR.mkdir(parents=True, exist_ok=True)
    manifest_path = MANIFEST_DIR / "ingestion_manifest.json"
    manifest_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"\nManifest: {manifest_path}")


if __name__ == "__main__":
    main()
