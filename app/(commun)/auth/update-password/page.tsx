'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/lib/i18n/context'
import LocaleLink from '@/components/common/LocaleLink'
import { CarteMotDePasse, SuccesMotDePasse } from '@/components/auth/CarteMotDePasse'
import { PARAMETRE_LIEN, type ErreurNouveauMotDePasse } from '@/lib/auth/lien-email'
import { connexionApresMotDePasseQr, retourConnexionMotDePasseQr } from '@/lib/aj-signalement/acces-espace'

export default function UpdatePasswordPage() {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [sessionReady, setSessionReady] = useState(false)

  const [tokenExpired, setTokenExpired] = useState(false)
  // Lien de l'e-mail passé par /auth/confirm (?lien=1) : le jeton attend dans un cookie httpOnly et sera vérifié par
  // POST /api/auth/update-password à l'envoi du formulaire (lib/auth/lien-email.ts). Aucune session à attendre.
  const [modeLien, setModeLien] = useState(false)

  useEffect(() => {
    const parametres = new URLSearchParams(window.location.search)
    if (parametres.has(PARAMETRE_LIEN)) {
      setModeLien(true)
      return
    }
    // Ancien lien (?code=…, modèle {{ .ConfirmationURL }}) : le SDK l'échange lui-même, dans le seul navigateur qui a
    // fait la demande ; la session est alors trouvée par getSession() ci-dessous (l'échange émet SIGNED_IN, pas
    // PASSWORD_RECOVERY). Utilisateur déjà connecté : même chemin.
    // ?erreur= : lien refusé par /auth/confirm, inutile d'attendre 10 s s'il n'y a aucune session.
    const lienRefuse = parametres.has('erreur')

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true)
      }
    })

    // Also check if we already have a session (in case onAuthStateChange already fired)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true)
      else if (lienRefuse) setTokenExpired(true)
    })

    // Timeout after 10s — token likely expired or invalid
    const timeout = setTimeout(() => {
      setTokenExpired(true)
    }, 10000)

    return () => { subscription.unsubscribe(); clearTimeout(timeout) }
  }, [])

  // AJ Signalement (PR 2) : un gestionnaire d'un cabinet client retourne vers la connexion professionnelle de son
  // cabinet (destination du serveur ou app_metadata du compte, vérifiée : aucune redirection ouverte) ; sinon /auth/login.
  const [retourConnexion, setRetourConnexion] = useState<string | null>(null)

  const terminer = (connexion: string | null = null) => {
    setRetourConnexion(connexion)
    setSuccess(true)
    // Redirect to login after 3 seconds
    setTimeout(() => {
      window.location.href = connexion ?? '/auth/login'
    }, 3000)
  }

  // Lien de l'e-mail : le serveur vérifie le jeton du cookie et change le mot de passe ; aucune session n'est ouverte,
  // la connexion se fait ensuite avec le nouveau mot de passe.
  const envoyerParLien = async () => {
    const reponse = await fetch('/api/auth/update-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const corps = (await reponse.json().catch(() => ({}))) as { ok?: boolean; erreur?: ErreurNouveauMotDePasse; connexion?: unknown }
    if (reponse.ok && corps.ok) {
      terminer(retourConnexionMotDePasseQr(corps.connexion))
      return
    }
    switch (corps.erreur) {
      case 'lien-invalide':
        setModeLien(false)
        setTokenExpired(true)
        break
      case 'meme-mot-de-passe':
        setError(t('auth.samePasswordLogin', 'Ce mot de passe est déjà celui de votre compte : connectez-vous avec lui.'))
        break
      case 'mot-de-passe-refuse':
        setError(t('auth.passwordRejected', 'Ce mot de passe a été refusé (trop faible ou trop courant). Demandez un nouveau lien, puis choisissez-en un autre.'))
        break
      case 'mot-de-passe-faible':
        setError(t('auth.passwordTooShort', 'Le mot de passe doit contenir au moins 8 caractères, 1 majuscule, 1 minuscule et 1 chiffre'))
        break
      case 'trop-de-tentatives':
        setError(t('auth.tooManyAttempts', 'Trop de tentatives. Réessayez dans quelques minutes.'))
        break
      default:
        setError(t('common.error', 'Une erreur est survenue'))
    }
  }

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
      if (modeLien) {
        await envoyerParLien()
        return
      }
      const { data: misAJour, error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message)
      } else {
        terminer(connexionApresMotDePasseQr(misAJour?.user?.app_metadata))
      }
    } catch {
      setError(t('common.error', 'Une erreur est survenue'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <CarteMotDePasse
      titre={t('auth.updatePasswordTitle', 'Nouveau mot de passe')}
      sousTitre={t('auth.updatePasswordSubtitle', 'Choisissez un nouveau mot de passe pour votre compte')}
    >
      {success ? (
        <SuccesMotDePasse
          titre={t('auth.passwordUpdated', 'Mot de passe mis \u00e0 jour !')}
          message={t('auth.passwordUpdatedDesc', 'Votre mot de passe a \u00e9t\u00e9 modifi\u00e9 avec succ\u00e8s. Redirection vers la connexion...')}
          retourConnexion={t('auth.backToLogin', 'Retour \u00e0 la connexion')}
          lienConnexion={retourConnexion ?? undefined}
        />
      ) : !sessionReady && !modeLien ? (
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
              minLength={8}
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
              minLength={8}
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
    </CarteMotDePasse>
  )
}
