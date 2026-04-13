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

export default function MyDataPage() {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateFmtLocale = locale === 'pt' ? 'pt-PT' : locale === 'en' ? 'en-GB' : 'fr-FR'
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
      if (!session) throw new Error('Not authenticated')

      const res = await fetch('/api/user/export-data', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (!res.ok) throw new Error('Export failed')

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
        text: t('rgpd.exportSuccess', 'Your data has been downloaded successfully.'),
      })
    } catch {
      setMessage({
        type: 'error',
        text: t('rgpd.exportError', 'Error exporting your data.'),
      })
    } finally {
      setExporting(false)
    }
  }

  const handleDelete = async () => {
    if (deleteInput !== 'DELETE') return
    setDeleting(true)
    setMessage(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const res = await fetch('/api/user/delete-account', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error')
      }

      await supabase.auth.signOut()
      window.location.href = '/'
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || t('rgpd.deleteError', 'Error deleting your account.'),
      })
      setDeleting(false)
    }
  }

  const roleLabels: Record<string, string> = {
    particulier: 'Individual',
    artisan: 'Artisan',
    syndic: 'Property Manager',
    pro_societe: 'Professional',
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
        <div className="mb-8">
          <Link href="/" className="text-yellow hover:underline text-sm font-medium mb-4 inline-block">
            &larr; {t('common.back', 'Back')}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('rgpd.title', 'My personal data')}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {t('rgpd.subtitle', 'Under GDPR, you can view, export or delete your data.')}
          </p>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-lg text-sm border ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-red-50 text-red-600 border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            {t('rgpd.storedData', 'Stored data')}
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">{t('auth.email', 'Email')}</span>
              <span className="text-sm font-medium text-gray-900">{user?.email || '-'}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">{t('auth.fullName', 'Full name')}</span>
              <span className="text-sm font-medium text-gray-900">{user?.full_name || '-'}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">{t('rgpd.accountType', 'Account type')}</span>
              <span className="text-sm font-medium text-gray-900">
                {roleLabels[user?.role || ''] || user?.role}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">{t('rgpd.createdAt', 'Registration date')}</span>
              <span className="text-sm font-medium text-gray-900">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString(dateFmtLocale, {
                  day: 'numeric', month: 'long', year: 'numeric',
                }) : '-'}
              </span>
            </div>
          </div>
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-700">
              {t('rgpd.dataCategories', 'We also store: your bookings, messages, artisan profile (if applicable), and billing data. Use the export below to get everything.')}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-2">
            {t('rgpd.exportTitle', 'Export my data')}
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            {t('rgpd.exportDesc', 'Download all your personal data in JSON format (GDPR Art. 20 — Right to data portability).')}
          </p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="bg-yellow hover:bg-yellow-light text-gray-900 py-2.5 px-6 rounded-xl font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed text-sm shadow-sm hover:shadow-md"
          >
            {exporting
              ? t('common.loading', 'Loading...')
              : t('rgpd.exportButton', 'Download my data')}
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-6">
          <h2 className="text-lg font-bold text-red-700 mb-2">
            {t('rgpd.deleteTitle', 'Delete my account')}
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            {t('rgpd.deleteDesc', 'This action is irreversible. All your personal data will be permanently deleted under GDPR Art. 17 (Right to erasure).')}
          </p>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="bg-red-600 hover:bg-red-700 text-white py-2.5 px-6 rounded-xl font-bold transition-all text-sm"
            >
              {t('rgpd.deleteButton', 'Delete my account')}
            </button>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm font-medium text-red-700 mb-3">
                {t('rgpd.deleteConfirmPrompt', 'Type DELETE to confirm permanent deletion:')}
              </p>
              <input
                type="text"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder="DELETE"
                aria-label="Type DELETE to confirm"
                className="w-full px-4 py-2 border-2 border-red-300 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none text-sm mb-3"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleDelete}
                  disabled={deleteInput !== 'DELETE' || deleting}
                  className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed text-sm"
                >
                  {deleting
                    ? t('common.loading', 'Loading...')
                    : t('rgpd.confirmDelete', 'Confirm deletion')}
                </button>
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteInput('') }}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-4 rounded-lg font-medium transition-all text-sm"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 text-center text-sm text-gray-400">
          <p>
            {t('rgpd.contactDpo', 'For any questions about your data, contact our DPO:')}
          </p>
          <a href="mailto:dpo@vitfix.io" className="text-yellow hover:underline font-medium">
            dpo@vitfix.io
          </a>
        </div>
      </div>
    </div>
  )
}
