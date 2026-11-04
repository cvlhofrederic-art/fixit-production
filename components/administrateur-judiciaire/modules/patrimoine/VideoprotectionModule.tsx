'use client'

import { useState } from 'react'
import {
  DEMO_CAMERAS_VIDEOPROTECTION,
  PILL_PAR_CONFORMITE_CNIL,
  type CameraVideoprotectionDemo,
} from '@/components/administrateur-judiciaire/data/videoprotection'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { DetailModal } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { EmptyState } from '@/components/administrateur-judiciaire/ui/EmptyState'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { champCoproprieteChoisie, titreListeVide, useCoproChoisie } from '@/components/administrateur-judiciaire/ui/copro-choisie'
import { codeDeNomCopro, filtrerParCopro } from '@/lib/administrateur-judiciaire/domain/selection-copropriete'

/** Durée de conservation maximale recommandée par la CNIL, en jours. */
const CONSERVATION_MAX_JOURS = 30

/** Vrai si la durée de conservation affichée (« 45 jours ») dépasse le maximum CNIL. */
const conservationExcessive = (camera: CameraVideoprotectionDemo): boolean =>
  Number.parseInt(camera[3], 10) > CONSERVATION_MAX_JOURS

/**
 * Vidéoprotection des parties communes (barre latérale : Patrimoine › « Vidéosurveillance » ; surtitre « Conformité · CNIL »),
 * affichée selon la copropriété choisie dans le sélecteur du haut de page : caméras filtrées, indicateurs calculés sur
 * elles, champ Copropriété du formulaire prérempli (copie locale). Sans copropriété choisie (écran rendu seul) : toutes
 * les caméras de démonstration (4 / 3 / 3 / 1). Le formulaire « Nouvelle caméra » est simulé (toast « Caméra enregistrée »).
 */
export function VideoprotectionModule() {
  const { push } = useToast()
  const [cameraOuverte, setCameraOuverte] = useState<CameraVideoprotectionDemo | null>(null)
  const { code, nom: nomCopro } = useCoproChoisie()
  const cameras = filtrerParCopro(DEMO_CAMERAS_VIDEOPROTECTION, code, (camera) => codeDeNomCopro(camera[1]))

  return (
    <>
      <PageHead
        eyebrow="Conformité · CNIL"
        title="Vidéoprotection"
        lede="Caméras des parties communes : signalétique, durée de conservation (30 j max) et conformité CNIL."
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'form',
                icon: 'shield',
                title: 'Nouvelle caméra',
                fields: [
                  champCoproprieteChoisie(nomCopro),
                  {
                    label: 'Emplacement',
                    placeholder: 'ex. Hall RDC',
                    full: true,
                  },
                  {
                    label: 'Type',
                    placeholder: 'ex. Dôme IP',
                    full: true,
                  },
                  {
                    label: 'Déclaration CNIL',
                    placeholder: 'Référence',
                    full: true,
                  },
                ],
                submitLabel: 'Enregistrer',
                toast: {
                  title: 'Caméra enregistrée',
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
            icon: 'shield',
            num: cameras.length,
            lbl: 'Caméras',
          },
          {
            icon: 'building',
            num: new Set(cameras.map((camera) => camera[1])).size,
            lbl: 'Bâtiments couverts',
          },
          {
            icon: 'check',
            num: cameras.filter((camera) => camera[2] === 'oui').length,
            lbl: 'Avec signalétique',
            accent: 'sage',
          },
          {
            icon: 'siren',
            num: cameras.filter(conservationExcessive).length,
            lbl: 'Conservation > 30 j',
            accent: 'rust',
          },
        ]}
      />
      <Panel title="Caméras installées" icon="shield" flush>
        {cameras.length === 0 ? (
          <EmptyState icon="shield" title={titreListeVide('Aucune caméra', nomCopro)} />
        ) : (
          <DataTable
            columns={[
              {
                h: 'Emplacement',
                render: (camera) => <b>{camera[0]}</b>,
              },
              {
                h: 'Bâtiment',
                render: (camera) => camera[1],
              },
              {
                h: 'Signalétique',
                render: (camera) => (
                  <Pill kind={camera[2] === 'oui' ? 'sage' : 'rust'} noDot>
                    {camera[2]}
                  </Pill>
                ),
              },
              {
                h: 'Conservation',
                render: (camera) => <span className="mono">{camera[3]}</span>,
              },
              {
                h: 'Conformité CNIL',
                render: (camera) => (
                  <Pill kind={PILL_PAR_CONFORMITE_CNIL[camera[4]]} noDot>
                    {camera[4]}
                  </Pill>
                ),
              },
            ]}
            rows={cameras}
            onRow={setCameraOuverte}
          />
        )}
      </Panel>
      <DetailModal
        open={!!cameraOuverte}
        onClose={() => setCameraOuverte(null)}
        title={cameraOuverte ? cameraOuverte[0] : ''}
        icon="shield"
        fields={
          cameraOuverte
            ? [
                {
                  k: 'Bâtiment',
                  v: cameraOuverte[1],
                },
                {
                  k: 'Signalétique',
                  v: cameraOuverte[2],
                },
                {
                  k: 'Durée de conservation',
                  v: cameraOuverte[3],
                },
                {
                  k: 'Conformité CNIL',
                  v: cameraOuverte[4],
                },
              ]
            : []
        }
        footnote="Conservation limitée à 30 jours et signalétique obligatoire (CNIL)."
      />
    </>
  )
}
