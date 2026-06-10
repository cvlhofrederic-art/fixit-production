'use client'

// Carnet d'entretien & technique — port du `ModCadernetaMan` du mockup v8 :
// historique des interventions, équipements et contrats des copropriétés.

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

/** [Date, Nature, Bâtiment, Prestataire, Coût, Garantie, État] */
type CarnRow = [string, string, string, string, string, string, string]

const CARN_ROWS: CarnRow[] = [
  ['12/05/2026', 'Entretien ascenseur', 'Le Méridien', 'Otis', '480 €', 'Contrat', 'fait'],
  ['28/04/2026', 'Réfection étanchéité terrasse', 'Les Tilleuls', 'Ent. Toitures Nord', '3 200 €', '10 ans', 'fait'],
  ['16/06/2026', 'Travaux toiture (prévu)', 'Les Tilleuls', 'Ent. Toitures Nord', '18 400 €', '10 ans', 'planifié'],
  ['03/06/2026', 'Réparation fuite parking', 'Le Méridien', 'Plomberie Centrale', '620 €', '1 an', 'en cours'],
  ['20/03/2026', 'Contrôle chaudière collective', 'Villa Montaigne', 'ThermoServices', '390 €', 'Contrat', 'fait'],
]

export default function ModCarnet() {
  const { push } = useToast()
  const [open, setOpen] = useState<CarnRow | null>(null)
  return (
    <>
      <PageHead eyebrow="Patrimoine" title="Carnet d'entretien & technique"
        lede="Historique des interventions, équipements et contrats des copropriétés sous mandat."
        actions={<Button variant="gold" onClick={() => push({ kind: 'info', title: 'Nouvelle intervention', desc: 'Consigner une intervention' })}><Icon name="wrench" />Nouvelle intervention</Button>} />
      <KPIGrid items={[
        { icon: 'wrench', num: 5, lbl: 'Interventions consignées' },
        { icon: 'shield', num: 3, lbl: 'Sous garantie', accent: 'sage' },
        { icon: 'doc', num: 4, lbl: 'Contrats actifs' },
        { icon: 'building', num: 12, lbl: 'Équipements suivis' },
      ]} />
      <Tabs defaultActive="carnet" ariaLabel="Sections du carnet" tabs={[
        { id: 'carnet', icon: 'clipboard', label: "Carnet d'entretien" },
        { id: 'equip', icon: 'wrench', label: 'Équipements' },
        { id: 'contrats', icon: 'doc', label: 'Contrats' },
        { id: 'etat', icon: 'fact', label: 'État daté' },
        { id: 'dpe', icon: 'bolt', label: 'DPE collectif' },
      ]} />
      <Panel title="Interventions" icon="wrench" flush>
        <DataTable
          columns={[
            { h: 'Date', render: (r) => <span className={m.mono}>{r[0]}</span> },
            { h: 'Nature', render: (r) => <b>{r[1]}</b> },
            { h: 'Bâtiment', render: (r) => r[2] },
            { h: 'Prestataire', render: (r) => r[3] },
            { h: 'Coût', render: (r) => <span className={m.mono}>{r[4]}</span> },
            { h: 'Garantie', render: (r) => <Pill noDot>{r[5]}</Pill> },
            { h: 'État', render: (r) => <Pill kind={r[6] === 'fait' ? 'sage' : r[6] === 'en cours' ? 'amber' : 'gold'} noDot>{r[6]}</Pill> },
          ]}
          rows={CARN_ROWS} onRow={setOpen} />
      </Panel>
      <DetailModal open={!!open} onClose={() => setOpen(null)} title={open ? open[1] : ''} icon="wrench"
        fields={open ? [
          { k: 'Date', v: open[0] },
          { k: 'Bâtiment', v: open[2] },
          { k: 'Prestataire', v: open[3] },
          { k: 'Coût', v: open[4] },
          { k: 'Garantie', v: open[5] },
          { k: 'État', v: open[6] },
        ] : []} />
    </>
  )
}
