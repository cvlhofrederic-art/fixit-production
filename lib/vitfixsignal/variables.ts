// ── Vitfix Signal : secrets et variables du Worker — SEUL endroit où ils sont lus ───────────────────────────────
//
// Trois valeurs, posées par `wrangler secret put` (jamais en clair dans le dépôt) :
//   - VITFIXSIGNAL_CLE_LIENS_DIFFUSION             clé de signature des liens de désinscription (32 caractères au moins) ;
//   - VITFIXSIGNAL_CLE_LIENS_DIFFUSION_PRECEDENTE  clé précédente, pendant une rotation (facultative) ;
//   - VITFIXSIGNAL_EXPEDITEUR_DIFFUSION            adresse d'expédition des diffusions (facultative).
// Usage : lib/vitfixsignal/diffusion-lien.ts (les deux clés) et lib/vitfixsignal/email.ts (l'expéditeur).
//
// Transition (décision du 26/11/2026, lib/vitfixsignal/ancien-nom.ts, bloc F) : en production, ces secrets sont encore
// posés sous leur nom d'avant le renommage du produit. Chaque valeur est donc lue sous son nom actuel et, s'il est
// absent ou vide, sous son ancien nom. Les deux noms posés : le nom actuel l'emporte. Pour quitter l'ancien nom, reposer
// la MÊME valeur sous le nom actuel (une valeur différente pour la clé des liens rendrait invalides les liens déjà
// envoyés, sauf à passer l'ancienne valeur dans …_PRECEDENTE), puis supprimer l'ancien secret. Quand c'est fait, retirer
// le repli ci-dessous et le bloc F du module de transition.
// Filet contre cette erreur (retour de relecture du 26/11/2026) : lireAncienneVariableQr donne la valeur encore posée
// sous l'ancien nom ; diffusion-lien.ts la vérifie comme clé précédente quand elle diffère de la clé courante.
//
// Module pur (aucune dépendance serveur) : l'environnement est passé par l'appelant (process.env par défaut ; un objet
// dans les tests). Aucune valeur n'est journalisée ici.

import { ANCIENS_NOMS_VARIABLES_QR } from '@/lib/vitfixsignal/ancien-nom'

/** Secrets et variables de Vitfix Signal, sous leur nom actuel. */
export const VARIABLES_VITFIXSIGNAL_QR = [
  'VITFIXSIGNAL_CLE_LIENS_DIFFUSION',
  'VITFIXSIGNAL_CLE_LIENS_DIFFUSION_PRECEDENTE',
  'VITFIXSIGNAL_EXPEDITEUR_DIFFUSION',
] as const

export type VariableVitfixSignalQr = (typeof VARIABLES_VITFIXSIGNAL_QR)[number]

/** Environnement lu (process.env par défaut ; un objet dans les tests). */
export type EnvVitfixSignalQr = Readonly<Record<string, string | undefined>>

const renseignee = (valeur: string | undefined): valeur is string => typeof valeur === 'string' && valeur.trim() !== ''

/**
 * Valeur d'un secret ou d'une variable, telle que posée (non rognée) : sous son nom actuel, sinon sous son ancien nom ;
 * undefined si aucune des deux n'est renseignée (absente, vide ou faite d'espaces).
 */
export function lireVariableQr(nom: VariableVitfixSignalQr, env: EnvVitfixSignalQr = process.env): string | undefined {
  const actuelle = env[nom]
  if (renseignee(actuelle)) return actuelle
  return lireAncienneVariableQr(nom, env)
}

/**
 * Valeur encore posée sous l'ANCIEN nom d'un secret ou d'une variable, telle que posée (non rognée), que le nom actuel
 * soit renseigné ou non ; undefined si elle est absente, vide ou faite d'espaces. Transition seulement (bloc F).
 */
export function lireAncienneVariableQr(nom: VariableVitfixSignalQr, env: EnvVitfixSignalQr = process.env): string | undefined {
  const ancienne = env[ANCIENS_NOMS_VARIABLES_QR[nom]]
  return renseignee(ancienne) ? ancienne : undefined
}
