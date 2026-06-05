'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import DevisFactureForm from '@/components/DevisFactureForm'
import DevisFactureFormBTP from '@/components/DevisFactureFormBTP'
import DocumentCancelModal from '@/components/DocumentCancelModal'
import ConfirmDraftDeleteDialog from '@/components/ConfirmDraftDeleteDialog'
import type { Artisan, Service, Booking } from '@/lib/types'
import { useThemeVars } from './useThemeVars'
import { downloadSavedDevis } from '@/lib/pdf/download-saved-devis'
import { useDocumentCancel, isDocDraftStatus } from './useDocumentCancel'
import { supabase } from '@/lib/supabase'
import { computeDocumentTotalHT } from '@/lib/devis-totals'
import { getDocSeq, dedupeDocsByIdentity } from '@/lib/devis-utils'
import { useOrgRoleContext, type OrgRole } from '@/lib/hooks/useOrgRoleContext'
import { AcompteQuickModal } from '@/components/dashboard/FacturesSection'
import { buildAcomptePrefill } from '@/lib/acompte-prefill'
import { emitDocument } from '@/lib/emit-document'
import { fetchNextDocNumber } from '@/lib/doc-number'
import { syncDocumentSafe } from '@/lib/document-sync'

interface DevisLine {
  totalHT?: number
  [key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

interface DevisDocument {
  id: string
  docType?: string
  docNumber?: string
  docTitle?: string
  docDate?: string
  savedAt?: string
  sentAt?: string
  clientName?: string
  clientEmail?: string
  status?: string
  lines?: DevisLine[]
  [key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

// Total HT d'un devis BTP — délégué à `computeDocumentTotalHT`
// (lib/devis-totals.ts), source unique de vérité. Toute logique de
// sommation et de filtrage des sections masquées est centralisée là.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const computeDevisTotalHT = (doc: DevisDocument): number => computeDocumentTotalHT(doc as any)

// Identifie un document unique
// 1) id (Date.now() par save) — nouveaux docs
// 2) savedAt (ISO timestamp unique par save) — anciens docs sans id
// Pas de fallback par docNumber : plusieurs docs peuvent partager un numéro
// (brouillon + doublons historiques) — utiliser docNumber ferait tout supprimer.
const isSameDoc = (a: DevisDocument, b: DevisDocument): boolean => {
  if (a.id && b.id) return a.id === b.id
  if (a.savedAt && b.savedAt) return a.savedAt === b.savedAt
  return false
}

// getDocSeq déplacé dans lib/devis-utils.ts pour réutilisation par FacturesSection
// (fix tri "du dernier émis au premier" cohérent sur devis + factures)

interface DevisSectionProps {
  artisan: Artisan | null
  services: Service[]
  bookings: Booking[]
  savedDocuments: DevisDocument[]
  setSavedDocuments: (docs: DevisDocument[] | ((prev: DevisDocument[]) => DevisDocument[])) => void
  showDevisForm: boolean
  setShowDevisForm: (v: boolean) => void
  convertingDevis: DevisDocument | null
  setConvertingDevis: (v: DevisDocument | null) => void
  /** Callback unifié : openDevisForm() = nouveau, openDevisForm(doc) = édition. */
  openDevisForm: (doc?: DevisDocument | null) => void
  convertDevisToFacture: (doc: DevisDocument) => void
}

export default function DevisSection({
  artisan, services, bookings, savedDocuments, setSavedDocuments,
  showDevisForm, setShowDevisForm, convertingDevis, setConvertingDevis, openDevisForm,
  convertDevisToFacture,
}: DevisSectionProps) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const { orgRole, isV5, useBtpDesign } = useOrgRoleContext()
  const tv = useThemeVars(isV5)

  // FR-V1.2 — Merge localStorage dans le state existant (qui contient déjà
  // le merge DB+local depuis le mount du dashboard). NE PAS écraser avec
  // [...docs, ...drafts] seul, sinon les entrées DB-only disparaissent.
  // Incident Sud travaux 2026-05-26 : factures DB perdues de l'UI après mutation.
  const refreshDocuments = () => {
    const localDocs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]') as DevisDocument[]
    const localDrafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]') as DevisDocument[]
    // Fusion par identité stable (id ; brouillons sans numéro inclus) : le
    // localStorage fraîchement écrit prime sur le state, l'ordre est préservé,
    // les entrées DB-only sont conservées (cf. dedupeDocsByIdentity).
    setSavedDocuments(prev => dedupeDocsByIdentity(prev, [...localDocs, ...localDrafts]))
  }

  const [pendingDraftDelete, setPendingDraftDelete] = useState<DevisDocument | null>(null)

  const { cancellingDoc, setCancellingDoc, handleRemoveDoc: _handleRemoveDocRaw, handleCancelled } =
    useDocumentCancel<DevisDocument>({
      artisanId: artisan?.id,
      docType: 'devis',
      isSameDoc,
      setSavedDocuments,
      // Pré-validé : le modal stylé en amont fait office de confirm() humain.
      confirmDraftDelete: () => true,
    })

  // Wrapper : pour les brouillons on ouvre un modal stylé (vs `confirm()` natif
  // moche). Pour les docs émis, le hook gère déjà son propre DocumentCancelModal.
  const handleRemoveDoc = (doc: DevisDocument) => {
    if (isDocDraftStatus(doc.status, 'devis')) {
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

  if (showDevisForm) {
    if (orgRole === 'pro_societe') {
      return (
        // key par document : remonte le form à chaque doc ouvert pour éviter
        // que les useState(initialData?…) conservent les valeurs du précédent.
        <DevisFactureFormBTP
          key={`btp-devis-${(convertingDevis as { docNumber?: string; id?: string } | null)?.docNumber || (convertingDevis as { id?: string } | null)?.id || 'new'}`}
          artisan={artisan as any} services={services as any} bookings={bookings as any} initialDocType="devis"
          initialData={convertingDevis as any}
          onBack={() => { setShowDevisForm(false); setConvertingDevis(null); refreshDocuments() }}
          onSave={() => { setConvertingDevis(null); refreshDocuments() }}
        />
      )
    }
    return (
      <DevisFactureForm artisan={artisan as any} services={services as any} bookings={bookings as any} initialDocType="devis"
        initialData={convertingDevis as any}
        onBack={() => { setShowDevisForm(false); setConvertingDevis(null); refreshDocuments() }}
        onSave={() => { setConvertingDevis(null); refreshDocuments() }}
        onConvertToFacture={(data) => { convertDevisToFacture(data as unknown as DevisDocument) }}
      />
    )
  }

  // Filtre les devis annulés de la liste active (statut 'cancelled' DB EN
   // ou 'annule' localStorage FR). Le record reste en DB pour audit légal
   // (art. L123-22 C. com., conservation 10 ans) mais disparaît du flux actif.
  const devisDocs = savedDocuments.filter(d =>
    d.docType === 'devis' && d.status !== 'cancelled' && d.status !== 'annule'
  )
  // Acomptes déjà émis (factures factureSubType='acompte') — pour marquer
  // « déjà émis » dans le sélecteur d'acompte côté devis. La ré-émission reste
  // permise (juste visible), cf. méthode pro 2026.
  const emittedAcomptes = savedDocuments.filter(
    d => (d as { factureSubType?: string }).factureSubType === 'acompte',
  )

  /* ═══════════════════════════════════════════
     V5 layout — pro_societe only
     ═══════════════════════════════════════════ */
  if (isV5) {
    return (
      <>
        <DevisSectionV5
          devisDocs={devisDocs}
          setShowDevisForm={setShowDevisForm}
          setConvertingDevis={setConvertingDevis}
          openDevisForm={openDevisForm}
          convertDevisToFacture={convertDevisToFacture}
          artisan={artisan}
          setSavedDocuments={setSavedDocuments}
          emittedAcomptes={emittedAcomptes}
          dateLocale={dateLocale}
          locale={locale}
          t={t}
          orgRole={orgRole}
          onRemoveDoc={handleRemoveDoc}
        />
        {cancellingDoc?.docNumber && (
          <DocumentCancelModal
            open={!!cancellingDoc}
            docType="devis"
            docNumber={cancellingDoc.docNumber}
            onCancelled={handleCancelled}
            onClose={() => setCancellingDoc(null)}
          />
        )}
        <ConfirmDraftDeleteDialog
          open={!!pendingDraftDelete}
          docType="devis"
          label={
            pendingDraftDelete?.docNumber ||
            (pendingDraftDelete?.clientName as string | undefined) ||
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
    <div>
      {/* Page header */}
      <div className="v22-page-header" style={{ justifyContent: 'space-between' }}>
        <div>
          <div className="v22-page-title">{'📄'} {t('proDash.devis.title')}</div>
          <div className="v22-page-sub">{t('proDash.devis.subtitle')}</div>
        </div>
        <button onClick={() => openDevisForm()} className="v22-btn v22-btn-primary">
          + {t('proDash.devis.nouveauDevis')}
        </button>
      </div>

      <div style={{ padding: '14px' }}>
        {/* Compteurs */}
        {devisDocs.length > 0 && (
          <div className="v22-stats" style={{ marginBottom: 14 }}>
            <div className="v22-stat">
              <div className="v22-stat-label">{t('proDash.devis.totalDevis')}</div>
              <div className="v22-stat-val">{devisDocs.length}</div>
            </div>
            <div className="v22-stat v22-stat-yellow">
              <div className="v22-stat-label">{t('proDash.devis.envoyes')}</div>
              <div className="v22-stat-val">{devisDocs.filter(d => d.status === 'envoye').length}</div>
            </div>
            <div className="v22-stat">
              <div className="v22-stat-label">{t('proDash.devis.nonEnvoyes')}</div>
              <div className="v22-stat-val">{devisDocs.filter(d => d.status !== 'envoye').length}</div>
            </div>
          </div>
        )}

        {/* Liste des devis */}
        {devisDocs.length > 0 ? (
          <div className="v22-card">
            <div className="v22-card-head">
              <div className="v22-card-title">{t('proDash.devis.title')}</div>
              <div className="v22-card-meta">{devisDocs.length} document{devisDocs.length > 1 ? 's' : ''}</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>{t('proDash.devis.ref')}</th>
                  <th>{t('proDash.devis.client')}</th>
                  <th>{t('proDash.devis.prestation')}</th>
                  <th style={{ textAlign: 'right' }}>{t('proDash.devis.montantHT')}</th>
                  <th>{t('proDash.devis.date')}</th>
                  <th>{t('proDash.devis.statut')}</th>
                  <th style={{ textAlign: 'right' }}>{t('proDash.devis.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {[...devisDocs].sort((a: DevisDocument, b: DevisDocument) => getDocSeq(a) - getDocSeq(b)).map((doc: DevisDocument, i: number) => {
                  const totalHT = computeDevisTotalHT(doc)
                  return (
                    <tr key={`saved-dev-${i}`}>
                      <td><span className="v22-ref">{doc.docNumber || 'Brouillon'}</span></td>
                      <td><span className="v22-client-name">{doc.clientName || t('proDash.devis.clientNonRenseigne')}</span></td>
                      <td>{doc.docTitle || '-'}</td>
                      <td className="v22-amount" style={{ textAlign: 'right' }}>{totalHT.toFixed(2)} €</td>
                      <td className="v22-mono">{doc.docDate ? new Date(doc.docDate).toLocaleDateString(dateLocale) : '-'}</td>
                      <td>
                        {doc.status === 'envoye'
                          ? <span className="v22-tag v22-tag-green">{t('proDash.devis.envoye')}</span>
                          : <span className="v22-tag v22-tag-amber">{t('proDash.devis.nonEnvoye')}</span>
                        }
                        {doc.sentAt && (
                          <div style={{ fontSize: 10, color: tv.textMuted, marginTop: 2 }}>
                            {t('proDash.devis.envoyeLe')} {new Date(doc.sentAt).toLocaleDateString(dateLocale, { day: '2-digit', month: 'short', year: 'numeric' })} {t('proDash.common.a')} {new Date(doc.sentAt).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <button onClick={() => { setConvertingDevis(doc); setShowDevisForm(true) }}
                            className="v22-btn v22-btn-sm" title={t('proDash.devis.modifier')}>
                            {'✏️'}
                          </button>
                          <button onClick={() => {
                            const { docNumber: _dn, id: _id, status: _st, sentAt: _sa, savedAt: _svd, signatureData: _sig, ...rest } = doc
                            setConvertingDevis({ ...rest, id: Date.now().toString(), docType: 'devis', isDuplicate: true })
                            setShowDevisForm(true)
                          }}
                            className="v22-btn v22-btn-sm" title={t('proDash.devis.dupliquerDevis')}>
                            {'🔄'}
                          </button>
                          <button onClick={async () => {
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
                                // Layout V22 = pro_conciergerie / pro_gestionnaire / undefined → jamais BTP
                                useBtpDesign: false,
                              })
                            } catch (err) {
                              console.error('[Devis] download failed', err)
                              toast.error(t('proDash.devis.erreurPDF'))
                            }
                          }}
                            className="v22-btn v22-btn-sm" title={t('proDash.devis.telechargerPDF')}>
                            {'⬇️'}
                          </button>
                          <button onClick={() => convertDevisToFacture(doc)}
                            className="v22-btn v22-btn-sm v22-btn-primary" title={t('proDash.devis.convertirFacture')}>
                            {'🧾'}
                          </button>
                          {doc.status !== 'envoye' && (
                            <button onClick={() => {
                              const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
                              const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
                              const now = new Date().toISOString()
                              const updDocs = docs.map((d: DevisDocument) => isSameDoc(d, doc) ? { ...d, status: 'envoye', sentAt: now } : d)
                              const updDrafts = drafts.map((d: DevisDocument) => isSameDoc(d, doc) ? { ...d, status: 'envoye', sentAt: now } : d)
                              localStorage.setItem(`fixit_documents_${artisan?.id}`, JSON.stringify(updDocs))
                              localStorage.setItem(`fixit_drafts_${artisan?.id}`, JSON.stringify(updDrafts))
                              // FR-V1.2 — functional update preserves DB-only entries (cf. incident Sud travaux 2026-05-26)
                              setSavedDocuments(prev => prev.map(d => isSameDoc(d, doc) ? { ...d, status: 'envoye', sentAt: now } : d))
                            }}
                              className="v22-btn v22-btn-sm" style={{ color: tv.green }} title={t('proDash.devis.marquerEnvoye')}>
                              {'✅'}
                            </button>
                          )}
                          {doc.clientEmail && (
                            <button onClick={() => {
                              const subject = encodeURIComponent(`${t('proDash.devis.title')} ${doc.docNumber} — ${artisan?.company_name || 'Fixit'}`)
                              const body = encodeURIComponent(`${t('proDash.devis.emailSalutation')} ${doc.clientName || ''},\n\n${t('proDash.devis.emailCorps')} ${doc.docNumber} ${t('proDash.devis.emailMontant')} ${totalHT.toFixed(2)} € ${t('proDash.devis.montantHT')}.\n\n${t('proDash.devis.emailCordialement')},\n${artisan?.company_name || ''}${artisan?.phone ? '\n' + artisan.phone : ''}`)
                              window.open(`mailto:${doc.clientEmail}?subject=${subject}&body=${body}`)
                              const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
                              const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
                              const now = new Date().toISOString()
                              const updDocs = docs.map((d: DevisDocument) => isSameDoc(d, doc) ? { ...d, status: 'envoye', sentAt: now } : d)
                              const updDrafts = drafts.map((d: DevisDocument) => isSameDoc(d, doc) ? { ...d, status: 'envoye', sentAt: now } : d)
                              localStorage.setItem(`fixit_documents_${artisan?.id}`, JSON.stringify(updDocs))
                              localStorage.setItem(`fixit_drafts_${artisan?.id}`, JSON.stringify(updDrafts))
                              // FR-V1.2 — functional update preserves DB-only entries (cf. incident Sud travaux 2026-05-26)
                              setSavedDocuments(prev => prev.map(d => isSameDoc(d, doc) ? { ...d, status: 'envoye', sentAt: now } : d))
                            }}
                              className="v22-btn v22-btn-sm" title={t('proDash.devis.envoyerEmail')}>
                              {'📧'}
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveDoc(doc)}
                            className="v22-btn v22-btn-sm"
                            style={{ color: tv.red }}
                            title={isDocDraftStatus(doc.status, 'devis')
                              ? t('proDash.devis.supprimer')
                              : (locale === 'pt' ? 'Anular' : 'Annuler')}
                          >
                            {isDocDraftStatus(doc.status, 'devis') ? '🗑️' : '🚫'}
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
          <div className="v22-card" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>{'📄'}</div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: tv.text }}>{t('proDash.devis.aucunDevis')}</div>
            <div style={{ fontSize: 12, color: tv.textMuted, marginBottom: 16 }}>{t('proDash.devis.creerPremierDevis')}</div>
            <button onClick={() => openDevisForm()} className="v22-btn v22-btn-primary">
              {t('proDash.devis.creerDevis')}
            </button>
          </div>
        )}
      </div>
      {cancellingDoc?.docNumber && (
        <DocumentCancelModal
          open={!!cancellingDoc}
          docType="devis"
          docNumber={cancellingDoc.docNumber}
          onCancelled={handleCancelled}
          onClose={() => setCancellingDoc(null)}
        />
      )}
      <ConfirmDraftDeleteDialog
        open={!!pendingDraftDelete}
        docType="devis"
        label={
          pendingDraftDelete?.docNumber ||
          (pendingDraftDelete?.clientName as string | undefined) ||
          (locale === 'pt' ? 'este rascunho' : 'ce brouillon')
        }
        onConfirm={confirmPendingDraftDelete}
        onClose={() => setPendingDraftDelete(null)}
      />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   V5 sub-component — Devis for pro_societe
   ═══════════════════════════════════════════════════════ */
function DevisSectionV5({
  devisDocs, setShowDevisForm, setConvertingDevis, openDevisForm, convertDevisToFacture,
  artisan, setSavedDocuments, emittedAcomptes, dateLocale, locale, t, orgRole, onRemoveDoc,
}: {
  devisDocs: DevisDocument[]
  setShowDevisForm: (v: boolean) => void
  setConvertingDevis: (v: DevisDocument | null) => void
  openDevisForm: (doc?: DevisDocument | null) => void
  convertDevisToFacture: (doc: DevisDocument) => void
  artisan: Artisan | null
  setSavedDocuments: (docs: DevisDocument[] | ((prev: DevisDocument[]) => DevisDocument[])) => void
  emittedAcomptes: DevisDocument[]
  dateLocale: string
  locale: string
  t: (k: string) => string
  orgRole?: OrgRole
  onRemoveDoc: (doc: DevisDocument) => void
}) {
  const { useBtpDesign } = useOrgRoleContext()
  const isPt = locale === 'pt'
  const [search, setSearch] = useState('')
  // « Facturer » (méthode pro 2026, BTP) : choix Facture totale (conversion
  // directe existante) ou Facture d'acompte (échéancier du devis / % choisi →
  // émission directe d'une facture d'acompte reliée au devis).
  const [factureChoiceDevis, setFactureChoiceDevis] = useState<DevisDocument | null>(null)
  const [acompteParentDevis, setAcompteParentDevis] = useState<DevisDocument | null>(null)
  // Ordres d'acomptes déjà émis pour un devis (factures d'acompte le référençant)
  // → marqués « déjà émis » dans le sélecteur (ré-émission permise).
  const emittedOrdresForDevis = (devisNumber: string): number[] =>
    emittedAcomptes
      .filter(a => (a as { parentInvoiceNumber?: string }).parentInvoiceNumber === devisNumber)
      .map(a => Number((a as { acompteOrdre?: number }).acompteOrdre))
      .filter(n => Number.isFinite(n))

  const filtered = devisDocs
    .filter(d => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        d.docNumber?.toLowerCase().includes(q) ||
        d.clientName?.toLowerCase().includes(q) ||
        d.docTitle?.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => getDocSeq(b) - getDocSeq(a))

  const getV5Badge = (doc: DevisDocument) => {
    if (doc.status === 'cancelled' || doc.status === 'annule') return { cls: 'v5-badge v5-badge-red', label: locale === 'pt' ? 'Anulado' : 'Annulé' }
    if (doc.status === 'accepte' || doc.status === 'accepted') return { cls: 'v5-badge v5-badge-green', label: locale === 'pt' ? 'Aceite' : 'Accepté' }
    if (doc.status === 'refuse' || doc.status === 'rejected') return { cls: 'v5-badge v5-badge-red', label: locale === 'pt' ? 'Recusado' : 'Refusé' }
    if (doc.status === 'envoye' || doc.status === 'sent') return { cls: 'v5-badge v5-badge-blue', label: t('proDash.devis.envoye') }
    if (doc.status === 'signe' || doc.status === 'signed') return { cls: 'v5-badge v5-badge-green', label: t('proDash.devis.signe') }
    return { cls: 'v5-badge v5-badge-yellow', label: t('proDash.devis.brouillon') }
  }

  // FR-V7 — Marque manuellement le devis accepté/refusé via l'API.
  // Met à jour localStorage + DB. L'audit log est généré par le trigger 080.
  const updateDevisStatus = async (doc: DevisDocument, newStatus: 'accepted' | 'rejected') => {
    if (!doc.docNumber) return
    const isPt = locale === 'pt'
    const labelAccept = isPt ? 'Aceite' : 'Accepté'
    const labelReject = isPt ? 'Recusado' : 'Refusé'
    const label = newStatus === 'accepted' ? labelAccept : labelReject
    let reason: string | undefined
    if (newStatus === 'rejected') {
      const promptMsg = isPt
        ? 'Razão do recusa (opcional, 5-500 caracteres)'
        : 'Raison du refus (optionnel, 5-500 caractères)'
      const r = window.prompt(promptMsg) || ''
      reason = r.trim().length >= 5 ? r.trim() : undefined
    }
    try {
      // Bearer token requis par /api/devis-status (cf. lib/auth-helpers.ts
      // getAuthUser → 401 sans Authorization header). Sans ça, le passage
      // Accepté/Refusé du devis échouait systématiquement en prod côté
      // artisan ET BTP (DevisSection partagé). Même pattern que la PR #184
      // pour /api/document-cancel.
      const { data: { session } } = await supabase.auth.getSession()
      const authHeader: Record<string, string> = session?.access_token
        ? { 'Authorization': `Bearer ${session.access_token}` }
        : {}
      const res = await fetch('/api/devis-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ numero: doc.docNumber, newStatus, reason }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error || (isPt ? 'Erro' : 'Erreur'))
        return
      }
      // Sync localStorage
      const localStatus = newStatus === 'accepted' ? 'accepte' : 'refuse'
      const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
      const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
      const mark = (d: DevisDocument) => isSameDoc(d, doc) ? { ...d, status: localStatus } : d
      localStorage.setItem(`fixit_documents_${artisan?.id}`, JSON.stringify(docs.map(mark)))
      localStorage.setItem(`fixit_drafts_${artisan?.id}`, JSON.stringify(drafts.map(mark)))
      // FR-V1.2 — functional update preserves DB-only entries (cf. incident Sud travaux 2026-05-26)
      setSavedDocuments(prev => prev.map(mark))
      toast.success(`${label} : ${doc.docNumber}`)
    } catch (e) {
      console.error('[updateDevisStatus] failed:', e)
      toast.error(isPt ? 'Erro de rede' : 'Erreur réseau')
    }
  }

  return (
    <div className="v5-fade">
      <div className="v5-pg-t"><h1>{t('proDash.devis.title')}</h1><p>{t('proDash.devis.subtitle')}</p></div>

      {/* Search + Create */}
      <div className="v5-search">
        <input
          className="v5-search-in"
          placeholder={t('proDash.devis.rechercher')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className="v5-btn v5-btn-p" onClick={() => openDevisForm()}>
          + {t('proDash.devis.creerDevisV5')}
        </button>
      </div>

      {/* Table */}
      <div className="v5-card" style={{ overflowX: 'auto' }}>
        <table className="v5-dt">
          <thead>
            <tr>
              <th>N°</th>
              <th>{t('proDash.devis.date')}</th>
              <th>{t('proDash.devis.client')}</th>
              <th>{t('proDash.devis.objet')}</th>
              <th style={{ textAlign: 'right' }}>{t('proDash.devis.montantHT')}</th>
              <th>{t('proDash.devis.statut')}</th>
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map((doc, i) => {
              const totalHT = computeDevisTotalHT(doc)
              const badge = getV5Badge(doc)
              const dateStr = doc.docDate
                ? new Date(doc.docDate).toLocaleDateString(dateLocale)
                : (doc.savedAt ? new Date(doc.savedAt).toLocaleDateString(dateLocale) : '-')
              return (
                <tr key={`v5-dev-${i}`}>
                  <td style={{ fontWeight: 600 }}>{doc.docNumber || 'Brouillon'}</td>
                  <td>{dateStr}</td>
                  <td>{doc.clientName || t('proDash.devis.nonRenseigne')}</td>
                  <td>{doc.docTitle || '-'}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{totalHT.toLocaleString('fr-FR')} €</td>
                  <td><span className={badge.cls}>{badge.label}</span></td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button
                        className="v5-btn v5-btn-sm"
                        onClick={() => { setConvertingDevis(doc); setShowDevisForm(true) }}
                      >
                        {t('proDash.devis.ouvrir')}
                      </button>
                      {doc.clientEmail && (
                        <button
                          className="v5-btn v5-btn-sm"
                          title={doc.clientEmail}
                          onClick={() => {
                            const subject = encodeURIComponent(`${t('proDash.devis.title')} ${doc.docNumber} — ${artisan?.company_name || 'Fixit'}`)
                            const totalHTMail = computeDevisTotalHT(doc)
                            const body = encodeURIComponent(`${t('proDash.devis.emailSalutation')} ${doc.clientName || ''},\n\n${t('proDash.devis.emailCorps')} ${doc.docNumber} ${t('proDash.devis.emailMontant')} ${totalHTMail.toFixed(2)} € ${t('proDash.devis.montantHT')}.\n\n${t('proDash.devis.emailCordialement')},\n${artisan?.company_name || ''}${artisan?.phone ? '\n' + artisan.phone : ''}`)
                            window.open(`mailto:${doc.clientEmail}?subject=${subject}&body=${body}`)
                            const allDocs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
                            const allDrafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
                            const now = new Date().toISOString()
                            const uDocs = allDocs.map((d: DevisDocument) => isSameDoc(d, doc) ? { ...d, status: 'envoye', sentAt: now } : d)
                            const uDrafts = allDrafts.map((d: DevisDocument) => isSameDoc(d, doc) ? { ...d, status: 'envoye', sentAt: now } : d)
                            localStorage.setItem(`fixit_documents_${artisan?.id}`, JSON.stringify(uDocs))
                            localStorage.setItem(`fixit_drafts_${artisan?.id}`, JSON.stringify(uDrafts))
                            // FR-V1.2 — functional update preserves DB-only entries (cf. incident Sud travaux 2026-05-26)
                            setSavedDocuments(prev => prev.map(d => isSameDoc(d, doc) ? { ...d, status: 'envoye', sentAt: now } : d))
                          }}
                        >
                          Email
                        </button>
                      )}
                      <button
                        className="v5-btn v5-btn-sm"
                        title={t('proDash.devis.dupliquerDevis')}
                        onClick={() => {
                          // Strip les champs liés à l'identité/état du devis d'origine
                          // pour que le nouveau reçoive un numéro chrono frais via fetchDocNumber
                          const { docNumber: _dn, id: _id, status: _st, sentAt: _sa, savedAt: _svd, signatureData: _sig, ...rest } = doc
                          setConvertingDevis({ ...rest, id: Date.now().toString(), docType: 'devis', isDuplicate: true })
                          setShowDevisForm(true)
                        }}
                      >
                        {t('proDash.devis.dupliquer')}
                      </button>
                      <button
                        className="v5-btn v5-btn-sm"
                        title={t('proDash.devis.telechargerPDF')}
                        onClick={async () => {
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
                            console.error('[Devis] download failed', err)
                            toast.error(t('proDash.devis.erreurPDF'))
                          }
                        }}
                      >
                        {t('proDash.devis.telecharger')}
                      </button>
                      {/* FR-V7 : Boutons Accepté / Refusé visibles uniquement sur devis envoyés */}
                      {(doc.status === 'envoye' || doc.status === 'sent') && (
                        <>
                          <button
                            className="v5-btn v5-btn-sm"
                            style={{ background: '#16A34A', color: 'white', borderColor: '#16A34A' }}
                            onClick={() => updateDevisStatus(doc, 'accepted')}
                            title={locale === 'pt' ? 'Marcar como aceite' : 'Marquer accepté'}
                          >
                            {locale === 'pt' ? '✓ Aceite' : '✓ Accepté'}
                          </button>
                          <button
                            className="v5-btn v5-btn-sm"
                            style={{ background: '#DC2626', color: 'white', borderColor: '#DC2626' }}
                            onClick={() => updateDevisStatus(doc, 'rejected')}
                            title={locale === 'pt' ? 'Marcar como recusado' : 'Marquer refusé'}
                          >
                            {locale === 'pt' ? '✗ Recusado' : '✗ Refusé'}
                          </button>
                        </>
                      )}
                      <button
                        className="v5-btn v5-btn-sm v5-btn-p"
                        onClick={() => orgRole === 'pro_societe' ? setFactureChoiceDevis(doc) : convertDevisToFacture(doc)}
                      >
                        {t('proDash.devis.facturer')}
                      </button>
                      <button
                        className="v5-btn v5-btn-sm v5-btn-d"
                        title={isDocDraftStatus(doc.status, 'devis')
                          ? t('proDash.devis.supprimer')
                          : (locale === 'pt' ? 'Anular' : 'Annuler')}
                        onClick={() => onRemoveDoc(doc)}
                        aria-label={isDocDraftStatus(doc.status, 'devis')
                          ? t('proDash.devis.supprimer')
                          : (locale === 'pt' ? 'Anular' : 'Annuler')}
                      >
                        {isDocDraftStatus(doc.status, 'devis') ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"/>
                            <path d="M10 11v6M14 11v6"/>
                          </svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M4.93 4.93l14.14 14.14"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            }) : (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
                  {search ? t('proDash.devis.aucunDevisTrouve') : t('proDash.devis.aucunDevisCreer')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* « Facturer » — choix Facture totale / Facture d'acompte (méthode pro 2026, BTP). */}
      {factureChoiceDevis && (
        <div
          role="dialog" aria-modal="true" aria-label="Type de facture"
          onClick={() => setFactureChoiceDevis(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 8, padding: 24, maxWidth: 460, width: '90%', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 18 }}>Facturer le devis {factureChoiceDevis.docNumber}</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#666' }}>Choisissez le type de facture à émettre.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                onClick={() => { const d = factureChoiceDevis; setFactureChoiceDevis(null); convertDevisToFacture(d) }}
                style={{ padding: '12px 16px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: 14, fontWeight: 600 }}
              >
                Facture totale
                <div style={{ fontSize: 12, color: '#666', fontWeight: 400, marginTop: 2 }}>Convertit le devis en facture (montant total).</div>
              </button>
              <button
                type="button"
                onClick={() => { setAcompteParentDevis(factureChoiceDevis); setFactureChoiceDevis(null) }}
                style={{ padding: '12px 16px', borderRadius: 6, border: '1px solid var(--primary-yellow, #FFC107)', background: 'rgba(255,193,7,0.08)', cursor: 'pointer', textAlign: 'left', fontSize: 14, fontWeight: 600, color: '#7A5900' }}
              >
                Facture d&apos;acompte
                <div style={{ fontSize: 12, color: '#7A5900', fontWeight: 400, marginTop: 2 }}>Émet un acompte au % choisi (reprend l&apos;échéancier du devis).</div>
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" onClick={() => setFactureChoiceDevis(null)} style={{ padding: '8px 16px', borderRadius: 4, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}>Annuler</button>
            </div>
          </div>
        </div>
      )}
      {acompteParentDevis && (
        <AcompteQuickModal
          parent={acompteParentDevis as unknown as Parameters<typeof AcompteQuickModal>[0]['parent']}
          existingCount={0}
          emittedOrdres={emittedOrdresForDevis(acompteParentDevis.docNumber || '')}
          onClose={() => setAcompteParentDevis(null)}
          onConfirm={async (params) => {
            // Émission directe d'une facture d'acompte depuis le devis (méthode
            // pro 2026) : % appliqué à toutes les lignes (TVA du devis conservées),
            // numéro AC- définitif, statut émis, reliée au devis.
            const parent = acompteParentDevis
            setAcompteParentDevis(null)
            if (!parent || !artisan?.id) return
            const tid = toast.loading('Émission de l\'acompte…')
            try {
              const prefilled = buildAcomptePrefill(parent as unknown as Record<string, unknown>, params)
              const emitted = await emitDocument({
                payload: prefilled,
                artisanId: artisan.id,
                getNumber: () => fetchNextDocNumber('acompte', artisan.id),
                sync: syncDocumentSafe,
              })
              setSavedDocuments(prev => [...prev, emitted as unknown as DevisDocument])
              toast.success(`Acompte ${params.percentage}% émis : ${String(emitted.docNumber)} (devis ${parent.docNumber})`, { id: tid })
            } catch (err) {
              console.warn('[DevisAcompteEmit] émission échouée', err)
              toast.error('Impossible d\'émettre l\'acompte. Réessayez.', { id: tid })
            }
          }}
        />
      )}
    </div>
  )
}
