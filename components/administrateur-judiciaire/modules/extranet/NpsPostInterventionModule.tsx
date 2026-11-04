'use client'

import { useState } from 'react'
import {
  DEMO_NPS_PAR_PRESTATAIRE,
  PILL_PAR_PROFIL_NPS,
  type NpsPrestataireDemo,
} from '@/components/administrateur-judiciaire/data/nps-prestataires'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { DetailModal } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { EmptyState } from '@/components/administrateur-judiciaire/ui/EmptyState'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import {
  champCoproprieteChoisie,
  sousTitreFige,
  titreListeVide,
  useCoproChoisie,
} from '@/components/administrateur-judiciaire/ui/copro-choisie'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { codeLigneDemo, filtrerParCopro } from '@/lib/administrateur-judiciaire/domain/selection-copropriete'

/** Valeur d'une note ou d'une tendance saisie à virgule décimale (« -1,2 » → -1.2). */
const valeurDecimale = (texte: string): number => Number(texte.replace(',', '.'))

/** Baisse d'au moins un point : seuil de l'indicateur « Prestataires en baisse ». */
const SEUIL_BAISSE_NPS = -1

/** Note NPS moyenne des prestataires, à une décimale et virgule (« 8,1 ») ; « — » sans prestataire. */
function noteMoyenne(prestataires: readonly NpsPrestataireDemo[]): string {
  if (prestataires.length === 0) return '—'
  const somme = prestataires.reduce((total, prestataire) => total + valeurDecimale(prestataire[1]), 0)
  return (somme / prestataires.length).toFixed(1).replace('.', ',')
}

/**
 * NPS post-intervention (barre latérale : « Enquête de satisfaction » ; surtitre « Qualité »), affiché selon la
 * copropriété choisie dans le sélecteur du haut de page : prestataires intervenus sur elle, enquête préremplie.
 * « NPS moyen » et « Prestataires en baisse » (tendance d'au moins un point de baisse) sont calculés sur les
 * prestataires affichés ; « Enquêtes envoyées » et « Taux de réponse » restent en dur (42, « 68% » ; marqués « Tous les mandats » quand une copropriété est choisie). Une tendance
 * commençant par « - » s'affiche en rouille, toute autre en vert sauge.
 */
export function NpsPostInterventionModule() {
  const { push } = useToast()
  const [prestataireOuvert, setPrestataireOuvert] = useState<NpsPrestataireDemo | null>(null)
  const { code, nom } = useCoproChoisie()
  const prestataires = filtrerParCopro(DEMO_NPS_PAR_PRESTATAIRE, code, (prestataire) =>
    codeLigneDemo(prestataire[4].find((codeCopro) => codeCopro === code)),
  )
  const enBaisse = prestataires.filter((prestataire) => valeurDecimale(prestataire[2]) <= SEUIL_BAISSE_NPS).length

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
                  champCoproprieteChoisie(nom),
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
            sub: sousTitreFige(code),
          },
          {
            icon: 'chart',
            num: '68%',
            lbl: 'Taux de réponse',
            sub: sousTitreFige(code),
            accent: 'sage',
          },
          {
            icon: 'poll',
            num: noteMoyenne(prestataires),
            lbl: 'NPS moyen',
            accent: 'gold',
          },
          {
            icon: 'siren',
            num: enBaisse,
            lbl: 'Prestataires en baisse',
            accent: 'rust',
          },
        ]}
      />
      <Panel title="Satisfaction par prestataire" icon="poll" flush>
        {prestataires.length === 0 ? (
          <EmptyState icon="poll" title={titreListeVide('Aucun prestataire noté', nom)} />
        ) : (
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
            rows={prestataires}
            onRow={setPrestataireOuvert}
          />
        )}
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
