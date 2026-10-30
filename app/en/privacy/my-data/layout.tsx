import type { Metadata } from 'next'

// Espace RGPD du compte (export / suppression des données) : page privée, jamais indexée.
// La page ne déclare pas de métadonnées (elle rend le composant client components/legal/MesDonneesRgpd) : sans ce
// layout, elle hérite de robots index, follow du layout racine.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
