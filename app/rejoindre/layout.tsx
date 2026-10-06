import type { Metadata } from 'next'

// Landing de parrainage (/rejoindre?ref=CODE, servie sous /fr/ et /pt/) : contenu propre à chaque lien, jamais indexée.
// Les variantes ?ref= sont en plus exclues par app/robots.ts ('/*?ref=*').
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
