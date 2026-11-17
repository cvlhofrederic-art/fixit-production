'use client'

import { useId, useState, type ReactNode } from 'react'
import type { OptionChoixSinistre } from '@/components/administrateur-judiciaire/data/sinistres'
import type { ChoixIntervenant } from '@/components/administrateur-judiciaire/modules/technique/sinistres/formulaire-sinistre'
import { Section } from '@/components/administrateur-judiciaire/ui/FicheBlocs'
import { Field } from '@/components/administrateur-judiciaire/ui/Field'

/**
 * Briques modifiables de la fiche sinistre, sur les composants de l'interface AJ (Section, Field) : bloc repliable,
 * case à cocher modifiable (hors .field, qui étirerait la case), choix dans l'annuaire avec repli en saisie libre.
 */

/** Valeur de l'option « Saisie libre… » des listes de l'annuaire. */
export const SAISIE_LIBRE = '__libre__'

const STYLE_CASE = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 12.5,
  color: 'var(--navy-700)',
  cursor: 'pointer',
} as const

/** Rangée de cases à cocher. */
export function RangeeCases({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', margin: '0 0 14px' }}>{children}</div>
}

/** Case à cocher modifiable, libellée (lisible par un lecteur d'écran, utilisable au clavier). */
export function CaseModifiable({
  libelle,
  cochee,
  onChange,
}: {
  libelle: string
  cochee: boolean
  onChange: (cochee: boolean) => void
}) {
  return (
    <label style={STYLE_CASE}>
      <input type="checkbox" checked={cochee} onChange={(evenement) => onChange(evenement.target.checked)} />
      {libelle}
    </label>
  )
}

/**
 * Bloc de la fiche (région nommée par son titre). Repliable : bouton « Compléter » / « Replier » (aria-expanded,
 * aria-controls), nommé « Compléter le bloc … » / « Replier le bloc … » : le nom accessible contient le texte visible
 * (WCAG 2.5.3). Le contenu replié n'est pas rendu, les valeurs restent dans l'état du formulaire.
 */
export function BlocFiche({
  titre,
  icone,
  ouvert,
  onBasculer,
  children,
}: {
  titre: string
  icone: string
  ouvert: boolean
  onBasculer: () => void
  children: ReactNode
}) {
  const idContenu = `bloc-sinistre-${useId()}`
  const action = ouvert ? 'Replier' : 'Compléter'
  return (
    <Section titre={titre} icone={icone} large>
      <button
        type="button"
        className="btn ghost sm"
        aria-expanded={ouvert}
        aria-controls={idContenu}
        aria-label={`${action} le bloc ${titre}`}
        onClick={onBasculer}
        style={{ marginBottom: ouvert ? 10 : 0 }}
      >
        {action}
      </button>
      <div id={idContenu}>{ouvert && children}</div>
    </Section>
  )
}

/** Choix courant : dans la liste, en saisie libre, ou non renseigné. */
function modeChoix(valeur: ChoixIntervenant, options: readonly OptionChoixSinistre[], libreDemande: boolean): 'liste' | 'libre' | 'vide' {
  if (valeur.id !== null) return options.some((option) => option.id === valeur.id) ? 'liste' : 'libre'
  if (valeur.nom !== '' || libreDemande) return 'libre'
  return 'vide'
}

/**
 * Choix dans l'annuaire (liste) avec l'option « Saisie libre… », qui ouvre un champ « <libellé> (saisie libre) ».
 * Sans aucune option : un champ de saisie libre, signalé par l'indication `indicationVide`. Une fiche déjà rattachée à
 * une entrée absente de la liste s'affiche en saisie libre (son nom est conservé).
 */
export function ChoixOuSaisie({
  libelle,
  name,
  options,
  valeur,
  onChange,
  indicationVide,
}: {
  libelle: string
  name: string
  options: readonly OptionChoixSinistre[]
  valeur: ChoixIntervenant
  onChange: (valeur: ChoixIntervenant) => void
  indicationVide: string
}) {
  const [libreDemande, setLibreDemande] = useState(false)
  if (options.length === 0)
    return (
      <Field label={libelle} name={name} hint={indicationVide}>
        <input value={valeur.nom} onChange={(evenement) => onChange({ id: null, nom: evenement.target.value })} />
      </Field>
    )
  const mode = modeChoix(valeur, options, libreDemande)
  const selection = mode === 'libre' ? SAISIE_LIBRE : (valeur.id ?? '')
  const choisir = (id: string) => {
    const option = options.find((candidate) => candidate.id === id)
    setLibreDemande(id === SAISIE_LIBRE)
    onChange(option ? { id: option.id, nom: option.libelle } : { id: null, nom: '' })
  }
  return (
    <>
      <Field label={libelle} name={name}>
        <select value={selection} onChange={(evenement) => choisir(evenement.target.value)}>
          <option value="">— Non renseigné —</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.libelle}
            </option>
          ))}
          <option value={SAISIE_LIBRE}>Saisie libre…</option>
        </select>
      </Field>
      {mode === 'libre' && (
        <Field label={`${libelle} (saisie libre)`} name={`${name}-libre`} hint="Hors annuaire : saisie libre.">
          <input value={valeur.nom} onChange={(evenement) => onChange({ id: null, nom: evenement.target.value })} />
        </Field>
      )}
    </>
  )
}
