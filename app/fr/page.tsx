// Home page Vitfix France — server component qui injecte les schémas
// JSON-LD spécifiques FR (HomeAndConstructionBusiness avec rating + adresse
// Marseille + opening hours + BreadcrumbList) puis rend le HomePage client.
//
// Parité avec app/pt/page.tsx : les schémas globaux (WebSite + Organization)
// viennent de app/layout.tsx, ceux-ci s'ajoutent pour rendre la home FR
// éligible aux rich results "Local Business" sur Google.

import type { Metadata } from 'next'
import HomePage from '../page'
import {
  buildBusinessSchema,
  buildBreadcrumbSchema,
  buildSchemaGraph,
} from '@/lib/schemas'

export const metadata: Metadata = {
  title: 'Artisans à Marseille et PACA | Vitfix',
  description: 'Trouvez un artisan qualifié à Marseille et en région PACA. Devis gratuit, avis vérifiés.',
  alternates: { canonical: 'https://vitfix.io/fr/' },
}

const HOME_URL = 'https://vitfix.io/fr/'

// Coordonnées Marseille (centre-ville Vieux-Port).
// Source : lib/data/fr-seo-pages-data.ts FR_CITIES[marseille].
const MARSEILLE_LAT = 43.2965
const MARSEILLE_LNG = 5.3698

const frHomeSchema = buildSchemaGraph(
  buildBusinessSchema({
    locale: 'fr',
    city: {
      name: 'Marseille',
      postalCode: '13001',
      lat: MARSEILLE_LAT,
      lng: MARSEILLE_LNG,
    },
    description:
      'Plateforme d\'artisans qualifiés et vérifiés à Marseille et en région PACA. Plombier, électricien, peintre, plaquiste, jardinier, débarrasseur. Devis gratuit sous 24h, intervention rapide.',
    serviceTypes: [
      'Plombier',
      'Électricien',
      'Peintre',
      'Plaquiste',
      'Jardinier',
      'Paysagiste',
      'Carreleur',
      'Serrurier',
      'Maçon',
      'Climatisation',
      'Rénovation',
      'Débouchage canalisation',
    ],
  }),
  buildBreadcrumbSchema([{ name: 'Accueil', url: HOME_URL }]),
)

export default function FrHomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(frHomeSchema) }}
      />
      <HomePage />
    </>
  )
}
