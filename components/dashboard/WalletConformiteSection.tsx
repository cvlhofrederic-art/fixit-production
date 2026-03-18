'use client'

import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useTranslation, useLocale } from '@/lib/i18n/context'

interface WalletDoc {
  url?: string
  expiryDate?: string
  uploadedAt?: string
  name?: string
}

export default function WalletConformiteSection({ artisan }: { artisan: any }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const storageKey = `fixit_wallet_${artisan?.id}`

  const WALLET_DOCS = [
    { key: 'assurance_decennale', label: t('proDash.wallet.assuranceDecennale'), icon: '🛡️', desc: t('proDash.wallet.assuranceDecennaleDesc') },
    { key: 'kbis', label: t('proDash.wallet.kbis'), icon: '🏢', desc: t('proDash.wallet.kbisDesc') },
    { key: 'urssaf', label: t('proDash.wallet.urssaf'), icon: '📋', desc: t('proDash.wallet.urssafDesc') },
    { key: 'rc_pro', label: t('proDash.wallet.rcPro'), icon: '⚖️', desc: t('proDash.wallet.rcProDesc') },
    { key: 'rge', label: t('proDash.wallet.rge'), icon: '🌿', desc: t('proDash.wallet.rgeDesc') },
    { key: 'carte_pro_btp', label: t('proDash.wallet.carteProBtp'), icon: '🪪', desc: t('proDash.wallet.carteProBtpDesc') },
    { key: 'passeport_prevention', label: t('proDash.wallet.passeportPrevention'), icon: '🦺', desc: t('proDash.wallet.passeportPreventionDesc') },
    { key: 'qualibat', label: t('proDash.wallet.qualibat'), icon: '🏅', desc: t('proDash.wallet.qualibatDesc') },
  ]

  const [docs, setDocs] = useState<Record<string, WalletDoc>>(() => {
    if (typeof window === 'undefined') return {}
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}') } catch { return {} }
  })
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const [editExpiry, setEditExpiry] = useState<string | null>(null)
  const [sendEmail, setSendEmail] = useState('')
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const saveToStorage = (updated: Record<string, WalletDoc>) => {
    setDocs(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
  }

  // Synchroniser un document wallet avec les fiches syndic (RC Pro, etc.)
  const syncToSyndic = async (docKey: string, hasDocument: boolean, expiryDate?: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      await fetch('/api/wallet-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ docKey, hasDocument, expiryDate: expiryDate || null }),
      })
    } catch { /* silencieux — la sync est best-effort */ }
  }

  const handleUpload = async (docKey: string, file: File) => {
    if (!artisan?.id) return
    setUploading(prev => ({ ...prev, [docKey]: true }))
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const fd = new FormData()
      fd.append('file', file)
      fd.append('bucket', 'artisan-documents')
      fd.append('folder', `wallet/${artisan.id}/${docKey}`)
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {},
        body: fd,
      })
      const data = await res.json()
      if (data.url) {
        const updated = {
          ...docs,
          [docKey]: {
            ...docs[docKey],
            url: data.url,
            uploadedAt: new Date().toISOString(),
            name: file.name,
          }
        }
        saveToStorage(updated)
        syncToSyndic(docKey, true, docs[docKey]?.expiryDate)
      }
    } catch (e) {
      console.error('Upload wallet doc error:', e)
    } finally {
      setUploading(prev => ({ ...prev, [docKey]: false }))
    }
  }

  const setExpiry = (docKey: string, date: string) => {
    const updated = { ...docs, [docKey]: { ...docs[docKey], expiryDate: date } }
    saveToStorage(updated)
    setEditExpiry(null)
    if (updated[docKey]?.url) syncToSyndic(docKey, true, date)
  }

  const removeDoc = (docKey: string) => {
    const updated = { ...docs }
    delete updated[docKey]
    saveToStorage(updated)
    syncToSyndic(docKey, false)
  }

  const getStatus = (doc: WalletDoc | undefined): 'missing' | 'valid' | 'expiring' | 'expired' => {
    if (!doc?.url) return 'missing'
    if (!doc.expiryDate) return 'valid'
    const exp = new Date(doc.expiryDate)
    const now = new Date()
    const diff = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    if (diff < 0) return 'expired'
    if (diff < 60) return 'expiring'
    return 'valid'
  }

  const statusBadge = (status: 'missing' | 'valid' | 'expiring' | 'expired') => {
    const map = {
      missing: { label: t('proDash.wallet.manquant'), bg: 'bg-gray-100', text: 'text-gray-500' },
      valid: { label: t('proDash.wallet.valide'), bg: 'bg-green-100', text: 'text-green-700' },
      expiring: { label: t('proDash.wallet.expireBientot'), bg: 'bg-amber-100', text: 'text-amber-700' },
      expired: { label: t('proDash.wallet.expire'), bg: 'bg-red-100', text: 'text-red-600' },
    }
    const s = map[status]
    return <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>{s.label}</span>
  }

  const validCount = WALLET_DOCS.filter(d => getStatus(docs[d.key]) === 'valid').length

  const handleSendDossier = () => {
    const lines = WALLET_DOCS
      .filter(d => docs[d.key]?.url)
      .map(d => `${d.label} : ${docs[d.key].url}`)
      .join('\n')
    const subject = encodeURIComponent(`${t('proDash.wallet.dossierConformiteSubject')} — ${artisan?.company_name || 'Artisan'}`)
    const greeting = locale === 'pt' ? 'Olá' : 'Bonjour'
    const closing = locale === 'pt' ? 'Com os melhores cumprimentos' : 'Cordialement'
    const body = encodeURIComponent(
      `${greeting},\n\n${t('proDash.wallet.dossierConformiteBody')} ${artisan?.company_name || ''} :\n\n${lines}\n\n${closing},\n${artisan?.company_name || ''}`
    )
    const recipient = encodeURIComponent(sendEmail || '')
    window.open(`mailto:${recipient}?subject=${subject}&body=${body}`)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{'🗂️'} {t('proDash.wallet.title')}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('proDash.wallet.subtitle')}</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-black text-gray-900">{validCount}/{WALLET_DOCS.length}</div>
          <div className="text-xs text-gray-500">{t('proDash.wallet.documentsValides')}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-100 rounded-full h-2 mb-8">
        <div
          className="h-2 rounded-full transition-all"
          style={{
            width: `${(validCount / WALLET_DOCS.length) * 100}%`,
            background: validCount === WALLET_DOCS.length ? '#22c55e' : validCount >= 4 ? '#FFC107' : '#f87171',
          }}
        />
      </div>

      {/* Document cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {WALLET_DOCS.map(docDef => {
          const doc = docs[docDef.key]
          const status = getStatus(doc)
          return (
            <div key={docDef.key} className={`bg-white border-2 rounded-2xl p-4 transition-all ${status === 'expired' ? 'border-red-200' : status === 'expiring' ? 'border-amber-200' : status === 'valid' ? 'border-green-200' : 'border-gray-100'}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{docDef.icon}</span>
                  <div>
                    <div className="font-bold text-gray-900 text-sm">{docDef.label}</div>
                    <div className="text-xs text-gray-500">{docDef.desc}</div>
                  </div>
                </div>
                {statusBadge(status)}
              </div>

              {doc?.url && (
                <div className="mt-3 p-2 bg-gray-50 rounded-lg flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs text-gray-600 font-medium truncate">{doc.name || t('proDash.wallet.documentUploade')}</div>
                    {doc.expiryDate && (
                      <div className="text-xs text-gray-500">{t('proDash.wallet.expireLe')} {new Date(doc.expiryDate).toLocaleDateString(dateLocale)}</div>
                    )}
                    {doc.uploadedAt && (
                      <div className="text-xs text-gray-300">{t('proDash.wallet.ajouteLe')} {new Date(doc.uploadedAt).toLocaleDateString(dateLocale)}</div>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <a href={doc.url} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 text-xs p-1 rounded hover:bg-blue-50">{'👁️'}</a>
                    <button onClick={() => removeDoc(docDef.key)} className="text-red-400 hover:text-red-600 text-xs p-1 rounded hover:bg-red-50">{'🗑️'}</button>
                  </div>
                </div>
              )}

              <div className="mt-3 flex gap-2 flex-wrap">
                {/* Upload button */}
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  ref={el => { fileInputRefs.current[docDef.key] = el }}
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) handleUpload(docDef.key, f)
                    e.target.value = ''
                  }}
                />
                <button
                  onClick={() => fileInputRefs.current[docDef.key]?.click()}
                  disabled={uploading[docDef.key]}
                  className="flex items-center gap-1 text-xs bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-3 py-1.5 rounded-lg font-semibold transition disabled:opacity-50"
                >
                  {uploading[docDef.key] ? `⏳ ${t('proDash.wallet.uploading')}` : doc?.url ? `🔄 ${t('proDash.wallet.remplacer')}` : `📎 ${t('proDash.wallet.ajouter')}`}
                </button>

                {/* Expiry date */}
                {editExpiry === docDef.key ? (
                  <div className="flex gap-1 items-center">
                    <input
                      type="date"
                      className="text-xs border border-gray-200 rounded px-2 py-1"
                      defaultValue={doc?.expiryDate || ''}
                      onBlur={e => setExpiry(docDef.key, e.target.value)}
                      autoFocus
                    />
                    <button onClick={() => setEditExpiry(null)} className="text-xs text-gray-500">✕</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditExpiry(docDef.key)}
                    className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition"
                  >
                    {'📅'} {doc?.expiryDate ? t('proDash.wallet.echeance') : t('proDash.wallet.ajouterEcheance')}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Send dossier */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5">
        <div className="font-bold text-gray-900 mb-1">{'📤'} {t('proDash.wallet.envoyerDossier')}</div>
        <p className="text-sm text-gray-500 mb-4">{t('proDash.wallet.envoyerDossierDesc')}</p>
        <div className="flex gap-3">
          <input
            type="email"
            placeholder={t('proDash.wallet.emailDestinataire')}
            value={sendEmail}
            onChange={e => setSendEmail(e.target.value)}
            className="flex-1 border border-blue-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400 bg-white"
          />
          <button
            onClick={handleSendDossier}
            disabled={WALLET_DOCS.filter(d => docs[d.key]?.url).length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition disabled:opacity-50 whitespace-nowrap"
          >
            {'📧'} {t('proDash.wallet.envoyerLeDossier')}
          </button>
        </div>
        {WALLET_DOCS.filter(d => docs[d.key]?.url).length === 0 && (
          <p className="text-xs text-gray-500 mt-2">{'⚠️'} {t('proDash.wallet.uploadAuMoinsUn')}</p>
        )}
      </div>
    </div>
  )
}
