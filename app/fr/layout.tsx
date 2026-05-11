import type { Metadata } from 'next'

export const metadata: Metadata = {
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
    images: [{ url: 'https://vitfix.io/og-image.png', width: 1200, height: 630 }],
  },
  // hreflang BCP 47 régionalisé (fr-FR, pt-PT) cohérent avec app/layout.tsx
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
  return children
}
