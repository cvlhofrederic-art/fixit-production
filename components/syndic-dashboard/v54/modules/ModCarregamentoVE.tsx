'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Pill } from '../primitives/pill'
import { Progress } from '../primitives/progress'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'
import { useComingSoon } from './use-coming-soon'

/** Carregamento de Veículos Elétricos — port byte-exact du ModCarregamentoVE du bundle V5.7. */

const REQUESTS = [
  ['Carlos Ferreira', 'Fração B - 1.° Esq. · Garagem -1, Lugar 12 · 7.4 kW', 'Em Análise', 'Uso Exclusivo', 'Comunicação: 15/02/2026', 'Prazo decisão: 16/04/2026 (Expirado!)', 75, 'rust'],
  ['Ana Rodrigues', 'Fração D - 3.° Dto. · Garagem -1, Lugar 28 · 11 kW', 'Aprovado', 'Uso Exclusivo', 'Comunicação: 10/01/2026', 'Decisão: 20/02/2026', 100, 'sage'],
  ['Miguel Santos', 'Fração A - R/C · Garagem -2, Lugar 5 · 22 kW', 'Pendente', 'Uso Partilhado', 'Comunicação: 01/03/2026', 'Prazo decisão: 30/04/2026 (Expirado!)', 50, 'amber'],
] as const

export default function ModCarregamentoVE() {
  const soon = useComingSoon()
  return (
    <>
      <PageHead title="Carregamento de Veículos Elétricos" lede="Gestão de infraestrutura VE em condomínios · DL 101-D/2020 · Art.° 59.°-A" />
      <KPIGrid items={[
        { icon: 'doc', num: 2, lbl: 'Pedidos Ativos', accent: 'rust' },
        { icon: 'check', num: 1, lbl: 'Aprovados', accent: 'sage' },
        { icon: 'bolt', num: 2, lbl: 'Postos Ativos', accent: 'rust' },
        { icon: 'bolt', num: '18,40 kW', lbl: 'Potência Total', accent: 'gold' },
        { icon: 'chart', num: '2315 kWh', lbl: 'Consumo Total', accent: 'gold' },
        { icon: 'coin', num: '463,00 €', lbl: 'Custo Total', accent: 'rust' },
      ]} />
      <Tabs defaultActive="ped" tabs={[
        { id: 'ped', icon: 'clipboard', label: 'Pedidos' },
        { id: 'inst', icon: 'outlet', label: 'Postos Instalados' },
        { id: 'leg', icon: 'scale', label: 'Legislação' },
        { id: 'inc', icon: 'coin', label: 'Incentivos' },
      ]} />
      <Button variant="primary" style={{ marginBottom: 14 }} onClick={soon('Registar pedido', 'Gestão de carregamento VE em desenvolvimento')}><Icon name="plus" />+ Registar Novo Pedido</Button>
      {REQUESTS.map((p) => (
        <div key={p[0]} className={m.card} style={{ padding: 22, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <b style={{ fontSize: 15 }}>{p[0]}</b>
                <Pill kind={p[7]} noDot>{p[2]}</Pill><Pill noDot>{p[3]}</Pill>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--v54-navy-500)' }}>{p[1]}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {p[2] === 'Pendente' && <Button variant="primary" size="sm" onClick={soon('Analisar pedido')}>Analisar</Button>}
              <Button variant="ghost" size="sm" aria-label="Mais ações" title="Mais ações" onClick={soon('Mais ações')}><Icon name="download" /></Button>
            </div>
          </div>
          <div style={{ margin: '14px 0 6px' }}><Progress pct={p[6]} kind={p[7]} /></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--v54-navy-300)' }}>
            <span>{p[4]}</span><span style={{ color: p[5].includes('Expirado') ? 'var(--v54-rust-700)' : 'inherit' }}>{p[5]}</span>
          </div>
        </div>
      ))}
    </>
  )
}
