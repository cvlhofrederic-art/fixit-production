'use client'

// Documents d'intervention — port du `ModDocsInterv` du mockup v8 : devis,
// factures et PV liés aux interventions + transmission à la comptabilité.

import { useState } from 'react'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Tabs } from '@/components/syndic-dashboard/v54/primitives/tabs'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Pill } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { Icon } from '@/components/syndic-dashboard/v54/primitives/icon'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'
import DataTable from '../shared/DataTable'
import DetailModal from '../shared/DetailModal'

/** [Document, Intervention, Bâtiment, Date, Compta] */
type DiRow = [string, string, string, string, string]

const DI_ROWS: DiRow[] = [
  ['Devis DEV-2026-018', 'Travaux toiture', 'Les Tilleuls', '28/05/2026', 'non transmis'],
  ['Facture FAC-2026-044', 'Entretien ascenseur', 'Le Méridien', '12/05/2026', 'transmis'],
  ['PV de réception', 'Étanchéité terrasse', 'Les Tilleuls', '29/04/2026', 'transmis'],
  ['Facture FAC-2026-051', 'Réparation fuite', 'Le Méridien', '04/06/2026', 'non transmis'],
  ["Bon d'intervention", 'Contrôle chaudière', 'Villa Montaigne', '20/03/2026', 'transmis'],
]

export default function ModDocsInterv() {
  const { push } = useToast()
  const [open, setOpen] = useState<DiRow | null>(null)
  return (
    <>
      <PageHead eyebrow="Gestion courante" title="Documents d'intervention"
        lede="Devis, factures et PV liés aux interventions, et leur transmission à la comptabilité."
        actions={<Button variant="gold" onClick={() => push({ kind: 'info', title: 'Ajouter', desc: "Joindre un document d'intervention" })}><Icon name="plus" />Ajouter</Button>} />
      <KPIGrid items={[
        { icon: 'doc', num: 5, lbl: 'Total documents' },
        { icon: 'alert', num: 2, lbl: 'Non transmis à la compta', accent: 'rust' },
        { icon: 'check', num: 3, lbl: 'Transmis à la compta', accent: 'sage' },
        { icon: 'coin', num: 2, lbl: 'Factures' },
      ]} />
      <Tabs defaultActive="tous" ariaLabel="Filtrer les documents" tabs={[
        { id: 'tous', icon: 'folder', label: 'Tous' },
        { id: 'devis', icon: 'doc', label: 'Devis' },
        { id: 'fact', icon: 'coin', label: 'Factures' },
        { id: 'pv', icon: 'fact', label: 'PV' },
      ]} />
      <Panel title="Documents" icon="doc" flush>
        <DataTable
          columns={[
            { h: 'Document', render: (r) => <b>{r[0]}</b> },
            { h: 'Intervention', render: (r) => r[1] },
            { h: 'Bâtiment', render: (r) => r[2] },
            { h: 'Date', render: (r) => <span className={m.mono}>{r[3]}</span> },
            { h: 'Compta', render: (r) => <Pill kind={r[4] === 'transmis' ? 'sage' : 'rust'} noDot>{r[4]}</Pill> },
          ]}
          rows={DI_ROWS} onRow={setOpen} />
      </Panel>
      <DetailModal open={!!open} onClose={() => setOpen(null)} title={open ? open[0] : ''} icon="doc"
        fields={open ? [
          { k: 'Intervention', v: open[1] },
          { k: 'Bâtiment', v: open[2] },
          { k: 'Date', v: open[3] },
          { k: 'Transmission compta', v: open[4] },
        ] : []} />
    </>
  )
}
