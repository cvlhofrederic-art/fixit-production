'use client'

// Budget prévisionnel — port du ModBudget du mockup v8 (L7510-7542).
// Suivi du budget voté par poste (voté / réalisé / reste à engager) avec
// sélecteur de copropriété (CoproSelect partagé, valeur par code).

import { useState } from 'react'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'
import DataTable from '../shared/DataTable'
import CoproSelect from '../shared/CoproSelect'
import { COPROS, byCode } from '../data/mock'
import { fmtEUR } from '../lib/format'

type BudPoste = readonly [string, number]
type BudRow = readonly [string, string, string, string]

const BUD_POSTES: BudPoste[] = [
  ['Entretien & maintenance', 0.34],
  ['Honoraires syndic', 0.16],
  ['Assurances', 0.10],
  ['Énergie & fluides', 0.26],
  ['Espaces verts', 0.06],
  ['Provisions diverses', 0.08],
]

export default function ModBudget() {
  const { push } = useToast()
  const [code, setCode] = useState(COPROS[0].code)
  const c = byCode(code)
  const rows: BudRow[] = BUD_POSTES.map(([lbl, p]) => {
    const vote = Math.round(c.budget * p)
    const real = Math.round(c.depense * p)
    return [lbl, fmtEUR(vote), fmtEUR(real), fmtEUR(vote - real)]
  })
  const tauxReal = Math.round((c.depense / c.budget) * 100)
  return (
    <>
      <PageHead eyebrow="Comptabilité & finances" title="Budget prévisionnel"
        lede="Suivi du budget voté par poste : engagé, réalisé et reste à engager."
        actions={<>
          <CoproSelect value={code} onChange={setCode} />
          <Button variant="gold" onClick={() => push({ kind: 'info', title: 'Exporter', desc: 'Exporter le suivi budgétaire' })}><Icon name="download" />Exporter</Button>
        </>} />
      <KPIGrid items={[
        { icon: 'bank', num: fmtEUR(c.budget), lbl: 'Budget voté' },
        { icon: 'coin', num: fmtEUR(c.depense), lbl: 'Réalisé', accent: 'gold' },
        { icon: 'check', num: `${tauxReal} %`, lbl: 'Taux de réalisation', accent: tauxReal > 90 ? 'amber' : 'sage' },
        { icon: 'chart', num: fmtEUR(c.budget - c.depense), lbl: 'Reste à engager', accent: 'sage' },
      ]} />
      <Panel title={`Postes budgétaires — ${c.nom}`} icon="chart" flush>
        <DataTable
          columns={[
            { h: 'Poste', render: (r) => <b>{r[0]}</b> },
            { h: 'Voté', render: (r) => <span className={m.mono}>{r[1]}</span> },
            { h: 'Réalisé', render: (r) => <span className={m.mono}>{r[2]}</span> },
            { h: 'Reste', render: (r) => <span className={m.mono} style={{ color: 'var(--v54-sage-600)' }}>{r[3]}</span> },
          ]}
          rows={rows} />
      </Panel>
    </>
  )
}
