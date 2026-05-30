'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Alert } from '../primitives/alert'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'

/** Segurança Contra Incêndio — port byte-exact du ModSegEdificio du bundle V5.7. */

type Cor = 'sage' | 'gold' | 'amber' | 'rust'
const CATEGORIAS: [string, string, Cor][] = [
  ['Categoria 1 — Reduzido', 'Altura ≤ 9m · até 100 ocupantes', 'sage'],
  ['Categoria 2 — Moderado', 'Altura ≤ 28m · até 500 ocupantes', 'sage'],
  ['Categoria 3 — Elevado', 'Altura ≤ 50m · até 1500 ocupantes', 'amber'],
  ['Categoria 4 — Muito Elevado', 'Altura > 50m · > 1500 ocupantes', 'rust'],
]

export default function ModSegEdificio() {
  return (
    <>
      <PageHead eyebrow="OBRIGAÇÃO LEGAL · DL 220/2008 (RSCIE) + PORTARIA 1532/2008" title="Segurança Contra Incêndio"
        lede="Classificação UT 1-12 · Categoria risco 1/2/3/4 · Encarregado de Segurança · Plano emergência · Exercícios"
        actions={<><Button><Icon name="building" />Classificar edifício</Button><Button variant="gold"><Icon name="bot" />Gerar plano emergência (Alfredo)</Button></>} />
      <Alert kind="gold" icon="scale" title="Regime Jurídico de Segurança Contra Incêndio">
        Todos os edifícios habitacionais (UT I) com altura &gt; 9m ou &gt; 9 pisos = <strong>categoria risco 3 ou 4</strong>. Obrigam <strong>Encarregado de Segurança</strong> designado + plano emergência + exercícios de evacuação anuais.
      </Alert>
      <KPIGrid items={[
        { icon: 'building', num: 0, lbl: 'Edifícios classificados' },
        { icon: 'shield', num: 0, lbl: 'Encarregados designados', accent: 'sage' },
        { icon: 'doc', num: 0, lbl: 'Planos emergência gerados IA', accent: 'gold' },
        { icon: 'check', num: 0, lbl: 'Exercícios realizados (12m)', accent: 'sage' },
        { icon: 'alert', num: 0, lbl: 'Categoria 4 (risco elevado)', accent: 'rust' },
        { icon: 'clock', num: 0, lbl: 'Exercícios em atraso', accent: 'amber' },
      ]} />
      <Tabs defaultActive="ed" tabs={[
        { id: 'ed', icon: 'building', label: 'Edifícios (0)' },
        { id: 'enc', icon: 'team', label: 'Encarregados (0)' },
        { id: 'plano', icon: 'doc', label: 'Planos emergência (0)' },
        { id: 'ex', icon: 'check', label: 'Exercícios' },
      ]} />
      <Panel>
        <Empty illustration="seguros" title="Nenhum edifício classificado"
          desc="Alfredo classifica automaticamente segundo RT-SCIE (utilização-tipo + altura + densidade) e gera plano de emergência 70%-pronto à medida."
          action={<Button variant="primary"><Icon name="building" />Classificar primeiro edifício</Button>} />
      </Panel>
      <Panel title="Categorias de Risco RT-SCIE">
        <div className={m.cardGrid}>
          {CATEGORIAS.map(([t, s, c], i) => (
            <div key={i} style={{ padding: 14, border: '1px solid var(--v54-line)', borderRadius: 10, background: `var(--v54-${c}-50)`, borderLeft: `3px solid var(--v54-${c}-500)` }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{t}</div>
              <div style={{ fontSize: 11.5, color: 'var(--v54-navy-400)' }}>{s}</div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
