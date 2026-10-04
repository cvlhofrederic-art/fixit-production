'use client'

import { useState } from 'react'
import { DEMO_DOCUMENTS_GED, type DocumentGedDemo } from '@/components/administrateur-judiciaire/data/documents-ged'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { DetailModal } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'

/**
 * Documents (GED) (barre latérale : section Outils IA ; surtitre « Documents »). Écran de démonstration :
 * indicateurs en dur (248, « 1,2 Go », 36, 5) ; « Téléverser » ouvre un formulaire simulé (aucun fichier n'est lu).
 */
export function DocumentsGedModule() {
  const { push } = useToast()
  const [documentOuvert, setDocumentOuvert] = useState<DocumentGedDemo | null>(null)

  return (
    <>
      <PageHead
        eyebrow="Documents"
        title="Documents (GED)"
        lede="Gestion électronique des documents de l'ensemble des mandats."
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'form',
                icon: 'folder',
                title: 'Téléverser un document',
                fields: [
                  {
                    label: 'Copropriété',
                    type: 'select',
                    options: ['Résidence Le Méridien', 'Le Clos des Vignes', 'Copropriété Les Tilleuls', 'Villa Montaigne'],
                    full: true,
                  },
                  {
                    label: 'Catégorie',
                    type: 'select',
                    options: ['Comptabilité', 'Juridique', 'Travaux', 'Assurance', 'AG'],
                    full: true,
                  },
                  {
                    label: 'Nom du fichier',
                    placeholder: 'ex. devis_toiture.pdf',
                    full: true,
                  },
                ],
                submitLabel: 'Téléverser',
                toast: {
                  title: 'Document téléversé',
                },
              })
            }
          >
            <Icon name="plus" />
            Téléverser
          </button>
        }
      />
      <Kpis
        items={[
          {
            icon: 'folder',
            num: 248,
            lbl: 'Documents',
          },
          {
            icon: 'doc',
            num: '1,2 Go',
            lbl: 'Espace utilisé',
          },
          {
            icon: 'users',
            num: 36,
            lbl: 'Partagés extranet',
          },
          {
            icon: 'clock',
            num: 5,
            lbl: 'Récents (7 j)',
            accent: 'sage',
          },
        ]}
      />
      <Panel title="Derniers documents" icon="folder" flush>
        <DataTable
          columns={[
            {
              h: 'Document',
              render: (documentGed) => <b>{documentGed[0]}</b>,
            },
            {
              h: 'Type',
              render: (documentGed) => <Pill noDot>{documentGed[1]}</Pill>,
            },
            {
              h: 'Bâtiment',
              render: (documentGed) => documentGed[2],
            },
            {
              h: 'Auteur',
              render: (documentGed) => (
                <span
                  style={{
                    color: 'var(--navy-500)',
                  }}
                >
                  {documentGed[3]}
                </span>
              ),
            },
            {
              h: 'Date',
              render: (documentGed) => <span className="mono">{documentGed[4]}</span>,
            },
          ]}
          rows={DEMO_DOCUMENTS_GED}
          onRow={setDocumentOuvert}
        />
      </Panel>
      <DetailModal
        open={!!documentOuvert}
        onClose={() => setDocumentOuvert(null)}
        title={documentOuvert ? documentOuvert[0] : ''}
        icon="folder"
        fields={
          documentOuvert
            ? [
                {
                  k: 'Type',
                  v: documentOuvert[1],
                },
                {
                  k: 'Bâtiment',
                  v: documentOuvert[2],
                },
                {
                  k: 'Auteur',
                  v: documentOuvert[3],
                },
                {
                  k: 'Date',
                  v: documentOuvert[4],
                },
              ]
            : []
        }
      />
    </>
  )
}
