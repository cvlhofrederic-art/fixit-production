'use client'

import { useState } from 'react'
import { DEMO_DOCUMENTS_GED, type DocumentGedDemo } from '@/components/administrateur-judiciaire/data/documents-ged'
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
import { codeDeNomCopro, filtrerParCopro } from '@/lib/administrateur-judiciaire/domain/selection-copropriete'

/**
 * Documents (GED) (barre latérale : section Outils IA ; surtitre « Documents »). Écran de démonstration affiché selon
 * la copropriété choisie dans le sélecteur du haut de page : derniers documents filtrés (colonne « Bâtiment »), chapeau
 * et téléversement à son nom. Les indicateurs (248, « 1,2 Go », 36, 5) mesurent toute la GED du cabinet, qui n'est
 * pas dans la démonstration : ils restent en dur (marqués « Tous les mandats » quand une copropriété est choisie). « Téléverser » ouvre un formulaire simulé (aucun fichier n'est lu).
 */
export function DocumentsGedModule() {
  const { push } = useToast()
  const [documentOuvert, setDocumentOuvert] = useState<DocumentGedDemo | null>(null)
  const { code, nom } = useCoproChoisie()
  const documents = filtrerParCopro(DEMO_DOCUMENTS_GED, code, (documentGed) => codeDeNomCopro(documentGed[2]))
  const portee = nom ? `de ${nom}` : "de l'ensemble des mandats"

  return (
    <>
      <PageHead
        eyebrow="Documents"
        title="Documents (GED)"
        lede={`Gestion électronique des documents ${portee}.`}
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'form',
                icon: 'folder',
                title: 'Téléverser un document',
                fields: [
                  champCoproprieteChoisie(nom),
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
            sub: sousTitreFige(code),
          },
          {
            icon: 'doc',
            num: '1,2 Go',
            lbl: 'Espace utilisé',
            sub: sousTitreFige(code),
          },
          {
            icon: 'users',
            num: 36,
            lbl: 'Partagés extranet',
            sub: sousTitreFige(code),
          },
          {
            icon: 'clock',
            num: 5,
            lbl: 'Récents (7 j)',
            sub: sousTitreFige(code),
            accent: 'sage',
          },
        ]}
      />
      <Panel title="Derniers documents" icon="folder" flush>
        {documents.length === 0 ? (
          <EmptyState icon="folder" title={titreListeVide('Aucun document', nom)} />
        ) : (
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
            rows={documents}
            onRow={setDocumentOuvert}
          />
        )}
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
