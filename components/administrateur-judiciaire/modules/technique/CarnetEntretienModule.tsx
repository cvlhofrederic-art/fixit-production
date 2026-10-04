'use client'

import { useState } from 'react'
import {
  DEMO_CARNET_ENTRETIEN,
  type InterventionCarnetDemo,
} from '@/components/administrateur-judiciaire/data/carnet-entretien'
import { CHAMP_COPROPRIETE } from '@/components/administrateur-judiciaire/data/elements-communs'
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
 * Carnet d'entretien & technique (écran de démonstration). Le surtitre « Patrimoine » est celui de la maquette,
 * bien que l'écran soit rangé dans Technique & travaux. Les onglets sont autonomes (non branchés) et les
 * indicateurs sont en dur.
 */
export function CarnetEntretienModule() {
  const { push } = useToast()
  const [interventionOuverte, setInterventionOuverte] = useState<InterventionCarnetDemo | null>(null)

  return (
    <>
      <PageHead
        eyebrow="Patrimoine"
        title="Carnet d'entretien & technique"
        lede="Historique des interventions, équipements et contrats des copropriétés sous mandat."
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'form',
                icon: 'wrench',
                title: 'Nouvelle intervention',
                fields: [
                  CHAMP_COPROPRIETE,
                  {
                    label: 'Prestataire',
                    type: 'select',
                    options: [
                      'Atlantic Plomberie SARL',
                      'ELEC92 Services',
                      'OTIS Maintenance',
                      'Couverture Île-de-France',
                      'Vert Pro Espaces',
                    ],
                    full: true,
                  },
                  {
                    label: 'Nature',
                    placeholder: "Décrivez l'intervention",
                    full: true,
                  },
                  {
                    label: 'Date souhaitée',
                    placeholder: 'JJ/MM/AAAA',
                    full: true,
                  },
                ],
                submitLabel: 'Enregistrer',
                toast: {
                  title: 'Intervention créée',
                },
              })
            }
          >
            <Icon name="wrench" />
            Nouvelle intervention
          </button>
        }
      />
      <Kpis
        items={[
          {
            icon: 'wrench',
            num: 5,
            lbl: 'Interventions consignées',
          },
          {
            icon: 'shield',
            num: 3,
            lbl: 'Sous garantie',
            accent: 'sage',
          },
          {
            icon: 'doc',
            num: 4,
            lbl: 'Contrats actifs',
          },
          {
            icon: 'building',
            num: 12,
            lbl: 'Équipements suivis',
          },
        ]}
      />
      <Tabs
        defaultActive="carnet"
        tabs={[
          {
            id: 'carnet',
            icon: 'clipboard',
            label: "Carnet d'entretien",
          },
          {
            id: 'equip',
            icon: 'wrench',
            label: 'Équipements',
          },
          {
            id: 'contrats',
            icon: 'doc',
            label: 'Contrats',
          },
          {
            id: 'etat',
            icon: 'fact',
            label: 'État daté',
          },
          {
            id: 'dpe',
            icon: 'bolt',
            label: 'DPE collectif',
          },
        ]}
      />
      <Panel title="Interventions" icon="wrench" flush>
        <DataTable
          columns={[
            {
              h: 'Date',
              render: (intervention) => <span className="mono">{intervention[0]}</span>,
            },
            {
              h: 'Nature',
              render: (intervention) => <b>{intervention[1]}</b>,
            },
            {
              h: 'Bâtiment',
              render: (intervention) => intervention[2],
            },
            {
              h: 'Prestataire',
              render: (intervention) => intervention[3],
            },
            {
              h: 'Coût',
              render: (intervention) => <span className="mono">{intervention[4]}</span>,
            },
            {
              h: 'Garantie',
              render: (intervention) => <Pill noDot>{intervention[5]}</Pill>,
            },
            {
              h: 'État',
              render: (intervention) => (
                <Pill kind={intervention[6] === 'fait' ? 'sage' : intervention[6] === 'en cours' ? 'amber' : 'gold'} noDot>
                  {intervention[6]}
                </Pill>
              ),
            },
          ]}
          rows={DEMO_CARNET_ENTRETIEN}
          onRow={setInterventionOuverte}
        />
      </Panel>
      <DetailModal
        open={!!interventionOuverte}
        onClose={() => setInterventionOuverte(null)}
        title={interventionOuverte ? interventionOuverte[1] : ''}
        icon="wrench"
        fields={
          interventionOuverte
            ? [
                {
                  k: 'Date',
                  v: interventionOuverte[0],
                },
                {
                  k: 'Bâtiment',
                  v: interventionOuverte[2],
                },
                {
                  k: 'Prestataire',
                  v: interventionOuverte[3],
                },
                {
                  k: 'Coût',
                  v: interventionOuverte[4],
                },
                {
                  k: 'Garantie',
                  v: interventionOuverte[5],
                },
                {
                  k: 'État',
                  v: interventionOuverte[6],
                },
              ]
            : []
        }
      />
    </>
  )
}
