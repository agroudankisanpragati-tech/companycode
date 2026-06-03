import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import { AuthProvider } from "@/context/AuthContext";
// Header and footer are rendered per-page (home uses them). Keep layout minimal.

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "Agroudan Kisan pragati LLP | AI-Powered Smart Farming & Crop Advisory",
  description:
    "Get expert crop guidance, weather insights, market prices, and smart farming solutions with Agroudan Kisan pragati. Empowering farmers with AI.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="description" content="Get expert crop guidance, weather insights, market prices, and smart farming solutions with Agroudan Kisan pragati. Empowering farmers with AI." />
        <link rel="canonical" href="https://www.agroudan.in/" />

        {/* Open Graph */}
        <meta property="og:site_name" content="Agroudan Kisan pragati LLP" />
        <meta property="og:title" content="Agroudan Kisan pragati LLP | AI-Powered Smart Farming & Crop Advisory" />
        <meta property="og:description" content="Get expert crop guidance, weather insights, market prices, and smart farming solutions with Agroudan Kisan pragati. Empowering farmers with AI." />
        <meta property="og:url" content="https://www.agroudan.in/" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/images/logo-og.svg" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Agroudan Kisan pragati LLP | AI-Powered Smart Farming & Crop Advisory" />
        <meta name="twitter:description" content="Get expert crop guidance, weather insights, market prices, and smart farming solutions with Agroudan Kisan pragati." />
        <meta name="twitter:image" content="/images/logo-og.svg" />

        {/* Icons */}
        <link rel="icon" href="/images/logo-192x192.png" sizes="192x192" />
        <link rel="apple-touch-icon" href="/images/logo-192x192.png" />

        {/* JSON-LD structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: `{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://www.agroudan.in/#org",
      "name": "Agroudan Kisan pragati LLP",
      "url": "https://www.agroudan.in/",
      "logo": "https://www.agroudan.in/images/logo-192x192.png",
      "sameAs": [
        "https://www.facebook.com/yourpage",
        "https://twitter.com/yourhandle",
        "https://www.linkedin.com/company/yourcompany"
      ],
      "contactPoint": [{
        "@type": "ContactPoint",
        "telephone": "+91-XXXXXXXXXX",
        "contactType": "customer service",
        "areaServed": "IN",
        "availableLanguage": "Hindi"
      }]
    },
    {
      "@type": "WebSite",
      "@id": "https://www.agroudan.in/#website",
      "url": "https://www.agroudan.in/",
      "name": "Agroudan Kisan pragati LLP | AI-Powered Smart Farming & Crop Advisory",
      "description": "Get expert crop guidance, weather insights, market prices, and smart farming solutions with Agroudan Kisan pragati. Empowering farmers with AI.",
      "publisher": {"@id": "https://www.agroudan.in/#org"},
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://www.agroudan.in/search?q={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type":"ListItem","position":1,"name":"Home","item":"https://www.agroudan.in/"},
        {"@type":"ListItem","position":2,"name":"Crop Advisory","item":"https://www.agroudan.in/crop-advisory/"},
        {"@type":"ListItem","position":3,"name":"Weather Forecast","item":"https://www.agroudan.in/weather/"},
        {"@type":"ListItem","position":4,"name":"Market Prices","item":"https://www.agroudan.in/market-prices/"}
      ]
    }
  ]
}`,
          }}
        />
      </head>
      <body className="bg-white text-gray-900">
        <AuthProvider>
          <main id="top" className="min-h-screen">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
