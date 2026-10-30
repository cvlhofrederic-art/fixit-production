import type { Metadata } from 'next'
import CoquilleRacine from '@/components/common/CoquilleRacine'
import { metadonneesRacine } from '@/lib/seo/metadonnees-racine'

// Layout racine des pages /pt/ (il n'y a plus de app/layout.tsx) : <html lang="pt-PT">, <head> et entité unique
// #business viennent de la coquille commune (components/common/CoquilleRacine.tsx), avec la locale fixée par le
// dossier, sans cookies() ni headers() ; les pages SEO (servicos, precos, perto-de-mim, blog, cidade) sont donc
// pré-rendues au build et servies telles quelles par le Worker (cache en assets statiques, open-next.config.ts).
// Métadonnées : celles de l'ancien layout racine (robots, verification,
// authors…) puis les clés ci-dessous, comme Next les fusionnait entre app/layout.tsx et ce fichier.
export const metadata: Metadata = {
  ...metadonneesRacine('pt'),
  metadataBase: new URL('https://vitfix.io'),
  // Phase 1 SEO PT (point 1.4) : la marque une seule fois. Les pages fournissent un titre sans
  // marque (lib/seo/pt-meta.ts) et ce template l'ajoute ; cible 35 à 65 caractères.
  title: {
    default: 'Profissionais de construção verificados em Portugal',
    template: '%s | VITFIX',
  },
  description: 'Profissionais verificados em 22 concelhos do Porto, Braga e Aveiro: canalizador, eletricista, pintor, faz-tudo. Orçamento grátis pelo site ou WhatsApp.',
  // hreflang BCP 47 — codes régionaux pour cibler explicitement Portugal
  // (vs Brésil) et France (vs Canada). x-default sur /fr/ (locale par défaut du
  // middleware, répond 200) et non sur /, qui redirige en 302 (phase 1 SEO PT, point 1.5).
  alternates: {
    languages: {
      'pt-PT': 'https://vitfix.io/pt/',
      'fr-FR': 'https://vitfix.io/fr/',
      'en': 'https://vitfix.io/en/',
      'nl': 'https://vitfix.io/nl/',
      'es': 'https://vitfix.io/es/',
      'x-default': 'https://vitfix.io/fr/',
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
  return <CoquilleRacine locale="pt">{children}</CoquilleRacine>
}
