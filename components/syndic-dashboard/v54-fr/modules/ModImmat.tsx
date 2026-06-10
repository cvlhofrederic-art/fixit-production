'use client'

// Immatriculation au registre national — port du ModImmatriculation du mockup v8
// (L6868-6910). Registre national des copropriétés (CCH art. L711-1, tenu par l'ANAH).

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

type ImmatStatut = 'à jour' | 'à actualiser' | 'manquante'
type ImmatRow = readonly [string, string, string, string, ImmatStatut]

const IMMAT_ROWS: ImmatRow[] = [
  ['Résidence Le Méridien', 'AA-1234-567', '36', '12/03/2026', 'à jour'],
  ['Le Clos des Vignes', 'BB-2345-678', '48', 'À mettre à jour', 'à actualiser'],
  ['Copropriété Les Tilleuls', 'CC-3456-789', '24', '05/05/2026', 'à jour'],
  ['Villa Montaigne', '—', '12', 'Non immatriculée', 'manquante'],
]
const IMMAT_PILL: Record<ImmatStatut, PillKind> = { 'à jour': 'sage', 'à actualiser': 'amber', manquante: 'rust' }

export default function ModImmat() {
  const { push } = useToast()
  const [open, setOpen] = useState<ImmatRow | null>(null)
  return (
    <>
      <PageHead eyebrow="Conformité · CCH art. L711-1" title="Immatriculation au registre national"
        lede="Immatriculation et télédéclaration annuelle des copropriétés au registre national (obligation légale)."
        actions={<Button variant="gold" onClick={() => push({ kind: 'info', title: 'Télédéclaration', desc: 'Mettre à jour le registre national' })}><Icon name="bank" />Télédéclarer</Button>} />
      <KPIGrid items={[
        { icon: 'building', num: 3, lbl: 'Copropriétés immatriculées', accent: 'sage' },
        { icon: 'alert', num: 1, lbl: 'À actualiser', accent: 'amber' },
        { icon: 'siren', num: 1, lbl: 'Non immatriculée', accent: 'rust' },
        { icon: 'grid', num: 120, lbl: 'Lots déclarés' },
      ]} />
      <Panel title="Registre des copropriétés sous mandat" icon="bank" flush>
        <DataTable
          columns={[
            { h: 'Copropriété', render: (r) => <b>{r[0]}</b> },
            { h: "N° d'immatriculation", render: (r) => <span className={m.mono}>{r[1]}</span> },
            { h: 'Lots', render: (r) => <span className={m.mono}>{r[2]}</span> },
            { h: 'Dernière MAJ', render: (r) => r[3] },
            { h: 'Statut', render: (r) => <Pill kind={IMMAT_PILL[r[4]]} noDot>{r[4]}</Pill> },
          ]}
          rows={IMMAT_ROWS} onRow={setOpen} />
      </Panel>
      <DetailModal open={!!open} onClose={() => setOpen(null)} title={open ? open[0] : ''} icon="bank"
        fields={open ? [{ k: "N° d'immatriculation", v: open[1] }, { k: 'Nombre de lots', v: open[2] }, { k: 'Dernière mise à jour', v: open[3] }, { k: 'Statut', v: open[4] }] : []}
        footnote="Télédéclaration annuelle obligatoire (art. L711-1 et s. du CCH)." />
    </>
  )
}
