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

/** Contratos com Prestadores — port byte-exact du ModContratos du bundle V5.7. */

type Cor = 'sage' | 'gold' | 'amber' | 'rust'
const LIFECYCLE: [string, string, Cor][] = [
  ['Upload PDF', 'Léa OCR · 30 segundos · ficha 90% pronta', 'sage'],
  ['Tracking ativo', 'Custo mensal · indexações · próxima revisão', 'gold'],
  ['Alerta J-90', 'Tempo notifica · revisão satisfação prestador', 'amber'],
  ['Workflow J-60', 'Auto-dispara 3 Orçamentos · concorrência', 'gold'],
  ['Decisão J-30', 'Renovar · trocar · negociar', 'amber'],
  ['Renovação/Substituição', 'Update auto · histórico preservado', 'sage'],
]

export default function ModContratos() {
  return (
    <>
      <PageHead eyebrow="GESTÃO OPERACIONAL · CENTRALIZADO" title="Contratos com Prestadores"
        lede="Limpezas · Elevadores · Segurança · Jardim · Dedetização · Alertas renovação J-90/60/30 · 3 Orçamentos auto"
        actions={<><Button><Icon name="upload" />Upload contrato PDF (Léa)</Button><Button variant="gold"><Icon name="plus" />+ Novo contrato</Button></>} />
      <Alert kind="sage" icon="check" title="Tempo + Léa = renovações nunca esquecidas">
        Léa extrai datas/valores/partes dos PDFs em segundos. Tempo agenda alertas J-90 · J-60 · J-30 antes do término. A J-60 auto-dispara workflow <strong>3 Orçamentos</strong> para re-concorrência.
      </Alert>
      <KPIGrid items={[
        { icon: 'handshake', num: 0, lbl: 'Contratos ativos', accent: 'gold' },
        { icon: 'clock', num: 0, lbl: 'A renovar (≤ 90 dias)', accent: 'amber' },
        { icon: 'coin', num: '0,00 €', lbl: 'Custo mensal total' },
        { icon: 'coin', num: '0,00 €', lbl: 'Custo anual total' },
        { icon: 'refresh', num: 0, lbl: '3 Orçamentos em curso', accent: 'gold' },
        { icon: 'ban', num: 0, lbl: 'Expirados (atenção)', accent: 'rust' },
      ]} />
      <Tabs defaultActive="todos" tabs={[
        { id: 'todos', label: 'Todos' },
        { id: 'limp', label: 'Limpezas' },
        { id: 'elev', label: 'Elevadores' },
        { id: 'seg', label: 'Segurança' },
        { id: 'jard', label: 'Jardinagem' },
        { id: 'outros', label: 'Outros' },
      ]} />
      <Panel>
        <Empty illustration="profissionais" title="Nenhum contrato centralizado"
          desc="Léa lê PDFs de contratos (limpezas, elevadores, segurança, jardim) em segundos e pré-preenche 90% da ficha. Renovações nunca esquecidas."
          action={<Button variant="primary"><Icon name="upload" />Upload primeiro contrato</Button>} />
      </Panel>
      <Panel title="Lifecycle de um contrato" sub="Léa + Tempo + 3 Orçamentos = ciclo fechado">
        <div className={m.cardGrid3}>
          {LIFECYCLE.map(([t, s, c], i) => (
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
