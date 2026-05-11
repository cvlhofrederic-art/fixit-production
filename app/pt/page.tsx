// Home page Vitfix Portugal — server component qui injecte les schémas
// JSON-LD spécifiques PT (HomeAndConstructionBusiness avec rating + adresse
// Porto + opening hours + BreadcrumbList) puis rend le HomePage client.
//
// Les schémas globaux (WebSite + Organization) sont injectés par
// app/layout.tsx, ceux-ci s'ajoutent pour rendre la home PT éligible aux
// rich results "Local Business" sur Google (sinon GSC dit "Cette URL ne peut
// pas être optimisée" — vérifié via URL Inspection le 9 mai 2026).

import type { Metadata } from 'next'
import HomePage from '../page'
import {
  buildBusinessSchema,
  buildBreadcrumbSchema,
  buildSchemaGraph,
} from '@/lib/schemas'

export const metadata: Metadata = {
  title: 'Profissionais de construção em Portugal | Vitfix',
  description:
    'Encontre profissionais verificados em Marco de Canaveses, Penafiel, Amarante, Porto e região do Tâmega e Sousa. Canalizador, eletricista, pintor — orçamento grátis 24/7.',
  alternates: {
    canonical: 'https://vitfix.io/pt/',
    // hreflang complet hérité de app/pt/layout.tsx (fr-FR, pt-PT, en, nl,
    // es, x-default → /). Pas de surcharge ici : Next.js merge les
    // metadata, déclarer `languages` au niveau page produisait des
    // doublons d'entrées (pt-PT × 2, x-default × 2 avec destinations
    // contradictoires) que Google ignore ou pénalise.
  },
}

const HOME_URL = 'https://vitfix.io/pt/'

// Coordonnées Porto (centre-ville). Source : seo-pages-data.ts CITIES[porto].
const PORTO_LAT = 41.1579
const PORTO_LNG = -8.6291

const ptHomeSchema = buildSchemaGraph(
  buildBusinessSchema({
    locale: 'pt',
    city: {
      name: 'Porto',
      postalCode: '4000-001',
      lat: PORTO_LAT,
      lng: PORTO_LNG,
    },
    description:
      'Plataforma de profissionais verificados para obras e reparações em Porto e na região do Tâmega e Sousa. Canalizador, eletricista, pintor, faz-tudo. Orçamento grátis em 24h.',
    serviceTypes: [
      'Canalizador',
      'Eletricista',
      'Pintor',
      'Pladur e Tetos Falsos',
      'Obras e Remodelação',
      'Faz Tudo',
      'Serralheiro',
      'Telhador',
      'Vidraceiro',
      'Impermeabilização',
      'Isolamento Térmico',
      'Desentupimento',
    ],
  }),
  buildBreadcrumbSchema([{ name: 'Início', url: HOME_URL }]),
)

export default function PtHomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ptHomeSchema) }}
      />
      <HomePage />
    </>
  )
}
