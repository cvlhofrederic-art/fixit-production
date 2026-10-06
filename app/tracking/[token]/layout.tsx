import type { Metadata } from 'next'

// Suivi d'intervention par lien à jeton (position de l'artisan, adresse de la mission) : page privée, jamais indexée.
// La page est 'use client' : sans ce layout, elle hérite de robots index, follow du layout racine.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function TrackingLayout({ children }: { children: React.ReactNode }) {
  return children
}
