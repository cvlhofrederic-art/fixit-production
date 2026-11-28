import type { Metadata } from 'next'
import PolitiqueCookies from '@/components/legal/PolitiqueCookies'

export const metadata: Metadata = {
  title: 'Politique de cookies | Vitfix',
  robots: { index: false, follow: true },
}

export default function CookiesPage() {
  return <PolitiqueCookies />
}
