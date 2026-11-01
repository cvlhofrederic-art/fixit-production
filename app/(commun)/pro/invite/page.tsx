'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function InvitePageContent() {
  const searchParams = useSearchParams()
  const token = searchParams?.get('token') || ''

  const [step, setStep] = useState<'loading' | 'form' | 'error' | 'success'>('loading')
  const [inviteData, setInviteData] = useState<{
    email: string
    full_name: string
    role: string
    company_name: string
  } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [passwordErrors, setPasswordErrors] = useState<string[]>([])

  useEffect(() => {
    if (!token) {
      setErrorMsg('Lien d\'invitation invalide.')
      setStep('error')
      return
    }

    const validateToken = async () => {
      try {
        const res = await fetch(`/api/pro/invite?token=${token}`)
        const data = await res.json()

        if (res.ok && data.valid) {
          setInviteData(data)
          setStep('form')
        } else {
          setErrorMsg(data.error || 'Invitation invalide ou expirée.')
          setStep('error')
        }
      } catch {
        setErrorMsg('Erreur de connexion. Réessayez plus tard.')
        setStep('error')
      }
    }

    validateToken()
  }, [token])

  const validatePassword = (pwd: string) => {
    const errors: string[] = []
    if (pwd.length < 8) errors.push('Minimum 8 caractères')
    if (!/[A-Z]/.test(pwd)) errors.push('Au moins 1 majuscule')
    if (!/[0-9]/.test(pwd)) errors.push('Au moins 1 chiffre')
    return errors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const pwdErrors = validatePassword(password)
    if (pwdErrors.length > 0) {
      setPasswordErrors(pwdErrors)
      return
    }
    if (password !== confirmPassword) {
      setPasswordErrors(['Les mots de passe ne correspondent pas'])
      return
    }

    setSubmitting(true)
    setPasswordErrors([])

    try {
      const res = await fetch('/api/pro/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()

      if (res.ok && data.success) {
        setStep('success')
      } else {
        setPasswordErrors([data.error || 'Erreur lors de la création du compte.'])
      }
    } catch {
      setPasswordErrors(['Erreur de connexion.'])
    } finally {
      setSubmitting(false)
    }
  }

  const roleLabels: Record<string, string> = {
    CONDUCTEUR_TRAVAUX: 'Conducteur de travaux',
    CHEF_CHANTIER: 'Chef de chantier',
    SECRETAIRE: 'Secrétaire',
    COMPTABLE: 'Comptable',
    OUVRIER: 'Ouvrier',
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F8F9FA' }}>
      <div className="w-full max-w-md mx-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-2xl font-bold mb-1">
            <span style={{ color: '#FFD600' }}>VIT</span><span style={{ color: '#1a1a1a' }}>FIX</span>
          </div>
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm" style={{ background: '#FFC107', color: '#333' }}>ESPACE PRO</span>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          {/* Loading */}
          {step === 'loading' && (
            <div className="text-center py-8">
              <div className="text-gray-400 text-sm">Vérification de l&apos;invitation...</div>
            </div>
          )}

          {/* Error */}
          {step === 'error' && (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">❌</div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">Invitation invalide</h2>
              <p className="text-sm text-gray-500 mb-6">{errorMsg}</p>
              <a href="/auth/login" className="text-sm font-semibold" style={{ color: '#FFC107' }}>
                Retour à la connexion →
              </a>
            </div>
          )}

          {/* Form */}
          {step === 'form' && inviteData && (
            <>
              <div className="text-center mb-6">
                <div className="text-3xl mb-3">👷</div>
                <h2 className="text-lg font-bold text-gray-900">Rejoindre l&apos;équipe</h2>
                <p className="text-sm text-gray-500 mt-1">
                  <strong>{inviteData.company_name}</strong> vous invite en tant que <strong>{roleLabels[inviteData.role] || inviteData.role}</strong>
                </p>
              </div>

              <div className="mb-4 p-3 rounded-lg" style={{ background: '#FFF8E1' }}>
                <div className="text-xs text-gray-600">
                  <strong>Compte :</strong> {inviteData.email}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  <strong>Nom :</strong> {inviteData.full_name}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Mot de passe</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setPasswordErrors([]) }}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-yellow-400"
                    placeholder="Min 8 car., 1 majuscule, 1 chiffre"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Confirmer le mot de passe</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => { setConfirmPassword(e.target.value); setPasswordErrors([]) }}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-yellow-400"
                    required
                  />
                </div>

                {passwordErrors.length > 0 && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                    {passwordErrors.map((err, i) => (
                      <div key={i} className="text-xs text-red-600">{err}</div>
                    ))}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-lg font-bold text-sm transition"
                  style={{ background: '#FFC107', color: '#1a1a1a' }}
                >
                  {submitting ? 'Création du compte...' : 'Créer mon compte'}
                </button>
              </form>
            </>
          )}

          {/* Success */}
          {step === 'success' && (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">✅</div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">Compte créé</h2>
              <p className="text-sm text-gray-500 mb-6">Vous pouvez maintenant vous connecter avec vos identifiants.</p>
              <a
                href="/auth/login"
                className="inline-block px-6 py-3 rounded-lg font-bold text-sm"
                style={{ background: '#FFC107', color: '#1a1a1a' }}
              >
                Se connecter →
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ProInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F8F9FA' }}>
        <div className="text-gray-400 text-sm">Chargement...</div>
      </div>
    }>
      <InvitePageContent />
    </Suspense>
  )
}
