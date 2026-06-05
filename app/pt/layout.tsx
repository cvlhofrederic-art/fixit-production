import type { Metadata } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL('https://vitfix.io'),
  title: {
    default: 'VITFIX Portugal, Canalizador, Eletricista, Pintor | Orçamento grátis',
    template: '%s | VITFIX Portugal',
  },
  description: 'Encontre um profissional verificado em Marco de Canaveses, Penafiel, Amarante e toda a região do Tâmega e Sousa. Canalizador, eletricista, pintor, faz-tudo. Orçamento grátis, 7 dias por semana.',
  // hreflang BCP 47 — codes régionaux pour cibler explicitement Portugal
  // (vs Brésil) et France (vs Canada). Cohérent avec les hreflang du root
  // layout app/layout.tsx et avec la décision business "marchés stricts".
  alternates: {
    languages: {
      'pt-PT': 'https://vitfix.io/pt/',
      'fr-FR': 'https://vitfix.io/fr/',
      'en': 'https://vitfix.io/en/',
      'nl': 'https://vitfix.io/nl/',
      'es': 'https://vitfix.io/es/',
      'x-default': 'https://vitfix.io/',
    },
  },
  // Manifest PT dédié — name/description en portugais, scope: '/pt/',
  // start_url: '/pt/'. PWA installée depuis vitfix.io/pt/* reste en PT.
  manifest: '/pt/manifest.webmanifest',
  openGraph: {
    title: 'VITFIX Portugal : Profissionais Verificados',
    description: 'Canalizador, eletricista, pintor e faz-tudo na região do Tâmega e Sousa. Orçamento grátis.',
    siteName: 'VITFIX',
    locale: 'pt_PT',
    type: 'website',
    images: [{ url: 'https://vitfix.io/api/og/?locale=pt', width: 1200, height: 630 }],
  },
}

export default function PtLayout({ children }: { children: React.ReactNode }) {
  return children
}
