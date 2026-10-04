'use client'

import { useState } from 'react'
import {
  DEMO_PARC_ASCENSEURS,
  PILL_PAR_ETAT_ASCENSEUR,
  type AscenseurDemo,
} from '@/components/administrateur-judiciaire/data/ascenseurs'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { DetailModal } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'

/**
 * Gestion des ascenseurs (parc de démonstration, contrôle technique quinquennal — décret 2004-964).
 * Indicateurs en dur (4 / 2 / 1 / 1). Le formulaire « Nouvel ascenseur » est simulé (toast « Ascenseur enregistré ») ;
 * sa liste « Ascensoriste » reprend des prestataires sans rapport avec les ascenseurs (comme la maquette).
 */
export function AscenseursModule() {
  const { push } = useToast()
  const [ascenseurOuvert, setAscenseurOuvert] = useState<AscenseurDemo | null>(null)

  return (
    <>
      <PageHead
        eyebrow="Patrimoine · Décret 2004-964"
        title="Gestion des ascenseurs"
        lede="Contrats d'entretien et contrôle technique quinquennal des ascenseurs des copropriétés."
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'form',
                icon: 'building',
                title: 'Nouvel ascenseur',
                fields: [
                  {
                    label: 'Copropriété',
                    type: 'select',
                    options: ['Résidence Le Méridien', 'Le Clos des Vignes', 'Copropriété Les Tilleuls', 'Villa Montaigne'],
                    full: true,
                  },
                  {
                    label: 'Référence appareil',
                    placeholder: 'ex. ASC-A-2024',
                    full: true,
                  },
                  {
                    label: 'Ascensoriste',
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
                    label: 'Date du dernier contrôle',
                    placeholder: 'JJ/MM/AAAA',
                    full: true,
                  },
                ],
                submitLabel: 'Enregistrer',
                toast: {
                  title: 'Ascenseur enregistré',
                },
              })
            }
          >
            <Icon name="plus" />
            Ajouter
          </button>
        }
      />
      <Kpis
        items={[
          {
            icon: 'building',
            num: 4,
            lbl: 'Ascenseurs suivis',
          },
          {
            icon: 'check',
            num: 2,
            lbl: 'En conformité',
            accent: 'sage',
          },
          {
            icon: 'clock',
            num: 1,
            lbl: 'Contrôle < 90 j',
            accent: 'amber',
          },
          {
            icon: 'siren',
            num: 1,
            lbl: 'Inspection en retard',
            accent: 'rust',
          },
        ]}
      />
      <Panel title="Parc d'ascenseurs" icon="building" flush>
        <DataTable
          columns={[
            {
              h: 'Ascenseur',
              render: (ascenseur) => <b>{ascenseur[0]}</b>,
            },
            {
              h: 'Bâtiment',
              render: (ascenseur) => ascenseur[1],
            },
            {
              h: 'Entretien',
              render: (ascenseur) => ascenseur[2],
            },
            {
              h: 'Dernier contrôle',
              render: (ascenseur) => <span className="mono">{ascenseur[3]}</span>,
            },
            {
              h: 'Prochain',
              render: (ascenseur) => <span className="mono">{ascenseur[4]}</span>,
            },
            {
              h: 'État',
              render: (ascenseur) => (
                <Pill kind={PILL_PAR_ETAT_ASCENSEUR[ascenseur[5]]} noDot>
                  {ascenseur[5]}
                </Pill>
              ),
            },
          ]}
          rows={DEMO_PARC_ASCENSEURS}
          onRow={setAscenseurOuvert}
        />
      </Panel>
      <DetailModal
        open={!!ascenseurOuvert}
        onClose={() => setAscenseurOuvert(null)}
        title={ascenseurOuvert ? `${ascenseurOuvert[0]} — ${ascenseurOuvert[1]}` : ''}
        icon="building"
        fields={
          ascenseurOuvert
            ? [
                {
                  k: "Société d'entretien",
                  v: ascenseurOuvert[2],
                },
                {
                  k: 'Dernier contrôle technique',
                  v: ascenseurOuvert[3],
                },
                {
                  k: 'Prochain contrôle',
                  v: ascenseurOuvert[4],
                },
                {
                  k: 'État',
                  v: ascenseurOuvert[5],
                },
              ]
            : []
        }
        footnote="Contrôle technique quinquennal obligatoire (décret n° 2004-964)."
      />
    </>
  )
}
