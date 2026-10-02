# Existing agriculture material: source and suitability audit

Audit date: 2026-09-28. This is a repository review, not a verification of every record that may currently exist in a connected database.

## Findings

| Existing material | What it is | Can it be ingested as verified agriculture guidance? | Reason / next step |
| --- | --- | --- | --- |
| `Ai/knowledge_base/*.py` | Assistant routing and response modules that query application data or format replies | No | These are implementation code, not an authoritative reference corpus. Some modules query Mongo collections and use simple regex matching. |
| `Ai/intent_engine/datasets/*/*.json` and `.csv` | Example farmer utterances labeled with an intent such as crop, disease, soil, irrigation, or fertilizer | No | They are intent-classification examples, not sourced answers. Some examples contain symptom or treatment requests and must not be treated as validated diagnoses/advice. |
| `backend/src/scripts/seedCrops.ts` | Hard-coded crop records with cultivation steps, input rates, yield, costs, prices, and profit claims | No | The inspected records provide no citations or regional qualification; market/economic values are time-sensitive. Keep out until each claim is replaced or checked against authoritative, location-specific sources. |
| `backend/src/models/CropKnowledgeBase.ts` / `CropKnowledgeBase` records | Schema for crop suitability and recommendation data | Not by schema alone | It has `sourceType` / `source` fields but no required source URL, publication date, reviewer, or evidence for each claim. AI-generated and manually entered fields need provenance review. |
| `backend/src/models/DiseasePestSolution.ts` / `diseasepestsolutions` records | Admin-managed disease, pest, deficiency, and healthy-condition content; runtime module queries published records | Not by `published` status alone | The schema has a draft/published workflow and useful content fields, but no source citation, version, region, or reviewer fields. Published means application status, not independently verified accuracy. Review each record and attach authoritative evidence before migration. |
| `backend/src/models/SoilStandard.ts` and database records | Soil parameter benchmarks used by soil-related services | Not yet | A model/record does not establish the benchmark authority, analytical method, crop/region applicability, or date. Verify those before reuse. |
| `MD FILES/*.md` forensic / architecture notes | Technical traces of website and AI implementation | No, as agronomic content | Useful to map where data is stored and how it's used; not agriculture references. |
| `context.txt` and `proposed_idea.txt` | Product goals and suggested RAG architecture | No, as agronomic content | They define scope and safety principles, not agricultural evidence. |

## Important implementation distinction

The existing assistant's Python `knowledge_base` package is a code package, not a folder of reviewed agriculture articles. The disease answer path searches the `diseasepestsolutions` Mongo collection and filters for `status: published`. The crop module searches `cropknowledgebases`. These are existing application data paths; this new Markdown corpus has not been connected to them, and writing these files does not change what the chatbot retrieves.

## Safe reuse process

1. Export a review copy of candidate records without secrets or personal farmer data.
2. Record the record ID, crop/pest, claim fields, current status, source/provenance fields, and last update.
3. Locate a current authoritative source for each actionable claim; check crop, geography, growth stage, and label directions where relevant.
4. Mark each record `verified`, `needs correction`, `insufficient source`, or `obsolete`; do not silently rewrite historical data.
5. Only then author a small RAG article with citations and review metadata. Keep AI predictions and live/user-specific values in their proper systems.

No live MongoDB records were exported or inspected in this audit. Their completeness and quality remain `UNKNOWN / REQUIRES SOURCE` until reviewed.
