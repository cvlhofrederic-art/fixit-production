'use client'

import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import { getWalletDocuments, type WalletDocConfig, type WalletDocObtenir } from '@/lib/walletConformite'

type OrgRole = 'artisan' | 'pro_societe' | 'pro_conciergerie' | 'pro_gestionnaire'

// Documents supplémentaires spécifiques aux sociétés (en plus des docs communs + métier)
const DOCS_SOCIETE_EXTRA: WalletDocConfig[] = [
  {
    id: 'statuts_societe',
    nom: 'Statuts de la société',
    description: 'Document constitutif de la société (SARL, SAS, EURL…)',
    obligatoire: true,
    validite: 'Permanent',
    icon: '📜',
    obtenir: {
      label: 'Obtenir ce document',
      lien: 'https://www.infogreffe.fr',
      note: 'Déposés au greffe du tribunal de commerce lors de la création',
    },
  },
  {
    id: 'attestation_fiscale',
    nom: 'Attestation de régularité fiscale (DGFiP)',
    description: 'Prouve que la société est à jour de ses obligations fiscales',
    obligatoire: true,
    validite: '1 an',
    icon: '🏛️',
    obtenir: {
      label: 'Obtenir ce document',
      lien: 'https://www.impots.gouv.fr/professionnel/services/votre-compte-fiscal-professionnel',
      note: 'Disponible dans votre espace professionnel sur impots.gouv.fr',
    },
  },
]

interface WalletDoc {
  url?: string
  expiryDate?: string
  uploadedAt?: string
  name?: string
}

// ── Auto-detect lien selon legal_form de l'artisan ──────────
function resolveObtainLink(o: WalletDocObtenir, legalForm: string | null): string | null {
  // Lien unique → toujours celui-là
  if (o.lien) return o.lien

  const lf = (legalForm || '').toLowerCase()
  const isSociete = lf.includes('sarl') || lf.includes('sas') || lf.includes('eurl') || lf.includes('sa ')
    || lf.includes('sci') || lf.includes('sci') || lf.includes('société') || lf.includes('societe')
  const isAuto = lf.includes('auto') || lf.includes('micro')
  const isEI = lf.includes('individuel') || lf.includes('artisan') || lf.includes(' ei')
    || lf === 'ei' || lf.includes('personne physique')

  // Priorité : match exact legal_form → fallback premier lien dispo
  if (isSociete && o.lien_societe) return o.lien_societe
  if (isAuto && o.lien_autoentrepreneur) return o.lien_autoentrepreneur
  if (isAuto && o.lien_independant) return o.lien_independant
  if (isEI && o.lien_artisan) return o.lien_artisan
  if (isEI && o.lien_independant) return o.lien_independant

  // Fallback : premier lien disponible
  return o.lien_independant || o.lien_artisan || o.lien_autoentrepreneur || o.lien_societe || null
}

// ── Bouton "Obtenir" — envoi direct selon le type de compte ──────────
function ObtainButton({ doc, legalForm }: { doc: WalletDocConfig; legalForm: string | null }) {
  const o = doc.obtenir

  const hasLink = o.lien || o.lien_societe || o.lien_artisan || o.lien_independant || o.lien_autoentrepreneur
  if (!hasLink) return null

  const resolvedLink = resolveObtainLink(o, legalForm)
  if (!resolvedLink) return null

  return (
    <a
      href={resolvedLink}
      target="_blank"
      rel="noreferrer"
      className="v22-btn v22-btn-sm"
      style={{ fontSize: 11, color: 'var(--v22-blue, #3B82F6)', border: '1px solid var(--v22-blue, #3B82F6)', background: 'transparent', textDecoration: 'none', whiteSpace: 'nowrap' }}
      title={o.note}
    >
      Obtenir ↗
    </a>
  )
}

// ── Ligne document ───────────────────────────────────────────
interface DocumentRowProps {
  docDef: WalletDocConfig
  doc: WalletDoc | undefined
  status: 'missing' | 'valid' | 'expiring' | 'expired'
  isLast: boolean
  uploading: boolean
  editExpiry: boolean
  dateLocale: string
  onUploadClick: () => void
  onEditExpiry: () => void
  onSetExpiry: (date: string) => void
  onCancelExpiry: () => void
  onView: () => void
  onRemove: () => void
  fileInputRef: (el: HTMLInputElement | null) => void
  onFileChange: (f: File) => void
  t: (key: string) => string
  scanResult?: any
  scanning?: boolean
  legalForm?: string | null
}

function DocumentRow({
  docDef, doc, status, isLast, uploading, editExpiry, dateLocale,
  onUploadClick, onEditExpiry, onSetExpiry, onCancelExpiry, onView, onRemove,
  fileInputRef, onFileChange, t, scanResult, scanning, legalForm,
}: DocumentRowProps) {
  const statusTagClass = {
    missing: 'v22-tag v22-tag-gray',
    valid: 'v22-tag v22-tag-green',
    expiring: 'v22-tag v22-tag-amber',
    expired: 'v22-tag v22-tag-red',
  }[status]

  const statusLabel = {
    missing: t('proDash.wallet.manquant'),
    valid: t('proDash.wallet.valide'),
    expiring: t('proDash.wallet.expireBientot'),
    expired: t('proDash.wallet.expire'),
  }[status]

  return (
    <div style={{
      padding: '12px 14px',
      borderBottom: isLast ? 'none' : '1px solid var(--v22-border)',
    }}>
      {/* Ligne principale */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Icône */}
        <span style={{ fontSize: 18, flexShrink: 0 }}>{docDef.icon || '📄'}</span>

        {/* Nom + badges */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, color: 'var(--v22-text)', fontSize: 13 }}>{docDef.nom}</span>
            {docDef.obligatoire && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: '#FEE2E2', color: '#DC2626', letterSpacing: 0.3 }}>
                OBLIGATOIRE
              </span>
            )}
            {!docDef.obligatoire && docDef.recommande && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: '#FEF3C7', color: '#D97706', letterSpacing: 0.3 }}>
                RECOMMANDÉ
              </span>
            )}
          </div>

          {/* Description */}
          <div style={{ fontSize: 11, color: 'var(--v22-text-muted)', marginTop: 2 }}>{docDef.description}</div>

          {/* Condition + validité */}
          {docDef.condition ? (
            <div style={{ fontSize: 11, color: '#D97706', marginTop: 2 }}>
              ⚠ {docDef.condition} — validité : {docDef.validite}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--v22-text-muted)', marginTop: 2 }}>
              Validité : {docDef.validite}
            </div>
          )}

          {/* Date d'expiration si définie */}
          {doc?.expiryDate && (
            <div className="v22-mono" style={{ fontSize: 11, color: 'var(--v22-text-muted)', marginTop: 2 }}>
              {t('proDash.wallet.expireLe')} {new Date(doc.expiryDate).toLocaleDateString(dateLocale)}
            </div>
          )}

          {/* Scan en cours */}
          {scanning && (
            <div style={{ fontSize: 11, color: '#3B82F6', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>🔍</span>
              Vérification du document en cours...
            </div>
          )}

          {/* Résultat scan anti-fraude */}
          {scanResult && !scanning && (
            <div style={{ marginTop: 4, padding: '6px 8px', borderRadius: 6, fontSize: 11, lineHeight: 1.4,
              background: scanResult.antiFraud.suspicious ? '#FEF2F2' : '#F0FDF4',
              border: `1px solid ${scanResult.antiFraud.suspicious ? '#FECACA' : '#BBF7D0'}`,
            }}>
              {scanResult.antiFraud.suspicious ? (
                <>
                  <div style={{ fontWeight: 700, color: '#DC2626', marginBottom: 2 }}>⚠️ Document suspect</div>
                  {scanResult.antiFraud.reasons.map((r: string, i: number) => (
                    <div key={i} style={{ color: '#991B1B' }}>• {r}</div>
                  ))}
                </>
              ) : (
                <>
                  <div style={{ fontWeight: 700, color: '#16A34A', marginBottom: 2 }}>✅ Document vérifié</div>
                  {scanResult.antiFraud.nameMatch && (
                    <div style={{ color: '#166534' }}>• Nom correspondant : {scanResult.antiFraud.nameOnDoc}</div>
                  )}
                  {scanResult.extractedData?.insurerName && (
                    <div style={{ color: '#166534' }}>• Assureur : {scanResult.extractedData.insurerName}</div>
                  )}
                  {scanResult.extractedData?.contractNumber && (
                    <div style={{ color: '#166534' }}>• Contrat n° {scanResult.extractedData.contractNumber}</div>
                  )}
                  {scanResult.extractedData?.validTo && (
                    <div style={{ color: '#166534' }}>• Valide jusqu&apos;au {new Date(scanResult.extractedData.validTo).toLocaleDateString(dateLocale)}</div>
                  )}
                  {scanResult.antiFraud.siretMatch === true && (
                    <div style={{ color: '#166534' }}>• SIRET vérifié ✓</div>
                  )}
                </>
              )}
              <div style={{ fontSize: 10, color: 'var(--v22-text-muted)', marginTop: 2 }}>
                Type détecté : {scanResult.docType} — confiance : {Math.round(scanResult.confidence * 100)}%
              </div>
            </div>
          )}
        </div>

        {/* Statut */}
        <span className={statusTagClass}>{statusLabel}</span>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
          {doc?.url && (
            <>
              <button onClick={onView} className="v22-btn v22-btn-sm" title="Voir">👁️</button>
              <button onClick={onRemove} className="v22-btn v22-btn-sm" title="Supprimer">🗑️</button>
            </>
          )}

          {/* Upload */}
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            style={{ display: 'none' }}
            ref={fileInputRef}
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) onFileChange(f)
              e.target.value = ''
            }}
          />
          <button
            onClick={onUploadClick}
            disabled={uploading}
            className="v22-btn v22-btn-primary v22-btn-sm"
            style={{ opacity: uploading ? 0.5 : 1 }}
          >
            {uploading ? '⏳' : doc?.url ? '🔄' : '📎'}
          </button>

          {/* Date d'expiration */}
          {editExpiry ? (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input
                type="date"
                className="v22-form-input"
                style={{ padding: '3px 6px', fontSize: 11, width: 130 }}
                defaultValue={doc?.expiryDate || ''}
                onBlur={e => onSetExpiry(e.target.value)}
                autoFocus
              />
              <button onClick={onCancelExpiry} className="v22-btn v22-btn-sm">✕</button>
            </div>
          ) : (
            <button
              onClick={onEditExpiry}
              className="v22-btn v22-btn-sm"
              title={doc?.expiryDate ? t('proDash.wallet.echeance') : t('proDash.wallet.ajouterEcheance')}
            >
              📅
            </button>
          )}

          {/* Bouton Obtenir */}
          <ObtainButton doc={docDef} legalForm={legalForm || null} />
        </div>
      </div>
    </div>
  )
}

// ── Composant principal ──────────────────────────────────────
export default function WalletConformiteSection({ artisan, orgRole = 'artisan' }: { artisan: any; orgRole?: OrgRole }) {
  const isSociete = orgRole === 'pro_societe'
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const storageKey = `fixit_wallet_${artisan?.id}`

  // Docs dynamiques selon le/les métier(s) de l'artisan — tri intelligent par corps de métier
  // artisan.categories est un tableau de slugs ex: ['espaces-verts', 'nettoyage']
  const { docs: baseDocs, metierLabel, fallback } = getWalletDocuments(artisan?.categories ?? artisan?.category)

  // Pour pro_societe : ajouter les docs société extra non déjà présents (Statuts + Attestation fiscale)
  const WALLET_DOCS = isSociete
    ? [...baseDocs, ...DOCS_SOCIETE_EXTRA.filter(extra => !baseDocs.some(d => d.id === extra.id))]
    : baseDocs

  const [docs, setDocs] = useState<Record<string, WalletDoc>>(() => {
    if (typeof window === 'undefined') return {}
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey) || '{}')
      // Migration des anciens IDs (avant refacto dynamique)
      const LEGACY_MAP: Record<string, string> = {
        assurance_decennale: 'decennale',
        carte_pro_btp: 'carte_btp',
        passeport_prevention: 'carte_btp', // fusionné dans carte BTP
      }
      const migrated = { ...raw }
      for (const [oldKey, newKey] of Object.entries(LEGACY_MAP)) {
        if (migrated[oldKey] && !migrated[newKey]) {
          migrated[newKey] = migrated[oldKey]
          delete migrated[oldKey]
        }
      }
      return migrated
    } catch { return {} }
  })
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const [editExpiry, setEditExpiry] = useState<string | null>(null)
  const [sendEmail, setSendEmail] = useState('')
  const [showUploadModal, setShowUploadModal] = useState<string | null>(null)
  const [scanResults, setScanResults] = useState<Record<string, any>>({})
  const [scanning, setScanning] = useState<Record<string, boolean>>({})
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
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ docKey, hasDocument, expiryDate: expiryDate || null }),
      })
    } catch { /* best-effort */ }
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
        const updated = { ...docs, [docKey]: { ...docs[docKey], url: data.url, uploadedAt: new Date().toISOString(), name: file.name } }
        saveToStorage(updated)
        syncToSyndic(docKey, true, docs[docKey]?.expiryDate)

        // ── Scan anti-fraude en arrière-plan (PDF uniquement) ──
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          setScanning(prev => ({ ...prev, [docKey]: true }))
          try {
            const reader = new FileReader()
            const base64 = await new Promise<string>((resolve) => {
              reader.onload = () => {
                const result = reader.result as string
                resolve(result.split(',')[1] || result) // Retirer le prefix data:...
              }
              reader.readAsDataURL(file)
            })
            const scanRes = await fetch('/api/wallet-scan', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
              },
              body: JSON.stringify({ fileBase64: base64, fileName: file.name, docKey, artisanId: artisan.id }),
            })
            const scanData = await scanRes.json()
            if (scanData.scan) {
              setScanResults(prev => ({ ...prev, [docKey]: scanData.scan }))
              // Auto-fill date d'expiration si détectée
              if (scanData.scan.extractedData?.validTo && !docs[docKey]?.expiryDate) {
                const updatedWithExpiry = { ...updated, [docKey]: { ...updated[docKey], expiryDate: scanData.scan.extractedData.validTo } }
                saveToStorage(updatedWithExpiry)
                syncToSyndic(docKey, true, scanData.scan.extractedData.validTo)
              }
            }
          } catch (scanErr) {
            console.error('Scan anti-fraude error:', scanErr)
          } finally {
            setScanning(prev => ({ ...prev, [docKey]: false }))
          }
        }
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
    const diff = (new Date(doc.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    if (diff < 0) return 'expired'
    if (diff < 60) return 'expiring'
    return 'valid'
  }

  // Compteurs
  const obligatoryDocs = WALLET_DOCS.filter(d => d.obligatoire)
  const validCount = WALLET_DOCS.filter(d => getStatus(docs[d.id]) === 'valid').length
  const expiringCount = WALLET_DOCS.filter(d => getStatus(docs[d.id]) === 'expiring').length
  const expiredCount = WALLET_DOCS.filter(d => getStatus(docs[d.id]) === 'expired').length
  const missingCount = WALLET_DOCS.filter(d => getStatus(docs[d.id]) === 'missing').length
  const actionsRequired = expiringCount + expiredCount + missingCount
  const pct = Math.round((validCount / WALLET_DOCS.length) * 100)
  const obligatoryMissing = obligatoryDocs.filter(d => getStatus(docs[d.id]) !== 'valid' && getStatus(docs[d.id]) !== 'expiring').length

  const handleSendDossier = () => {
    const lines = WALLET_DOCS.filter(d => docs[d.id]?.url).map(d => `${d.nom} : ${docs[d.id].url}`).join('\n')
    const subject = encodeURIComponent(`${t('proDash.wallet.dossierConformiteSubject')} — ${artisan?.company_name || 'Artisan'}`)
    const greeting = locale === 'pt' ? 'Olá' : 'Bonjour'
    const closing = locale === 'pt' ? 'Com os melhores cumprimentos' : 'Cordialement'
    const body = encodeURIComponent(`${greeting},\n\n${t('proDash.wallet.dossierConformiteBody')} ${artisan?.company_name || ''} :\n\n${lines}\n\n${closing},\n${artisan?.company_name || ''}${artisan?.phone ? '\n' + artisan.phone : ''}`)
    window.open(`mailto:${encodeURIComponent(sendEmail || '')}?subject=${subject}&body=${body}`)
  }

  return (
    <div style={{ padding: '16px', maxWidth: '960px', margin: '0 auto' }}>
      {/* Header */}
      <div className="v22-page-header">
        <div>
          <div className="v22-page-title">
            {isSociete ? '🏢 Conformité Entreprise' : `🗂️ ${t('proDash.wallet.title')}`}
          </div>
          <div className="v22-page-sub">
            {metierLabel
              ? `${metierLabel} — ${actionsRequired > 0 ? `${actionsRequired} action${actionsRequired > 1 ? 's' : ''} requise${actionsRequired > 1 ? 's' : ''}` : t('proDash.wallet.subtitle')}`
              : actionsRequired > 0 ? `${actionsRequired} actions requises` : t('proDash.wallet.subtitle')
            }
            {isSociete && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--v22-text-muted)' }}>· Kbis, RC Pro, Décennale + documents métier + Statuts + Attestation fiscale</span>}
          </div>
        </div>
        <button className="v22-btn v22-btn-primary v22-btn-sm" onClick={() => setShowUploadModal('_pick')}>
          + {t('proDash.wallet.ajouter')}
        </button>
      </div>

      {/* Message fallback si métier inconnu */}
      {fallback && (
        <div className="v22-alert v22-alert-amber" style={{ marginBottom: 12 }}>
          <span>⚠️</span>
          <span style={{ fontSize: 12 }}>
            Complétez votre profil pour voir les documents requis pour votre métier.
            Les 3 documents communs sont affichés par défaut.
          </span>
        </div>
      )}

      {/* Barre de progression */}
      <div className="v22-card" style={{ marginBottom: 16 }}>
        <div className="v22-card-body">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 700 }}>{pct}%</span>
            <span className="v22-mono" style={{ fontSize: 11, color: 'var(--v22-text-muted)' }}>
              {validCount}/{WALLET_DOCS.length} documents
              {obligatoryMissing > 0 && (
                <span style={{ color: '#DC2626', marginLeft: 8 }}>· {obligatoryMissing} obligatoire{obligatoryMissing > 1 ? 's' : ''} manquant{obligatoryMissing > 1 ? 's' : ''}</span>
              )}
            </span>
          </div>
          <div className="v22-prog-bar">
            <div className="v22-prog-fill" style={{ width: `${pct}%`, background: validCount === WALLET_DOCS.length ? 'var(--v22-green)' : undefined }} />
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 11 }}>
            <span><span className="v22-tag v22-tag-green">{validCount}</span> {t('proDash.wallet.valide')}</span>
            <span><span className="v22-tag v22-tag-amber">{expiringCount}</span> {t('proDash.wallet.expireBientot')}</span>
            <span><span className="v22-tag v22-tag-red">{expiredCount}</span> {t('proDash.wallet.expire')}</span>
            <span><span className="v22-tag v22-tag-gray">{missingCount}</span> {t('proDash.wallet.manquant')}</span>
          </div>
        </div>
      </div>

      {/* Liste documents */}
      <div className="v22-card" style={{ marginBottom: 16 }}>
        <div className="v22-card-head">
          <span className="v22-card-title">Documents{metierLabel ? ` — ${metierLabel}` : ''}</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="v22-card-meta">{obligatoryDocs.length} requis</span>
            {WALLET_DOCS.filter(d => !d.obligatoire && d.recommande).length > 0 && (
              <span className="v22-card-meta" style={{ color: '#D97706' }}>
                + {WALLET_DOCS.filter(d => !d.obligatoire && d.recommande).length} recommandés
              </span>
            )}
          </div>
        </div>
        <div className="v22-card-body" style={{ padding: 0 }}>
          {WALLET_DOCS.map((docDef, i) => (
            <DocumentRow
              key={docDef.id}
              docDef={docDef}
              doc={docs[docDef.id]}
              status={getStatus(docs[docDef.id])}
              isLast={i === WALLET_DOCS.length - 1}
              uploading={!!uploading[docDef.id]}
              editExpiry={editExpiry === docDef.id}
              dateLocale={dateLocale}
              onUploadClick={() => fileInputRefs.current[docDef.id]?.click()}
              onEditExpiry={() => setEditExpiry(docDef.id)}
              onSetExpiry={(date) => setExpiry(docDef.id, date)}
              onCancelExpiry={() => setEditExpiry(null)}
              onView={() => window.open(docs[docDef.id]?.url, '_blank')}
              onRemove={() => removeDoc(docDef.id)}
              fileInputRef={el => { fileInputRefs.current[docDef.id] = el }}
              onFileChange={(f) => handleUpload(docDef.id, f)}
              t={t}
              scanResult={scanResults[docDef.id]}
              scanning={!!scanning[docDef.id]}
              legalForm={(artisan?.legal_form as string) || null}
            />
          ))}
        </div>
      </div>

      {/* Envoyer le dossier */}
      <div className="v22-card">
        <div className="v22-card-head">
          <span className="v22-card-title">📤 {t('proDash.wallet.envoyerDossier')}</span>
        </div>
        <div className="v22-card-body">
          <div style={{ fontSize: 12, color: 'var(--v22-text-muted)', marginBottom: 10 }}>{t('proDash.wallet.envoyerDossierDesc')}</div>
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
              disabled={WALLET_DOCS.filter(d => docs[d.id]?.url).length === 0}
              className="v22-btn v22-btn-primary"
              style={{ opacity: WALLET_DOCS.filter(d => docs[d.id]?.url).length === 0 ? 0.5 : 1, whiteSpace: 'nowrap' }}
            >
              📧 {t('proDash.wallet.envoyerLeDossier')}
            </button>
          </div>
          {WALLET_DOCS.filter(d => docs[d.id]?.url).length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--v22-text-muted)', marginTop: 6 }}>⚠️ {t('proDash.wallet.uploadAuMoinsUn')}</div>
          )}
        </div>
      </div>

      {/* Modal sélection document */}
      {showUploadModal === '_pick' && (
        <div className="v22-modal-overlay" onClick={() => setShowUploadModal(null)}>
          <div className="v22-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="v22-modal-head">
              <span className="v22-card-title">+ {t('proDash.wallet.ajouter')}</span>
              <button className="v22-modal-close" onClick={() => setShowUploadModal(null)}>✕</button>
            </div>
            <div className="v22-modal-body" style={{ padding: 0 }}>
              {WALLET_DOCS.map((docDef, i) => {
                const status = getStatus(docs[docDef.id])
                const statusTagClass = { missing: 'v22-tag v22-tag-gray', valid: 'v22-tag v22-tag-green', expiring: 'v22-tag v22-tag-amber', expired: 'v22-tag v22-tag-red' }[status]
                const statusLabel = { missing: t('proDash.wallet.manquant'), valid: t('proDash.wallet.valide'), expiring: t('proDash.wallet.expireBientot'), expired: t('proDash.wallet.expire') }[status]
                return (
                  <button
                    key={docDef.id}
                    onClick={() => { setShowUploadModal(null); fileInputRefs.current[docDef.id]?.click() }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      padding: '10px 16px', border: 'none',
                      borderBottom: i < WALLET_DOCS.length - 1 ? '1px solid var(--v22-border)' : 'none',
                      background: 'transparent', cursor: 'pointer', textAlign: 'left', fontSize: 13,
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{docDef.icon || '📄'}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 500, color: 'var(--v22-text)' }}>{docDef.nom}</span>
                      {docDef.obligatoire && <span style={{ marginLeft: 6, fontSize: 10, color: '#DC2626', fontWeight: 700 }}>OBLIGATOIRE</span>}
                    </span>
                    <span className={statusTagClass}>{statusLabel}</span>
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
