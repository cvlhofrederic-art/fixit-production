'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import Icon from '../primitives/icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import m from './modules.module.css'

/** Processamentos em Lote — port byte-exact du ModProcLote du bundle V5.7. */

const ACTIONS: readonly (readonly [IconName, string, string])[] = [
  ['coin', 'Emissão de Quotas', 'Gerar avisos de pagamento de quotas para todos os condóminos'],
  ['alert', 'Relance de Impagados', 'Enviar avisos automáticos para quotas em atraso (30, 60, 90 dias)'],
  ['chart', 'Encerramento de Exercício', 'Fechar exercício fiscal: balanço, relatório de contas, preparar novo ano'],
  ['coin', 'Atualização Fundo de Reserva', 'Recalcular e atualizar fundo de reserva legal (mín. 10% orçamento - DL 268/94)'],
  ['doc', 'Geração de Recibos', 'Gerar recibos em lote para pagamentos recebidos no período'],
  ['bank', 'Convocatória AG em Lote', 'Enviar convocatórias para Assembleia Geral a todos os condóminos'],
]

const fieldLabel = { fontSize: 11, fontWeight: 600, color: 'var(--v54-navy-500)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 } as const
const fieldSelect = { width: '100%', padding: '10px 12px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, background: '#fff', fontSize: 13, color: 'var(--v54-ink)' } as const

export default function ModProcLote() {
  return (
    <>
      <PageHead title="Processamentos em Lote" lede="Automatize tarefas repetitivas: emissão de quotas, relances, encerramento de exercício" />
      <KPIGrid items={[
        { icon: 'cog', num: 0, lbl: 'Execuções totais' },
        { icon: 'check', num: 0, lbl: 'Concluídas', accent: 'sage' },
        { icon: 'alert', num: 0, lbl: 'Com erros', accent: 'rust' },
        { icon: 'clock', num: 0, lbl: 'Agendamentos ativos', accent: 'amber' },
      ]} />
      <Tabs defaultActive="exec" tabs={[
        { id: 'exec', label: '▶ Executar' },
        { id: 'hist', icon: 'folder', label: 'Histórico' },
        { id: 'ag', icon: 'clock', label: 'Agendamentos' },
        { id: 'rel', icon: 'chart', label: 'Relatório' },
      ]} />
      <div style={{ marginBottom: 14 }}>
        <label htmlFor="pl-edificio" style={fieldLabel}>Edifício alvo</label>
        <select id="pl-edificio" style={fieldSelect}><option>Todos os edifícios</option></select>
      </div>
      <div className={m.cardGrid3}>
        {ACTIONS.map((c) => (
          <div key={c[1]} className={m.card} style={{ padding: 22, cursor: 'pointer' }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--v54-cream)', display: 'grid', placeItems: 'center', color: 'var(--v54-navy-700)', marginBottom: 12 }}><Icon name={c[0]} /></div>
            <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 20, marginBottom: 6, fontWeight: 500 }}>{c[1]}</div>
            <div style={{ fontSize: 12.5, color: 'var(--v54-navy-500)' }}>{c[2]}</div>
          </div>
        ))}
      </div>
    </>
  )
}
