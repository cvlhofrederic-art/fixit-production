/**
 * Serveur IMAP accepté pour une boîte « autre messagerie » (sans dépendance : importé par
 * lib/validation.ts). TLS direct sur le port 993 uniquement.
 */

export const PORT_IMAPS = 993

/** Nom d'hôte DNS complet (pas d'adresse IP, pas de nom court comme « localhost »). */
export function hoteImapValide(hote: string): boolean {
  return /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$/i.test(hote)
}
