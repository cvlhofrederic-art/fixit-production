'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/lib/i18n/context'
import LocaleLink from '@/components/common/LocaleLink'

export default function UpdatePasswordPage() {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [sessionReady, setSessionReady] = useState(false)

  const [tokenExpired, setTokenExpired] = useState(false)

  useEffect(() => {
    // Supabase automatically handles the recovery token from the URL hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true)
      }
    })

    // Also check if we already have a session (in case onAuthStateChange already fired)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true)
    })

    // Timeout after 10s — token likely expired or invalid
    const timeout = setTimeout(() => {
      setTokenExpired(true)
    }, 10000)

    return () => { subscription.unsubscribe(); clearTimeout(timeout) }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      setError(t('auth.passwordTooShort', 'Le mot de passe doit contenir au moins 8 caractères, 1 majuscule, 1 minuscule et 1 chiffre'))
      return
    }

    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch', 'Les mots de passe ne correspondent pas'))
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message)
      } else {
        setSuccess(true)
        // Redirect to login after 3 seconds
        setTimeout(() => {
          window.location.href = '/auth/login'
        }, 3000)
      }
    } catch {
      setError(t('common.error', 'Une erreur est survenue'))
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
            {t('auth.updatePasswordTitle', 'Nouveau mot de passe')}
          </h1>
          <p className="text-gray-500 mt-2 text-sm">
            {t('auth.updatePasswordSubtitle', 'Choisissez un nouveau mot de passe pour votre compte')}
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
                {t('auth.passwordUpdated', 'Mot de passe mis \u00e0 jour !')}
              </h2>
              <p className="text-gray-600 text-sm mb-6">
                {t('auth.passwordUpdatedDesc', 'Votre mot de passe a \u00e9t\u00e9 modifi\u00e9 avec succ\u00e8s. Redirection vers la connexion...')}
              </p>
              <LocaleLink
                href="/auth/login"
                className="inline-block bg-yellow hover:bg-yellow-light text-gray-900 py-3 px-6 rounded-xl font-bold transition-all"
              >
                {t('auth.backToLogin', 'Retour \u00e0 la connexion')}
              </LocaleLink>
            </div>
          ) : !sessionReady ? (
            <div className="text-center py-8">
              {tokenExpired ? (
                <>
                  <div className="text-4xl mb-4">⏰</div>
                  <p className="text-gray-700 font-semibold mb-2">
                    {t('auth.linkExpired', 'Ce lien a expiré ou est invalide')}
                  </p>
                  <p className="text-gray-500 text-sm mb-4">
                    {t('auth.requestNewLinkDesc', 'Demandez un nouveau lien de réinitialisation pour modifier votre mot de passe.')}
                  </p>
                </>
              ) : (
                <>
                  <div className="animate-spin w-8 h-8 border-4 border-yellow border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-gray-500 text-sm">
                    {t('auth.verifyingLink', 'Vérification du lien...')}
                  </p>
                  <p className="text-gray-400 text-xs mt-2">
                    {t('auth.invalidLinkHint', 'Si la page ne charge pas, le lien a peut-être expiré.')}
                  </p>
                </>
              )}
              <LocaleLink
                href="/auth/reset-password"
                className="text-yellow hover:underline font-semibold text-sm mt-4 inline-block"
              >
                {t('auth.requestNewLink', 'Demander un nouveau lien')}
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
                  {t('auth.newPassword', 'Nouveau mot de passe')}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-yellow focus:ring-2 focus:ring-yellow/20 focus:outline-none"
                  placeholder="&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('auth.confirmPassword', 'Confirmer le mot de passe')}
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-yellow focus:ring-2 focus:ring-yellow/20 focus:outline-none"
                  placeholder="&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-yellow hover:bg-yellow-light text-gray-900 py-3 rounded-xl font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed text-lg mt-2 shadow-sm hover:shadow-md"
              >
                {loading
                  ? t('common.loading', 'Chargement...')
                  : t('auth.updatePasswordButton', 'Mettre \u00e0 jour le mot de passe')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
