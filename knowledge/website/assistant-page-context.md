---
id: website-assistant-page-context
domain: website
language: en
status: implementation-audit
source: frontend/src/hooks/usePageContext.ts, frontend/src/context/AIAssistantContext.tsx, frontend/src/components/AIAssistantWidget.tsx, route source files
---

# Pragati AI: current page context (implementation note)

This is an implementation-facing note, not a promise to site users. The chat widget sends recent conversation messages, selected response language, dashboard context, and the current `pageData` to `/api/ai-assistant/chat`. A page registers its context through `usePageContext`; the hook clears it on unmount. The existence of that payload does not prove that the backend uses every field correctly or that the answer is grounded in a RAG corpus.

| Page/route | Registered context | Data currently sent when available |
| --- | --- | --- |
| `/dashboard/farmer` | `ui` | Page identifier only; no dashboard feature data in this call |
| `/crop-recommendation` | `crop` | Top displayed recommendation crop name and seed variety |
| `/disease-detection` | `disease` | Current displayed result: disease, crop, confidence, severity, causes, solutions, prevention |
| `/dashboard/farmer/soil-health` | `soil` | Current displayed report score/status, N/P/K, pH, analysis text |
| `/weather` | `weather` | Page identifier only; no weather fields in this call |
| `/mandi-prices` | `market` | First displayed result's commodity, market, state, and price fields |
| `/kvk` | `kvk` | Page identifier only; no center fields in this call |
| `/dashboard/farmer/fertilizer-calculator` | `fertilizer` | Fertilizer result represented via `soilData` values |
| `/schemes` and scheme detail/Seva Mitra | `government` | Scheme page data; intentionally out of scope for the current farmer-facing knowledge corpus |

The frontend context type also defines structures for crop, disease, soil, weather, market, KVK, scheme, and other data. A declared type is not evidence that a route populates it. In particular, the weather and KVK routes currently register only their page type, and the farmer dashboard registers `ui`, not the `dashboard` type. The fertilizer route uses `soilData` for fertilizer-result values, which is a mapping inconsistency to review before relying on it.

The widget sends this context with a request; it does not make the assistant an autonomous website agent. It does not authorize or perform account changes, purchases, applications, crop edits, or other actions. Current weather, market results, nearby centers, user crops, and profile data remain live/private data and must not be represented by static articles.

## Screenshot review and remaining gaps

The screenshot set has folders for home, About, Contact, Crop Recommendation, Disease Detection, Farmer Stories, AI Seva Mitra, login/signup, mandi prices, and signed-in dashboard pages. Several dashboard images show different sections or states rather than distinct pages. The public deployed homepage is mixed with mostly local development captures, so the set is not proof of production/local parity. Existing captures are sufficient for this first draft, but not for claiming exhaustive visual or responsive coverage.

Useful optional captures for a later verification pass: successful crop recommendation result; completed disease scan result and error state; completed soil report; registration progression; mobile dashboard and assistant; and assistant answers while on each context-enabled page. Scheme screens are intentionally not used to create scheme guidance.
