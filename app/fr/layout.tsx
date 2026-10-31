import type { Metadata } from 'next'
import CoquilleRacine from '@/components/common/CoquilleRacine'
import { metadonneesRacine } from '@/lib/seo/metadonnees-racine'

// Layout racine des pages /fr/ (il n'y a plus de app/layout.tsx) : <html lang="fr-FR">, <head> et entité unique
// #business viennent de la coquille commune (components/common/CoquilleRacine.tsx), avec la locale fixée par le
// dossier, sans cookies() ni headers() ; les pages SEO (services, ville, blog, urgence, pres-de-chez-moi) sont donc
// pré-rendues au build et servies telles quelles par le Worker (cache en assets statiques, open-next.config.ts).
// Métadonnées : celles de l'ancien layout racine puis les clés ci-dessous.
export const metadata: Metadata = {
  ...metadonneesRacine('fr'),
  metadataBase: new URL('https://vitfix.io'),
  title: {
    default: 'VITFIX Marseille, Plombier, Électricien, Peintre | Devis gratuit',
    template: '%s | VITFIX Marseille',
  },
  description: 'Trouvez un artisan qualifié à Marseille et en région PACA : plombier, électricien, peintre, plaquiste. Disponibles rapidement, devis gratuit, 7j/7.',
  openGraph: {
    title: 'VITFIX Marseille : Artisans Qualifiés',
    description: 'Plombier, électricien, peintre en région PACA. Devis gratuit, réponse rapide.',
    siteName: 'VITFIX',
    locale: 'fr_FR',
    type: 'website',
    images: [{ url: 'https://vitfix.io/api/og/?locale=fr', width: 1200, height: 630 }],
  },
  // hreflang BCP 47 régionalisé (fr-FR, pt-PT) cohérent avec lib/seo/metadonnees-racine.ts
  // et app/pt/layout.tsx. Évite les duplicates lors du merge metadata Next.js.
  alternates: {
    languages: {
      'fr-FR': 'https://vitfix.io/fr/',
      'pt-PT': 'https://vitfix.io/pt/',
      'en': 'https://vitfix.io/en/',
      'nl': 'https://vitfix.io/nl/',
      'es': 'https://vitfix.io/es/',
      'x-default': 'https://vitfix.io/',
    },
  },
}

export default function FrLayout({ children }: { children: React.ReactNode }) {
  return <CoquilleRacine locale="fr">{children}</CoquilleRacine>
}
