# RAG implementation specifications

These documents describe the next engineering phase. They are planning artifacts, not working ingestion or chatbot code.

## Read in this order

1. `CHROMA_RAG_PLAN.md` — scope, architecture, and phases.
2. `CHUNKING_AND_EMBEDDING_SPEC.md` — source parsing, chunk boundaries, and embedding-model selection.
3. `CHROMA_DATA_MODEL.md` — collections, metadata, IDs, and versioning.
4. `INGESTION_AND_REINDEXING.md` — build, update, and verify index lifecycle.
5. `RETRIEVAL_AND_EVALUATION.md` — retrieval flow and acceptance measures.
6. `IMPLEMENTATION_HANDOFF.md` — proposed code-file layout and implementation guardrails.

The official Chroma references used for these plans are linked in the relevant documents. Verify API details against the pinned Chroma version during implementation; Chroma's clients and APIs evolve.
