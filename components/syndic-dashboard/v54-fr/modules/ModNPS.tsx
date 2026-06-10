'use client'

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

/** NPS post-intervention — port FR du ModNPSPosIntervencao du mockup v8
 * (satisfaction des copropriétaires après intervention, par prestataire). */

/** [prestataire, note NPS, tendance, profil] */
type NpsRow = [string, string, string, string]

const NPS_ROWS: NpsRow[] = [
  ['Otis (ascenseurs)', '9,2', '+0,3', 'promoteur'],
  ['Ent. Toitures Nord', '8,1', '-0,4', 'passif'],
  ['Plomberie Centrale', '7,4', '-0,8', 'passif'],
  ['ThermoServices', '9,5', '+0,1', 'promoteur'],
  ['Élec Pro', '6,2', '-1,2', 'détracteur'],
]

const NPS_PILL: Record<string, PillKind> = { promoteur: 'sage', passif: 'amber', 'détracteur': 'rust' }

export default function ModNPS() {
  const { push } = useToast()
  const [open, setOpen] = useState<NpsRow | null>(null)
  return (
    <>
      <PageHead eyebrow="Qualité" title="NPS post-intervention"
        lede="Satisfaction des copropriétaires après chaque intervention, par prestataire."
        actions={<Button variant="gold" onClick={() => push({ kind: 'info', title: 'Envoyer une enquête', desc: 'Solliciter un avis après intervention' })}><Icon name="poll" />Envoyer une enquête</Button>} />
      <KPIGrid items={[
        { icon: 'mail', num: 42, lbl: 'Enquêtes envoyées (mois)' },
        { icon: 'chart', num: '68%', lbl: 'Taux de réponse', accent: 'sage' },
        { icon: 'poll', num: '8,1', lbl: 'NPS moyen', accent: 'gold' },
        { icon: 'siren', num: 1, lbl: 'Prestataires en baisse', accent: 'rust' },
      ]} />
      <Panel title="Satisfaction par prestataire" icon="poll" flush>
        <DataTable<NpsRow> columns={[
          { h: 'Prestataire', render: r => <b>{r[0]}</b> },
          { h: 'Note NPS', render: r => <span className={m.mono}>{r[1]}/10</span> },
          { h: 'Tendance', render: r => <span style={{ color: r[2].startsWith('-') ? 'var(--v54-rust-600)' : 'var(--v54-sage-600)' }}>{r[2]}</span> },
          { h: 'Profil', render: r => <Pill kind={NPS_PILL[r[3]]} noDot>{r[3]}</Pill> },
        ]} rows={NPS_ROWS} onRow={setOpen} />
      </Panel>
      <DetailModal open={!!open} onClose={() => setOpen(null)} title={open ? open[0] : ''} icon="poll"
        fields={open ? [{ k: 'Note NPS', v: open[1] + '/10' }, { k: 'Tendance', v: open[2] }, { k: 'Profil', v: open[3] }] : []} />
    </>
  )
}
