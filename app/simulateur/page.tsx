import type { Metadata } from 'next'
import SimulateurChat from '@/components/simulateur/SimulateurChat'

export const metadata: Metadata = {
  title: 'Estimateur de travaux gratuit | Vitfix',
  description: 'Décrivez vos travaux et obtenez une estimation de prix en quelques questions. Peinture, plomberie, électricité, rénovation... Estimation gratuite par IA.',
  alternates: {
    canonical: 'https://vitfix.io/simulateur/',
  },
  openGraph: {
    title: 'Estimateur de travaux gratuit | Vitfix',
    description: 'Estimez le prix de vos travaux en quelques questions. Gratuit et sans inscription.',
    url: 'https://vitfix.io/simulateur/',
    type: 'website',
  },
}

export default function SimulateurPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Simple header */}
      <header className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <a href="/" className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <span className="text-amber-500">⚡</span> Vitfix
          </a>
          <div className="flex gap-3">
            <a
              href="/auth/login"
              className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
            >
              Connexion
            </a>
            <a
              href="/auth/register"
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600"
            >
              Créer un compte
            </a>
          </div>
        </div>
      </header>

      <SimulateurChat />
    </main>
  )
}
