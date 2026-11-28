import type { Metadata } from 'next'
import PageIntrouvable from '@/components/common/PageIntrouvable'

// notFound() levé par une page /en/… (slug inconnu d'une route rendue à la demande) : le serveur ne rend qu'une
// coquille vide (comportement de Next pour une page qui lève notFound()), puis le navigateur affiche cette 404 dans la
// coquille de la langue. Les URL sans route et les slugs inconnus des routes en dynamicParams = false passent par
// app/global-not-found.tsx.
export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
}

export default function NotFound() {
  return <PageIntrouvable locale="en" />
}
