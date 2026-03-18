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
      // Utiliser getUser() pour un check frais du token (évite les sessions stale)
      const { data: { user } } = await supabase.auth.getUser()
      const role = user?.user_metadata?.role || ''
      if (isSyndicRole(role)) {
        window.location.href = '/syndic/dashboard'
      }
    }
    checkAuth()
  }, [])

  // Helper : log tentative de connexion pour audit sécurité
  const logLoginAttempt = async (success: boolean, role?: string, reason?: string) => {
    try { await fetch('/api/auth/log-attempt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, success, role: role || 'syndic', reason }) }) } catch { /* non-bloquant */ }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        await logLoginAttempt(false, 'syndic', 'invalid_credentials')
        setError('Email ou mot de passe incorrect.')
        setLoading(false)
        return
      }
      const role = data.user?.user_metadata?.role || ''
      if (!isSyndicRole(role)) {
        await logLoginAttempt(false, role, 'wrong_role')
        await supabase.auth.signOut()
        setError('Ce compte n\'est pas un compte Syndic/Gestionnaire. Utilisez l\'espace approprié.')
        setLoading(false)
        return
      }
      await logLoginAttempt(true, role)
      window.location.href = '/syndic/dashboard'
    } catch {
      await logLoginAttempt(false, 'syndic', 'exception')
      setError('Une erreur est survenue.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-warm-gray flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <span className="text-2xl font-display font-black text-dark tracking-[-0.03em] uppercase"><span className="text-yellow">VIT</span>FIX</span>
            <span className="text-purple-600 font-bold text-xl ml-1">Pro</span>
          </Link>
          <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
            🏢
          </div>
          <h1 className="text-2xl font-display font-black text-dark tracking-[-0.03em]">Espace Syndic & Gestionnaires</h1>
          <p className="text-text-muted mt-1 text-sm">Connectez-vous à votre plateforme de gestion</p>
        </div>

        <div className="bg-white rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.08)] border-[1.5px] border-[#EFEFEF] p-8">
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-200">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-mid mb-1">Email professionnel</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-3 bg-warm-gray border-[1.5px] border-[#E0E0E0] rounded-xl focus:border-yellow focus:bg-white focus:outline-none"
                placeholder="contact@monsyndic.fr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-mid mb-1">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 bg-warm-gray border-[1.5px] border-[#E0E0E0] rounded-xl focus:border-yellow focus:bg-white focus:outline-none"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-yellow hover:bg-yellow-light text-dark py-3 rounded-xl font-bold transition disabled:opacity-50 text-lg mt-2 hover:-translate-y-px"
            >
              {loading ? 'Connexion...' : 'Accéder à mon espace'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-border space-y-3 text-center text-sm">
            <p className="text-text-muted">
              Pas encore de compte ?{' '}
              <Link href="/syndic/register" className="text-purple-600 hover:underline font-semibold">
                Créer un compte — 14 jours gratuits
              </Link>
            </p>
            <p className="text-text-muted text-xs">
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
