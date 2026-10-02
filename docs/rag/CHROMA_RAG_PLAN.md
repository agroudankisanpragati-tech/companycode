# Chroma RAG plan

Status: local draft prototype with a development-only website RAG path. Ingestion and retrieval scripts are in `Ai_assistant/rag/`; a loopback-only Python bridge supplies website evidence to the existing backend LLM when `WEBSITE_RAG_ENABLED=true` and `NODE_ENV=development`. Production integration and agriculture retrieval remain pending review.

## Chosen direction

- Use Chroma as the vector store.
- Keep editable source articles under root `knowledge/`.
- Keep the RAG implementation in a new `Ai_assistant/` area, as proposed in `Ai/Ai_assistant_folder_strucutre.md`, rather than repurposing `Ai/knowledge_base/` (Python response modules) or changing disease/voice systems.
- Keep separate logical collections for website and agriculture knowledge.
- Pass only retrieved static knowledge to the answer generator. Continue to obtain live data and account/page context through their existing routes and APIs.
- Treat this as retrieval and answering. It is not an autonomous site agent and must not perform transactions or account-changing actions.

## Important distinction

Chroma stores document text, metadata, and embeddings and performs similarity search/filtering. It does not decide the editorial chunk boundaries. The ingestion code must parse Markdown and split it into chunks. An embedding function/model must convert both stored chunks and user queries into vectors. Chroma can call a configured embedding function, or the application can supply vectors; the implementation must use one explicit, reproducible choice for both indexing and querying. See [Chroma embeddings](https://docs.trychroma.com/guides/embeddings) and [Chroma collections](https://docs.trychroma.com/docs/overview/architecture).

## Proposed request path

1. Accept the user's latest question and the selected response language.
2. Route it to `website`, `agriculture`, or a live-data/context handler. Do not send private records or live values into the static corpus.
3. Normalize the search query without losing the original. For Hindi and other supported languages, evaluate direct multilingual retrieval and the current English-normalization pipeline; select using the evaluation set, not assumption.
4. Embed the search query with the same embedding model/version used for the selected collection.
5. Query only the matching Chroma collection and filter out unapproved documents for production.
6. Apply a relevance threshold/abstention rule; do not fill a missing retrieval result from unsupported model memory.
7. Provide the LLM the question, response-language instruction, retrieved excerpts with citations, and any explicitly relevant live page data. Ask it to preserve numbered workflows and state uncertainty.
8. Return citations from retrieved article metadata; if evidence is insufficient, ask for context or say the corpus does not contain verified guidance.

## Environments

- **Local prototype:** Chroma `PersistentClient` with a local, ignored data directory is suitable for development/evaluation. Chroma's official Python reference describes it as intended for local development and testing.
- **Production:** prefer a server-backed Chroma deployment with explicit persistence, authentication/network controls, backups, resource monitoring, and pinned versions. Do not expose Chroma directly to the browser. The backend service should be the only application-facing caller. See [Chroma Python client reference](https://docs.trychroma.com/reference/python).

## Phases

1. **Corpus gate:** retain approved source articles and evaluation records; resolve review status for anything intended for farmer-facing advice.
2. **Ingestion prototype:** parse front matter, chunk by headings/paragraphs, generate deterministic IDs and vectors, and populate local dev collections.
3. **Retrieval evaluation:** measure correct source retrieval, domain leakage, multilingual questions, and out-of-scope abstention.
4. **Runtime integration:** implement a backend retriever behind the existing Pragati AI route, with feature flag, citations, and safe no-evidence behavior.
5. **Operational hardening:** production Chroma service, versioned reindexing, backups, metrics, access controls, rollback procedure.

## Not part of this phase

No changes to existing assistant APIs, LLM/provider choice, frontend, voice model, disease detector, user database, schemes, or live-data services. Do not use generated vector data as source material.
