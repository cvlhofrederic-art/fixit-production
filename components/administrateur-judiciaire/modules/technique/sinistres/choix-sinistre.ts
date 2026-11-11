'use client'

import { useMemo } from 'react'
import { DEMO_COPROPRIETES } from '@/components/administrateur-judiciaire/data/coproprietes'
import { DEMO_PRESTATAIRES } from '@/components/administrateur-judiciaire/data/prestataires'
import {
  DEMO_COLLABORATEURS_SINISTRE,
  DEMO_COMPAGNIES_ASSURANCE,
  DEMO_CONTRATS_SINISTRE,
  DEMO_COURTIERS,
  type OptionChoixSinistre,
  type OptionContratSinistre,
} from '@/components/administrateur-judiciaire/data/sinistres'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { useDonneesLocales } from '@/lib/administrateur-judiciaire/db/hooks'
import type { Contrat, Coproprietaire, Lot, Mandat, Prestataire } from '@/lib/administrateur-judiciaire/db/schema'
import { fondementCourt } from '@/lib/administrateur-judiciaire/domain/selection-copropriete'
import { MODE_ACTIF, type Mode } from '@/lib/administrateur-judiciaire/mode'
import type { TypeContrat } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Listes de choix de la fiche sinistre, selon le mode. Les rattachements et les intervenants se choisissent dans les
 * données existantes quand elles existent ; une liste vide fait passer le champ en saisie libre (mention visible).
 * - Démonstration : copropriétés, contrats, compagnies, courtiers et collaborateurs de démonstration (fictifs) ;
 *   mandats, entreprises et personnes du jeu de démonstration chargé dans la base.
 * - Données réelles : la base. Contrats d'assurance (types Assurance, Dommages Ouvrages, Assurance loyer impayé,
 *   Garantie vacance locative),
 *   compagnies (fiche entreprise « Compagnie d'assurance ») et courtiers (« Courtier ») : listes vides tant que
 *   l'application ne les écrit pas ; aucun annuaire de collaborateurs (table utilisateurs non chargée).
 */

export type { OptionChoixSinistre, OptionContratSinistre }

export interface CoproChoixSinistre {
  id: string
  code: string
  nom: string
}

export interface ChoixSinistre {
  copros: readonly CoproChoixSinistre[]
  mandatsDe: (coproprieteId: string) => OptionChoixSinistre[]
  contratsDe: (coproprieteId: string) => OptionContratSinistre[]
  compagnies: readonly OptionChoixSinistre[]
  courtiers: readonly OptionChoixSinistre[]
  collaborateurs: readonly OptionChoixSinistre[]
  entreprises: readonly OptionChoixSinistre[]
  personnesDe: (coproprieteId: string) => OptionChoixSinistre[]
}

/** Données de la base lues pour les listes de choix. */
export interface DonneesChoixSinistre {
  copros: readonly CoproChoixSinistre[]
  mandats: readonly Mandat[]
  contrats: readonly Contrat[]
  prestataires: readonly Prestataire[]
  lots: readonly Lot[]
  coproprietaires: readonly Coproprietaire[]
}

/**
 * Types de contrat proposés dans le champ « Contrat » de la fiche : les garanties d'assurance de TYPE_CONTRAT de Gestéam.
 * « Assurance loyer impayé » et « Garantie vacance locative » (gérance) répondent aux types de sinistre « Loyers
 * Impayés » et « Perte de Loyer ». 🔵 Gestéam propose « les contrats d'assurance du mandat » (tranche 42), sans filtre
 * par type observé : les contrats de prestation, de maintenance, de fourniture… sont écartés par déduction.
 */
const TYPES_CONTRAT_ASSURANCE: readonly TypeContrat[] = [
  'Assurance',
  'Dommages Ouvrages',
  'Assurance loyer impayé',
  'Garantie vacance locative',
]

const libelleMandat = (mandat: Mandat): string =>
  [`RG ${mandat.rg}`, mandat.tribunal, fondementCourt(mandat.fondement)].filter(Boolean).join(' · ')

const optionPrestataire = (prestataire: Prestataire): OptionChoixSinistre => ({ id: prestataire.id, libelle: prestataire.nom })

/** Entreprises de l'annuaire d'un type de la fiche entreprise (« Compagnie d'assurance », « Courtier »). */
const optionsPrestatairesDeType = (prestataires: readonly Prestataire[], type: string): OptionChoixSinistre[] =>
  prestataires.filter((prestataire) => prestataire.fiche?.type === type).map(optionPrestataire)

const estContratAssurance = (contrat: Contrat, coproprieteId: string): boolean =>
  contrat.coproprieteId === coproprieteId && !!contrat.type && TYPES_CONTRAT_ASSURANCE.includes(contrat.type)

/** Contrats d'assurance de la base pour une copropriété (« Assurance => , compagnie »). */
function contratsReels(donnees: DonneesChoixSinistre, coproprieteId: string): OptionContratSinistre[] {
  return donnees.contrats
    .filter((contrat) => estContratAssurance(contrat, coproprieteId))
    .map((contrat) => {
      const compagnie = donnees.prestataires.find((prestataire) => prestataire.id === contrat.prestataireId)?.nom ?? null
      return {
        id: contrat.id,
        libelle: `${contrat.type} => , ${compagnie ?? 'compagnie inconnue'}`,
        compagnie,
        compagnieId: compagnie ? contrat.prestataireId : null,
        numeroPolice: null,
      }
    })
}

/** Personnes de la copropriété : copropriétaires de ses lots (« Nom (lot 12) »). */
function personnesDe(donnees: DonneesChoixSinistre, coproprieteId: string): OptionChoixSinistre[] {
  const lots = new Map(
    donnees.lots.filter((lot) => lot.coproprieteId === coproprieteId).map((lot) => [lot.id, lot.numero]),
  )
  return donnees.coproprietaires
    .filter((personne) => lots.has(personne.lotId))
    .map((personne) => ({ id: personne.id, libelle: `${personne.nom} (lot ${lots.get(personne.lotId)})` }))
}

/** Entreprises de l'annuaire ; en démonstration, celles du jeu de démonstration tant que la base n'est pas chargée. */
const entreprisesDe = (prestataires: readonly Prestataire[], mode: Mode): OptionChoixSinistre[] => {
  if (prestataires.length > 0 || mode === 'reel') return prestataires.map(optionPrestataire)
  return DEMO_PRESTATAIRES.map((prestataire) => ({ id: prestataire.id, libelle: prestataire.nom }))
}

/** Listes de choix d'un mode, sur les données fournies (fonction pure). */
export function construireChoixSinistre(mode: Mode, donnees: DonneesChoixSinistre): ChoixSinistre {
  const demo = mode === 'demo'
  const copros = demo ? DEMO_COPROPRIETES.map(({ id, code, nom }) => ({ id, code, nom })) : donnees.copros
  const codeDe = (coproprieteId: string) => copros.find((copro) => copro.id === coproprieteId)?.code ?? null
  return {
    copros,
    mandatsDe: (coproprieteId) =>
      donnees.mandats
        .filter((mandat) => mandat.coproprieteId === coproprieteId)
        .map((mandat) => ({ id: mandat.id, libelle: libelleMandat(mandat) })),
    contratsDe: (coproprieteId) =>
      demo
        ? DEMO_CONTRATS_SINISTRE.filter((contrat) => contrat.copros.includes(codeDe(coproprieteId) ?? '')).map(
            ({ id, libelle, compagnie, compagnieId, numeroPolice }) => ({ id, libelle, compagnie, compagnieId, numeroPolice }),
          )
        : contratsReels(donnees, coproprieteId),
    compagnies: demo ? DEMO_COMPAGNIES_ASSURANCE : optionsPrestatairesDeType(donnees.prestataires, "Compagnie d'assurance"),
    courtiers: demo ? DEMO_COURTIERS : optionsPrestatairesDeType(donnees.prestataires, 'Courtier'),
    collaborateurs: demo ? DEMO_COLLABORATEURS_SINISTRE : [],
    entreprises: entreprisesDe(donnees.prestataires, mode),
    personnesDe: (coproprieteId) => personnesDe(donnees, coproprieteId),
  }
}

/** Listes de choix de la fiche sinistre pour le mode actif (base chargée à la demande). */
export function useChoixSinistre(): ChoixSinistre {
  const { copros, contrats, prestataires, lots, coproprietaires } = useDonneesLocales()
  const mandats = useDonneesStore((etat) => etat.mandats)
  return useMemo(
    () => construireChoixSinistre(MODE_ACTIF, { copros, mandats, contrats, prestataires, lots, coproprietaires }),
    [copros, mandats, contrats, prestataires, lots, coproprietaires],
  )
}
