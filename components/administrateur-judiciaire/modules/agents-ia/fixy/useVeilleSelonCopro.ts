'use client'

import type { Fixy } from '@/components/administrateur-judiciaire/modules/agents-ia/fixy/useFixy'
import type { RappelVeille } from '@/lib/administrateur-judiciaire/domain/fixy/veille'
import { veilleDeLaCopro } from '@/lib/administrateur-judiciaire/domain/fixy/veille-copropriete'
import { useCodeCoproCourant } from '@/lib/administrateur-judiciaire/selection'

/** Veille affichée : rappels retenus, urgents parmi eux, et texte sans rappel quand une copropriété est choisie. */
export interface VeilleAffichee {
  veille: RappelVeille[]
  nbUrgents: number
  /** « Aucun rappel pour <nom> : … » ; absent sur tout le portefeuille (texte par défaut de FixyVeille). */
  messageVide?: string
}

/**
 * Veille de Fixy selon la copropriété choisie dans le sélecteur du haut de page (onglet Tableau et lanceur) ; tout le
 * portefeuille si `toutLePortefeuille` (vues générales) ou sans copropriété choisie. useFixy reste non filtré : le
 * Shell lit sa veille entière.
 */
export function useVeilleSelonCopro(fixy: Fixy, toutLePortefeuille = false): VeilleAffichee {
  const codeCourant = useCodeCoproCourant()
  const code = toutLePortefeuille ? null : codeCourant
  const veille = veilleDeLaCopro(fixy.veille, code, fixy.p)
  const nbUrgents = veille.filter((rappel) => rappel.gravite === 'rust').length
  if (!code) return { veille, nbUrgents }
  const nom = fixy.p.copros.find((copro) => copro.code === code)?.nom || code
  return {
    veille,
    nbUrgents,
    messageVide: `Aucun rappel pour ${nom} : aucun courrier en attente, aucune échéance échue, aucun débiteur sans dossier.`,
  }
}
