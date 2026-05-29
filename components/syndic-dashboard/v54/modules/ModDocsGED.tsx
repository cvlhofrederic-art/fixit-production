'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Panel } from '../primitives/panel'
import { Pill, type PillKind } from '../primitives/pill'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import m from './modules.module.css'

/** Documentos (GED) — port byte-exact du ModDocsGED du bundle V5.7 (table + vignettes). */

const DOCS: readonly (readonly [IconName, string, string, string, string, string, string])[] = [
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

const tipoKind = (tipo: string): PillKind => {
  if (tipo.includes('Fatura')) return 'sage'
  if (tipo.includes('Ata')) return 'gold'
  if (tipo.includes('Orçamento')) return 'amber'
  return 'rust'
}

export default function ModDocsGED() {
  return (
    <>
      <PageHead
        title="Documentos (GED)"
        lede="Arquivo digital de todos os documentos — pesquisa, filtros, transmissão à contabilidade"
        actions={<>
          <Button aria-label="Mudar vista para grelha" title="Vista grelha"><Icon name="grid" /></Button>
          <Button variant="gold"><Icon name="plus" />Adicionar um documento</Button>
        </>}
      />
      <div style={{ fontSize: 12, color: 'var(--v54-navy-300)', marginBottom: 14 }}>GED — 10 documentos · 1 relatórios · 1 faturas · 1 orçamentos</div>
      <KPIGrid items={[
        { icon: 'doc', num: 1, lbl: 'Relatórios', accent: 'gold' },
        { icon: 'coin', num: 1, lbl: 'Faturas', accent: 'sage' },
        { icon: 'pencil', num: 1, lbl: 'Orçamentos', accent: 'amber' },
        { icon: 'folder', num: 10, lbl: 'Todos' },
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
      <div style={{ fontSize: 12, color: 'var(--v54-navy-300)', marginBottom: 8 }}>{DOCS.length} documentos encontrados</div>
      <Panel flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>Documento</th><th>Tipo</th><th>Edifício</th><th>Técnico</th><th>Data</th><th aria-label="Ações" /></tr></thead>
            <tbody>
              {DOCS.map((d) => (
                <tr key={d[1]}>
                  <td>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div className={m.docIconThumb} aria-hidden="true"><Icon name={d[0]} /></div>
                      <div><b>{d[1]}</b><div style={{ fontSize: 11, color: 'var(--v54-navy-300)', marginTop: 2 }}>{d[2]}</div></div>
                    </div>
                  </td>
                  <td><Pill kind={tipoKind(d[3])} noDot>{d[3]}</Pill></td>
                  <td>{d[4]}</td>
                  <td>{d[5]}</td>
                  <td className={m.numCell}>{d[6]}</td>
                  <td style={{ textAlign: 'right' }}><Button variant="ghost" size="sm" aria-label="Mais opções" title="Mais opções">⋯</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
