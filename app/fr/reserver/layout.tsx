import type { Metadata } from 'next'

// Page qui lit les paramètres d'URL côté navigateur (useSearchParams) : en rendu statique, Next ne pré-rendrait que le
// repli Suspense (sans h1, fil d'Ariane ni contenu pour les robots). Rendu à chaque requête, comme avant le passage
// aux layouts statiques par langue (components/common/CoquilleRacine.tsx).
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Réserver un artisan | VITFIX',
  description: 'Réservez un artisan vérifié en quelques clics. Choisissez votre créneau, confirmez et recevez votre confirmation instantanément.',
  openGraph: {
    title: 'Réserver un artisan | VITFIX',
    description: 'Réservez un artisan vérifié en quelques clics. Confirmation instantanée.',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
