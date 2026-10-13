// PT alias for /fr/a-propos - renders the same about page at a Portuguese URL
export { default } from '@/app/fr/a-propos/page'

import type { Metadata } from 'next'

// Phase 1 SEO PT : marque une fois (template du layout) ; pas d'`alternates` ici pour ne pas
// écraser la paire hreflang déclarée par app/pt/sobre/layout.tsx (fusion clé par clé de Next).
export const metadata: Metadata = {
  title: 'Sobre nós: profissionais de confiança em Portugal',
  description: 'Conheça a VITFIX, a plataforma que liga particulares e profissionais de construção verificados em 22 concelhos dos distritos do Porto, Braga e Aveiro.',
}
