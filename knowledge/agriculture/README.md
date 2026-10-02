# Agriculture knowledge base

Status: starter corpus, not yet comprehensive. Initial entries are drafts summarized from the linked official sources and need review by an agricultural subject-matter reviewer before operational use.

This folder is separate from `Ai/knowledge_base/`, which contains Python assistant modules, and from the application's MongoDB-backed crop and disease records. It is a source-traceable reference corpus; it does not replace those systems or contain user-specific/live data.

## Scope in this phase

- General, source-backed crop-planning context (not crop selection recommendations).
- General, source-backed irrigation context (not a watering schedule).
- General, source-backed soil-test interpretation principles.
- General integrated pest management principles.
- A field-question checklist and out-of-scope examples for retrieval evaluation.
- A source and quality audit of existing repository agriculture material.

Crop-specific packages, disease/pest treatment guides, pesticide product/dose recommendations, government schemes, weather/market data, and region-specific calendars are not yet included. They require current, crop- and location-appropriate authoritative references. Unsupported or missing material must be marked `UNKNOWN / REQUIRES SOURCE` rather than filled in from model memory.

## How to add or use an entry

Each article should cover one topic and carry metadata for its ID, topic, geography, crop/stage if relevant, source URL and publisher, publication/revision date when known, date checked, and review status. Keep user steps or agronomic actions in numbered order. Cite the specific official source next to the claim it supports. Separate general information from local recommendations.

Use the current crop-specific directions from a State Agricultural University, ICAR institute/KVK, or another appropriate official authority when the advice depends on location, crop variety, growth stage, season, soil, pest pressure, or product label. Never turn a model prediction, user report, training example, or uncited database field into verified knowledge merely because it is present in the application.

## Contents

- `source-audit.md` — what existing project material can and cannot support.
- `safety-and-scope.md` — response boundaries and unresolved topics.
- `metadata-and-review.md` — article metadata and acceptance workflow.
- `sources.md` — source register and scope notes.
- `crop-planning/context-needed.md` — why crop planning needs local resource context.
- `irrigation/locally-specific-water-planning.md` — why watering guidance must be crop/system-specific.
- `soil/using-soil-test-results.md` — limited general guidance on using a lab report.
- `pest-management/ipm-principles.md` — general IPM principles.
- `evaluation/questions.json` — starter retrieval/answerability questions; not farmer-facing knowledge.
