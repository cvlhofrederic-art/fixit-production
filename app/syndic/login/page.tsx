'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function SyndicLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Vérifie si le rôle est un rôle syndic valide (admin ou employé)
  const isSyndicRole = (role: string) => role === 'syndic' || role.startsWith('syndic_')

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const role = session?.user?.user_metadata?.role || ''
      if (isSyndicRole(role)) {
        window.location.href = '/syndic/dashboard'
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
      const role = data.user?.user_metadata?.role || ''
      if (!isSyndicRole(role)) {
        await supabase.auth.signOut()
        setError('Ce compte n\'est pas un compte Syndic/Gestionnaire. Utilisez l\'espace approprié.')
        setLoading(false)
        return
      }
      window.location.href = '/syndic/dashboard'
    } catch {
      setError('Une erreur est survenue.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <span className="text-3xl">⚡</span>
            <span className="text-2xl font-bold text-[#FFC107]">VitFix</span>
            <span className="text-purple-600 font-bold text-xl ml-1">Pro</span>
          </Link>
          <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
            🏢
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Espace Syndic & Gestionnaires</h1>
          <p className="text-gray-500 mt-1 text-sm">Connectez-vous à votre plateforme de gestion</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 border border-purple-100">
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email professionnel</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:ring-2 focus:ring-purple-200 focus:outline-none"
                placeholder="contact@monsyndic.fr"
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
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:ring-2 focus:ring-purple-200 focus:outline-none"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-bold transition disabled:opacity-50 text-lg mt-2"
            >
              {loading ? 'Connexion...' : 'Accéder à mon espace'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-100 space-y-3 text-center text-sm">
            <p className="text-gray-500">
              Pas encore de compte ?{' '}
              <Link href="/syndic/register" className="text-purple-600 hover:underline font-semibold">
                Créer un compte — 14 jours gratuits
              </Link>
            </p>
            <p className="text-gray-400 text-xs">
              Vous êtes artisan ?{' '}
              <Link href="/pro/login" className="text-amber-500 hover:underline">Espace artisan</Link>
              {' '}· Particulier ?{' '}
              <Link href="/auth/login" className="text-blue-500 hover:underline">Espace client</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
