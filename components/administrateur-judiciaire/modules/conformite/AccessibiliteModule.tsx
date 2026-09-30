'use client'

import { CarteCritere } from '@/components/administrateur-judiciaire/ui/CarteCritere'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'

/** Critère d'accessibilité des parties communes : [critère, périmètre, teinte de la carte]. */
export type CritereAccessibilite = readonly [critere: string, perimetre: string, teinte: 'sage' | 'gold' | 'amber']

/** Critères affichés (constante locale de la maquette, hissée au niveau du module sans changer le rendu). */
const CRITERES_ACCESSIBILITE: readonly CritereAccessibilite[] = [
  ['Rampes extérieures (pente ≤ 6 %)', 'Accès au bâtiment', 'sage'],
  ['Largeur des portes (≥ 0,90 m)', 'Entrée + parties communes', 'sage'],
  ['Ascenseur accessible', 'Cabine ≥ 1,00 × 1,30 m', 'gold'],
  ['Sanitaires adaptés', 'Parties communes', 'amber'],
  ['Signalétique adaptée', 'Boutons + paliers', 'sage'],
  ['Cheminement continu sans obstacle', 'Hall + circulations', 'gold'],
]

/**
 * Accessibilité des parties communes (CCH / loi 2005-102), écran de démonstration : indicateurs en dur (4/6, 2, 4).
 * Le bouton « Diagnostic » ouvre le « Diagnostic technique global (DTG) » de Copropriété Les Tilleuls, et non un
 * document d'accessibilité (comme la maquette).
 */
export function AccessibiliteModule() {
  const { push } = useToast()

  return (
    <>
      <PageHead
        eyebrow="Conformité · CCH / Loi 2005-102"
        title="Accessibilité"
        lede="Accessibilité des parties communes de la copropriété (Code de la construction et de l'habitation)."
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'doc',
                icon: 'wrench',
                title: 'Diagnostic technique',
                eyebrow: 'Syndic judiciaire · Cabinet Delaunay',
                docTitle: 'Diagnostic technique global (DTG)',
                meta: 'Copropriété Les Tilleuls · 24 lots',
                lines: [
                  "Le diagnostic technique global a été réalisé conformément à l'article L731-1 du CCH.",
                  {
                    h: 'Constats',
                  },
                  {
                    k: 'État du gros œuvre',
                    v: 'Correct',
                  },
                  {
                    k: 'Toiture-terrasse',
                    v: 'Étanchéité dégradée',
                  },
                  {
                    k: 'Installations communes',
                    v: 'Vétustes',
                  },
                  {
                    h: 'Travaux à prévoir (10 ans)',
                  },
                  {
                    k: 'Étanchéité toiture',
                    v: '18 400 €',
                  },
                  {
                    k: 'Ravalement',
                    v: '95 000 €',
                  },
                  {
                    k: 'Total estimé',
                    v: '185 000 €',
                  },
                ],
              })
            }
          >
            <Icon name="grad" />
            Diagnostic
          </button>
        }
      />
      <Kpis
        items={[
          {
            icon: 'check',
            num: '4/6',
            lbl: 'Critères conformes',
            accent: 'sage',
          },
          {
            icon: 'wrench',
            num: 2,
            lbl: 'Points à traiter',
            accent: 'amber',
          },
          {
            icon: 'building',
            num: 4,
            lbl: 'Copropriétés suivies',
          },
        ]}
      />
      <Panel title="Critères d'accessibilité — parties communes" icon="grad">
        <div className="card-grid cols-3">
          {CRITERES_ACCESSIBILITE.map(([critere, perimetre, teinte], index) => (
            <CarteCritere titre={critere} detail={perimetre} teinte={teinte} key={index} />
          ))}
        </div>
      </Panel>
    </>
  )
}
