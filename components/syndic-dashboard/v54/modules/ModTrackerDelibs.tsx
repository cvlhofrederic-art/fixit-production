'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Pill } from '../primitives/pill'
import { Empty } from '../primitives/empty'
import { Alert } from '../primitives/alert'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import m from './modules.module.css'

/** Tracker de Deliberações — port byte-exact du ModTrackerDelibs du bundle V5.7. */

const AGS = ['Todas as AGs', 'AG Ord 2026', 'AG Extra Mar 2026', 'AG Ord 2025']
type Step = { icon: IconName; titulo: string; desc: string; cor: 'sage' | 'gold' | 'amber' }
const STEPS: Step[] = [
  { icon: 'bot', titulo: 'Análise semântica', desc: 'Detecta verbos no infinitivo + objeto + responsável implícito ou explícito', cor: 'sage' },
  { icon: 'clock', titulo: 'Cálculo prazo', desc: 'data_AG + 15 dias úteis (calendário PT, feriados Porto incluídos)', cor: 'gold' },
  { icon: 'bell', titulo: 'Escalation alertas', desc: 'J-3 / J-1 / J0 / J+1 — emails + push + Canal IA', cor: 'amber' },
]

export default function ModTrackerDelibs() {
  return (
    <>
      <PageHead eyebrow="OBRIGAÇÃO LEGAL · CC ART. 1436.° f) i)" title="Tracker de Deliberações"
        lede="Executar deliberações em 15 dias úteis · Extração IA · Calendário de execução · Calendário PT férias-aware"
        actions={<><Button><Icon name="bot" />Reextrair com Fixy</Button><Button variant="gold"><Icon name="plus" />+ Nova ação manual</Button></>} />
      <Alert kind="gold" icon="scale" title="Obrigação legal — CC art. 1436.° alínea i)">
        O administrador deve executar as deliberações da assembleia em <strong>15 dias úteis</strong>. Fixy extrai cada deliberação da ata final, atribui prazo automaticamente e envia alertas escalados (J-3 · J-1 · J0 · J+1).
      </Alert>
      <KPIGrid items={[
        { icon: 'bot', num: 0, lbl: 'Deliberações extraídas IA', accent: 'gold' },
        { icon: 'clock', num: 0, lbl: 'Em curso (no prazo)', accent: 'sage' },
        { icon: 'alert', num: 0, lbl: 'Próximos do prazo (≤3d)', accent: 'amber' },
        { icon: 'ban', num: 0, lbl: 'Atrasadas (responsabilidade civil)', accent: 'rust' },
        { icon: 'check', num: 0, lbl: 'Concluídas no prazo', accent: 'sage' },
        { icon: 'pause', num: 0, lbl: 'Bloqueadas (justificadas)' },
      ]} />
      <Tabs defaultActive="todas" tabs={[
        { id: 'todas', label: 'Todas as deliberações' },
        { id: 'pen', label: 'Pendentes' },
        { id: 'em', label: 'Em curso' },
        { id: 'atr', label: 'Atrasadas' },
        { id: 'conc', label: 'Concluídas' },
      ]} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {AGS.map((t, i) => <Pill key={i} kind={i === 0 ? 'dark' : undefined} noDot>{t}</Pill>)}
      </div>
      <Panel>
        <Empty illustration="ag" title="Nenhuma deliberação para acompanhar"
          desc="Quando uma ata for finalizada com Atas IA, as deliberações são extraídas automaticamente e atribuídas com prazos legais."
          action={<Button variant="primary"><Icon name="bot" />Importar ata existente</Button>} />
      </Panel>
      <Panel title="Como Fixy extrai as deliberações" sub="Pipeline IA pós-ata · Edge cases incluídos">
        <div className={m.cardGrid3}>
          {STEPS.map((r, i) => (
            <div key={i} style={{ padding: 14, border: '1px solid var(--v54-line)', borderRadius: 10, display: 'flex', gap: 12, background: `var(--v54-${r.cor}-50)`, borderLeft: `3px solid var(--v54-${r.cor}-500)` }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fff', display: 'grid', placeItems: 'center', color: `var(--v54-${r.cor}-700)` }}><Icon name={r.icon} /></div>
              <div><div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{r.titulo}</div><div style={{ fontSize: 11.5, color: 'var(--v54-navy-400)' }}>{r.desc}</div></div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
