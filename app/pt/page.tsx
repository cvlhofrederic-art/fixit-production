// Re-export root homepage — PT locale injected via LanguageProvider
export { default } from '../page'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Profissionais de construção em Portugal | Vitfix',
  description: 'Encontre profissionais qualificados para obras e reparações em Porto e região Norte.',
  alternates: { canonical: 'https://vitfix.io/pt' },
}
