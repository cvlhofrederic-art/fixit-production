'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import DevisFactureForm from '@/components/DevisFactureForm'
import DevisFactureFormBTP from '@/components/DevisFactureFormBTP'
import type { Artisan, Service, Booking } from '@/lib/types'
import { useThemeVars } from './useThemeVars'
import { downloadSavedDevis } from '@/lib/pdf/download-saved-devis'

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

// Extrait un entier comparable depuis un docNumber type "DEV-2026-003" ou "FACT-2026-012".
// Les docs sans numéro valide vont à la fin (MAX_SAFE_INTEGER).
const getDocSeq = (doc: DevisDocument): number => {
  const m = (doc.docNumber || '').match(/-(\d{4})-(\d+)$/)
  if (!m) return Number.MAX_SAFE_INTEGER
  return parseInt(m[1], 10) * 1000000 + parseInt(m[2], 10)
}

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
  const isV5 = orgRole === 'pro_societe' || orgRole === 'artisan'
  const tv = useThemeVars(isV5)

  const refreshDocuments = () => {
    const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
    const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
    setSavedDocuments([...docs, ...drafts])
  }

  if (showDevisForm) {
    if (orgRole === 'pro_societe') {
      return (
        <DevisFactureFormBTP artisan={artisan as any} services={services as any} bookings={bookings as any} initialDocType="devis"
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

  const devisDocs = savedDocuments.filter(d => d.docType === 'devis')

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
      orgRole={orgRole}
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
                              setSavedDocuments([...updDocs, ...updDrafts])
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
                              setSavedDocuments([...updDocs, ...updDrafts])
                            }}
                              className="v22-btn v22-btn-sm" title={t('proDash.devis.envoyerEmail')}>
                              {'📧'}
                            </button>
                          )}
                          <button onClick={() => {
                            if (!confirm(`${t('proDash.devis.supprimerDevisConfirm')} ${doc.docNumber || ''} ?`)) return
                            const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
                            const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
                            const updDocs = docs.filter((d: DevisDocument) => !isSameDoc(d, doc))
                            const updDrafts = drafts.filter((d: DevisDocument) => !isSameDoc(d, doc))
                            localStorage.setItem(`fixit_documents_${artisan?.id}`, JSON.stringify(updDocs))
                            localStorage.setItem(`fixit_drafts_${artisan?.id}`, JSON.stringify(updDrafts))
                            setSavedDocuments([...updDocs, ...updDrafts])
                          }}
                            className="v22-btn v22-btn-sm" style={{ color: tv.red }}>
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
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: tv.text }}>{t('proDash.devis.aucunDevis')}</div>
            <div style={{ fontSize: 12, color: tv.textMuted, marginBottom: 16 }}>{t('proDash.devis.creerPremierDevis')}</div>
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
  artisan, setSavedDocuments, dateLocale, locale, t, orgRole,
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
  orgRole?: OrgRole
}) {
  const isPt = locale === 'pt'
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
    .sort((a, b) => getDocSeq(a) - getDocSeq(b))

  const getV5Badge = (doc: DevisDocument) => {
    if (doc.status === 'envoye') return { cls: 'v5-badge v5-badge-blue', label: t('proDash.devis.envoye') }
    if (doc.status === 'signe') return { cls: 'v5-badge v5-badge-green', label: t('proDash.devis.signe') }
    return { cls: 'v5-badge v5-badge-yellow', label: t('proDash.devis.brouillon') }
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
        <button className="v5-btn v5-btn-p" onClick={() => setShowDevisForm(true)}>
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
              const totalHT = doc.lines?.reduce((s: number, l: DevisLine) => s + (l.totalHT || 0), 0) || 0
              const badge = getV5Badge(doc)
              const dateStr = doc.docDate
                ? new Date(doc.docDate).toLocaleDateString(dateLocale)
                : (doc.savedAt ? new Date(doc.savedAt).toLocaleDateString(dateLocale) : '-')
              return (
                <tr key={`v5-dev-${i}`}>
                  <td style={{ fontWeight: 600 }}>{doc.docNumber}</td>
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
                            const totalHTMail = doc.lines?.reduce((s: number, l: DevisLine) => s + (l.totalHT || 0), 0) || 0
                            const body = encodeURIComponent(`${t('proDash.devis.emailSalutation')} ${doc.clientName || ''},\n\n${t('proDash.devis.emailCorps')} ${doc.docNumber} ${t('proDash.devis.emailMontant')} ${totalHTMail.toFixed(2)} € ${t('proDash.devis.montantHT')}.\n\n${t('proDash.devis.emailCordialement')},\n${artisan?.company_name || ''}${artisan?.phone ? '\n' + artisan.phone : ''}`)
                            window.open(`mailto:${doc.clientEmail}?subject=${subject}&body=${body}`)
                            const allDocs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
                            const allDrafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
                            const now = new Date().toISOString()
                            const uDocs = allDocs.map((d: DevisDocument) => isSameDoc(d, doc) ? { ...d, status: 'envoye', sentAt: now } : d)
                            const uDrafts = allDrafts.map((d: DevisDocument) => isSameDoc(d, doc) ? { ...d, status: 'envoye', sentAt: now } : d)
                            localStorage.setItem(`fixit_documents_${artisan?.id}`, JSON.stringify(uDocs))
                            localStorage.setItem(`fixit_drafts_${artisan?.id}`, JSON.stringify(uDrafts))
                            setSavedDocuments([...uDocs, ...uDrafts])
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
                              useBtpDesign: orgRole === 'pro_societe',
                            })
                          } catch (err) {
                            console.error('[Devis] download failed', err)
                            toast.error(t('proDash.devis.erreurPDF'))
                          }
                        }}
                      >
                        {t('proDash.devis.telecharger')}
                      </button>
                      <button
                        className="v5-btn v5-btn-sm v5-btn-p"
                        onClick={() => convertDevisToFacture(doc)}
                      >
                        {t('proDash.devis.facturer')}
                      </button>
                      <button
                        className="v5-btn v5-btn-sm v5-btn-d"
                        title={t('proDash.devis.supprimer')}
                        onClick={() => {
                          const label = doc.docNumber || (doc.clientName || '')
                          if (!confirm(`${t('proDash.devis.supprimerDevisConfirm')} ${label} ?`)) return
                          const allDocs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
                          const allDrafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
                          const uDocs = allDocs.filter((d: DevisDocument) => !isSameDoc(d, doc))
                          const uDrafts = allDrafts.filter((d: DevisDocument) => !isSameDoc(d, doc))
                          localStorage.setItem(`fixit_documents_${artisan?.id}`, JSON.stringify(uDocs))
                          localStorage.setItem(`fixit_drafts_${artisan?.id}`, JSON.stringify(uDrafts))
                          setSavedDocuments([...uDocs, ...uDrafts])
                        }}
                        aria-label={t('proDash.devis.supprimer')}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"/>
                          <path d="M10 11v6M14 11v6"/>
                        </svg>
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
    </div>
  )
}
