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

/** Acessibilidade dos Edifícios — port byte-exact du ModAcessibilidade du bundle V5.7. */

type Cor = 'sage' | 'gold' | 'amber' | 'rust'
const CRITERIOS: [string, string, Cor][] = [
  ['Rampas exteriores (inclinação ≤ 6%)', 'Acessos ao edifício', 'sage'],
  ['Largura portas (≥ 0.77m)', 'Entrada + frações', 'sage'],
  ['Elevador acessível', 'Cabine ≥ 1.10×1.40m', 'gold'],
  ['Casa de banho adaptada', 'Partes comuns', 'amber'],
  ['Sinalética tátil', 'Botoneira + andares', 'sage'],
  ['Percurso acessível contínuo', 'Sem obstáculos', 'gold'],
]

export default function ModAcessibilidade() {
  return (
    <>
      <PageHead eyebrow="OBRIGAÇÃO LEGAL · DL 163/2006" title="Acessibilidade dos Edifícios"
        lede="Checklist 23 critérios · Análise IA fotografias por Alfredo · Plano de conformidade · Atestação PDF"
        actions={<><Button><Icon name="upload" />Upload fotos do edifício</Button><Button variant="gold"><Icon name="bot" />Análise IA Alfredo</Button></>} />
      <Alert kind="gold" icon="scale" title="Decreto-Lei n.° 163/2006 de 8 de agosto">
        Todos os edifícios construídos ou objeto de reabilitação após 22 de agosto de 2007 devem cumprir as normas técnicas de acessibilidade. O administrador deve poder atestar a conformidade ou apresentar plano de correção.
      </Alert>
      <KPIGrid items={[
        { icon: 'building', num: 0, lbl: 'Edifícios avaliados', accent: 'gold' },
        { icon: 'check', num: 0, lbl: 'Conformes', accent: 'sage' },
        { icon: 'alert', num: 0, lbl: 'Não conformes', accent: 'rust' },
        { icon: 'construction', num: 0, lbl: 'Em plano correção', accent: 'amber' },
        { icon: 'coin', num: '0,00 €', lbl: 'Investimento estimado' },
        { icon: 'bot', num: 0, lbl: 'Diagnósticos IA Alfredo', accent: 'sage' },
      ]} />
      <Tabs defaultActive="ed" tabs={[
        { id: 'ed', icon: 'building', label: 'Edifícios (0)' },
        { id: 'chk', icon: 'clipboard', label: 'Checklist 23 critérios' },
        { id: 'plano', icon: 'construction', label: 'Planos de correção' },
      ]} />
      <Panel>
        <Empty illustration="condominos" title="Nenhum edifício avaliado"
          desc="Faça upload de fotografias e plantas. Alfredo deteta automaticamente: rampas, larguras de portas, casas de banho adaptadas, sinalética, percursos acessíveis."
          action={<Button variant="primary"><Icon name="bot" />Iniciar avaliação IA</Button>} />
      </Panel>
      <Panel title="Critérios DL 163/2006 — Edifícios Habitacionais">
        <div className={m.cardGrid3}>
          {CRITERIOS.map(([t, s, c], i) => (
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
