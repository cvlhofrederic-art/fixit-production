'use client'

// Fonds travaux — port du ModFCR du mockup v8 (L7439-7473).
// Fonds travaux obligatoire loi ALUR art. 14-2 : cotisation annuelle ≥ 5 % du
// budget prévisionnel, détection des fonds sous-dotés par copropriété.

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
import { COPROS, TOTAL_BUDGET } from '../data/mock'
import { fmtEUR } from '../lib/format'

type FcrEtat = 'suffisant' | 'insuffisant'
type FcrRow = readonly [string, string, string, string, FcrEtat]

const FCR_DATES: Record<string, string> = {
  'Résidence Le Méridien': '12/03/2026',
  'Le Clos des Vignes': '22/04/2026',
  'Copropriété Les Tilleuls': '05/05/2026',
  'Villa Montaigne': '28/01/2026',
}

const FCR_ROWS: FcrRow[] = COPROS.map((c) => {
  const cot = Math.round(c.budget * 0.05)
  return [c.nom, fmtEUR(c.fondsTravaux), fmtEUR(cot), FCR_DATES[c.nom] || '—', c.fondsTravaux >= cot ? 'suffisant' : 'insuffisant']
})

export default function ModFondsTravaux() {
  const { push } = useToast()
  const [open, setOpen] = useState<FcrRow | null>(null)
  return (
    <>
      <PageHead eyebrow="Comptabilité & finances · ALUR art. 14-2" title="Fonds travaux"
        lede="Fonds travaux obligatoire (cotisation annuelle ≥ 5 % du budget) par copropriété."
        actions={<Button variant="gold" onClick={() => push({ kind: 'info', title: 'Appel de cotisation', desc: 'Émettre la cotisation au fonds travaux' })}><Icon name="bank" />Appel de cotisation</Button>} />
      <KPIGrid items={[
        { icon: 'bank', num: fmtEUR(COPROS.reduce((s, c) => s + c.fondsTravaux, 0)), lbl: 'Solde total', accent: 'sage' },
        { icon: 'arrow', num: fmtEUR(Math.round(TOTAL_BUDGET * 0.05)), lbl: 'Cotisations annuelles' },
        { icon: 'wrench', num: fmtEUR(12100), lbl: 'Sorties (travaux)' },
        { icon: 'alert', num: COPROS.filter((c) => c.fondsTravaux < Math.round(c.budget * 0.05)).length, lbl: 'Fonds insuffisant', accent: 'rust' },
      ]} />
      <Panel title="Fonds travaux par copropriété" icon="bank" flush>
        <DataTable
          columns={[
            { h: 'Copropriété', render: (r) => <b>{r[0]}</b> },
            { h: 'Solde', render: (r) => <span className={m.mono}>{r[1]}</span> },
            { h: 'Cotisation annuelle', render: (r) => <span className={m.mono}>{r[2]}</span> },
            { h: 'Dernière contribution', render: (r) => <span className={m.mono}>{r[3]}</span> },
            { h: 'État', render: (r) => <Pill kind={r[4] === 'suffisant' ? 'sage' : 'rust'} noDot>{r[4]}</Pill> },
          ]}
          rows={FCR_ROWS} onRow={setOpen} />
      </Panel>
      <DetailModal open={!!open} onClose={() => setOpen(null)} title={open ? open[0] : ''} icon="bank"
        fields={open ? [
          { k: 'Solde du fonds', v: open[1] },
          { k: 'Cotisation annuelle', v: open[2] },
          { k: 'Dernière contribution', v: open[3] },
          { k: 'État', v: open[4] },
        ] : []}
        footnote="Cotisation minimale de 5 % du budget prévisionnel (loi ALUR, art. 14-2)." />
    </>
  )
}
