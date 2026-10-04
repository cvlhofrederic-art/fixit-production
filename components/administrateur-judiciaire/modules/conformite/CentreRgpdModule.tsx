'use client'

import { CarteCritere } from '@/components/administrateur-judiciaire/ui/CarteCritere'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'

/** Droit de la personne concernée : [droit, article et portée, teinte de la carte]. */
export type DroitRgpd = readonly [droit: string, article: string, teinte: 'sage' | 'amber' | 'rust']

/** Droits affichés (constante locale de la maquette, hissée au niveau du module sans changer le rendu). */
const DROITS_RGPD: readonly DroitRgpd[] = [
  ["Droit d'accès", 'Art. 15 · copie des données personnelles', 'sage'],
  ['Droit de rectification', 'Art. 16 · correction de données inexactes', 'sage'],
  ["Droit d'opposition", 'Art. 21 · cesser un traitement', 'amber'],
  ["Droit à l'effacement", 'Art. 17 · suppression des données', 'rust'],
  ['Droit à la portabilité', 'Art. 20 · export structuré', 'sage'],
  ['Droit à la limitation', 'Art. 18 · suspendre le traitement', 'amber'],
]

/**
 * Centre RGPD, écran de démonstration : indicateurs en dur (3, « 1 mois », 0, « À jour »). Le formulaire
 * « Nouvelle demande » n'a pas d'onSubmit : sa validation est simulée (toast « Demande enregistrée »).
 */
export function CentreRgpdModule() {
  const { push } = useToast()

  return (
    <>
      <PageHead
        eyebrow="Conformité · RGPD"
        title="Centre RGPD"
        lede="Le syndic judiciaire est responsable de traitement des données du syndicat des copropriétaires."
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'form',
                icon: 'chat',
                title: 'Nouvelle demande',
                fields: [
                  {
                    label: 'Copropriété',
                    type: 'select',
                    options: ['Résidence Le Méridien', 'Le Clos des Vignes', 'Copropriété Les Tilleuls', 'Villa Montaigne'],
                    full: true,
                  },
                  {
                    label: 'Demandeur',
                    placeholder: 'Nom · lot',
                    full: true,
                  },
                  {
                    label: 'Objet',
                    placeholder: 'Objet de la demande',
                    full: true,
                  },
                  {
                    label: 'Détail',
                    type: 'textarea',
                    placeholder: 'Détaillez la demande…',
                    full: true,
                  },
                ],
                submitLabel: 'Enregistrer',
                toast: {
                  title: 'Demande enregistrée',
                },
              })
            }
          >
            <Icon name="shield" />
            Nouvelle demande
          </button>
        }
      />
      <Kpis
        items={[
          {
            icon: 'shield',
            num: 3,
            lbl: 'Traitements déclarés',
          },
          {
            icon: 'clock',
            num: '1 mois',
            lbl: 'Délai légal de réponse',
            accent: 'gold',
          },
          {
            icon: 'check',
            num: 0,
            lbl: 'Demandes en attente',
            accent: 'sage',
          },
          {
            icon: 'doc',
            num: 'À jour',
            lbl: 'Registre des traitements',
            accent: 'sage',
          },
        ]}
      />
      <Panel title="Registre des traitements" icon="doc">
        <div className="card-grid cols-3">
          <CarteCritere titre="Données des copropriétaires" detail="Coordonnées · lots · quotes-parts" teinte="sage" />
          <CarteCritere titre="Comptabilité du syndicat" detail="Appels de fonds · soldes · compte séparé" teinte="sage" />
          <CarteCritere titre="Contentieux & impayés" detail="Procédures · mises en demeure" teinte="amber" />
        </div>
      </Panel>
      <Panel title="Droits du titulaire — réponse sous 1 mois" icon="shield">
        <div className="card-grid cols-3">
          {DROITS_RGPD.map(([droit, article, teinte], index) => (
            <CarteCritere titre={droit} detail={article} teinte={teinte} key={index} />
          ))}
        </div>
      </Panel>
    </>
  )
}
