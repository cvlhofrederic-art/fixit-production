'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

const ROLE_LABELS: Record<string, string> = {
  syndic_admin: 'Administrateur Syndic',
  syndic_tech: 'Gestionnaire Technique',
  syndic_secretaire: 'Secrétaire',
  syndic_gestionnaire: 'Gestionnaire Copropriété',
  syndic_comptable: 'Comptable',
}

const ROLE_EMOJIS: Record<string, string> = {
  syndic_admin: '👑',
  syndic_tech: '🔧',
  syndic_secretaire: '📋',
  syndic_gestionnaire: '🏢',
  syndic_comptable: '💶',
}

function SyndicInviteContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token') || ''

  const [step, setStep] = useState<'loading' | 'valid' | 'invalid' | 'already_used' | 'success' | 'error'>('loading')
  const [invite, setInvite] = useState<{ email: string; full_name: string; role: string } | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token) { setStep('invalid'); return }

    fetch(`/api/syndic/invite?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (data.valid) {
          setInvite({ email: data.email, full_name: data.full_name, role: data.role })
          setStep('valid')
        } else if (data.error?.includes('déjà')) {
          setStep('already_used')
        } else {
          setStep('invalid')
        }
      })
      .catch(() => setStep('invalid'))
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (password.length < 8) {
      setErrorMsg('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (password !== confirmPassword) {
      setErrorMsg('Les mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/syndic/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()

      if (res.ok && data.success) {
        setStep('success')
      } else {
        setErrorMsg(data.error || 'Une erreur est survenue.')
      }
    } catch {
      setErrorMsg('Erreur réseau. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Vérification de l&apos;invitation…</p>
        </div>
      </div>
    )
  }

  // ── Invalid / Already used ─────────────────────────────────────────────────
  if (step === 'invalid' || step === 'already_used') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">{step === 'already_used' ? '✅' : '❌'}</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {step === 'already_used' ? 'Invitation déjà utilisée' : 'Invitation invalide'}
          </h1>
          <p className="text-gray-500 mb-6">
            {step === 'already_used'
              ? 'Ce lien d\'invitation a déjà été utilisé. Connectez-vous directement.'
              : 'Ce lien est invalide ou a expiré. Contactez votre administrateur syndic.'}
          </p>
          <button
            onClick={() => router.push('/syndic/login')}
            className="bg-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-purple-700 transition"
          >
            Aller à la connexion
          </button>
        </div>
      </div>
    )
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Compte créé !</h1>
          <p className="text-gray-500 mb-6">
            Votre compte est prêt. Connectez-vous avec l&apos;email <strong>{invite?.email}</strong> et votre mot de passe.
          </p>
          <button
            onClick={() => router.push('/syndic/login')}
            className="bg-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-purple-700 transition w-full"
          >
            Se connecter
          </button>
        </div>
      </div>
    )
  }

  // ── Valid — formulaire ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
            {ROLE_EMOJIS[invite?.role || ''] || '👤'}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Rejoindre l&apos;équipe</h1>
          <p className="text-gray-500 mt-1">Vous avez été invité·e en tant que</p>
          <span className="inline-block mt-2 bg-purple-100 text-purple-700 px-4 py-1.5 rounded-full text-sm font-semibold">
            {ROLE_LABELS[invite?.role || ''] || invite?.role}
          </span>
        </div>

        {/* Infos */}
        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <p className="text-sm text-gray-600">
            <span className="font-medium">Email :</span> {invite?.email}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            <span className="font-medium">Nom :</span> {invite?.full_name}
          </p>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Choisissez un mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="8 caractères minimum"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
              minLength={8}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirmez le mot de passe
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Répétez votre mot de passe"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 text-white py-3 rounded-xl font-semibold hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Création du compte…
              </span>
            ) : 'Créer mon compte'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Déjà un compte ?{' '}
          <button
            onClick={() => router.push('/syndic/login')}
            className="text-purple-600 hover:underline"
          >
            Se connecter
          </button>
        </p>
      </div>
    </div>
  )
}

export default function SyndicInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SyndicInviteContent />
    </Suspense>
  )
}
