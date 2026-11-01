import type { Metadata } from 'next'
import GererMarcheClient from '@/app/fr/marches/gerer/GererMarcheClient'

// Page qui lit les paramètres d'URL côté navigateur (useSearchParams) : en rendu statique, Next ne pré-rendrait que le
// repli Suspense (sans h1, fil d'Ariane ni contenu pour les robots). Rendu à chaque requête, comme avant le passage
// aux layouts statiques par langue (components/common/CoquilleRacine.tsx).
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Gerir o meu pedido de orçamento',
  description: 'Acompanhe o seu pedido de orçamento e consulte as candidaturas recebidas dos profissionais.',
  // Page de gestion par lien à jeton (?id&token) : jamais indexée, comme son jumeau /fr/marches/gerer/.
  // Hors sitemaps (app/sitemap/[id]/route.ts, lib/sitemap-pt-pages.ts).
  robots: { index: false, follow: false },
  alternates: {
    canonical: 'https://vitfix.io/pt/mercados/gerir/',
    languages: {
      'pt-PT': 'https://vitfix.io/pt/mercados/gerir/',
      'fr-FR': 'https://vitfix.io/fr/marches/gerer/',
      'x-default': 'https://vitfix.io/pt/mercados/gerir/',
    },
  },
}

export default function GerirMercadoPage() {
  return <GererMarcheClient isPt={true} />
}
