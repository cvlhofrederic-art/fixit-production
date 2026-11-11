// ── AJ Signalement : fiches gestionnaires, règles pures (navigateur, serveur, tests) ────────────────────────────
//
// Demandes de Hugo du 10/11/2026 : chaque gestionnaire reçoit automatiquement les signalements de ses copropriétés,
// une fois son adresse confirmée ; une fiche n'est acceptée que sur un domaine e-mail de SON cabinet (réglé par client
// dans l'espace, jamais dans le code). Aucune donnée réelle ici : les domaines se saisissent à l'écran.
//   - emailCanoniqueQr / domaineDeEmailQr / emailDansDomainesQr : même règle que la fonction SQL
//     signalements_qr_inviter_gestionnaire (égalité EXACTE du domaine après le « @ », sous-domaines refusés) ;
//   - validerDomaineCabinetQr : format du CHECK signalements_qr_domaines_domaine_format, messageries publiques refusées ;
//   - nomCourtQr : « Marie M. », pour que l'e-mail et la page de confirmation nomment la personne (RG-02) ;
//   - etatGestionnaireQr : état d'une fiche affiché au super admin (5 états en PR 1).

import type {
  EnvoiGestionnaireQr, EtatGestionnairePr1Qr, FicheEtatGestionnaireQr, ValidationDomaineCabinetQr,
} from '@/lib/aj-signalement/types'

// ── Adresses et domaines ─────────────────────────────────────────────────────

/** Adresse canonique (rognée, minuscules) si la valeur contient « @ », sinon null (règle des destinataires actuels). */
export function emailCanoniqueQr(valeur: unknown): string | null {
  const propre = typeof valeur === 'string' ? valeur.trim().toLowerCase() : ''
  return propre.includes('@') ? propre : null
}

/** Domaine d'une adresse : la partie après l'UNIQUE « @ », en minuscules ; null si zéro ou plusieurs « @ » ou partie vide. */
export function domaineDeEmailQr(email: string): string | null {
  const propre = emailCanoniqueQr(email)
  if (!propre) return null
  const parties = propre.split('@')
  if (parties.length !== 2 || !parties[0] || !parties[1]) return null
  return parties[1]
}

/** L'adresse est-elle dans l'un des domaines (égalité exacte, sous-domaines refusés) ? Liste vide : non. */
export function emailDansDomainesQr(email: string, domaines: readonly string[]): boolean {
  const domaine = domaineDeEmailQr(email)
  return domaine !== null && domaines.some((d) => d.trim().toLowerCase() === domaine)
}

/** Format d'un domaine de cabinet (même langage que le CHECK de la migration), en minuscules. */
export const FORMAT_DOMAINE_QR = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/
export const LONGUEUR_MAX_DOMAINE_QR = 253

/**
 * Messageries publiques : jamais le domaine d'un cabinet (n'importe qui y ouvre une boîte, la limite des fiches aux
 * domaines du cabinet ne vaudrait plus rien). Une adresse de ces domaines reste possible pour une fiche, forcée par le
 * super admin (journalisé), ou comme destinataire saisi (conseil syndical), après confirmation.
 */
export const DOMAINES_PUBLICS_QR: readonly string[] = [
  'gmail.com', 'googlemail.com', 'outlook.com', 'outlook.fr', 'hotmail.com', 'hotmail.fr', 'live.com', 'live.fr',
  'msn.com', 'yahoo.com', 'yahoo.fr', 'icloud.com', 'me.com', 'mac.com', 'aol.com', 'gmx.com', 'gmx.fr', 'proton.me',
  'protonmail.com', 'orange.fr', 'wanadoo.fr', 'free.fr', 'sfr.fr', 'laposte.net', 'sapo.pt',
]

const DOMAINES_PUBLICS = new Set(DOMAINES_PUBLICS_QR)

/** Domaine saisi pour un cabinet (déjà rogné et mis en minuscules par la saisie) : format, puis messagerie publique. */
export function validerDomaineCabinetQr(domaine: string): ValidationDomaineCabinetQr {
  if (typeof domaine !== 'string' || domaine.length > LONGUEUR_MAX_DOMAINE_QR || !FORMAT_DOMAINE_QR.test(domaine)) {
    return { ok: false, raison: 'format' }
  }
  return DOMAINES_PUBLICS.has(domaine) ? { ok: false, raison: 'public' } : { ok: true }
}

// ── Nom court ────────────────────────────────────────────────────────────────

/**
 * « Marie Martin » → « Marie M. » : premier mot entier, initiale (en majuscule) du dernier mot ; un seul mot : gardé ;
 * vide ou effacé : ''. Texte brut : le gabarit de l'e-mail l'échappe.
 */
export function nomCourtQr(nom: string | null | undefined): string {
  const mots = (nom ?? '').normalize('NFC').trim().split(/\s+/).filter(Boolean)
  if (mots.length === 0) return ''
  if (mots.length === 1) return mots[0]
  const initiale = /\p{L}/u.exec(mots[mots.length - 1])?.[0]
  return initiale ? `${mots[0]} ${initiale.toLocaleUpperCase('fr-FR')}.` : mots[0]
}

// ── État d'une fiche ─────────────────────────────────────────────────────────

/** Validité d'un lien de confirmation : 7 jours après la création de l'envoi (lib/equipe et la fonction SQL). */
export const DUREE_VALIDITE_ENVOI_QR_MS = 7 * 24 * 60 * 60 * 1000

const dateMs = (valeur: string | null): number => (valeur ? Date.parse(valeur) : Number.NaN)

/**
 * État d'une fiche (PR 1), dans cet ordre : désactivée ; adresse contestée (« Ce n'est pas moi ») ; adresse confirmée ;
 * sinon le dernier envoi de confirmation fait foi (un renvoi rend les précédents caducs) : parti il y a moins de
 * 7 jours et en attente → confirmation envoyée ; expiré, jamais parti, illisible ou absent → confirmation expirée
 * (lien inutilisable : à renvoyer). Les envois « acces » (PR 2) ne comptent pas ici.
 */
export function etatGestionnaireQr(
  fiche: FicheEtatGestionnaireQr, envois: readonly EnvoiGestionnaireQr[], maintenant: Date = new Date(),
): EtatGestionnairePr1Qr {
  if (!fiche.actif) return 'desactive'
  if (fiche.adresseContesteeLe) return 'adresse_contestee'
  if (fiche.adresseConfirmeeLe) return 'adresse_confirmee'
  const dernier = envois
    .filter((e) => e.objet === 'confirmation_adresse')
    .reduce<EnvoiGestionnaireQr | null>((plusRecent, e) => {
      if (!plusRecent) return e
      return (dateMs(e.creeLe) || 0) > (dateMs(plusRecent.creeLe) || 0) ? e : plusRecent
    }, null)
  if (!dernier) return 'confirmation_expiree'
  if (dernier.refus === 'pas_moi') return 'adresse_contestee'
  if (dernier.accepteLe) return 'adresse_confirmee'
  if (dernier.refus || !dernier.envoyeLe) return 'confirmation_expiree'
  const age = maintenant.getTime() - dateMs(dernier.creeLe)
  return Number.isFinite(age) && age < DUREE_VALIDITE_ENVOI_QR_MS ? 'confirmation_envoyee' : 'confirmation_expiree'
}
