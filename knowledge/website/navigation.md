---
id: website-navigation
domain: website
language: en
status: draft-verified-from-repository
source: frontend/src/app route files, Navbar, FarmerSidebar, and ShopkeeperSidebar
---

# Website navigation map

## Open the signed-in dashboard

When a signed-in user asks to open **my dashboard** or **the dashboard**, the assistant routes according to the account role:

1. Farmer accounts open `/dashboard/farmer`.
2. Shopkeeper accounts open `/dashboard/shopkeeper`.
3. A signed-out user is sent to `/auth/login`; after signing in, the app routes according to the account role.

The assistant does not read or expose private dashboard values just by navigating to the page. Account-specific records must be read from the signed-in page itself.

## Farmer dashboard pages

These signed-in farmer destinations are available from the farmer dashboard and sidebar:

- Dashboard: `/dashboard/farmer`
- My Crops: `/dashboard/farmer/my-crops`
- My Tasks: `/dashboard/farmer/tasks`
- Farm Activities: `/dashboard/farmer/activities`
- My Recommendations: `/dashboard/farmer/recommendations`
- AI Suggestions: `/dashboard/farmer/ai-suggestions`
- Crop Health: `/dashboard/farmer/crop-health`
- Soil Health: `/dashboard/farmer/soil-health`
- Fertilizer Calculator: `/dashboard/farmer/fertilizer-calculator`
- Market: `/dashboard/farmer/market`
- Profile: `/dashboard/farmer/profile`
- Edit Profile: `/dashboard/farmer/edit-profile`
- Rewards: `/dashboard/farmer/rewards`
- Crop Recommendation History: `/crop-recommendation/history`

The global crop recommendation form is `/crop-recommendation`; disease scanning is `/disease-detection`. Both workflows have separate guides. The dashboard and its pages may require sign-in.

## Shopkeeper dashboard pages

These signed-in shopkeeper destinations are available in the shopkeeper area:

- Dashboard: `/dashboard/shopkeeper`
- Products: `/dashboard/shopkeeper/products`
- Nursery products: `/dashboard/shopkeeper/products/nursery`
- Fertilizer products: `/dashboard/shopkeeper/products/fertilizer`
- Business profile: `/dashboard/shopkeeper/profile`
- Edit profile: `/dashboard/shopkeeper/edit-profile`.
- Complete profile: `/dashboard/shopkeeper/complete-profile`

The dashboard destination is selected from the signed-in account role. Do not send a shopkeeper to the farmer dashboard or a farmer to the shopkeeper dashboard.

## Public and shared pages

- Home: `/`
- Login: `/auth/login`; account entry is also available at `/auth`.
- Registration: `/auth/register`.
- AI Assistant page: `/ai-assistant`.
- Crop Recommendation: `/crop-recommendation`.
- Disease Detection: `/disease-detection`.
- Soil Health: `/soil-health`.
- Weather: `/weather`.
- Mandi / Market Prices: `/mandi-prices`.
- KVK Finder: `/kvk`.
- Marketplace: `/marketplace`; shop listings: `/marketplace/shops` (the `/shops` route redirects here).
- Government Schemes: `/schemes`; Seva Mitra: `/schemes/seva-mitra`.
- Farmer Stories: `/farmer-stories`.
- About: `/about`; Contact: `/contact`; Gallery: `/gallery`; Blog: `/blog`; Careers: `/careers`.
- Rajasthan portal: `/rajasthan`.

Dynamic detail pages, such as a particular shop, blog article, certificate, or scheme, need the relevant name or identifier. If the request does not identify one, open its listing page or ask which item the user means.

## Navigation and workflow boundaries

- A direct command such as “open the dashboard” should navigate immediately.
- A question asking how to use a feature should answer with steps and navigate to that feature when an actionable destination is known.
- For a page already open, answer about its workflow without routing back to the same page.
- Navigation does not fill forms, submit scans, make purchases, or change account settings.
- Live weather, market prices, nearby KVK results, and private account data must come from their live pages or services. This static map does not contain those values.
- Scheme routes are listed for navigation only. This guide does not provide scheme eligibility or benefit advice.
- Links that depend on authentication remain subject to the page's sign-in gate.
