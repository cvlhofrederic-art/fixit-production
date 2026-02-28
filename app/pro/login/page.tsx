'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()
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
        if (role === 'artisan') {
          window.location.href = '/pro/dashboard'
        } else {
          window.location.href = '/client/dashboard'
        }
      }
    }
    checkAuth()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
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
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">👷</div>
          <h1 className="text-3xl font-bold text-gray-900">Espace Artisan</h1>
          <p className="text-gray-600 mt-2">Gérez votre activité sur Vitfix</p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center gap-2 mb-8">
          <button
            onClick={() => setTab('login')}
            className={`min-w-[160px] px-6 py-2.5 rounded-lg text-sm font-semibold transition ${tab === 'login' ? 'bg-[#FFC107] text-gray-900 shadow-sm' : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'}`}
          >
            Se connecter
          </button>
          <button
            onClick={() => setTab('register')}
            className={`min-w-[160px] px-6 py-2.5 rounded-lg text-sm font-semibold transition ${tab === 'register' ? 'bg-[#FFC107] text-gray-900 shadow-sm' : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'}`}
          >
            S&apos;inscrire
          </button>
        </div>

        {/* ── Onglet Se connecter ── */}
        {tab === 'login' && (
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <form onSubmit={handleLogin} className="space-y-6">
                {error && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email professionnel</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:ring-2 focus:ring-[#FFC107]/20 focus:outline-none"
                    placeholder="pro@email.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Mot de passe</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:ring-2 focus:ring-[#FFC107]/20 focus:outline-none"
                    placeholder="Votre mot de passe"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 py-3 rounded-xl font-semibold transition disabled:opacity-60"
                >
                  {loading ? 'Connexion...' : 'Se connecter'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-gray-600 text-sm">
                  Pas encore inscrit ?{' '}
                  <button onClick={() => setTab('register')} className="text-[#FFC107] hover:underline font-semibold">
                    Créer mon compte artisan
                  </button>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Onglet S'inscrire — Tableau d'offres ── */}
        {tab === 'register' && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Choisissez votre offre</h2>
              <p className="text-gray-500 mt-2">Commencez gratuitement et évoluez selon vos besoins</p>
            </div>

            {/* Pricing Cards */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* Freemium */}
              <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200">
                <h3 className="text-xl font-bold text-gray-900">Freemium</h3>
                <div className="mt-3 mb-1">
                  <span className="text-4xl font-bold text-gray-900">0€</span>
                </div>
                <p className="text-gray-500 text-sm mb-6">Pour démarrer sans risque</p>
                <Link
                  href="/pro/register?plan=freemium"
                  className="block w-full text-center border-2 border-[#FFC107] text-[#FFC107] hover:bg-[#FFF9E6] py-3 rounded-xl font-semibold transition"
                >
                  Choisir Freemium
                </Link>
              </div>

              {/* Pro */}
              <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-[#FFC107] relative">
                <span className="absolute -top-3 right-6 bg-[#FFC107] text-gray-900 text-xs font-bold px-3 py-1 rounded-full">RECOMMANDÉ</span>
                <h3 className="text-xl font-bold text-gray-900">Pro</h3>
                <div className="mt-3 mb-1">
                  <span className="text-4xl font-bold text-gray-900">49,99€</span>
                  <span className="text-gray-500 text-sm ml-1">TTC / mois</span>
                </div>
                <p className="text-gray-500 text-sm mb-6">Tous les modules débloqués</p>
                <Link
                  href="/pro/register?plan=pro"
                  className="block w-full text-center bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 py-3 rounded-xl font-semibold transition"
                >
                  Choisir Pro — 49,99€/mois
                </Link>
              </div>
            </div>

            {/* Comparison Table */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left p-4 text-sm font-semibold text-gray-700">Module</th>
                    <th className="text-center p-4 text-sm font-semibold text-gray-700 w-28">Freemium</th>
                    <th className="text-center p-4 text-sm font-semibold text-[#FFC107] w-28">Pro</th>
                  </tr>
                </thead>
                <tbody>
                  {modules.map((mod, i) => (
                    <tr key={mod.name} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                      <td className="p-4 text-sm text-gray-900">{mod.name}</td>
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
              <p className="text-gray-500 text-sm">
                Déjà un compte ?{' '}
                <button onClick={() => setTab('login')} className="text-[#FFC107] hover:underline font-semibold">
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
