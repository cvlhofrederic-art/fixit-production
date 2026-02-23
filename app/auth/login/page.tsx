'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Espace = 'particulier' | 'artisan' | 'syndic'

export default function LoginPage() {
  const [espace, setEspace] = useState<Espace | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const role = session.user.user_metadata?.role
        if (role === 'artisan') window.location.href = '/pro/dashboard'
        else if (role === 'syndic') window.location.href = '/syndic/dashboard'
        else window.location.href = '/client/dashboard'
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
      if (signInError) { setError('Email ou mot de passe incorrect.'); setLoading(false); return }
      const role = data.user?.user_metadata?.role
      if (role === 'artisan') window.location.href = '/pro/dashboard'
      else if (role === 'syndic') window.location.href = '/syndic/dashboard'
      else window.location.href = '/client/dashboard'
    } catch {
      setError('Une erreur est survenue.')
      setLoading(false)
    }
  }

  const espaces = [
    {
      id: 'particulier' as Espace,
      emoji: '🏠',
      titre: 'Particulier',
      desc: 'Trouvez et réservez un artisan',
      couleur: 'border-blue-300 bg-blue-50',
      couleurActif: 'border-blue-500 bg-blue-50 ring-2 ring-blue-300',
      registerHref: '/auth/register',
    },
    {
      id: 'artisan' as Espace,
      emoji: '🔧',
      titre: 'Artisan',
      desc: 'Gérez vos interventions',
      couleur: 'border-amber-300 bg-amber-50',
      couleurActif: 'border-amber-500 bg-amber-50 ring-2 ring-amber-300',
      registerHref: '/pro/register',
    },
    {
      id: 'syndic' as Espace,
      emoji: '🏢',
      titre: 'Syndic / Pro',
      desc: 'Pilotez vos immeubles',
      couleur: 'border-purple-300 bg-purple-50',
      couleurActif: 'border-purple-500 bg-purple-50 ring-2 ring-purple-300',
      registerHref: '/syndic/register',
    },
  ]

  const espaceActif = espaces.find(e => e.id === espace)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center py-12 px-4">
      <div className="max-w-lg w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="text-4xl">⚡</span>
            <span className="text-3xl font-bold text-[#FFC107]">VitFix</span>
          </Link>
          <p className="text-gray-500 mt-2 text-sm">Choisissez votre espace pour vous connecter</p>
        </div>

        {/* Sélecteur d'espace */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {espaces.map((e) => (
            <button
              key={e.id}
              onClick={() => { setEspace(e.id); setError('') }}
              className={`flex flex-col items-center p-4 rounded-2xl border-2 transition-all cursor-pointer text-center ${
                espace === e.id ? e.couleurActif : e.couleur + ' hover:opacity-80'
              }`}
            >
              <span className="text-3xl mb-2">{e.emoji}</span>
              <span className="font-bold text-gray-900 text-sm">{e.titre}</span>
              <span className="text-gray-500 text-xs mt-1">{e.desc}</span>
            </button>
          ))}
        </div>

        {/* Formulaire */}
        {espace && espaceActif && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
              <span className="text-3xl">{espaceActif.emoji}</span>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Connexion — {espaceActif.titre}</h2>
                <p className="text-gray-500 text-sm">{espaceActif.desc}</p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:ring-2 focus:ring-[#FFC107]/20 focus:outline-none"
                  placeholder="votre@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:ring-2 focus:ring-[#FFC107]/20 focus:outline-none"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 py-3 rounded-lg font-bold transition disabled:opacity-50 text-lg mt-2"
              >
                {loading ? 'Connexion...' : `Se connecter`}
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-gray-100 text-center text-sm text-gray-500">
              Pas encore de compte ?{' '}
              <Link href={espaceActif.registerHref} className="text-[#FFC107] hover:underline font-semibold">
                Créer un compte {espaceActif.titre}
              </Link>
            </div>
          </div>
        )}

        {!espace && (
          <p className="text-center text-gray-400 text-sm py-4">
            Sélectionnez votre espace ci-dessus
          </p>
        )}
      </div>
    </div>
  )
}
