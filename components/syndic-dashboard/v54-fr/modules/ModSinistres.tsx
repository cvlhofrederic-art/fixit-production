'use client'

// Sinistres — port du `ModSinistres` du mockup v8 : suivi assurance (art. 9-1
// loi 1965) + déclaration via CreateModal (submit = toast, mockup L4730).

import { useState, type ReactNode } from 'react'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Pill, type PillKind } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { Icon } from '@/components/syndic-dashboard/v54/primitives/icon'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import type { IconName } from '@/lib/syndic/icon-names'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'
import DataTable from '../shared/DataTable'
import DetailModal, { type DetailField } from '../shared/DetailModal'
import CreateModal from '../shared/CreateModal'
import { COPRO_NAMES } from '../data/mock'

interface Sinistre {
  id: string
  objet: string
  copro: string
  date: string
  assureur: string
  statut: string
  pill: PillKind
}

const SIN: Sinistre[] = [
  { id: 'SIN-2026-014', objet: 'Dégât des eaux — 4e étage', copro: 'Le Clos des Vignes', date: '29/05/2026', assureur: 'MMA', statut: 'Déclaré', pill: 'amber' },
  { id: 'SIN-2026-009', objet: 'Infiltration toiture', copro: 'Copropriété Les Tilleuls', date: '12/04/2026', assureur: 'AXA', statut: 'Expertise', pill: 'amber' },
  { id: 'SIN-2025-031', objet: 'Bris de glace hall', copro: 'Résidence Le Méridien', date: '18/12/2025', assureur: 'MMA', statut: 'Indemnisé', pill: 'sage' },
]

interface Detail {
  title: ReactNode
  icon: IconName
  fields: DetailField[]
  footnote?: ReactNode
}

export default function ModSinistres() {
  const { push } = useToast()
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<Detail | null>(null)
  return (
    <>
      <PageHead eyebrow="Technique & travaux" title="Sinistres" lede="Déclarations et suivi des sinistres auprès de l'assurance obligatoire de la copropriété (art. 9-1 loi 1965)."
        actions={<Button variant="gold" onClick={() => setOpen(true)}><Icon name="plus" />Déclarer un sinistre</Button>} />
      <KPIGrid items={[
        { icon: 'shield', num: SIN.length, lbl: 'Sinistres suivis', sub: 'sur 12 mois' },
        { icon: 'clock', num: SIN.filter((s) => s.pill === 'amber').length, lbl: 'En cours', sub: 'déclaré / expertise', accent: 'amber' },
        { icon: 'check', num: SIN.filter((s) => s.pill === 'sage').length, lbl: 'Clôturés', sub: 'indemnisés', accent: 'sage' },
        { icon: 'doc', num: 2, lbl: 'Assureurs', sub: 'MMA · AXA' },
      ]} />
      <Panel title="Suivi des sinistres" sub="Référence · objet · état" icon="shield" flush>
        <DataTable rowKey="id"
          columns={[
            { h: 'Référence', render: (r) => <span className={m.mono} style={{ fontSize: 12 }}>{r.id}</span> },
            { h: 'Objet', render: (r) => <b style={{ fontWeight: 600 }}>{r.objet}</b> },
            { h: 'Copropriété', render: (r) => r.copro },
            { h: 'Date', render: (r) => r.date },
            { h: 'Assureur', render: (r) => r.assureur },
            { h: 'Statut', render: (r) => <Pill kind={r.pill}>{r.statut}</Pill> },
          ]}
          rows={SIN}
          onRow={(r) => setDetail({
            title: r.objet, icon: 'shield',
            fields: [
              { k: 'Référence', v: r.id },
              { k: 'Copropriété', v: r.copro },
              { k: 'Date', v: r.date },
              { k: 'Assureur', v: r.assureur },
              { k: 'Statut', v: r.statut },
            ],
          })} />
      </Panel>
      <CreateModal open={open} onClose={() => setOpen(false)} title="Déclarer un sinistre" icon="shield"
        fields={[
          { label: 'Objet du sinistre', required: true, full: true },
          { label: 'Copropriété', type: 'select', options: COPRO_NAMES },
          { label: 'Date de survenance', type: 'date' },
          { label: 'Assureur', type: 'select', options: ['MMA', 'AXA', 'Allianz', 'Generali', 'Autre'] },
          { label: 'Description', type: 'textarea', full: true },
        ]}
        submitLabel="Déclarer" onDone={() => push({ kind: 'success', title: 'Sinistre déclaré', desc: "Déclaration transmise à l'assureur" })} />
      <DetailModal open={!!detail} onClose={() => setDetail(null)} title={detail?.title} icon={detail?.icon} fields={detail?.fields || []} footnote={detail?.footnote} />
    </>
  )
}
