'use client'

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full text-center">
          <div className="text-6xl mb-6" role="img" aria-label="Erreur">&#9888;&#65039;</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Erreur critique
          </h1>
          <p className="text-gray-600 mb-8">
            Une erreur inattendue est survenue. Notre équipe a été notifiée.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={reset}
              className="bg-[#D4A017] hover:bg-[#C4950F] text-white px-8 py-3 rounded-lg font-semibold transition"
            >
              Réessayer
            </button>
            <a
              href="/"
              className="border-2 border-gray-300 text-gray-700 hover:bg-gray-100 px-8 py-3 rounded-lg font-semibold transition"
            >
              Retour à l&apos;accueil
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
