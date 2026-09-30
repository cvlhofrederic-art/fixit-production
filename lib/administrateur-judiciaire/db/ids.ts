/**
 * Identifiants aléatoires des entités de la base locale (même algorithme que nanoid : 64 symboles,
 * un octet aléatoire par caractère, masqué sur 6 bits).
 */

/** Alphabet des identifiants (64 symboles, recopié tel quel de la maquette). */
export const ALPHABET_IDENTIFIANTS = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict'

/** Identifiant aléatoire de `taille` caractères (21 par défaut), tiré avec crypto.getRandomValues. */
export function genererId(taille = 21): string {
  let restant = taille | 0
  const octets = crypto.getRandomValues(new Uint8Array(restant))
  let id = ''
  // Les octets sont lus du dernier au premier, comme dans la maquette.
  while (restant--) id += ALPHABET_IDENTIFIANTS[octets[restant] & 63]
  return id
}
