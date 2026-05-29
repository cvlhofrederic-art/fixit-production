'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Pill } from '../primitives/pill'
import { Progress } from '../primitives/progress'
import m from './modules.module.css'

/** Pagamentos Digitais — port byte-exact du ModPagDigitais du bundle V5.7. */

const PAYMENTS = [
  ['Ana Silva', 'A-1.°Esq', '185,00 €', 'Multibanco', '10/03/2026'],
  ['Carlos Mendes', 'B-2.°Dto', '210,50 €', 'MB Way', '09/03/2026'],
  ['Beatriz Costa', 'A-R/C', '150,00 €', 'Transferência', '08/03/2026'],
  ['Diogo Ferreira', 'C-3.°Esq', '195,75 €', 'Débito Direto', '07/03/2026'],
] as const

export default function ModPagDigitais() {
  return (
    <>
      <PageHead title="Pagamentos Digitais" lede="Gestão de cobranças, referências Multibanco e reconciliação bancária" />
      <Tabs defaultActive="dash" tabs={[
        { id: 'dash', icon: 'chart', label: 'Dashboard' },
        { id: 'mb', icon: 'coin', label: 'Referências MB' },
        { id: 'rec', icon: 'refresh', label: 'Reconciliação' },
        { id: 'cfg', icon: 'cog', label: 'Configuração' },
      ]} />
      <KPIGrid items={[
        { icon: 'coin', num: '0,00 €', lbl: 'Total cobrado este mês', accent: 'gold' },
        { icon: 'clock', num: '4', lbl: 'Pagamentos pendentes', sub: '765,75 €', accent: 'amber' },
        { icon: 'chart', num: '0.0%', lbl: 'Taxa de cobrança', accent: 'sage' },
        { icon: 'calendar', num: '98', lbl: 'Atraso médio (dias)' },
      ]} />
      <Panel title="Cobrado vs Pendente">
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}><span>Cobrado</span><b>0,00 €</b></div>
        <Progress pct={0} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, marginTop: 14 }}><span>Pendente</span><b>765,75 €</b></div>
        <Progress pct={100} kind="amber" />
      </Panel>
      <Panel title="Últimos 10 pagamentos recebidos" flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>Condómino</th><th>Fração</th><th>Valor</th><th>Método</th><th>Data</th></tr></thead>
            <tbody>
              {PAYMENTS.map((r) => (
                <tr key={r[0]}>
                  <td><b>{r[0]}</b></td>
                  <td>{r[1]}</td>
                  <td className={m.numCell} style={{ color: 'var(--v54-gold-700)', fontWeight: 600 }}>{r[2]}</td>
                  <td><Pill noDot>{r[3]}</Pill></td>
                  <td className={m.numCell}>{r[4]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
