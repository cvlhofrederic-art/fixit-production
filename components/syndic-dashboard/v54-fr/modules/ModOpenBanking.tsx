'use client'

// Open banking — port du ModOpenBanking du mockup v8 (L7474-7509).
// Synchronisation des comptes séparés (art. 18 loi 1965) et rapprochement
// automatique des transactions.

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

type ObStatut = 'rapprochée' | 'à revoir'
type ObRow = readonly [string, string, string, string, ObStatut]

const OB_ROWS: ObRow[] = [
  ['04/06/2026', 'Virement charges — M. Bernard', '+340 €', 'Compte séparé Le Méridien', 'rapprochée'],
  ['03/06/2026', 'Facture Plomberie Centrale', '-620 €', 'Compte séparé Le Méridien', 'rapprochée'],
  ['02/06/2026', 'Prélèvement inconnu', '-49 €', 'Compte séparé Les Tilleuls', 'à revoir'],
  ['01/06/2026', 'Cotisation fonds travaux', '+1 200 €', 'Compte séparé Villa Montaigne', 'rapprochée'],
]

export default function ModOpenBanking() {
  const { push } = useToast()
  const [open, setOpen] = useState<ObRow | null>(null)
  return (
    <>
      <PageHead eyebrow="Comptabilité & finances" title="Open banking — rapprochement automatique"
        lede="Synchronisation des comptes séparés et rapprochement automatique des transactions."
        actions={<Button variant="gold" onClick={() => push({ kind: 'success', title: 'Synchronisation', desc: 'Comptes séparés synchronisés' })}><Icon name="arrow" />Synchroniser</Button>} />
      <KPIGrid items={[
        { icon: 'bank', num: 4, lbl: 'Comptes connectés', accent: 'sage' },
        { icon: 'arrow', num: 128, lbl: 'Transactions sync (mois)' },
        { icon: 'check', num: '96 %', lbl: 'Auto-rapprochées', accent: 'sage' },
        { icon: 'alert', num: 1, lbl: 'À revoir', accent: 'amber' },
      ]} />
      <Tabs defaultActive="cpt" tabs={[
        { id: 'cpt', icon: 'bank', label: 'Comptes' },
        { id: 'sync', icon: 'arrow', label: 'Sync récente' },
        { id: 'rev', icon: 'alert', label: 'À revoir', badge: 1 },
      ]} />
      <Panel title="Transactions récentes" icon="bank" flush>
        <DataTable
          columns={[
            { h: 'Date', render: (r) => <span className={m.mono}>{r[0]}</span> },
            { h: 'Libellé', render: (r) => <b>{r[1]}</b> },
            { h: 'Montant', render: (r) => <span className={m.mono} style={{ color: r[2].startsWith('-') ? 'var(--v54-rust-600)' : 'var(--v54-sage-600)' }}>{r[2]}</span> },
            { h: 'Compte', render: (r) => <span style={{ fontSize: 12, color: 'var(--v54-navy-500)' }}>{r[3]}</span> },
            { h: 'Rapprochement', render: (r) => <Pill kind={r[4] === 'rapprochée' ? 'sage' : 'amber'} noDot>{r[4]}</Pill> },
          ]}
          rows={OB_ROWS} onRow={setOpen} />
      </Panel>
      <DetailModal open={!!open} onClose={() => setOpen(null)} title={open ? open[1] : ''} icon="bank"
        fields={open ? [
          { k: 'Date', v: open[0] },
          { k: 'Montant', v: open[2] },
          { k: 'Compte', v: open[3] },
          { k: 'Rapprochement', v: open[4] },
        ] : []} />
    </>
  )
}
