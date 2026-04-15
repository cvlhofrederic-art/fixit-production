'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import Image from 'next/image'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import { supabase } from '@/lib/supabase'
import { SITE_URL } from '@/lib/constants'
import type { Artisan } from '@/lib/types'
import { useThemeVars } from './useThemeVars'

interface SettingsSectionProps {
  artisan: Artisan
  initials: string
  orgRole?: string
  settingsForm: {
    company_name: string; email: string; phone: string; bio: string;
    auto_block_duration_minutes: number; auto_reply_message: string; zone_radius_km: number
  }
  setSettingsForm: (v: { company_name: string; email: string; phone: string; bio: string; auto_block_duration_minutes: number; auto_reply_message: string; zone_radius_km: number }) => void
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

const MODE_LABELS_FR: Record<string, string> = {
  virement: 'Virement bancaire',
  stripe: 'Paiement en ligne Stripe',
  cheque: 'Chèque',
  especes: 'Espèces',
  autre: 'Autre',
}
const MODE_LABELS_PT: Record<string, string> = {
  virement: 'Transferência bancária',
  stripe: 'Pagamento online Stripe',
  cheque: 'Cheque',
  especes: 'Dinheiro',
  autre: 'Outro',
}

function formatIban(raw: string): string {
  return raw.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim()
}

function isValidIban(iban: string): boolean {
  const clean = iban.replace(/\s/g, '')
  return /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(clean)
}

function PaymentInfoCard({ artisanId, isV5 }: { artisanId: string; isV5: boolean }) {
  const tv = useThemeVars(isV5)
  const locale = useLocale()
  const isPt = locale === 'pt'
  const MODE_LABELS = isPt ? MODE_LABELS_PT : MODE_LABELS_FR
  const [modes, setModes] = useState<PaymentMode[]>(DEFAULT_MODES)
  const [mentionDevis, setMentionDevis] = useState(true)
  const [mentionFacture, setMentionFacture] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!artisanId) return
    fetch('/api/artisan-payment-info')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        if (data.paiement_modes) setModes(data.paiement_modes)
        setMentionDevis(data.paiement_mention_devis ?? true)
        setMentionFacture(data.paiement_mention_facture ?? true)
      })
      .catch((e) => console.warn('Payment info load failed:', e))
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
    } catch (e) {
      console.error('Payment info save failed:', e)
      toast.error(isPt ? 'Erro ao guardar as informações de pagamento' : 'Erreur lors de la sauvegarde des informations de paiement')
    }
    setSaving(false)
  }

  const activeModes = modes.filter(m => m.actif)

  if (loading) return <div className={isV5 ? 'v5-card' : 'v22-card'}><div className={isV5 ? '' : 'v22-card-body'} style={{ textAlign: 'center', padding: 20, color: tv.textMuted }}>{isPt ? 'A carregar...' : 'Chargement...'}</div></div>

  return (
    <div className={isV5 ? 'v5-card' : 'v22-card'}>
      <div className={isV5 ? '' : 'v22-card-head'}>
        <div className={isV5 ? 'v5-st' : 'v22-card-title'}>{isPt ? 'Informações de pagamento' : 'Informations de paiement'}</div>
      </div>
      <div className={isV5 ? '' : 'v22-card-body'} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 11, color: '#999', marginBottom: '.25rem' }}>
          {isPt ? 'Estas informações aparecerão nos seus orçamentos e faturas enviados aos clientes.' : 'Ces modes apparaîtront sur vos devis et factures.'}
        </div>

        {modes.map((mode, idx) => (
          <div key={mode.type}>
            <label className="set-pay-item">
              <input type="checkbox" checked={mode.actif} onChange={(e) => updateMode(idx, { actif: e.target.checked })} />
              <span className="set-pay-label">{MODE_LABELS[mode.type]}</span>
            </label>

            {mode.actif && mode.type === 'virement' && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: 12, width: 60 }}>IBAN</label>
                  <input className={isV5 ? 'v5-fi' : 'v22-form-input'} value={mode.iban || ''} onChange={(e) => updateMode(idx, { iban: e.target.value.toUpperCase() })} placeholder="FR76 XXXX XXXX XXXX" style={{ flex: 1, fontSize: 12 }} />
                  {mode.iban && mode.iban.replace(/\s/g, '').length > 4 && (
                    <span style={{ fontSize: 14 }}>{isValidIban(mode.iban) ? '✅' : '⚠️'}</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: 12, width: 60 }}>BIC</label>
                  <input className={isV5 ? 'v5-fi' : 'v22-form-input'} value={mode.bic || ''} onChange={(e) => updateMode(idx, { bic: e.target.value.toUpperCase() })} placeholder="BNPAFRPP" style={{ flex: 1, fontSize: 12 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: 12, width: 60 }}>Titulaire</label>
                  <input className={isV5 ? 'v5-fi' : 'v22-form-input'} value={mode.titulaire || ''} onChange={(e) => updateMode(idx, { titulaire: e.target.value })} placeholder="Nom du titulaire" style={{ flex: 1, fontSize: 12 }} />
                </div>
              </div>
            )}

            {mode.actif && mode.type === 'stripe' && (
              <div style={{ marginTop: 8, paddingLeft: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: 12, width: 60 }}>Lien</label>
                  <input className={isV5 ? 'v5-fi' : 'v22-form-input'} value={mode.lien || ''} onChange={(e) => updateMode(idx, { lien: e.target.value })} placeholder="https://buy.stripe.com/..." style={{ flex: 1, fontSize: 12 }} />
                </div>
                <div style={{ fontSize: 11, color: tv.textMuted, marginTop: 4, paddingLeft: 66 }}>Le client paiera directement depuis ce lien</div>
              </div>
            )}

            {mode.actif && mode.type === 'cheque' && (
              <div style={{ marginTop: 8, paddingLeft: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: 12, width: 60 }}>À l{"'"}ordre de</label>
                  <input className={isV5 ? 'v5-fi' : 'v22-form-input'} value={mode.ordre || ''} onChange={(e) => updateMode(idx, { ordre: e.target.value })} placeholder="Nom" style={{ flex: 1, fontSize: 12 }} />
                </div>
              </div>
            )}

            {mode.actif && mode.type === 'especes' && (
              <div style={{ marginTop: 4, paddingLeft: 24, fontSize: 11, color: tv.textMuted }}>Aucune info supplémentaire requise</div>
            )}

            {mode.actif && mode.type === 'autre' && (
              <div style={{ marginTop: 8, paddingLeft: 24 }}>
                <input className={isV5 ? 'v5-fi' : 'v22-form-input'} value={mode.description || ''} onChange={(e) => updateMode(idx, { description: e.target.value })} placeholder="PayPal, Lydia, virement étranger..." style={{ fontSize: 12 }} />
              </div>
            )}
          </div>
        ))}

        {/* Toggles affichage */}
        <div className="set-pay-sub">
          <label>
            <input type="checkbox" checked={mentionDevis} onChange={(e) => { setMentionDevis(e.target.checked); setSaved(false) }} />
            Afficher sur les devis
          </label>
          <label>
            <input type="checkbox" checked={mentionFacture} onChange={(e) => { setMentionFacture(e.target.checked); setSaved(false) }} />
            Afficher sur les factures
          </label>
        </div>

        {/* Aperçu */}
        {activeModes.length > 0 && (
          <div style={{ background: tv.surface, border: `1px solid ${tv.border}`, borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 6, color: tv.textMuted }}>APERÇU SUR LE DOCUMENT</div>
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>MODE DE RÈGLEMENT</div>
            {activeModes.map(m => (
              <div key={m.type} style={{ fontSize: 11, color: tv.textSecondary, marginBottom: 2 }}>
                {m.type === 'virement' && `Virement : ${formatIban(m.iban || '...')} — ${m.titulaire || '...'}`}
                {m.type === 'stripe' && `Paiement en ligne : ${m.lien || '...'}`}
                {m.type === 'cheque' && `Chèque à l'ordre de : ${m.ordre || '...'}`}
                {m.type === 'especes' && 'Espèces'}
                {m.type === 'autre' && (m.description || 'Autre mode de paiement')}
              </div>
            ))}
          </div>
        )}

        <button onClick={handleSave} disabled={saving} className="set-btn-primary" style={{ alignSelf: 'flex-start' }}>
          {saving ? '⏳ Enregistrement...' : saved ? '✅ Enregistré' : '💾 Enregistrer'}
        </button>
      </div>
    </div>
  )
}

// ── Parrainage Settings Tab ────────────────────────────────────────────────

function ParrainageSettingsTab({ artisanId, isV5 }: { artisanId: string; isV5: boolean }) {
  const tv = useThemeVars(isV5)
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
      <div style={{ padding: 16, textAlign: 'center', color: tv.textMuted }}>
        Chargement...
      </div>
    )
  }

  return (
    <div style={{ padding: 16, maxWidth: 672, margin: '0 auto' }}>
      {/* Code de parrainage */}
      <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ marginBottom: 16 }}>
        <div className={isV5 ? '' : 'v22-card-head'}>
          <div className={isV5 ? 'v5-st' : 'v22-card-title'}>🔗 Votre code de parrainage</div>
        </div>
        <div className={isV5 ? '' : 'v22-card-body'}>
          {referralCode ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1, padding: '10px 14px', background: tv.bg, borderRadius: 8, border: `1px solid ${tv.border}`, fontFamily: 'monospace', fontSize: 16, fontWeight: 700, letterSpacing: '0.1em', color: tv.text }}>
                  {referralCode}
                </div>
                <button onClick={copyLink} className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn v22-btn-primary'} style={{ whiteSpace: 'nowrap' }}>
                  {copied ? '✅ Copié' : '📋 Copier le lien'}
                </button>
              </div>
              <div style={{ fontSize: 12, color: tv.textMuted, wordBreak: 'break-all' }}>
                {referralLink}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <p style={{ fontSize: 14, color: tv.textMuted, marginBottom: 12 }}>
                Aucun code de parrainage. Générez-en un pour commencer à parrainer.
              </p>
              <button onClick={generateCode} disabled={generating} className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn v22-btn-primary'} style={{ opacity: generating ? 0.5 : 1 }}>
                {generating ? '⏳ Génération...' : '🎁 Générer mon code'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats rapides */}
      <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ marginBottom: 16 }}>
        <div className={isV5 ? '' : 'v22-card-head'}>
          <div className={isV5 ? 'v5-st' : 'v22-card-title'}>📊 Vos stats parrainage</div>
        </div>
        <div className={isV5 ? '' : 'v22-card-body'}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ padding: 16, background: tv.bg, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: tv.text }}>{totalParrainages}</div>
              <div style={{ fontSize: 12, color: tv.textMuted, marginTop: 4 }}>Parrainage{totalParrainages > 1 ? 's' : ''} réussi{totalParrainages > 1 ? 's' : ''}</div>
            </div>
            <div style={{ padding: 16, background: creditMois > 0 ? tv.greenLight : tv.bg, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: creditMois > 0 ? tv.green : tv.text }}>{creditMois}</div>
              <div style={{ fontSize: 12, color: tv.textMuted, marginTop: 4 }}>Mois gratuit{creditMois > 1 ? 's' : ''} disponible{creditMois > 1 ? 's' : ''}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className={isV5 ? 'v5-card' : 'v22-card'}>
        <div className={isV5 ? '' : 'v22-card-head'}>
          <div className={isV5 ? 'v5-st' : 'v22-card-title'}>🔔 Notifications parrainage</div>
        </div>
        <div className={isV5 ? '' : 'v22-card-body'}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: tv.bg, borderRadius: 6 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: tv.text }}>Emails de parrainage</div>
              <div style={{ fontSize: 12, color: tv.textMuted, marginTop: 2 }}>
                {notifEnabled ? 'Recevez un email à chaque étape du parrainage' : 'Notifications par email désactivées'}
              </div>
            </div>
            <button
              onClick={toggleNotifications}
              disabled={savingNotif}
              style={{
                width: 44, height: 24, borderRadius: 12, position: 'relative',
                transition: 'background .2s',
                background: notifEnabled ? tv.green : tv.borderDark,
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

function checkPasswordStrength(val: string) {
  const hasLen = val.length >= 12
  const hasUpper = /[A-Z]/.test(val)
  const hasNum = /[0-9]/.test(val)
  const hasSpecial = /[^A-Za-z0-9]/.test(val)
  const score = [hasLen, hasUpper, hasNum, hasSpecial].filter(Boolean).length
  return { hasLen, hasUpper, hasNum, hasSpecial, score }
}

// ── Zones d'intervention — matching HTML reference ────────────────────────

const FR_REGIONS = [
  'Auvergne-Rhône-Alpes', 'Bourgogne-Franche-Comté', 'Bretagne', 'Centre-Val de Loire',
  'Corse', 'Grand Est', 'Hauts-de-France', 'Île-de-France',
  'Normandie', 'Nouvelle-Aquitaine', 'Occitanie', 'Pays de la Loire',
  'Provence-Alpes-Côte d\'Azur',
]

function ZonesInterventionCard({ isV5 }: { isV5: boolean }) {
  const [mode, setMode] = useState<'region' | 'dept' | 'city'>('region')
  const [selectedRegions, setSelectedRegions] = useState<string[]>([])
  const [selectedDepts, setSelectedDepts] = useState<string[]>([])
  const [selectedCities, setSelectedCities] = useState<string[]>([])
  const [citySearch, setCitySearch] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('vitfix_intervention_zones')
      if (raw) {
        const d = JSON.parse(raw)
        if (Array.isArray(d.regions)) setSelectedRegions(d.regions)
        if (Array.isArray(d.depts)) setSelectedDepts(d.depts)
        if (Array.isArray(d.cities)) setSelectedCities(d.cities)
      }
    } catch { /* silent */ }
  }, [])

  const toggleRegion = (r: string) => {
    setSelectedRegions(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])
  }
  const removeRegion = (r: string) => setSelectedRegions(prev => prev.filter(x => x !== r))

  const save = () => {
    setSaving(true)
    try {
      localStorage.setItem('vitfix_intervention_zones', JSON.stringify({
        regions: selectedRegions, depts: selectedDepts, cities: selectedCities,
      }))
      toast.success('Zones d\'intervention enregistrées')
    } catch {
      toast.error('Erreur lors de la sauvegarde')
    }
    setSaving(false)
  }

  const reset = () => {
    setSelectedRegions([]); setSelectedDepts([]); setSelectedCities([]); setCitySearch('')
  }

  const totalSelected = selectedRegions.length + selectedDepts.length + selectedCities.length

  return (
    <div className={isV5 ? 'v5-card' : 'v22-card'}>
      <div className={isV5 ? '' : 'v22-card-head'}>
        <div className={isV5 ? 'v5-st' : 'v22-card-title'}>📍 Zones d&apos;intervention</div>
      </div>
      <div className={isV5 ? '' : 'v22-card-body'}>
        <div className="set-tabs">
          <button className={`set-tab-b${mode === 'region' ? ' active' : ''}`} onClick={() => setMode('region')}>🌍 Région</button>
          <button className={`set-tab-b${mode === 'dept' ? ' active' : ''}`} onClick={() => setMode('dept')}>📍 Département</button>
          <button className={`set-tab-b${mode === 'city' ? ' active' : ''}`} onClick={() => setMode('city')}>🏙️ Ville</button>
        </div>

        {mode === 'region' && (
          <div>
            <div style={{ fontSize: 11, color: '#999', marginBottom: '.6rem' }}>Sélectionnez une ou plusieurs régions</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '.5rem', marginBottom: '.75rem' }}>
              {FR_REGIONS.map(r => (
                <label key={r} className="set-zone-cb">
                  <input type="checkbox" checked={selectedRegions.includes(r)} onChange={() => toggleRegion(r)} />
                  <span>{r}</span>
                </label>
              ))}
            </div>
            <div className={`set-selected-box${selectedRegions.length ? ' has-items' : ''}`}>
              {selectedRegions.map(r => (
                <span key={r} className="set-zone-tag">
                  {r}
                  <button type="button" className="set-zone-tag-remove" onClick={() => removeRegion(r)}>×</button>
                </span>
              ))}
            </div>
          </div>
        )}

        {mode === 'dept' && (
          <div>
            <div style={{ fontSize: 11, color: '#999', marginBottom: '.6rem' }}>Sélectionnez des départements (ex : 13, 75, 69…)</div>
            <input
              type="text"
              className="set-pw-fi"
              placeholder="Ajouter un département (numéro ou nom)"
              style={{ letterSpacing: 'normal' }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value.trim()
                  if (val && !selectedDepts.includes(val)) {
                    setSelectedDepts([...selectedDepts, val]);
                    (e.target as HTMLInputElement).value = ''
                  }
                }
              }}
            />
            <div className={`set-selected-box${selectedDepts.length ? ' has-items' : ''}`} style={{ marginTop: '.75rem' }}>
              {selectedDepts.map(d => (
                <span key={d} className="set-zone-tag">
                  {d}
                  <button type="button" className="set-zone-tag-remove" onClick={() => setSelectedDepts(prev => prev.filter(x => x !== d))}>×</button>
                </span>
              ))}
            </div>
          </div>
        )}

        {mode === 'city' && (
          <div>
            <div style={{ fontSize: 11, color: '#999', marginBottom: '.6rem' }}>Rechercher une ville</div>
            <input
              type="text"
              className="set-pw-fi"
              placeholder="Marseille, Paris, Lyon…"
              value={citySearch}
              style={{ letterSpacing: 'normal' }}
              onChange={e => setCitySearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && citySearch.trim()) {
                  if (!selectedCities.includes(citySearch.trim())) {
                    setSelectedCities([...selectedCities, citySearch.trim()])
                  }
                  setCitySearch('')
                }
              }}
            />
            <div style={{ fontSize: 10, color: '#BBB', marginTop: 3 }}>Appuyez sur Entrée pour ajouter</div>
            <div className={`set-selected-box${selectedCities.length ? ' has-items' : ''}`} style={{ marginTop: '.75rem' }}>
              {selectedCities.map(c => (
                <span key={c} className="set-zone-tag">
                  {c}
                  <button type="button" className="set-zone-tag-remove" onClick={() => setSelectedCities(prev => prev.filter(x => x !== c))}>×</button>
                </span>
              ))}
            </div>
          </div>
        )}

        {totalSelected > 0 && (
          <div className="set-interv-summary" style={{ marginTop: '.75rem' }}>
            <div className="set-interv-summary-title">📊 Résumé de couverture</div>
            <div className="set-interv-summary-text">
              {selectedRegions.length > 0 && <div>{selectedRegions.length} région{selectedRegions.length > 1 ? 's' : ''} sélectionnée{selectedRegions.length > 1 ? 's' : ''}</div>}
              {selectedDepts.length > 0 && <div>{selectedDepts.length} département{selectedDepts.length > 1 ? 's' : ''}</div>}
              {selectedCities.length > 0 && <div>{selectedCities.length} ville{selectedCities.length > 1 ? 's' : ''}</div>}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: '.85rem' }}>
          <button onClick={save} disabled={saving} className="set-btn-primary">
            {saving ? '⏳ …' : '💾 Enregistrer les zones'}
          </button>
          <button onClick={reset} className="set-btn-secondary">
            🗑️ Réinitialiser
          </button>
        </div>
      </div>
    </div>
  )
}

function PasswordChangeCard({ isV5 }: { isV5: boolean }) {
  const tv = useThemeVars(isV5)
  const { t } = useTranslation()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [showPw1, setShowPw1] = useState(false)
  const [showPw2, setShowPw2] = useState(false)

  const strength = checkPasswordStrength(newPassword)
  const strengthLabels = [
    t('proDash.settings.pwdStrengthWeak'),
    t('proDash.settings.pwdStrengthMedium'),
    t('proDash.settings.pwdStrengthGood'),
    t('proDash.settings.pwdStrengthStrong'),
  ]

  const handleChangePassword = async () => {
    setMsg(null)
    const { hasLen, hasUpper, hasNum, hasSpecial } = strength
    if (!hasLen || !hasUpper || !hasNum || !hasSpecial) {
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
    <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ marginTop: 16 }}>
      <div className={isV5 ? '' : 'v22-card-head'}>
        <div className={isV5 ? 'v5-st' : 'v22-card-title'}>{'🔒'} {t('proDash.settings.securityTitle')}</div>
      </div>
      <div className={isV5 ? '' : 'v22-card-body'}>
        {msg && (
          <div className={isV5 ? `v5-badge v5-badge-${msg.type === 'success' ? 'green' : 'red'}` : `v22-alert ${msg.type === 'success' ? 'v22-alert-green' : 'v22-alert-red'}`} style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            {msg.text}
            <button onClick={() => setMsg(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: tv.textMuted, fontSize: 14 }}>{'✕'}</button>
          </div>
        )}

        <div className={`${isV5 ? 'v5-fg' : 'v22-form-group'} set-fg-with-toggle`}>
          <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{t('proDash.settings.newPassword')}</label>
          <div className="set-pw-wrapper">
            <input
              type={showPw1 ? 'text' : 'password'}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="••••••••••••"
              autoComplete="new-password"
              className="set-pw-fi set-pw-fi-with-toggle"
            />
            <button
              type="button"
              onClick={() => setShowPw1(v => !v)}
              className="set-pw-toggle"
              aria-label={showPw1 ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            >
              {showPw1 ? '👁️‍🗨️' : '👁️'}
            </button>
          </div>
          {newPassword && (
            <div className="set-pw-strength">
              <div className="set-pw-strength-bars">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className={`set-pw-strength-bar${i < strength.score ? ' active' : ''}`} />
                ))}
              </div>
              <div className={`set-pw-strength-label${strength.score > 0 ? ' active' : ''}`}>
                {strength.score > 0 ? strengthLabels[strength.score - 1] : '—'}
              </div>
              <div className="set-pw-criteria">
                <div className={`set-pw-crit${strength.hasLen ? ' ok' : ''}`}>{t('proDash.settings.pwdCritLen')}</div>
                <div className={`set-pw-crit${strength.hasUpper ? ' ok' : ''}`}>{t('proDash.settings.pwdCritUpper')}</div>
                <div className={`set-pw-crit${strength.hasNum ? ' ok' : ''}`}>{t('proDash.settings.pwdCritNum')}</div>
                <div className={`set-pw-crit${strength.hasSpecial ? ' ok' : ''}`}>{t('proDash.settings.pwdCritSpecial')}</div>
              </div>
            </div>
          )}
        </div>
        <div className={`${isV5 ? 'v5-fg' : 'v22-form-group'} set-fg-with-toggle`}>
          <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{t('proDash.settings.confirmPassword')}</label>
          <div className="set-pw-wrapper">
            <input
              type={showPw2 ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
              autoComplete="new-password"
              className="set-pw-fi set-pw-fi-with-toggle"
            />
            <button
              type="button"
              onClick={() => setShowPw2(v => !v)}
              className="set-pw-toggle"
              aria-label={showPw2 ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            >
              {showPw2 ? '👁️‍🗨️' : '👁️'}
            </button>
          </div>
          <span style={{ fontSize: 11, color: tv.textMuted, marginTop: 4, display: 'block' }}>{t('proDash.settings.pwdMinLength')}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
          <button
            onClick={handleChangePassword}
            disabled={saving || !newPassword || !confirmPassword}
            className="set-btn-secondary"
          >
            {saving ? `⏳ ${t('proDash.settings.pwdSaving')}` : `🔑 ${t('proDash.settings.pwdUpdate')}`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SettingsSection({
  artisan, initials, orgRole, settingsForm, setSettingsForm,
  savingSettings, saveSettings, autoAccept, toggleAutoAccept,
  profilePhotoPreview, setProfilePhotoPreview, profilePhotoFile, setProfilePhotoFile,
  profilePhotoUploading, uploadDocument, setProfilePhotoUploading,
  uploadMsg, setUploadMsg,
}: SettingsSectionProps) {
  const { t } = useTranslation()
  const isV5 = orgRole === 'pro_societe' || orgRole === 'artisan'
  const tv = useThemeVars(isV5)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState('')
  const [logoUploading, setLogoUploading] = useState(false)

  return (
    <div className={isV5 ? 'v5-fade' : 'animate-fadeIn'}>
      {/* Page header */}
      <div className={isV5 ? 'v5-pg-t' : 'v22-page-header'} style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {isV5 ? (
            <>
              <h1>Mon profil</h1>
              <p>Gérez vos informations personnelles et professionnelles.</p>
            </>
          ) : (
            <>
              <div className="v22-page-title">Mon profil</div>
              <div className="v22-page-sub">Gérez vos informations personnelles et professionnelles.</div>
            </>
          )}
        </div>
        <button onClick={saveSettings} disabled={savingSettings} className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn v22-btn-primary'} style={{ opacity: savingSettings ? 0.5 : 1 }}>
          {savingSettings ? `⏳ ${t('proDash.settings.sauvegarde')}` : `💾 ${t('proDash.settings.enregistrer')}`}
        </button>
      </div>

      {/* Profil & Parametres */}
      <div className="set-layout" style={{ padding: '16px' }}>
        {/* Two-column grid: profile left, settings right */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* LEFT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Profile card — copié du HTML vvvitfix_btp_dashboardpro_v7_settings_IMPROVED */}
            <div className={isV5 ? 'v5-card' : 'v22-card'}>
              <div className={isV5 ? '' : 'v22-card-head'}>
                <div className={isV5 ? 'v5-st' : 'v22-card-title'}>👤 {t('proDash.settings.profilProfessionnel')}</div>
              </div>
              <div className={isV5 ? '' : 'v22-card-body'}>
                {/* Upload message */}
                {uploadMsg && (
                  <div className={isV5 ? `v5-badge v5-badge-${uploadMsg.type === 'success' ? 'green' : 'red'}` : `v22-alert ${uploadMsg.type === 'success' ? 'v22-alert-green' : 'v22-alert-red'}`} style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {uploadMsg.text}
                    <button onClick={() => setUploadMsg(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: tv.textMuted, fontSize: 14 }}>{'✕'}</button>
                  </div>
                )}

                {/* Identité visuelle : avatar + logo côte à côte avec labels clairs */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #F0F0F0' }}>
                  {/* Photo de profil */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', border: '3px solid #FFE082', flexShrink: 0, background: '#F57C00', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', cursor: 'pointer' }}>
                      {profilePhotoPreview ? (
                        <Image src={profilePhotoPreview} alt={t('proDash.settings.photoProfil')} fill className="object-cover" unoptimized />
                      ) : (artisan as any)?.profile_photo_url ? (
                        <Image src={(artisan as any).profile_photo_url} alt={t('proDash.settings.photoProfil')} fill className="object-cover" sizes="64px" />
                      ) : (
                        <span style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{initials}</span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#999', letterSpacing: '.3px', marginBottom: 4 }}>Photo de profil</div>
                      <label style={{ cursor: profilePhotoUploading ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 4, border: '1px solid #E0E0E0', background: '#fff', fontSize: 11, fontWeight: 500, color: '#555', fontFamily: 'inherit', transition: 'all .15s', opacity: profilePhotoUploading ? 0.5 : 1 }}>
                        {profilePhotoUploading ? '⏳ …' : '🖼️ Changer'}
                        <input type="file" accept="image/png,image/jpeg,image/webp" disabled={profilePhotoUploading} style={{ display: 'none' }} onChange={async (e) => {
                          const f = e.target.files?.[0]
                          if (!f) return
                          if (f.size > 500 * 1024) { setUploadMsg({ text: 'Photo trop lourde (max 500 Ko)', type: 'error' }); return }
                          setProfilePhotoUploading(true)
                          try {
                            const base64 = await new Promise<string>((resolve) => {
                              const reader = new FileReader()
                              reader.onload = (ev) => resolve(ev.target?.result as string)
                              reader.readAsDataURL(f)
                            })
                            setProfilePhotoPreview(base64)
                            const token = (await supabase.auth.getSession()).data.session?.access_token
                            const res = await fetch('/api/save-logo', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
                              body: JSON.stringify({ base64, field: 'profile_photo_url' }),
                            })
                            const data = await res.json()
                            if (!res.ok) throw new Error(data.error || 'Erreur')
                            setUploadMsg({ text: '✅ Photo enregistrée !', type: 'success' })
                          } catch (err: unknown) {
                            setUploadMsg({ text: `❌ ${err instanceof Error ? err.message : String(err)}`, type: 'error' })
                          } finally {
                            setProfilePhotoUploading(false)
                          }
                        }} />
                      </label>
                      <div style={{ fontSize: 10, color: '#BBB', marginTop: 3 }}>JPG, PNG, WEBP — max 10 Mo</div>
                    </div>
                  </div>

                  {/* Logo entreprise */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 64, height: 64, borderRadius: 6, overflow: 'hidden', border: '2px dashed #E0E0E0', flexShrink: 0, background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', cursor: 'pointer' }}>
                      {logoPreview ? (
                        <Image src={logoPreview} alt="Logo" fill className="object-contain" unoptimized style={{ padding: 4 }} />
                      ) : (artisan as any)?.logo_url ? (
                        <Image src={(artisan as any).logo_url} alt="Logo" fill className="object-contain" sizes="64px" style={{ padding: 4 }} />
                      ) : (
                        <span style={{ fontSize: 10, color: '#BBB', textAlign: 'center', lineHeight: 1.2 }}>L</span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#999', letterSpacing: '.3px', marginBottom: 4 }}>Logo (devis & factures)</div>
                      <label style={{ cursor: logoUploading ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 4, border: '1px solid #E0E0E0', background: '#fff', fontSize: 11, fontWeight: 500, color: '#555', fontFamily: 'inherit', transition: 'all .15s', opacity: logoUploading ? 0.5 : 1 }}>
                        {logoUploading ? '⏳ …' : '📁 Importer'}
                        <input type="file" accept="image/png,image/jpeg,image/webp" disabled={logoUploading} style={{ display: 'none' }} onChange={async (e) => {
                          const f = e.target.files?.[0]
                          if (!f) return
                          if (f.size > 500 * 1024) { setUploadMsg({ text: 'Logo trop lourd (max 500 Ko)', type: 'error' }); return }
                          setLogoUploading(true)
                          try {
                            const base64 = await new Promise<string>((resolve) => {
                              const reader = new FileReader()
                              reader.onload = (ev) => resolve(ev.target?.result as string)
                              reader.readAsDataURL(f)
                            })
                            setLogoPreview(base64)
                            const token = (await supabase.auth.getSession()).data.session?.access_token
                            const res = await fetch('/api/save-logo', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
                              body: JSON.stringify({ base64, field: 'logo_url' }),
                            })
                            const data = await res.json()
                            if (!res.ok) throw new Error(data.error || 'Erreur')
                            setUploadMsg({ text: '✅ Logo enregistré !', type: 'success' })
                          } catch (err: unknown) {
                            setUploadMsg({ text: `❌ ${err instanceof Error ? err.message : String(err)}`, type: 'error' })
                          } finally {
                            setLogoUploading(false)
                          }
                        }} />
                      </label>
                      <div style={{ fontSize: 10, color: '#BBB', marginTop: 3 }}>PNG, JPG, WebP — max 2 Mo</div>
                    </div>
                  </div>
                </div>

                {/* Champs : grid 2 colonnes — Nom pleine largeur, Email+Téléphone sur une ligne, Bio pleine largeur */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className={isV5 ? 'v5-fg' : 'v22-form-group'} style={{ gridColumn: '1 / -1' }}>
                    <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{t('proDash.settings.nomCompletEntreprise')}</label>
                    <input type="text" value={settingsForm.company_name} onChange={(e) => setSettingsForm({...settingsForm, company_name: e.target.value})}
                      className={isV5 ? 'v5-fi' : 'v22-form-input'} />
                  </div>
                  <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
                    <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{t('proDash.settings.emailProfessionnel')}</label>
                    <input type="email" value={settingsForm.email} onChange={(e) => setSettingsForm({...settingsForm, email: e.target.value})}
                      className={isV5 ? 'v5-fi' : 'v22-form-input'} />
                  </div>
                  <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
                    <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{t('proDash.settings.telephoneLabel')}</label>
                    <input type="tel" value={settingsForm.phone} onChange={(e) => setSettingsForm({...settingsForm, phone: e.target.value})}
                      className={isV5 ? 'v5-fi' : 'v22-form-input'} />
                  </div>
                  <div className={isV5 ? 'v5-fg' : 'v22-form-group'} style={{ gridColumn: '1 / -1' }}>
                    <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{t('proDash.settings.descriptionBio')}</label>
                    <textarea value={settingsForm.bio} onChange={(e) => setSettingsForm({...settingsForm, bio: e.target.value})}
                      rows={3} placeholder={t('proDash.settings.descriptionPlaceholder')}
                      className={isV5 ? 'v5-fi' : 'v22-form-input'} style={{ resize: 'none' }} />
                  </div>
                </div>

                {/* Bouton Enregistrer le profil en bas de la carte */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                  <button onClick={saveSettings} disabled={savingSettings}
                    className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn v22-btn-primary'}
                    style={{ opacity: savingSettings ? 0.5 : 1 }}>
                    {savingSettings ? `⏳ ${t('proDash.settings.sauvegarde')}` : `💾 Enregistrer le profil`}
                  </button>
                </div>
              </div>
            </div>

            {/* Sécurité / mot de passe — position 2 dans la colonne gauche (cf HTML ref) */}
            <PasswordChangeCard isV5={isV5} />

            {/* Booking link card */}
            <div className={isV5 ? 'v5-card' : 'v22-card'}>
              <div className={isV5 ? '' : 'v22-card-head'}>
                <div className={isV5 ? 'v5-st' : 'v22-card-title'}>{t('proDash.settings.lienReservation')}</div>
              </div>
              <div className={isV5 ? '' : 'v22-card-body'}>
                <div style={{ background: '#E3F2FD', color: '#1565C0', padding: '.6rem .75rem', borderRadius: 4, fontSize: 11, marginBottom: '.75rem' }}>
                  💡 Partagez ce lien avec vos clients pour qu'ils puissent prendre rendez-vous directement depuis votre agenda.
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="text" readOnly value={`${process.env.NEXT_PUBLIC_APP_URL || 'https://vitfix.io'}/artisan/${artisan?.slug || artisan?.id || ''}`}
                    style={{ flex: 1, padding: '7px 10px', border: '1px solid #E0E0E0', borderRadius: 5, fontSize: 11, fontFamily: 'inherit', background: '#FAFAFA', color: '#888' }} />
                  <button onClick={() => { navigator.clipboard.writeText(`${process.env.NEXT_PUBLIC_APP_URL || 'https://vitfix.io'}/artisan/${artisan?.slug || artisan?.id || ''}`); toast.success(t('proDash.settings.lienCopie')) }}
                    style={{ padding: '6px 14px', borderRadius: 5, border: 'none', background: 'var(--v5-primary-yellow)', color: '#333', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                    📋 {t('proDash.settings.copier')}
                  </button>
                  <button onClick={() => {
                    const url = `${process.env.NEXT_PUBLIC_APP_URL || 'https://vitfix.io'}/artisan/${artisan?.slug || artisan?.id || ''}`
                    if (navigator.share) { navigator.share({ url }).catch(() => {}) }
                    else { navigator.clipboard.writeText(url); toast.success(t('proDash.settings.lienCopie')) }
                  }}
                    className="set-btn-secondary" style={{ whiteSpace: 'nowrap' }}>
                    🔗 Partager
                  </button>
                </div>
              </div>
            </div>

            {/* Informations de paiement */}
            <PaymentInfoCard artisanId={artisan?.id as string} isV5={isV5} />

          </div>

          {/* RIGHT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Auto-accept card */}
            <div className={isV5 ? 'v5-card' : 'v22-card'}>
              <div className={isV5 ? '' : 'v22-card-head'}>
                <div className={isV5 ? 'v5-st' : 'v22-card-title'}>{'📅'} {t('proDash.settings.parametresAgenda')}</div>
              </div>
              <div className={isV5 ? '' : 'v22-card-body'}>
                {/* Toggle auto-accept — structure HTML set-toggle-row */}
                <div className="set-toggle-row">
                  <div className="set-toggle-info">
                    <div className="set-toggle-title">{t('proDash.settings.validationAutoRdv')}</div>
                    <div className="set-toggle-desc">
                      {autoAccept ? t('proDash.settings.autoAcceptOn') : t('proDash.settings.autoAcceptOff')}
                    </div>
                  </div>
                  {isV5 ? (
                    <button onClick={toggleAutoAccept} className={`v5-tgl${autoAccept ? ' active' : ''}`} />
                  ) : (
                    <button onClick={toggleAutoAccept} style={{ width: 44, height: 24, borderRadius: 12, position: 'relative', transition: 'background .2s', background: autoAccept ? tv.green : tv.borderDark, border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                      <div style={{ position: 'absolute', top: 2, width: 20, height: 20, background: '#fff', borderRadius: '50%', boxShadow: '0 1px 2px rgba(0,0,0,.15)', transition: 'left .2s', left: autoAccept ? 22 : 2 }} />
                    </button>
                  )}
                </div>

                {autoAccept && (
                  <div style={{ padding: 12, background: tv.greenLight, borderRadius: 6, border: `1px solid ${tv.green}`, marginBottom: 12 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: tv.text, marginBottom: 8 }}>{'⚙️'} {t('proDash.settings.optionsAutoAccept')}</div>
                    <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{t('proDash.settings.dureeBlocage')}</label>
                    <select
                      value={settingsForm.auto_block_duration_minutes}
                      onChange={e => setSettingsForm({...settingsForm, auto_block_duration_minutes: parseInt(e.target.value)})}
                      className={isV5 ? 'v5-fi' : 'v22-form-input'}
                    >
                      <option value={60}>{t('proDash.settings.heures1')}</option>
                      <option value={120}>{t('proDash.settings.heures2')}</option>
                      <option value={180}>{t('proDash.settings.heures3')}</option>
                      <option value={240}>{t('proDash.settings.heures4')}</option>
                      <option value={360}>{t('proDash.settings.heures6')}</option>
                      <option value={480}>{t('proDash.settings.heures8')}</option>
                    </select>
                    <span style={{ fontSize: 11, color: tv.textMuted, marginTop: 4, display: 'block' }}>{t('proDash.settings.blocageInfo')}</span>
                  </div>
                )}

                {/* Auto-reply — structure HTML set-toggle-row */}
                <div className="set-toggle-row">
                  <div className="set-toggle-info">
                    <div className="set-toggle-title">{t('proDash.settings.reponseAuto')}</div>
                    <div className="set-toggle-desc">{t('proDash.settings.reponseAutoDesc')}</div>
                  </div>
                </div>
                <div style={{ marginTop: '.65rem' }}>
                  <textarea
                    value={settingsForm.auto_reply_message}
                    onChange={e => setSettingsForm({...settingsForm, auto_reply_message: e.target.value})}
                    placeholder={t('proDash.settings.reponseAutoPlaceholder')}
                    className="set-reponse-ta"
                  />
                </div>

                <div style={{ display: 'flex', gap: 8, paddingTop: 12 }}>
                  <button onClick={saveSettings} disabled={savingSettings}
                    className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn v22-btn-primary'}
                    style={{ opacity: savingSettings ? 0.5 : 1 }}>
                    {savingSettings ? `⏳ ${t('proDash.settings.sauvegarde')}` : `💾 ${t('proDash.settings.enregistrerParametres')}`}
                  </button>
                </div>
              </div>
            </div>

            {/* Zones d'intervention — nouvelle feature matching HTML */}
            <ZonesInterventionCard isV5={isV5} />
          </div>
        </div>
      </div>

    </div>
  )
}

