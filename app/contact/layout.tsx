import type { Metadata } from 'next'
import { getServerTranslation } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getServerTranslation()
  const isPt = locale === 'pt'

  return isPt ? {
    title: 'Contacte-nos — VITFIX | Marco de Canaveses',
    description: 'Contacte a equipa VITFIX. Serviços de canalização, eletricidade, desentupimento, pintura e faz-tudo em Marco de Canaveses, Penafiel, Amarante e região do Tâmega e Sousa.',
    openGraph: {
      title: 'Contacte-nos | VITFIX',
      description: 'Contacte a equipa VITFIX. Profissionais verificados na região do Tâmega e Sousa. Resposta em 24h.',
      type: 'website',
      siteName: 'VITFIX',
      locale: 'pt_PT',
      images: [{ url: 'https://vitfix.io/og-image.png', width: 1200, height: 630 }],
    },
    alternates: { canonical: 'https://vitfix.io/pt/contact/' },
  } : {
    title: 'Contact — VITFIX',
    description: 'Contactez l\'équipe VITFIX. Des questions sur nos services d\'artisans vérifiés ? Notre équipe vous répond rapidement.',
    openGraph: {
      title: 'Contact | VITFIX',
      description: 'Contactez l\'équipe VITFIX. Réponse sous 24h.',
      type: 'website',
      siteName: 'VITFIX',
      locale: 'fr_FR',
      images: [{ url: 'https://vitfix.io/og-image.png', width: 1200, height: 630 }],
    },
    alternates: { canonical: 'https://vitfix.io/fr/contact/' },
  }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
