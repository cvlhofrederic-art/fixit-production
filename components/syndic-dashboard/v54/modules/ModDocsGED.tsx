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

/**
 * Documentos (GED) — port byte-exact du ModDocsGED du bundle V5.7 (mock = preview anonyme).
 * Authentifié : liste réelle des documents Léa du cabinet (upload → OCR → indexação RAG),
 * avec indicateur de statut de traitement OCR. Anonyme : preview mock byte-exact inchangée.
 */

type Row = { id: string; icon: IconName; nome: string; sub: string; tipo: string; tipoKind: PillKind; edificio: string; tecnico: string; data: string; status?: LeaDocument['status'] }

const MOCK: readonly (readonly [IconName, string, string, string, string, string, string])[] = [
  ['key', 'Ata AG Anual 2026 - Edifício Atlântico.pdf', 'AG · 2026 · aprovação contas', 'Ata Assembleia', 'Edifício Atlântico', '—', '18/05/26'],
  ['key', 'Ata AG Anual 2025 - Residencial Cedofeita.pdf', 'AG · 2025', 'Ata Assembleia', 'Residencial Cedofeita', '—', '19/03/26'],
  ['clipboard', 'Fatura EDP Comercial Janeiro.pdf', 'energia · EDP', 'Fatura', 'Edifício Atlântico', 'EDP Comercial', '03/05/26'],
  ['stamp', 'Contrato Seguro Fidelidade 2026.pdf', 'seguro · Fidelidade', 'Contrato', 'Condomínio Boavista Center', 'Fidelidade', '17/02/26'],
  ['pencil', 'Orçamento Impermeabilização Cobertura.pdf', 'orçamento · cobertura', 'Orçamento', 'Condomínio Boavista Center', 'TelhaViva Lda.', '28/04/26'],
  ['doc', 'Relatório intervenção fuga água.pdf', 'Maria Costa · canalização · urgente', 'Relatório intervenção', 'Edifício Atlântico', 'Silva João', '17/05/26'],
  ['bank', 'Certificado Energético Foz Douro.pdf', 'SCE · A+', 'Diagnóstico legal', 'Edifício Foz Douro', '—', '19/11/25'],
  ['folder', 'Inspeção Elevador 2026 - Atlântico.pdf', 'elevador · inspeção', 'Controlo regulamentar', 'Edifício Atlântico', 'OTIS Portugal', '22/02/26'],
  ['shield', 'Apólice RC Profissional Pereira Ana.pdf', 'RC · pintor', 'Seguro / RC Pro', '—', 'Pereira Ana', '30/10/25'],
  ['construction', 'Plano de Manutenção 2026.pdf', 'plano · manutenção · 8 anos', 'Plano / Caderno', 'Edifício Foz Douro', '—', '18/01/26'],
]

const inputStyle = { width: '100%', padding: '10px 12px 10px 36px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, fontSize: 13 } as const
const searchIcon = { position: 'absolute', left: 12, top: 11, width: 14, height: 14, color: 'var(--v54-navy-300)' } as const
const selectStyle = { padding: '10px 12px', borderRadius: 8, border: '1px solid var(--v54-line-strong)', background: '#fff', color: 'var(--v54-ink)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' } as const

/** Pill kind du libellé mock (préserve le comportement byte-exact du bundle). */
const mockTipoKind = (tipo: string): PillKind => {
  if (tipo.includes('Fatura')) return 'sage'
  if (tipo.includes('Ata')) return 'gold'
  if (tipo.includes('Orçamento')) return 'amber'
  return 'rust'
}

const mockRows = (): Row[] => MOCK.map((d) => ({ id: d[1], icon: d[0], nome: d[1], sub: d[2], tipo: d[3], tipoKind: mockTipoKind(d[3]), edificio: d[4], tecnico: d[5], data: d[6] }))

const realRows = (docs: LeaDocument[]): Row[] => docs.map((d) => {
  const meta = (d.extracted_metadata ?? {}) as LeaDocMeta
  return {
    id: d.id,
    icon: docTypeIcon(d.type),
    nome: d.filename,
    sub: meta.summary_short || meta.fournisseur || docTypeLabel(d.type),
    tipo: docTypeLabel(d.type),
    tipoKind: docTypeKind(d.type),
    edificio: '—',
    tecnico: meta.fournisseur || '—',
    data: docDateShort(d.uploaded_at),
    status: d.status,
  }
})

export default function ModDocsGED() {
  const soon = useComingSoon()
  const data = useSyndicData()
  const authed = data.authenticated
  const { docs, refresh } = useLeaDocuments({ enabled: authed })
  const upload = useDocumentUpload(refresh)
  const actions = useLeaDocActions(refresh)

  const rows: Row[] = authed ? realRows(docs) : mockRows()
  const nFat = authed ? docs.filter((d) => d.type.startsWith('facture')).length : 1
  const nOrc = authed ? docs.filter((d) => d.type === 'devis').length : 1
  const nRel = authed ? docs.filter((d) => d.type === 'autre').length : 1
  const nTot = authed ? docs.length : 10

  return (
    <>
      <PageHead
        title="Documentos (GED)"
        lede="Arquivo digital de todos os documentos — pesquisa, filtros, transmissão à contabilidade"
        actions={<>
          <Button aria-label="Mudar vista para grelha" title="Vista grelha" onClick={soon('Vista em grelha')}><Icon name="grid" /></Button>
          <Button variant="gold" onClick={upload('autre')}><Icon name="plus" />Adicionar um documento</Button>
        </>}
      />
      <div style={{ fontSize: 12, color: 'var(--v54-navy-300)', marginBottom: 14 }}>GED — {nTot} documentos · {nRel} relatórios · {nFat} faturas · {nOrc} orçamentos</div>
      <KPIGrid items={[
        { icon: 'doc', num: nRel, lbl: 'Relatórios', accent: 'gold' },
        { icon: 'coin', num: nFat, lbl: 'Faturas', accent: 'sage' },
        { icon: 'pencil', num: nOrc, lbl: 'Orçamentos', accent: 'amber' },
        { icon: 'folder', num: nTot, lbl: 'Todos' },
      ]} />
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12, marginBottom: 18 }}>
        <div style={{ position: 'relative' }}>
          <Icon name="search" style={searchIcon} />
          <input aria-label="Pesquisar documento" style={inputStyle} placeholder="Pesquisar em todos os documentos, tags, nomes…" />
        </div>
        <select aria-label="Filtrar por edifício" style={selectStyle}><option>Todos os edifícios</option></select>
        <select aria-label="Filtrar por técnico" style={selectStyle}><option>Todos os técnicos</option></select>
        <select aria-label="Filtrar por tipo" style={selectStyle}><option>Todos os tipos</option></select>
      </div>
      <div style={{ fontSize: 12, color: 'var(--v54-navy-300)', marginBottom: 8 }}>{rows.length} documentos encontrados</div>
      <Panel flush={!(authed && rows.length === 0)}>
        {authed && rows.length === 0 ? (
          <Empty
            illustration="documentos"
            title="Nenhum documento"
            desc="Carregue o primeiro documento — a Léa extrai os dados (datas, valores, fornecedor) e indexa-o automaticamente para pesquisa."
            action={<Button variant="gold" onClick={upload('autre')}><Icon name="plus" />Adicionar um documento</Button>}
          />
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>Documento</th><th>Tipo</th><th>Edifício</th><th>Técnico</th><th>Data</th><th aria-label="Ações" /></tr></thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div className={m.docIconThumb} aria-hidden="true"><Icon name={d.icon} /></div>
                        <div>
                          <b>{d.nome}</b>
                          <div style={{ fontSize: 11, color: 'var(--v54-navy-300)', marginTop: 2 }}>{d.sub}</div>
                          {d.status && d.status !== 'processed' && <div style={{ marginTop: 4 }}><Pill kind={docStatusKind(d.status)} noDot>{docStatusLabel(d.status)}</Pill></div>}
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
                          <Button variant="ghost" size="sm" aria-label="Abrir documento" title="Abrir" onClick={() => actions.open(d.id)}><Icon name="eye" /></Button>{' '}
                          <Button variant="ghost" size="sm" aria-label="Eliminar documento" title="Eliminar" onClick={() => actions.askDelete({ id: d.id, filename: d.nome })}><Icon name="trash" /></Button>
                        </>
                      ) : (
                        <Button variant="ghost" size="sm" aria-label="Mais opções" title="Mais opções" onClick={soon('Opções do documento')}>⋯</Button>
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
        <ModalHead icon="trash" id="ged-del-title" title="Eliminar documento" onClose={actions.cancelDelete} />
        <ModalBody>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>Pretende eliminar definitivamente <b>{actions.pending?.filename}</b>? O ficheiro é removido do arquivo e do índice da Léa. Esta ação é irreversível.</p>
        </ModalBody>
        <ModalFoot>
          <Button variant="ghost" onClick={actions.cancelDelete}>Cancelar</Button>
          <Button variant="danger" onClick={actions.confirmDelete} disabled={actions.busy}>Eliminar</Button>
        </ModalFoot>
      </Modal>
    </>
  )
}
