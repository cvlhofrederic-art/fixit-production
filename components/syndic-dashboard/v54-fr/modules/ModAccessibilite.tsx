'use client'

// Accessibilité — port du ModAcessibilidade du mockup v8 (L6409-6438).
// Accessibilité des parties communes (CCH / loi 2005-102).

import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'
import InfoCard from '../shared/InfoCard'

type InfoTint = 'gold' | 'sage' | 'rust' | 'amber'
type CritRow = readonly [string, string, InfoTint]

const CRIT: CritRow[] = [
  ['Rampes extérieures (pente ≤ 6 %)', 'Accès au bâtiment', 'sage'],
  ['Largeur des portes (≥ 0,90 m)', 'Entrée + parties communes', 'sage'],
  ['Ascenseur accessible', 'Cabine ≥ 1,00 × 1,30 m', 'gold'],
  ['Sanitaires adaptés', 'Parties communes', 'amber'],
  ['Signalétique adaptée', 'Boutons + paliers', 'sage'],
  ['Cheminement continu sans obstacle', 'Hall + circulations', 'gold'],
]

export default function ModAccessibilite() {
  const { push } = useToast()
  return (
    <>
      <PageHead eyebrow="Conformité · CCH / Loi 2005-102" title="Accessibilité"
        lede="Accessibilité des parties communes de la copropriété (Code de la construction et de l'habitation)."
        actions={<Button variant="gold" onClick={() => push({ kind: 'info', title: 'Diagnostic', desc: "Lancer un diagnostic d'accessibilité" })}><Icon name="grad" />Diagnostic</Button>} />
      <KPIGrid items={[
        { icon: 'check', num: '4/6', lbl: 'Critères conformes', accent: 'sage' },
        { icon: 'wrench', num: 2, lbl: 'Points à traiter', accent: 'amber' },
        { icon: 'building', num: 4, lbl: 'Copropriétés suivies' },
      ]} />
      <Panel title="Critères d'accessibilité — parties communes" icon="grad">
        <div className={m.cardGrid3}>
          {CRIT.map(([t, s, c]) => <InfoCard key={t} t={t} s={s} c={c} />)}
        </div>
      </Panel>
    </>
  )
}
