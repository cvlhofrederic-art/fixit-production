import { fournisseurGmail } from './gmail'
import { fournisseurMicrosoft } from './microsoft'
import { fournisseurImap } from './imap'
import type { FournisseurBoite, IdFournisseur } from './types'

export * from './types'
export { fournisseurGmail } from './gmail'
export { fournisseurMicrosoft, codeErreurMicrosoft } from './microsoft'
export { fournisseurImap, EXPIRATION_IMAP } from './imap'

/** Fournisseurs de boîte pris en charge, par valeur de syndic_oauth_tokens.provider. */
export const FOURNISSEURS: Readonly<Record<IdFournisseur, FournisseurBoite>> = {
  gmail: fournisseurGmail,
  microsoft: fournisseurMicrosoft,
  imap: fournisseurImap,
}

export function estIdFournisseur(valeur: unknown): valeur is IdFournisseur {
  return typeof valeur === 'string' && Object.prototype.hasOwnProperty.call(FOURNISSEURS, valeur)
}

/**
 * Fournisseur d'une ligne syndic_oauth_tokens. provider vide = 'gmail' (valeur par défaut
 * de la colonne) ; valeur inconnue = null (le poll le signale au lieu de deviner).
 */
export function fournisseurDeLigne(provider: string | null | undefined): FournisseurBoite | null {
  if (!provider) return fournisseurGmail
  return estIdFournisseur(provider) ? FOURNISSEURS[provider] : null
}
