'use client'

import { useState } from 'react'
import { CHAMP_COPROPRIETE } from '@/components/administrateur-judiciaire/data/elements-communs'
import {
  DEMO_CAMERAS_VIDEOPROTECTION,
  PILL_PAR_CONFORMITE_CNIL,
  type CameraVideoprotectionDemo,
} from '@/components/administrateur-judiciaire/data/videoprotection'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { DetailModal } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'

/**
 * Vidéoprotection des parties communes (barre latérale : Patrimoine › « Vidéosurveillance » ; surtitre « Conformité · CNIL »).
 * Caméras de démonstration, indicateurs en dur (4 / 3 / 3 / 1). Le formulaire « Nouvelle caméra » est simulé
 * (toast « Caméra enregistrée »).
 */
export function VideoprotectionModule() {
  const { push } = useToast()
  const [cameraOuverte, setCameraOuverte] = useState<CameraVideoprotectionDemo | null>(null)

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
                  CHAMP_COPROPRIETE,
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
            num: 4,
            lbl: 'Caméras',
          },
          {
            icon: 'building',
            num: 3,
            lbl: 'Bâtiments couverts',
          },
          {
            icon: 'check',
            num: 3,
            lbl: 'Avec signalétique',
            accent: 'sage',
          },
          {
            icon: 'siren',
            num: 1,
            lbl: 'Conservation > 30 j',
            accent: 'rust',
          },
        ]}
      />
      <Panel title="Caméras installées" icon="shield" flush>
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
          rows={DEMO_CAMERAS_VIDEOPROTECTION}
          onRow={setCameraOuverte}
        />
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
