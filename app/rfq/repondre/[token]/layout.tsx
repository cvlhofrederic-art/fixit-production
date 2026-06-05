import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'

// IBM Plex Sans/Mono utilisé sur la page de réponse RFQ par token (route privée
// non indexable, accès via lien email). Chargé localement au lieu de app/layout.tsx
// pour ne pas alourdir les pages publiques (perf SEO 2026).

const ibmPlexSans = IBM_Plex_Sans({
  variable: '--font-ibm-plex-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

const ibmPlexMono = IBM_Plex_Mono({
  variable: '--font-ibm-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
})

export default function RfqTokenLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={`${ibmPlexSans.variable} ${ibmPlexMono.variable}`}>
      {children}
    </div>
  )
}
