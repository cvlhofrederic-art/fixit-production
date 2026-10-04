'use client'

import { useState } from 'react'
import { surActivationClavier } from '@/components/administrateur-judiciaire/ui/clavier'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { ProgressBar } from '@/components/administrateur-judiciaire/ui/ProgressBar'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'

/** Étape de préparation d'une AG : [identifiant, libellé, ton] (rust = critique, gold = clé, sage = standard). */
export type EtapePreparationAg = readonly [id: string, libelle: string, ton: 'gold' | 'sage' | 'rust']

/** Étapes de la liste (définies dans le rendu par la maquette, hissées au niveau du module sans changer le DOM). */
export const ETAPES_PREPARATION_AG: readonly EtapePreparationAg[] = [
  ['conv', 'Établir la convocation (21 j avant)', 'gold'],
  ['odj', "Rédiger l'ordre du jour", 'gold'],
  ['comptes', 'Joindre les comptes & budget prévisionnel', 'sage'],
  ['devis', 'Annexer les devis soumis au vote', 'sage'],
  ['pouv', 'Préparer les formulaires de pouvoir', 'sage'],
  ['feuille', 'Préparer la feuille de présence', 'sage'],
  ['lrar', 'Envoyer la convocation en LRAR', 'rust'],
]

/**
 * Préparateur d'assemblée générale : liste de contrôle cochable (état local, non persisté) avec barre de progression.
 * « Générer le dossier » ouvre un dossier de convocation de démonstration (document généré).
 */
export function PreparateurAgModule() {
  const { push } = useToast()
  const [etapesFaites, setEtapesFaites] = useState<Record<string, boolean>>({})
  const nombreFaites = ETAPES_PREPARATION_AG.filter((etape) => etapesFaites[etape[0]]).length
  const pourcentage = Math.round((nombreFaites / ETAPES_PREPARATION_AG.length) * 100)

  return (
    <>
      <PageHead
        eyebrow="Mandat judiciaire"
        title="Préparateur d'assemblée générale"
        lede="Liste de préparation d'une AG conforme (loi 1965 / décret 1967)."
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'doc',
                icon: 'fact',
                title: 'Dossier de convocation — AG',
                eyebrow: 'Syndic judiciaire · Cabinet Delaunay',
                docTitle: "Convocation à l'assemblée générale ordinaire",
                meta: 'Résidence Le Méridien · RG 26/00892 · établi le 19/06/2026',
                lines: [
                  "Les copropriétaires sont convoqués à l'assemblée générale ordinaire le 8 juillet 2026 à 18h30, en mairie annexe, conformément à l'article 7 du décret du 17 mars 1967.",
                  {
                    h: 'Ordre du jour',
                  },
                  {
                    li: 'Désignation du président de séance et du secrétaire',
                  },
                  {
                    li: "Approbation des comptes de l'exercice 2025 (art. 14-3)",
                  },
                  {
                    li: 'Vote du budget prévisionnel 2026 — 142 000 €',
                  },
                  {
                    li: "Travaux de ravalement : appel d'offres (art. 24)",
                  },
                  {
                    li: 'Questions diverses',
                  },
                  {
                    h: 'Pièces jointes',
                  },
                  {
                    li: 'Annexes comptables 1 à 5 (décret 2005-240)',
                  },
                  {
                    li: 'Projet de budget et devis comparatifs',
                  },
                  {
                    li: 'Formulaire de vote par correspondance',
                  },
                ],
              })
            }
          >
            <Icon name="doc" />
            Générer le dossier
          </button>
        }
      />
      <Panel title={`Préparation — ${nombreFaites}/${ETAPES_PREPARATION_AG.length} étapes`} icon="clipboard">
        <ProgressBar pct={pourcentage} kind={pourcentage === 100 ? 'sage' : 'gold'} />
        <div
          style={{
            marginTop: 14,
          }}
        >
          {ETAPES_PREPARATION_AG.map(([id, libelle, ton]) => (
            <div
              onClick={() =>
                setEtapesFaites((precedentes) => ({
                  ...precedentes,
                  [id]: !precedentes[id],
                }))
              }
              onKeyDown={surActivationClavier(() =>
                setEtapesFaites((precedentes) => ({
                  ...precedentes,
                  [id]: !precedentes[id],
                })),
              )}
              role="button"
              tabIndex={0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 8px',
                borderBottom: '1px solid var(--line)',
                cursor: 'pointer',
              }}
              key={id}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 5,
                  border: '1.5px solid var(--line-strong)',
                  background: etapesFaites[id] ? 'var(--sage-500)' : 'transparent',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  flexShrink: 0,
                }}
              >
                {etapesFaites[id] ? '✓' : ''}
              </span>
              <span
                style={{
                  flex: 1,
                  fontSize: 13,
                  textDecoration: etapesFaites[id] ? 'line-through' : 'none',
                  color: etapesFaites[id] ? 'var(--navy-300)' : 'var(--ink)',
                }}
              >
                {libelle}
              </span>
              <Pill kind={ton} noDot>
                {ton === 'rust' ? 'critique' : ton === 'gold' ? 'clé' : 'standard'}
              </Pill>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
