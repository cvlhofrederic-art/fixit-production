'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Panel } from '../primitives/panel'
import { Pill, type PillKind } from '../primitives/pill'
import m from './modules.module.css'

/** Contabilidade Técnica — port byte-exact du ModContabTec du bundle V5.7 (tables). */

const INTERV = [
  ['22/05/2026', 'Edifício Foz Douro', 'Canalização', 'Bruno Tavares', 'normal', 'em espera', '—'],
  ['20/05/2026', 'Condomínio Boavista Center', 'Coordenação de obras', 'Bruno Tavares', 'normal', 'em curso', '—'],
  ['12/04/2026', 'Residencial Cedofeita', 'Inspeção técnica', 'Bruno Tavares', 'normal', 'concluída', '—'],
  ['18/05/2026', 'Condomínio Boavista Center', 'Pequenas reparações', 'Diogo Pereira', 'normal', 'em espera', '—'],
  ['29/04/2026', 'Edifício Atlântico', 'Manutenção corrente', 'Diogo Pereira', 'normal', 'concluída', '—'],
  ['17/05/2026', 'Edifício Atlântico', 'Pequenas reparações', 'Diogo Pereira', 'urgente', 'em curso', '—'],
  ['19/05/2026', 'Edifício Atlântico', 'Vistoria técnica', 'Bruno Tavares', 'normal', 'em curso', '—'],
  ['16/05/2026', 'Edifício Foz Douro', 'Pequenas reparações', 'Tiago Mendes', 'normal', 'em curso', '—'],
  ['—', 'Edifício Foz Douro', 'Manutenção corrente', '—', 'normal', 'em espera', '—'],
  ['—', 'Edifício Foz Douro', 'Eletricidade', '—', 'normal', 'em espera', '—'],
  ['—', 'Residencial Cedofeita', 'Construção', '—', 'normal', 'em espera', '—'],
  ['21/05/2026', 'Residencial Cedofeita', 'Manutenção corrente', 'Tiago Mendes', 'normal', 'em espera', '—'],
] as const

const BY_PRO = [
  ['Bruno Tavares', 4, '0 €', '0 €'],
  ['Diogo Pereira', 3, '0 €', '0 €'],
  ['Tiago Mendes', 2, '0 €', '0 €'],
  ['Por atribuir', 3, '0 €', '0 €'],
] as const

const selectStyle = { padding: '10px 12px', borderRadius: 8, border: '1px solid var(--v54-line-strong)', background: '#fff', color: 'var(--v54-ink)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' } as const

const prioKind = (p: string): PillKind | undefined => (p === 'urgente' ? 'rust' : undefined)
const estadoKind = (s: string): PillKind => (s === 'concluída' || s === 'em curso' ? 'sage' : 'amber')

export default function ModContabTec() {
  return (
    <>
      <PageHead title="Contabilidade Técnica" lede="Acompanhamento das intervenções por profissional, condomínio e período" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 18 }}>
        <select aria-label="Filtrar por profissional" style={selectStyle}><option>Todos os profissionais</option></select>
        <select aria-label="Filtrar por edifício" style={selectStyle}><option>Todos os edifícios</option></select>
        <select aria-label="Filtrar por estado" style={selectStyle}><option>Todos os estados</option></select>
        <select aria-label="Filtrar por período" style={selectStyle}><option>Todo o período</option></select>
      </div>
      <KPIGrid items={[
        { icon: 'clipboard', num: 12, lbl: 'Intervenções' },
        { icon: 'check', num: 2, lbl: 'Concluídas', accent: 'sage' },
        { icon: 'cog', num: 4, lbl: 'Em curso', accent: 'amber' },
        { icon: 'coin', num: '0', cur: '€', lbl: 'Montante total', accent: 'gold' },
      ]} />
      <Panel title="Por profissional" flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>Profissional</th><th>Missões</th><th>Montante</th><th>Méd./missão</th></tr></thead>
            <tbody>
              {BY_PRO.map((p) => (
                <tr key={p[0]}><td><b>{p[0]}</b></td><td>{p[1]}</td><td>{p[2]}</td><td>{p[3]}</td></tr>
              ))}
              <tr style={{ background: 'var(--v54-cream)' }}>
                <td><b>TOTAL</b></td><td><b>12</b></td><td><b style={{ color: 'var(--v54-gold-700)' }}>0 €</b></td><td><b>0 €</b></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Detalhe das intervenções (12)" flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>Data</th><th>Edifício</th><th>Tipo</th><th>Profissional</th><th>Prioridade</th><th>Estado</th><th>Montante</th></tr></thead>
            <tbody>
              {INTERV.map((r, i) => (
                <tr key={`${r[0]}-${r[1]}-${r[2]}-${i}`}>
                  <td className={m.numCell}>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td>
                  <td><Pill kind={prioKind(r[4])} noDot>{r[4]}</Pill></td>
                  <td><Pill kind={estadoKind(r[5])} noDot>{r[5]}</Pill></td>
                  <td className={m.numCell}>{r[6]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
