import type { Metadata } from "next";
// Suspense removed from root layout to fix React hydration error #419

import { cookies, headers } from "next/headers";
import "./globals.css";
import ConditionalLayout from "@/components/common/ConditionalLayout";
import CookieConsent from "@/components/common/CookieConsent";
import Providers from "@/components/common/Providers";
import ConsentAnalytics from "@/components/common/ConsentAnalytics";
import type { Locale } from "@/lib/i18n/config";


const sharedMeta = {
  authors: [{ name: "Vitfix SAS" }] as Metadata['authors'],
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
        <meta name="theme-color" content="#FFC107" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
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
              '@type': 'WebSite',
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
            }),
          }}
        />
      </head>
      <body suppressHydrationWarning className="font-sans antialiased">
        <Providers locale={locale}>
          <a href="#main-content" className="skip-to-content">
            {locale === 'en' || locale === 'nl' ? 'Skip to main content' : locale === 'pt' ? 'Ir para o conte\u00fado principal' : locale === 'es' ? 'Ir al contenido principal' : 'Aller au contenu principal'}
          </a>
          <ConditionalLayout>
            <main id="main-content" role="main">
              {children}
            </main>
          </ConditionalLayout>
          <CookieConsent />
        </Providers>
        <ConsentAnalytics />
      </body>
    </html>
  );
}
