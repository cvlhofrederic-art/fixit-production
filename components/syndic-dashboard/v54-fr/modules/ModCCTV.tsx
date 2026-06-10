'use client'

// Vidéoprotection — port du `ModCCTV` du mockup v8 : caméras des parties
// communes, signalétique et durée de conservation (conformité CNIL).

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

/** [Emplacement, Bâtiment, Signalétique, Conservation, Conformité CNIL] */
type CctvRow = [string, string, string, string, string]

const CCTV_ROWS: CctvRow[] = [
  ["Hall d'entrée", 'Le Méridien', 'oui', '30 jours', 'conforme'],
  ['Parking sous-sol', 'Le Méridien', 'oui', '30 jours', 'conforme'],
  ['Local vélos', 'Le Clos des Vignes', 'non', '45 jours', 'non conforme'],
  ['Entrée principale', 'Villa Montaigne', 'oui', '30 jours', 'conforme'],
]
const CCTV_PILL: Record<string, PillKind> = { conforme: 'sage', 'non conforme': 'rust' }

export default function ModCCTV() {
  const { push } = useToast()
  const [open, setOpen] = useState<CctvRow | null>(null)
  return (
    <>
      <PageHead eyebrow="Conformité · CNIL" title="Vidéoprotection"
        lede="Caméras des parties communes : signalétique, durée de conservation (30 j max) et conformité CNIL."
        actions={<Button variant="gold" onClick={() => push({ kind: 'info', title: 'Nouvelle caméra', desc: 'Référencer une caméra' })}><Icon name="plus" />Ajouter</Button>} />
      <KPIGrid items={[
        { icon: 'shield', num: 4, lbl: 'Caméras' },
        { icon: 'building', num: 3, lbl: 'Bâtiments couverts' },
        { icon: 'check', num: 3, lbl: 'Avec signalétique', accent: 'sage' },
        { icon: 'siren', num: 1, lbl: 'Conservation > 30 j', accent: 'rust' },
      ]} />
      <Panel title="Caméras installées" icon="shield" flush>
        <DataTable
          columns={[
            { h: 'Emplacement', render: (r) => <b>{r[0]}</b> },
            { h: 'Bâtiment', render: (r) => r[1] },
            { h: 'Signalétique', render: (r) => <Pill kind={r[2] === 'oui' ? 'sage' : 'rust'} noDot>{r[2]}</Pill> },
            { h: 'Conservation', render: (r) => <span className={m.mono}>{r[3]}</span> },
            { h: 'Conformité CNIL', render: (r) => <Pill kind={CCTV_PILL[r[4]]} noDot>{r[4]}</Pill> },
          ]}
          rows={CCTV_ROWS} onRow={setOpen} />
      </Panel>
      <DetailModal open={!!open} onClose={() => setOpen(null)} title={open ? open[0] : ''} icon="shield"
        fields={open ? [
          { k: 'Bâtiment', v: open[1] },
          { k: 'Signalétique', v: open[2] },
          { k: 'Durée de conservation', v: open[3] },
          { k: 'Conformité CNIL', v: open[4] },
        ] : []}
        footnote="Conservation limitée à 30 jours et signalétique obligatoire (CNIL)." />
    </>
  )
}
