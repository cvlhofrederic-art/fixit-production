'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Suspense } from 'react'

const PRO_ROLES = ['pro_societe', 'pro_conciergerie', 'pro_gestionnaire']

export default function EspaceProPageWrapper() {
  return (
    <Suspense>
      <EspaceProPage />
    </Suspense>
  )
}

const features = [
  'Gestion de chantiers & planning',
  'Équipes & pointage GPS',
  'Devis & factures PDF',
  'Situations de travaux & DPGF',
  'Sous-traitance & DC4',
  'Retenues de garantie',
  'Comptabilité BTP',
  "Bourse aux marchés (appels d'offres)",
  'Messagerie clients & partenaires',
  'Support prioritaire',
]

function EspaceProPage() {
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(() =>
    searchParams.get('email_exists') === '1'
      ? 'Un compte existe déjà avec cet email. Connectez-vous ou réinitialisez votre mot de passe.'
      : ''
  )
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const role = session.user.user_metadata?.role
        if (PRO_ROLES.includes(role)) {
          window.location.href = '/pro/dashboard'
        }
        // Artisan connecté sur cette page → on ne redirige pas, on laisse la session en place
      }
    }
    checkAuth()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        setError(signInError.message === 'Invalid login credentials'
          ? 'Email ou mot de passe incorrect.'
          : signInError.message)
        setLoading(false)
        return
      }

      const role = data.user?.user_metadata?.role
      if (role === 'artisan') {
        await supabase.auth.signOut()
        setError('Cet espace est réservé aux sociétés et entreprises. Les artisans se connectent via l\'Espace Artisan.')
        setLoading(false)
        return
      }

      window.location.href = '/pro/dashboard'
    } catch {
      setError('Une erreur est survenue. Veuillez réessayer.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-warm-gray py-12 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="font-display font-black text-[1.7rem] text-dark mb-4 tracking-[-0.03em] uppercase">
            <span className="text-yellow">VIT</span>FIX
          </div>
          <h1 className="font-display text-3xl font-black text-dark tracking-[-0.03em]">Espace Pro</h1>
          <p className="text-text-muted mt-2">Pour les entreprises et sociétés du bâtiment</p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center gap-2 mb-8">
          <button
            onClick={() => setTab('login')}
            className={`min-w-[160px] px-6 py-2.5 rounded-xl text-sm font-semibold transition ${tab === 'login' ? 'bg-yellow text-dark shadow-sm' : 'bg-white text-text-muted hover:bg-warm-gray border-[1.5px] border-[#E0E0E0]'}`}
          >
            Se connecter
          </button>
          <button
            onClick={() => setTab('register')}
            className={`min-w-[160px] px-6 py-2.5 rounded-xl text-sm font-semibold transition ${tab === 'register' ? 'bg-yellow text-dark shadow-sm' : 'bg-white text-text-muted hover:bg-warm-gray border-[1.5px] border-[#E0E0E0]'}`}
          >
            Créer un compte
          </button>
        </div>

        {/* Login tab */}
        {tab === 'login' && (
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.08)] border-[1.5px] border-[#EFEFEF] p-8">
              <form onSubmit={handleLogin} className="space-y-6">
                {error && (
                  <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-200">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-mid mb-2">Email professionnel</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-warm-gray border-[1.5px] border-[#E0E0E0] rounded-xl focus:border-yellow focus:bg-white focus:outline-none"
                    placeholder="contact@entreprise.fr"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-mid mb-2">Mot de passe</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full px-4 py-3 bg-warm-gray border-[1.5px] border-[#E0E0E0] rounded-xl focus:border-yellow focus:bg-white focus:outline-none pr-12"
                      placeholder="Votre mot de passe"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-mid p-1"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-yellow hover:bg-yellow-light text-dark py-3 rounded-xl font-semibold transition disabled:opacity-60 hover:-translate-y-px"
                >
                  {loading ? 'Connexion...' : 'Se connecter'}
                </button>
              </form>

              <div className="mt-6 text-center space-y-3">
                <p className="text-text-muted text-sm">
                  Pas encore de compte ?{' '}
                  <button onClick={() => setTab('register')} className="text-yellow hover:underline font-semibold">
                    Créer mon espace Pro
                  </button>
                </p>
                <p className="text-text-muted text-sm">
                  <Link href="/auth/reset-password" className="text-text-muted hover:underline">
                    Mot de passe oublié ?
                  </Link>
                </p>
                <p className="text-text-muted text-sm">
                  Artisan indépendant ?{' '}
                  <Link href="/pro/login" className="text-yellow hover:underline font-semibold">
                    Espace Artisan →
                  </Link>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Register tab */}
        {tab === 'register' && (
          <div>
            <div className="text-center mb-8">
              <h2 className="font-display text-2xl font-black text-dark tracking-[-0.03em]">Votre entreprise sur VITFIX</h2>
              <p className="text-text-muted mt-2">Accès complet à tous les outils métier BTP</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.08)] border-[2px] border-yellow p-8 relative">
                <span className="absolute -top-3 right-6 bg-yellow text-dark text-xs font-bold px-3 py-1 rounded-full">ENTREPRISE</span>
                <div className="mb-1">
                  <span className="text-4xl font-bold text-dark">49,99€</span>
                  <span className="text-text-muted text-sm ml-1">TTC / mois</span>
                </div>
                <p className="text-text-muted text-sm mb-6">14 jours d&apos;essai gratuit inclus</p>
                <Link
                  href="/pro/register"
                  className="block w-full text-center bg-yellow hover:bg-yellow-light text-dark py-3 rounded-xl font-semibold transition hover:-translate-y-px"
                >
                  Créer mon compte entreprise
                </Link>
              </div>

              <div className="bg-white rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.08)] border-[1.5px] border-[#EFEFEF] p-8">
                <h3 className="font-semibold text-dark mb-4">Inclus dans l&apos;offre</h3>
                <ul className="space-y-2">
                  {features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-dark">
                      <span className="text-green-500 font-bold text-base">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="text-center space-y-3">
              <p className="text-text-muted text-sm">
                Déjà un compte ?{' '}
                <button onClick={() => setTab('login')} className="text-yellow hover:underline font-semibold">
                  Se connecter
                </button>
              </p>
              <p className="text-text-muted text-sm">
                Artisan indépendant ?{' '}
                <Link href="/pro/login" className="text-yellow hover:underline font-semibold">
                  Espace Artisan →
                </Link>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
