import type { Metadata } from 'next'
import { preload } from 'react-dom'
import './polices-rfq.css'

// IBM Plex Sans/Mono utilisé sur la page de réponse RFQ par token (route privée
// non indexable, accès via lien email). Chargé localement au lieu de la coquille racine (components/common/CoquilleRacine.tsx)
// pour ne pas alourdir les pages publiques (perf SEO 2026). Polices auto-hébergées :
// polices-rfq.css, fichiers dans public/fonts/web.

// Page privée (lien à jeton envoyé par e-mail au fournisseur) : jamais indexée.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function RfqTokenLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Fichiers latins préchargés, comme le faisait next/font/google.
  for (const fichier of [
    '03fc1b4a8d284b5e-s.p.0wiir8udbzjvx.woff2',
    '99e609270109b47d-s.p.40sczeszzbjw1.woff2',
    'effe91970fc4db64-s.p.0oace-s_gkfks.woff2',
  ])
    preload(`/fonts/web/${fichier}`, { as: 'font', type: 'font/woff2', crossOrigin: '' })
  return (
    <div className="police-ibm-plex-sans police-ibm-plex-mono">
      {children}
    </div>
  )
}
