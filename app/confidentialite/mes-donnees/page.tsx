'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useTranslation, useLocale } from '@/lib/i18n/context'

type UserData = {
  id: string
  email: string | undefined
  created_at: string
  role: string
  full_name: string
}

export default function MesDonneesPage() {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateFmtLocale = locale === 'en' ? 'en-GB' : locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const loadUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        window.location.href = '/auth/login'
        return
      }
      const u = session.user
      setUser({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        role: u.user_metadata?.role || 'particulier',
        full_name: u.user_metadata?.full_name || '',
      })
      setLoading(false)
    }
    loadUser()
  }, [])

  const handleExport = async () => {
    setExporting(true)
    setMessage(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Non authentifie')

      const res = await fetch('/api/user/export-data', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (!res.ok) {
        throw new Error('Erreur lors de l\'export')
      }

      // Download the JSON file
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `vitfix-export-${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setMessage({
        type: 'success',
        text: t('rgpd.exportSuccess', 'Vos donn\u00e9es ont \u00e9t\u00e9 t\u00e9l\u00e9charg\u00e9es avec succ\u00e8s.'),
      })
    } catch {
      setMessage({
        type: 'error',
        text: t('rgpd.exportError', 'Erreur lors de l\'export de vos donn\u00e9es.'),
      })
    } finally {
      setExporting(false)
    }
  }

  const handleDelete = async () => {
    if (deleteInput !== 'SUPPRIMER') return
    setDeleting(true)
    setMessage(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Non authentifie')

      const res = await fetch('/api/user/delete-account', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erreur')
      }

      // Sign out and redirect
      await supabase.auth.signOut()
      window.location.href = '/'
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || t('rgpd.deleteError', 'Erreur lors de la suppression.'),
      })
      setDeleting(false)
    }
  }

  const roleLabels: Record<string, string> = {
    particulier: 'Particulier',
    artisan: 'Artisan',
    syndic: 'Syndic / Gestionnaire',
    pro_societe: 'Professionnel',
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-yellow border-t-transparent rounded-full"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="text-yellow hover:underline text-sm font-medium mb-4 inline-block">
            &larr; {t('common.back', 'Retour')}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('rgpd.title', 'Mes donn\u00e9es personnelles')}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {t('rgpd.subtitle', 'Conform\u00e9ment au RGPD, vous pouvez consulter, exporter ou supprimer vos donn\u00e9es.')}
          </p>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg text-sm border ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-red-50 text-red-600 border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Section 1: Stored Data Overview */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            {t('rgpd.storedData', 'Donn\u00e9es stock\u00e9es')}
          </h2>

          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">{t('auth.email', 'Email')}</span>
              <span className="text-sm font-medium text-gray-900">{user?.email || '-'}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">{t('auth.fullName', 'Nom complet')}</span>
              <span className="text-sm font-medium text-gray-900">{user?.full_name || '-'}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">{t('rgpd.accountType', 'Type de compte')}</span>
              <span className="text-sm font-medium text-gray-900">
                {roleLabels[user?.role || ''] || user?.role}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">{t('rgpd.createdAt', 'Date d\'inscription')}</span>
              <span className="text-sm font-medium text-gray-900">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString(dateFmtLocale, {
                  day: 'numeric', month: 'long', year: 'numeric',
                }) : '-'}
              </span>
            </div>
          </div>

          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-700">
              {t('rgpd.dataCategories', 'Nous stockons \u00e9galement : vos r\u00e9servations, messages, profil artisan (le cas \u00e9ch\u00e9ant), et donn\u00e9es de facturation. Utilisez l\'export ci-dessous pour obtenir l\'int\u00e9gralit\u00e9.')}
            </p>
          </div>
        </div>

        {/* Section 2: Data Export (Art. 20) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-2">
            {t('rgpd.exportTitle', 'Exporter mes donn\u00e9es')}
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            {t('rgpd.exportDesc', 'T\u00e9l\u00e9chargez toutes vos donn\u00e9es personnelles au format JSON (RGPD Art. 20 \u2014 Droit \u00e0 la portabilit\u00e9).')}
          </p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="bg-yellow hover:bg-yellow-light text-gray-900 py-2.5 px-6 rounded-xl font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed text-sm shadow-sm hover:shadow-md"
          >
            {exporting
              ? t('common.loading', 'Chargement...')
              : t('rgpd.exportButton', 'T\u00e9l\u00e9charger mes donn\u00e9es')}
          </button>
        </div>

        {/* Section 3: Account Deletion (Art. 17) */}
        <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-6">
          <h2 className="text-lg font-bold text-red-700 mb-2">
            {t('rgpd.deleteTitle', 'Supprimer mon compte')}
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            {t('rgpd.deleteDesc', 'Cette action est irr\u00e9versible. Toutes vos donn\u00e9es personnelles seront d\u00e9finitivement supprim\u00e9es conform\u00e9ment au RGPD Art. 17 (Droit \u00e0 l\'effacement).')}
          </p>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="bg-red-600 hover:bg-red-700 text-white py-2.5 px-6 rounded-xl font-bold transition-all text-sm"
            >
              {t('rgpd.deleteButton', 'Supprimer mon compte')}
            </button>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm font-medium text-red-700 mb-3">
                {t('rgpd.deleteConfirmPrompt', 'Tapez SUPPRIMER pour confirmer la suppression d\u00e9finitive :')}
              </p>
              <input
                type="text"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder="SUPPRIMER"
                aria-label="Tapez SUPPRIMER pour confirmer"
                className="w-full px-4 py-2 border-2 border-red-300 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none text-sm mb-3"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleDelete}
                  disabled={deleteInput !== 'SUPPRIMER' || deleting}
                  className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed text-sm"
                >
                  {deleting
                    ? t('common.loading', 'Chargement...')
                    : t('rgpd.confirmDelete', 'Confirmer la suppression')}
                </button>
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteInput('') }}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-4 rounded-lg font-medium transition-all text-sm"
                >
                  {t('common.cancel', 'Annuler')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Contact DPO */}
        <div className="mt-6 text-center text-sm text-gray-400">
          <p>
            {t('rgpd.contactDpo', 'Pour toute question concernant vos donn\u00e9es, contactez notre DPO :')}
          </p>
          <a href="mailto:dpo@vitfix.io" className="text-yellow hover:underline font-medium">
            dpo@vitfix.io
          </a>
        </div>
      </div>
    </div>
  )
}
