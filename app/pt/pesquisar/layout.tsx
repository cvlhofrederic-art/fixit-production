import type { Metadata } from 'next'

// Page qui lit les paramètres d'URL côté navigateur (useSearchParams) : en rendu statique, Next ne pré-rendrait que le
// repli Suspense (sans h1, fil d'Ariane ni contenu pour les robots). Rendu à chaque requête, comme avant le passage
// aux layouts statiques par langue (components/common/CoquilleRacine.tsx).
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Pesquisar profissionais verificados na sua zona',
  description: 'Encontre um profissional verificado na sua zona. Canalizador, eletricista, pintor e mais.',
  alternates: {
    canonical: 'https://vitfix.io/pt/pesquisar/',
    // Phase 1 SEO PT : plus d'alternate en vers l'accueil EN (non réciproque), x-default sur la
    // page FR (200) et non sur / (302).
    languages: {
      'pt-PT': 'https://vitfix.io/pt/pesquisar/',
      'fr-FR': 'https://vitfix.io/fr/recherche/',
      'x-default': 'https://vitfix.io/fr/recherche/',
    },
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
