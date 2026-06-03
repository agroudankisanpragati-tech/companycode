SEO & Search Console — quick steps

1) Verify your site in Google Search Console
- Preferred: Add a *Domain* property (covers all subdomains) and verify via DNS TXT record.
- Or: Add a *URL prefix* property `https://www.agroudan.in/` and verify via one of: HTML file upload, meta tag, Google Analytics, or Google Tag Manager.
- Example meta tag (paste inside the `<head>` of your layout):

  <meta name="google-site-verification" content="YOUR_VERIFICATION_TOKEN" />

2) Submit your sitemap
- Ensure `https://www.agroudan.in/sitemap.xml` is publicly reachable (we added `/sitemap.xml`).
- In GSC: Select property → Sitemaps → enter `sitemap.xml` → Submit.
- You can ping Google after uploading a sitemap:

  curl "https://www.google.com/ping?sitemap=https://www.agroudan.in/sitemap.xml"

3) Verify `robots.txt`
- Confirm `https://www.agroudan.in/robots.txt` is accessible and not blocking important pages.
- We added `robots.txt` pointing to the sitemap.

4) Request indexing for important pages
- Use URL Inspection → enter the page URL → Request Indexing for newly created or updated pages (homepage, Crop Advisory, Weather, Market Prices).

5) Test and monitor
- Use the Coverage and Sitemaps reports in GSC to check status and errors.
- Use these tools to validate pages:
  - Rich Results Test: https://search.google.com/test/rich-results
  - Mobile-Friendly Test: https://search.google.com/test/mobile-friendly
  - URL Inspection in GSC

6) Best practices to encourage sitelinks
- Keep a clear hierarchy and visible nav linking to key pages (Home, Crop Advisory, Weather, Market Prices, Disease Detection, Dashboard, Contact).
- Use unique titles and meta descriptions for each key page.
- Use structured data (Organization, WebSite, Breadcrumb) — already added to layout head.
- Avoid duplicate content; use canonical tags where needed.

7) When to resubmit
- Major structure changes or sitemap updates: re-submit sitemap in GSC.
- New high-priority page: use URL Inspection → Request Indexing.

File references
- Layout where meta tag/verification can be added: frontend/src/app/layout.tsx
- Sitemap: /sitemap.xml (frontend/public/sitemap.xml)
- Robots: /robots.txt (frontend/public/robots.txt)

If you want, I can create a short `deploy` script to auto-generate an updated `sitemap.xml` from your routes and upload it during deploy.
