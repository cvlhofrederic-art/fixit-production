'use client'

// DTG & plan pluriannuel de travaux — port du `ModPlanoMan` du mockup v8 :
// diagnostic technique global et PPT (CCH L731-1 / loi Climat).

import { useState } from 'react'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Pill, type PillKind } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { Icon } from '@/components/syndic-dashboard/v54/primitives/icon'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'
import DataTable from '../shared/DataTable'
import DetailModal from '../shared/DetailModal'

/** [Copropriété, DTG, Horizon PPT, Budget estimé, Statut] */
type DtgRow = [string, string, string, string, string]

const DTG_ROWS: DtgRow[] = [
  ['Résidence Le Méridien', 'Réalisé (2024)', '10 ans · 2025-2035', '185 000 €', 'approuvé'],
  ['Le Clos des Vignes', 'Réalisé (2025)', '10 ans · 2026-2036', '240 000 €', 'en préparation'],
  ['Copropriété Les Tilleuls', 'À réaliser', '—', '—', 'à lancer'],
  ['Villa Montaigne', 'Réalisé (2023)', '10 ans · 2024-2034', '95 000 €', 'approuvé'],
]
const DTG_PILL: Record<string, PillKind> = { 'approuvé': 'sage', 'en préparation': 'amber', 'à lancer': 'rust' }

export default function ModDTG() {
  const { push } = useToast()
  const [open, setOpen] = useState<DtgRow | null>(null)
  return (
    <>
      <PageHead eyebrow="Patrimoine · CCH L731-1 / Loi Climat" title="DTG & plan pluriannuel de travaux"
        lede="Diagnostic technique global et plan pluriannuel de travaux (PPT) des copropriétés."
        actions={<Button variant="gold" onClick={() => push({ kind: 'info', title: 'Nouveau DTG', desc: 'Lancer un diagnostic technique global' })}><Icon name="clipboard" />Lancer un DTG</Button>} />
      <KPIGrid items={[
        { icon: 'clipboard', num: 3, lbl: 'DTG réalisés' },
        { icon: 'check', num: 2, lbl: 'PPT approuvés en AG', accent: 'sage' },
        { icon: 'pencil', num: 1, lbl: 'En préparation', accent: 'amber' },
        { icon: 'coin', num: '520 k€', lbl: 'Budget pluriannuel' },
      ]} />
      <Panel title="DTG & PPT par copropriété" icon="clipboard" flush>
        <DataTable
          columns={[
            { h: 'Copropriété', render: (r) => <b>{r[0]}</b> },
            { h: 'DTG', render: (r) => r[1] },
            { h: 'Horizon PPT', render: (r) => r[2] },
            { h: 'Budget estimé', render: (r) => <span className={m.mono}>{r[3]}</span> },
            { h: 'Statut', render: (r) => <Pill kind={DTG_PILL[r[4]]} noDot>{r[4]}</Pill> },
          ]}
          rows={DTG_ROWS} onRow={setOpen} />
      </Panel>
      <DetailModal open={!!open} onClose={() => setOpen(null)} title={open ? open[0] : ''} icon="clipboard"
        fields={open ? [
          { k: 'Diagnostic technique global', v: open[1] },
          { k: 'Horizon du PPT', v: open[2] },
          { k: 'Budget estimé', v: open[3] },
          { k: 'Statut', v: open[4] },
        ] : []} />
    </>
  )
}
