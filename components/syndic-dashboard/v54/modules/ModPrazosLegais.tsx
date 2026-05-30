'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Panel } from '../primitives/panel'
import { Pill, type PillKind } from '../primitives/pill'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import btnCss from '../primitives/button/Button.module.css'

/** Prazos Legais — port byte-exact du ModPrazosLegais du bundle V5.7. */

type Prazo = { icon: IconName; titulo: string; edificio: string; data: string; prazo: string; kind: PillKind }
const ITEMS: Prazo[] = [
  { icon: 'flame', titulo: 'Limpeza de chaminés', edificio: 'Edifício Atlântico', data: '21 de novembro de 2026', prazo: 'Dentro de 181d', kind: 'sage' },
  { icon: 'flame', titulo: 'Limpeza de chaminés', edificio: 'Condomínio Boavista Center', data: '21 de novembro de 2026', prazo: 'Dentro de 181d', kind: 'sage' },
  { icon: 'flame', titulo: 'Limpeza de chaminés', edificio: 'Residencial Cedofeita', data: '21 de novembro de 2026', prazo: 'Dentro de 181d', kind: 'sage' },
  { icon: 'flame', titulo: 'Limpeza de chaminés', edificio: 'Edifício Foz Douro', data: '21 de novembro de 2026', prazo: 'Dentro de 181d', kind: 'sage' },
  { icon: 'bank', titulo: 'AG anual', edificio: 'Edifício Atlântico', data: '21 de maio de 2027', prazo: 'Dentro de 362d', kind: 'sage' },
  { icon: 'chart', titulo: 'Orçamento previsional', edificio: 'Edifício Atlântico', data: '21 de maio de 2027', prazo: 'Dentro de 362d', kind: 'sage' },
  { icon: 'flame', titulo: 'Verificação de extintores', edificio: 'Edifício Atlântico', data: '21 de maio de 2027', prazo: 'Dentro de 362d', kind: 'sage' },
  { icon: 'alert', titulo: 'Plano de gestão de amianto', edificio: 'Edifício Atlântico', data: '21 de maio de 2029', prazo: 'Dentro de 1093d', kind: 'amber' },
  { icon: 'alert', titulo: 'Plano de gestão de amianto', edificio: 'Condomínio Boavista Center', data: '21 de maio de 2029', prazo: 'Dentro de 1093d', kind: 'amber' },
  { icon: 'alert', titulo: 'Plano de gestão de amianto', edificio: 'Residencial Cedofeita', data: '21 de maio de 2029', prazo: 'Dentro de 1093d', kind: 'amber' },
  { icon: 'alert', titulo: 'Plano de gestão de amianto', edificio: 'Edifício Foz Douro', data: '21 de maio de 2029', prazo: 'Dentro de 1093d', kind: 'amber' },
  { icon: 'elevator', titulo: 'Inspeção elevador', edificio: 'Edifício Atlântico', data: '21 de maio de 2031', prazo: 'Dentro de 1823d', kind: 'gold' },
]
const checkBtn = { background: 'var(--v54-sage-50)', color: 'var(--v54-sage-700)', borderColor: 'transparent' } as const

export default function ModPrazosLegais() {
  return (
    <>
      <PageHead title="Prazos Legais" lede="Acompanhamento das obrigações regulamentares multi-edifícios"
        actions={<><Pill kind="gold" noDot>Auto-iniciar</Pill><Button variant="gold"><Icon name="plus" />+ Adicionar</Button></>} />
      <KPIGrid items={[
        { icon: 'chart', num: 40, lbl: 'Total' },
        { icon: 'alert', num: 0, lbl: 'Em atraso', accent: 'rust' },
        { icon: 'clock', num: 0, lbl: 'Urgente < 30d', accent: 'amber' },
        { icon: 'check', num: 0, lbl: 'Realizados', accent: 'sage' },
      ]} />
      <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
        <select className={btnCss.btn} aria-label="Filtrar por edifício"><option>Todos os edifícios</option></select>
        <select className={btnCss.btn} aria-label="Filtrar por estado"><option>Todos os estados</option></select>
      </div>
      <Panel flush>
        {ITEMS.map((r, i) => (
          <div key={i} style={{ padding: '14px 22px', borderBottom: i < ITEMS.length - 1 ? '1px solid var(--v54-line)' : 'none', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--v54-cream)', display: 'grid', placeItems: 'center', color: 'var(--v54-navy-700)' }}><Icon name={r.icon} /></div>
            <div style={{ flex: 1 }}><b>{r.titulo}</b> <Pill kind={r.kind} noDot>{r.edificio}</Pill><div style={{ fontSize: 11, color: 'var(--v54-navy-300)', marginTop: 2 }}>{r.data}</div></div>
            <Pill kind={r.kind} noDot>{r.prazo}</Pill>
            <Button size="sm" style={checkBtn} aria-label="Marcar como realizado" title="Marcar como realizado"><Icon name="check" /></Button>
            <Button size="sm" variant="ghost" aria-label="Eliminar prazo legal" title="Eliminar"><Icon name="trash" /></Button>
          </div>
        ))}
      </Panel>
    </>
  )
}
