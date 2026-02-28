'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('AdminCvlho@gmail.com')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const check = async () => {
      await supabase.auth.refreshSession()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const meta = user.user_metadata
      // Si le rôle a été changé par goToDashboard mais l'original est super_admin, restaurer
      if (meta?._original_role === 'super_admin' && meta?.role !== 'super_admin') {
        await supabase.auth.updateUser({
          data: { ...meta, role: 'super_admin', _admin_override: false, _original_role: undefined }
        })
        await supabase.auth.refreshSession()
        window.location.href = '/admin/dashboard'
        return
      }
      if (meta?.role === 'super_admin') {
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
      const meta = data.user?.user_metadata
      const isSuperAdmin = meta?.role === 'super_admin' || meta?._original_role === 'super_admin'
      if (!isSuperAdmin) {
        await supabase.auth.signOut()
        setError('Ce compte n\'est pas un compte Super Admin.')
        setLoading(false)
        return
      }
      // Restaurer le rôle super_admin si nécessaire
      if (meta?.role !== 'super_admin') {
        await supabase.auth.updateUser({
          data: { ...meta, role: 'super_admin', _admin_override: false, _original_role: undefined }
        })
        await supabase.auth.refreshSession()
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
          <div className="text-5xl mb-3">⚡</div>
          <h1 className="text-2xl font-bold text-white">Vitfix</h1>
          <p className="text-gray-500 text-sm mt-1">Accès Super Admin</p>
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
            {loading ? 'Connexion…' : '🔐 Accéder au panneau Admin'}
          </button>
        </form>
      </div>
    </div>
  )
}
