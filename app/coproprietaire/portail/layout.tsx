import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Portail Copropriétaire — VITFIX',
  description: 'Accédez au portail copropriétaire VITFIX. Suivez les interventions et signalements de votre copropriété.',
  robots: { index: false, follow: false },
  alternates: { canonical: 'https://vitfix.io/coproprietaire/portail/' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
