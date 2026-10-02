# Ingestion and reindexing lifecycle

Status: implementation checklist; no ingestion code is present yet.

## One-time/local prototype flow

1. Read the allowlisted source directories and exclude READMEs, evaluation sets, audit notes, code, and generated data.
2. Validate required front-matter fields and apply the status mapping in `CHROMA_DATA_MODEL.md`. Reject malformed metadata, missing citations for agriculture advice, unrecognized status, and any document marked `needs-update` or `retired`; exclude implementation notes, READMEs, audits, and evaluation files.
3. For development retrieval experiments, allow `draft-source-backed` only in a clearly named local draft collection. Production collection ingestion must require an explicit approved/reviewed status.
4. Normalize Markdown conservatively; preserve numbering, source links, units, headings, and warnings. Do not rewrite agronomic claims during normalization.
5. Chunk with the strategy in `CHUNKING_AND_EMBEDDING_SPEC.md` and attach source metadata to every chunk.
6. Embed with the pinned model/revision; record model and preparation versions. Fail the build if text count and vector count differ or a vector has an unexpected dimension.
7. Upsert deterministic chunk IDs into a new versioned Chroma collection. Persist document text and citations with each vector.
8. Produce an ingestion manifest with article IDs/versions, included/excluded counts and reasons, chunk count, model revision, elapsed time, and warnings.
9. Run retrieval evaluation and manually inspect failures. Do not switch the application to the new collection if evaluation regresses or the corpus includes unreviewed records.

## Updating an article

1. Edit the canonical Markdown article and update source/review metadata.
2. Re-run metadata validation and review the source diff.
3. Re-chunk and re-embed the changed article using the same pinned configuration.
4. Remove or deactivate all chunks from the superseded article version in the candidate index.
5. Re-run questions linked to that article, plus negative/out-of-scope checks.
6. Promote the candidate collection only after review; keep the previous collection for rollback.

## Reproducibility and operations

- Pin Chroma, embedding library, model revision, tokenizer, normalization, chunker version, and collection configuration.
- Keep generated embeddings and Chroma storage out of Git; keep only source articles, ingestion configuration, evaluation inputs, and non-sensitive manifests.
- Do not store secrets in manifests or commit environment files.
- Back up production Chroma data and document restore/rollback before enabling farmer traffic.
- Local Chroma persistence is for development/evaluation; Chroma's official Python reference recommends a server-backed instance for production. See [Python client reference](https://docs.trychroma.com/reference/python).
