'use client'

import { useState } from 'react'
import {
  DEMO_CARNET_ENTRETIEN,
  type InterventionCarnetDemo,
} from '@/components/administrateur-judiciaire/data/carnet-entretien'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { DetailModal } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { EmptyState } from '@/components/administrateur-judiciaire/ui/EmptyState'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { Tabs } from '@/components/administrateur-judiciaire/ui/Tabs'
import {
  champCoproprieteChoisie,
  sousTitreFige,
  titreListeVide,
  useCoproChoisie,
} from '@/components/administrateur-judiciaire/ui/copro-choisie'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { codeDeNomCopro, filtrerParCopro } from '@/lib/administrateur-judiciaire/domain/selection-copropriete'

/** Couleur de la pastille « État » d'une intervention (or pour tout autre état). */
const COULEUR_ETAT_INTERVENTION: Readonly<Partial<Record<string, string>>> = { fait: 'sage', 'en cours': 'amber' }

/**
 * Carnet d'entretien & technique (écran de démonstration). Le surtitre « Patrimoine » est celui de la maquette,
 * bien que l'écran soit rangé dans Technique & travaux. Affiché selon la copropriété choisie dans le sélecteur du haut
 * de page : interventions filtrées (colonne « Bâtiment »), « Interventions consignées » et « Sous garantie » (garantie
 * autre qu'un contrat) calculés sur elles, nouvelle intervention préremplie ; « Contrats actifs » et « Équipements
 * suivis » restent en dur (4, 12 ; marqués « Tous les mandats » quand une copropriété est choisie). Les onglets sont autonomes (non branchés).
 */
export function CarnetEntretienModule() {
  const { push } = useToast()
  const [interventionOuverte, setInterventionOuverte] = useState<InterventionCarnetDemo | null>(null)
  const { code, nom } = useCoproChoisie()
  const interventions = filtrerParCopro(DEMO_CARNET_ENTRETIEN, code, (intervention) => codeDeNomCopro(intervention[2]))
  const portee = nom ? `de ${nom}` : 'des copropriétés sous mandat'

  return (
    <>
      <PageHead
        eyebrow="Patrimoine"
        title="Carnet d'entretien & technique"
        lede={`Historique des interventions, équipements et contrats ${portee}.`}
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'form',
                icon: 'wrench',
                title: 'Nouvelle intervention',
                fields: [
                  champCoproprieteChoisie(nom),
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
            num: interventions.length,
            lbl: 'Interventions consignées',
          },
          {
            icon: 'shield',
            num: interventions.filter((intervention) => intervention[5] !== 'Contrat').length,
            lbl: 'Sous garantie',
            accent: 'sage',
          },
          {
            icon: 'doc',
            num: 4,
            lbl: 'Contrats actifs',
            sub: sousTitreFige(code),
          },
          {
            icon: 'building',
            num: 12,
            lbl: 'Équipements suivis',
            sub: sousTitreFige(code),
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
        {interventions.length === 0 ? (
          <EmptyState icon="wrench" title={titreListeVide('Aucune intervention consignée', nom)} />
        ) : (
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
                  <Pill kind={COULEUR_ETAT_INTERVENTION[intervention[6]] ?? 'gold'} noDot>
                    {intervention[6]}
                  </Pill>
                ),
              },
            ]}
            rows={interventions}
            onRow={setInterventionOuverte}
          />
        )}
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
