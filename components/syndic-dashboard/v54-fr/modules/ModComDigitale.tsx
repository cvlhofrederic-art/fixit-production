'use client'

// Communication digitale — port du ModComunicDigital du mockup v8 (FR).
// KPI d'envois + table des messages + modale de détail.

import { useState } from 'react'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Pill } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import DataTable from '../shared/DataTable'
import DetailModal from '../shared/DetailModal'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'

/** [objet, destinataire, date, statut] */
type CdRow = readonly [string, string, string, string]

const CD_ROWS: readonly CdRow[] = [
  ['Compte rendu de visite', 'Conseil syndical — Le Méridien', '03/06/2026', 'lu'],
  ['Demande de devis', 'Ent. Toitures Nord', '28/05/2026', 'distribué'],
  ['Relance impayé', 'SCI Belvédère', '30/05/2026', 'en attente'],
  ['Convocation AG', 'Copropriétaires — Le Clos des Vignes', '22/05/2026', 'lu'],
]

export default function ModComDigitale() {
  const { push } = useToast()
  const [open, setOpen] = useState<CdRow | null>(null)
  return (
    <>
      <PageHead eyebrow="Gestion courante" title="Communication digitale"
        lede="Messages internes et communication avec les intervenants."
        actions={<Button variant="gold" onClick={() => push({ kind: 'info', title: 'Nouveau message', desc: 'Rédiger un message' })}><Icon name="mail" />Nouveau message</Button>} />
      <KPIGrid items={[
        { icon: 'chart', num: 6, lbl: 'Total envoyés' },
        { icon: 'mail', num: 1, lbl: 'En attente', accent: 'amber' },
        { icon: 'check', num: 2, lbl: 'Distribués', accent: 'gold' },
        { icon: 'check', num: 3, lbl: 'Lus', accent: 'sage' },
      ]} />
      <Panel title="Messages" icon="mail" flush>
        <DataTable<CdRow>
          columns={[
            { h: 'Objet', render: (r) => <b>{r[0]}</b> },
            { h: 'Destinataire', render: (r) => r[1] },
            { h: 'Date', render: (r) => <span className={m.mono}>{r[2]}</span> },
            { h: 'Statut', render: (r) => <Pill kind={r[3] === 'lu' ? 'sage' : r[3] === 'distribué' ? 'gold' : 'amber'} noDot>{r[3]}</Pill> },
          ]}
          rows={[...CD_ROWS]} onRow={setOpen} />
      </Panel>
      <DetailModal open={!!open} onClose={() => setOpen(null)} title={open ? open[0] : ''} icon="mail"
        fields={open ? [{ k: 'Destinataire', v: open[1] }, { k: 'Date', v: open[2] }, { k: 'Statut', v: open[3] }] : []} />
    </>
  )
}
