'use client'

import {
  DEMO_CONTRATS_ASSURANCE,
  type ContratAssuranceDemo,
} from '@/components/administrateur-judiciaire/data/contrats-assurance'
import { EmptyState } from '@/components/administrateur-judiciaire/ui/EmptyState'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { codeLigneDemo } from '@/lib/administrateur-judiciaire/domain/selection-copropriete'
import { useCodeCoproCourant, useCoproCourante } from '@/lib/administrateur-judiciaire/selection'

/** Vrai pour le contrat de responsabilité civile du syndicat (obligatoire, loi ALUR). */
const estRcDuSyndicat = (contrat: ContratAssuranceDemo): boolean => contrat[0].startsWith('RC du syndicat')

/**
 * Assurances des copropriétés sous mandat, écran de démonstration affiché selon la copropriété choisie dans le
 * sélecteur du haut de page : ses contrats seulement, indicateurs calculés sur eux (« RC obligatoire couverte » :
 * « OK » si la RC du syndicat en fait partie ; « Échéance < 90 j » : contrats en teinte or), copropriété nommée dans le
 * titre du formulaire. Sans copropriété choisie (écran rendu seul) : les quatre contrats (4, « OK », 1).
 * Le surtitre « Patrimoine · Assurances » est celui de la maquette, bien que l'écran soit rangé dans la conformité légale.
 * Les options « Prestataire » du formulaire « Nouveau contrat » sont codées en dur (cinq prestataires de démonstration).
 * Les cartes des contrats sont une variante inline (padding 16, bouton « Voir » qui affiche un toast info),
 * distincte de CarteCritere.
 */
export function AssurancesModule() {
  const { push } = useToast()
  const code = useCodeCoproCourant()
  const copro = useCoproCourante()
  const contrats = code
    ? DEMO_CONTRATS_ASSURANCE.filter((contrat) => contrat[4].some((codeContrat) => codeLigneDemo(codeContrat) === code))
    : DEMO_CONTRATS_ASSURANCE
  const rcCouverte = contrats.some(estRcDuSyndicat)

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
                title: code ? `Nouveau contrat — ${copro.nom}` : 'Nouveau contrat',
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
            num: contrats.length,
            lbl: 'Contrats actifs',
            accent: 'sage',
          },
          {
            icon: 'check',
            num: rcCouverte ? 'OK' : 'Non',
            lbl: 'RC obligatoire couverte',
            accent: rcCouverte ? 'sage' : 'rust',
          },
          {
            icon: 'clock',
            num: contrats.filter((contrat) => contrat[3] === 'gold').length,
            lbl: 'Échéance < 90 j',
            accent: 'amber',
          },
        ]}
      />
      <Panel title="Contrats en cours" icon="shield">
        {contrats.length === 0 && <EmptyState icon="shield" title={`Aucun contrat d'assurance pour ${copro.nom}`} />}
        <div className="card-grid cols-2">
          {contrats.map(([intitule, assureurEtReference, echeance, teinte], index) => (
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
