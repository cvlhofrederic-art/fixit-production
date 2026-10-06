import type { Metadata } from 'next'

// Espace RGPD du compte (export et suppression des données) : page privée, jamais indexée.
// Sans ce layout, la page 'use client' hérite d'app/confidentialite/layout.tsx (index + canonical de la politique).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  alternates: { canonical: 'https://vitfix.io/fr/confidentialite/mes-donnees/' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
