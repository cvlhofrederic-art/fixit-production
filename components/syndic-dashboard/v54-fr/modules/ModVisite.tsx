'use client'

// Visites techniques — port du `ModVistoria` du mockup v8 : état technique
// des immeubles relevé lors des visites du gestionnaire.

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

/** [Copropriété, Date, Objet, Constat, État] */
type VisRow = [string, string, string, string, string]

const VIS_ROWS: VisRow[] = [
  ['Le Méridien', '02/06/2026', 'Toiture-terrasse', 'Étanchéité à surveiller', 'à surveiller'],
  ['Les Tilleuls', '28/05/2026', 'Toiture', 'Tuiles déplacées, infiltration', 'déficient'],
  ['Le Clos des Vignes', '20/05/2026', 'Parties communes', 'Conforme', 'ok'],
  ['Villa Montaigne', '15/05/2026', 'Façade', 'Fissures superficielles', 'à surveiller'],
]
const VIS_PILL: Record<string, PillKind> = { ok: 'sage', 'à surveiller': 'amber', 'déficient': 'rust' }

export default function ModVisite() {
  const { push } = useToast()
  const [open, setOpen] = useState<VisRow | null>(null)
  return (
    <>
      <PageHead eyebrow="Patrimoine" title="Visites techniques"
        lede="État technique des immeubles relevé lors des visites du gestionnaire."
        actions={<Button variant="gold" onClick={() => push({ kind: 'info', title: 'Nouvelle visite', desc: 'Consigner une visite technique' })}><Icon name="search" />Nouvelle visite</Button>} />
      <KPIGrid items={[
        { icon: 'check', num: 4, lbl: 'Visites réalisées' },
        { icon: 'alert', num: 2, lbl: 'Points à surveiller', accent: 'amber' },
        { icon: 'siren', num: 1, lbl: 'Points déficients', accent: 'rust' },
      ]} />
      <Panel title="Dernières visites" icon="search" flush>
        <DataTable
          columns={[
            { h: 'Copropriété', render: (r) => <b>{r[0]}</b> },
            { h: 'Date', render: (r) => <span className={m.mono}>{r[1]}</span> },
            { h: 'Objet', render: (r) => r[2] },
            { h: 'Constat', render: (r) => r[3] },
            { h: 'État', render: (r) => <Pill kind={VIS_PILL[r[4]]} noDot>{r[4]}</Pill> },
          ]}
          rows={VIS_ROWS} onRow={setOpen} />
      </Panel>
      <DetailModal open={!!open} onClose={() => setOpen(null)} title={open ? `${open[0]} — ${open[2]}` : ''} icon="search"
        fields={open ? [
          { k: 'Date', v: open[1] },
          { k: 'Objet', v: open[2] },
          { k: 'Constat', v: open[3], full: true },
          { k: 'État', v: open[4] },
        ] : []} />
    </>
  )
}
