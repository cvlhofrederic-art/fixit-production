import type { Metadata } from 'next'
import type { Locale } from '@/lib/i18n/config'

/**
 * Métadonnées de l'ancien layout racine unique (app/layout.tsx), partagées par les layouts racine :
 * - statiques, un par langue : app/{pt,fr,en,nl,es}/layout.tsx (locale fixée par le dossier) ;
 * - dynamique, pages communes servies par réécriture : app/(commun)/layout.tsx (locale lue dans le cookie).
 *
 * Next fusionne les métadonnées clé par clé, de la racine vers la page ({ ...parent, ...enfant }) : un layout de
 * langue qui déclare title, description, openGraph ou alternates remplace ces clés et hérite des autres
 * (authors, creator, publisher, verification, robots).
 */
export const METADONNEES_PARTAGEES = {
  authors: [{ name: 'VITFIX' }] as Metadata['authors'],
  creator: 'VITFIX',
  publisher: 'VITFIX',
  // Google Search Console verification (URL Prefix method).
  // Génère <meta name="google-site-verification" content="..." /> dans le <head>.
  verification: {
    google: 'L5Xcai6puTpFfvMAQ7zvOinxUsg6u5YGfqhRNdVp34Y',
  },
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
  // hreflang BCP 47 régionalisé (fr-FR, pt-PT) cohérent avec app/fr/layout.tsx
  // et app/pt/layout.tsx — cible explicitement France (vs Canada/Belgique) et
  // Portugal (vs Brésil). `x-default` pointe vers `/` : Google sert cette URL
  // aux utilisateurs dont l'Accept-Language ne match aucun locale listé.
  // Sources :
  //   developers.google.com/search/docs/specialty/international/localized-versions
  //   developers.google.com/search/blog/2013/04/x-default-hreflang-for-international-pages
  alternates: {
    languages: {
      'fr-FR': 'https://vitfix.io/fr/',
      'pt-PT': 'https://vitfix.io/pt/',
      'en': 'https://vitfix.io/en/',
      'nl': 'https://vitfix.io/nl/',
      'es': 'https://vitfix.io/es/',
      'x-default': 'https://vitfix.io/',
    },
  },
}

/** Métadonnées du layout racine pour une langue : les clés partagées, puis titre, description et Open Graph. */
export function metadonneesRacine(locale: Locale): Metadata {
  // NL and ES landing pages - fall back to EN metadata
  if (locale === 'nl') {
    return {
      ...METADONNEES_PARTAGEES,
      title: 'VITFIX - Vastgoeddiensten Porto voor Nederlandse Investeerders',
      description: 'Renovatie, loodgieter, elektricien en onderhoud voor Nederlandse vastgoedeigenaren in Porto.',
      openGraph: {
        title: 'VITFIX - Vastgoeddiensten Porto',
        description: 'Geverifieerde vakmensen voor renovatie en onderhoud in Porto.',
        siteName: 'VITFIX',
        locale: 'nl_NL',
        type: 'website',
      },
    }
  }

  if (locale === 'es') {
    return {
      ...METADONNEES_PARTAGEES,
      title: 'VITFIX - Servicios para Viviendas en Oporto para Inversores',
      description: 'Reformas, fontaner\u00eda, electricista y mantenimiento para inversores espa\u00f1oles en Oporto.',
      openGraph: {
        title: 'VITFIX - Servicios Oporto',
        description: 'Profesionales verificados para reformas y mantenimiento en Oporto.',
        siteName: 'VITFIX',
        locale: 'es_ES',
        type: 'website',
      },
    }
  }

  if (locale === 'en') {
    return {
      ...METADONNEES_PARTAGEES,
      title: 'VITFIX - Find Home Service Professionals in Porto',
      description: 'Find and book verified, English-speaking home service professionals in Porto. Plumbing, electrical, handyman and more.',
      openGraph: {
        title: 'VITFIX - English Speaking Home Services in Porto',
        description: 'Verified professionals for plumbing, electrical, handyman and property maintenance in Porto.',
        siteName: 'VITFIX',
        locale: 'en_GB',
        type: 'website',
      },
    }
  }

  if (locale === 'pt') {
    return {
      ...METADONNEES_PARTAGEES,
      title: 'VITFIX - Encontre o profissional perto de si, em 2 cliques',
      description: 'Encontre e reserve um profissional verificado perto de si em poucos cliques. Canalização, eletricidade, jardinagem e mais.',
      openGraph: {
        title: 'VITFIX - Profissionais verificados perto de si',
        description: 'Encontre e reserve um profissional certificado em poucos cliques. Canalização, eletricidade, serralharia e mais.',
        siteName: 'VITFIX',
        locale: 'pt_PT',
        type: 'website',
      },
    }
  }

  return {
    ...METADONNEES_PARTAGEES,
    title: "VITFIX - Trouvez l'artisan près de chez vous, en 2 clics",
    description: 'Trouvez et réservez un artisan vérifié près de chez vous en quelques clics. Plomberie, électricité, jardinage et plus.',
    openGraph: {
      title: 'VITFIX - Artisans vérifiés près de chez vous',
      description: 'Trouvez et réservez un artisan certifié en quelques clics. Plomberie, électricité, serrurerie et plus.',
      siteName: 'VITFIX',
      locale: 'fr_FR',
      type: 'website',
    },
  }
}
