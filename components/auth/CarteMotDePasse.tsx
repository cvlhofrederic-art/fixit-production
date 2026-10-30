'use client'

import type { ReactNode } from 'react'
import LocaleLink from '@/components/common/LocaleLink'

// Coquille des pages de mot de passe (/auth/reset-password/ et /auth/update-password/) : logo, titre, sous-titre et carte.
export function CarteMotDePasse({ titre, sousTitre, children }: { titre: string; sousTitre: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <LocaleLink href="/" className="inline-flex items-center gap-1.5">
            <span className="text-3xl font-display font-extrabold text-dark"><span className="text-yellow">VIT</span>FIX</span>
          </LocaleLink>
          <h1 className="text-xl font-bold text-gray-900 mt-4">
            {titre}
          </h1>
          <p className="text-gray-500 mt-2 text-sm">
            {sousTitre}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          {children}
        </div>
      </div>
    </div>
  )
}

// Réussite : coche verte, titre, message et lien vers la connexion.
export function SuccesMotDePasse({ titre, message, retourConnexion }: { titre: string; message: string; retourConnexion: string }) {
  return (
    <div className="text-center">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-lg font-bold text-gray-900 mb-2">
        {titre}
      </h2>
      <p className="text-gray-600 text-sm mb-6">
        {message}
      </p>
      <LocaleLink
        href="/auth/login"
        className="inline-block bg-yellow hover:bg-yellow-light text-gray-900 py-3 px-6 rounded-xl font-bold transition-all"
      >
        {retourConnexion}
      </LocaleLink>
    </div>
  )
}
