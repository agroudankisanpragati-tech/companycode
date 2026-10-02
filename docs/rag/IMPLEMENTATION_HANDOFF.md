# Implementation handoff: local prototype and next phase

The isolated RAG prototype lives under `Ai_assistant/`. A development-only website retrieval path now connects the local Chroma collection through a loopback-only Python bridge to the existing backend LLM. It preserves the existing chat API contract and leaves production behavior disabled by default.

```text
Ai_assistant/
  README.md
  requirements-rag.txt
  config.example.env
  rag/
    __init__.py
    config.py
    source_loader.py
    metadata_validator.py
    markdown_chunker.py
    embedding_provider.py
    chroma_store.py
    ingest.py
    retrieve.py
    evaluate.py
  data/
    chroma/                 # generated, ignored; never commit
  manifests/                # non-sensitive generated reports; decide Git policy
```

The eventual embedding service boundary and call direction must be confirmed against the existing backend and `Ai/` services before implementation. Keep `Ai_assistant/` isolated from `Ai/knowledge_base/` and do not duplicate/replace the current Pragati AI modules.

## Prototype status and remaining evaluation

The local prototype now:

1. reads the explicit `knowledge/` allowlist;
2. validates front matter and source/review status;
3. chunks Markdown while preserving complete numbered steps;
4. embeds with the provisional multilingual E5 small model;
5. writes only to local Chroma draft collections;
6. exposes a loopback-only website retrieval bridge; the existing LLM writes a cited answer only when local development RAG is explicitly enabled;
7. produces an ingestion manifest and an evaluation report with top-one/top-three/top-five retrieval metrics and screenshot-derived questions.

The current model/configuration and distance cutoff are provisional until the expanded evaluation and manual answer review show acceptable English/Hindi retrieval and abstention. Before production, compare at least two chunk settings and two multilingual embedding candidates.

## Second milestone, after the prototype is accepted

Review corpus content and evaluate generated answers. Then design production retrieval integration with reviewed source statuses, broader query coverage, calibrated thresholds, explicit abstention, and answer/source auditing. Keep Chroma behind the backend; no browser credentials or direct browser connection. Add production deployment/backups only after local evaluation passes.

## Guardrails

- Do not change frontend, voice, disease detection, database schemas, or existing APIs in the prototype milestone.
- Do not migrate live Mongo records into Chroma without per-record provenance review.
- Do not index government schemes, private farmer data, chat history, or dynamic data in this phase.
- Do not expose draft-source-backed agriculture content to farmers as approved guidance.
- Read `Ai/Agents.md` before implementation and follow its requirement not to invent unsupported facts.
