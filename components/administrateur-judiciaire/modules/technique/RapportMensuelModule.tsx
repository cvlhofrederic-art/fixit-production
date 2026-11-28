'use client'

import { useState } from 'react'
import { DEMO_NOMS_COPROPRIETES } from '@/components/administrateur-judiciaire/data/coproprietes'
import { ChampCoproprieteDemo } from '@/components/administrateur-judiciaire/modules/ChampCoproprieteDemo'
import { useCoproChoisie, useNomCoproSuivi } from '@/components/administrateur-judiciaire/ui/copro-choisie'
import { EmptyState } from '@/components/administrateur-judiciaire/ui/EmptyState'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Toggle } from '@/components/administrateur-judiciaire/ui/Toggle'
import { useToast, type OptionsDocument } from '@/components/administrateur-judiciaire/ui/toast'
import type { CoproprieteAffichee } from '@/lib/administrateur-judiciaire/db/hooks'
import { formatEuros } from '@/lib/administrateur-judiciaire/domain/format'
import { codeLigneDemo } from '@/lib/administrateur-judiciaire/domain/selection-copropriete'
import { useCoproCourante } from '@/lib/administrateur-judiciaire/selection'

/** Clé d'une section du rapport mensuel. */
export type CleSectionRapport = 'fin' | 'inter' | 'impayes' | 'jurid' | 'delib'

/** Section du rapport mensuel : [clé, libellé]. */
export type SectionRapportMensuel = readonly [cle: CleSectionRapport, libelle: string]

/** Sections proposées, dans l'ordre d'affichage (définies dans le rendu par la maquette, hissées ici). */
export const SECTIONS_RAPPORT_MENSUEL: readonly SectionRapportMensuel[] = [
  ['fin', 'Situation financière & trésorerie'],
  ['inter', 'Interventions du mois'],
  ['impayes', 'État des impayés'],
  ['jurid', 'Avancement du mandat judiciaire'],
  ['delib', 'Suivi des délibérations'],
]

/** Sections incluses, par clé. */
export type SectionsIncluses = Record<CleSectionRapport, boolean>

/** Faits marquants du rapport de démonstration : [code de la copropriété, texte]. */
const FAITS_MARQUANTS_RAPPORT: readonly (readonly [code: string, texte: string])[] = [
  ['LM', 'Le Méridien : préparation AG du 8 juillet'],
  ['TL', 'Les Tilleuls : étanchéité toiture en cours'],
]

/** Synthèse du rapport généré : périmètre, montants affichés et faits marquants. */
interface SyntheseRapportMensuel {
  perimetre: string
  budget: string
  depenses: string
  impayes: string
  faits: readonly string[]
}

/** Sans copropriété choisie : cumul des quatre copropriétés de démonstration, comme dans la maquette. */
const SYNTHESE_CUMULEE: SyntheseRapportMensuel = {
  perimetre: '4 copropriétés',
  budget: '490 000 €',
  depenses: '307 600 €',
  impayes: '65 010 €',
  faits: FAITS_MARQUANTS_RAPPORT.map(([, texte]) => texte),
}

/** Synthèse de la seule copropriété choisie : ses montants et ses faits marquants. */
function syntheseDeLaCopro(
  copro: Pick<CoproprieteAffichee, 'code' | 'nom' | 'budget' | 'depense' | 'impayes'>,
): SyntheseRapportMensuel {
  const faits = FAITS_MARQUANTS_RAPPORT.filter(([code]) => codeLigneDemo(code) === copro.code).map(([, texte]) => texte)
  return {
    perimetre: copro.nom,
    budget: formatEuros(copro.budget),
    depenses: formatEuros(copro.depense),
    impayes: formatEuros(copro.impayes),
    faits: faits.length ? faits : ['Aucun fait marquant ce mois-ci'],
  }
}

/** Document produit par « Générer le rapport ». */
const documentRapportMensuel = (synthese: SyntheseRapportMensuel): OptionsDocument => ({
  kind: 'doc',
  icon: 'chart',
  title: 'Rapport mensuel de gestion',
  eyebrow: 'Syndic judiciaire · Cabinet Delaunay',
  docTitle: 'Rapport mensuel de gestion',
  meta: `Période : mai 2026 · ${synthese.perimetre}`,
  lines: [
    { h: 'Synthèse' },
    { k: 'Budget voté', v: synthese.budget },
    { k: 'Dépenses', v: synthese.depenses },
    { k: 'Impayés', v: synthese.impayes },
    { h: 'Faits marquants' },
    ...synthese.faits.map((fait) => ({ li: fait })),
  ],
})

/**
 * Rapport mensuel d'activité du syndic judiciaire. La route « ppt », libellée « Plan pluriannuel (PPT) » dans la
 * barre latérale, affiche cet écran (comportement de la maquette). L'aperçu est daté « Juin 2026 » alors que le
 * document généré porte « Période : mai 2026 » (incohérence de la maquette, conservée). Avec une copropriété choisie en
 * haut de page, le select « Copropriété » la suit (et la change) et le rapport ne porte que sur elle ; sans choix,
 * select local et rapport cumulé des quatre copropriétés, comme dans la maquette.
 */
export function RapportMensuelModule() {
  const { push } = useToast()
  const [copropriete, setCopropriete] = useNomCoproSuivi(DEMO_NOMS_COPROPRIETES[0])
  const { code } = useCoproChoisie()
  const copro = useCoproCourante()
  const [sectionsIncluses, setSectionsIncluses] = useState<SectionsIncluses>({
    fin: true,
    inter: true,
    impayes: true,
    jurid: true,
    delib: false,
  })
  const sectionsRetenues = SECTIONS_RAPPORT_MENSUEL.filter(([cle]) => sectionsIncluses[cle])

  return (
    <>
      <PageHead
        eyebrow="Reporting"
        title="Rapport mensuel"
        lede="Compte rendu mensuel d'activité du syndic judiciaire, par copropriété."
        actions={
          <button
            className="btn gold"
            onClick={() => push(documentRapportMensuel(code ? syntheseDeLaCopro(copro) : SYNTHESE_CUMULEE))}
          >
            <Icon name="download" />
            Générer le rapport
          </button>
        }
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.4fr',
          gap: 16,
        }}
      >
        <Panel title="Configuration" icon="wrench">
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
            Sections à inclure
          </div>
          {SECTIONS_RAPPORT_MENSUEL.map(([cle, libelle]) => (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: '1px solid var(--line)',
              }}
              key={cle}
            >
              <span
                style={{
                  fontSize: 13,
                }}
              >
                {libelle}
              </span>
              <Toggle
                on={sectionsIncluses[cle]}
                onToggle={() =>
                  setSectionsIncluses((precedentes) => ({
                    ...precedentes,
                    [cle]: !precedentes[cle],
                  }))
                }
              />
            </div>
          ))}
        </Panel>
        <Panel title="Aperçu du rapport" icon="chart">
          <div
            style={{
              fontFamily: 'Cormorant Garamond, serif',
              fontSize: 22,
              marginBottom: 4,
            }}
          >
            {'Rapport mensuel — '}
            {copropriete}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--navy-300)',
              marginBottom: 14,
            }}
          >
            Juin 2026 · Cabinet Delaunay, syndic judiciaire
          </div>
          {sectionsRetenues.length === 0 ? (
            <EmptyState title="Aucune section sélectionnée" />
          ) : (
            sectionsRetenues.map(([cle, libelle], index) => (
              <div
                style={{
                  padding: '12px 0',
                  borderBottom: index < sectionsRetenues.length - 1 ? '1px solid var(--line)' : 'none',
                }}
                key={cle}
              >
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <span className="dot-status sage" />
                  <b
                    style={{
                      fontSize: 13.5,
                    }}
                  >
                    {index + 1}
                    {'. '}
                    {libelle}
                  </b>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--navy-500)',
                    marginTop: 4,
                    paddingLeft: 16,
                  }}
                >
                  Section incluse — données consolidées du mois.
                </div>
              </div>
            ))
          )}
        </Panel>
      </div>
    </>
  )
}
