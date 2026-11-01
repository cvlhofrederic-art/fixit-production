import type { Metadata } from 'next'
import PolitiqueConfidentialite from '@/components/legal/PolitiqueConfidentialite'

export const metadata: Metadata = {
  title: 'Política de privacidade',
  robots: { index: false, follow: true },
  alternates: { canonical: 'https://vitfix.io/pt/privacidade/' },
}

export default function PrivacidadePage() {
  return <PolitiqueConfidentialite />
}
