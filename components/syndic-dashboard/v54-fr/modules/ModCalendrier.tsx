'use client'

// Calendrier réglementaire — port du ModCalReg du mockup v8 (L7030-7067).
// Échéances légales : AG annuelle (art. 14-1 loi 1965), DPE, ascenseurs, registre…

import { useState } from 'react'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Pill, type PillKind } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'
import DataTable from '../shared/DataTable'
import DetailModal from '../shared/DetailModal'

type CalStatut = 'à venir' | 'proche' | 'en retard' | 'conforme'
type CalRow = readonly [string, string, string, string, CalStatut]

const CAL_ROWS: CalRow[] = [
  ['Assemblée générale annuelle', 'Loi 1965, art. 14-1', 'Le Clos des Vignes', '22/07/2026', 'à venir'],
  ['Approbation des comptes', 'Loi 1965, art. 14-3', 'Le Méridien', '08/06/2026', 'proche'],
  ['Contrôle technique ascenseur', 'Décret 2004-964', 'Villa Montaigne', '18/01/2026', 'en retard'],
  ['DPE collectif', 'Loi Climat & Résilience', 'Les Tilleuls', '31/12/2026', 'à venir'],
  ['Télédéclaration registre', 'CCH L711-1', 'Le Clos des Vignes', '30/06/2026', 'proche'],
  ['Vérification sécurité incendie', 'Arrêté 31/01/1986', 'Le Méridien', '15/09/2026', 'conforme'],
]
const CAL_PILL: Record<CalStatut, PillKind> = { 'à venir': 'gold', proche: 'amber', 'en retard': 'rust', conforme: 'sage' }

const baseLegaleStyle = { color: 'var(--v54-navy-500)', fontSize: 12 } as const

export default function ModCalendrier() {
  const { push } = useToast()
  const [open, setOpen] = useState<CalRow | null>(null)
  return (
    <>
      <PageHead eyebrow="Conformité" title="Calendrier réglementaire"
        lede="Échéances légales et réglementaires des copropriétés sous mandat."
        actions={<Button variant="gold" onClick={() => push({ kind: 'info', title: 'Exporter', desc: 'Exporter le calendrier des échéances' })}><Icon name="download" />Exporter</Button>} />
      <KPIGrid items={[
        { icon: 'calendar', num: 6, lbl: 'Échéances suivies' },
        { icon: 'clock', num: 2, lbl: 'À venir < 30 j', accent: 'amber' },
        { icon: 'siren', num: 1, lbl: 'En retard', accent: 'rust' },
        { icon: 'check', num: 1, lbl: 'Conformes', accent: 'sage' },
      ]} />
      <Panel title="Échéances réglementaires" icon="calendar" flush>
        <DataTable
          columns={[
            { h: 'Obligation', render: (r) => <b>{r[0]}</b> },
            { h: 'Base légale', render: (r) => <span style={baseLegaleStyle}>{r[1]}</span> },
            { h: 'Copropriété', render: (r) => r[2] },
            { h: 'Échéance', render: (r) => <span className={m.mono}>{r[3]}</span> },
            { h: 'Statut', render: (r) => <Pill kind={CAL_PILL[r[4]]} noDot>{r[4]}</Pill> },
          ]}
          rows={CAL_ROWS} onRow={setOpen} />
      </Panel>
      <DetailModal open={!!open} onClose={() => setOpen(null)} title={open ? open[0] : ''} icon="calendar"
        fields={open ? [{ k: 'Base légale', v: open[1] }, { k: 'Copropriété', v: open[2] }, { k: 'Échéance', v: open[3] }, { k: 'Statut', v: open[4] }] : []} />
    </>
  )
}
