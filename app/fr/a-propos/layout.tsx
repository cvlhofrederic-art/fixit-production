import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'À propos de VITFIX | Notre mission',
  description: 'Découvrez VITFIX, la plateforme qui connecte particuliers et artisans vérifiés. Notre mission : simplifier la réservation de services à domicile.',
  alternates: {
    canonical: 'https://vitfix.io/fr/a-propos/',
    languages: {
      'fr': 'https://vitfix.io/fr/a-propos/',
      'pt': 'https://vitfix.io/pt/sobre/',
      'x-default': 'https://vitfix.io/fr/a-propos/',
    },
  },
  openGraph: {
    title: 'À propos de VITFIX',
    description: 'La plateforme qui connecte particuliers et artisans vérifiés pour des services à domicile rapides et fiables.',
    type: 'website',
    url: 'https://vitfix.io/fr/a-propos/',
    siteName: 'VITFIX',
    locale: 'fr_FR',
  },
}

// AboutPage schema : signale explicitement que la page est À PROPOS
// de l'Organization Vitfix (entity SEO 2026, Knowledge Graph linking).
// mainEntity.@id pointe vers l'Organization globale définie dans
// app/layout.tsx — crée un graphe interne cohérent.
const aboutSchema = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  '@id': 'https://vitfix.io/fr/a-propos/#aboutpage',
  url: 'https://vitfix.io/fr/a-propos/',
  inLanguage: 'fr-FR',
  mainEntity: { '@id': 'https://vitfix.io/#business' },
  breadcrumb: {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/fr/' },
      { '@type': 'ListItem', position: 2, name: 'À propos', item: 'https://vitfix.io/fr/a-propos/' },
    ],
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutSchema) }} />
      {children}
    </>
  )
}
