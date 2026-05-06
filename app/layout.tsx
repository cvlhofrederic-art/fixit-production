import type { Metadata } from "next";
// Suspense removed from root layout to fix React hydration error #419
import { DM_Sans } from "next/font/google";
import { Syne } from "next/font/google";
import { Montserrat } from "next/font/google";
import { Outfit } from "next/font/google";
import { cookies, headers } from "next/headers";
import "./globals.css";
import ConditionalLayout from "@/components/common/ConditionalLayout";
import CookieConsent from "@/components/common/CookieConsent";
import Providers from "@/components/common/Providers";
import ConsentAnalytics from "@/components/common/ConsentAnalytics";
import WebVitalsReporter from "@/components/common/WebVitalsReporter";
import type { Locale } from "@/lib/i18n/config";
import { CONTACT_EMAIL, PHONE_FR, PHONE_PT } from "@/lib/constants";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

// Outfit utilisé sur les dashboards syndic + copro. Conservé global car
// référencé dans app/globals.css via plusieurs sélecteurs scopés #syndic-dashboard
// + #copro-dashboard. Les dashboards layouts (app/syndic/dashboard/layout.tsx,
// app/coproprietaire/dashboard/layout.tsx) le redéfinissent aussi en local
// pour cohérence d'arborescence.
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

// Playfair_Display + IBM_Plex_Sans/Mono déplacés hors du layout global :
// - Playfair Display → app/syndic/dashboard/layout.tsx + app/coproprietaire/dashboard/layout.tsx
// - IBM Plex Sans/Mono → app/rfq/repondre/[token]/layout.tsx
// Économie ~150-300KB sur les pages publiques (perf SEO 2026, LCP mobile).

const sharedMeta = {
  authors: [{ name: "Vitfix SAS" }] as Metadata['authors'],
  creator: "Vitfix SAS",
  publisher: "Vitfix SAS",
  // 2026 GEO/AEO best practice : autoriser explicitement les snippets
  // longs et les images larges aux crawlers (Google + AI engines).
  // Sans ces directives, AI Overviews / ChatGPT / Perplexity peuvent
  // tronquer ou ignorer le contenu.
  // Référence : developers.google.com/search/docs/crawling-indexing/robots-meta-tag
  robots: {
    index: true,
    follow: true,
    nocache: false,
    'max-snippet': -1,
    'max-image-preview': 'large',
    'max-video-preview': -1,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  } satisfies Metadata['robots'],
  alternates: {
    languages: {
      'fr': 'https://vitfix.io/fr/',
      'pt': 'https://vitfix.io/pt/',
      'en': 'https://vitfix.io/en/',
      'nl': 'https://vitfix.io/nl/',
      'es': 'https://vitfix.io/es/',
    },
  },
}

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies()
  const locale = (cookieStore.get('locale')?.value || 'fr') as Locale

  // NL and ES landing pages — fall back to EN metadata
  if (locale === 'nl') {
    return {
      ...sharedMeta,
      title: "VITFIX - Vastgoeddiensten Porto voor Nederlandse Investeerders",
      description: "Renovatie, loodgieter, elektricien en onderhoud voor Nederlandse vastgoedeigenaren in Porto.",
      openGraph: {
        title: "VITFIX - Vastgoeddiensten Porto",
        description: "Geverifieerde vakmensen voor renovatie en onderhoud in Porto.",
        siteName: "VITFIX",
        locale: "nl_NL",
        type: "website",
      },
    }
  }

  if (locale === 'es') {
    return {
      ...sharedMeta,
      title: "VITFIX - Servicios para Viviendas en Oporto para Inversores",
      description: "Reformas, fontaner\u00eda, electricista y mantenimiento para inversores espa\u00f1oles en Oporto.",
      openGraph: {
        title: "VITFIX - Servicios Oporto",
        description: "Profesionales verificados para reformas y mantenimiento en Oporto.",
        siteName: "VITFIX",
        locale: "es_ES",
        type: "website",
      },
    }
  }

  if (locale === 'en') {
    return {
      ...sharedMeta,
      title: "VITFIX - Find Home Service Professionals in Porto",
      description: "Find and book verified, English-speaking home service professionals in Porto. Plumbing, electrical, handyman and more.",
      openGraph: {
        title: "VITFIX - English Speaking Home Services in Porto",
        description: "Verified professionals for plumbing, electrical, handyman and property maintenance in Porto.",
        siteName: "VITFIX",
        locale: "en_GB",
        type: "website",
      },
    }
  }

  if (locale === 'pt') {
    return {
      ...sharedMeta,
      title: "VITFIX - Encontre o profissional perto de si, em 2 cliques",
      description: "Encontre e reserve um profissional verificado perto de si em poucos cliques. Canalização, eletricidade, jardinagem e mais.",
      openGraph: {
        title: "VITFIX - Profissionais verificados perto de si",
        description: "Encontre e reserve um profissional certificado em poucos cliques. Canalização, eletricidade, serralharia e mais.",
        siteName: "VITFIX",
        locale: "pt_PT",
        type: "website",
      },
    }
  }

  return {
    ...sharedMeta,
    title: "VITFIX - Trouvez l'artisan près de chez vous, en 2 clics",
    description: "Trouvez et réservez un artisan vérifié près de chez vous en quelques clics. Plomberie, électricité, jardinage et plus.",
    openGraph: {
      title: "VITFIX - Artisans vérifiés près de chez vous",
      description: "Trouvez et réservez un artisan certifié en quelques clics. Plomberie, électricité, serrurerie et plus.",
      siteName: "VITFIX",
      locale: "fr_FR",
      type: "website",
    },
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read locale: x-locale header (set by middleware from URL path) takes priority
  // over cookie, which may be stale when middleware updates it in the response
  const cookieStore = await cookies()
  const headerStore = await headers()
  const locale = (headerStore.get('x-locale') || cookieStore.get('locale')?.value || 'fr') as Locale


  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <meta name="csrf-protection" content="same-origin" />
        <meta name="theme-color" content="#FFD600" />
        {/* favicon (icon.svg) + apple-touch-icon (apple-icon.tsx) auto-injectés
            par Next.js via app/icon.svg + app/apple-icon.tsx */}
        <link rel="manifest" href="/manifest.json" />
        {/* hreflang SEO tags */}
        <link rel="alternate" hrefLang="fr" href="https://vitfix.io/fr/" />
        <link rel="alternate" hrefLang="pt" href="https://vitfix.io/pt/" />
        <link rel="alternate" hrefLang="en" href="https://vitfix.io/en/" />
        <link rel="alternate" hrefLang="nl" href="https://vitfix.io/nl/" />
        <link rel="alternate" hrefLang="es" href="https://vitfix.io/es/" />
        <link rel="alternate" hrefLang="x-default" href="https://vitfix.io/" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@context': 'https://schema.org',
                  '@type': 'WebSite',
                  '@id': 'https://vitfix.io/#website',
                  name: 'VITFIX',
                  url: 'https://vitfix.io',
                  inLanguage: locale === 'en' ? 'en' : locale === 'pt' ? 'pt-PT' : locale === 'nl' ? 'nl' : locale === 'es' ? 'es' : 'fr-FR',
                  potentialAction: {
                    '@type': 'SearchAction',
                    target: locale === 'pt'
                      ? 'https://vitfix.io/pt/pesquisar/?q={search_term_string}'
                      : locale === 'en'
                        ? 'https://vitfix.io/en/?q={search_term_string}'
                        : 'https://vitfix.io/fr/recherche/?q={search_term_string}',
                    'query-input': 'required name=search_term_string',
                  },
                },
                {
                  '@context': 'https://schema.org',
                  '@type': ['Organization', 'HomeAndConstructionBusiness'],
                  '@id': 'https://vitfix.io/#business',
                  name: 'VITFIX',
                  alternateName: 'Vitfix',
                  legalName: 'Vitfix SAS',
                  url: 'https://vitfix.io',
                  logo: { '@type': 'ImageObject', url: 'https://vitfix.io/logo.png' },
                  image: 'https://vitfix.io/og-image.png',
                  description: locale === 'pt'
                    ? 'Plataforma de profissionais verificados para reparações e obras — canalização, eletricidade, faz-tudo em Portugal.'
                    : 'Plateforme d\'artisans vérifiés pour vos travaux — plomberie, électricité, maçonnerie, peinture en France et au Portugal.',
                  knowsLanguage: ['pt-PT', 'fr-FR', 'en'],
                  email: CONTACT_EMAIL,
                  telephone: PHONE_FR,
                  contactPoint: [
                    {
                      '@type': 'ContactPoint',
                      contactType: 'customer support',
                      telephone: PHONE_FR,
                      areaServed: 'FR',
                      availableLanguage: ['French', 'English'],
                    },
                    {
                      '@type': 'ContactPoint',
                      contactType: 'customer support',
                      telephone: PHONE_PT,
                      areaServed: 'PT',
                      availableLanguage: ['Portuguese', 'English'],
                    },
                  ],
                  // areaServed : Country + AdministrativeArea seulement.
                  // Les City individuelles sont portées par les service pages
                  // (lib/schemas/index.ts buildBusinessSchema avec city local).
                  // Évite 31 entrées × 80 chars sur CHAQUE page (review #140).
                  areaServed: [
                    { '@type': 'Country', name: 'France' },
                    { '@type': 'Country', name: 'Portugal' },
                    { '@type': 'AdministrativeArea', name: 'Provence-Alpes-Côte d\'Azur, France' },
                    { '@type': 'AdministrativeArea', name: 'Norte, Portugal' },
                  ],
                  priceRange: '€€',
                  // aggregateRating intentionnellement OMIS de l'Organization
                  // globale (review #140) :
                  // - Évite incohérence avec ratings per-locale dans
                  //   lib/schemas/index.ts (4.8 FR / 4.9 PT).
                  // - Service pages portent leurs propres ratings localisés.
                  // - Pas de risque Google "Inconsistent ratings warning".
                  // sameAs, address, taxID, foundingDate intentionnellement omis
                  // tant que les données réelles ne sont pas fournies par l'utilisateur.
                },
              ],
            }),
          }}
        />
      </head>
      <body suppressHydrationWarning className={`${dmSans.variable} ${syne.variable} ${montserrat.variable} ${outfit.variable} font-sans antialiased`}>
        <Providers locale={locale}>
          <a href="#main-content" className="skip-to-content">
            {locale === 'en' || locale === 'nl' ? 'Skip to main content' : locale === 'pt' ? 'Ir para o conte\u00fado principal' : locale === 'es' ? 'Ir al contenido principal' : 'Aller au contenu principal'}
          </a>
          <ConditionalLayout>
            <main id="main-content">
              {children}
            </main>
          </ConditionalLayout>
          <CookieConsent />
        </Providers>
        <ConsentAnalytics />
        <WebVitalsReporter />
      </body>
    </html>
  );
}
