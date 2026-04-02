// PT alias for /fr/a-propos — renders the same about page at a Portuguese URL
export { default } from '@/app/fr/a-propos/page'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sobre a Vitfix | Profissionais de confiança',
  description: 'Conheça a Vitfix, a plataforma que conecta particulares e profissionais de construção em Portugal.',
  alternates: { canonical: 'https://vitfix.io/pt/sobre' },
}
