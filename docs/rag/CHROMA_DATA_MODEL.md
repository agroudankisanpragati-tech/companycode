# Chroma collections and record metadata

Status: implemented in the local draft prototype; see `Ai_assistant/rag/`.

## Collections

Use two collections with independent retrieval and review filters:

- `akp_website_draft_v1`
- `akp_agriculture_draft_v1`

Separate collections make domain routing explicit. Do not place weather, mandi prices, KVK lookup responses, user profiles, private farm records, or chat history in either collection. Government scheme knowledge is deferred.

For the local proof of concept, use Chroma's `PersistentClient` in an ignored generated-data directory. For production, use a server-backed Chroma deployment and configure access controls; don't connect a public browser directly to the vector database. Pin a compatible client/server version. Collection configuration and distance metric must be explicit and recorded; do not rely on a changing default.

## Per-chunk metadata

Store only scalar metadata values supported by the chosen Chroma client/version:

| Key | Example | Purpose |
| --- | --- | --- |
| `domain` | `agriculture` | Domain filter and guard against cross-domain retrieval. |
| `document_id` | `agriculture-ipm-principles` | Stable source article ID. |
| `document_version` | content hash or revision ID | Identify exact indexed source revision. |
| `title` | `Integrated Pest Management` | Citation/display name. |
| `section_path` | `General decision sequence` | Locate chunk in the article. |
| `topic` | `integrated-pest-management` | Query filters and analytics. |
| `geography` | `India; general principles` | Applicability filter. |
| `crop` | `all` or `paddy rice` | Applicability filter. |
| `growth_stage` | `varies` | Applicability filter where relevant. |
| `source_url` | official page URL | Traceable citation. |
| `publisher` | `ICAR` | Source attribution. |
| `source_published` | ISO date or `unknown` | Freshness/context. |
| `date_checked` | ISO date | Review currency. |
| `review_status` | `draft-source-backed` | Production eligibility filter. |
| `chunk_index` | integer | Stable order within the source article. |
| `content_hash` | SHA-256 of normalized chunk text | Detect edits and avoid stale content. |
| `embedding_model` | model identifier and revision | Reproducibility. |

Normalize editorial front-matter `status` to a controlled Chroma `review_status` during ingestion:

| Source status | Indexed `review_status` | Eligible for local draft collection? | Eligible for production? |
| --- | --- | --- | --- |
| `draft-source-backed` | `draft` | Yes, for evaluation only | No |
| `draft-verified-from-repository` | `draft` | Yes, for evaluation only | No |
| `reviewed` | `reviewed` | Yes | Yes, subject to current source and acceptance checks |
| `needs-update` | `needs-update` | No | No |
| `retired` | `retired` | No | No |
| `implementation-audit` or missing/unrecognized status | Excluded | No | No |

The `website/assistant-page-context.md` file is an implementation note (`implementation-audit`), not farmer-facing help, and must not be ingested into the user answer collection. READMEs, evaluation JSON, source audits, and RAG engineering docs are also excluded. The local prototype indexes draft-status material for evaluation only, not production answers.

Keep the full document text in the Chroma record for retrieval and citations, while keeping the editable original Markdown as the canonical copy. Do not store raw user queries or personal context as corpus metadata.

## IDs and versioning

Use deterministic IDs derived from `domain + document_id + document_version + chunk_index + content_hash`. A content change must create a new indexed revision or replace all chunks for that article as one controlled operation. Never leave old and new article chunks active together unintentionally.

For safe reindexing, build new versioned collections, run the evaluation set, then switch the runtime's configured collection names. Keep the old collection until rollback is no longer needed. Do not call Chroma's whole-database `reset` in routine ingestion.

Chroma describes a collection as holding unique IDs, embeddings, optional metadata, and documents, and supports querying/filtering by metadata. See [Chroma architecture](https://docs.trychroma.com/docs/overview/architecture) and [Python reference](https://docs.trychroma.com/reference/python).
