'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { useTranslation } from '@/lib/i18n/context'
import { supabase } from '@/lib/supabase'
import { SITE_URL } from '@/lib/constants'

interface SettingsSectionProps {
  artisan: Record<string, unknown> & { id: string; company_name?: string; phone?: string; email?: string; bio?: string; profile_photo_url?: string }
  initials: string
  settingsTab: 'profil' | 'modules' | 'parrainage'
  setSettingsTab: (v: 'profil' | 'modules' | 'parrainage') => void
  settingsForm: {
    company_name: string; email: string; phone: string; bio: string;
    auto_block_duration_minutes: number; auto_reply_message: string; zone_radius_km: number
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setSettingsForm: any
  savingSettings: boolean
  saveSettings: () => void
  autoAccept: boolean
  toggleAutoAccept: () => void
  profilePhotoPreview: string
  setProfilePhotoPreview: (v: string) => void
  profilePhotoFile: File | null
  setProfilePhotoFile: (v: File | null) => void
  profilePhotoUploading: boolean
  uploadDocument: (file: File, folder: 'profiles' | 'kbis' | 'insurance' | 'logos', field: 'profile_photo_url' | 'kbis_url' | 'insurance_url' | 'logo_url', setUploading: (v: boolean) => void) => Promise<void>
  setProfilePhotoUploading: (v: boolean) => void
  uploadMsg: { text: string; type: 'success' | 'error' } | null
  setUploadMsg: (v: { text: string; type: 'success' | 'error' } | null) => void
  // Modules
  ALL_MODULES: { id: string; label: string; icon: string; description: string; category: string; locked?: boolean }[]
  modulesConfig: { id: string; enabled: boolean; order: number }[]
  saveModulesConfig: (config: { id: string; enabled: boolean; order: number }[]) => void
  moveModule: (moduleId: string, direction: 'up' | 'down') => void
}

// ── Payment Info Card ─────────────────────────────────────────────────────

interface PaymentMode {
  type: 'virement' | 'stripe' | 'cheque' | 'especes' | 'autre'
  iban?: string
  bic?: string
  titulaire?: string
  lien?: string
  ordre?: string
  description?: string
  actif: boolean
}

const DEFAULT_MODES: PaymentMode[] = [
  { type: 'virement', iban: '', bic: '', titulaire: '', actif: false },
  { type: 'stripe', lien: '', actif: false },
  { type: 'cheque', ordre: '', actif: false },
  { type: 'especes', actif: false },
  { type: 'autre', description: '', actif: false },
]

const MODE_LABELS: Record<string, string> = {
  virement: 'Virement bancaire',
  stripe: 'Paiement en ligne Stripe',
  cheque: 'Chèque',
  especes: 'Espèces',
  autre: 'Autre',
}

function formatIban(raw: string): string {
  return raw.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim()
}

function isValidIban(iban: string): boolean {
  const clean = iban.replace(/\s/g, '')
  return /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(clean)
}

function PaymentInfoCard({ artisanId }: { artisanId: string }) {
  const [modes, setModes] = useState<PaymentMode[]>(DEFAULT_MODES)
  const [mentionDevis, setMentionDevis] = useState(true)
  const [mentionFacture, setMentionFacture] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!artisanId) return
    fetch('/api/artisan-payment-info')
      .then(r => r.json())
      .then(data => {
        if (data.paiement_modes) setModes(data.paiement_modes)
        setMentionDevis(data.paiement_mention_devis ?? true)
        setMentionFacture(data.paiement_mention_facture ?? true)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [artisanId])

  const updateMode = (idx: number, patch: Partial<PaymentMode>) => {
    const updated = [...modes]
    updated[idx] = { ...updated[idx], ...patch }
    setModes(updated)
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/artisan-payment-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paiement_modes: modes, paiement_mention_devis: mentionDevis, paiement_mention_facture: mentionFacture }),
      })
      if (res.ok) setSaved(true)
    } catch {}
    setSaving(false)
  }

  const activeModes = modes.filter(m => m.actif)

  if (loading) return <div className="v22-card"><div className="v22-card-body" style={{ textAlign: 'center', padding: 20, color: 'var(--v22-text-muted)' }}>Chargement...</div></div>

  return (
    <div className="v22-card">
      <div className="v22-card-head">
        <div className="v22-card-title">Informations de paiement</div>
      </div>
      <div className="v22-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 12, color: 'var(--v22-text-muted)', marginBottom: 4 }}>
          Ces informations apparaîtront sur vos devis et factures envoyés aux clients.
        </div>

        {modes.map((mode, idx) => (
          <div key={mode.type} style={{ borderBottom: '1px solid var(--v22-border)', paddingBottom: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
              <input type="checkbox" checked={mode.actif} onChange={(e) => updateMode(idx, { actif: e.target.checked })} />
              {MODE_LABELS[mode.type]}
            </label>

            {mode.actif && mode.type === 'virement' && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: 12, width: 60 }}>IBAN</label>
                  <input className="v22-form-input" value={mode.iban || ''} onChange={(e) => updateMode(idx, { iban: e.target.value.toUpperCase() })} placeholder="FR76 XXXX XXXX XXXX" style={{ flex: 1, fontSize: 12 }} />
                  {mode.iban && mode.iban.replace(/\s/g, '').length > 4 && (
                    <span style={{ fontSize: 14 }}>{isValidIban(mode.iban) ? '✅' : '⚠️'}</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: 12, width: 60 }}>BIC</label>
                  <input className="v22-form-input" value={mode.bic || ''} onChange={(e) => updateMode(idx, { bic: e.target.value.toUpperCase() })} placeholder="BNPAFRPP" style={{ flex: 1, fontSize: 12 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: 12, width: 60 }}>Titulaire</label>
                  <input className="v22-form-input" value={mode.titulaire || ''} onChange={(e) => updateMode(idx, { titulaire: e.target.value })} placeholder="Nom du titulaire" style={{ flex: 1, fontSize: 12 }} />
                </div>
              </div>
            )}

            {mode.actif && mode.type === 'stripe' && (
              <div style={{ marginTop: 8, paddingLeft: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: 12, width: 60 }}>Lien</label>
                  <input className="v22-form-input" value={mode.lien || ''} onChange={(e) => updateMode(idx, { lien: e.target.value })} placeholder="https://buy.stripe.com/..." style={{ flex: 1, fontSize: 12 }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--v22-text-muted)', marginTop: 4, paddingLeft: 66 }}>Le client paiera directement depuis ce lien</div>
              </div>
            )}

            {mode.actif && mode.type === 'cheque' && (
              <div style={{ marginTop: 8, paddingLeft: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: 12, width: 60 }}>À l{"'"}ordre de</label>
                  <input className="v22-form-input" value={mode.ordre || ''} onChange={(e) => updateMode(idx, { ordre: e.target.value })} placeholder="Nom" style={{ flex: 1, fontSize: 12 }} />
                </div>
              </div>
            )}

            {mode.actif && mode.type === 'especes' && (
              <div style={{ marginTop: 4, paddingLeft: 24, fontSize: 11, color: 'var(--v22-text-muted)' }}>Aucune info supplémentaire requise</div>
            )}

            {mode.actif && mode.type === 'autre' && (
              <div style={{ marginTop: 8, paddingLeft: 24 }}>
                <input className="v22-form-input" value={mode.description || ''} onChange={(e) => updateMode(idx, { description: e.target.value })} placeholder="PayPal, Lydia, virement étranger..." style={{ fontSize: 12 }} />
              </div>
            )}
          </div>
        ))}

        {/* Toggles affichage */}
        <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={mentionDevis} onChange={(e) => { setMentionDevis(e.target.checked); setSaved(false) }} />
            Afficher sur les devis
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={mentionFacture} onChange={(e) => { setMentionFacture(e.target.checked); setSaved(false) }} />
            Afficher sur les factures
          </label>
        </div>

        {/* Aperçu */}
        {activeModes.length > 0 && (
          <div style={{ background: 'var(--v22-surface)', border: '1px solid var(--v22-border)', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 6, color: 'var(--v22-text-muted)' }}>APERÇU SUR LE DOCUMENT</div>
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>MODE DE RÈGLEMENT</div>
            {activeModes.map(m => (
              <div key={m.type} style={{ fontSize: 11, color: 'var(--v22-text-secondary)', marginBottom: 2 }}>
                {m.type === 'virement' && `Virement : ${formatIban(m.iban || '...')} — ${m.titulaire || '...'}`}
                {m.type === 'stripe' && `Paiement en ligne : ${m.lien || '...'}`}
                {m.type === 'cheque' && `Chèque à l'ordre de : ${m.ordre || '...'}`}
                {m.type === 'especes' && 'Espèces'}
                {m.type === 'autre' && (m.description || 'Autre mode de paiement')}
              </div>
            ))}
          </div>
        )}

        <button onClick={handleSave} disabled={saving} className="v22-btn v22-btn-primary" style={{ alignSelf: 'flex-start' }}>
          {saving ? 'Enregistrement...' : saved ? '✅ Enregistré' : 'Enregistrer les infos paiement'}
        </button>
      </div>
    </div>
  )
}

// ── Parrainage Settings Tab ────────────────────────────────────────────────

function ParrainageSettingsTab({ artisanId }: { artisanId: string }) {
  const [referralCode, setReferralCode] = useState('')
  const [creditMois, setCreditMois] = useState(0)
  const [totalParrainages, setTotalParrainages] = useState(0)
  const [notifEnabled, setNotifEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [savingNotif, setSavingNotif] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('profiles_artisan')
        .select('referral_code, credit_mois_gratuits, total_parrainages_reussis, referral_notifications_enabled')
        .eq('id', artisanId)
        .single()
      if (data) {
        setReferralCode(data.referral_code || '')
        setCreditMois(data.credit_mois_gratuits || 0)
        setTotalParrainages(data.total_parrainages_reussis || 0)
        setNotifEnabled(data.referral_notifications_enabled !== false)
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [artisanId])

  useEffect(() => { fetchData() }, [fetchData])

  const generateCode = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/referral/generate-code', { method: 'POST' })
      const json = await res.json()
      if (json.code) setReferralCode(json.code)
    } catch { /* silent */ }
    setGenerating(false)
  }

  const toggleNotifications = async () => {
    setSavingNotif(true)
    const newVal = !notifEnabled
    try {
      await supabase
        .from('profiles_artisan')
        .update({ referral_notifications_enabled: newVal })
        .eq('id', artisanId)
      setNotifEnabled(newVal)
    } catch { /* silent */ }
    setSavingNotif(false)
  }

  const referralLink = referralCode ? `${SITE_URL}/rejoindre?ref=${referralCode}` : ''

  const copyLink = () => {
    if (!referralLink) return
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div style={{ padding: 16, textAlign: 'center', color: 'var(--v22-text-muted)' }}>
        Chargement...
      </div>
    )
  }

  return (
    <div style={{ padding: 16, maxWidth: 672, margin: '0 auto' }}>
      {/* Code de parrainage */}
      <div className="v22-card" style={{ marginBottom: 16 }}>
        <div className="v22-card-head">
          <div className="v22-card-title">🔗 Votre code de parrainage</div>
        </div>
        <div className="v22-card-body">
          {referralCode ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1, padding: '10px 14px', background: 'var(--v22-bg)', borderRadius: 8, border: '1px solid var(--v22-border)', fontFamily: 'monospace', fontSize: 16, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--v22-text)' }}>
                  {referralCode}
                </div>
                <button onClick={copyLink} className="v22-btn v22-btn-primary" style={{ whiteSpace: 'nowrap' }}>
                  {copied ? '✅ Copié' : '📋 Copier le lien'}
                </button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--v22-text-muted)', wordBreak: 'break-all' }}>
                {referralLink}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <p style={{ fontSize: 14, color: 'var(--v22-text-muted)', marginBottom: 12 }}>
                Aucun code de parrainage. Générez-en un pour commencer à parrainer.
              </p>
              <button onClick={generateCode} disabled={generating} className="v22-btn v22-btn-primary" style={{ opacity: generating ? 0.5 : 1 }}>
                {generating ? '⏳ Génération...' : '🎁 Générer mon code'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats rapides */}
      <div className="v22-card" style={{ marginBottom: 16 }}>
        <div className="v22-card-head">
          <div className="v22-card-title">📊 Vos stats parrainage</div>
        </div>
        <div className="v22-card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ padding: 16, background: 'var(--v22-bg)', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--v22-text)' }}>{totalParrainages}</div>
              <div style={{ fontSize: 12, color: 'var(--v22-text-muted)', marginTop: 4 }}>Parrainage{totalParrainages > 1 ? 's' : ''} réussi{totalParrainages > 1 ? 's' : ''}</div>
            </div>
            <div style={{ padding: 16, background: creditMois > 0 ? 'var(--v22-green-light)' : 'var(--v22-bg)', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: creditMois > 0 ? 'var(--v22-green)' : 'var(--v22-text)' }}>{creditMois}</div>
              <div style={{ fontSize: 12, color: 'var(--v22-text-muted)', marginTop: 4 }}>Mois gratuit{creditMois > 1 ? 's' : ''} disponible{creditMois > 1 ? 's' : ''}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="v22-card">
        <div className="v22-card-head">
          <div className="v22-card-title">🔔 Notifications parrainage</div>
        </div>
        <div className="v22-card-body">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: 'var(--v22-bg)', borderRadius: 6 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--v22-text)' }}>Emails de parrainage</div>
              <div style={{ fontSize: 12, color: 'var(--v22-text-muted)', marginTop: 2 }}>
                {notifEnabled ? 'Recevez un email à chaque étape du parrainage' : 'Notifications par email désactivées'}
              </div>
            </div>
            <button
              onClick={toggleNotifications}
              disabled={savingNotif}
              style={{
                width: 44, height: 24, borderRadius: 12, position: 'relative',
                transition: 'background .2s',
                background: notifEnabled ? 'var(--v22-green)' : 'var(--v22-border-dark)',
                border: 'none', cursor: savingNotif ? 'wait' : 'pointer', flexShrink: 0,
                opacity: savingNotif ? 0.5 : 1,
              }}
            >
              <div style={{
                position: 'absolute', top: 2, width: 20, height: 20,
                background: '#fff', borderRadius: '50%',
                boxShadow: '0 1px 2px rgba(0,0,0,.15)',
                transition: 'left .2s', left: notifEnabled ? 22 : 2,
              }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PasswordChangeCard() {
  const { t } = useTranslation()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const handleChangePassword = async () => {
    setMsg(null)
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setMsg({ text: t('proDash.settings.pwdTooShort'), type: 'error' })
      return
    }
    if (newPassword !== confirmPassword) {
      setMsg({ text: t('proDash.settings.pwdMismatch'), type: 'error' })
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        setMsg({ text: error.message, type: 'error' })
      } else {
        setMsg({ text: t('proDash.settings.pwdSuccess'), type: 'success' })
        setNewPassword('')
        setConfirmPassword('')
      }
    } catch {
      setMsg({ text: t('proDash.settings.pwdError'), type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="v22-card" style={{ maxWidth: 672, marginTop: 16 }}>
      <div className="v22-card-head">
        <div className="v22-card-title">{'🔒'} {t('proDash.settings.securityTitle')}</div>
      </div>
      <div className="v22-card-body">
        {msg && (
          <div className={`v22-alert ${msg.type === 'success' ? 'v22-alert-green' : 'v22-alert-red'}`} style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            {msg.text}
            <button onClick={() => setMsg(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--v22-text-muted)', fontSize: 14 }}>{'✕'}</button>
          </div>
        )}

        <div className="v22-form-group">
          <label className="v22-form-label">{t('proDash.settings.newPassword')}</label>
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            className="v22-form-input"
          />
        </div>
        <div className="v22-form-group">
          <label className="v22-form-label">{t('proDash.settings.confirmPassword')}</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            className="v22-form-input"
          />
          <span style={{ fontSize: 11, color: 'var(--v22-text-muted)', marginTop: 4, display: 'block' }}>{t('proDash.settings.pwdMinLength')}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
          <button
            onClick={handleChangePassword}
            disabled={saving || !newPassword || !confirmPassword}
            className="v22-btn v22-btn-primary"
            style={{ opacity: (saving || !newPassword || !confirmPassword) ? 0.5 : 1 }}
          >
            {saving ? `⏳ ${t('proDash.settings.pwdSaving')}` : `🔒 ${t('proDash.settings.pwdUpdate')}`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SettingsSection({
  artisan, initials, settingsTab, setSettingsTab, settingsForm, setSettingsForm,
  savingSettings, saveSettings, autoAccept, toggleAutoAccept,
  profilePhotoPreview, setProfilePhotoPreview, profilePhotoFile, setProfilePhotoFile,
  profilePhotoUploading, uploadDocument, setProfilePhotoUploading,
  uploadMsg, setUploadMsg,
  ALL_MODULES, modulesConfig, saveModulesConfig, moveModule,
}: SettingsSectionProps) {
  const { t } = useTranslation()
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState('')
  const [logoUploading, setLogoUploading] = useState(false)

  const isModuleEnabled = (moduleId: string): boolean => {
    if (modulesConfig.length === 0) return true
    const m = modulesConfig.find(x => x.id === moduleId)
    return m ? m.enabled : true
  }

  const toggleModule = (moduleId: string) => {
    const updated = modulesConfig.map(c => c.id === moduleId ? { ...c, enabled: !c.enabled } : c)
    saveModulesConfig(updated)
  }

  return (
    <div className="animate-fadeIn">
      {/* Page header */}
      <div className="v22-page-header">
        <div style={{ flex: 1 }}>
          <div className="v22-page-title">{settingsTab === 'modules' ? `🧩 ${t('proDash.settings.modulesTitle')}` : settingsTab === 'parrainage' ? '🎁 Parrainage' : 'Mon profil'}</div>
          <div className="v22-page-sub">{settingsTab === 'modules' ? t('proDash.settings.modulesSubtitle') : settingsTab === 'parrainage' ? 'Code, crédits et notifications de parrainage' : 'Gérez vos informations personnelles et professionnelles.'}</div>
        </div>
        {settingsTab === 'profil' && (
          <button onClick={saveSettings} disabled={savingSettings} className="v22-btn v22-btn-primary" style={{ opacity: savingSettings ? 0.5 : 1 }}>
            {savingSettings ? `⏳ ${t('proDash.settings.sauvegarde')}` : `💾 ${t('proDash.settings.enregistrer')}`}
          </button>
        )}
      </div>

      {/* Profil & Parametres */}
      {settingsTab === 'profil' && (
      <div style={{ padding: '16px' }}>
        {/* Two-column grid: profile left, settings right */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* LEFT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Profile card */}
            <div className="v22-card">
              <div className="v22-card-head">
                <div className="v22-card-title">{t('proDash.settings.profilProfessionnel')}</div>
              </div>
              <div className="v22-card-body">
                {/* Upload message */}
                {uploadMsg && (
                  <div className={`v22-alert ${uploadMsg.type === 'success' ? 'v22-alert-green' : 'v22-alert-red'}`} style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {uploadMsg.text}
                    <button onClick={() => setUploadMsg(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--v22-text-muted)', fontSize: 14 }}>{'✕'}</button>
                  </div>
                )}

                {/* Photo de profil */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--v22-border)', flexShrink: 0, background: 'var(--v22-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    {profilePhotoPreview ? (
                      <Image src={profilePhotoPreview} alt={t('proDash.settings.photoProfil')} fill className="object-cover" unoptimized />
                    ) : (artisan as any)?.profile_photo_url ? (
                      <Image src={(artisan as any).profile_photo_url} alt={t('proDash.settings.photoProfil')} fill className="object-cover" sizes="64px" />
                    ) : (
                      <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--v22-text-muted)' }}>{initials}</span>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }} className="v22-btn v22-btn-sm">
                      {'📷'} {t('proDash.settings.choisirPhoto')}
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (!f) return
                        setProfilePhotoFile(f)
                        const reader = new FileReader()
                        reader.onload = (ev) => setProfilePhotoPreview(ev.target?.result as string)
                        reader.readAsDataURL(f)
                      }} />
                    </label>
                    {profilePhotoFile && (
                      <button
                        onClick={() => {
                          uploadDocument(profilePhotoFile, 'profiles', 'profile_photo_url', setProfilePhotoUploading)
                          setProfilePhotoFile(null)
                          setProfilePhotoPreview('')
                        }}
                        disabled={profilePhotoUploading}
                        className="v22-btn v22-btn-primary v22-btn-sm"
                        style={{ marginLeft: 6, opacity: profilePhotoUploading ? 0.5 : 1 }}
                      >
                        {profilePhotoUploading ? `⏳ ${t('proDash.settings.uploading')}` : `⬆️ ${t('proDash.settings.upload')}`}
                      </button>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--v22-text-muted)', marginTop: 4 }}>{t('proDash.settings.photoFormat')}</div>
                  </div>
                </div>

                {/* Logo entreprise (pour devis/factures PDF) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '12px 0', borderTop: '1px solid var(--v22-border)' }}>
                  <div style={{ width: 64, height: 64, borderRadius: 8, overflow: 'hidden', border: '2px dashed var(--v22-border)', flexShrink: 0, background: 'var(--v22-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    {logoPreview ? (
                      <Image src={logoPreview} alt="Logo" fill className="object-contain" unoptimized style={{ padding: 4 }} />
                    ) : (artisan as any)?.logo_url ? (
                      <Image src={(artisan as any).logo_url} alt="Logo" fill className="object-contain" sizes="64px" style={{ padding: 4 }} />
                    ) : (
                      <span style={{ fontSize: 10, color: 'var(--v22-text-muted)', textAlign: 'center', lineHeight: 1.2 }}>Logo<br/>PDF</span>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ cursor: logoUploading ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, opacity: logoUploading ? 0.5 : 1 }} className="v22-btn v22-btn-sm">
                      {logoUploading ? '⏳ Enregistrement...' : '🏢 Logo entreprise (PDF)'}
                      <input type="file" accept="image/png,image/jpeg,image/webp" disabled={logoUploading} style={{ display: 'none' }} onChange={async (e) => {
                        const f = e.target.files?.[0]
                        if (!f) return
                        if (f.size > 500 * 1024) { setUploadMsg({ text: 'Logo trop lourd (max 500 Ko)', type: 'error' }); return }
                        setLogoUploading(true)
                        try {
                          // Convertir en base64 et sauver directement en DB (bypass Storage)
                          const base64 = await new Promise<string>((resolve) => {
                            const reader = new FileReader()
                            reader.onload = (ev) => resolve(ev.target?.result as string)
                            reader.readAsDataURL(f)
                          })
                          setLogoPreview(base64)
                          const { error } = await supabase.from('profiles_artisan').update({ logo_url: base64 }).eq('id', artisan.id)
                          if (error) throw new Error(error.message)
                          setUploadMsg({ text: '✅ Logo enregistré !', type: 'success' })
                        } catch (err: any) {
                          setUploadMsg({ text: `❌ ${err.message}`, type: 'error' })
                        } finally {
                          setLogoUploading(false)
                        }
                      }} />
                    </label>
                    <div style={{ fontSize: 11, color: 'var(--v22-text-muted)', marginTop: 4 }}>PNG, JPG ou WebP. Max 2 Mo. Apparaît en haut à gauche des devis.</div>
                  </div>
                </div>

                <div className="v22-form-group">
                  <label className="v22-form-label">{t('proDash.settings.nomCompletEntreprise')}</label>
                  <input type="text" value={settingsForm.company_name} onChange={(e) => setSettingsForm({...settingsForm, company_name: e.target.value})}
                    className="v22-form-input" />
                </div>
                <div className="v22-form-group">
                  <label className="v22-form-label">{t('proDash.settings.emailProfessionnel')}</label>
                  <input type="email" value={settingsForm.email} onChange={(e) => setSettingsForm({...settingsForm, email: e.target.value})}
                    className="v22-form-input" />
                </div>
                <div className="v22-form-group">
                  <label className="v22-form-label">{t('proDash.settings.telephoneLabel')}</label>
                  <input type="tel" value={settingsForm.phone} onChange={(e) => setSettingsForm({...settingsForm, phone: e.target.value})}
                    className="v22-form-input" />
                </div>
                <div className="v22-form-group">
                  <label className="v22-form-label">{t('proDash.settings.descriptionBio')}</label>
                  <textarea value={settingsForm.bio} onChange={(e) => setSettingsForm({...settingsForm, bio: e.target.value})}
                    rows={3} placeholder={t('proDash.settings.descriptionPlaceholder')}
                    className="v22-form-input" style={{ resize: 'none' }} />
                </div>
              </div>
            </div>

            {/* Booking link card */}
            <div className="v22-card">
              <div className="v22-card-head">
                <div className="v22-card-title">{t('proDash.settings.lienReservation')}</div>
              </div>
              <div className="v22-card-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="text" readOnly value={`${process.env.NEXT_PUBLIC_APP_URL || 'https://vitfix.io'}/artisan/${artisan?.slug || artisan?.id || ''}`}
                    className="v22-form-input" style={{ flex: 1, background: 'var(--v22-bg)', color: 'var(--v22-text-muted)', fontSize: 12 }} />
                  <button onClick={() => { navigator.clipboard.writeText(`${process.env.NEXT_PUBLIC_APP_URL || 'https://vitfix.io'}/artisan/${artisan?.slug || artisan?.id || ''}`); alert(t('proDash.settings.lienCopie')) }}
                    className="v22-btn v22-btn-primary" style={{ whiteSpace: 'nowrap' }}>
                    {'📋'} {t('proDash.settings.copier')}
                  </button>
                </div>
              </div>
            </div>

            {/* Informations de paiement */}
            <PaymentInfoCard artisanId={artisan?.id as string} />

            {/* Parrainage — intégré dans Mon profil */}
            <div className="v22-card">
              <div className="v22-card-head">
                <div className="v22-card-title">{'🎁'} Parrainage</div>
              </div>
              <div className="v22-card-body">
                <ParrainageSettingsTab artisanId={artisan?.id as string} />
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Auto-accept card */}
            <div className="v22-card">
              <div className="v22-card-head">
                <div className="v22-card-title">{'📅'} {t('proDash.settings.parametresAgenda')}</div>
              </div>
              <div className="v22-card-body">
                {/* Toggle auto-accept */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: 'var(--v22-bg)', borderRadius: 6, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--v22-text)' }}>{t('proDash.settings.validationAutoRdv')}</div>
                    <div style={{ fontSize: 12, color: 'var(--v22-text-muted)', marginTop: 2 }}>
                      {autoAccept ? t('proDash.settings.autoAcceptOn') : t('proDash.settings.autoAcceptOff')}
                    </div>
                  </div>
                  <button onClick={toggleAutoAccept} style={{ width: 44, height: 24, borderRadius: 12, position: 'relative', transition: 'background .2s', background: autoAccept ? 'var(--v22-green)' : 'var(--v22-border-dark)', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                    <div style={{ position: 'absolute', top: 2, width: 20, height: 20, background: '#fff', borderRadius: '50%', boxShadow: '0 1px 2px rgba(0,0,0,.15)', transition: 'left .2s', left: autoAccept ? 22 : 2 }} />
                  </button>
                </div>

                {autoAccept && (
                  <div style={{ padding: 12, background: 'var(--v22-green-light)', borderRadius: 6, border: '1px solid var(--v22-green)', marginBottom: 12 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--v22-text)', marginBottom: 8 }}>{'⚙️'} {t('proDash.settings.optionsAutoAccept')}</div>
                    <label className="v22-form-label">{t('proDash.settings.dureeBlocage')}</label>
                    <select
                      value={settingsForm.auto_block_duration_minutes}
                      onChange={e => setSettingsForm({...settingsForm, auto_block_duration_minutes: parseInt(e.target.value)})}
                      className="v22-form-input"
                    >
                      <option value={60}>{t('proDash.settings.heures1')}</option>
                      <option value={120}>{t('proDash.settings.heures2')}</option>
                      <option value={180}>{t('proDash.settings.heures3')}</option>
                      <option value={240}>{t('proDash.settings.heures4')}</option>
                      <option value={360}>{t('proDash.settings.heures6')}</option>
                      <option value={480}>{t('proDash.settings.heures8')}</option>
                    </select>
                    <span style={{ fontSize: 11, color: 'var(--v22-text-muted)', marginTop: 4, display: 'block' }}>{t('proDash.settings.blocageInfo')}</span>
                  </div>
                )}

                {/* Auto-reply */}
                <div style={{ padding: 12, background: 'var(--v22-bg)', borderRadius: 6, marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--v22-text)', marginBottom: 4 }}>{'💬'} {t('proDash.settings.reponseAuto')}</div>
                  <div style={{ fontSize: 12, color: 'var(--v22-text-muted)', marginBottom: 8 }}>{t('proDash.settings.reponseAutoDesc')}</div>
                  <textarea
                    value={settingsForm.auto_reply_message}
                    onChange={e => setSettingsForm({...settingsForm, auto_reply_message: e.target.value})}
                    rows={3}
                    placeholder={t('proDash.settings.reponseAutoPlaceholder')}
                    className="v22-form-input"
                    style={{ resize: 'none' }}
                  />
                </div>

                {/* Intervention radius */}
                <div style={{ padding: 12, background: 'var(--v22-bg)', borderRadius: 6 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--v22-text)', marginBottom: 8 }}>{'📍'} {t('proDash.settings.perimetreIntervention')}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input
                      type="range"
                      min={5}
                      max={100}
                      step={5}
                      value={settingsForm.zone_radius_km}
                      onChange={e => setSettingsForm({...settingsForm, zone_radius_km: parseInt(e.target.value)})}
                      style={{ flex: 1, accentColor: 'var(--v22-yellow)' }}
                    />
                    <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--v22-text)', minWidth: 60, textAlign: 'right' }}>{settingsForm.zone_radius_km} km</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--v22-text-muted)', marginTop: 4, display: 'block' }}>{t('proDash.settings.rayonAutour')}</span>
                </div>

                <div style={{ display: 'flex', gap: 8, paddingTop: 12 }}>
                  <button onClick={saveSettings} disabled={savingSettings}
                    className="v22-btn v22-btn-primary"
                    style={{ opacity: savingSettings ? 0.5 : 1 }}>
                    {savingSettings ? `⏳ ${t('proDash.settings.sauvegarde')}` : `💾 ${t('proDash.settings.enregistrerParametres')}`}
                  </button>
                </div>
              </div>
            </div>

            {/* Password change */}
            <PasswordChangeCard />
          </div>
        </div>
      </div>
      )}

      {/* Parrainage */}
      {settingsTab === 'parrainage' && (
        <ParrainageSettingsTab artisanId={artisan.id} />
      )}

      {/* Modules */}
      {settingsTab === 'modules' && (
        <div style={{ padding: 16 }}>
          <div style={{ maxWidth: 960, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--v22-text)' }}>🧩 {t('proDash.settings.mesModules')}</div>
                <div style={{ fontSize: 12, color: 'var(--v22-text-muted)', marginTop: 2 }}>{t('proDash.settings.modulesDesc')}</div>
              </div>
              <span className="v22-tag v22-tag-yellow">
                {ALL_MODULES.filter(m => !m.locked && isModuleEnabled(m.id)).length}/{ALL_MODULES.filter(m => !m.locked).length} {t('proDash.settings.actifs')}
              </span>
            </div>

            {/* Module Cards Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { title: `📅 ${t('proDash.settings.activite')}`, keys: ['calendar', 'motifs', 'horaires'] },
                { title: `💬 ${t('proDash.settings.communicationGroup')}`, keys: ['messages', 'clients'] },
                { title: `📄 ${t('proDash.settings.facturationDocs')}`, keys: ['devis', 'factures', 'rapports', 'contrats'] },
                { title: `📊 ${t('proDash.settings.analyseFinances')}`, keys: ['stats', 'revenus', 'comptabilite', 'materiaux'] },
                { title: `🗂️ ${t('proDash.settings.profilProGroup')}`, keys: ['wallet', 'portfolio', 'parrainage'] },
              ].map(group => {
                const groupMods = ALL_MODULES.filter(m => group.keys.includes(m.id))
                if (groupMods.length === 0) return null
                return (
                  <div key={group.title}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--v22-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{group.title}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                      {groupMods.map(mod => {
                        const enabled = isModuleEnabled(mod.id)
                        return (
                          <div key={mod.id} className="v22-card" style={{ opacity: enabled ? 1 : 0.6, borderColor: enabled ? 'var(--v22-yellow-border)' : 'var(--v22-border)' }}>
                            <div style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, background: enabled ? 'var(--v22-yellow-light)' : 'var(--v22-bg)' }}>
                                {mod.icon}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--v22-text)' }}>{mod.label}</div>
                                <div style={{ fontSize: 11, color: 'var(--v22-text-muted)', marginTop: 2 }}>{mod.description}</div>
                              </div>
                              <button
                                onClick={() => toggleModule(mod.id)}
                                style={{ width: 44, height: 24, borderRadius: 12, position: 'relative', transition: 'background .2s', background: enabled ? 'var(--v22-yellow)' : 'var(--v22-border-dark)', border: 'none', cursor: 'pointer', flexShrink: 0 }}
                              >
                                <div style={{ width: 20, height: 20, background: '#fff', borderRadius: '50%', boxShadow: '0 1px 2px rgba(0,0,0,.15)', position: 'absolute', top: 2, transition: 'left .2s', left: enabled ? 22 : 2 }} />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Menu order */}
            <div className="v22-card" style={{ marginTop: 16 }}>
              <div className="v22-card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div className="v22-card-title">↕️ {t('proDash.settings.ordreMenu')}</div>
                  <div style={{ fontSize: 12, color: 'var(--v22-text-muted)', marginTop: 2 }}>{t('proDash.settings.ordreMenuDesc')}</div>
                </div>
                <button
                  onClick={() => saveModulesConfig(ALL_MODULES.map((m, i) => ({ id: m.id, enabled: true, order: i })))}
                  className="v22-btn v22-btn-sm"
                >
                  ↺ {t('proDash.settings.reinitialiser')}
                </button>
              </div>
              <div className="v22-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(() => {
                  const enabledMods = modulesConfig
                    .filter(c => c.enabled)
                    .sort((a, b) => a.order - b.order)
                  return enabledMods.map((conf, idx) => {
                    const mod = ALL_MODULES.find(m => m.id === conf.id)
                    if (!mod) return null
                    return (
                      <div key={mod.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: '1px solid var(--v22-yellow-border)', borderRadius: 6, background: 'var(--v22-surface)', transition: 'border-color .15s' }}>
                        <span style={{ color: 'var(--v22-text-muted)', userSelect: 'none', fontSize: 16, lineHeight: 1, fontFamily: 'monospace' }}>⠿</span>
                        <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{mod.icon}</span>
                        <span style={{ flex: 1, fontWeight: 600, fontSize: 13, color: 'var(--v22-text)' }}>{mod.label}</span>
                        <span className="v22-ref" style={{ width: 20, textAlign: 'center' }}>{idx + 1}</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <button
                            onClick={() => moveModule(mod.id, 'up')}
                            disabled={idx === 0}
                            style={{ width: 22, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 3, border: 'none', background: 'none', cursor: idx === 0 ? 'not-allowed' : 'pointer', color: idx === 0 ? 'var(--v22-border)' : 'var(--v22-text-muted)', fontSize: 11, fontWeight: 700, opacity: idx === 0 ? 0.3 : 1 }}
                          >▲</button>
                          <button
                            onClick={() => moveModule(mod.id, 'down')}
                            disabled={idx === enabledMods.length - 1}
                            style={{ width: 22, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 3, border: 'none', background: 'none', cursor: idx === enabledMods.length - 1 ? 'not-allowed' : 'pointer', color: idx === enabledMods.length - 1 ? 'var(--v22-border)' : 'var(--v22-text-muted)', fontSize: 11, fontWeight: 700, opacity: idx === enabledMods.length - 1 ? 0.3 : 1 }}
                          >▼</button>
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            </div>

            {/* Tip box */}
            <div className="v22-alert v22-alert-amber" style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: 18 }}>💡</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--v22-amber)' }}>{t('proDash.settings.astuce')}</div>
                  <div style={{ fontSize: 11, color: 'var(--v22-text-muted)', marginTop: 2 }}>{t('proDash.settings.astuceTexte')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
