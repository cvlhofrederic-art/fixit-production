import type { Metadata } from 'next'
import type { ReactNode } from 'react'

// CRM du secrétariat : titre de l'onglet et page jamais indexée (robots exclut déjà /admin/).
export const metadata: Metadata = {
  title: { absolute: 'Vitfix CRM' },
  robots: { index: false, follow: false },
}

export default function LayoutCrm({ children }: { children: ReactNode }) {
  return children
}
