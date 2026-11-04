'use client'

// ── Liaison portail copropriétaire ↔ Administrateur judiciaire : lecture réactive (React) ───────────────────────

import { useSyncExternalStore } from 'react'
import {
  CLE_LIAISON_COPRO_AJ,
  abonnerLiaison,
  analyserLiaison,
  etatLiaisonVide,
  type EtatLiaison,
} from '@/lib/liaison-copro-aj/stockage'

/** Dernier texte lu et son état : l'instantané reste le même objet tant que le stockage n'a pas changé. */
let dernierTexte: string | null | undefined
let dernierEtat: EtatLiaison = etatLiaisonVide()
const ETAT_SERVEUR: EtatLiaison = etatLiaisonVide()

function instantane(): EtatLiaison {
  let texte: string | null = null
  try {
    texte = typeof localStorage === 'undefined' ? null : localStorage.getItem(CLE_LIAISON_COPRO_AJ)
  } catch (e) {
    console.warn('[liaison copro-aj] lecture impossible', e)
  }
  if (texte !== dernierTexte) {
    dernierTexte = texte
    dernierEtat = analyserLiaison(texte)
  }
  return dernierEtat
}

/** État de la liaison, mis à jour à chaque échange (ce navigateur, tous onglets). */
export function useLiaisonCoproAj(): EtatLiaison {
  return useSyncExternalStore(abonnerLiaison, instantane, () => ETAT_SERVEUR)
}
