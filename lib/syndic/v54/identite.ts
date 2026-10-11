'use client'

import { createContext, useContext } from 'react'

/** Identité affichée dans le dashboard syndic v54 (accueil du tableau de bord). */
export interface IdentiteSyndic {
  /** Nom du cabinet ou de la personne connectée ; null → accueil neutre (« Bienvenue »). */
  nom: string | null
}

const INCONNUE: IdentiteSyndic = { nom: null }

/** Fourni par SyndicDashboardV54 depuis la session ; valeur par défaut : identité inconnue. */
export const IdentiteSyndicContext = createContext<IdentiteSyndic>(INCONNUE)

export const useIdentiteSyndic = (): IdentiteSyndic => useContext(IdentiteSyndicContext)

/**
 * Nom à afficher depuis `user_metadata` : nom du cabinet, de la société, puis nom complet de la
 * personne (même ordre que l'e-mail d'invitation d'équipe, app/api/syndic/team). Affichage seul,
 * jamais une décision d'accès (user_metadata est modifiable depuis le navigateur).
 */
export function nomAffiche(meta: Record<string, unknown> | null | undefined): string | null {
  if (!meta) return null
  for (const cle of ['cabinet_name', 'company_name', 'full_name', 'name']) {
    const valeur = meta[cle]
    if (typeof valeur === 'string' && valeur.trim()) return valeur.trim()
  }
  return null
}
