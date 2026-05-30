'use client'

import { PageHead } from '../primitives/page-head'
import { KPI } from '../primitives/kpi'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import kpiCss from '../primitives/kpi/KPI.module.css'
import m from './modules.module.css'

/** Pontuação de Saúde dos Edifícios — port byte-exact du ModPontuacao du bundle V5.7.
 * Note : le bundle utilise icon="trophy" (absent du jeu d'icônes) → fallback `doc`
 * (`paths[name] || paths.doc`). On passe donc icon="doc" pour un rendu byte-exact. */

const numStyle = { fontFamily: 'var(--v54-font-serif)', fontSize: 24, color: 'var(--v54-navy-300)', fontWeight: 500 } as const

export default function ModPontuacao() {
  return (
    <>
      <PageHead title="Pontuação de Saúde dos Edifícios" lede="Avaliação IA baseada em estado técnico, finanças, conformidade, satisfação e energia"
        actions={<><Button variant="primary"><Icon name="chart" />Detalhes</Button><Button><Icon name="grad" />Ranking</Button><Button variant="gold"><Icon name="sparkle" />Atualizar</Button></>} />
      <div className={kpiCss.kpiGrid}>
        <div className={kpiCss.kpi} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
            <svg viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="40" cy="40" r="34" stroke="var(--v54-cream)" strokeWidth="8" fill="none" />
              <circle cx="40" cy="40" r="34" stroke="var(--v54-rust-500)" strokeWidth="8" fill="none" strokeDasharray="0 213" />
            </svg>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontFamily: 'var(--v54-font-serif)', fontSize: 30, color: 'var(--v54-rust-700)', fontWeight: 600 }}>F</div>
          </div>
          <div><div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 28 }}>0/100</div><div className={kpiCss.lbl}>Pontuação Média</div><div className={kpiCss.sub}>0 edifício(s)</div></div>
        </div>
        <KPI icon="doc" num="—" numStyle={numStyle} lbl="Melhor Edifício" />
        <KPI icon="alert" num="—" numStyle={numStyle} lbl="Pior Edifício" />
        <KPI icon="bell" num={0} lbl="Alertas Ativos" accent="sage" sub="Tudo em ordem!" />
      </div>
      <Panel title="EDIFÍCIOS">
        <div className={m.cardGrid}>
          <Empty illustration="condominos" title="Nenhum edifício" />
          <Empty illustration="dados" desc="Selecione um edifício para ver a análise completa" />
        </div>
      </Panel>
    </>
  )
}
