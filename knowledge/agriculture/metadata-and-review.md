# Agriculture article metadata and review workflow

Every article that may be indexed should have YAML front matter with:

| Field | Meaning |
| --- | --- |
| `id` | Stable unique article identifier; do not reuse for a different topic. |
| `domain` | Always `agriculture` for this folder. |
| `topic` | Controlled topic such as crop-planning, irrigation, soil-testing, disease, or pest-management. |
| `geography` | The places where the source actually applies; use `India; general principles` only when the source supports that scope. |
| `crop` | Crop or crop group, or `all` only for genuinely general material. |
| `growth_stage` | Stage if relevant; otherwise `all` or `not-specified`. |
| `source` | Direct source URL or stable local source identifier. |
| `publisher` | Publishing authority / institution. |
| `published` | Source publication/revision date when known; otherwise `unknown`. |
| `date_checked` | Date the source was checked. |
| `status` | `draft-source-backed`, `reviewed`, `needs-update`, or `retired`. |
| `review` | Reviewer role/name and date, or `requires agricultural subject-matter review`. |

## Acceptance sequence

1. Start from an official or otherwise approved source that directly supports the claim. Prefer ICAR institutes/KVKs, State Agricultural Universities and relevant government technical publications. Match source geography and crop scope to the article.
2. Summarize in plain language without extending the source's claims. Keep local rates, dates, thresholds, product uses, and yield/economic claims only when a current, directly applicable source supports them.
3. Cite the source beside the relevant section and include it in `sources.md`.
4. Review the article for crop, locality, growth stage, units, ambiguity, safety implications, and outdated details. Anything not confirmed remains `UNKNOWN / REQUIRES SOURCE`.
5. Obtain subject-matter review for actionable advice. Until then, keep `status: draft-source-backed` and do not treat it as approved answer material.
6. Add answerable and unanswerable questions to `evaluation/questions.json`; expected sources and refusal boundaries must be clear.
7. On source change or correction, update metadata and re-review affected content. Do not leave stale embeddings active after the later ingestion stage.

Markdown articles are the editorial source of truth. Chunks, embeddings, and vector records will be generated artifacts that can be rebuilt from approved article versions.
