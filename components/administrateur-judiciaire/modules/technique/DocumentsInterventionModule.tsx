'use client'

import { useState } from 'react'
import {
  DEMO_DOCUMENTS_INTERVENTION,
  type DocumentInterventionDemo,
} from '@/components/administrateur-judiciaire/data/documents-intervention'
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
  titreListeVide,
  useCoproChoisie,
} from '@/components/administrateur-judiciaire/ui/copro-choisie'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { codeDeNomCopro, filtrerParCopro } from '@/lib/administrateur-judiciaire/domain/selection-copropriete'

/**
 * Documents d'intervention (écran de démonstration). Le surtitre « Gestion courante » est celui de la maquette,
 * bien que l'écran soit rangé dans Technique & travaux. Affiché selon la copropriété choisie dans le sélecteur du haut
 * de page : pièces filtrées (colonne « Bâtiment »), indicateurs calculés sur elles (total, transmis ou non à la
 * comptabilité, factures), ajout prérempli. Les onglets sont autonomes et ne filtrent pas le tableau.
 */
export function DocumentsInterventionModule() {
  const { push } = useToast()
  const [documentOuvert, setDocumentOuvert] = useState<DocumentInterventionDemo | null>(null)
  const { code, nom } = useCoproChoisie()
  const pieces = filtrerParCopro(DEMO_DOCUMENTS_INTERVENTION, code, (piece) => codeDeNomCopro(piece[2]))
  const nonTransmises = pieces.filter((piece) => piece[4] === 'non transmis').length

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
                  champCoproprieteChoisie(nom),
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
            num: pieces.length,
            lbl: 'Total documents',
          },
          {
            icon: 'alert',
            num: nonTransmises,
            lbl: 'Non transmis à la compta',
            accent: 'rust',
          },
          {
            icon: 'check',
            num: pieces.length - nonTransmises,
            lbl: 'Transmis à la compta',
            accent: 'sage',
          },
          {
            icon: 'coin',
            num: pieces.filter((piece) => piece[0].startsWith('Facture')).length,
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
        {pieces.length === 0 ? (
          <EmptyState icon="doc" title={titreListeVide('Aucun document d’intervention', nom)} />
        ) : (
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
            rows={pieces}
            onRow={setDocumentOuvert}
          />
        )}
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
