'use client'

import { useState } from 'react'
import { CHAMP_COPROPRIETE } from '@/components/administrateur-judiciaire/data/elements-communs'
import {
  DEMO_REMBOURSEMENTS_COPROPRIETAIRES,
  type RemboursementDemo,
} from '@/components/administrateur-judiciaire/data/remboursements'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { DetailModal } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { Tabs } from '@/components/administrateur-judiciaire/ui/Tabs'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'

/**
 * Remboursements aux copropriétaires (barre latérale : section Copropriétaires ; surtitre « Comptabilité & finances »).
 * Indicateurs en dur (12, « 3 480 € », 2, « via OB ») ; onglets autonomes (« À traiter » par défaut, pastille 2).
 */
export function RemboursementsModule() {
  const { push } = useToast()
  const [remboursementOuvert, setRemboursementOuvert] = useState<RemboursementDemo | null>(null)

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
                  CHAMP_COPROPRIETE,
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
      <Kpis
        items={[
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
        ]}
      />
      <Tabs
        defaultActive="att"
        tabs={[
          {
            id: 'att',
            icon: 'clock',
            label: 'À traiter',
            badge: 2,
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
          rows={DEMO_REMBOURSEMENTS_COPROPRIETAIRES}
          onRow={setRemboursementOuvert}
        />
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
