'use client'

// Saisie de factures — port du ModLancamentoFat du mockup v8 (L7543-7579).
// Import, ventilation comptable et validation des factures fournisseurs
// (onglets Importer / À valider / Traitées / Anomalies).

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

type LfStatut = 'à valider' | 'validée' | 'anomalie'
type LfRow = readonly [string, string, string, string, LfStatut]

const LF_ROWS: LfRow[] = [
  ['FAC-2026-051', 'Plomberie Centrale', '620 €', 'Entretien', 'à valider'],
  ['FAC-2026-044', 'Otis', '480 €', 'Entretien', 'validée'],
  ['FAC-2026-038', 'Generali', '1 240 €', 'Assurances', 'validée'],
  ['FAC-2026-029', 'Élec Pro', '312 €', 'Énergie', 'anomalie'],
]
const LF_PILL: Record<LfStatut, PillKind> = { 'à valider': 'amber', 'validée': 'sage', anomalie: 'rust' }

export default function ModSaisieFactures() {
  const { push } = useToast()
  const [open, setOpen] = useState<LfRow | null>(null)
  return (
    <>
      <PageHead eyebrow="Comptabilité & finances" title="Saisie de factures"
        lede="Import, ventilation comptable et validation des factures fournisseurs."
        actions={<Button variant="gold" onClick={() => push({ kind: 'success', title: 'Import', desc: 'Factures importées et pré-ventilées' })}><Icon name="plus" />Importer des factures</Button>} />
      <KPIGrid items={[
        { icon: 'doc', num: 4, lbl: 'Total factures' },
        { icon: 'clock', num: 1, lbl: 'À valider', accent: 'amber' },
        { icon: 'check', num: 2, lbl: 'Validées', accent: 'sage' },
        { icon: 'alert', num: 1, lbl: 'Anomalies', accent: 'rust' },
      ]} />
      <Tabs defaultActive="imp" tabs={[
        { id: 'imp', icon: 'plus', label: 'Importer' },
        { id: 'att', icon: 'clock', label: 'À valider', badge: 1 },
        { id: 'trt', icon: 'check', label: 'Traitées' },
        { id: 'ano', icon: 'alert', label: 'Anomalies', badge: 1 },
      ]} />
      <Panel title="Factures" icon="doc" flush>
        <DataTable
          columns={[
            { h: 'Facture', render: (r) => <span className={m.mono}>{r[0]}</span> },
            { h: 'Fournisseur', render: (r) => <b>{r[1]}</b> },
            { h: 'Montant', render: (r) => <span className={m.mono}>{r[2]}</span> },
            { h: 'Poste', render: (r) => <Pill noDot>{r[3]}</Pill> },
            { h: 'Statut', render: (r) => <Pill kind={LF_PILL[r[4]]} noDot>{r[4]}</Pill> },
          ]}
          rows={LF_ROWS} onRow={setOpen} />
      </Panel>
      <DetailModal open={!!open} onClose={() => setOpen(null)} title={open ? open[1] : ''} icon="doc"
        fields={open ? [
          { k: 'N° facture', v: open[0] },
          { k: 'Montant', v: open[2] },
          { k: 'Poste comptable', v: open[3] },
          { k: 'Statut', v: open[4] },
        ] : []} />
    </>
  )
}
