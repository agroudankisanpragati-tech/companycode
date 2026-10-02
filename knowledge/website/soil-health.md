---
id: website-soil-health
domain: website
language: en
status: draft-verified-from-repository
source: frontend/src/app/dashboard/farmer/soil-health/page.tsx and soil components; screenshots
---

# Soil Health reports

1. Sign in and open Soil Health from the farmer dashboard.
2. Choose or drop a soil report file. The screenshot shows PDF, JPG, and PNG support and a 10 MB limit; follow the current page if its accepted formats or limits differ.
3. Start the upload/analysis and wait for it to finish.
4. Review the resulting report. Open My Soil Reports/history to find an earlier report.

The screenshot shows the initial upload and empty-history state, not a completed analysis.

After a report is processed, the page can show a soil-health score and status, soil measurements, and analysis or recommendations. A language selector is present on the result view. Exact interpretation depends on the returned report; this website guide does not validate laboratory results or make independent fertilizer recommendations.

When a report is displayed, the assistant page context is populated with the score/status, N/P/K values, pH, and analysis text where available. It receives no report context before a result exists. Upload only a report you are authorized to share.
