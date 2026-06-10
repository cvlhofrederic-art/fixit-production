'use client'

// Gestion des ascenseurs — port du `ModElevadores` du mockup v8 (décret 2004-964) :
// contrats d'entretien + contrôle technique quinquennal, table + détail.

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

/** [Ascenseur, Bâtiment, Entretien, Dernier contrôle, Prochain, État] */
type AscRow = [string, string, string, string, string, string]

const ASC_ROWS: AscRow[] = [
  ['Ascenseur A', 'Le Méridien', 'Otis', '12/05/2026', '12/05/2027', 'conforme'],
  ['Ascenseur B', 'Le Méridien', 'Otis', '12/05/2026', '12/05/2027', 'conforme'],
  ['Ascenseur', 'Le Clos des Vignes', 'Kone', '03/03/2026', '03/03/2027', 'proche'],
  ['Ascenseur', 'Villa Montaigne', 'Schindler', '18/01/2024', '18/01/2026', 'en retard'],
]
const ASC_PILL: Record<string, PillKind> = { conforme: 'sage', proche: 'amber', 'en retard': 'rust' }

export default function ModAscenseurs() {
  const { push } = useToast()
  const [open, setOpen] = useState<AscRow | null>(null)
  return (
    <>
      <PageHead eyebrow="Patrimoine · Décret 2004-964" title="Gestion des ascenseurs"
        lede="Contrats d'entretien et contrôle technique quinquennal des ascenseurs des copropriétés."
        actions={<Button variant="gold" onClick={() => push({ kind: 'info', title: 'Nouvel ascenseur', desc: 'Référencer un ascenseur' })}><Icon name="plus" />Ajouter</Button>} />
      <KPIGrid items={[
        { icon: 'building', num: 4, lbl: 'Ascenseurs suivis' },
        { icon: 'check', num: 2, lbl: 'En conformité', accent: 'sage' },
        { icon: 'clock', num: 1, lbl: 'Contrôle < 90 j', accent: 'amber' },
        { icon: 'siren', num: 1, lbl: 'Inspection en retard', accent: 'rust' },
      ]} />
      <Panel title="Parc d'ascenseurs" icon="building" flush>
        <DataTable
          columns={[
            { h: 'Ascenseur', render: (r) => <b>{r[0]}</b> },
            { h: 'Bâtiment', render: (r) => r[1] },
            { h: 'Entretien', render: (r) => r[2] },
            { h: 'Dernier contrôle', render: (r) => <span className={m.mono}>{r[3]}</span> },
            { h: 'Prochain', render: (r) => <span className={m.mono}>{r[4]}</span> },
            { h: 'État', render: (r) => <Pill kind={ASC_PILL[r[5]]} noDot>{r[5]}</Pill> },
          ]}
          rows={ASC_ROWS} onRow={setOpen} />
      </Panel>
      <DetailModal open={!!open} onClose={() => setOpen(null)} title={open ? `${open[0]} — ${open[1]}` : ''} icon="building"
        fields={open ? [
          { k: "Société d'entretien", v: open[2] },
          { k: 'Dernier contrôle technique', v: open[3] },
          { k: 'Prochain contrôle', v: open[4] },
          { k: 'État', v: open[5] },
        ] : []}
        footnote="Contrôle technique quinquennal obligatoire (décret n° 2004-964)." />
    </>
  )
}
