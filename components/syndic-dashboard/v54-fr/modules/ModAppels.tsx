'use client'

// Appels de fonds — port du ModMapaQuotas du mockup v8 (L7404-7438).
// Budget voté, quotes-parts par copropriété et suivi du recouvrement.

import { useState } from 'react'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Tabs } from '@/components/syndic-dashboard/v54/primitives/tabs'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Pill, type PillKind } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'
import DataTable from '../shared/DataTable'
import DetailModal from '../shared/DetailModal'
import { COPROS, TOTAL_BUDGET, TOTAL_IMPAYES } from '../data/mock'
import { fmtEUR } from '../lib/format'

type AfRow = readonly [string, string, string, string, string, string, PillKind]

const AF_ROWS: AfRow[] = COPROS.map((c) => {
  const emis = c.budget
  const rec = c.budget - c.impayes
  const taux = Math.round((rec / emis) * 100)
  return [c.nom, fmtEUR(c.budget), fmtEUR(Math.round(c.budget / c.lots)), fmtEUR(emis), fmtEUR(rec), `${taux} %`, taux >= 90 ? 'sage' : taux >= 75 ? 'amber' : 'rust']
})

export default function ModAppels() {
  const { push } = useToast()
  const [open, setOpen] = useState<AfRow | null>(null)
  return (
    <>
      <PageHead eyebrow="Comptabilité & finances" title="Appels de fonds"
        lede="Budget voté, quotes-parts par copropriété et suivi du recouvrement."
        actions={<Button variant="gold" onClick={() => push({ kind: 'info', title: 'Nouvel appel de fonds', desc: 'Émettre un appel de fonds trimestriel' })}><Icon name="coin" />Émettre un appel</Button>} />
      <KPIGrid items={[
        { icon: 'bank', num: fmtEUR(TOTAL_BUDGET), lbl: 'Budget annuel voté' },
        { icon: 'coin', num: fmtEUR(Math.round(TOTAL_BUDGET * 0.05)), lbl: 'Cotisation fonds travaux', accent: 'gold' },
        { icon: 'chart', num: `${Math.round(((TOTAL_BUDGET - TOTAL_IMPAYES) / TOTAL_BUDGET) * 100)} %`, lbl: 'Taux de recouvrement', accent: 'amber' },
        { icon: 'mail', num: 'T2', lbl: 'Appel en cours' },
      ]} />
      <Tabs defaultActive="map" tabs={[
        { id: 'map', icon: 'grid', label: 'Quotes-parts' },
        { id: 'sim', icon: 'chart', label: 'Simulateur' },
        { id: 'cob', icon: 'coin', label: 'Recouvrements' },
        { id: 'obr', icon: 'wrench', label: 'Travaux' },
      ]} />
      <Panel title="Quotes-parts par copropriété" icon="coin" flush>
        <DataTable
          columns={[
            { h: 'Copropriété', render: (r) => <b>{r[0]}</b> },
            { h: 'Budget voté', render: (r) => <span className={m.mono}>{r[1]}</span> },
            { h: 'Quote-part moy.', render: (r) => <span className={m.mono}>{r[2]}</span> },
            { h: 'Émis', render: (r) => <span className={m.mono}>{r[3]}</span> },
            { h: 'Recouvré', render: (r) => <span className={m.mono}>{r[4]}</span> },
            { h: 'Taux', render: (r) => <Pill kind={r[6]} noDot>{r[5]}</Pill> },
          ]}
          rows={AF_ROWS} onRow={setOpen} />
      </Panel>
      <DetailModal open={!!open} onClose={() => setOpen(null)} title={open ? open[0] : ''} icon="coin"
        fields={open ? [
          { k: 'Budget voté', v: open[1] },
          { k: 'Quote-part moyenne', v: open[2] },
          { k: 'Appels émis', v: open[3] },
          { k: 'Recouvré', v: open[4] },
          { k: 'Taux de recouvrement', v: open[5] },
        ] : []} />
    </>
  )
}
