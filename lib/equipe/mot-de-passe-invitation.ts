// lib/equipe/mot-de-passe-invitation.ts
//
// Règle du mot de passe choisi en acceptant une invitation d'équipe pro, quand l'adresse n'a pas encore de compte :
// 8 caractères au moins, une majuscule, un chiffre. Module pur, lu par la page d'invitation (messages avant l'envoi)
// et par /api/pro/invite (refus côté serveur) : une seule règle pour les deux.
//
// Elle ne s'applique jamais au mot de passe d'un compte existant, que l'invité tape pour prouver que ce compte est le
// sien : ce mot de passe a pu être choisi avant cette règle.

export type DefautMotDePasse = 'longueur' | 'majuscule' | 'chiffre'

export const LONGUEUR_MIN_MOT_DE_PASSE = 8

/** Défauts d'un mot de passe neuf, dans l'ordre d'affichage ; liste vide s'il est conforme. */
export function defautsMotDePasseNeuf(motDePasse: string): DefautMotDePasse[] {
  const defauts: DefautMotDePasse[] = []
  if (motDePasse.length < LONGUEUR_MIN_MOT_DE_PASSE) defauts.push('longueur')
  if (!/[A-Z]/.test(motDePasse)) defauts.push('majuscule')
  if (!/\d/.test(motDePasse)) defauts.push('chiffre')
  return defauts
}
