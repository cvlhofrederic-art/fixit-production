'use client'

import { useState } from 'react'
import { DEMO_NOMS_COPROPRIETES } from '@/components/administrateur-judiciaire/data/coproprietes'
import { RESOLUTIONS_PROJET_PV } from '@/components/administrateur-judiciaire/data/redaction-pv'
import { ChampCoproprieteDemo } from '@/components/administrateur-judiciaire/modules/ChampCoproprieteDemo'
import { surActivationClavier } from '@/components/administrateur-judiciaire/ui/clavier'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'

/**
 * Texte du projet de PV. Les résolutions sont numérotées dans l'ordre de sélection (et non dans l'ordre de la
 * liste) ; toutes sont déclarées « adoptée à la majorité (art. 24) ».
 */
function texteProjetPv(copropriete: string, resolutionsSelectionnees: readonly number[]): string {
  const lignesResolutions = resolutionsSelectionnees
    .map((indexResolution, rang) => `${rang + 1}. ${RESOLUTIONS_PROJET_PV[indexResolution]} — adoptée à la majorité (art. 24).`)
    .join('\n')
  return (
    "PROCÈS-VERBAL D'ASSEMBLÉE GÉNÉRALE\n" +
    `${copropriete}\n` +
    '\n' +
    "L'an 2026, les copropriétaires se sont réunis en assemblée générale.\n" +
    '\n' +
    'RÉSOLUTIONS SOUMISES AU VOTE :\n' +
    `${lignesResolutions}\n` +
    '\n' +
    "L'ordre du jour étant épuisé, la séance est levée."
  )
}

/**
 * Rédaction de procès-verbaux (barre latérale : section Outils IA ; surtitre « Assistant · IA ») : choix de la
 * copropriété et des résolutions (cases cochables, sélection initiale : 1re et 3e), aperçu du projet de PV.
 * « Copier » est simulé (rien n'est copié) ; « Générer le PV » ouvre un document fixe (Résidence Le Méridien,
 * séance du 8 juillet 2026) sans rapport avec la copropriété ni les résolutions choisies.
 */
export function RedactionPvModule() {
  const { push } = useToast()
  const [copropriete, setCopropriete] = useState<string>(DEMO_NOMS_COPROPRIETES[0])
  const [resolutionsSelectionnees, setResolutionsSelectionnees] = useState<number[]>([0, 2])
  // Cocher ajoute l'index EN FIN de sélection : la numérotation du PV suit l'ordre des clics (maquette).
  const basculerResolution = (indexResolution: number) =>
    setResolutionsSelectionnees((selection) =>
      selection.includes(indexResolution)
        ? selection.filter((index) => index !== indexResolution)
        : [...selection, indexResolution],
    )
  const projetPv = texteProjetPv(copropriete, resolutionsSelectionnees)

  return (
    <>
      <PageHead
        eyebrow="Assistant · IA"
        title="Rédaction de procès-verbaux"
        lede="Génère un projet de PV d'assemblée à partir des résolutions (outil d'aide à la rédaction)."
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.4fr',
          gap: 16,
        }}
      >
        <Panel title="Paramètres" icon="pencil">
          <ChampCoproprieteDemo value={copropriete} onChange={setCopropriete} />
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--navy-300)',
              margin: '10px 0 6px',
            }}
          >
            Résolutions
          </div>
          {RESOLUTIONS_PROJET_PV.map((resolution, indexResolution) => (
            <div
              onClick={() => basculerResolution(indexResolution)}
              onKeyDown={surActivationClavier(() => basculerResolution(indexResolution))}
              role="button"
              tabIndex={0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 4px',
                cursor: 'pointer',
                fontSize: 13,
              }}
              key={indexResolution}
            >
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  border: '1.5px solid var(--line-strong)',
                  background: resolutionsSelectionnees.includes(indexResolution) ? 'var(--gold-500)' : 'transparent',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  flexShrink: 0,
                }}
              >
                {resolutionsSelectionnees.includes(indexResolution) ? '✓' : ''}
              </span>
              {resolution}
            </div>
          ))}
        </Panel>
        <Panel
          title="Projet de PV"
          icon="doc"
          right={
            <button
              className="btn ghost sm"
              onClick={() =>
                push({
                  kind: 'success',
                  title: 'Simulation',
                  desc: "Rien n'a été copié dans le presse-papiers.",
                })
              }
            >
              <Icon name="download" />
              Copier
            </button>
          }
        >
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 12,
              lineHeight: 1.6,
              color: 'var(--navy-700)',
              background: 'var(--cream)',
              padding: 16,
              borderRadius: 10,
              margin: 0,
            }}
          >
            {projetPv}
          </pre>
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: 12,
            }}
          >
            <button
              className="btn gold"
              onClick={() =>
                push({
                  kind: 'doc',
                  icon: 'fact',
                  title: "Procès-verbal d'assemblée générale",
                  eyebrow: 'Syndic judiciaire · Cabinet Delaunay',
                  docTitle: "Procès-verbal de l'assemblée générale ordinaire",
                  meta: 'Résidence Le Méridien · séance du 8 juillet 2026',
                  lines: [
                    "L'assemblée s'est tenue sous la présidence du syndic judiciaire. 28 copropriétaires présents ou représentés sur 36, soit 712/1000 tantièmes.",
                    {
                      h: 'Décisions',
                    },
                    {
                      k: 'Résolution 1 — Comptes 2025',
                      v: 'Approuvée (art. 24)',
                    },
                    {
                      k: 'Résolution 2 — Budget 2026',
                      v: 'Approuvée (art. 24)',
                    },
                    {
                      k: 'Résolution 3 — Ravalement',
                      v: 'Approuvée (art. 25)',
                    },
                    {
                      k: 'Résolution 4 — Honoraires',
                      v: 'Reportée',
                    },
                    {
                      h: 'Voies de recours',
                    },
                    'Tout copropriétaire opposant ou défaillant dispose de deux mois à compter de la notification pour contester les décisions (art. 42 al. 2 de la loi du 10 juillet 1965).',
                  ],
                })
              }
            >
              <Icon name="sparkle" />
              Générer le PV
            </button>
          </div>
        </Panel>
      </div>
    </>
  )
}
