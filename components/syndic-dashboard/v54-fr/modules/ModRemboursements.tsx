'use client'

import { useState } from 'react'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Tabs } from '@/components/syndic-dashboard/v54/primitives/tabs'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Pill } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'
import DataTable from '../shared/DataTable'
import DetailModal from '../shared/DetailModal'

/** Remboursements — port FR du ModReembolsos du mockup v8
 * (trop-perçus et soldes créditeurs des copropriétaires). */

/** [copropriétaire, motif, montant, date, statut] */
type RbRow = [string, string, string, string, string]

const RB_ROWS: RbRow[] = [
  ['M. Lefèvre', 'Solde créditeur après régularisation', '85 €', '—', 'à traiter'],
  ['Mme Olivier', 'Trop-perçu sur charges 2025', '142 €', '28/05/2026', 'réglé'],
  ['M. Bernard', 'Remboursement provision travaux', '340 €', '—', 'à traiter'],
  ['SCI Belvédère', 'Annulation appel erroné', '210 €', '15/05/2026', 'réglé'],
]

export default function ModRemboursements() {
  const { push } = useToast()
  const [open, setOpen] = useState<RbRow | null>(null)
  return (
    <>
      <PageHead eyebrow="Comptabilité & finances" title="Remboursements"
        lede="Remboursements aux copropriétaires (trop-perçus, soldes créditeurs)."
        actions={<Button variant="gold" onClick={() => push({ kind: 'info', title: 'Nouveau remboursement', desc: 'Initier un remboursement' })}><Icon name="coin" />Nouveau remboursement</Button>} />
      <KPIGrid items={[
        { icon: 'coin', num: 12, lbl: 'Remboursements (année)' },
        { icon: 'bank', num: '3 480 €', lbl: 'Total remboursé (année)' },
        { icon: 'clock', num: 2, lbl: 'À traiter', accent: 'amber' },
        { icon: 'check', num: 'via OB', lbl: 'Réglés en open banking', accent: 'sage' },
      ]} />
      <Tabs defaultActive="att" tabs={[
        { id: 'att', icon: 'clock', label: 'À traiter', badge: 2 },
        { id: 'reg', icon: 'check', label: 'Réglés' },
        { id: 'all', icon: 'folder', label: 'Tous (12 m)' },
      ]} />
      <Panel title="Remboursements" icon="coin" flush>
        <DataTable<RbRow> columns={[
          { h: 'Copropriétaire', render: r => <b>{r[0]}</b> },
          { h: 'Motif', render: r => r[1] },
          { h: 'Montant', render: r => <span className={m.mono}>{r[2]}</span> },
          { h: 'Date', render: r => <span className={m.mono}>{r[3]}</span> },
          { h: 'Statut', render: r => <Pill kind={r[4] === 'réglé' ? 'sage' : 'amber'} noDot>{r[4]}</Pill> },
        ]} rows={RB_ROWS} onRow={setOpen} />
      </Panel>
      <DetailModal open={!!open} onClose={() => setOpen(null)} title={open ? open[0] : ''} icon="coin"
        fields={open ? [{ k: 'Motif', v: open[1], full: true }, { k: 'Montant', v: open[2] }, { k: 'Date', v: open[3] }, { k: 'Statut', v: open[4] }] : []} />
    </>
  )
}
