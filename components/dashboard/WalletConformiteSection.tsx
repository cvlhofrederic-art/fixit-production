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
  const [showUploadModal, setShowUploadModal] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const saveToStorage = (updated: Record<string, WalletDoc>) => {
    setDocs(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
  }

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
      setShowUploadModal(null)
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

  const statusTagClass = (status: 'missing' | 'valid' | 'expiring' | 'expired') => {
    const map = {
      missing: 'v22-tag-gray',
      valid: 'v22-tag-green',
      expiring: 'v22-tag-amber',
      expired: 'v22-tag-red',
    }
    return `v22-tag ${map[status]}`
  }

  const statusLabel = (status: 'missing' | 'valid' | 'expiring' | 'expired') => {
    const map = {
      missing: t('proDash.wallet.manquant'),
      valid: t('proDash.wallet.valide'),
      expiring: t('proDash.wallet.expireBientot'),
      expired: t('proDash.wallet.expire'),
    }
    return map[status]
  }

  const validCount = WALLET_DOCS.filter(d => getStatus(docs[d.key]) === 'valid').length
  const expiringCount = WALLET_DOCS.filter(d => getStatus(docs[d.key]) === 'expiring').length
  const expiredCount = WALLET_DOCS.filter(d => getStatus(docs[d.key]) === 'expired').length
  const missingCount = WALLET_DOCS.filter(d => getStatus(docs[d.key]) === 'missing').length
  const actionsRequired = expiringCount + expiredCount + missingCount
  const pct = Math.round((validCount / WALLET_DOCS.length) * 100)

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
    <div style={{ padding: '16px', maxWidth: '960px', margin: '0 auto' }}>
      {/* Page header */}
      <div className="v22-page-header">
        <div>
          <div className="v22-page-title">{'🗂️'} {t('proDash.wallet.title')}</div>
          <div className="v22-page-sub">
            {actionsRequired > 0
              ? `${actionsRequired} action${actionsRequired > 1 ? 's' : ''} requise${actionsRequired > 1 ? 's' : ''}`
              : t('proDash.wallet.subtitle')}
          </div>
        </div>
        <button className="v22-btn v22-btn-primary v22-btn-sm" onClick={() => setShowUploadModal('_pick')}>
          + {t('proDash.wallet.ajouter')}
        </button>
      </div>

      {/* Global compliance progress card */}
      <div className="v22-card" style={{ marginBottom: 16 }}>
        <div className="v22-card-body">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 700 }}>{pct}%</span>
            <span className="v22-mono" style={{ fontSize: 11, color: 'var(--v22-text-muted)' }}>
              {validCount}/{WALLET_DOCS.length} documents
            </span>
          </div>
          <div className="v22-prog-bar">
            <div
              className="v22-prog-fill"
              style={{
                width: `${pct}%`,
                background: validCount === WALLET_DOCS.length ? 'var(--v22-green)' : undefined,
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 11 }}>
            <span><span className="v22-tag v22-tag-green">{validCount}</span> {t('proDash.wallet.valide')}</span>
            <span><span className="v22-tag v22-tag-amber">{expiringCount}</span> {t('proDash.wallet.expireBientot')}</span>
            <span><span className="v22-tag v22-tag-red">{expiredCount}</span> {t('proDash.wallet.expire')}</span>
            <span><span className="v22-tag v22-tag-gray">{missingCount}</span> {t('proDash.wallet.manquant')}</span>
          </div>
        </div>
      </div>

      {/* Documents list card */}
      <div className="v22-card" style={{ marginBottom: 16 }}>
        <div className="v22-card-head">
          <span className="v22-card-title">Documents</span>
          <span className="v22-card-meta">{WALLET_DOCS.length} requis</span>
        </div>
        <div className="v22-card-body" style={{ padding: 0 }}>
          {WALLET_DOCS.map((docDef, i) => {
            const doc = docs[docDef.key]
            const status = getStatus(doc)
            return (
              <div
                key={docDef.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  borderBottom: i < WALLET_DOCS.length - 1 ? '1px solid var(--v22-border)' : 'none',
                }}
              >
                {/* Icon */}
                <span style={{ fontSize: 18, flexShrink: 0 }}>{docDef.icon}</span>

                {/* Label + desc + dates */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, color: 'var(--v22-text)' }}>{docDef.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--v22-text-muted)' }}>{docDef.desc}</div>
                  {doc?.expiryDate && (
                    <div className="v22-mono" style={{ fontSize: 11, color: 'var(--v22-text-muted)', marginTop: 2 }}>
                      {t('proDash.wallet.expireLe')} {new Date(doc.expiryDate).toLocaleDateString(dateLocale)}
                    </div>
                  )}
                </div>

                {/* Status tag */}
                <span className={statusTagClass(status)}>{statusLabel(status)}</span>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {doc?.url && (
                    <>
                      <a href={doc.url} target="_blank" rel="noreferrer" className="v22-btn v22-btn-sm" title="Voir">{'👁️'}</a>
                      <button onClick={() => removeDoc(docDef.key)} className="v22-btn v22-btn-sm" title="Supprimer">{'🗑️'}</button>
                    </>
                  )}

                  {/* Upload button */}
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    style={{ display: 'none' }}
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
                    className="v22-btn v22-btn-primary v22-btn-sm"
                    style={{ opacity: uploading[docDef.key] ? 0.5 : 1 }}
                  >
                    {uploading[docDef.key] ? '⏳' : doc?.url ? '🔄' : '📎'}
                  </button>

                  {/* Expiry date toggle */}
                  {editExpiry === docDef.key ? (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <input
                        type="date"
                        className="v22-form-input"
                        style={{ padding: '3px 6px', fontSize: 11, width: 130 }}
                        defaultValue={doc?.expiryDate || ''}
                        onBlur={e => setExpiry(docDef.key, e.target.value)}
                        autoFocus
                      />
                      <button onClick={() => setEditExpiry(null)} className="v22-btn v22-btn-sm">✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setEditExpiry(docDef.key)}
                      className="v22-btn v22-btn-sm"
                      title={doc?.expiryDate ? t('proDash.wallet.echeance') : t('proDash.wallet.ajouterEcheance')}
                    >
                      {'📅'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Send dossier card */}
      <div className="v22-card">
        <div className="v22-card-head">
          <span className="v22-card-title">{'📤'} {t('proDash.wallet.envoyerDossier')}</span>
        </div>
        <div className="v22-card-body">
          <div style={{ fontSize: 12, color: 'var(--v22-text-muted)', marginBottom: 10 }}>
            {t('proDash.wallet.envoyerDossierDesc')}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="email"
              placeholder={t('proDash.wallet.emailDestinataire')}
              value={sendEmail}
              onChange={e => setSendEmail(e.target.value)}
              className="v22-form-input"
              style={{ flex: 1 }}
            />
            <button
              onClick={handleSendDossier}
              disabled={WALLET_DOCS.filter(d => docs[d.key]?.url).length === 0}
              className="v22-btn v22-btn-primary"
              style={{ opacity: WALLET_DOCS.filter(d => docs[d.key]?.url).length === 0 ? 0.5 : 1, whiteSpace: 'nowrap' }}
            >
              {'📧'} {t('proDash.wallet.envoyerLeDossier')}
            </button>
          </div>
          {WALLET_DOCS.filter(d => docs[d.key]?.url).length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--v22-text-muted)', marginTop: 6 }}>
              {'⚠️'} {t('proDash.wallet.uploadAuMoinsUn')}
            </div>
          )}
        </div>
      </div>

      {/* Upload document modal (pick document type) */}
      {showUploadModal === '_pick' && (
        <div className="v22-modal-overlay" onClick={() => setShowUploadModal(null)}>
          <div className="v22-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="v22-modal-head">
              <span className="v22-card-title">+ {t('proDash.wallet.ajouter')}</span>
              <button className="v22-modal-close" onClick={() => setShowUploadModal(null)}>✕</button>
            </div>
            <div className="v22-modal-body" style={{ padding: 0 }}>
              {WALLET_DOCS.map((docDef, i) => {
                const status = getStatus(docs[docDef.key])
                return (
                  <button
                    key={docDef.key}
                    onClick={() => {
                      setShowUploadModal(null)
                      fileInputRefs.current[docDef.key]?.click()
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: '10px 16px',
                      border: 'none',
                      borderBottom: i < WALLET_DOCS.length - 1 ? '1px solid var(--v22-border)' : 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: 13,
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{docDef.icon}</span>
                    <span style={{ flex: 1, fontWeight: 500, color: 'var(--v22-text)' }}>{docDef.label}</span>
                    <span className={statusTagClass(status)}>{statusLabel(status)}</span>
                  </button>
                )
              })}
            </div>
            <div className="v22-modal-foot">
              <button className="v22-btn" onClick={() => setShowUploadModal(null)}>
                {locale === 'pt' ? 'Cancelar' : 'Annuler'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
