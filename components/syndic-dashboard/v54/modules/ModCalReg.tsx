'use client'

import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Panel } from '../primitives/panel'
import { Pill } from '../primitives/pill'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'

/** Calendário Regulamentar — port byte-exact du ModCalReg du bundle V5.7 (table + estados). */

const ITEMS = [
  ['Edifício Foz Douro', 'Assembleia Geral', 'AG Anual', '15/04/26', 'Há 39d', 'rust'],
  ['Edifício Foz Douro', 'Inspeção elevador', 'Inspeção 2 anos elevador', '30/04/26', 'Há 24d', 'rust'],
  ['Residencial Cedofeita', 'Renovação seguro', 'Renovação seguro condomínio', '30/06/26', 'Dentro de 37d', 'amber'],
  ['Condomínio Boavista Center', 'Inspeção gás', 'Inspeção 5 anos gás', '20/07/26', 'Dentro de 57d', 'amber'],
  ['Residencial Cedofeita', 'Verificação elétrica', 'Verificação instalação elétrica', '10/08/26', 'Dentro de 78d', 'amber'],
  ['Edifício Atlântico', 'Inspeção elevador', 'Inspeção 6 anos elevador', '15/09/26', 'Dentro de 114d', 'sage'],
  ['Edifício Atlântico', 'Assembleia Geral', 'AG Anual obrigatória', '31/03/27', 'Dentro de 311d', 'sage'],
  ['Condomínio Boavista Center', 'Manutenção fachada', 'Manutenção fachada (8 anos)', '30/05/27', 'Dentro de 371d', 'sage'],
] as const

const selectStyle = { padding: '10px 12px', borderRadius: 8, border: '1px solid var(--v54-line-strong)', background: '#fff', color: 'var(--v54-ink)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' } as const

export default function ModCalReg() {
  return (
    <>
      <PageHead
        title="Calendário Regulamentar"
        lede="Acompanhamento das obrigações legais e regulamentares"
        actions={<>
          <select aria-label="Filtrar por edifício" style={selectStyle}><option>Todos os edifícios</option></select>
          <select aria-label="Filtrar por estado" style={selectStyle}><option>Todos os estados</option></select>
          <Button variant="gold"><Icon name="plus" />Adicionar</Button>
        </>}
      />
      <KPIGrid items={[
        { dot: 'rust', accent: 'rust', num: 2, lbl: 'Expirados' },
        { dot: 'amber', accent: 'amber', num: 0, lbl: 'Urgentes (< 30d)' },
        { dot: 'gold', accent: 'amber', num: 3, lbl: 'Próximos (< 90d)' },
        { dot: 'sage', accent: 'sage', num: 3, lbl: 'Em dia' },
      ]} />
      <Panel flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>Edifício</th><th>Tipo</th><th>Descrição</th><th>Prazo</th><th>Estado</th></tr></thead>
            <tbody>
              {ITEMS.map((r) => (
                <tr key={`${r[0]}-${r[2]}`}>
                  <td>{r[0]}</td>
                  <td><Pill kind="gold" noDot>{r[1]}</Pill></td>
                  <td>{r[2]}</td>
                  <td>
                    <div className={m.numCell}>{r[3]}</div>
                    <div style={{ fontSize: 11, color: r[5] === 'rust' ? 'var(--v54-rust-700)' : 'var(--v54-navy-300)' }}>{r[4]}</div>
                  </td>
                  <td><span className={clsx(m.dotStatus, r[5] === 'rust' && m.dotStatusRust, r[5] === 'amber' && m.dotStatusAmber)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
