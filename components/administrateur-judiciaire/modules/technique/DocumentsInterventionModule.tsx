'use client'

import { useState } from 'react'
import {
  DEMO_DOCUMENTS_INTERVENTION,
  type DocumentInterventionDemo,
} from '@/components/administrateur-judiciaire/data/documents-intervention'
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
 * Documents d'intervention (écran de démonstration). Le surtitre « Gestion courante » est celui de la maquette,
 * bien que l'écran soit rangé dans Technique & travaux. Les onglets sont autonomes et ne filtrent pas le tableau ;
 * les indicateurs sont en dur.
 */
export function DocumentsInterventionModule() {
  const { push } = useToast()
  const [documentOuvert, setDocumentOuvert] = useState<DocumentInterventionDemo | null>(null)

  return (
    <>
      <PageHead
        eyebrow="Gestion courante"
        title="Documents d'intervention"
        lede="Devis, factures et PV liés aux interventions, et leur transmission à la comptabilité."
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'form',
                icon: 'plus',
                title: 'Ajouter un élément',
                fields: [
                  {
                    label: 'Intitulé',
                    placeholder: 'Intitulé',
                    full: true,
                  },
                  {
                    label: 'Copropriété',
                    type: 'select',
                    options: ['Résidence Le Méridien', 'Le Clos des Vignes', 'Copropriété Les Tilleuls', 'Villa Montaigne'],
                    full: true,
                  },
                  {
                    label: 'Détail',
                    type: 'textarea',
                    placeholder: 'Détail…',
                    full: true,
                  },
                ],
                submitLabel: 'Enregistrer',
                toast: {
                  title: 'Élément ajouté',
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
            icon: 'doc',
            num: 5,
            lbl: 'Total documents',
          },
          {
            icon: 'alert',
            num: 2,
            lbl: 'Non transmis à la compta',
            accent: 'rust',
          },
          {
            icon: 'check',
            num: 3,
            lbl: 'Transmis à la compta',
            accent: 'sage',
          },
          {
            icon: 'coin',
            num: 2,
            lbl: 'Factures',
          },
        ]}
      />
      <Tabs
        defaultActive="tous"
        tabs={[
          {
            id: 'tous',
            icon: 'folder',
            label: 'Tous',
          },
          {
            id: 'devis',
            icon: 'doc',
            label: 'Devis',
          },
          {
            id: 'fact',
            icon: 'coin',
            label: 'Factures',
          },
          {
            id: 'pv',
            icon: 'fact',
            label: 'PV',
          },
        ]}
      />
      <Panel title="Documents" icon="doc" flush>
        <DataTable
          columns={[
            {
              h: 'Document',
              render: (piece) => <b>{piece[0]}</b>,
            },
            {
              h: 'Intervention',
              render: (piece) => piece[1],
            },
            {
              h: 'Bâtiment',
              render: (piece) => piece[2],
            },
            {
              h: 'Date',
              render: (piece) => <span className="mono">{piece[3]}</span>,
            },
            {
              h: 'Compta',
              render: (piece) => (
                <Pill kind={piece[4] === 'transmis' ? 'sage' : 'rust'} noDot>
                  {piece[4]}
                </Pill>
              ),
            },
          ]}
          rows={DEMO_DOCUMENTS_INTERVENTION}
          onRow={setDocumentOuvert}
        />
      </Panel>
      <DetailModal
        open={!!documentOuvert}
        onClose={() => setDocumentOuvert(null)}
        title={documentOuvert ? documentOuvert[0] : ''}
        icon="doc"
        fields={
          documentOuvert
            ? [
                {
                  k: 'Intervention',
                  v: documentOuvert[1],
                },
                {
                  k: 'Bâtiment',
                  v: documentOuvert[2],
                },
                {
                  k: 'Date',
                  v: documentOuvert[3],
                },
                {
                  k: 'Transmission compta',
                  v: documentOuvert[4],
                },
              ]
            : []
        }
      />
    </>
  )
}
