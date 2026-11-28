import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Inscription Syndic — VITFIX',
  description: 'Créez votre compte syndic professionnel sur VITFIX. Gérez vos copropriétés et artisans.',
  alternates: { canonical: 'https://vitfix.io/syndic/register/' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
