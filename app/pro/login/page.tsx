'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const modules = [
  { name: 'Profil artisan vérifié', free: true, pro: true },
  { name: 'Devis & factures PDF', free: true, pro: true },
  { name: 'Visibilité auprès des syndics & réseaux pro', free: false, pro: true },
  { name: 'Agenda en ligne', free: false, pro: true },
  { name: 'Réservations clients', free: false, pro: true },
  { name: 'Messagerie client', free: false, pro: true },
  { name: 'Mise en avant recherche', free: false, pro: true },
  { name: 'Comptabilité IA (Agent Léa)', free: false, pro: true },
  { name: 'Proof of Work', free: false, pro: true },
  { name: 'Notifications push', free: false, pro: true },
  { name: 'Application mobile', free: false, pro: true },
  { name: 'Support prioritaire', free: false, pro: true },
  { name: 'Statistiques avancées', free: false, pro: true },
]

export default function ProLoginPage() {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // If already logged in, redirect to dashboard
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const role = session.user.user_metadata?.role
        const proRoles = ['artisan', 'pro_societe', 'pro_conciergerie', 'pro_gestionnaire']
        if (proRoles.includes(role)) {
          window.location.href = '/pro/dashboard'
        } else {
          window.location.href = '/client/dashboard'
        }
      }
    }
    checkAuth()
  }, [])

  // Helper : log tentative de connexion pour audit sécurité
  const logLoginAttempt = async (success: boolean, reason?: string) => {
    try { await fetch('/api/auth/log-attempt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, success, role: 'artisan', reason }) }) } catch { /* non-bloquant */ }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        await logLoginAttempt(false, 'invalid_credentials')
        setError(signInError.message)
        setLoading(false)
        return
      }

      const role = data.user?.user_metadata?.role
      const proRoles = ['pro_societe', 'pro_conciergerie', 'pro_gestionnaire']
      if (proRoles.includes(role)) {
        await supabase.auth.signOut()
        await logLoginAttempt(false, 'wrong_space')
        setError('Cet espace est réservé aux artisans. Les sociétés et entreprises se connectent via l\'Espace Pro.')
        setLoading(false)
        return
      }

      await logLoginAttempt(true)
      window.location.href = '/pro/dashboard'
    } catch {
      await logLoginAttempt(false, 'exception')
      setError('Une erreur est survenue. Veuillez réessayer.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-warm-gray py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="font-display font-black text-[1.7rem] text-dark mb-4 tracking-[-0.03em] uppercase"><span className="text-yellow">VIT</span>FIX</div>
          <h1 className="font-display text-3xl font-black text-dark tracking-[-0.03em]">Espace Artisan</h1>
          <p className="text-text-muted mt-2">Gérez votre activité sur VITFIX</p>
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
            S&apos;inscrire
          </button>
        </div>

        {/* ── Onglet Se connecter ── */}
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
                    placeholder="pro@email.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-mid mb-2">Mot de passe</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-warm-gray border-[1.5px] border-[#E0E0E0] rounded-xl focus:border-yellow focus:bg-white focus:outline-none"
                    placeholder="Votre mot de passe"
                  />
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
                  Pas encore inscrit ?{' '}
                  <button onClick={() => setTab('register')} className="text-yellow hover:underline font-semibold">
                    Créer mon compte artisan
                  </button>
                </p>
                <p className="text-text-muted text-sm">
                  Vous êtes un client particulier ?{' '}
                  <Link href="/auth/login" className="text-blue-600 hover:underline font-semibold">
                    Connexion client →
                  </Link>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Onglet S'inscrire — Tableau d'offres ── */}
        {tab === 'register' && (
          <div>
            <div className="text-center mb-8">
              <h2 className="font-display text-2xl font-black text-dark tracking-[-0.03em]">Choisissez votre offre</h2>
              <p className="text-text-muted mt-2">Commencez gratuitement et évoluez selon vos besoins</p>
            </div>

            {/* Pricing Cards */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* Freemium */}
              <div className="bg-white rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.08)] border-[1.5px] border-[#EFEFEF] p-8">
                <h3 className="font-display text-xl font-black text-dark tracking-[-0.03em]">Freemium</h3>
                <div className="mt-3 mb-1">
                  <span className="text-4xl font-bold text-dark">0€</span>
                </div>
                <p className="text-text-muted text-sm mb-6">Pour démarrer sans risque</p>
                <Link
                  href="/pro/register?plan=freemium"
                  className="block w-full text-center border-[1.5px] border-yellow text-yellow hover:bg-warm-gray py-3 rounded-xl font-semibold transition hover:-translate-y-px"
                >
                  Choisir Freemium
                </Link>
              </div>

              {/* Pro */}
              <div className="bg-white rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.08)] p-8 border-[2px] border-yellow relative">
                <span className="absolute -top-3 right-6 bg-yellow text-dark text-xs font-bold px-3 py-1 rounded-full">RECOMMANDÉ</span>
                <h3 className="font-display text-xl font-black text-dark tracking-[-0.03em]">Pro</h3>
                <div className="mt-3 mb-1">
                  <span className="text-4xl font-bold text-dark">49,99€</span>
                  <span className="text-text-muted text-sm ml-1">TTC / mois</span>
                </div>
                <p className="text-text-muted text-sm mb-6">Tous les modules débloqués</p>
                <Link
                  href="/pro/register?plan=pro"
                  className="block w-full text-center bg-yellow hover:bg-yellow-light text-dark py-3 rounded-xl font-semibold transition hover:-translate-y-px"
                >
                  Choisir Pro — 49,99€/mois
                </Link>
              </div>
            </div>

            {/* Comparison Table */}
            <div className="bg-white rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.08)] border-[1.5px] border-[#EFEFEF] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-warm-gray border-b border-border">
                    <th className="text-left p-4 text-sm font-semibold text-mid">Module</th>
                    <th className="text-center p-4 text-sm font-semibold text-mid w-28">Freemium</th>
                    <th className="text-center p-4 text-sm font-semibold text-yellow w-28">Pro</th>
                  </tr>
                </thead>
                <tbody>
                  {modules.map((mod, i) => (
                    <tr key={mod.name} className={`border-b border-border ${i % 2 === 0 ? 'bg-white' : 'bg-warm-gray/50'}`}>
                      <td className="p-4 text-sm text-dark">{mod.name}</td>
                      <td className="p-4 text-center">
                        {mod.free
                          ? <span className="text-green-500 text-lg font-bold">✓</span>
                          : <span className="text-red-400 text-lg">✗</span>
                        }
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-green-500 text-lg font-bold">✓</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-center mt-6">
              <p className="text-text-muted text-sm">
                Déjà un compte ?{' '}
                <button onClick={() => setTab('login')} className="text-yellow hover:underline font-semibold">
                  Se connecter
                </button>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
