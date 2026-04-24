'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // SECURITE : seul app_metadata.role est fiable (non forgeable)
      if (user.app_metadata?.role === 'super_admin') {
        window.location.href = '/admin/dashboard'
      }
    }
    check()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) { setError('Email ou mot de passe incorrect.'); setLoading(false); return }
      // SECURITE : verification via app_metadata uniquement
      const role = data.user?.app_metadata?.role
      if (role !== 'super_admin') {
        await supabase.auth.signOut()
        setError('Ce compte n\'est pas un compte Super Admin.')
        setLoading(false)
        return
      }
      window.location.href = '/admin/dashboard'
    } catch {
      setError('Erreur inattendue.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-3xl font-display font-extrabold mb-3"><span className="text-yellow">VIT</span><span className="text-white">FIX</span></div>
          <h1 className="text-2xl font-bold text-white">Super Admin</h1>
          <p className="text-gray-500 text-sm mt-1">Panneau d'administration</p>
        </div>
        <form onSubmit={handleLogin} className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-4">
          {error && <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-2 text-sm">{error}</div>}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-yellow-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-yellow-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-gray-900 font-bold py-2.5 rounded-lg transition text-sm"
          >
            {loading ? 'Connexion...' : 'Acceder au panneau Admin'}
          </button>
        </form>
      </div>
    </div>
  )
}
