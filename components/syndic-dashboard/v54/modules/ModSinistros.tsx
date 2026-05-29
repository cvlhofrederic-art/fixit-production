'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'

/** Pipeline Sinistros — port byte-exact du ModSinistros du bundle V5.7. */

const PIPELINE: readonly (readonly [IconName, string, number, string])[] = [
  ['alert', 'Declarado', 0, 'rust'],
  ['wrench', 'Profissional atribuído', 0, 'amber'],
  ['search', 'Em peritagem', 0, 'gold'],
  ['wrench', 'Resolução', 0, 'sage'],
  ['coin', 'Indemnizado', 0, 'sage'],
  ['check', 'Encerrado', 0, 'sage'],
]

export default function ModSinistros() {
  return (
    <>
      <PageHead
        title="Pipeline Sinistros"
        lede="Declaração → Profissional → Peritagem → Indemnização → Encerramento"
        actions={<Button variant="gold"><Icon name="plus" />+ Novo sinistro</Button>}
      />
      <KPIGrid items={[
        { icon: 'shield', num: 0, lbl: 'Sinistros ativos' },
        { icon: 'alert', num: 0, lbl: 'Urgências', accent: 'rust' },
        { icon: 'coin', num: '0 €', lbl: 'Montante estimado', accent: 'gold' },
        { icon: 'check', num: '0 €', lbl: 'Indemnizações', accent: 'sage' },
      ]} />
      <Panel title="VISTA DO PIPELINE" flush>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 0, padding: '20px 22px' }}>
          {PIPELINE.map((s, i) => (
            <div key={s[1]} style={{ textAlign: 'center', padding: 12, borderRight: i < 5 ? '1px dashed var(--v54-line)' : 'none' }}>
              <div style={{ marginBottom: 8, color: `var(--v54-${s[3]}-700)` }}><Icon name={s[0]} style={{ width: 24, height: 24 }} /></div>
              <div style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 6, color: 'var(--v54-navy-500)' }}>{s[1]}</div>
              <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 24, color: `var(--v54-${s[3]}-700)` }}>{s[2]}</div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel>
        <Empty
          kind="gold"
          illustration="seguros"
          title="Nenhum sinistro"
          desc="Declare e acompanhe os seus sinistros do início ao fim — da declaração à indemnização."
          action={<Button variant="gold"><Icon name="plus" />+ Declarar um sinistro</Button>}
        />
      </Panel>
    </>
  )
}
