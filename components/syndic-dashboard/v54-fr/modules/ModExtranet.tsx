'use client'

import { useState } from 'react'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Pill } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'
import DataTable from '../shared/DataTable'
import DetailModal from '../shared/DetailModal'

/** Extranet copropriétaires — port FR du ModExtranet du mockup v8
 * (comptes en ligne : documents, soldes et demandes). */

/** [nom, email, lot, solde, accès] */
type ExtRow = [string, string, string, string, string]

const EXT_ROWS: ExtRow[] = [
  ['M. Bernard', 'j.bernard@email.fr', 'Le Méridien · lot 12', '+340 €', 'actif'],
  ['Mme Olivier', 'm.olivier@email.fr', 'Le Méridien · lot 23', '0 €', 'actif'],
  ['SCI Belvédère', 'contact@sci-belvedere.fr', 'Le Clos des Vignes · lot 5', '-1 240 €', 'inactif'],
  ['M. Lefèvre', 'p.lefevre@email.fr', 'Villa Montaigne · lot 4', '+85 €', 'actif'],
  ['Mme Garnier', 'c.garnier@email.fr', 'Les Tilleuls · lot 9', '-420 €', 'actif'],
]

export default function ModExtranet() {
  const { push } = useToast()
  const [open, setOpen] = useState<ExtRow | null>(null)
  return (
    <>
      <PageHead eyebrow="Gestion courante" title="Extranet copropriétaires"
        lede="Espace en ligne des copropriétaires : documents, soldes et demandes."
        actions={<Button variant="gold" onClick={() => push({ kind: 'info', title: 'Inviter', desc: 'Envoyer un accès extranet' })}><Icon name="mail" />Inviter un copropriétaire</Button>} />
      <KPIGrid items={[
        { icon: 'users', num: 5, lbl: 'Comptes', accent: 'sage' },
        { icon: 'chart', num: '80%', lbl: 'Taux de connexion' },
        { icon: 'folder', num: 24, lbl: 'Documents partagés' },
        { icon: 'chat', num: 2, lbl: 'Demandes en ligne', accent: 'amber' },
      ]} />
      <Panel title="Comptes copropriétaires" icon="team" flush>
        <DataTable<ExtRow>
          columns={[
            { h: 'Nom', render: r => <b>{r[0]}</b> },
            { h: 'Email', render: r => <span style={{ color: 'var(--v54-navy-500)' }}>{r[1]}</span> },
            { h: 'Lot', render: r => r[2] },
            { h: 'Solde', render: r => <span className={m.mono} style={{ color: r[3].startsWith('-') ? 'var(--v54-rust-600)' : 'var(--v54-ink)' }}>{r[3]}</span> },
            { h: 'Accès', render: r => <Pill kind={r[4] === 'actif' ? 'sage' : 'rust'} noDot>{r[4]}</Pill> },
          ]}
          rows={EXT_ROWS} onRow={setOpen} />
      </Panel>
      <DetailModal open={!!open} onClose={() => setOpen(null)} title={open ? open[0] : ''} icon="users"
        fields={open ? [{ k: 'Email', v: open[1] }, { k: 'Lot', v: open[2] }, { k: 'Solde', v: open[3] }, { k: 'Accès extranet', v: open[4] }] : []} />
    </>
  )
}
