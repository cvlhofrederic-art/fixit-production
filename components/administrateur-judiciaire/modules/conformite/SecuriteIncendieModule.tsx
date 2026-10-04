'use client'

import { CarteCritere } from '@/components/administrateur-judiciaire/ui/CarteCritere'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'

/** Carte de sécurité incendie : [intitulé, précision, teinte de la carte]. */
export type CarteSecuriteIncendie = readonly [intitule: string, precision: string, teinte: 'sage' | 'amber' | 'rust' | 'gold']

/** Familles d'habitation (arrêté du 31 janvier 1986) ; constante locale de la maquette hissée au niveau du module. */
const FAMILLES_HABITATION: readonly CarteSecuriteIncendie[] = [
  ['1ʳᵉ famille — individuel', 'Habitations individuelles isolées ou jumelées', 'sage'],
  ['2ᵉ famille — collectif R+3', "Collectif jusqu'à 3 étages sur rez-de-chaussée", 'sage'],
  ["3ᵉ famille — jusqu'à 28 m", 'Plancher bas du logement le plus haut ≤ 28 m', 'amber'],
  ['4ᵉ famille — au-delà de 28 m', 'Plancher bas > 28 m et ≤ 50 m', 'rust'],
]

/** Équipements de sécurité à contrôler ; constante locale de la maquette hissée au niveau du module. */
const EQUIPEMENTS_SECURITE: readonly CarteSecuriteIncendie[] = [
  ['Désenfumage des circulations', "Cages d'escalier + couloirs", 'sage'],
  ['Extincteurs & colonnes sèches', 'Selon famille du bâtiment', 'sage'],
  ['Éclairage de sécurité', 'Blocs autonomes (BAES)', 'gold'],
  ['Détection & alarme', 'Parties communes', 'amber'],
]

/**
 * Sécurité incendie (arrêté du 31/01/1986), écran de démonstration sans indicateurs : familles d'habitation et
 * équipements à contrôler. « Registre sécurité » ouvre un registre de démonstration (document généré).
 */
export function SecuriteIncendieModule() {
  const { push } = useToast()

  return (
    <>
      <PageHead
        eyebrow="Conformité · Arrêté du 31/01/1986"
        title="Sécurité incendie"
        lede="Classement des bâtiments d'habitation et obligations de sécurité incendie."
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'doc',
                icon: 'siren',
                title: 'Registre de sécurité incendie',
                eyebrow: 'Syndic judiciaire · Cabinet Delaunay',
                docTitle: 'Registre de sécurité incendie',
                meta: 'Résidence Le Méridien · mis à jour le 19/06/2026',
                lines: [
                  {
                    h: 'Vérifications',
                  },
                  {
                    k: 'Extincteurs (vérif. annuelle)',
                    v: 'Conforme — 14/02/2026',
                  },
                  {
                    k: 'Désenfumage',
                    v: 'Conforme',
                  },
                  {
                    k: 'Éclairage de sécurité',
                    v: 'À contrôler',
                  },
                  {
                    k: 'Portes coupe-feu',
                    v: 'Conforme',
                  },
                  {
                    h: 'Prochaines échéances',
                  },
                  {
                    li: 'Contrôle éclairage de sécurité avant le 30/06/2026',
                  },
                  {
                    li: "Exercice d'évacuation annuel",
                  },
                ],
              })
            }
          >
            <Icon name="siren" />
            Registre sécurité
          </button>
        }
      />
      <Panel title="Familles d'habitation (arrêté du 31 janvier 1986)" icon="siren">
        <div className="card-grid cols-2">
          {FAMILLES_HABITATION.map(([intitule, precision, teinte], index) => (
            <CarteCritere titre={intitule} detail={precision} teinte={teinte} key={index} />
          ))}
        </div>
      </Panel>
      <Panel title="Équipements de sécurité à contrôler" icon="shield">
        <div className="card-grid cols-2">
          {EQUIPEMENTS_SECURITE.map(([intitule, precision, teinte], index) => (
            <CarteCritere titre={intitule} detail={precision} teinte={teinte} key={index} />
          ))}
        </div>
      </Panel>
    </>
  )
}
