'use client'

import { useState } from 'react'
import {
  DEMO_NPS_PAR_PRESTATAIRE,
  PILL_PAR_PROFIL_NPS,
  type NpsPrestataireDemo,
} from '@/components/administrateur-judiciaire/data/nps-prestataires'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { DetailModal } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'

/**
 * NPS post-intervention (barre latérale : « Enquête de satisfaction » ; surtitre « Qualité »).
 * Indicateurs en dur (42, « 68% », « 8,1 », 1). Une tendance commençant par « - » s'affiche en rouille,
 * toute autre en vert sauge.
 */
export function NpsPostInterventionModule() {
  const { push } = useToast()
  const [prestataireOuvert, setPrestataireOuvert] = useState<NpsPrestataireDemo | null>(null)

  return (
    <>
      <PageHead
        eyebrow="Qualité"
        title="NPS post-intervention"
        lede="Satisfaction des copropriétaires après chaque intervention, par prestataire."
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'form',
                icon: 'poll',
                title: 'Envoyer une enquête de satisfaction',
                fields: [
                  {
                    label: 'Copropriété',
                    type: 'select',
                    options: ['Résidence Le Méridien', 'Le Clos des Vignes', 'Copropriété Les Tilleuls', 'Villa Montaigne'],
                    full: true,
                  },
                  {
                    label: 'Destinataires',
                    type: 'select',
                    options: ['Tous les copropriétaires', 'Conseil syndical'],
                    full: true,
                  },
                  {
                    label: 'Modèle',
                    type: 'select',
                    options: ['Satisfaction générale', 'Qualité des travaux', 'Communication'],
                    full: true,
                  },
                ],
                submitLabel: 'Envoyer',
                toast: {
                  title: 'Enquête envoyée',
                },
              })
            }
          >
            <Icon name="poll" />
            Envoyer une enquête
          </button>
        }
      />
      <Kpis
        items={[
          {
            icon: 'mail',
            num: 42,
            lbl: 'Enquêtes envoyées (mois)',
          },
          {
            icon: 'chart',
            num: '68%',
            lbl: 'Taux de réponse',
            accent: 'sage',
          },
          {
            icon: 'poll',
            num: '8,1',
            lbl: 'NPS moyen',
            accent: 'gold',
          },
          {
            icon: 'siren',
            num: 1,
            lbl: 'Prestataires en baisse',
            accent: 'rust',
          },
        ]}
      />
      <Panel title="Satisfaction par prestataire" icon="poll" flush>
        <DataTable
          columns={[
            {
              h: 'Prestataire',
              render: (prestataire) => <b>{prestataire[0]}</b>,
            },
            {
              h: 'Note NPS',
              render: (prestataire) => <span className="mono">{prestataire[1]}/10</span>,
            },
            {
              h: 'Tendance',
              render: (prestataire) => (
                <span
                  style={{
                    color: prestataire[2].startsWith('-') ? 'var(--rust-600)' : 'var(--sage-600)',
                  }}
                >
                  {prestataire[2]}
                </span>
              ),
            },
            {
              h: 'Profil',
              render: (prestataire) => (
                <Pill kind={PILL_PAR_PROFIL_NPS[prestataire[3]]} noDot>
                  {prestataire[3]}
                </Pill>
              ),
            },
          ]}
          rows={DEMO_NPS_PAR_PRESTATAIRE}
          onRow={setPrestataireOuvert}
        />
      </Panel>
      <DetailModal
        open={!!prestataireOuvert}
        onClose={() => setPrestataireOuvert(null)}
        title={prestataireOuvert ? prestataireOuvert[0] : ''}
        icon="poll"
        fields={
          prestataireOuvert
            ? [
                {
                  k: 'Note NPS',
                  v: prestataireOuvert[1] + '/10',
                },
                {
                  k: 'Tendance',
                  v: prestataireOuvert[2],
                },
                {
                  k: 'Profil',
                  v: prestataireOuvert[3],
                },
              ]
            : []
        }
      />
    </>
  )
}
