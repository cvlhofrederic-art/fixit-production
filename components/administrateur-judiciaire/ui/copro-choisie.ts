'use client'

import { useState } from 'react'
import { CHAMP_COPROPRIETE } from '@/components/administrateur-judiciaire/data/elements-communs'
import type { ChampFormulaireToast } from '@/components/administrateur-judiciaire/ui/toast'
import { useCoproprietesAffichees } from '@/lib/administrateur-judiciaire/db/hooks'
import { codeDeNomCopro } from '@/lib/administrateur-judiciaire/domain/selection-copropriete'
import { useCodeCoproCourant, useCoproCourante, useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Copropriété choisie dans le sélecteur du haut de page, pour les écrans affichés selon elle (listes filtrées,
 * indicateurs recalculés, formulaires préremplis, sélecteurs locaux reliés). Seul point d'accès des écrans : un hook,
 * un préremplissage du champ « Copropriété », un sélecteur local. Sans copropriété choisie (écran rendu seul), l'écran
 * garde son comportement de démonstration : toutes les lignes, formulaires non préremplis, sélecteur local.
 */
export interface CoproChoisie {
  /** Code de la copropriété choisie ; null sans choix. */
  code: string | null
  /** Nom de la copropriété choisie ; null sans choix (ou copropriété introuvable). */
  nom: string | null
  /**
   * Code d'un nom de copropriété (ou d'un libellé qui commence par ce nom) : copropriétés affichées, puis noms de la
   * démonstration (en mode démo seulement) ; null si inconnu.
   */
  codeDeNom: (nom: string | null | undefined) => string | null
}

/** Code et nom de la copropriété choisie, lus de façon réactive (l'écran suit chaque choix, sans remontage). */
export function useCoproChoisie(): CoproChoisie {
  const code = useCodeCoproCourant()
  const copro = useCoproCourante()
  const copros = useCoproprietesAffichees()
  return {
    code,
    nom: code ? copro.nom || null : null,
    codeDeNom: (nom) => codeDeNomCopro(nom, copros),
  }
}

/** Mention des indicateurs figés de la démonstration, qui valent pour tout le portefeuille. */
export const MENTION_TOUS_MANDATS = 'Tous les mandats'

/**
 * Sous-titre d'un indicateur figé (valeur de démonstration, non recalculée sur la copropriété choisie) : avec une
 * copropriété choisie, il est précédé de `mention` (« Tous les mandats » par défaut) pour ne pas être lu comme celui de
 * cette copropriété ; tel quel sans copropriété choisie.
 */
export function sousTitreFige(
  code: string | null,
  sousTitre?: string,
  mention: string = MENTION_TOUS_MANDATS,
): string | undefined {
  if (!code) return sousTitre
  return sousTitre ? `${mention} · ${sousTitre}` : mention
}

/** Titre de l'état vide d'une liste filtrée : « Aucun sondage pour Villa Montaigne » (« … pour cette copropriété » sans nom). */
export const titreListeVide = (debut: string, nom: string | null): string =>
  `${debut} pour ${nom ?? 'cette copropriété'}`

/**
 * Options d'une liste de choix de copropriétés complétées par `nom` (en tête) s'il y manque : une copropriété de la
 * base absente de la liste de démonstration garde ainsi son option (sinon le navigateur affiche la première). La liste
 * d'origine, intacte, sans nom ou quand il y figure déjà.
 */
export function optionsAvecNom(options: readonly string[], nom: string | null | undefined): readonly string[] {
  return !nom || options.includes(nom) ? options : [nom, ...options]
}

/** Champ « Copropriété » à liste de choix (formulaire rapide ou FormModal). */
interface ChampCopropriete {
  options?: readonly string[]
  value?: string | null
}

/**
 * Seul préremplissage du champ « Copropriété » : copie du champ avec `nom` pour valeur, ajouté en tête des options s'il
 * y manque (optionsAvecNom) ; le champ lui-même, intact, sans copropriété choisie. La constante partagée
 * CHAMP_COPROPRIETE n'est jamais modifiée.
 */
export function champCoproprieteChoisie(nom: string | null | undefined): ChampFormulaireToast
export function champCoproprieteChoisie<T extends ChampCopropriete>(nom: string | null | undefined, champ: T): T
export function champCoproprieteChoisie(
  nom: string | null | undefined,
  champ: ChampCopropriete = CHAMP_COPROPRIETE,
): ChampCopropriete {
  if (!nom) return champ
  return { ...champ, options: optionsAvecNom(champ.options ?? [], nom), value: nom }
}

/**
 * Champs d'un formulaire simulé sans champ copropriété, précédés du champ « Copropriété » prérempli avec la
 * copropriété choisie ; tels quels sans copropriété choisie.
 */
export function avecChampCopro(
  champs: readonly ChampFormulaireToast[],
  nom: string | null | undefined,
): readonly ChampFormulaireToast[] {
  return nom ? [champCoproprieteChoisie(nom), ...champs] : champs
}

/**
 * Seul sélecteur local de copropriété par nom relié au sélecteur du haut de page (Budget, Rapport mensuel, Rédaction
 * de PV, Messages aux copropriétaires, agents IA) : sa valeur suit la copropriété choisie, et le changer la choisit
 * partout (seulement parmi les copropriétés affichées). Sans copropriété choisie (écran rendu seul), il garde son
 * état local, sans rien écrire dans la sélection, comme avant.
 */
export function useNomCoproSuivi(nomParDefaut: string): [nom: string, changer: (nom: string) => void] {
  const { code, nom, codeDeNom } = useCoproChoisie()
  const copros = useCoproprietesAffichees()
  const choisirCopro = useSelectionDossier((etat) => etat.choisirCopro)
  const [nomLocal, setNomLocal] = useState(nomParDefaut)
  const changer = (nouveauNom: string) => {
    const nouveauCode = code ? codeDeNom(nouveauNom) : null
    if (nouveauCode && copros.some((copro) => copro.code === nouveauCode)) choisirCopro(nouveauCode)
    else setNomLocal(nouveauNom)
  }
  return [code ? (nom ?? '') : nomLocal, changer]
}
