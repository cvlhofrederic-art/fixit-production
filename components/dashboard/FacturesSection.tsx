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
import { getDocSeq } from '@/lib/devis-utils'
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
  setSavedDocuments: (docs: PersistedDocument[] | ((prev: PersistedDocument[]) => PersistedDocument[])) => void
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

  // FR-V1.2 — Merge localStorage dans le state existant (qui contient déjà
  // le merge DB+local depuis le mount du dashboard). NE PAS écraser avec
  // [...docs, ...drafts] seul, sinon les entrées DB-only disparaissent.
  // Incident Sud travaux 2026-05-26 : 10 factures DB perdues de l'UI.
  const refreshDocuments = () => {
    const localDocs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]') as PersistedDocument[]
    const localDrafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]') as PersistedDocument[]
    const localById = new Map<string, PersistedDocument>(
      [...localDocs, ...localDrafts].filter(d => d?.docNumber).map(d => [d.docNumber as string, d])
    )
    setSavedDocuments(prev => {
      const seen = new Set<string>()
      const updated = prev.map(d => {
        if (d.docNumber) seen.add(d.docNumber)
        return d.docNumber && localById.has(d.docNumber) ? localById.get(d.docNumber)! : d
      })
      // Append new localStorage entries not yet in state (= just-saved docs)
      for (const [num, d] of localById) {
        if (!seen.has(num)) updated.push(d)
      }
      return updated
    })
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
    // Le docType 'avoir' (méthode pro BTP 2026) passe par le même form en
    // mode facture — le PDF V3 lit factureSubType='avoir' pour le label.
    const inDocType = (convertingDevis as { docType?: string } | null)?.docType
    const safeInitial =
      convertingDevis && (inDocType === 'facture' || inDocType === 'avoir')
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
                {[...factureDocs].sort((a, b) => getDocSeq(b) - getDocSeq(a)).map((doc, i) => {
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
                              // FR-V1.2 — functional update preserves DB-only entries (cf. incident Sud travaux 2026-05-26)
                              setSavedDocuments(prev => prev.map(d => d.docNumber === doc.docNumber ? { ...d, status: 'envoye', sentAt: now } : d))
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
                              // FR-V1.2 — functional update preserves DB-only entries (cf. incident Sud travaux 2026-05-26)
                              setSavedDocuments(prev => prev.map(d => d.docNumber === doc.docNumber ? { ...d, status: 'envoye', sentAt: now } : d))
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
  setSavedDocuments: (docs: PersistedDocument[] | ((prev: PersistedDocument[]) => PersistedDocument[])) => void
  dateLocale: string
  locale: string
  t: (k: string) => string
  tv: ThemeVars
  orgRole?: OrgRole
  onRemoveDoc: (doc: PersistedDocument) => void
}) {
  const { useBtpDesign } = useOrgRoleContext()
  const [search, setSearch] = useState('')
  // Quick Actions « → Acompte » et « → Avoir » (méthode pro BTP 2026).
  // Cf. art. 289 CGI (acompte) + art. 272 CGI / BOI-TVA-DECLA-30-20-20-30 §70 (avoir).
  const [acompteParent, setAcompteParent] = useState<PersistedDocument | null>(null)
  const [avoirParent, setAvoirParent] = useState<PersistedDocument | null>(null)

  const filtered = factureDocs
    .filter(d => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        d.docNumber?.toLowerCase().includes(q) ||
        d.clientName?.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => getDocSeq(b) - getDocSeq(a))

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
    if (sub === 'avoir') return t('proDash.factures.typeAvoir')
    if (doc.docType === 'avoir') return t('proDash.factures.typeAvoir')
    // Fallback: heuristic from docNumber / title
    const num = doc.docNumber?.toLowerCase() || ''
    const title = doc.docTitle?.toLowerCase() || ''
    if (num.startsWith('av-') || title.startsWith('avoir')) return t('proDash.factures.typeAvoir')
    if (num.includes('sit') || title.includes('situation')) return t('proDash.factures.typeSituation')
    if (num.includes('aco') || title.includes('acompte')) return t('proDash.factures.typeAcompte')
    if (num.includes('sol') || title.includes('solde')) return t('proDash.factures.typeSolde')
    return t('proDash.factures.title')
  }

  // Quick Action helpers — méthode pro BTP 2026.
  const round2 = (n: number) => Math.round(n * 100) / 100
  const subTypeOf = (doc: PersistedDocument): string =>
    ((doc as unknown as Record<string, unknown>).factureSubType as string | undefined) || 'standard'
  // Compte les acomptes déjà émis pointant vers cette facture parente (pour
  // proposer le bon N° d'acompte par défaut dans la modale).
  const countAcomptesFor = (parentNumber: string): number =>
    factureDocs.filter(d =>
      subTypeOf(d) === 'acompte' &&
      ((d as unknown as Record<string, unknown>).parentInvoiceNumber as string | undefined) === parentNumber,
    ).length
  // Vérifie qu'un avoir n'a pas déjà été émis pour cette facture (1 seul avoir
  // par facture, sinon comptabilité ambiguë — cf. BOI-TVA-DECLA-30-20-20-30 §70).
  const hasAvoirFor = (parentNumber: string): boolean =>
    factureDocs.some(d =>
      (subTypeOf(d) === 'avoir' || d.docType === 'avoir') &&
      ((d as unknown as Record<string, unknown>).parentInvoiceNumber as string | undefined) === parentNumber,
    )

  const buildAcomptePrefill = (
    parent: PersistedDocument,
    p: { percentage: number; ordre: number; total: number; declencheur: string },
  ): PersistedDocument => {
    const r = p.percentage / 100
    type Line = { description?: string; priceHT?: number; totalHT?: number; [k: string]: unknown }
    const scaleLines = (arr?: Line[]) => (arr || []).map(l => ({
      ...l,
      priceHT: round2(((l.priceHT as number) || 0) * r),
      totalHT: round2(((l.totalHT as number) || 0) * r),
    }))
    const parentAny = parent as unknown as Record<string, unknown>
    return {
      ...parent,
      id: undefined,
      docType: 'facture',
      docNumber: '',
      status: 'brouillon',
      savedAt: undefined,
      sentAt: undefined,
      docDate: new Date().toISOString().slice(0, 10),
      docTitle: `Acompte N°${p.ordre} sur ${p.total} (${p.percentage}%) — ${parent.docTitle || parent.docNumber}`,
      lines: scaleLines(parent.lines as Line[] | undefined),
      materialLines: scaleLines(parentAny.materialLines as Line[] | undefined),
      fraisAnnexes: parentAny.fraisAnnexes as unknown as never,
      factureSubType: 'acompte',
      acompteOrdre: p.ordre,
      acompteTotal: p.total,
      acomptePourcentage: p.percentage,
      acompteDeFactureId: (parentAny.id as string | undefined) ?? parent.docNumber,
      parentInvoiceNumber: parent.docNumber,
      notes: `Acompte ${p.percentage}% (N°${p.ordre} sur ${p.total}) sur facture ${parent.docNumber}. ` +
             `Déclencheur : ${p.declencheur}. TVA exigible à l'encaissement (art. 289 CGI + BOFIP-TVA-DECLA-30-10-20).`,
    } as PersistedDocument
  }

  const buildAvoirPrefill = (
    parent: PersistedDocument,
    p: { motif: string; type: 'totale' | 'partielle' },
  ): PersistedDocument => {
    type Line = { description?: string; priceHT?: number; totalHT?: number; [k: string]: unknown }
    const negateLines = (arr?: Line[]) => (arr || []).map(l => ({
      ...l,
      priceHT: -(((l.priceHT as number) || 0)),
      totalHT: -(((l.totalHT as number) || 0)),
    }))
    const parentAny = parent as unknown as Record<string, unknown>
    return {
      ...parent,
      id: undefined,
      docType: 'avoir',
      docNumber: '',
      status: 'brouillon',
      savedAt: undefined,
      sentAt: undefined,
      docDate: new Date().toISOString().slice(0, 10),
      docTitle: `AVOIR sur facture ${parent.docNumber}${p.type === 'partielle' ? ' (annulation partielle)' : ''}`,
      lines: negateLines(parent.lines as Line[] | undefined),
      materialLines: negateLines(parentAny.materialLines as Line[] | undefined),
      fraisAnnexes: parentAny.fraisAnnexes as unknown as never,
      factureSubType: 'avoir',
      parentInvoiceNumber: parent.docNumber,
      avoirDeFactureId: (parentAny.id as string | undefined) ?? parent.docNumber,
      avoirMotif: p.motif,
      acomptesEnabled: false,
      acomptes: [],
      notes: `Avoir (note de crédit) émis en annulation ${p.type} de la facture ${parent.docNumber}. ` +
             `Motif : ${p.motif}. Conformément à l'art. 272 CGI + BOI-TVA-DECLA-30-20-20-30 §70 ` +
             `(rectification TVA collectée par l'émetteur / déductible par le preneur).`,
    } as PersistedDocument
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
              // Collect lines from both flat lines[] and BTP customTables[].lines[]
              const flatLines = Array.isArray(doc.lines) ? doc.lines.filter(Boolean) : []
              const customTables = (doc as unknown as Record<string, unknown>).customTables as Array<{ lines?: Array<Record<string, unknown>> }> | undefined
              const tableLines = Array.isArray(customTables)
                ? customTables.flatMap(t => Array.isArray(t.lines) ? t.lines.filter(Boolean) : [])
                : []
              // Combine flat lines and customTables lines (BTP docs use both)
              const allLines = [...flatLines, ...tableLines]
              const tva = computeTva({
                regime: effectiveRegime,
                lines: allLines
                  .filter((l): l is { totalHT?: number; tvaRate?: number } => l !== null && typeof l === 'object')
                  .map(l => ({
                    totalHT: (l.totalHT as number) || 0,
                    tvaRate: ((l as { tvaRate?: number }).tvaRate as number) ?? 20,
                  })),
              })
              // FR-V1.3 — Affiche le total brut des lignes, identique au PDF generator V3
              // et à `total_ttc_cents` en DB (source de vérité légale, art. L441-9 C. com.).
              // L'ancienne multiplication `totalTTC * firstAcompte.pourcentage / 100`
              // divergeait du PDF : incident Gourdon/Plessis 2026-05-26 (UI = 50% du PDF
              // car les acomptes[] persistaient en raw_data même quand acomptesEnabled=false).
              // Pour un acompte propre, l'utilisateur édite les lignes pour qu'elles
              // représentent directement l'acompte consolidé par TVA (workflow Gourdon :
              // "Acompte 50% — Travaux d'amélioration (TVA 10%)" + "(TVA 20%)", art. 269-2-c CGI).
              const totalTTC = tva.totalTTC
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
                          // FR-V1.2 — functional update preserves DB-only entries (cf. incident Sud travaux 2026-05-26)
                          setSavedDocuments(prev => prev.map(d => d.docNumber === doc.docNumber ? { ...d, status: 'envoye', sentAt: now } : d))
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
                          // FR-V1.2 — functional update preserves DB-only entries (cf. incident Sud travaux 2026-05-26)
                          setSavedDocuments(prev => prev.map(d => d.docNumber === doc.docNumber ? { ...d, status: 'envoye', sentAt: now } : d))
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
                      {/* Quick Actions BTP pro — méthode pro 2026 :
                          « → Acompte » (art. 289 CGI, fractionnement Henrri/EBP-style)
                          « → Avoir »  (art. 272 CGI, BOI-TVA-DECLA-30-20-20-30 §70).
                          Visibles uniquement sur factures émises (envoye/pending),
                          standard (pas acompte/situation/avoir), et avec un total
                          non nul. « → Avoir » désactivé si un avoir existe déjà. */}
                      {orgRole === 'pro_societe' && (doc.status === 'envoye' || doc.status === 'pending') &&
                        subTypeOf(doc) === 'standard' && doc.docType !== 'avoir' && totalTTC > 0 && (
                          <button
                            className="v5-btn v5-btn-sm"
                            title={t('proDash.factures.toAcompteTitle')}
                            onClick={e => { e.stopPropagation(); setAcompteParent(doc) }}
                            style={{ borderColor: 'var(--primary-yellow, #FFC107)', color: '#7A5900' }}
                          >
                            {t('proDash.factures.toAcompte')}
                          </button>
                      )}
                      {orgRole === 'pro_societe' && (doc.status === 'envoye' || doc.status === 'pending') &&
                        subTypeOf(doc) !== 'avoir' && doc.docType !== 'avoir' && (
                          <button
                            className="v5-btn v5-btn-sm"
                            title={hasAvoirFor(doc.docNumber) ? t('proDash.factures.toAvoirAlreadyTitle') : t('proDash.factures.toAvoirTitle')}
                            onClick={e => { e.stopPropagation(); setAvoirParent(doc) }}
                            disabled={hasAvoirFor(doc.docNumber)}
                            style={{ borderColor: '#D32F2F', color: '#7A1F1F', opacity: hasAvoirFor(doc.docNumber) ? 0.5 : 1 }}
                          >
                            {t('proDash.factures.toAvoir')}
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
      {acompteParent && (
        <AcompteQuickModal
          parent={acompteParent}
          existingCount={countAcomptesFor(acompteParent.docNumber)}
          onClose={() => setAcompteParent(null)}
          onConfirm={(params) => {
            const prefilled = buildAcomptePrefill(acompteParent, params)
            setAcompteParent(null)
            openFactureForm(prefilled)
            toast.success(
              `Acompte ${params.percentage}% N°${params.ordre}/${params.total} préparé sur ${acompteParent.docNumber}. ` +
              `Numéro AV/FACT généré à l'enregistrement.`,
            )
          }}
        />
      )}
      {avoirParent && (
        <AvoirQuickModal
          parent={avoirParent}
          onClose={() => setAvoirParent(null)}
          onConfirm={(params) => {
            const prefilled = buildAvoirPrefill(avoirParent, params)
            setAvoirParent(null)
            openFactureForm(prefilled)
            toast.success(
              `Avoir préparé sur ${avoirParent.docNumber}. Numéro AV- généré à l'enregistrement.`,
            )
          }}
        />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   Quick Action Modals — Acompte & Avoir (méthode pro BTP 2026)
   ═══════════════════════════════════════════════════════ */

function AcompteQuickModal({
  parent,
  existingCount,
  onClose,
  onConfirm,
}: {
  parent: PersistedDocument
  existingCount: number
  onClose: () => void
  onConfirm: (p: { percentage: number; ordre: number; total: number; declencheur: string }) => void
}) {
  const [percentage, setPercentage] = useState<number>(30)
  const [ordre, setOrdre] = useState<number>(existingCount + 1)
  const [total, setTotal] = useState<number>(Math.max(existingCount + 1, 3))
  const [declencheur, setDeclencheur] = useState<string>('À la signature')

  const parentTotal = (parent.lines || []).reduce((s: number, l) => s + (Number(l.totalHT) || 0), 0)
  const calcAcompte = Math.round((parentTotal * percentage / 100) * 100) / 100
  const remaining = Math.round((parentTotal - calcAcompte) * 100) / 100

  const valid = percentage >= 1 && percentage <= 100 && ordre >= 1 && total >= ordre && declencheur.trim().length >= 1

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="acompte-modal-title"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 8, padding: 24, maxWidth: 520, width: '90%',
          boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
        }}
      >
        <h3 id="acompte-modal-title" style={{ margin: '0 0 4px', fontSize: 18 }}>
          → Acompte sur facture {parent.docNumber}
        </h3>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#666' }}>
          Méthode pro BTP 2026 — facturation d&apos;un versement avant prestation (art. 289 CGI).
          TVA exigible à l&apos;encaissement (BOFIP-TVA-DECLA-30-10-20).
        </p>
        <div style={{ background: 'rgba(255, 193, 7, 0.06)', border: '1px solid rgba(255, 193, 7, 0.4)', borderRadius: 6, padding: 12, marginBottom: 16, fontSize: 12 }}>
          <div><strong>Base facturée :</strong> {parent.docNumber} — {parentTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</div>
          <div><strong>Acomptes déjà émis :</strong> {existingCount}</div>
          <div style={{ marginTop: 6, color: '#7A5900' }}><strong>Cet acompte :</strong> {calcAcompte.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € — <strong>Restant après :</strong> {remaining.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12 }}>
            <span style={{ display: 'block', marginBottom: 4, color: '#444' }}>Pourcentage *</span>
            <input
              type="number" min={1} max={100} step="0.01" value={percentage}
              onChange={(e) => setPercentage(parseFloat(e.target.value) || 0)}
              style={{ width: '100%', padding: 6, border: '1px solid #ddd', borderRadius: 4 }}
            />
          </label>
          <label style={{ display: 'block', fontSize: 12 }}>
            <span style={{ display: 'block', marginBottom: 4, color: '#444' }}>N° d&apos;acompte *</span>
            <input
              type="number" min={1} value={ordre}
              onChange={(e) => setOrdre(parseInt(e.target.value, 10) || 1)}
              style={{ width: '100%', padding: 6, border: '1px solid #ddd', borderRadius: 4 }}
            />
          </label>
          <label style={{ display: 'block', fontSize: 12 }}>
            <span style={{ display: 'block', marginBottom: 4, color: '#444' }}>Sur (total) *</span>
            <input
              type="number" min={1} value={total}
              onChange={(e) => setTotal(parseInt(e.target.value, 10) || 1)}
              style={{ width: '100%', padding: 6, border: '1px solid #ddd', borderRadius: 4 }}
            />
          </label>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
            {[30, 50, 70, 100].map(preset => (
              <button
                key={preset}
                type="button"
                onClick={() => setPercentage(preset)}
                style={{
                  padding: '4px 10px', fontSize: 11, borderRadius: 4,
                  border: `1px solid ${percentage === preset ? 'var(--primary-yellow, #FFC107)' : '#ddd'}`,
                  background: percentage === preset ? 'rgba(255, 193, 7, 0.15)' : '#fff',
                  cursor: 'pointer', fontWeight: percentage === preset ? 700 : 500,
                }}
              >
                {preset} %
              </button>
            ))}
          </div>
        </div>
        <label style={{ display: 'block', fontSize: 12, marginBottom: 16 }}>
          <span style={{ display: 'block', marginBottom: 4, color: '#444' }}>Déclencheur *</span>
          <input
            type="text"
            value={declencheur}
            onChange={(e) => setDeclencheur(e.target.value)}
            placeholder="À la signature / Mi-chantier / Livraison / …"
            style={{ width: '100%', padding: 6, border: '1px solid #ddd', borderRadius: 4 }}
          />
        </label>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: 4, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}>Annuler</button>
          <button
            type="button"
            disabled={!valid}
            onClick={() => onConfirm({ percentage, ordre, total, declencheur: declencheur.trim() })}
            style={{
              padding: '8px 16px', borderRadius: 4, border: 'none',
              background: valid ? 'var(--primary-yellow, #FFC107)' : '#ddd',
              color: '#111', fontWeight: 700, cursor: valid ? 'pointer' : 'not-allowed',
            }}
          >
            Préparer l&apos;acompte
          </button>
        </div>
      </div>
    </div>
  )
}

function AvoirQuickModal({
  parent,
  onClose,
  onConfirm,
}: {
  parent: PersistedDocument
  onClose: () => void
  onConfirm: (p: { motif: string; type: 'totale' | 'partielle' }) => void
}) {
  const [motif, setMotif] = useState<string>('')
  const [type, setType] = useState<'totale' | 'partielle'>('totale')
  const motifLen = motif.trim().length
  const valid = motifLen >= 5 && motifLen <= 500

  const parentTotal = (parent.lines || []).reduce((s: number, l) => s + (Number(l.totalHT) || 0), 0)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="avoir-modal-title"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 8, padding: 24, maxWidth: 520, width: '90%',
          boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
        }}
      >
        <h3 id="avoir-modal-title" style={{ margin: '0 0 4px', fontSize: 18, color: '#7A1F1F' }}>
          → Avoir (note de crédit) sur {parent.docNumber}
        </h3>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#666' }}>
          Méthode pro BTP 2026 — annulation totale ou partielle d&apos;une facture émise.
          Rectification TVA collectée par l&apos;émetteur / déductible par le preneur
          (art. 272 CGI + BOI-TVA-DECLA-30-20-20-30 §70).
        </p>
        <div style={{ background: 'rgba(211, 47, 47, 0.05)', border: '1px solid rgba(211, 47, 47, 0.3)', borderRadius: 6, padding: 12, marginBottom: 16, fontSize: 12 }}>
          <div><strong>Facture annulée :</strong> {parent.docNumber} — {parentTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</div>
          <div style={{ marginTop: 4, color: '#7A1F1F' }}><strong>Total avoir :</strong> {(-parentTotal).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € (montants négatifs)</div>
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {(['totale', 'partielle'] as const).map(opt => (
            <label key={opt} style={{ flex: 1, padding: 10, border: `1.5px solid ${type === opt ? '#D32F2F' : '#ddd'}`, borderRadius: 6, cursor: 'pointer', background: type === opt ? 'rgba(211, 47, 47, 0.05)' : '#fff' }}>
              <input
                type="radio"
                name="avoir-type"
                value={opt}
                checked={type === opt}
                onChange={() => setType(opt)}
                style={{ marginRight: 8 }}
              />
              <strong style={{ fontSize: 13 }}>{opt === 'totale' ? 'Annulation totale' : 'Annulation partielle'}</strong>
              <div style={{ fontSize: 11, color: '#666', marginTop: 3 }}>
                {opt === 'totale' ? 'Reprend toutes les lignes en négatif' : 'Sélectionne les lignes à annuler dans le formulaire'}
              </div>
            </label>
          ))}
        </div>
        <label style={{ display: 'block', fontSize: 12, marginBottom: 16 }}>
          <span style={{ display: 'block', marginBottom: 4, color: '#444' }}>
            Motif d&apos;annulation * <span style={{ color: '#999', fontWeight: 400 }}>(5–500 caractères, preuve fiscale L123-22) — {motifLen}/500</span>
          </span>
          <textarea
            rows={3}
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex : erreur de facturation client, retour matériel défectueux, sortie comptable annulée…"
            style={{ width: '100%', padding: 8, border: `1px solid ${valid || motifLen === 0 ? '#ddd' : '#D32F2F'}`, borderRadius: 4, resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}
          />
        </label>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: 4, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}>Annuler</button>
          <button
            type="button"
            disabled={!valid}
            onClick={() => onConfirm({ motif: motif.trim(), type })}
            style={{
              padding: '8px 16px', borderRadius: 4, border: 'none',
              background: valid ? '#D32F2F' : '#ddd',
              color: '#fff', fontWeight: 700, cursor: valid ? 'pointer' : 'not-allowed',
            }}
          >
            Préparer l&apos;avoir
          </button>
        </div>
      </div>
    </div>
  )
}
