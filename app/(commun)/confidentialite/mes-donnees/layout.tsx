import type { Metadata } from 'next'

// Espace RGPD du compte (export et suppression des données) : page privée, jamais indexée.
// La page ne déclare pas de métadonnées (elle rend le composant client components/legal/MesDonneesRgpd) : sans ce
// layout, elle hérite d'app/(commun)/confidentialite/layout.tsx (index + canonical de la politique).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  alternates: { canonical: 'https://vitfix.io/fr/confidentialite/mes-donnees/' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
