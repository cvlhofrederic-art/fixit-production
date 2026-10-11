/**
 * Serveurs IMAP (port 993) des messageries grand public, déduits du domaine de l'adresse :
 * pré-remplissage du formulaire « Autre messagerie (IMAP) » du Syndic v54. Sans dépendance
 * (utilisé côté navigateur). Domaine du cabinet (ex. hébergé chez OVH) : non deviné, le
 * syndic choisit dans les suggestions d'hébergeurs.
 */

const PAR_DOMAINE: Readonly<Record<string, string>> = {
  'gmail.com': 'imap.gmail.com',
  'googlemail.com': 'imap.gmail.com',
  'icloud.com': 'imap.mail.me.com',
  'me.com': 'imap.mail.me.com',
  'mac.com': 'imap.mail.me.com',
  'yahoo.fr': 'imap.mail.yahoo.com',
  'yahoo.com': 'imap.mail.yahoo.com',
  'orange.fr': 'imap.orange.fr',
  'wanadoo.fr': 'imap.orange.fr',
  'free.fr': 'imap.free.fr',
  'sfr.fr': 'imap.sfr.fr',
  'neuf.fr': 'imap.sfr.fr',
  'laposte.net': 'imap.laposte.net',
  'gmx.fr': 'imap.gmx.net',
  'gmx.com': 'imap.gmx.net',
  'zoho.eu': 'imap.zoho.eu',
}

/** Hébergeurs courants des domaines de cabinet (suggestions du champ « Serveur IMAP »). */
export const SERVEURS_HEBERGEURS: ReadonlyArray<{ hote: string; nom: string }> = [
  { hote: 'ssl0.ovh.net', nom: 'OVHcloud' },
  { hote: 'mail.infomaniak.com', nom: 'Infomaniak' },
  { hote: 'mail.gandi.net', nom: 'Gandi' },
  { hote: 'imap.ionos.fr', nom: 'IONOS' },
  { hote: 'imap.gmail.com', nom: 'Gmail / Google Workspace' },
  { hote: 'imap.mail.me.com', nom: 'iCloud' },
  { hote: 'imap.mail.yahoo.com', nom: 'Yahoo' },
  { hote: 'imap.orange.fr', nom: 'Orange' },
  { hote: 'imap.free.fr', nom: 'Free' },
  { hote: 'imap.zoho.eu', nom: 'Zoho Mail' },
]

const DOMAINES_MICROSOFT = /^(outlook|hotmail|live|msn)\.[a-z.]+$/

function domaineDe(email: string): string {
  const i = email.lastIndexOf('@')
  return i < 0 ? '' : email.slice(i + 1).trim().toLowerCase()
}

/** Serveur IMAP connu pour l'adresse (null si domaine inconnu ou sans IMAP par mot de passe). */
export function serveurImapSuggere(email: string): string | null {
  return PAR_DOMAINE[domaineDe(email)] || null
}

/** Adresse Outlook.com / Hotmail / Live : connexion par le bouton Microsoft, pas par IMAP. */
export function estAdresseMicrosoft(email: string): boolean {
  return DOMAINES_MICROSOFT.test(domaineDe(email))
}
