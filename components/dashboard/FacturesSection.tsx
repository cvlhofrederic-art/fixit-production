'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import DevisFactureForm from '@/components/DevisFactureForm'
import DevisFactureFormBTP from '@/components/DevisFactureFormBTP'
import DocumentCancelModal from '@/components/DocumentCancelModal'
import ConfirmDraftDeleteDialog from '@/components/ConfirmDraftDeleteDialog'
import { Artisan, Service, Booking } from '@/lib/types'
import { DevisFactureData } from '@/lib/devis-types'
import { downloadSavedDevis } from '@/lib/pdf/download-saved-devis'
import { computeDocumentTotalHT } from '@/lib/devis-totals'
import { computeTva, type TvaRegime } from '@/lib/tva-calculator'
import { useThemeVars, ThemeVars } from './useThemeVars'
import { useDocumentCancel, isDocDraftStatus } from './useDocumentCancel'
import { useOrgRoleContext, type OrgRole } from '@/lib/hooks/useOrgRoleContext'

// A persisted document extends DevisFactureData with storage metadata
interface PersistedDocument extends Omit<Partial<DevisFactureData>, 'docType' | 'lines'> {
  docType: 'devis' | 'facture' | 'avoir'
  docNumber: string
  savedAt?: string
  status?: string
  sentAt?: string
  clientName?: string
  clientEmail?: string
  docDate?: string
  paymentDue?: string
  lines?: Array<{ totalHT?: number; [key: string]: unknown }>
}

interface FacturesSectionProps {
  artisan: Artisan
  services: Service[]
  bookings: Booking[]
  savedDocuments: PersistedDocument[]
  setSavedDocuments: (docs: PersistedDocument[]) => void
  showFactureForm: boolean
  setShowFactureForm: (v: boolean) => void
  convertingDevis: PersistedDocument | null
  setConvertingDevis: (v: PersistedDocument | null) => void
  /** Callback unifié : openFactureForm() = nouvelle, openFactureForm(doc) = édition. */
  openFactureForm: (doc?: PersistedDocument | null) => void
}

export default function FacturesSection({
  artisan, services, bookings, savedDocuments, setSavedDocuments,
  showFactureForm, setShowFactureForm, convertingDevis, setConvertingDevis, openFactureForm,
}: FacturesSectionProps) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const { orgRole, isV5, useBtpDesign } = useOrgRoleContext()
  const tv = useThemeVars(isV5)

  const refreshDocuments = () => {
    const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
    const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
    setSavedDocuments([...docs, ...drafts])
  }

  const [pendingDraftDelete, setPendingDraftDelete] = useState<PersistedDocument | null>(null)

  const { cancellingDoc, setCancellingDoc, handleRemoveDoc: _handleRemoveDocRaw, handleCancelled } =
    useDocumentCancel<PersistedDocument>({
      artisanId: artisan?.id,
      docType: 'facture',
      setSavedDocuments,
      // Pré-validé : le modal stylé en amont fait office de confirm() humain.
      confirmDraftDelete: () => true,
    })

  // Wrapper : pour les brouillons on ouvre un modal stylé (vs `confirm()` natif
  // moche). Pour les docs émis, le hook gère déjà son propre DocumentCancelModal.
  const handleRemoveDoc = (doc: PersistedDocument) => {
    if (isDocDraftStatus(doc.status, 'facture')) {
      setPendingDraftDelete(doc)
      return
    }
    _handleRemoveDocRaw(doc)
  }

  const confirmPendingDraftDelete = () => {
    if (!pendingDraftDelete) return
    _handleRemoveDocRaw(pendingDraftDelete)
    setPendingDraftDelete(null)
  }

  if (showFactureForm) {
    // Garde docType : si convertingDevis arrive avec docType='devis' (bug
    // d'aiguillage entre Devis et Facture), on l'ignore en initialData pour
    // éviter un crash d'init dans DevisFactureFormBTP (cf. plan magical-
    // mapping-karp Phase 3). Le form ouvre alors un brouillon facture vierge.
    const safeInitial =
      convertingDevis && (convertingDevis as { docType?: string }).docType === 'facture'
        ? convertingDevis
        : null
    if (orgRole === 'pro_societe') {
      return (
        <DevisFactureFormBTP artisan={artisan as any} services={services as any} bookings={bookings as any} initialDocType="facture"
          initialData={safeInitial as any}
          onBack={() => { setShowFactureForm(false); setConvertingDevis(null); refreshDocuments() }}
          onSave={() => { setConvertingDevis(null); refreshDocuments() }}
        />
      )
    }
    return (
      <DevisFactureForm artisan={artisan} services={services} bookings={bookings} initialDocType="facture"
        initialData={safeInitial as Partial<DevisFactureData> | undefined}
        onBack={() => { setShowFactureForm(false); setConvertingDevis(null); refreshDocuments() }}
        onSave={() => { setConvertingDevis(null); refreshDocuments() }}
      />
    )
  }

  // Filtre les factures annulées de la liste active (statut 'cancelled' DB EN
   // ou 'annule' localStorage FR). Le record reste en DB pour audit légal
   // (art. L123-22 C. com., conservation 10 ans) mais disparaît du flux actif.
  const factureDocs = savedDocuments.filter(d =>
    d.docType === 'facture' && d.status !== 'cancelled' && d.status !== 'annule'
  )

  const getStatusTag = (doc: PersistedDocument, isOverdue: boolean) => {
    if (isOverdue && doc.status !== 'envoye') return { cls: 'v22-tag v22-tag-red', label: t('proDash.factures.echue') }
    if (doc.status === 'envoye') return { cls: 'v22-tag v22-tag-green', label: t('proDash.factures.envoyee') }
    return { cls: 'v22-tag v22-tag-amber', label: t('proDash.factures.nonEnvoyee') }
  }

  /* ═══════════════════════════════════════════
     V5 layout — pro_societe only
     ═══════════════════════════════════════════ */
  if (isV5) {
    return (
      <>
        <FacturesSectionV5
          factureDocs={factureDocs}
          setShowFactureForm={setShowFactureForm}
          setConvertingDevis={setConvertingDevis}
          openFactureForm={openFactureForm}
          artisan={artisan}
          setSavedDocuments={setSavedDocuments}
          dateLocale={dateLocale}
          locale={locale}
          t={t}
          tv={tv}
          orgRole={orgRole}
          onRemoveDoc={handleRemoveDoc}
        />
        {cancellingDoc && (
          <DocumentCancelModal
            open={!!cancellingDoc}
            docType="facture"
            docNumber={cancellingDoc.docNumber}
            onCancelled={handleCancelled}
            onClose={() => setCancellingDoc(null)}
          />
        )}
        <ConfirmDraftDeleteDialog
          open={!!pendingDraftDelete}
          docType="facture"
          label={
            pendingDraftDelete?.docNumber ||
            pendingDraftDelete?.clientName ||
            (locale === 'pt' ? 'este rascunho' : 'ce brouillon')
          }
          onConfirm={confirmPendingDraftDelete}
          onClose={() => setPendingDraftDelete(null)}
        />
      </>
    )
  }

  /* ═══════════════════════════════════════════
     V22 layout — artisan and other roles
     ═══════════════════════════════════════════ */
  return (
    <div className="animate-fadeIn">
      {/* V22 Page header */}
      <div className="v22-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="v22-page-title">{t('proDash.factures.title')}</div>
          <div className="v22-page-sub">{t('proDash.factures.subtitle')}</div>
        </div>
        <button className="v22-btn v22-btn-primary" onClick={() => openFactureForm()}>
          + {t('proDash.factures.nouvelleFacture')}
        </button>
      </div>

      {/* V22 Stats row */}
      {factureDocs.length > 0 && (
        <div className="v22-stats">
          <div className="v22-stat">
            <div className="v22-stat-label">{t('proDash.factures.totalFactures')}</div>
            <div className="v22-stat-val">{factureDocs.length}</div>
          </div>
          <div className="v22-stat">
            <div className="v22-stat-label">{t('proDash.factures.caHTTotal')}</div>
            <div className="v22-stat-val">
              {factureDocs.reduce((s, d) => s + computeDocumentTotalHT(d), 0).toFixed(2)} €
            </div>
          </div>
          <div className="v22-stat">
            <div className="v22-stat-label">{t('proDash.factures.envoyees')}</div>
            <div className="v22-stat-val">{factureDocs.filter(d => d.status === 'envoye').length}</div>
          </div>
        </div>
      )}

      {/* V22 Card with table */}
      <div style={{ padding: '14px' }}>
        {factureDocs.length > 0 ? (
          <div className="v22-card">
            <div className="v22-card-head">
              <div className="v22-card-title">{t('proDash.factures.title')}</div>
              <div className="v22-card-meta">{factureDocs.length} document{factureDocs.length > 1 ? 's' : ''}</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>{t('proDash.factures.colRef')}</th>
                  <th>{t('proDash.factures.colClient')}</th>
                  <th style={{ textAlign: 'right' }}>{t('proDash.factures.colMontantHT')}</th>
                  <th>{t('proDash.factures.colEmiseLe')}</th>
                  <th>{t('proDash.factures.colEcheance')}</th>
                  <th>{t('proDash.factures.colStatut')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {factureDocs.sort((a, b) => new Date(b.savedAt || b.docDate || '').getTime() - new Date(a.savedAt || a.docDate || '').getTime()).map((doc, i) => {
                  const totalHT = computeDocumentTotalHT(doc)
                  const isOverdue = !!(doc.paymentDue && new Date(doc.paymentDue) < new Date())
                  const status = getStatusTag(doc, isOverdue)
                  return (
                    <tr key={`saved-fact-${i}`} onClick={() => { setConvertingDevis(doc); setShowFactureForm(true) }}>
                      <td><span className="v22-ref">{doc.docNumber}</span></td>
                      <td><span className="v22-client-name">{doc.clientName || t('proDash.factures.clientNonRenseigne')}</span></td>
                      <td><span className="v22-amount">{totalHT.toFixed(2)} €</span></td>
                      <td><span className="v22-mono" style={{ fontSize: 12 }}>{doc.docDate ? new Date(doc.docDate).toLocaleDateString(dateLocale) : '-'}</span></td>
                      <td><span className="v22-mono" style={{ fontSize: 12 }}>{doc.paymentDue ? new Date(doc.paymentDue).toLocaleDateString(dateLocale) : '-'}</span></td>
                      <td><span className={status.cls}>{status.label}</span></td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          {doc.status !== 'envoye' && (
                            <button className="v22-btn v22-btn-sm" onClick={(e) => {
                              e.stopPropagation()
                              const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
                              const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
                              const now = new Date().toISOString()
                              const updDocs = (docs as PersistedDocument[]).map(d => d.docNumber === doc.docNumber ? { ...d, status: 'envoye', sentAt: now } : d)
                              const updDrafts = (drafts as PersistedDocument[]).map(d => d.docNumber === doc.docNumber ? { ...d, status: 'envoye', sentAt: now } : d)
                              localStorage.setItem(`fixit_documents_${artisan?.id}`, JSON.stringify(updDocs))
                              localStorage.setItem(`fixit_drafts_${artisan?.id}`, JSON.stringify(updDrafts))
                              setSavedDocuments([...updDocs, ...updDrafts])
                            }}>
                              {t('proDash.factures.marquerEnvoyee')}
                            </button>
                          )}
                          <button className="v22-btn v22-btn-sm" title={t('proDash.factures.telechargerPDF')} onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              await downloadSavedDevis(doc as Parameters<typeof downloadSavedDevis>[0], {
                                locale: locale as 'fr' | 'pt' | 'en',
                                t,
                                artisan: artisan ? {
                                  id: artisan.id,
                                  company_name: artisan.company_name,
                                  logo_url: (artisan as { logo_url?: string | null }).logo_url ?? null,
                                  rm: (artisan as { rm?: string | null }).rm ?? null,
                                  rc_pro: (artisan as { rc_pro?: string | null }).rc_pro ?? null,
                                } : null,
                                useBtpDesign: false,
                              })
                            } catch (err) {
                              console.error('[Facture] download failed', err)
                              toast.error(t('proDash.factures.erreurPDF'))
                            }
                          }}>
                            {'⬇️'}
                          </button>
                          {doc.clientEmail && (
                            <button className="v22-btn v22-btn-sm" onClick={(e) => {
                              e.stopPropagation()
                              const subject = encodeURIComponent(`${t('proDash.factures.title')} ${doc.docNumber} — ${artisan?.company_name || 'Fixit'}`)
                              const body = encodeURIComponent(`${t('proDash.factures.emailSalutation')} ${doc.clientName || ''},\n\n${t('proDash.factures.emailCorps').replace('{docNumber}', doc.docNumber).replace('{montant}', totalHT.toFixed(2))}\n\n${t('proDash.factures.emailFormule')},\n${artisan?.company_name || ''}${artisan?.phone ? '\n' + artisan.phone : ''}`)
                              window.open(`mailto:${doc.clientEmail}?subject=${subject}&body=${body}`)
                              const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
                              const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
                              const now = new Date().toISOString()
                              const updDocs = (docs as PersistedDocument[]).map(d => d.docNumber === doc.docNumber ? { ...d, status: 'envoye', sentAt: now } : d)
                              const updDrafts = (drafts as PersistedDocument[]).map(d => d.docNumber === doc.docNumber ? { ...d, status: 'envoye', sentAt: now } : d)
                              localStorage.setItem(`fixit_documents_${artisan?.id}`, JSON.stringify(updDocs))
                              localStorage.setItem(`fixit_drafts_${artisan?.id}`, JSON.stringify(updDrafts))
                              setSavedDocuments([...updDocs, ...updDrafts])
                            }}>
                              {t('proDash.factures.envoyerEmail')}
                            </button>
                          )}
                          <button className="v22-btn v22-btn-sm" style={{ color: tv.red }} onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveDoc(doc)
                          }}>
                            {isDocDraftStatus(doc.status, 'facture')
                              ? t('proDash.factures.supprimer')
                              : (locale === 'pt' ? 'Anular' : 'Annuler')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="v22-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>{'🧾'}</div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4, color: tv.text }}>{t('proDash.factures.aucuneFacture')}</div>
            <div style={{ fontSize: 12, color: tv.textMuted, marginBottom: 20 }}>{t('proDash.factures.creerPremiereFacture')}</div>
            <button className="v22-btn v22-btn-primary" onClick={() => openFactureForm()}>
              {t('proDash.factures.creerFacture')}
            </button>
          </div>
        )}
      </div>
      {cancellingDoc && (
        <DocumentCancelModal
          open={!!cancellingDoc}
          docType="facture"
          docNumber={cancellingDoc.docNumber}
          onCancelled={handleCancelled}
          onClose={() => setCancellingDoc(null)}
        />
      )}
      <ConfirmDraftDeleteDialog
        open={!!pendingDraftDelete}
        docType="facture"
        label={
          pendingDraftDelete?.docNumber ||
          pendingDraftDelete?.clientName ||
          (locale === 'pt' ? 'este rascunho' : 'ce brouillon')
        }
        onConfirm={confirmPendingDraftDelete}
        onClose={() => setPendingDraftDelete(null)}
      />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   V5 sub-component — Factures for pro_societe
   ═══════════════════════════════════════════════════════ */
function FacturesSectionV5({
  factureDocs, setShowFactureForm, setConvertingDevis, openFactureForm,
  artisan, setSavedDocuments, dateLocale, locale, t, tv, orgRole,
  onRemoveDoc,
}: {
  factureDocs: PersistedDocument[]
  setShowFactureForm: (v: boolean) => void
  setConvertingDevis: (v: PersistedDocument | null) => void
  openFactureForm: (doc?: PersistedDocument | null) => void
  artisan: Artisan
  setSavedDocuments: (docs: PersistedDocument[]) => void
  dateLocale: string
  locale: string
  t: (k: string) => string
  tv: ThemeVars
  orgRole?: OrgRole
  onRemoveDoc: (doc: PersistedDocument) => void
}) {
  const { useBtpDesign } = useOrgRoleContext()
  const [search, setSearch] = useState('')

  const filtered = factureDocs
    .filter(d => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        d.docNumber?.toLowerCase().includes(q) ||
        d.clientName?.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => new Date(b.savedAt || b.docDate || '').getTime() - new Date(a.savedAt || a.docDate || '').getTime())

  const getV5Badge = (doc: PersistedDocument) => {
    // Accepte les statuts FR (localStorage) ET EN (DB Supabase).
    // Sans `pending`, les factures rechargées depuis la DB tombaient
    // toutes en « Brouillon » alors qu'elles étaient bien émises.
    const status = doc.status
    if (status === 'cancelled' || status === 'annule') {
      return { cls: 'v5-badge v5-badge-red', label: locale === 'pt' ? 'Anulada' : 'Annulée' }
    }
    if (status === 'envoye' || status === 'pending') {
      return { cls: 'v5-badge v5-badge-blue', label: t('proDash.factures.emise') }
    }
    if (status === 'payee' || status === 'paid') {
      return { cls: 'v5-badge v5-badge-green', label: t('proDash.factures.payee') }
    }
    return { cls: 'v5-badge v5-badge-yellow', label: t('proDash.factures.brouillon') }
  }

  // Determine facture type from factureSubType field, falling back to docNumber/title heuristic
  const guessType = (doc: PersistedDocument) => {
    // Read the persisted factureSubType first (set by DevisFactureFormBTP)
    const sub = (doc as unknown as Record<string, unknown>).factureSubType as string | undefined
    if (sub === 'acompte') return t('proDash.factures.typeAcompte')
    if (sub === 'situation') return t('proDash.factures.typeSituation')
    // Fallback: heuristic from docNumber / title
    const num = doc.docNumber?.toLowerCase() || ''
    const title = doc.docTitle?.toLowerCase() || ''
    if (num.includes('sit') || title.includes('situation')) return t('proDash.factures.typeSituation')
    if (num.includes('aco') || title.includes('acompte')) return t('proDash.factures.typeAcompte')
    if (num.includes('sol') || title.includes('solde')) return t('proDash.factures.typeSolde')
    return t('proDash.factures.title')
  }

  return (
    <div className="v5-fade">
      <div className="v5-pg-t"><h1>{t('proDash.factures.title')}</h1><p>{t('proDash.factures.subtitleV5')}</p></div>

      {/* Search + Create */}
      <div className="v5-search">
        <input
          className="v5-search-in"
          placeholder={t('proDash.factures.rechercher')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className="v5-btn v5-btn-p" onClick={() => openFactureForm()}>
          {t('proDash.factures.nouvelle')}
        </button>
      </div>

      {/* Table */}
      <div className="v5-card" style={{ overflowX: 'auto' }}>
        <table className="v5-dt">
          <thead>
            <tr>
              <th>{t('proDash.factures.colNum')}</th>
              <th>{t('proDash.factures.colClient')}</th>
              <th>{t('proDash.factures.colType')}</th>
              <th>{t('proDash.factures.colMontantTTC')}</th>
              <th>{t('proDash.factures.colStatut')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map((doc, i) => {
              const totalHT = computeDocumentTotalHT(doc)
              // Respecte les 3 régimes TVA (cf. lib/tva-calculator.ts) :
              //   - classique           : TTC = HT + TVA par taux
              //   - franchise_293b      : TTC = HT (pas de TVA, art. 293 B CGI)
              //   - autoliquidation_btp : TTC = HT (TVA due par le preneur, art. 283-2 nonies)
              // Fallback rétro-compat : si regimeTva absent, dérive depuis
              // autoliquidationBTP (legacy flag) ou tvaEnabled (franchise quand false).
              // filter(Boolean) protège contre les lignes null/undefined (localStorage
              // corrompu après flow Facturer interrompu, cf. plan Phase 3).
              const docRec = doc as {
                regimeTva?: TvaRegime
                regime_tva?: TvaRegime
                autoliquidationBTP?: boolean
                tvaEnabled?: boolean
              }
              const tvaEnabled = docRec.tvaEnabled !== false
              const effectiveRegime: TvaRegime =
                docRec.regimeTva
                ?? docRec.regime_tva
                ?? (docRec.autoliquidationBTP
                  ? 'autoliquidation_btp'
                  : (tvaEnabled ? 'classique' : 'franchise_293b'))
              const safeLines = Array.isArray(doc.lines) ? doc.lines.filter(Boolean) : []
              const tva = computeTva({
                regime: effectiveRegime,
                lines: safeLines
                  .filter((l): l is { totalHT?: number; tvaRate?: number } => l !== null && typeof l === 'object')
                  .map(l => ({
                    totalHT: (l.totalHT as number) || 0,
                    tvaRate: ((l as { tvaRate?: number }).tvaRate as number) ?? 20,
                  })),
              })
              let totalTTC = tva.totalTTC
              // For acompte invoices, display the acompte amount instead of the full total
              const docAny = doc as unknown as Record<string, unknown>
              if (docAny.factureSubType === 'acompte' && Array.isArray(docAny.acomptes) && (docAny.acomptes as Array<{ pourcentage?: number }>).length > 0) {
                const firstAcompte = (docAny.acomptes as Array<{ pourcentage?: number }>)[0]
                if (firstAcompte?.pourcentage && firstAcompte.pourcentage > 0 && firstAcompte.pourcentage < 100) {
                  totalTTC = totalTTC * firstAcompte.pourcentage / 100
                }
              }
              const badge = getV5Badge(doc)
              return (
                <tr key={`v5-fac-${i}`} style={{ cursor: 'pointer' }} onClick={() => { setConvertingDevis(doc); setShowFactureForm(true) }}>
                  <td style={{ fontWeight: 600 }}>{doc.docNumber}</td>
                  <td>{doc.clientName || t('proDash.factures.nonRenseigne')}</td>
                  <td>{guessType(doc)}</td>
                  <td>{totalTTC.toLocaleString(dateLocale, { maximumFractionDigits: 0 })} €</td>
                  <td><span className={badge.cls}>{badge.label}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      {doc.status !== 'envoye' && doc.status !== 'pending' && (
                        <button className="v5-btn v5-btn-sm" onClick={e => {
                          e.stopPropagation()
                          const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
                          const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
                          const now = new Date().toISOString()
                          const updDocs = (docs as PersistedDocument[]).map(d => d.docNumber === doc.docNumber ? { ...d, status: 'envoye', sentAt: now } : d)
                          const updDrafts = (drafts as PersistedDocument[]).map(d => d.docNumber === doc.docNumber ? { ...d, status: 'envoye', sentAt: now } : d)
                          localStorage.setItem(`fixit_documents_${artisan?.id}`, JSON.stringify(updDocs))
                          localStorage.setItem(`fixit_drafts_${artisan?.id}`, JSON.stringify(updDrafts))
                          setSavedDocuments([...updDocs, ...updDrafts])
                        }}>
                          {t('proDash.factures.marquerEnvoyee')}
                        </button>
                      )}
                      {doc.clientEmail && (
                        <button className="v5-btn v5-btn-sm" onClick={e => {
                          e.stopPropagation()
                          const subject = encodeURIComponent(`${t('proDash.factures.title')} ${doc.docNumber} — ${artisan?.company_name || 'Fixit'}`)
                          const body = encodeURIComponent(`${t('proDash.factures.emailSalutation')} ${doc.clientName || ''},\n\n${t('proDash.factures.emailCorps').replace('{docNumber}', doc.docNumber).replace('{montant}', totalHT.toFixed(2))}\n\n${t('proDash.factures.emailFormule')},\n${artisan?.company_name || ''}${artisan?.phone ? '\n' + artisan.phone : ''}`)
                          window.open(`mailto:${doc.clientEmail}?subject=${subject}&body=${body}`)
                          const allDocs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
                          const allDrafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
                          const now = new Date().toISOString()
                          const uDocs = (allDocs as PersistedDocument[]).map(d => d.docNumber === doc.docNumber ? { ...d, status: 'envoye', sentAt: now } : d)
                          const uDrafts = (allDrafts as PersistedDocument[]).map(d => d.docNumber === doc.docNumber ? { ...d, status: 'envoye', sentAt: now } : d)
                          localStorage.setItem(`fixit_documents_${artisan?.id}`, JSON.stringify(uDocs))
                          localStorage.setItem(`fixit_drafts_${artisan?.id}`, JSON.stringify(uDrafts))
                          setSavedDocuments([...uDocs, ...uDrafts])
                        }}>
                          {t('proDash.factures.envoyerEmail')}
                        </button>
                      )}
                      {(orgRole === 'artisan' || orgRole === 'pro_societe') && (
                        <button className="v5-btn v5-btn-sm" title={t('proDash.factures.telechargerPDF')} onClick={async e => {
                          e.stopPropagation()
                          try {
                            await downloadSavedDevis(doc as Parameters<typeof downloadSavedDevis>[0], {
                              locale: locale as 'fr' | 'pt' | 'en',
                              t,
                              artisan: artisan ? {
                                id: artisan.id,
                                company_name: artisan.company_name,
                                logo_url: (artisan as { logo_url?: string | null }).logo_url ?? null,
                                rm: (artisan as { rm?: string | null }).rm ?? null,
                                rc_pro: (artisan as { rc_pro?: string | null }).rc_pro ?? null,
                              } : null,
                              useBtpDesign,
                            })
                          } catch (err) {
                            console.error('[Facture] download failed', err)
                            toast.error(t('proDash.factures.erreurPDF'))
                          }
                        }}>
                          {t('proDash.factures.telecharger')}
                        </button>
                      )}
                      <button className="v5-btn v5-btn-sm v5-btn-d" onClick={e => {
                        e.stopPropagation()
                        onRemoveDoc(doc)
                      }}>
                        {isDocDraftStatus(doc.status, 'facture')
                          ? t('proDash.factures.supprimer')
                          : (locale === 'pt' ? 'Anular' : 'Annuler')}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            }) : (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: tv.textMid }}>
                  {search ? t('proDash.factures.aucuneRecherche') : t('proDash.factures.aucune')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
