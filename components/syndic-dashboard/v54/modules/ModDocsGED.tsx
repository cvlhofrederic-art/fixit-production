'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Pill, type PillKind } from '../primitives/pill'
import { Button } from '../primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import Icon from '../primitives/icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import m from './modules.module.css'
import { useComingSoon } from './use-coming-soon'
import { useDocumentUpload } from './use-document-upload'
import {
  useLeaDocuments,
  useLeaDocActions,
  docTypeLabel,
  docTypeKind,
  docTypeIcon,
  docStatusLabel,
  docStatusKind,
  docDateShort,
  type LeaDocument,
  type LeaDocMeta,
} from './use-lea-documents'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { useMessages, useV54Locale, type V54Locale } from '@/lib/syndic/v54/i18n'
import { DOCS_GED_MESSAGES, type DocumentDemo } from './i18n/ModDocsGED.messages'

/**
 * Documentos (GED) — port byte-exact du ModDocsGED du bundle V5.7 (mock = preview anonyme).
 * Authentifié : liste réelle des documents Léa du cabinet (upload → OCR → indexação RAG),
 * avec indicateur de statut de traitement OCR. Anonyme : preview mock byte-exact inchangée.
 */

type Row = { id: string; icon: IconName; nome: string; sub: string; tipo: string; tipoKind: PillKind; edificio: string; tecnico: string; data: string; status?: LeaDocument['status'] }

const inputStyle = { width: '100%', padding: '10px 12px 10px 36px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, fontSize: 13 } as const
const searchIcon = { position: 'absolute', left: 12, top: 11, width: 14, height: 14, color: 'var(--v54-navy-300)' } as const
const selectStyle = { padding: '10px 12px', borderRadius: 8, border: '1px solid var(--v54-line-strong)', background: '#fff', color: 'var(--v54-ink)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' } as const

/** Lignes de la preview anonyme (démonstration dans la langue courante ; couleur portée par la donnée). */
const mockRows = (demo: readonly DocumentDemo[]): Row[] => demo.map((d) => ({ id: d.nome, icon: d.icon, nome: d.nome, sub: d.sub, tipo: d.tipo, tipoKind: d.tipoKind, edificio: d.edificio, tecnico: d.tecnico, data: d.data }))

const realRows = (docs: LeaDocument[], locale: V54Locale): Row[] => docs.map((d) => {
  const meta = (d.extracted_metadata ?? {}) as LeaDocMeta
  return {
    id: d.id,
    icon: docTypeIcon(d.type),
    nome: d.filename,
    sub: meta.summary_short || meta.fournisseur || docTypeLabel(d.type, locale),
    tipo: docTypeLabel(d.type, locale),
    tipoKind: docTypeKind(d.type),
    edificio: '—',
    tecnico: meta.fournisseur || '—',
    data: docDateShort(d.uploaded_at),
    status: d.status,
  }
})

export default function ModDocsGED() {
  const t = useMessages(DOCS_GED_MESSAGES)
  const locale = useV54Locale()
  const soon = useComingSoon()
  const data = useSyndicData()
  const authed = data.authenticated
  const { docs, refresh } = useLeaDocuments({ enabled: authed })
  const upload = useDocumentUpload(refresh)
  const actions = useLeaDocActions(refresh)

  const rows: Row[] = authed ? realRows(docs, locale) : mockRows(t.demo)
  const nFat = authed ? docs.filter((d) => d.type.startsWith('facture')).length : 1
  const nOrc = authed ? docs.filter((d) => d.type === 'devis').length : 1
  const nRel = authed ? docs.filter((d) => d.type === 'autre').length : 1
  const nTot = authed ? docs.length : 10

  return (
    <>
      <PageHead
        title={t.titre}
        lede={t.chapeau}
        actions={<>
          <Button aria-label={t.grilleAria} title={t.grilleTitre} onClick={soon(t.grilleBientot)}><Icon name="grid" /></Button>
          <Button variant="gold" onClick={upload('autre')}><Icon name="plus" />{t.ajouter}</Button>
        </>}
      />
      <div style={{ fontSize: 12, color: 'var(--v54-navy-300)', marginBottom: 14 }}>{t.synthese.prefixe}{nTot}{t.synthese.documents(nTot)}{nRel}{t.synthese.rapports(nRel)}{nFat}{t.synthese.factures(nFat)}{nOrc}{t.synthese.devis(nOrc)}</div>
      <KPIGrid items={[
        { icon: 'doc', num: nRel, lbl: t.kpi.rapports, accent: 'gold' },
        { icon: 'coin', num: nFat, lbl: t.kpi.factures, accent: 'sage' },
        { icon: 'pencil', num: nOrc, lbl: t.kpi.devis, accent: 'amber' },
        { icon: 'folder', num: nTot, lbl: t.kpi.tous },
      ]} />
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12, marginBottom: 18 }}>
        <div style={{ position: 'relative' }}>
          <Icon name="search" style={searchIcon} />
          <input aria-label={t.rechercheAria} style={inputStyle} placeholder={t.recherchePlaceholder} />
        </div>
        <select aria-label={t.filtres.immeubleAria} style={selectStyle}><option>{t.filtres.immeubleTous}</option></select>
        <select aria-label={t.filtres.prestataireAria} style={selectStyle}><option>{t.filtres.prestataireTous}</option></select>
        <select aria-label={t.filtres.typeAria} style={selectStyle}><option>{t.filtres.typeTous}</option></select>
      </div>
      <div style={{ fontSize: 12, color: 'var(--v54-navy-300)', marginBottom: 8 }}>{rows.length}{t.trouves(rows.length)}</div>
      <Panel flush={!(authed && rows.length === 0)}>
        {authed && rows.length === 0 ? (
          <Empty
            illustration="documentos"
            title={t.vide.titre}
            desc={t.vide.desc}
            action={<Button variant="gold" onClick={upload('autre')}><Icon name="plus" />{t.ajouter}</Button>}
          />
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>{t.colonnes.document}</th><th>{t.colonnes.type}</th><th>{t.colonnes.immeuble}</th><th>{t.colonnes.prestataire}</th><th>{t.colonnes.date}</th><th aria-label={t.colonnes.actionsAria} /></tr></thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div className={m.docIconThumb} aria-hidden="true"><Icon name={d.icon} /></div>
                        <div>
                          <b>{d.nome}</b>
                          <div style={{ fontSize: 11, color: 'var(--v54-navy-300)', marginTop: 2 }}>{d.sub}</div>
                          {d.status && d.status !== 'processed' && <div style={{ marginTop: 4 }}><Pill kind={docStatusKind(d.status)} noDot>{docStatusLabel(d.status, locale)}</Pill></div>}
                        </div>
                      </div>
                    </td>
                    <td><Pill kind={d.tipoKind} noDot>{d.tipo}</Pill></td>
                    <td>{d.edificio}</td>
                    <td>{d.tecnico}</td>
                    <td className={m.numCell}>{d.data}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {authed ? (
                        <>
                          <Button variant="ghost" size="sm" aria-label={t.ouvrirAria} title={t.ouvrirTitre} onClick={() => actions.open(d.id)}><Icon name="eye" /></Button>{' '}
                          <Button variant="ghost" size="sm" aria-label={t.supprimerDocument} title={t.supprimerTitre} onClick={() => actions.askDelete({ id: d.id, filename: d.nome })}><Icon name="trash" /></Button>
                        </>
                      ) : (
                        <Button variant="ghost" size="sm" aria-label={t.plusOptions} title={t.plusOptions} onClick={soon(t.optionsBientot)}>⋯</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal open={!!actions.pending} onClose={actions.cancelDelete} labelledBy="ged-del-title" size="sm">
        <ModalHead icon="trash" id="ged-del-title" title={t.supprimerDocument} onClose={actions.cancelDelete} />
        <ModalBody>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{t.suppression.avant}<b>{actions.pending?.filename}</b>{t.suppression.apres}</p>
        </ModalBody>
        <ModalFoot>
          <Button variant="ghost" onClick={actions.cancelDelete}>{t.suppression.annuler}</Button>
          <Button variant="danger" onClick={actions.confirmDelete} disabled={actions.busy}>{t.suppression.supprimer}</Button>
        </ModalFoot>
      </Modal>
    </>
  )
}
