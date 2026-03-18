import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Rechercher un artisan | VITFIX',
  description: 'Trouvez un artisan qualifié près de chez vous. Plombier, électricien, serrurier, jardinier — comparez les avis et réservez en ligne.',
  openGraph: {
    title: 'Rechercher un artisan | VITFIX',
    description: 'Trouvez un artisan qualifié près de chez vous. Comparez les avis et réservez en ligne.',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
