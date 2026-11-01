import type { Metadata } from 'next'
import PolitiqueConfidentialite from '@/components/legal/PolitiqueConfidentialite'

export const metadata: Metadata = {
  title: 'Politique de confidentialité | Vitfix',
  robots: { index: false, follow: true },
}

export default function ConfidentialitePage() {
  return <PolitiqueConfidentialite />
}
