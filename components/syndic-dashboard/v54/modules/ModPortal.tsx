'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Pill } from '../primitives/pill'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import m from './modules.module.css'

/** Portal do Condómino — port byte-exact du ModPortal du bundle V5.7. */

const eur = <span style={{ fontSize: 22, fontStyle: 'italic', color: 'var(--v54-gold-700)', marginLeft: 4 }}>€</span>

const ACTIONS: readonly (readonly [IconName, string])[] = [
  ['clipboard', 'Ver recibos'],
  ['doc', 'Declaração para IRS'],
  ['wrench', 'Reportar avaria'],
  ['chat', 'Contactar administração'],
]

const AVISOS = [
  ['Obras na fachada - Início previsto', 'Informamos que as obras de reabilitação da fachada principal terão início no dia 20 de Março', '10/03/2026', 'Manutenção', 'amber'],
  ['Assembleia Geral Ordinária', 'Convocamos todos os condóminos para a Assembleia Geral Ordinária que decorrerá no dia 15 de Abril às 19h00', '08/03/2026', 'Info', 'sage'],
  ['Corte de água programado', 'No dia 25 de Março, entre as 9h e as 13h, haverá corte de água para reparação no sistema de canalização do piso 0', '05/03/2026', 'Urgente', 'rust'],
  ['Orçamento aprovado - Elevador', 'Foi aprovado em AG o orçamento para modernização do elevador no valor de 12.500 EUR. Os trabalhos iniciam em Maio', '01/03/2026', 'Financeiro', 'gold'],
  ['Limpeza partes comuns', 'Informamos que a nova empresa de limpeza iniciará funções a partir de 1 de Abril. Horário: 2.ª a 6.ª, das 8h às 10h', '28/02/2026', 'Info', 'sage'],
] as const

const qaBtn = { padding: '18px', flexDirection: 'column', gap: 10, minHeight: 110, background: 'var(--v54-cream)' } as const

export default function ModPortal() {
  return (
    <>
      <PageHead title="Portal do Condómino" lede="Vista única do condómino: conta, documentos, comunicações, pedidos" />
      <Tabs defaultActive="vg" tabs={[
        { id: 'vg', icon: 'chart', label: 'Visão Geral' },
        { id: 'cc', icon: 'coin', label: 'Conta Corrente' },
        { id: 'dc', icon: 'doc', label: 'Documentos' },
        { id: 'cm', icon: 'chat', label: 'Comunicações', badge: 1 },
        { id: 'pd', icon: 'pencil', label: 'Pedidos' },
      ]} />
      <KPIGrid items={[
        { icon: 'coin', num: '0,00', numChildren: eur, lbl: 'Saldo devedor', subChildren: <Pill kind="sage" noDot>Em dia</Pill> },
        { icon: 'calendar', accent: 'amber', num: '85,00', numChildren: eur, lbl: 'Próxima quota', sub: 'Vencimento: 1 Abril 2026' },
        { icon: 'check', accent: 'sage', num: '85,00', numChildren: eur, lbl: 'Último pagamento', sub: '01 de março de 2026' },
        { icon: 'grid', accent: 'gold', num: 'Fração B', numStyle: { fontSize: 28 }, lbl: '2.° Direito', sub: 'Permilagem: 55/1000' },
      ]} />
      <Panel title="Ações rápidas">
        <div className={m.cardGrid4}>
          {ACTIONS.map((a) => (
            <Button key={a[1]} style={qaBtn}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--v54-cream)', display: 'grid', placeItems: 'center', color: 'var(--v54-navy-700)' }}><Icon name={a[0]} /></div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{a[1]}</div>
            </Button>
          ))}
        </div>
      </Panel>
      <Panel title="Avisos recentes" flush>
        {AVISOS.map((a) => (
          <div key={a[0]} style={{ padding: '14px 22px', borderBottom: '1px solid var(--v54-line)', borderLeft: `3px solid var(--v54-${a[4]}-500)` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ fontWeight: 600 }}>{a[0]}</div>
              <Pill kind={a[4]} noDot>{a[3]}</Pill>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--v54-navy-500)' }}>{a[1]}…</div>
            <div style={{ fontSize: 11, color: 'var(--v54-navy-300)', marginTop: 4 }}>{a[2]}</div>
          </div>
        ))}
      </Panel>
    </>
  )
}
