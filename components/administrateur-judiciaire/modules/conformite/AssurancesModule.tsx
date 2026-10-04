'use client'

import { DEMO_CONTRATS_ASSURANCE } from '@/components/administrateur-judiciaire/data/contrats-assurance'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'

/**
 * Assurances des copropriétés sous mandat, écran de démonstration : indicateurs en dur (4, « OK », 1).
 * Le surtitre « Patrimoine · Assurances » est celui de la maquette, bien que l'écran soit rangé dans la conformité légale.
 * Les options « Prestataire » du formulaire « Nouveau contrat » sont codées en dur (cinq prestataires de démonstration).
 * Les cartes des contrats sont une variante inline (padding 16, bouton « Voir » qui affiche un toast info),
 * distincte de CarteCritere.
 */
export function AssurancesModule() {
  const { push } = useToast()

  return (
    <>
      <PageHead
        eyebrow="Patrimoine · Assurances"
        title="Assurances"
        lede="Contrats d'assurance des copropriétés sous mandat (RC obligatoire au titre de la loi ALUR)."
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'form',
                icon: 'doc',
                title: 'Nouveau contrat',
                fields: [
                  {
                    label: 'Prestataire',
                    type: 'select',
                    options: [
                      'Atlantic Plomberie SARL',
                      'ELEC92 Services',
                      'OTIS Maintenance',
                      'Couverture Île-de-France',
                      'Vert Pro Espaces',
                    ],
                    full: true,
                  },
                  {
                    label: 'Objet',
                    placeholder: 'ex. Maintenance ascenseur',
                    full: true,
                  },
                  {
                    label: 'Type',
                    type: 'select',
                    options: ['Contrat cadre', 'Ponctuel', 'Annuel reconductible'],
                    full: true,
                  },
                  {
                    label: 'Montant annuel',
                    placeholder: 'ex. 2 400 € HT',
                    full: true,
                  },
                ],
                submitLabel: 'Enregistrer',
                toast: {
                  title: 'Contrat enregistré',
                },
              })
            }
          >
            <Icon name="shield" />
            Nouveau contrat
          </button>
        }
      />
      <Kpis
        items={[
          {
            icon: 'shield',
            num: 4,
            lbl: 'Contrats actifs',
            accent: 'sage',
          },
          {
            icon: 'check',
            num: 'OK',
            lbl: 'RC obligatoire couverte',
            accent: 'sage',
          },
          {
            icon: 'clock',
            num: 1,
            lbl: 'Échéance < 90 j',
            accent: 'amber',
          },
        ]}
      />
      <Panel title="Contrats en cours" icon="shield">
        <div className="card-grid cols-2">
          {DEMO_CONTRATS_ASSURANCE.map(([intitule, assureurEtReference, echeance, teinte], index) => (
            <div
              style={{
                padding: 16,
                border: '1px solid var(--line)',
                borderRadius: 10,
                background: `var(--${teinte}-50)`,
                borderLeft: `3px solid var(--${teinte}-500)`,
              }}
              key={index}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 13.5,
                    marginBottom: 2,
                  }}
                >
                  {intitule}
                </div>
                <button
                  className="btn ghost sm"
                  onClick={() =>
                    push({
                      kind: 'info',
                      title: intitule,
                      desc: 'Ouvrir le contrat',
                    })
                  }
                >
                  Voir
                </button>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--navy-500)',
                }}
              >
                {assureurEtReference}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: 'var(--navy-400)',
                  marginTop: 6,
                }}
              >
                {echeance}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
