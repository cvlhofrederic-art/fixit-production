import type { Metadata } from 'next'

// Page qui lit les paramètres d'URL côté navigateur (useSearchParams) : en rendu statique, Next ne pré-rendrait que le
// repli Suspense (sans h1, fil d'Ariane ni contenu pour les robots). Rendu à chaque requête, comme avant le passage
// aux layouts statiques par langue (components/common/CoquilleRacine.tsx).
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Rechercher un artisan | VITFIX',
  description: 'Trouvez un artisan qualifié près de chez vous. Plombier, électricien, serrurier, jardinier, comparez les avis et réservez en ligne.',
  // Canonical = page sans filtres. Les variantes avec query (?category=,
  // ?q=, ?page=) sont bloquées par robots.txt (faceted navigation).
  alternates: {
    canonical: 'https://vitfix.io/fr/recherche/',
    languages: {
      'fr-FR': 'https://vitfix.io/fr/recherche/',
      'pt-PT': 'https://vitfix.io/pt/pesquisar/',
      'en': 'https://vitfix.io/en/',
      'x-default': 'https://vitfix.io/',
    },
  },
  openGraph: {
    title: 'Rechercher un artisan | VITFIX',
    description: 'Trouvez un artisan qualifié près de chez vous. Comparez les avis et réservez en ligne.',
    type: 'website',
    url: 'https://vitfix.io/fr/recherche/',
    siteName: 'VITFIX',
    locale: 'fr_FR',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
