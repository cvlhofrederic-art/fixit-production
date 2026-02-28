import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ConditionalLayout from "@/components/ConditionalLayout";
import CookieConsent from "@/components/CookieConsent";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VITFIX - Trouvez l'artisan pr\u00E8s de chez vous, en 2 clics",
  description: "Trouvez et r\u00E9servez un artisan v\u00E9rifi\u00E9 pr\u00E8s de chez vous en quelques clics. Plomberie, \u00E9lectricit\u00E9, jardinage et plus.",
  authors: [{ name: "Vitfix SAS" }],
  creator: "Vitfix SAS",
  publisher: "Vitfix SAS",
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  openGraph: {
    title: "VITFIX - Artisans v\u00E9rifi\u00E9s pr\u00E8s de chez vous",
    description: "Trouvez et r\u00E9servez un artisan certifi\u00E9 en quelques clics. Plomberie, \u00E9lectricit\u00E9, serrurerie et plus.",
    siteName: "VITFIX",
    locale: "fr_FR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'VITFIX',
    description: "Trouvez et r\u00e9servez un artisan v\u00e9rifi\u00e9 pr\u00e8s de chez vous en quelques clics.",
    url: 'https://vitfix.fr',
    logo: 'https://vitfix.fr/logo.png',
    areaServed: { '@type': 'Country', name: 'France' },
    serviceType: ['Plomberie', '\u00c9lectricit\u00e9', 'Serrurerie', 'Jardinage', 'Peinture', 'R\u00e9novation'],
    priceRange: '\u20ac\u20ac',
  }

  return (
    <html lang="fr">
      <head>
        <meta name="csrf-protection" content="same-origin" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'VITFIX',
              url: 'https://vitfix.fr',
              potentialAction: {
                '@type': 'SearchAction',
                target: 'https://vitfix.fr/recherche/?q={search_term_string}',
                'query-input': 'required name=search_term_string',
              },
            }),
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <a href="#main-content" className="skip-to-content">
          Aller au contenu principal
        </a>
        <ConditionalLayout>
          <main id="main-content" role="main">
            {children}
          </main>
        </ConditionalLayout>
        <CookieConsent />
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
