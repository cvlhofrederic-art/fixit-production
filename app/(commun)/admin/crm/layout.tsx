import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { CHEMIN_MANIFESTE_CRM } from '@/lib/crm/manifeste'

// CRM du secrétariat : titre de l'onglet et page jamais indexée (robots exclut déjà /admin/).
// Manifeste propre : l'écran s'installe comme une application « Vitfix CRM » sur l'ordinateur (lib/crm/manifeste.ts).
export const metadata: Metadata = {
  title: { absolute: 'Vitfix CRM' },
  robots: { index: false, follow: false },
  manifest: CHEMIN_MANIFESTE_CRM,
}

export default function LayoutCrm({ children }: { children: ReactNode }) {
  return children
}
