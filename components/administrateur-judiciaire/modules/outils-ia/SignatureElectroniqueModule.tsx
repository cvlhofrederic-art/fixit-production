'use client'

import { DEMO_DOCUMENTS_SIGNATURE_ELECTRONIQUE } from '@/components/administrateur-judiciaire/data/signature-electronique'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'

/**
 * Signature électronique (barre latérale : section Outils IA ; surtitre « Documents »). Cartes des documents en
 * signature : « Télécharger » pour un document signé, « Relancer » sinon (toasts simulés, desc = nom du document).
 * « Envoyer à signer » ouvre un formulaire simulé.
 */
export function SignatureElectroniqueModule() {
  const { push } = useToast()

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
                fields: [
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
                ],
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
            num: 4,
            lbl: 'Documents',
          },
          {
            icon: 'check',
            num: 2,
            lbl: 'Signés',
            accent: 'sage',
          },
          {
            icon: 'clock',
            num: 2,
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
        <div className="card-grid cols-2">
          {DEMO_DOCUMENTS_SIGNATURE_ELECTRONIQUE.map(([nomDocument, signataire, statut, teinte], index) => (
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
