import type { Metadata } from 'next'
import PolitiqueCookies from '@/components/legal/PolitiqueCookies'

export const metadata: Metadata = {
  title: 'Política de cookies',
  robots: { index: false, follow: true },
  alternates: { canonical: 'https://vitfix.io/pt/politica-cookies/' },
}

export default function PoliticaCookiesPage() {
  return <PolitiqueCookies />
}
