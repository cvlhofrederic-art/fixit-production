'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { Pill, type PillKind } from '../primitives/pill'
import { Panel } from '../primitives/panel'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'

/** Ordens de serviço — port byte-exact du ModOrdens du bundle V5.7. */

const TABS: { id: string; label: string; count?: number }[] = [
  { id: 'todas', label: 'Todas', count: 9 },
  { id: 'urg', label: 'Urgentes', count: 1 },
  { id: 'curso', label: 'Em curso', count: 4 },
  { id: 'conc', label: 'Concluídas' },
]

const ORDERS = [
  ['Pendente', '#ORD-2026-001', 'Edifício Foz Douro', 'Canalização · Fuga de água apartamento', 'Fração 4B', 'Bruno Tavares', '22/05/2026'],
  ['Em curso', '#ORD-2026-002', 'Condomínio Boavista Center', 'Coordenação de obras · Acompanhamento da impermeabilização da cobertura', '', 'Bruno Tavares', '20/05/2026'],
  ['Concluída', '#ORD-2026-003', 'Residencial Cedofeita', 'Inspeção técnica · Verificação periódica do sistema de gás das partes comuns', '', 'Bruno Tavares', '12/04/2026'],
  ['Pendente', '#ORD-2026-004', 'Condomínio Boavista Center', 'Pequenas reparações · Substituição de 4 lâmpadas LED na garagem', '', 'Diogo Pereira', '18/05/2026'],
  ['Em curso', '#ORD-2026-005', 'Edifício Foz Douro', 'Pequenas reparações · Pintura de retoque na zona da entrada', 'And. 2.°', 'Tiago Mendes', '16/05/2026'],
  ['Pendente', '#ORD-2026-006', 'Edifício Foz Douro', 'Manutenção corrente · Portão automático da garagem fecha muito devagar', 'And. -1', '—', '—'],
  ['Pendente', '#ORD-2026-007', 'Edifício Foz Douro', 'Eletricidade · Iluminação do corredor do 2.° pisca constantemente', 'And. 2.°', '—', '—'],
  ['Pendente', '#ORD-2026-008', 'Residencial Cedofeita', 'Construção · Fissura nova no muro lateral do edifício, lado norte', 'And. Exterior', '—', '—'],
  ['Pendente', '#ORD-2026-009', 'Residencial Cedofeita', 'Manutenção corrente · Reparação de campainha avariada no R/C esquerdo', 'Bl. A · And. R/C', 'Tiago Mendes', '21/05/2026'],
] as const

const btnBase = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' } as const
const btnDefault = { ...btnBase, border: '1px solid var(--v54-line-strong)', background: '#fff', color: 'var(--v54-ink)' } as const
const btnGold = { ...btnBase, border: '1px solid var(--v54-gold-700)', background: 'linear-gradient(155deg, var(--v54-gold-500), var(--v54-gold-700))', color: 'var(--v54-navy-900)' } as const
const btnSm = { padding: '6px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 600, cursor: 'pointer' } as const

const statusKind = (s: string): PillKind => (s === 'Pendente' ? 'amber' : 'sage')

export default function ModOrdens() {
  const [tab, setTab] = useState<string>('todas')

  return (
    <>
      <PageHead
        title="Ordens de serviço"
        lede="Acompanhamento das missões em curso, pedidos pendentes e histórico"
        actions={<>
          <button type="button" style={btnDefault}><Icon name="search" />Filtros</button>
          <button type="button" style={btnGold}><Icon name="plus" />Nova missão</button>
        </>}
      />
      <div className={m.chipRow}>
        {TABS.map((t) => (
          <button key={t.id} type="button" className={clsx(m.chip, tab === t.id && m.chipActive)} onClick={() => setTab(t.id)}>
            {t.label}{t.count != null && <span className={m.chipCount}> {t.count}</span>}
          </button>
        ))}
      </div>
      <Panel flush>
        {ORDERS.map((o) => (
          <div key={o[1]} style={{ padding: '18px 22px', borderBottom: '1px solid var(--v54-line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <Pill noDot>Normal</Pill>
              <Pill kind={statusKind(o[0])} noDot>{o[0]}</Pill>
              <span className={m.mono} style={{ fontSize: 11, color: 'var(--v54-navy-300)' }}>{o[1]}</span>
              {o[4] && <span style={{ fontSize: 11.5, color: 'var(--v54-navy-500)', marginLeft: 4 }}>{o[4]}</span>}
              <div style={{ flex: 1 }} />
              {o[0] !== 'Concluída' && o[5] === '—' && <button type="button" style={{ ...btnSm, background: 'var(--v54-sage-500)', color: '#fff', border: 'none' }}>Validar</button>}
              <button type="button" style={{ ...btnSm, background: 'transparent', border: '1px solid var(--v54-line-strong)', color: 'var(--v54-ink)' }}>Abrir</button>
            </div>
            <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 18, fontWeight: 500, marginBottom: 4 }}>{o[2]}</div>
            <div style={{ fontSize: 12.5, color: 'var(--v54-navy-500)' }}>{o[3]}</div>
            {o[5] !== '—' && <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11.5, color: 'var(--v54-navy-300)' }}><span>{o[5]}</span><span>{o[6]}</span></div>}
          </div>
        ))}
      </Panel>
    </>
  )
}
