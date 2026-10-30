'use client'

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import LocaleLink from '@/components/common/LocaleLink'

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <LocaleLink href="/" className="inline-flex items-center gap-1.5">
            <span className="text-3xl font-display font-extrabold text-dark"><span className="text-yellow">VIT</span>FIX</span>
          </LocaleLink>
          <h1 className="text-xl font-bold text-gray-900 mt-4">
            {t('auth.resetPasswordTitle', 'Mot de passe oubli\u00e9')}
          </h1>
          <p className="text-gray-500 mt-2 text-sm">
            {t('auth.resetPasswordSubtitle', 'Entrez votre email pour recevoir un lien de r\u00e9initialisation')}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          {success ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">
                {t('auth.emailSent', 'Email envoy\u00e9 !')}
              </h2>
              <p className="text-gray-600 text-sm mb-6">
                {t('auth.emailSentDesc', 'Si un compte existe avec cette adresse, vous recevrez un lien de r\u00e9initialisation dans quelques minutes.')}
              </p>
              <LocaleLink
                href="/auth/login"
                className="inline-block bg-yellow hover:bg-yellow-light text-gray-900 py-3 px-6 rounded-xl font-bold transition-all"
              >
                {t('auth.backToLogin', 'Retour \u00e0 la connexion')}
              </LocaleLink>
            </div>
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
        </div>
      </div>
    </div>
  )
}
