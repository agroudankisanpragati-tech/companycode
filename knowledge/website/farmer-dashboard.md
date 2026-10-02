---
id: website-farmer-dashboard
domain: website
language: en
status: draft-verified-from-repository
source: frontend/src/app/dashboard/farmer and frontend/src/components/FarmerSidebar.tsx; route files
---

# Farmer dashboard and account pages

## Open the correct dashboard

The farmer dashboard is `/dashboard/farmer`. A signed-in farmer can reach My Crops, My Tasks, Farm Activities, My Recommendations, Crop Health, Soil Health, Fertilizer Calculator, Market, Profile, Edit Profile, Rewards, and Settings from the dashboard/sidebar or their linked routes. A signed-in shopkeeper uses `/dashboard/shopkeeper`; the assistant should choose the dashboard based on the signed-in account role.

The assistant can navigate to a dashboard page, but it does not automatically obtain all private records shown there. Use the signed-in page to view the account's live records and values.

## Dashboard conditions and limits

The farmer dashboard can ask for a location to support location-dependent features. Market and soil-moisture widgets may depend on location or service data. An empty or error state does not establish that no data exists generally; it may reflect missing location, missing service configuration, or no returned matches.

Use Profile to review or edit personal/address details and Settings for preferences. Do not send passwords, one-time codes, or sensitive account details to the chat assistant. Some pages require authentication and can redirect signed-out visitors to login.

This guide maps the dashboard and its destinations. For exact workflow instructions, use the guide for the relevant feature where available; do not guess controls or account-specific data.
