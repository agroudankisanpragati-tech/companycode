from __future__ import annotations

import json
from datetime import datetime, timezone

from rag.config import (
    CHUNK_MAX_TOKENS,
    CHUNK_OVERLAP_TOKENS,
    CHUNK_TARGET_TOKENS,
    COLLECTIONS,
    EMBEDDING_MODEL,
    EMBEDDING_REVISION,
    KNOWLEDGE_ROOT,
    MANIFEST_DIR,
)
from rag.retriever import retrieve_chunks


def _evaluate_file(domain: str, path, top_k: int = 5) -> dict:
    cases = json.loads(path.read_text(encoding="utf-8"))["cases"]
    rows = []
    found = 0
    found_at_1 = 0
    found_at_3 = 0
    answerable_total = 0

    for case in cases:
        expected = set(case.get("expected_document_ids", []))
        retrieved_rows = retrieve_chunks(domain, case["question"], top_k)
        retrieved = [str(item.get("document_id", "")) for item in retrieved_rows]
        hit = bool(expected.intersection(retrieved)) if expected else None
        hit_at_1 = bool(expected.intersection(retrieved[:1])) if expected else None
        hit_at_3 = bool(expected.intersection(retrieved[:3])) if expected else None
        if expected:
            answerable_total += 1
            found += int(hit)
            found_at_1 += int(hit_at_1)
            found_at_3 += int(hit_at_3)
        rows.append({
            "id": case["id"],
            "language": case.get("language"),
            "answerable_from_static_corpus": case.get("answerable_from_static_corpus", case.get("answerable_from_current_corpus")),
            "expected_document_ids": sorted(expected),
            "retrieved_document_ids": retrieved,
            "expected_source_in_top_k": hit,
            "expected_source_in_top_1": hit_at_1,
            "expected_source_in_top_3": hit_at_3,
            "unique_documents_in_top_k": len(set(retrieved)),
            "distances": [item["distance"] for item in retrieved_rows],
            "reason": case.get("reason"),
        })

    return {
        "collection": COLLECTIONS[domain],
        "evaluation_file": str(path.relative_to(KNOWLEDGE_ROOT)),
        "top_k": top_k,
        "answerable_recall_at_k": (found / answerable_total) if answerable_total else None,
        "answerable_recall_at_1": (found_at_1 / answerable_total) if answerable_total else None,
        "answerable_recall_at_3": (found_at_3 / answerable_total) if answerable_total else None,
        "answerable_cases": answerable_total,
        "cases": rows,
        "note": "Retrieval-only report. Out-of-scope abstention and generated answer quality require separate review.",
    }


def main() -> None:
    if not COLLECTIONS:
        raise RuntimeError("No collections configured")
    reports = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "embedding_model": EMBEDDING_MODEL,
        "embedding_revision": EMBEDDING_REVISION,
        "chunk_settings": {
            "target_tokens": CHUNK_TARGET_TOKENS,
            "max_tokens": CHUNK_MAX_TOKENS,
            "overlap_tokens": CHUNK_OVERLAP_TOKENS,
        },
        "website": _evaluate_file("website", KNOWLEDGE_ROOT / "website" / "evaluation" / "questions.json"),
        "agriculture": _evaluate_file("agriculture", KNOWLEDGE_ROOT / "agriculture" / "evaluation" / "questions.json"),
    }
    MANIFEST_DIR.mkdir(parents=True, exist_ok=True)
    output = MANIFEST_DIR / "retrieval_evaluation.json"
    output.write_text(json.dumps(reports, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(reports, ensure_ascii=False, indent=2))
    print(f"\nEvaluation report: {output}")


if __name__ == "__main__":
    main()
