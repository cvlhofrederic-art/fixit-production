import type { Metadata } from 'next'
import CoquilleRacine from '@/components/common/CoquilleRacine'
import { metadonneesRacine } from '@/lib/seo/metadonnees-racine'

// Layout racine des pages /en/ (il n'y a plus de app/layout.tsx) : <html lang="en">, <head> et entité unique
// #business viennent de la coquille commune (components/common/CoquilleRacine.tsx), avec la locale fixée par le
// dossier, sans cookies() ni headers() ; les pages de service EN sont donc pré-rendues au build et servies telles quelles
// par le Worker (cache en assets statiques, open-next.config.ts).
// Métadonnées : celles de l'ancien layout racine puis les clés ci-dessous.
export const metadata: Metadata = {
  ...metadonneesRacine('en'),
  title: {
    template: '%s | VITFIX Porto',
    default: 'Home Services in Porto | English Speaking Professionals | VITFIX',
  },
  description: 'Find verified, English-speaking home service professionals in Porto. Plumbers, electricians, handymen and more. Free quotes, fast response.',
  openGraph: {
    siteName: 'VITFIX',
    locale: 'en_GB',
    type: 'website',
    images: [{ url: 'https://vitfix.io/api/og/?locale=en', width: 1200, height: 630 }],
  },
  alternates: {
    languages: {
      'pt': 'https://vitfix.io/pt/',
      'fr': 'https://vitfix.io/fr/',
      'en': 'https://vitfix.io/en/',
      'nl': 'https://vitfix.io/nl/',
      'es': 'https://vitfix.io/es/',
      'x-default': 'https://vitfix.io/',
    },
  },
}

export default function EnLayout({ children }: { children: React.ReactNode }) {
  return <CoquilleRacine locale="en">{children}</CoquilleRacine>
}
