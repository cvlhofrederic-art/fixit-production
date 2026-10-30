import { preload } from "react-dom";
import "@/app/polices.css";
import "@/app/globals.css";
import ConditionalLayout from "@/components/common/ConditionalLayout";
import CookieConsent from "@/components/common/CookieConsent";
import Providers from "@/components/common/Providers";
import ConsentAnalytics from "@/components/common/ConsentAnalytics";
import WebVitalsReporter from "@/components/common/WebVitalsReporter";
import type { Locale } from "@/lib/i18n/config";
import { CONTACT_EMAIL, PHONE_FR, PHONE_PT } from "@/lib/constants";
import { ENTITE_PT } from "@/lib/seo/entite-pt";
import { areaServidaPt } from "@/lib/seo/pt-schemas";

/**
 * Coquille HTML commune à tous les layouts racine : <html lang>, <head> (icônes, vérifications, JSON-LD WebSite +
 * entité unique #business), polices auto-hébergées, <body> avec Providers, lien d'évitement, en-tête et pied de
 * page conditionnels, bandeau cookies, mesures.
 *
 * Elle ne lit ni cookies() ni headers() : la locale vient du layout racine qui l'appelle.
 * - app/{pt,fr,en,nl,es}/layout.tsx : locale fixée par le dossier, layouts statiques, pages SEO pré-rendues au build ;
 * - app/(commun)/layout.tsx : pages communes servies par réécriture, locale lue dans l'en-tête x-locale (middleware.ts).
 * Une seule entité #business pour tout le site (phase 1 SEO PT, point 1.6), rendue ici et nulle part ailleurs.
 */

// Pro SEO 2026 : `display: 'swap'` pour éviter le FOIT (Flash of Invisible
// Text) et améliorer le LCP. Le navigateur affiche d'abord la fallback,
// puis swap quand la font est chargée. Critique sur mobile 4G.
// Source : web.dev/articles/font-display + Google Fonts Optimization 2026.
//
// Polices auto-hébergées (app/polices.css, fichiers dans public/fonts/web) : mêmes fichiers,
// règles @font-face et polices de secours que next/font/google, sans téléchargement chez
// Google au build. Classes police-* = variables --font-* (DM Sans, Syne, Montserrat, Outfit).
// Outfit reste global : référencé dans app/globals.css par des sélecteurs scopés
// #syndic-dashboard + #copro-dashboard.

/** Fichiers latins préchargés, comme le faisait next/font/google. */
function prechargerPolices() {
  preload("/fonts/web/5c285b27cdda1fe8-s.p.2_mbdogr7ni8i.woff2", { as: "font", type: "font/woff2", crossOrigin: "" });
  preload("/fonts/web/0c795a286deabae8-s.p.3vm0tq4e-zz_5.woff2", { as: "font", type: "font/woff2", crossOrigin: "" });
  preload("/fonts/web/e8f2fbee2754df70-s.p.1dqa_6e_ad4sj.woff2", { as: "font", type: "font/woff2", crossOrigin: "" });
  preload("/fonts/web/1b99372b3eaef0c8-s.p.1gsd1jahc5dg_.woff2", { as: "font", type: "font/woff2", crossOrigin: "" });
}

// Playfair_Display + IBM_Plex_Sans/Mono déplacés hors du layout global :
// - Playfair Display → app/(commun)/syndic/dashboard/layout.tsx + app/(commun)/coproprietaire/dashboard/layout.tsx
// - IBM Plex Sans/Mono → app/(commun)/rfq/repondre/[token]/layout.tsx
// Économie ~150-300KB sur les pages publiques (perf SEO 2026, LCP mobile).

// Pro SEO 2026 : BCP 47 régionalisé sur <html lang> pour cohérence avec
// hreflang (pt-PT vs pt, fr-FR vs fr). Cible explicitement Portugal (pas
// Brésil) et France (pas Québec/Canada/Belgique). en/nl/es restent
// génériques (un marché par locale).
// Source : https://www.rfc-editor.org/info/bcp47
const BCP47_MAP: Record<string, string> = { pt: 'pt-PT', fr: 'fr-FR' }

export default function CoquilleRacine({
  locale,
  children,
}: Readonly<{
  locale: Locale;
  children: React.ReactNode;
}>) {
  prechargerPolices();
  const htmlLang = BCP47_MAP[locale] ?? locale

  return (
    <html lang={htmlLang} suppressHydrationWarning>
      {/* eslint-disable-next-line @next/next/no-head-element -- coquille des layouts racine App Router, rangée hors de app/ */}
      <head>
        <meta name="csrf-protection" content="same-origin" />
        <meta name="theme-color" content="#FFD600" />
        {/* Windows tiles (Edge legacy / Windows pinned sites) */}
        <meta name="msapplication-TileColor" content="#FFD600" />
        {/* Favicons : Next.js auto-injecte app/favicon.ico + app/icon.png +
            app/apple-icon.png. On déclare en plus les variantes 16/32 explicites
            (hint browsers pour bonne taille) + safari-pinned-tab pour macOS. */}
        <link rel="icon" type="image/png" sizes="16x16" href="/icon-16.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icon-32.png" />
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#FFD600" />
        <link rel="manifest" href="/manifest.json" />
        {/* Yandex Webmaster Tools verification — méthode meta tag, alternative
            non-DNS pour valider la propriété du site sur webmaster.yandex.com.
            Pertinent pour audience investisseurs étrangers ciblant Portugal
            (Yandex couvre marché CIS + diaspora russophone à Lisbonne/Algarve). */}
        <meta name="yandex-verification" content="20aba92ca9d2fbff" />
        {/* hreflang : uniquement par l'API metadata (alternates.languages des layouts et des pages). Des balises
            écrites en dur ici s'ajoutaient sur chaque page à celles de la page (doublons, fr-FR contradictoires). */}
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
                  // Sitelinks Searchbox : target DOIT être un EntryPoint object
                  // (pas une URL string nue) pour déclencher le rich result.
                  // Source : developers.google.com/search/docs/appearance/structured-data/sitelinks-searchbox
                  // PT (phase 1 SEO PT, point 1.6) : pas de SearchAction, /pt/pesquisar/?q= est interdit
                  // par robots.txt et GSC comptait l'URL gabarit comme une page bloquée.
                  ...(locale === 'pt'
                    ? {}
                    : {
                        potentialAction: {
                          '@type': 'SearchAction',
                          target: {
                            '@type': 'EntryPoint',
                            urlTemplate: locale === 'en'
                              ? 'https://vitfix.io/en/?q={search_term_string}'
                              : 'https://vitfix.io/fr/recherche/?q={search_term_string}',
                          },
                          'query-input': 'required name=search_term_string',
                        },
                      }),
                },
                {
                  '@context': 'https://schema.org',
                  '@type': ['Organization', 'HomeAndConstructionBusiness'],
                  '@id': 'https://vitfix.io/#business',
                  name: 'VITFIX',
                  alternateName: 'Vitfix',
                  legalName: 'VITFIX — Empresário em Nome Individual',
                  url: 'https://vitfix.io',
                  logo: { '@type': 'ImageObject', url: 'https://vitfix.io/logo.png' },
                  image: locale === 'pt' ? 'https://vitfix.io/api/og/?locale=pt' : locale === 'fr' ? 'https://vitfix.io/api/og/?locale=fr' : 'https://vitfix.io/api/og/?locale=en',
                  description: locale === 'pt'
                    ? 'Plataforma de profissionais verificados para reparações e obras, canalização, eletricidade, faz-tudo em Portugal.'
                    : 'Plateforme d\'artisans vérifiés pour vos travaux, plomberie, électricité, maçonnerie, peinture en France et au Portugal.',
                  knowsLanguage: ['pt-PT', 'fr-FR', 'en'],
                  email: CONTACT_EMAIL,
                  telephone: locale === 'pt' ? PHONE_PT : PHONE_FR,
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
                  // PT (phase 1 SEO PT, point 1.6) : un seul nœud entreprise pour tout le site, avec
                  // l'adresse réelle du siège (lib/seo/entite-pt.ts) et les 22 concelhos servis ; pas
                  // de priceRange (aucun prix réel affiché). FR : inchangé.
                  ...(locale === 'pt'
                    ? {
                        address: ENTITE_PT.adresse,
                        areaServed: areaServidaPt(),
                      }
                    : {
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
                      }),
                  // knowsAbout : signal E-E-A-T explicit listant les
                  // domaines d'expertise — Google et AI engines utilisent
                  // pour évaluer la pertinence de l'organisation sur des
                  // requêtes. Liste basée sur les services réellement
                  // proposés (FR_SERVICES + PT SERVICES) en 2026.
                  knowsAbout: [
                    'Canalização e desentupimento',
                    'Eletricidade residencial e industrial',
                    'Pintura interior e exterior',
                    'Pladur e tetos falsos',
                    'Obras de remodelação e renovação',
                    'Isolamento térmico e capoto',
                    'Impermeabilização de coberturas e fachadas',
                    'Serralharia e ferro forjado',
                    'Telhados e telhadeiros',
                    'Vidraçaria e janelas',
                    'Plomberie et débouchage',
                    'Électricité résidentielle et industrielle',
                    'Peinture intérieure et extérieure',
                    'Plaquisterie et faux plafonds',
                    'Rénovation et travaux clés en main',
                    'Espaces verts et élagage',
                    'Débarras et nettoyage',
                    'Climatisation et chauffe-eau',
                  ],
                  taxID: 'PT276873297',
                  foundingDate: '2024',
                  // aggregateRating intentionnellement OMIS de l'Organization
                  // globale (review #140) :
                  // - Évite incohérence avec ratings per-locale dans
                  //   lib/schemas/index.ts (4.8 FR / 4.9 PT).
                  // - Service pages portent leurs propres ratings localisés.
                  // - Pas de risque Google "Inconsistent ratings warning".
                },
              ],
            }),
          }}
        />
      </head>
      <body suppressHydrationWarning className="police-dm-sans police-syne police-montserrat police-outfit font-sans antialiased">
        <Providers locale={locale}>
          <a href="#main-content" className="skip-to-content">
            {locale === 'en' || locale === 'nl' ? 'Skip to main content' : locale === 'pt' ? 'Ir para o conteúdo principal' : locale === 'es' ? 'Ir al contenido principal' : 'Aller au contenu principal'}
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
