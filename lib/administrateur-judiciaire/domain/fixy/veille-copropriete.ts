import type { ActionFixy } from '@/lib/administrateur-judiciaire/domain/fixy/agents'
import type { RappelVeille } from '@/lib/administrateur-judiciaire/domain/fixy/veille'
import {
  personneDeLaCopro,
  type DonneesRattachementPersonne,
} from '@/lib/administrateur-judiciaire/domain/selection-copropriete'

/**
 * Veille de Fixy selon la copropriété choisie dans le sélecteur du haut de page (demande de Hugo du 29/10/2026) : la
 * veille reste calculée sur tout le portefeuille (useFixy), elle n'est filtrée qu'à l'affichage.
 */

/** Copropriétés (identifiant et code), lots et copropriétaires lus pour rattacher un rappel à sa copropriété. */
export interface DonneesRattachementRappel extends DonneesRattachementPersonne {
  copros: readonly { id: string; code: string }[]
}

/**
 * Vrai si l'action vise la copropriété : par son code (navigation, acte), sinon par le lot du copropriétaire visé
 * (recouvrement, navigation vers une personne).
 */
function actionDeLaCopro(
  action: ActionFixy,
  code: string,
  coproprieteId: string | undefined,
  donnees: DonneesRattachementPersonne,
): boolean {
  if (action.type === 'ouvrirActe') return action.params.code === code
  if (action.type === 'naviguer' && action.params.code) return action.params.code === code
  const { coproprietaireId } = action.params
  return !!coproprietaireId && !!coproprieteId && personneDeLaCopro(coproprietaireId, coproprieteId, donnees)
}

/**
 * Rappels de la veille qui concernent la copropriété `code`, dans l'ordre reçu (du plus grave au moins grave) ; toute
 * la veille, dans un nouveau tableau, quand aucune copropriété n'est choisie (`code` nul ou vide).
 */
export function veilleDeLaCopro(
  veille: readonly RappelVeille[],
  code: string | null | undefined,
  donnees: DonneesRattachementRappel,
): RappelVeille[] {
  if (!code) return [...veille]
  const coproprieteId = donnees.copros.find((copro) => copro.code === code)?.id
  return veille.filter((rappel) => actionDeLaCopro(rappel.action, code, coproprieteId, donnees))
}
