'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from '@/lib/i18n/context'

export default function GmailConnectButton({ syndicId, userEmail }: { syndicId?: string; userEmail?: string }) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [connected, setConnected] = useState(false)
  const [gmailEmail, setGmailEmail] = useState<string | null>(null)

  useEffect(() => {
    // Vérifier si déjà connecté via URL params (après callback OAuth)
    const params = new URLSearchParams(window.location.search)
    if (params.get('email_connected') === 'true') {
      setConnected(true)
      setGmailEmail(decodeURIComponent(params.get('email') || ''))
      // Nettoyer l'URL
      window.history.replaceState({}, '', window.location.pathname)
    }
    if (params.get('email_error')) {
      console.error('Gmail OAuth error:', params.get('email_error'))
      window.history.replaceState({}, '', window.location.pathname)
    }

    // Vérifier si un token existe déjà en Supabase
    if (syndicId) {
      fetch(`/api/email-agent/poll?syndic_id=${syndicId}&limit=1`)
        .then(r => r.json())
        .then(data => {
          if (data.emails && data.emails.length >= 0) {
            // La table existe et contient des données → connexion active
            setConnected(true)
          }
        })
        .catch(() => {})
    }
  }, [syndicId])

  const handleConnect = async () => {
    if (!syndicId) return
    setLoading(true)
    // Récupérer le token de session pour l'envoyer à la route connect
    const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession()
    if (session?.access_token) {
      window.location.href = `/api/email-agent/connect?token=${session.access_token}`
    } else {
      setLoading(false)
    }
  }

  if (connected) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
          <span className="text-2xl">✅</span>
          <div>
            <p className="font-semibold text-green-800 text-sm">{t('syndicDash.gmail.connected')}</p>
            <p className="text-xs text-green-600">{gmailEmail || 'Boîte synchronisée · Analyse automatique active'}</p>
          </div>
        </div>
        <button
          onClick={handleConnect}
          className="w-full text-xs text-gray-500 hover:text-red-500 transition py-1"
        >
          Reconnecter / Changer de compte
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleConnect}
      disabled={loading}
      className="w-full flex items-center justify-center gap-3 border-2 border-gray-200 hover:border-[#C9A84C] text-gray-700 hover:text-[#C9A84C] py-3 rounded-xl font-semibold transition disabled:opacity-60"
    >
      {loading ? (
        <span className="text-sm">{t('syndicDash.gmail.connecting')}</span>
      ) : (
        <>
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z"/>
            <path fill="#34A853" d="M16.04 18.013c-1.09.703-2.474 1.078-4.04 1.078a7.077 7.077 0 0 1-6.723-4.823l-4.04 3.067A11.965 11.965 0 0 0 12 24c2.933 0 5.735-1.043 7.834-3l-3.793-2.987Z"/>
            <path fill="#4A90E2" d="M19.834 21c2.195-2.048 3.62-5.096 3.62-9 0-.71-.109-1.473-.272-2.182H12v4.637h6.436c-.317 1.559-1.17 2.766-2.395 3.558L19.834 21Z"/>
            <path fill="#FBBC05" d="M5.277 14.268A7.12 7.12 0 0 1 4.909 12c0-.782.125-1.533.357-2.235L1.24 6.65A11.934 11.934 0 0 0 0 12c0 1.92.445 3.73 1.237 5.335l4.04-3.067Z"/>
          </svg>
          <span className="text-sm">{t('syndicDash.gmail.connectYourGmail')}</span>
        </>
      )}
    </button>
  )
}
