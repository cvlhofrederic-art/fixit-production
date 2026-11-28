'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// Page utility : sort un super_admin du mode impersonation (clear app_metadata._admin_override)
// Accessible à un user dont app_metadata._original_role === 'super_admin' (vérifié côté API).
// Une fois l'override clearé, redirige vers /admin/dashboard.
export default function AdminExitPage() {
  const [status, setStatus] = useState('Sortie du mode test…')

  useEffect(() => {
    const exit = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setStatus('Non connecté. Redirection…')
        setTimeout(() => { window.location.href = '/admin/login' }, 800)
        return
      }
      try {
        const resp = await fetch('/api/admin/impersonate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ role: 'super_admin' }),
        })
        if (!resp.ok) {
          setStatus(`Échec (${resp.status}). Compte non super_admin ou session expirée.`)
          return
        }
        await supabase.auth.refreshSession()
        setStatus('Mode admin restauré. Redirection…')
        window.location.href = '/admin/dashboard'
      } catch {
        setStatus('Erreur réseau. Réessayez.')
      }
    }
    exit()
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="text-3xl font-display font-extrabold mb-3">
          <span className="text-yellow">VIT</span><span className="text-white">FIX</span>
        </div>
        <p className="text-gray-400 text-sm animate-pulse">{status}</p>
      </div>
    </div>
  )
}
