'use client'

// Performance énergétique (DPE) — port du ModCertEnerg du mockup v8 (L6604-6654).
// DPE collectif et audit énergétique (loi Climat & Résilience), étiquettes A à G.

import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Pill, type PillKind } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'
import DataTable from '../shared/DataTable'
import InfoCard from '../shared/InfoCard'

type DpeTint = 'gold' | 'sage' | 'rust' | 'amber'
type DpeLabel = readonly [string, DpeTint]
type DpeRow = readonly [string, string, string, PillKind]

const DPE_LBL: DpeLabel[] = [['A', 'sage'], ['B', 'sage'], ['C', 'gold'], ['D', 'gold'], ['E', 'amber'], ['F', 'rust'], ['G', 'rust']]
const DPE_ROWS: DpeRow[] = [
  ['Le Méridien', 'D', "Valide jusqu'en 2031", 'sage'],
  ['Le Clos des Vignes', 'E', 'Audit énergétique recommandé', 'amber'],
  ['Les Tilleuls', 'F', 'Passoire — travaux à prévoir', 'rust'],
  ['Villa Montaigne', 'C', "Valide jusqu'en 2030", 'sage'],
]

export default function ModDPE() {
  const { push } = useToast()
  return (
    <>
      <PageHead eyebrow="Conformité · Loi Climat & Résilience" title="Performance énergétique (DPE)"
        lede="DPE collectif et audit énergétique des copropriétés sous mandat (étiquettes A à G)."
        actions={<Button variant="gold" onClick={() => push({ kind: 'info', title: 'Audit énergétique', desc: 'Planifier un audit énergétique' })}><Icon name="bolt" />Audit énergétique</Button>} />
      <KPIGrid items={[
        { icon: 'bolt', num: 'D', lbl: 'Étiquette moyenne du parc', accent: 'gold' },
        { icon: 'building', num: 4, lbl: 'DPE collectifs' },
        { icon: 'alert', num: 1, lbl: 'Passoire (F/G)', accent: 'rust' },
        { icon: 'clipboard', num: 1, lbl: 'Audit recommandé', accent: 'amber' },
      ]} />
      <Panel title="Échelle des étiquettes énergétiques" icon="bolt">
        <div className={m.cardGrid4}>
          {DPE_LBL.map(([l, c]) => <InfoCard key={l} t={`Classe ${l}`} s={l === 'A' ? 'Très performant' : l === 'G' ? 'Très énergivore' : '—'} c={c} />)}
        </div>
      </Panel>
      <Panel title="DPE par copropriété" icon="building" flush>
        <DataTable
          columns={[
            { h: 'Copropriété', render: (r) => <b>{r[0]}</b> },
            { h: 'Étiquette', render: (r) => <Pill kind={r[3]} noDot>Classe {r[1]}</Pill> },
            { h: 'Statut', render: (r) => r[2] },
          ]}
          rows={DPE_ROWS} />
      </Panel>
    </>
  )
}
