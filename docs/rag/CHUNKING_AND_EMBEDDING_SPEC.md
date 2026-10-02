# Chunking and embedding specification

Status: implemented starting rules for the local prototype. Tune only against retrieval evidence.

## Source parsing

1. Read only Markdown articles under `knowledge/website/` and `knowledge/agriculture/`; skip READMEs, engineering audit notes, evaluation JSON, and implementation documentation unless explicitly classified as indexable later.
2. Parse YAML front matter into metadata. Keep source URLs and review status as metadata; do not mix them into the article's answer content.
3. Split Markdown using heading hierarchy, then paragraph/list boundaries. Keep heading path as chunk context (for example `Disease Detection > Scan steps`).
4. Preserve complete numbered procedures, warnings, and their source citation together when they fit. Never separate a caution or applicability condition from the recommendation it qualifies.
5. When a section is too large, split at paragraph/list-item boundaries and use a small overlap from an adjacent complete paragraph. Do not split inside a sentence, table row, or numbered step.
6. Avoid creating fragments that lack the crop, geography, stage, or question they answer. Add the article title and section heading as a short prefix to the embedded text where that helps clarify a chunk.

## Initial sizing experiment

Use **about 300–500 tokens per chunk** as a first trial, with **roughly 40–60 tokens of overlap** only when a section must be split. These are starting points, not fixed truths. Short source articles may remain a single smaller chunk. Compare alternate sizes on the evaluation questions and inspect retrieved text manually before settling.

Token counts depend on the selected tokenizer. The eventual implementation should report chunk token count, source article ID, section path, and any oversize chunk. For short ordered workflows, preserve the steps as one chunk even if slightly longer than the target.

## Embedding-model requirements

- Use one explicitly configured model and revision for a collection; record both in collection/index metadata.
- Use the same model, revision, normalization, and query/document task settings for ingestion and runtime queries. Rebuild a collection when the model/revision or text-preparation contract changes; do not mix vectors from different embedding spaces.
- The local prototype uses `intfloat/multilingual-e5-small` with `passage:` prefixes for article chunks and `query:` prefixes for queries. The supplied English and Hindi evaluation questions check cross-language retrieval; the model choice remains provisional pending review of evaluation results.
- Record license, model size, CPU/RAM needs, download/network needs, supported language evidence, and query latency before choosing. Do not rely on Chroma's default embedding function as an unreviewed model decision.
- Keep the model choice configurable. The selected model and revision are recorded with the local collections; rebuild collections if the model or preprocessing contract changes.

Chroma supports configured embedding functions and also accepts precomputed embeddings. Its documentation notes that the thin client has no default embedding functions, so the implementation must supply/configure an embedding function explicitly. See [Chroma embeddings](https://docs.trychroma.com/guides/embeddings) and [performance notes](https://docs.trychroma.com/guides/performance).

## Prototype comparison

For each candidate chunk/model configuration, measure at least:

- expected document appears in top 3 and top 5;
- correct domain appears and unrelated domain does not dominate;
- Hindi questions retrieve intended English articles (and vice versa where supported);
- nearest result is genuinely useful rather than merely keyword-adjacent;
- unanswerable, pesticide-dose, disease-diagnosis, live-data, and deferred-scheme questions do not receive fabricated advice.

Store the configuration with the evaluation output so results can be reproduced.
