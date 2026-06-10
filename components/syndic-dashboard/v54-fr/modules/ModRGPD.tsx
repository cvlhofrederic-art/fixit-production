'use client'

// Centre RGPD — port du ModRGPDCenter du mockup v8 (L6371-6406).
// Le syndic judiciaire est responsable de traitement des données du syndicat.

import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'
import InfoCard from '../shared/InfoCard'

type InfoTint = 'gold' | 'sage' | 'rust' | 'amber'
type RightRow = readonly [string, string, InfoTint]

const RIGHTS: RightRow[] = [
  ["Droit d'accès", 'Art. 15 · copie des données personnelles', 'sage'],
  ['Droit de rectification', 'Art. 16 · correction de données inexactes', 'sage'],
  ["Droit d'opposition", 'Art. 21 · cesser un traitement', 'amber'],
  ["Droit à l'effacement", 'Art. 17 · suppression des données', 'rust'],
  ['Droit à la portabilité', 'Art. 20 · export structuré', 'sage'],
  ['Droit à la limitation', 'Art. 18 · suspendre le traitement', 'amber'],
]

export default function ModRGPD() {
  const { push } = useToast()
  return (
    <>
      <PageHead eyebrow="Conformité · RGPD" title="Centre RGPD"
        lede="Le syndic judiciaire est responsable de traitement des données du syndicat des copropriétaires."
        actions={<Button variant="gold" onClick={() => push({ kind: 'info', title: 'Nouvelle demande', desc: "Enregistrer une demande d'exercice de droits" })}><Icon name="shield" />Nouvelle demande</Button>} />
      <KPIGrid items={[
        { icon: 'shield', num: 3, lbl: 'Traitements déclarés' },
        { icon: 'clock', num: '1 mois', lbl: 'Délai légal de réponse', accent: 'gold' },
        { icon: 'check', num: 0, lbl: 'Demandes en attente', accent: 'sage' },
        { icon: 'doc', num: 'À jour', lbl: 'Registre des traitements', accent: 'sage' },
      ]} />
      <Panel title="Registre des traitements" icon="doc">
        <div className={m.cardGrid3}>
          <InfoCard t="Données des copropriétaires" s="Coordonnées · lots · quotes-parts" c="sage" />
          <InfoCard t="Comptabilité du syndicat" s="Appels de fonds · soldes · compte séparé" c="sage" />
          <InfoCard t="Contentieux & impayés" s="Procédures · mises en demeure" c="amber" />
        </div>
      </Panel>
      <Panel title="Droits du titulaire — réponse sous 1 mois" icon="shield">
        <div className={m.cardGrid3}>
          {RIGHTS.map(([t, s, c]) => <InfoCard key={t} t={t} s={s} c={c} />)}
        </div>
      </Panel>
    </>
  )
}
