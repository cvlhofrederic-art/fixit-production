'use client'

import { useState } from 'react'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import DevisFactureForm from '@/components/DevisFactureForm'
import { Artisan, Service, Booking } from '@/lib/types'
import { DevisFactureData } from '@/lib/devis-types'
import { useThemeVars, ThemeVars } from './useThemeVars'

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

type OrgRole = 'artisan' | 'pro_societe' | 'pro_conciergerie' | 'pro_gestionnaire'

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
  orgRole?: OrgRole
}

export default function FacturesSection({
  artisan, services, bookings, savedDocuments, setSavedDocuments,
  showFactureForm, setShowFactureForm, convertingDevis, setConvertingDevis,
  orgRole,
}: FacturesSectionProps) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const isV5 = orgRole === 'pro_societe' || orgRole === 'artisan'
  const tv = useThemeVars(isV5)

  const refreshDocuments = () => {
    const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
    const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
    setSavedDocuments([...docs, ...drafts])
  }

  if (showFactureForm) {
    return (
      <DevisFactureForm artisan={artisan} services={services} bookings={bookings} initialDocType="facture"
        initialData={convertingDevis as Partial<DevisFactureData> | undefined}
        onBack={() => { setShowFactureForm(false); setConvertingDevis(null); refreshDocuments() }}
        onSave={() => { setConvertingDevis(null); refreshDocuments() }}
      />
    )
  }

  const factureDocs = savedDocuments.filter(d => d.docType === 'facture')

  const getStatusTag = (doc: PersistedDocument, isOverdue: boolean) => {
    if (isOverdue && doc.status !== 'envoye') return { cls: 'v22-tag v22-tag-red', label: t('proDash.factures.echue') }
    if (doc.status === 'envoye') return { cls: 'v22-tag v22-tag-green', label: t('proDash.factures.envoyee') }
    return { cls: 'v22-tag v22-tag-amber', label: t('proDash.factures.nonEnvoyee') }
  }

  /* ═══════════════════════════════════════════
     V5 layout — pro_societe only
     ═══════════════════════════════════════════ */
  if (isV5) {
    return <FacturesSectionV5
      factureDocs={factureDocs}
      setShowFactureForm={setShowFactureForm}
      setConvertingDevis={setConvertingDevis}
      artisan={artisan}
      setSavedDocuments={setSavedDocuments}
      dateLocale={dateLocale}
      locale={locale}
      t={t}
      tv={tv}
    />
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
        <button className="v22-btn v22-btn-primary" onClick={() => setShowFactureForm(true)}>
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
              {factureDocs.reduce((s, d) => s + (d.lines?.reduce((t: number, l) => t + (l.totalHT || 0), 0) || 0), 0).toFixed(2)} €
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
                  <th>{locale === 'pt' ? 'Ref' : 'Réf'}</th>
                  <th>{locale === 'pt' ? 'Cliente' : 'Client'}</th>
                  <th style={{ textAlign: 'right' }}>{locale === 'pt' ? 'Montante s/ IVA' : 'Montant HT'}</th>
                  <th>{locale === 'pt' ? 'Emitida em' : 'Émise le'}</th>
                  <th>{locale === 'pt' ? 'Vencimento' : 'Échéance'}</th>
                  <th>{locale === 'pt' ? 'Estado' : 'Statut'}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {factureDocs.sort((a, b) => new Date(b.savedAt || b.docDate || '').getTime() - new Date(a.savedAt || a.docDate || '').getTime()).map((doc, i) => {
                  const totalHT = doc.lines?.reduce((s: number, l) => s + (l.totalHT || 0), 0) || 0
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
                          {doc.clientEmail && (
                            <button className="v22-btn v22-btn-sm" onClick={(e) => {
                              e.stopPropagation()
                              const subject = encodeURIComponent(`${t('proDash.factures.title')} ${doc.docNumber} — ${artisan?.company_name || 'Fixit'}`)
                              const body = encodeURIComponent(`${locale === 'pt' ? 'Olá' : 'Bonjour'} ${doc.clientName || ''},\n\n${locale === 'pt' ? `Segue em anexo a sua fatura N.º${doc.docNumber} no valor de ${totalHT.toFixed(2)} € s/ IVA.` : `Veuillez trouver ci-joint votre facture N°${doc.docNumber} d'un montant de ${totalHT.toFixed(2)} € HT.`}\n\n${locale === 'pt' ? 'Com os melhores cumprimentos' : 'Cordialement'},\n${artisan?.company_name || ''}${artisan?.phone ? '\n' + artisan.phone : ''}`)
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
                            if (!confirm(`${t('proDash.factures.supprimerFactureConfirm')} ${doc.docNumber} ?`)) return
                            const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
                            const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
                            const updDocs = (docs as PersistedDocument[]).filter(d => d.docNumber !== doc.docNumber)
                            const updDrafts = (drafts as PersistedDocument[]).filter(d => d.docNumber !== doc.docNumber)
                            localStorage.setItem(`fixit_documents_${artisan?.id}`, JSON.stringify(updDocs))
                            localStorage.setItem(`fixit_drafts_${artisan?.id}`, JSON.stringify(updDrafts))
                            setSavedDocuments([...updDocs, ...updDrafts])
                          }}>
                            {locale === 'pt' ? 'Apagar' : 'Suppr.'}
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
            <button className="v22-btn v22-btn-primary" onClick={() => setShowFactureForm(true)}>
              {t('proDash.factures.creerFacture')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   V5 sub-component — Factures for pro_societe
   ═══════════════════════════════════════════════════════ */
function FacturesSectionV5({
  factureDocs, setShowFactureForm, setConvertingDevis,
  artisan, setSavedDocuments, dateLocale, locale, t, tv,
}: {
  factureDocs: PersistedDocument[]
  setShowFactureForm: (v: boolean) => void
  setConvertingDevis: (v: PersistedDocument | null) => void
  artisan: Artisan
  setSavedDocuments: (docs: PersistedDocument[]) => void
  dateLocale: string
  locale: string
  t: (k: string) => string
  tv: ThemeVars
}) {
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
    if (doc.status === 'envoye') return { cls: 'v5-badge v5-badge-blue', label: 'Émise' }
    if (doc.status === 'payee') return { cls: 'v5-badge v5-badge-green', label: 'Payée' }
    return { cls: 'v5-badge v5-badge-yellow', label: 'Brouillon' }
  }

  // Guess facture type from docNumber or title
  const guessType = (doc: PersistedDocument) => {
    const num = doc.docNumber?.toLowerCase() || ''
    const title = doc.docTitle?.toLowerCase() || ''
    if (num.includes('sit') || title.includes('situation')) return 'Situation'
    if (num.includes('aco') || title.includes('acompte')) return 'Acompte'
    if (num.includes('sol') || title.includes('solde')) return 'Solde'
    return 'Facture'
  }

  return (
    <div className="v5-fade">
      <div className="v5-pg-t"><h1>Factures</h1><p>Situations, acomptes, solde</p></div>

      {/* Search + Create */}
      <div className="v5-search">
        <input
          className="v5-search-in"
          placeholder="Rechercher…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className="v5-btn v5-btn-p" onClick={() => setShowFactureForm(true)}>
          + Nouvelle facture
        </button>
      </div>

      {/* Table */}
      <div className="v5-card" style={{ overflowX: 'auto' }}>
        <table className="v5-dt">
          <thead>
            <tr>
              <th>N°</th>
              <th>Client</th>
              <th>Type</th>
              <th>Montant TTC</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map((doc, i) => {
              const totalHT = doc.lines?.reduce((s: number, l) => s + (l.totalHT || 0), 0) || 0
              const totalTTC = totalHT * 1.2 // TVA 20%
              const badge = getV5Badge(doc)
              return (
                <tr key={`v5-fac-${i}`} style={{ cursor: 'pointer' }} onClick={() => { setConvertingDevis(doc); setShowFactureForm(true) }}>
                  <td style={{ fontWeight: 600 }}>{doc.docNumber}</td>
                  <td>{doc.clientName || 'Non renseigné'}</td>
                  <td>{guessType(doc)}</td>
                  <td>{totalTTC.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</td>
                  <td><span className={badge.cls}>{badge.label}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      {doc.status !== 'envoye' && (
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
                          const subject = encodeURIComponent(`Facture ${doc.docNumber} — ${artisan?.company_name || 'Fixit'}`)
                          const body = encodeURIComponent(`Bonjour ${doc.clientName || ''},\n\nVeuillez trouver ci-joint votre facture N°${doc.docNumber} d'un montant de ${totalHT.toFixed(2)} € HT.\n\nCordialement,\n${artisan?.company_name || ''}${artisan?.phone ? '\n' + artisan.phone : ''}`)
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
                      <button className="v5-btn v5-btn-sm v5-btn-d" onClick={e => {
                        e.stopPropagation()
                        if (!confirm(`Supprimer la facture ${doc.docNumber} ?`)) return
                        const allDocs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
                        const allDrafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
                        const uDocs = (allDocs as PersistedDocument[]).filter(d => d.docNumber !== doc.docNumber)
                        const uDrafts = (allDrafts as PersistedDocument[]).filter(d => d.docNumber !== doc.docNumber)
                        localStorage.setItem(`fixit_documents_${artisan?.id}`, JSON.stringify(uDocs))
                        localStorage.setItem(`fixit_drafts_${artisan?.id}`, JSON.stringify(uDrafts))
                        setSavedDocuments([...uDocs, ...uDrafts])
                      }}>
                        Suppr.
                      </button>
                    </div>
                  </td>
                </tr>
              )
            }) : (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: tv.textMid }}>
                  {search ? 'Aucune facture trouvée' : 'Aucune facture. Créez votre première facture.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
