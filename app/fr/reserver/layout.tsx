import type { Metadata } from 'next'

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
