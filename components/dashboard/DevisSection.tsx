'use client'

import { useState } from 'react'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import DevisFactureForm from '@/components/DevisFactureForm'
import type { Artisan, Service, Booking } from '@/lib/types'

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

type OrgRole = 'artisan' | 'pro_societe' | 'pro_conciergerie' | 'pro_gestionnaire'

interface DevisSectionProps {
  artisan: Artisan | null
  services: Service[]
  bookings: Booking[]
  savedDocuments: DevisDocument[]
  setSavedDocuments: (docs: DevisDocument[]) => void
  showDevisForm: boolean
  setShowDevisForm: (v: boolean) => void
  convertingDevis: DevisDocument | null
  setConvertingDevis: (v: DevisDocument | null) => void
  convertDevisToFacture: (doc: DevisDocument) => void
  orgRole?: OrgRole
}

export default function DevisSection({
  artisan, services, bookings, savedDocuments, setSavedDocuments,
  showDevisForm, setShowDevisForm, convertingDevis, setConvertingDevis,
  convertDevisToFacture, orgRole,
}: DevisSectionProps) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'

  const refreshDocuments = () => {
    const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
    const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
    setSavedDocuments([...docs, ...drafts])
  }

  if (showDevisForm) {
    return (
      <DevisFactureForm artisan={artisan as any} services={services as any} bookings={bookings as any} initialDocType="devis"
        initialData={convertingDevis as any}
        onBack={() => { setShowDevisForm(false); setConvertingDevis(null); refreshDocuments() }}
        onSave={() => { setConvertingDevis(null); refreshDocuments() }}
      />
    )
  }

  const devisDocs = savedDocuments.filter(d => d.docType === 'devis')
  const isV5 = orgRole === 'pro_societe'

  /* ═══════════════════════════════════════════
     V5 layout — pro_societe only
     ═══════════════════════════════════════════ */
  if (isV5) {
    return <DevisSectionV5
      devisDocs={devisDocs}
      setShowDevisForm={setShowDevisForm}
      setConvertingDevis={setConvertingDevis}
      convertDevisToFacture={convertDevisToFacture}
      artisan={artisan}
      setSavedDocuments={setSavedDocuments}
      dateLocale={dateLocale}
      locale={locale}
      t={t}
    />
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
        <button onClick={() => setShowDevisForm(true)} className="v22-btn v22-btn-primary">
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
                  <th>Réf</th>
                  <th>Client</th>
                  <th>Prestation</th>
                  <th style={{ textAlign: 'right' }}>Montant HT</th>
                  <th>Date</th>
                  <th>Statut</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {devisDocs.sort((a: DevisDocument, b: DevisDocument) => new Date(b.savedAt || b.docDate || 0).getTime() - new Date(a.savedAt || a.docDate || 0).getTime()).map((doc: DevisDocument, i: number) => {
                  const totalHT = doc.lines?.reduce((s: number, l: DevisLine) => s + (l.totalHT || 0), 0) || 0
                  return (
                    <tr key={`saved-dev-${i}`}>
                      <td><span className="v22-ref">{doc.docNumber}</span></td>
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
                          <div style={{ fontSize: 10, color: 'var(--v22-text-muted)', marginTop: 2 }}>
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
                            className="v22-btn v22-btn-sm" title={locale === 'pt' ? 'Duplicar orçamento' : 'Dupliquer le devis'}>
                            {'🔄'}
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
                              const updDocs = docs.map((d: DevisDocument) => d.docNumber === doc.docNumber ? { ...d, status: 'envoye', sentAt: now } : d)
                              const updDrafts = drafts.map((d: DevisDocument) => d.docNumber === doc.docNumber ? { ...d, status: 'envoye', sentAt: now } : d)
                              localStorage.setItem(`fixit_documents_${artisan?.id}`, JSON.stringify(updDocs))
                              localStorage.setItem(`fixit_drafts_${artisan?.id}`, JSON.stringify(updDrafts))
                              setSavedDocuments([...updDocs, ...updDrafts])
                            }}
                              className="v22-btn v22-btn-sm" style={{ color: 'var(--v22-green)' }} title={t('proDash.devis.marquerEnvoye')}>
                              {'✅'}
                            </button>
                          )}
                          {doc.clientEmail && (
                            <button onClick={() => {
                              const subject = encodeURIComponent(`${t('proDash.devis.title')} ${doc.docNumber} — ${artisan?.company_name || 'Fixit'}`)
                              const body = encodeURIComponent(`${locale === 'pt' ? 'Olá' : 'Bonjour'} ${doc.clientName || ''},\n\n${locale === 'pt' ? `Segue em anexo o seu orçamento N.º${doc.docNumber} no valor de ${totalHT.toFixed(2)} € s/ IVA.` : `Veuillez trouver ci-joint votre devis N°${doc.docNumber} d'un montant de ${totalHT.toFixed(2)} € HT.`}\n\n${locale === 'pt' ? 'Com os melhores cumprimentos' : 'Cordialement'},\n${artisan?.company_name || ''}${artisan?.phone ? '\n' + artisan.phone : ''}`)
                              window.open(`mailto:${doc.clientEmail}?subject=${subject}&body=${body}`)
                              const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
                              const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
                              const now = new Date().toISOString()
                              const updDocs = docs.map((d: DevisDocument) => d.docNumber === doc.docNumber ? { ...d, status: 'envoye', sentAt: now } : d)
                              const updDrafts = drafts.map((d: DevisDocument) => d.docNumber === doc.docNumber ? { ...d, status: 'envoye', sentAt: now } : d)
                              localStorage.setItem(`fixit_documents_${artisan?.id}`, JSON.stringify(updDocs))
                              localStorage.setItem(`fixit_drafts_${artisan?.id}`, JSON.stringify(updDrafts))
                              setSavedDocuments([...updDocs, ...updDrafts])
                            }}
                              className="v22-btn v22-btn-sm" title={t('proDash.devis.envoyerEmail')}>
                              {'📧'}
                            </button>
                          )}
                          <button onClick={() => {
                            if (!confirm(`${t('proDash.devis.supprimerDevisConfirm')} ${doc.docNumber} ?`)) return
                            const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
                            const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
                            const updDocs = docs.filter((d: DevisDocument) => d.docNumber !== doc.docNumber)
                            const updDrafts = drafts.filter((d: DevisDocument) => d.docNumber !== doc.docNumber)
                            localStorage.setItem(`fixit_documents_${artisan?.id}`, JSON.stringify(updDocs))
                            localStorage.setItem(`fixit_drafts_${artisan?.id}`, JSON.stringify(updDrafts))
                            setSavedDocuments([...updDocs, ...updDrafts])
                          }}
                            className="v22-btn v22-btn-sm" style={{ color: 'var(--v22-red)' }}>
                            {'🗑️'}
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
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: 'var(--v22-text)' }}>{t('proDash.devis.aucunDevis')}</div>
            <div style={{ fontSize: 12, color: 'var(--v22-text-muted)', marginBottom: 16 }}>{t('proDash.devis.creerPremierDevis')}</div>
            <button onClick={() => setShowDevisForm(true)} className="v22-btn v22-btn-primary">
              {t('proDash.devis.creerDevis')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   V5 sub-component — Devis for pro_societe
   ═══════════════════════════════════════════════════════ */
function DevisSectionV5({
  devisDocs, setShowDevisForm, setConvertingDevis, convertDevisToFacture,
  artisan, setSavedDocuments, dateLocale, locale, t,
}: {
  devisDocs: DevisDocument[]
  setShowDevisForm: (v: boolean) => void
  setConvertingDevis: (v: DevisDocument | null) => void
  convertDevisToFacture: (doc: DevisDocument) => void
  artisan: Artisan | null
  setSavedDocuments: (docs: DevisDocument[]) => void
  dateLocale: string
  locale: string
  t: (k: string) => string
}) {
  const [search, setSearch] = useState('')

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
    .sort((a, b) => new Date(b.savedAt || b.docDate || 0).getTime() - new Date(a.savedAt || a.docDate || 0).getTime())

  const getV5Badge = (doc: DevisDocument) => {
    if (doc.status === 'envoye') return { cls: 'v5-badge v5-badge-blue', label: 'Envoy\u00e9' }
    if (doc.status === 'signe') return { cls: 'v5-badge v5-badge-green', label: 'Sign\u00e9 \u2713' }
    return { cls: 'v5-badge v5-badge-yellow', label: 'Brouillon' }
  }

  return (
    <div className="v5-fade">
      <div className="v5-pg-t"><h1>Devis</h1><p>Gestion des devis entreprise</p></div>

      {/* Search + Create */}
      <div className="v5-search">
        <input
          className="v5-search-in"
          placeholder="Rechercher\u2026"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className="v5-btn v5-btn-p" onClick={() => setShowDevisForm(true)}>
          + Cr\u00e9er un devis
        </button>
      </div>

      {/* Table */}
      <div className="v5-card" style={{ overflowX: 'auto' }}>
        <table className="v5-dt">
          <thead>
            <tr>
              <th>N\u00b0</th>
              <th>Client</th>
              <th>Objet</th>
              <th>Montant HT</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map((doc, i) => {
              const totalHT = doc.lines?.reduce((s: number, l: DevisLine) => s + (l.totalHT || 0), 0) || 0
              const badge = getV5Badge(doc)
              return (
                <tr key={`v5-dev-${i}`}>
                  <td style={{ fontWeight: 600 }}>{doc.docNumber}</td>
                  <td>{doc.clientName || 'Non renseign\u00e9'}</td>
                  <td>{doc.docTitle || '-'}</td>
                  <td>{totalHT.toLocaleString('fr-FR')} \u20ac</td>
                  <td><span className={badge.cls}>{badge.label}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button className="v5-btn v5-btn-sm" onClick={() => { setConvertingDevis(doc); setShowDevisForm(true) }} title="Modifier">
                        {'\u270f\ufe0f'}
                      </button>
                      <button className="v5-btn v5-btn-sm v5-btn-p" onClick={() => convertDevisToFacture(doc)} title="Convertir en facture">
                        {'\ud83e\uddfe'}
                      </button>
                      {doc.status !== 'envoye' && (
                        <button className="v5-btn v5-btn-sm" onClick={() => {
                          const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
                          const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
                          const now = new Date().toISOString()
                          const updDocs = docs.map((d: DevisDocument) => d.docNumber === doc.docNumber ? { ...d, status: 'envoye', sentAt: now } : d)
                          const updDrafts = drafts.map((d: DevisDocument) => d.docNumber === doc.docNumber ? { ...d, status: 'envoye', sentAt: now } : d)
                          localStorage.setItem(`fixit_documents_${artisan?.id}`, JSON.stringify(updDocs))
                          localStorage.setItem(`fixit_drafts_${artisan?.id}`, JSON.stringify(updDrafts))
                          setSavedDocuments([...updDocs, ...updDrafts])
                        }} title="Marquer envoy\u00e9" style={{ color: '#2E7D32' }}>
                          {'\u2705'}
                        </button>
                      )}
                      {doc.clientEmail && (
                        <button className="v5-btn v5-btn-sm" onClick={() => {
                          const subject = encodeURIComponent(`Devis ${doc.docNumber} \u2014 ${artisan?.company_name || 'Fixit'}`)
                          const totalHTMail = doc.lines?.reduce((s: number, l: DevisLine) => s + (l.totalHT || 0), 0) || 0
                          const body = encodeURIComponent(`Bonjour ${doc.clientName || ''},\n\nVeuillez trouver ci-joint votre devis N\u00b0${doc.docNumber} d'un montant de ${totalHTMail.toFixed(2)} \u20ac HT.\n\nCordialement,\n${artisan?.company_name || ''}${artisan?.phone ? '\n' + artisan.phone : ''}`)
                          window.open(`mailto:${doc.clientEmail}?subject=${subject}&body=${body}`)
                          const allDocs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
                          const allDrafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
                          const now = new Date().toISOString()
                          const uDocs = allDocs.map((d: DevisDocument) => d.docNumber === doc.docNumber ? { ...d, status: 'envoye', sentAt: now } : d)
                          const uDrafts = allDrafts.map((d: DevisDocument) => d.docNumber === doc.docNumber ? { ...d, status: 'envoye', sentAt: now } : d)
                          localStorage.setItem(`fixit_documents_${artisan?.id}`, JSON.stringify(uDocs))
                          localStorage.setItem(`fixit_drafts_${artisan?.id}`, JSON.stringify(uDrafts))
                          setSavedDocuments([...uDocs, ...uDrafts])
                        }} title="Envoyer par email">
                          {'\ud83d\udce7'}
                        </button>
                      )}
                      <button className="v5-btn v5-btn-sm v5-btn-d" onClick={() => {
                        if (!confirm(`Supprimer le devis ${doc.docNumber} ?`)) return
                        const allDocs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
                        const allDrafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
                        const uDocs = allDocs.filter((d: DevisDocument) => d.docNumber !== doc.docNumber)
                        const uDrafts = allDrafts.filter((d: DevisDocument) => d.docNumber !== doc.docNumber)
                        localStorage.setItem(`fixit_documents_${artisan?.id}`, JSON.stringify(uDocs))
                        localStorage.setItem(`fixit_drafts_${artisan?.id}`, JSON.stringify(uDrafts))
                        setSavedDocuments([...uDocs, ...uDrafts])
                      }}>
                        {'\ud83d\uddd1\ufe0f'}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            }) : (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
                  {search ? 'Aucun devis trouv\u00e9' : 'Aucun devis. Cr\u00e9ez votre premier devis.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
