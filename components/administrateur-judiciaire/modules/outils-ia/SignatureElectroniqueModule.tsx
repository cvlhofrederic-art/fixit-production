'use client'

import { DEMO_DOCUMENTS_SIGNATURE_ELECTRONIQUE } from '@/components/administrateur-judiciaire/data/signature-electronique'
import { avecChampCopro, titreListeVide, useCoproChoisie } from '@/components/administrateur-judiciaire/ui/copro-choisie'
import { EmptyState } from '@/components/administrateur-judiciaire/ui/EmptyState'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast, type ChampFormulaireToast } from '@/components/administrateur-judiciaire/ui/toast'
import { codeLigneDemo, filtrerParCopro } from '@/lib/administrateur-judiciaire/domain/selection-copropriete'

/** Champs du formulaire « Nouvelle demande de signature ». */
const CHAMPS_DEMANDE_SIGNATURE: readonly ChampFormulaireToast[] = [
  {
    label: 'Document',
    placeholder: "ex. PV d'assemblée",
    full: true,
  },
  {
    label: 'Signataire',
    placeholder: 'Nom',
    full: true,
  },
  {
    label: 'Mode',
    type: 'select',
    options: ['Signature électronique (eIDAS)', 'Manuscrite'],
    full: true,
  },
]

/**
 * Signature électronique (barre latérale : section Outils IA ; surtitre « Documents »). Cartes des documents en
 * signature : « Télécharger » pour un document signé, « Relancer » sinon (toasts simulés, desc = nom du document).
 * « Envoyer à signer » ouvre un formulaire simulé. Documents et indicateurs de la copropriété choisie en haut de page
 * (tous sans choix), copropriété proposée dans le formulaire.
 */
export function SignatureElectroniqueModule() {
  const { push } = useToast()
  const { code, nom: nomCopro } = useCoproChoisie()
  const documents = filtrerParCopro(DEMO_DOCUMENTS_SIGNATURE_ELECTRONIQUE, code, (piece) => codeLigneDemo(piece[4]))
  const signes = documents.filter((piece) => piece[2] === 'signé').length

  return (
    <>
      <PageHead
        eyebrow="Documents"
        title="Signature électronique"
        lede="Documents en signature électronique (valeur probante eIDAS)."
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'form',
                icon: 'pencil',
                title: 'Nouvelle demande de signature',
                fields: avecChampCopro(CHAMPS_DEMANDE_SIGNATURE, nomCopro),
                submitLabel: 'Enregistrer',
                toast: {
                  title: 'Demande de signature envoyée',
                },
              })
            }
          >
            <Icon name="pencil" />
            Envoyer à signer
          </button>
        }
      />
      <Kpis
        items={[
          {
            icon: 'doc',
            num: documents.length,
            lbl: 'Documents',
          },
          {
            icon: 'check',
            num: signes,
            lbl: 'Signés',
            accent: 'sage',
          },
          {
            icon: 'clock',
            num: documents.length - signes,
            lbl: 'En attente',
            accent: 'amber',
          },
          {
            icon: 'shield',
            num: 'eIDAS',
            lbl: 'Niveau de signature',
          },
        ]}
      />
      <Panel title="Documents" icon="pencil">
        {code && documents.length === 0 && (
          <EmptyState icon="pencil" title={titreListeVide('Aucun document en signature', nomCopro)} />
        )}
        <div className="card-grid cols-2">
          {documents.map(([nomDocument, signataire, statut, teinte], index) => (
            <div
              style={{
                padding: 16,
                border: '1px solid var(--line)',
                borderRadius: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
              key={index}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 13.5,
                  }}
                >
                  {nomDocument}
                </div>
                <Pill kind={teinte} noDot>
                  {statut}
                </Pill>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--navy-500)',
                }}
              >
                {signataire}
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                }}
              >
                <button
                  className="btn ghost sm"
                  onClick={() =>
                    push({
                      kind: statut === 'signé' ? 'info' : 'success',
                      title: statut === 'signé' ? 'Document signé' : 'Relance envoyée',
                      desc: nomDocument,
                    })
                  }
                >
                  {statut === 'signé' ? 'Télécharger' : 'Relancer'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
