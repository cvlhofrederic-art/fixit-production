import type { Metadata } from 'next'
import { getServerTranslation } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getServerTranslation()
  const isPt = locale === 'pt'

  // Phase 1 SEO PT (points 1.5 et 1.8) : slug PT /pt/contacto/ (l'ancien /pt/contact/ redirige),
  // image sociale PT, x-default sur la page FR (200) et non sur / (302).
  return isPt ? {
    title: 'Contacte a VITFIX em Marco de Canaveses',
    description: 'Contacte a equipa VITFIX: sede em Marco de Canaveses, telefone e WhatsApp +351 912 014 971, e-mail contact@vitfix.io. Profissionais em 22 concelhos.',
    openGraph: {
      title: 'Contacte-nos | VITFIX',
      description: 'Contacte a equipa VITFIX. Profissionais verificados em 22 concelhos dos distritos do Porto, Braga e Aveiro.',
      type: 'website',
      siteName: 'VITFIX',
      locale: 'pt_PT',
      images: [{ url: 'https://vitfix.io/api/og/?locale=pt', width: 1200, height: 630 }],
    },
    alternates: {
      canonical: 'https://vitfix.io/pt/contacto/',
      languages: {
        'pt-PT': 'https://vitfix.io/pt/contacto/',
        'fr-FR': 'https://vitfix.io/fr/contact/',
        'x-default': 'https://vitfix.io/fr/contact/',
      },
    },
  } : {
    title: 'Contact — VITFIX',
    description: 'Contactez l\'équipe VITFIX. Des questions sur nos services d\'artisans vérifiés ? Notre équipe vous répond rapidement.',
    openGraph: {
      title: 'Contact | VITFIX',
      description: 'Contactez l\'équipe VITFIX. Réponse sous 24h.',
      type: 'website',
      siteName: 'VITFIX',
      locale: 'fr_FR',
      images: [{ url: 'https://vitfix.io/api/og/?locale=fr', width: 1200, height: 630 }],
    },
    alternates: {
      canonical: 'https://vitfix.io/fr/contact/',
      languages: {
        'fr-FR': 'https://vitfix.io/fr/contact/',
        'pt-PT': 'https://vitfix.io/pt/contacto/',
        'x-default': 'https://vitfix.io/',
      },
    },
  }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
