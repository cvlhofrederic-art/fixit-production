'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const texts = {
  pt: {
    title: 'Ocorreu um erro',
    desc: 'Desculpe, algo correu mal. Por favor, tente novamente.',
    retry: 'Tentar novamente',
    home: 'Voltar ao início',
  },
  fr: {
    title: 'Une erreur est survenue',
    desc: 'Désolé, quelque chose s\'est mal passé. Veuillez réessayer.',
    retry: 'Réessayer',
    home: 'Retour à l\'accueil',
  },
  en: {
    title: 'An error occurred',
    desc: 'Sorry, something went wrong. Please try again.',
    retry: 'Try again',
    home: 'Back to home',
  },
}

function getLocale(): string {
  if (typeof document === 'undefined') return 'fr'
  const match = document.cookie.match(/(?:^|; )locale=([^;]*)/)
  return match?.[1] || 'fr'
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [locale, setLocale] = useState('fr')

  useEffect(() => {
    setLocale(getLocale())
    console.error('Application error:', error)
  }, [error])

  const t = texts[locale as keyof typeof texts] || texts.en

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4" role="alert" aria-live="assertive">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-6">⚠️</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          {t.title}
        </h1>
        <p className="text-gray-600 mb-8">
          {t.desc}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={reset}
            className="bg-[#FFC107] hover:bg-[#FFB300] text-gray-900 px-8 py-3 rounded-lg font-semibold transition"
          >
            {t.retry}
          </button>
          <Link
            href={locale === 'pt' ? '/pt/' : locale === 'en' ? '/en/' : '/'}
            className="border-2 border-gray-300 text-gray-700 hover:bg-gray-100 px-8 py-3 rounded-lg font-semibold transition"
          >
            {t.home}
          </Link>
        </div>
      </div>
    </div>
  )
}
