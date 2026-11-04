'use client'

import { useState } from 'react'
import {
  DEMO_REMBOURSEMENTS_COPROPRIETAIRES,
  type RemboursementDemo,
} from '@/components/administrateur-judiciaire/data/remboursements'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { DetailModal } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { EmptyState } from '@/components/administrateur-judiciaire/ui/EmptyState'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis, type KpiProps } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { Tabs } from '@/components/administrateur-judiciaire/ui/Tabs'
import { champCoproprieteChoisie } from '@/components/administrateur-judiciaire/ui/copro-choisie'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { formatEuros } from '@/lib/administrateur-judiciaire/domain/format'
import { parserMontant } from '@/lib/administrateur-judiciaire/domain/import/csv'
import { codeLigneDemo, filtrerParCopro } from '@/lib/administrateur-judiciaire/domain/selection-copropriete'
import { useCodeCoproCourant, useCoproCourante } from '@/lib/administrateur-judiciaire/selection'

/** Indicateurs sans copropriété choisie (écran rendu seul) : valeurs saisies en dur. */
const INDICATEURS_TOUS_REMBOURSEMENTS: readonly KpiProps[] = [
  {
    icon: 'coin',
    num: 12,
    lbl: 'Remboursements (année)',
  },
  {
    icon: 'bank',
    num: '3 480 €',
    lbl: 'Total remboursé (année)',
  },
  {
    icon: 'clock',
    num: 2,
    lbl: 'À traiter',
    accent: 'amber',
  },
  {
    icon: 'check',
    num: 'via OB',
    lbl: 'Réglés en open banking',
    accent: 'sage',
  },
]

const aTraiter = (remboursements: readonly RemboursementDemo[]): number =>
  remboursements.filter((remboursement) => remboursement[4] === 'à traiter').length

/** Indicateurs de la copropriété choisie, calculés sur ses remboursements (total des remboursements réglés). */
function indicateursCopro(remboursements: readonly RemboursementDemo[]): KpiProps[] {
  const totalRegle = remboursements
    .filter((remboursement) => remboursement[4] === 'réglé')
    .reduce((total, remboursement) => total + (parserMontant(remboursement[2]) ?? 0), 0)
  return [
    {
      icon: 'coin',
      num: remboursements.length,
      lbl: 'Remboursements (année)',
    },
    {
      icon: 'bank',
      num: formatEuros(totalRegle),
      lbl: 'Total remboursé (année)',
    },
    {
      icon: 'clock',
      num: aTraiter(remboursements),
      lbl: 'À traiter',
      accent: 'amber',
    },
    {
      icon: 'check',
      num: 'via OB',
      lbl: 'Réglés en open banking',
      accent: 'sage',
    },
  ]
}

/**
 * Remboursements aux copropriétaires (barre latérale : section Copropriétaires ; surtitre « Comptabilité & finances »)
 * de la copropriété choisie en haut de page, indicateurs calculés sur eux ; sans copropriété choisie (écran rendu
 * seul), tous les remboursements et des indicateurs en dur (12, « 3 480 € », 2, « via OB »). Onglets autonomes
 * (« À traiter » par défaut, pastille du nombre à traiter). « Nouveau remboursement » est prérempli avec la
 * copropriété choisie.
 */
export function RemboursementsModule() {
  const { push } = useToast()
  const [remboursementOuvert, setRemboursementOuvert] = useState<RemboursementDemo | null>(null)
  const code = useCodeCoproCourant()
  const copro = useCoproCourante()
  const remboursements = filtrerParCopro(DEMO_REMBOURSEMENTS_COPROPRIETAIRES, code, (remboursement) =>
    codeLigneDemo(remboursement[5]),
  )

  return (
    <>
      <PageHead
        eyebrow="Comptabilité & finances"
        title="Remboursements"
        lede="Remboursements aux copropriétaires (trop-perçus, soldes créditeurs)."
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'form',
                icon: 'coin',
                title: 'Nouveau remboursement',
                fields: [
                  champCoproprieteChoisie(code && copro.nom),
                  {
                    label: 'Bénéficiaire',
                    placeholder: 'ex. M. Bernard, lot 12',
                    full: true,
                  },
                  {
                    label: 'Motif',
                    placeholder: 'ex. Trop-perçu de charges',
                    full: true,
                  },
                  {
                    label: 'Montant',
                    placeholder: 'ex. 142 €',
                    full: true,
                  },
                ],
                submitLabel: 'Enregistrer',
                toast: {
                  title: 'Remboursement enregistré',
                },
              })
            }
          >
            <Icon name="coin" />
            Nouveau remboursement
          </button>
        }
      />
      <Kpis items={code ? indicateursCopro(remboursements) : INDICATEURS_TOUS_REMBOURSEMENTS} />
      <Tabs
        defaultActive="att"
        tabs={[
          {
            id: 'att',
            icon: 'clock',
            label: 'À traiter',
            badge: code ? aTraiter(remboursements) : 2,
          },
          {
            id: 'reg',
            icon: 'check',
            label: 'Réglés',
          },
          {
            id: 'all',
            icon: 'folder',
            label: 'Tous (12 m)',
          },
        ]}
      />
      <Panel title="Remboursements" icon="coin" flush>
        {remboursements.length > 0 ? (
          <DataTable
            columns={[
              {
                h: 'Copropriétaire',
                render: (remboursement) => <b>{remboursement[0]}</b>,
              },
              {
                h: 'Motif',
                render: (remboursement) => remboursement[1],
              },
              {
                h: 'Montant',
                render: (remboursement) => <span className="mono">{remboursement[2]}</span>,
              },
              {
                h: 'Date',
                render: (remboursement) => <span className="mono">{remboursement[3]}</span>,
              },
              {
                h: 'Statut',
                render: (remboursement) => (
                  <Pill kind={remboursement[4] === 'réglé' ? 'sage' : 'amber'} noDot>
                    {remboursement[4]}
                  </Pill>
                ),
              },
            ]}
            rows={remboursements}
            onRow={setRemboursementOuvert}
          />
        ) : (
          <EmptyState icon="coin" title={`Aucun remboursement pour ${copro.nom}`} />
        )}
      </Panel>
      <DetailModal
        open={!!remboursementOuvert}
        onClose={() => setRemboursementOuvert(null)}
        title={remboursementOuvert ? remboursementOuvert[0] : ''}
        icon="coin"
        fields={
          remboursementOuvert
            ? [
                {
                  k: 'Motif',
                  v: remboursementOuvert[1],
                  full: true,
                },
                {
                  k: 'Montant',
                  v: remboursementOuvert[2],
                },
                {
                  k: 'Date',
                  v: remboursementOuvert[3],
                },
                {
                  k: 'Statut',
                  v: remboursementOuvert[4],
                },
              ]
            : []
        }
      />
    </>
  )
}
