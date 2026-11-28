'use client'

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import LocaleLink from '@/components/common/LocaleLink'
import { CarteMotDePasse, SuccesMotDePasse } from '@/components/auth/CarteMotDePasse'

export default function ResetPasswordPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || t('auth.resetError', 'Une erreur est survenue'))
      } else {
        setSuccess(true)
      }
    } catch {
      setError(t('auth.resetError', 'Une erreur est survenue'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <CarteMotDePasse
      titre={t('auth.resetPasswordTitle', 'Mot de passe oubli\u00e9')}
      sousTitre={t('auth.resetPasswordSubtitle', 'Entrez votre email pour recevoir un lien de r\u00e9initialisation')}
    >
      {success ? (
        <SuccesMotDePasse
          titre={t('auth.emailSent', 'Email envoy\u00e9 !')}
          message={t('auth.emailSentDesc', 'Si un compte existe avec cette adresse, vous recevrez un lien de r\u00e9initialisation dans quelques minutes.')}
          retourConnexion={t('auth.backToLogin', 'Retour \u00e0 la connexion')}
        />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {t('auth.email', 'Email')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-yellow focus:ring-2 focus:ring-yellow/20 focus:outline-none"
              placeholder="votre@email.com"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-yellow hover:bg-yellow-light text-gray-900 py-3 rounded-xl font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed text-lg mt-2 shadow-sm hover:shadow-md"
          >
            {loading
              ? t('common.loading', 'Chargement...')
              : t('auth.sendResetLink', 'Envoyer le lien')}
          </button>
        </form>
      )}

      {!success && (
        <div className="mt-5 pt-4 border-t border-gray-100 text-center text-sm text-gray-500">
          <LocaleLink href="/auth/login" className="text-yellow hover:underline font-semibold">
            {t('auth.backToLogin', 'Retour \u00e0 la connexion')}
          </LocaleLink>
        </div>
      )}
    </CarteMotDePasse>
  )
}
