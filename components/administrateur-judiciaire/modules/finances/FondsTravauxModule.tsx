'use client'

import { useState } from 'react'
import { DEMO_COPROPRIETES, DEMO_TOTAL_BUDGET } from '@/components/administrateur-judiciaire/data/coproprietes'
import {
  DEMO_LIGNES_FONDS_TRAVAUX,
  type LigneFondsTravaux,
} from '@/components/administrateur-judiciaire/data/fonds-travaux'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { DetailModal } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { formatEuros } from '@/lib/administrateur-judiciaire/domain/format'

/**
 * Fonds travaux obligatoire (loi ALUR, art. 14-2) par copropriété de démonstration. « Appel de cotisation » ouvre un
 * avis d'appel de fonds généré (simulé). Les sorties (12 100 €) sont saisies en dur.
 */
export function FondsTravauxModule() {
  const { push } = useToast()
  const [ligneOuverte, setLigneOuverte] = useState<LigneFondsTravaux | null>(null)

  return (
    <>
      <PageHead
        eyebrow="Comptabilité & finances · ALUR art. 14-2"
        title="Fonds travaux"
        lede="Fonds travaux obligatoire (cotisation annuelle ≥ 5 % du budget) par copropriété."
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'doc',
                icon: 'mail',
                title: "Avis d'appel de fonds",
                eyebrow: 'Syndic judiciaire · Cabinet Delaunay',
                docTitle: "Avis d'appel de fonds — 2ᵉ trimestre 2026",
                meta: 'Résidence Le Méridien · échéance 01/07/2026',
                lines: [
                  'Conformément au budget prévisionnel voté, vous êtes appelé à régler votre quote-part de charges pour le 2ᵉ trimestre 2026.',
                  {
                    h: 'Montant',
                  },
                  {
                    k: 'Quote-part trimestrielle',
                    v: '3 944 € / 4',
                  },
                  {
                    k: "Date d'exigibilité",
                    v: '01/07/2026',
                  },
                  {
                    k: 'Mode de règlement',
                    v: 'Virement — compte séparé',
                  },
                ],
              })
            }
          >
            <Icon name="bank" />
            Appel de cotisation
          </button>
        }
      />
      <Kpis
        items={[
          {
            icon: 'bank',
            num: formatEuros(DEMO_COPROPRIETES.reduce((total, copro) => total + copro.fondsTravaux, 0)),
            lbl: 'Solde total',
            accent: 'sage',
          },
          {
            icon: 'arrow',
            num: formatEuros(Math.round(DEMO_TOTAL_BUDGET * 0.05)),
            lbl: 'Cotisations annuelles',
          },
          {
            icon: 'wrench',
            num: formatEuros(12100),
            lbl: 'Sorties (travaux)',
          },
          {
            icon: 'alert',
            num: DEMO_COPROPRIETES.filter((copro) => copro.fondsTravaux < Math.round(copro.budget * 0.05)).length,
            lbl: 'Fonds insuffisant',
            accent: 'rust',
          },
        ]}
      />
      <Panel title="Fonds travaux par copropriété" icon="bank" flush>
        <DataTable
          columns={[
            {
              h: 'Copropriété',
              render: (ligne) => <b>{ligne[0]}</b>,
            },
            {
              h: 'Solde',
              render: (ligne) => <span className="mono">{ligne[1]}</span>,
            },
            {
              h: 'Cotisation annuelle',
              render: (ligne) => <span className="mono">{ligne[2]}</span>,
            },
            {
              h: 'Dernière contribution',
              render: (ligne) => <span className="mono">{ligne[3]}</span>,
            },
            {
              h: 'État',
              render: (ligne) => (
                <Pill kind={ligne[4] === 'suffisant' ? 'sage' : 'rust'} noDot>
                  {ligne[4]}
                </Pill>
              ),
            },
          ]}
          rows={DEMO_LIGNES_FONDS_TRAVAUX}
          onRow={setLigneOuverte}
        />
      </Panel>
      <DetailModal
        open={!!ligneOuverte}
        onClose={() => setLigneOuverte(null)}
        title={ligneOuverte ? ligneOuverte[0] : ''}
        icon="bank"
        fields={
          ligneOuverte
            ? [
                {
                  k: 'Solde du fonds',
                  v: ligneOuverte[1],
                },
                {
                  k: 'Cotisation annuelle',
                  v: ligneOuverte[2],
                },
                {
                  k: 'Dernière contribution',
                  v: ligneOuverte[3],
                },
                {
                  k: 'État',
                  v: ligneOuverte[4],
                },
              ]
            : []
        }
        footnote="Cotisation minimale de 5 % du budget prévisionnel (loi ALUR, art. 14-2)."
      />
    </>
  )
}
