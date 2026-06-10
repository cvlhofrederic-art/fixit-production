'use client'

// Suivi des délibérations — port du ModTrackerDelibs du mockup v8 (L6823-6859).
// Exécution des décisions d'AG et respect des échéances (responsabilité du syndic).

import { useState } from 'react'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Pill, type PillKind } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Tabs } from '@/components/syndic-dashboard/v54/primitives/tabs'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'
import DataTable from '../shared/DataTable'
import DetailModal from '../shared/DetailModal'

type DelibStatut = 'en cours' | 'proche' | 'en retard' | 'terminée'
type DelibRow = readonly [string, string, string, string, DelibStatut]

const DELIB_ROWS: DelibRow[] = [
  ['Travaux de ravalement', 'AG 2025 · Le Méridien', 'Marc Léautaud', '30/06/2026', 'en cours'],
  ['Changement de prestataire ascenseur', 'AG 2025 · Le Méridien', 'Awa Diallo', '10/06/2026', 'proche'],
  ['Recouvrement des impayés', 'AG 2024 · Les Tilleuls', 'Camille Noël', '15/05/2026', 'en retard'],
  ['Approbation des comptes 2024', 'AG 2025 · Le Clos des Vignes', 'Julien Marchand', '—', 'terminée'],
  ['Réfection toiture', 'AG 2025 · Les Tilleuls', 'Marc Léautaud', '20/06/2026', 'en cours'],
]
const DELIB_PILL: Record<DelibStatut, PillKind> = { 'en cours': 'amber', proche: 'gold', 'en retard': 'rust', terminée: 'sage' }

const assembleeStyle = { color: 'var(--v54-navy-500)' } as const

export default function ModDelibs() {
  const { push } = useToast()
  const [open, setOpen] = useState<DelibRow | null>(null)
  return (
    <>
      <PageHead eyebrow="Mandat judiciaire" title="Suivi des délibérations"
        lede="Exécution des décisions d'assemblée générale et respect des échéances (responsabilité du syndic)."
        actions={<Button variant="gold" onClick={() => push({ kind: 'info', title: 'Nouvelle délibération', desc: 'Ajouter une décision à suivre' })}><Icon name="plus" />Nouvelle délibération</Button>} />
      <KPIGrid items={[
        { icon: 'fact', num: 5, lbl: 'Délibérations suivies' },
        { icon: 'clock', num: 2, lbl: 'En cours (délais)', accent: 'amber' },
        { icon: 'alert', num: 1, lbl: 'Proche échéance (≤3j)', accent: 'gold' },
        { icon: 'siren', num: 1, lbl: 'En retard (resp. civile)', accent: 'rust' },
        { icon: 'check', num: 1, lbl: 'Terminées', accent: 'sage' },
      ]} />
      <Tabs defaultActive="all" tabs={[
        { id: 'all', icon: 'fact', label: 'Toutes' },
        { id: 'cours', icon: 'clock', label: 'En cours' },
        { id: 'retard', icon: 'siren', label: 'En retard', badge: 1 },
        { id: 'fini', icon: 'check', label: 'Terminées' },
      ]} />
      <Panel title="Décisions à exécuter" icon="fact" flush>
        <DataTable
          columns={[
            { h: 'Délibération', render: (r) => <b>{r[0]}</b> },
            { h: 'Assemblée', render: (r) => <span style={assembleeStyle}>{r[1]}</span> },
            { h: 'Responsable', render: (r) => r[2] },
            { h: 'Échéance', render: (r) => <span className={m.mono}>{r[3]}</span> },
            { h: 'Statut', render: (r) => <Pill kind={DELIB_PILL[r[4]]} noDot>{r[4]}</Pill> },
          ]}
          rows={DELIB_ROWS} onRow={setOpen} />
      </Panel>
      <DetailModal open={!!open} onClose={() => setOpen(null)} title={open ? open[0] : ''} icon="fact"
        fields={open ? [{ k: 'Assemblée', v: open[1] }, { k: 'Responsable', v: open[2] }, { k: 'Échéance', v: open[3] }, { k: 'Statut', v: open[4] }] : []} />
    </>
  )
}
