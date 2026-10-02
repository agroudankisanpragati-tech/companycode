# Website knowledge

Status: draft, checked against repository routes and page components on 2026-09-29. Screenshots support selected UI states; they do not establish that every behavior is identical in production.

These documents cover navigation and selected user workflows. They do not contain crop-care advice, government-scheme eligibility, live weather or market data, nearby KVK results, or private account data. Those values must come from a live feature/service or the user's signed-in page.

The assistant should format how-to answers as ordered steps, keep each step to one action, and put optional information or cautions in short bullets. Required inputs, optional inputs, authentication, and limits should remain distinct. If the source does not establish an instruction, say so rather than guessing.

## Documents

- `overview.md` — platform overview and starting points.
- `navigation.md` — public routes and role-aware farmer/shopkeeper navigation.
- `account-access.md` — login and registration entry points.
- `farmer-dashboard.md` — farmer dashboard destinations and account-data boundaries.
- `crop-recommendation.md` — verified form inputs, validation, and result flow.
- `disease-detection.md` — scan steps, image hints, history, and result limits.
- `soil-health.md` — report upload and report-history flow.
- `assistant-page-context.md` — live context sent from supported pages and its limits.
- `evaluation/questions.json` — retrieval and answer-boundary cases; not farmer-facing knowledge.

## Source and confidence

The frontend source establishes current routes and many visible controls. Screenshots are useful for layout but include initial and empty states. A feature appearing in the UI does not prove that its backend is configured or that returned advice is accurate. Treat behavior that is not established by either the source or a successful capture as unknown and verify it before presenting it as fact.

The collection is a local draft. Re-ingest it after editing these documents so the website vector collection reflects the current source articles. Dynamic information and private account details must never be copied into static knowledge documents.
