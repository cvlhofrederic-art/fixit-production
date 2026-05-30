'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'

/** Orçamento Anual com IA — port byte-exact du ModOrcIA du bundle V5.7. */

const fieldLabel = { fontSize: 11, fontWeight: 600, color: 'var(--v54-navy-500)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 } as const
const fieldCtrl = { width: '100%', padding: '10px 12px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, background: '#fff', fontSize: 13, color: 'var(--v54-ink)', fontFamily: 'inherit' } as const

export default function ModOrcIA() {
  return (
    <>
      <PageHead title="Orçamento Anual com IA" lede="Geração automática baseada nos últimos 3 exercícios + tendências económicas + inflação" />
      <KPIGrid items={[
        { icon: 'doc', num: 0, lbl: 'Total Orçamentos' },
        { icon: 'pencil', num: 0, lbl: 'Rascunho', accent: 'amber' },
        { icon: 'check', num: 0, lbl: 'Proposto', accent: 'gold' },
        { icon: 'bank', num: 0, lbl: 'Aprovado AG', accent: 'sage' },
      ]} />
      <Tabs defaultActive="ger" tabs={[
        { id: 'ger', icon: 'bot', label: 'Gerador IA' },
        { id: 'hist', icon: 'chart', label: 'Histórico' },
        { id: 'cmp', icon: 'check', label: 'Comparação' },
        { id: 'apr', icon: 'check', label: 'Aprovação AG' },
      ]} />
      <Panel title="Parâmetros de Geração">
        <div className={m.cardGrid3}>
          <div><label htmlFor="orcia-ed" style={fieldLabel}>Edifício</label><select id="orcia-ed" style={fieldCtrl}><option>Nenhum edifício</option></select></div>
          <div><label htmlFor="orcia-inf" style={fieldLabel}>Taxa de inflação prevista (%)</label><input id="orcia-inf" defaultValue="3,2" style={fieldCtrl} /></div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}><Button variant="primary" style={{ width: '100%' }}><Icon name="sparkle" />Gerar Orçamento 2027</Button></div>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)', marginTop: 10 }}>O algoritmo analisa os últimos 3 exercícios contabilísticos, aplica médias ponderadas, deteta tendências de crescimento/redução por categoria, e ajusta pela inflação prevista. O fundo de reserva é automaticamente calculado ao mínimo legal de 10% (DL 268/94).</div>
      </Panel>
      <Panel>
        <Empty illustration="faturas" title="Gere o seu primeiro orçamento com IA" desc={'Selecione um edifício, defina a inflação prevista e clique em "Gerar"'} />
      </Panel>
    </>
  )
}
