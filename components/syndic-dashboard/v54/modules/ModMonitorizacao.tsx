'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Pill } from '../primitives/pill'
import m from './modules.module.css'

/** Monitorização de Consumos — port byte-exact du ModMonitorizacao du bundle V5.7. */

const MESES = ['Dez', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai']
const charts: [string, string, number[]][] = [
  ['Eletricidade (kWh) — Últimos 6 meses', 'var(--v54-amber-500)', [120, 135, 108, 112, 140, 150]],
  ['Água (m³) — Últimos 6 meses', 'var(--v54-navy-900)', [58, 42, 50, 35, 42, 30]],
  ['Gás (m³) — Últimos 6 meses', 'var(--v54-rust-500)', [280, 255, 242, 205, 232, 165]],
]
const swatch = (bg: string) => ({ width: 10, height: 10, background: bg, display: 'inline-block', borderRadius: 2, marginRight: 4 } as const)

export default function ModMonitorizacao() {
  return (
    <>
      <PageHead title="Monitorização de Consumos" lede="Eletricidade, água e gás — leituras, custos e alertas" />
      <Tabs defaultActive="dash" tabs={[
        { id: 'dash', icon: 'chart', label: 'Dashboard' },
        { id: 'cons', icon: 'lightning', label: 'Consumos' },
        { id: 'al', icon: 'bell', label: 'Alertas', badge: 2 },
        { id: 'cfg', icon: 'cog', label: 'Configuração' },
      ]} />
      <KPIGrid items={[
        { icon: 'bolt', num: '1252 kWh', lbl: 'Eletricidade', sub: 'vs. mês anterior', accent: 'amber', trend: { kind: 'ok', label: '-3.1%' } },
        { icon: 'droplet', num: '33 m³', lbl: 'Água', sub: 'vs. mês anterior', accent: 'sage', trend: { kind: 'ok', label: '-31.3%' } },
        { icon: 'flame', num: '265 m³', lbl: 'Gás', sub: 'vs. mês anterior', accent: 'rust', trend: { kind: 'bad', label: '+31.8%' } },
        { icon: 'coin', num: '368,28 €', lbl: 'Custo total', sub: 'vs. mês anterior', accent: 'gold', trend: { kind: 'ok', label: '-18.6%' } },
      ]} />
      <div className={m.cardGrid3}>
        {charts.map((c, i) => (
          <Panel key={i} title={c[0]}>
            <svg viewBox="0 0 240 140" style={{ width: '100%', height: 140 }}>
              {c[2].map((v, j) => <rect key={j} x={20 + j * 35} y={130 - v * 0.6} width="22" height={v * 0.6} rx="3" fill={c[1]} opacity={0.85} />)}
              <g fontSize="10" fill="var(--v54-navy-300)" fontFamily="var(--v54-font-mono)">
                {MESES.map((mes, j) => <text key={j} x={20 + j * 35 + 11} y="138" textAnchor="middle">{mes}</text>)}
              </g>
            </svg>
            <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: 'var(--v54-navy-500)', marginTop: 6 }}>
              <span><span style={swatch(c[1])}></span>Ano atual</span>
              <span><span style={swatch('var(--v54-navy-100)')}></span>Ano anterior</span>
            </div>
          </Panel>
        ))}
      </div>
      <Panel title="Alertas ativos (2)" right={<Pill kind="amber" noDot>2 ativos</Pill>}>
        <div style={{ padding: '14px 0', borderBottom: '1px solid var(--v54-line)', borderLeft: '3px solid var(--v54-amber-500)', paddingLeft: 14, marginBottom: 8 }}><b>● Consumo de água 28% acima da média dos últimos 3 meses</b> <span style={{ marginLeft: 8 }}><Pill kind="amber" noDot>Aviso</Pill></span></div>
        <div style={{ paddingLeft: 14, borderLeft: '3px solid var(--v54-sage-500)' }}><b>● Custo mensal de eletricidade atingiu 85% do limite orçamental</b> <span style={{ marginLeft: 8 }}><Pill kind="sage" noDot>Info</Pill></span></div>
      </Panel>
    </>
  )
}
