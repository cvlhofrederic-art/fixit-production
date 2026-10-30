'use client'

import { useEffect } from 'react'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { useCoproprietesAffichees } from '@/lib/administrateur-judiciaire/db/hooks'
import { coproParDefaut } from '@/lib/administrateur-judiciaire/domain/selection-copropriete'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Copropriété du sélecteur du haut de page : copropriété par défaut et mémoire du choix (demande de Hugo du
 * 29/10/2026). Hors du Shell pour que celui-ci n'ait qu'un appel de hook à porter.
 */

/** Clé de stockage local du choix (code de la copropriété, en JSON). */
export const CLE_DOSSIER_EN_COURS = 'vitfix.aj.dossierEnCours'

/** Code de copropriété mémorisé ; null s'il est absent, illisible ou si le stockage local est inaccessible. */
export function lireCodeCoproMemorise(): string | null {
  try {
    const code: unknown = JSON.parse(localStorage.getItem(CLE_DOSSIER_EN_COURS) ?? 'null')
    return typeof code === 'string' && code ? code : null
  } catch {
    // JSON illisible ou stockage inaccessible (navigation privée) : aucun choix mémorisé, la première copropriété.
    return null
  }
}

/** Mémorise le code de copropriété choisi. */
export function memoriserCodeCopro(code: string): void {
  try {
    localStorage.setItem(CLE_DOSSIER_EN_COURS, JSON.stringify(code))
  } catch {
    // Stockage inaccessible : le choix vaut pour la session, il ne sera pas restauré au rechargement.
  }
}

/**
 * Pose la copropriété par défaut (le choix courant, sinon le choix mémorisé, sinon la première) puis mémorise chaque
 * choix (sélecteur, palette, Fixy, radar, sélecteurs des écrans). Un choix absent des copropriétés affichées (code de
 * démonstration en mode réel) est aussitôt remplacé de la même façon, jamais mémorisé.
 *
 * Rien n'est fait tant que la base n'est pas lue : la liste provisoire (démonstration) ne contient pas les copropriétés
 * créées, et le choix mémorisé d'une copropriété créée serait remplacé par la première copropriété de démonstration.
 */
export function useCoproParDefautMemorisee(): void {
  const charge = useDonneesStore((etat) => etat.loaded)
  /** Codes des copropriétés affichées, en chaîne : dépendance stable de l'effet. */
  const codes = useCoproprietesAffichees()
    .map((copro) => copro.code)
    .join('\n')

  useEffect(() => {
    if (!charge || !codes) return undefined
    const copros = codes.split('\n').map((code) => ({ code }))
    const revalider = () => {
      const { code, choisirCopro } = useSelectionDossier.getState()
      const retenu = coproParDefaut(copros, code, lireCodeCoproMemorise())
      if (retenu === code) {
        if (retenu) memoriserCodeCopro(retenu)
        return
      }
      // Le nouveau choix repasse par l'abonnement, qui le mémorise.
      choisirCopro(retenu)
    }
    const desabonner = useSelectionDossier.subscribe((etat, precedent) => {
      if (etat.code !== precedent.code) revalider()
    })
    revalider()
    return desabonner
  }, [charge, codes])
}
