'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Pill } from '../primitives/pill'
import m from './modules.module.css'

/** Comparador de Tarifas de Energia Coletiva — port byte-exact du ModComparadorEnergia du bundle V5.7. */

const BUILDINGS = [
  ['Edifício Aurora', 'B', 'Classe B', 'Tri-Horário', 1075, 196.25, 'EDP Comercial', '6.9 kVA', 140.04],
  ['Edifício Belém', 'C', 'Classe C', 'Bi-Horário', 1737, 295.55, 'Galp Energia', '10.35 kVA', 163.0],
  ['Edifício Cascais', 'D', 'Classe D', 'Simples', 1738, 295.7, 'Endesa', '13.8 kVA', 197.36],
  ['Edifício Douro', 'B-', 'Classe B-', 'Tri-Horário', 1857, 313.55, 'EDP Comercial', '6.9 kVA', 225.91],
] as const

const classColor = (cls: string): string =>
  cls === 'B' || cls === 'B-' ? 'var(--v54-sage-500)' : cls === 'C' ? 'var(--v54-amber-500)' : 'var(--v54-rust-500)'

export default function ModComparadorEnergia() {
  return (
    <>
      <PageHead
        title="Comparador de Tarifas de Energia Coletiva"
        lede="Analise, compare e otimize os custos energéticos dos seus edifícios"
        actions={<Pill kind="gold" noDot>ERSE 2024 - Mercado Liberalizado</Pill>}
      />
      <KPIGrid items={[
        { icon: 'building', num: 4, lbl: 'Total edifícios' },
        { icon: 'coin', num: '275,26 €', lbl: 'Custo médio mensal', accent: 'gold' },
        { icon: 'chart', num: '726,31 €', lbl: 'Poupança potencial/ano', accent: 'sage' },
        { icon: 'bolt', num: 'C', lbl: 'Classe energética média' },
      ]} />
      <Tabs defaultActive="dash" tabs={[
        { id: 'dash', icon: 'chart', label: 'Dashboard' },
        { id: 'cmp', icon: 'scale', label: 'Comparar Tarifas' },
        { id: 'sim', label: 'Simulação' },
        { id: 'hist', icon: 'stamp', label: 'Histórico' },
      ]} />
      <Panel title="Perfil Energético por Edifício">
        <div className={m.cardGrid3}>
          {BUILDINGS.map((b) => (
            <div key={b[0]} className={m.card} style={{ padding: 22, position: 'relative' }}>
              <div style={{ position: 'absolute', top: 18, right: 18, width: 34, height: 34, borderRadius: 8, background: classColor(b[1]), color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 14 }}>{b[1]}</div>
              <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 22, fontWeight: 500, marginBottom: 6 }}>{b[0]}</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}><Pill kind="sage" noDot>{b[2]}</Pill><Pill noDot>{b[3]}</Pill></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                <div><div style={{ fontSize: 11, color: 'var(--v54-navy-300)' }}>Consumo mensal</div><div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 20, fontWeight: 600 }}>{b[4]} <span style={{ fontSize: 14 }}>kWh</span></div></div>
                <div><div style={{ fontSize: 11, color: 'var(--v54-navy-300)' }}>Custo médio</div><div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 20, fontWeight: 600, color: 'var(--v54-gold-700)' }}>{b[5]} €</div></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11.5, marginBottom: 14 }}>
                <div><div style={{ color: 'var(--v54-navy-300)' }}>Fornecedor atual</div><b>{b[6]}</b></div>
                <div style={{ textAlign: 'right' }}><div style={{ color: 'var(--v54-navy-300)' }}>Potência</div><b>{b[7]}</b></div>
              </div>
              <div style={{ padding: '10px 14px', background: 'var(--v54-sage-50)', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--v54-sage-700)', marginBottom: 2 }}>Poupança potencial</div>
                <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 20, color: 'var(--v54-sage-700)', fontWeight: 600 }}>{b[8]} <span style={{ fontSize: 13 }}>€/ano</span></div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
