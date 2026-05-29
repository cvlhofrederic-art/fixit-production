'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import m from './modules.module.css'

/** Predição de Manutenção — port byte-exact du ModPredicao du bundle V5.7. */

const RISK = [
  ['Crítico (>80%)', 'rust'],
  ['Atenção (60-80%)', 'amber'],
  ['Moderado (40-60%)', 'gold'],
  ['Bom (<40%)', 'sage'],
] as const

export default function ModPredicao() {
  return (
    <>
      <PageHead title="Predição de Manutenção" lede="Machine Learning preditivo · Score de risco por equipamento · Timeline de intervenções" />
      <KPIGrid items={[
        { icon: 'cog', num: 0, lbl: 'Equipamentos' },
        { icon: 'alert', num: 0, lbl: 'Críticos', accent: 'rust' },
        { icon: 'chart', num: 0, lbl: 'Em degradação', accent: 'amber' },
        { icon: 'target', num: '0%', lbl: 'Score médio risco', accent: 'sage' },
        { icon: 'coin', num: '0 €', lbl: 'Custo previsto total', accent: 'gold' },
      ]} />
      <Tabs defaultActive="dash" tabs={[
        { id: 'dash', icon: 'chart', label: 'Dashboard' },
        { id: 'eq', icon: 'wrench', label: 'Equipamentos' },
        { id: 'tl', icon: 'calendar', label: 'Timeline' },
        { id: 'al', icon: 'bell', label: 'Alertas (0)' },
      ]} />
      <Panel title="Distribuição de Risco">
        <div className={m.cardGrid4}>
          {RISK.map((c) => (
            <div key={c[0]} style={{ textAlign: 'center', padding: 24, borderRadius: 12, background: `var(--v54-${c[1]}-50)`, color: `var(--v54-${c[1]}-700)` }}>
              <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 42 }}>0</div>
              <div style={{ fontSize: 12.5 }}>{c[0]}</div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Risco por Edifício">
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--v54-navy-300)' }}>Selecione um edifício para ver o risco</div>
      </Panel>
    </>
  )
}
