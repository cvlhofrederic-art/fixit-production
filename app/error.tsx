'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Erreur application:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-6">&#9888;&#65039;</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Une erreur est survenue
        </h1>
        <p className="text-gray-600 mb-8">
          D&eacute;sol&eacute;, quelque chose s&apos;est mal pass&eacute;. Veuillez r&eacute;essayer.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={reset}
            className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-8 py-3 rounded-lg font-semibold transition"
          >
            R&eacute;essayer
          </button>
          <a
            href="/"
            className="border-2 border-[#FFC107] text-[#FFC107] hover:bg-[#FFF9E6] px-8 py-3 rounded-lg font-semibold transition"
          >
            Retour &agrave; l&apos;accueil
          </a>
        </div>
      </div>
    </div>
  )
}
