import type { Metadata } from 'next'

// Confirmation de réservation (?id=…) : page transactionnelle privée, jamais indexée.
// La page est 'use client' : sans ce layout, elle hérite de robots index, follow du layout racine.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function ConfirmationLayout({ children }: { children: React.ReactNode }) {
  return children
}
