'use client'

// Procurations & pouvoirs — port du ModProcuracoes du mockup v8 (L6479-6532).
// Règle FR des pouvoirs (art. 22 loi 1965) : 3 pouvoirs max, exception si total
// des voix ≤ 10 %, syndic exclu — contenu v8 repris VERBATIM (correction légale récente).

import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Pill } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'
import DataTable from '../shared/DataTable'
import InfoCard from '../shared/InfoCard'

type InfoTint = 'gold' | 'sage' | 'rust' | 'amber'
type RegleRow = readonly [string, string, InfoTint]
type ProcStatut = 'reçu' | 'à attribuer'
type ProcRow = readonly [string, string, string, string, ProcStatut]

const PROCS: ProcRow[] = [
  ['Le Méridien', 'M. Bernard (lot 12)', 'Awa Diallo', '42', 'reçu'],
  ['Le Méridien', 'Mme Olivier (lot 23)', 'P. Renaud (cons. synd.)', '38', 'reçu'],
  ['Le Clos des Vignes', 'SCI Belvédère', '— (en blanc)', '120', 'à attribuer'],
  ['Villa Montaigne', 'M. Lefèvre (lot 4)', 'C. Noël', '95', 'reçu'],
]

const REGLES: RegleRow[] = [
  ['Mandataire de son choix', 'Tout copropriétaire peut se faire représenter', 'sage'],
  ['Limite de 3 pouvoirs', 'Un mandataire ne peut recevoir plus de 3 délégations de vote', 'amber'],
  ['Exception 10 %', 'Plus de 3 pouvoirs possibles si le total des voix (siennes + mandants) ≤ 10 %', 'sage'],
  ['Syndic exclu', 'Le syndic ne peut être mandataire (art. 22)', 'rust'],
]

export default function ModProcurations() {
  const { push } = useToast()
  return (
    <>
      <PageHead eyebrow="Assemblée générale · Art. 22 Loi 1965" title="Procurations & pouvoirs"
        lede="Gestion des pouvoirs reçus pour l'assemblée générale et contrôle des règles de représentation."
        actions={<Button variant="gold" onClick={() => push({ kind: 'info', title: 'Enregistrer un pouvoir', desc: 'Ajouter un pouvoir reçu' })}><Icon name="doc" />Enregistrer un pouvoir</Button>} />
      <KPIGrid items={[
        { icon: 'doc', num: 3, lbl: 'Pouvoirs reçus', accent: 'sage' },
        { icon: 'alert', num: 1, lbl: 'Pouvoir en blanc', accent: 'amber' },
        { icon: 'scale', num: '10 %', lbl: 'Seuil dérogatoire (>3 pouvoirs)' },
      ]} />
      <Panel title="Règles de représentation (art. 22)" icon="scale">
        <div className={m.cardGrid}>
          {REGLES.map(([t, s, c]) => <InfoCard key={t} t={t} s={s} c={c} />)}
        </div>
      </Panel>
      <Panel title="Pouvoirs reçus — prochaine AG" icon="clipboard" flush>
        <DataTable
          columns={[
            { h: 'Copropriété', render: (r) => r[0] },
            { h: 'Mandant', render: (r) => r[1] },
            { h: 'Mandataire', render: (r) => r[2] },
            { h: 'Voix', render: (r) => <span className={m.mono}>{r[3]}</span> },
            { h: 'Statut', render: (r) => <Pill kind={r[4] === 'reçu' ? 'sage' : 'amber'} noDot>{r[4]}</Pill> },
          ]}
          rows={PROCS} />
      </Panel>
    </>
  )
}
