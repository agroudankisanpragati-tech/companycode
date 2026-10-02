---
id: website-crop-recommendation
domain: website
language: en
status: draft-verified-from-repository
source: frontend/src/app/crop-recommendation/page.tsx and frontend/src/components/crop/FarmerInputForm.tsx; screenshot review
---

# Crop Recommendation

## Request a recommendation

1. Sign in before requesting recommendations. If signed out, use the page's login link.
2. Complete the form sections in order: **Farm Details**, **Soil Information**, **Water & Climate**, and **Farming Preferences**. An existing Soil Health report may prefill supported values when opened through its crop-recommendation link; review the values before submitting.
3. Enter a positive **Farm Area** and choose the matching unit: acre, bigha, or hectare. The field's minimum is 0.1.
4. Enter **Budget (₹)**. It is required; the browser field sets a minimum of ₹1,000.
5. Choose a **State** from the list and enter the **District**. Village is optional.
6. Choose a **Soil Type** from Loamy, Sandy, Sandy Loam, Clay, Clay Loam, Black, Red, Alluvial, or Laterite. Enter **Soil pH** from a soil test/report when possible. The form displays a 0–14 range, but its validation treats 0 as missing; do not enter 0 as a workaround.
7. Choose **Water Availability** (Low, Medium, or High) and an **Irrigation Type** (Drip, Sprinkler, Flood, Canal, Borewell, or Rainfed). Water Availability defaults to Medium; irrigation must be selected.
8. Choose a **Season**: Kharif, Rabi, Zaid, or Year-round. **Farming Type** defaults to Conventional and can be changed to Organic or Mixed.
9. Optionally enter village, Organic Carbon, Nitrogen, Phosphorus, Potassium, annual rainfall, average temperature, previous crop, and preferred crop. Leave unknown optional measurements blank instead of guessing.
10. Select **Get AI Crop Recommendations** and wait while the form analyzes the farm conditions. Review the resulting recommendation cards and their source label.

The form uses inputs and dropdowns; it does not use checkboxes. The page can provide category filters, a result-language selector, feedback controls, and a link to crop recommendation history. Exact result controls depend on the returned results.

## How to interpret the page

The assistant may receive only the first displayed crop name and its recommended seed variety as live page context. It does not receive the entire form, all recommendation cards, or the ranking evidence. For a current recommendation, use the result shown on the page. The site's generated result is a tool output; this website guide does not validate agronomic correctness or replace local expert advice.
