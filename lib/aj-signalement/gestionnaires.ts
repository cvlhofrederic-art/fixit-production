// ── AJ Signalement : fiches gestionnaires, règles pures (navigateur, serveur, tests) ────────────────────────────
//
// Demandes de Hugo du 10/11/2026 : chaque gestionnaire reçoit automatiquement les signalements de ses copropriétés,
// une fois son adresse confirmée ; une fiche n'est acceptée que sur un domaine e-mail de SON cabinet (réglé par client
// dans l'espace, jamais dans le code). Aucune donnée réelle ici : les domaines se saisissent à l'écran.
//   - emailCanoniqueQr / domaineDeEmailQr / emailDansDomainesQr : même règle que la fonction SQL
//     signalements_qr_inviter_gestionnaire (égalité EXACTE du domaine après le « @ », sous-domaines refusés) ;
//   - boiteEmailQr : la boîte d'une adresse, sans l'étiquette « + » de sa partie locale (RG-06 bis : une sous-adresse
//     « prenom+etiquette@ » d'une fiche est l'adresse de la fiche) ; même expression en SQL (migration 20261112) ;
//     partiesBoiteQr : sa partie locale et son domaine (même partie locale sur un autre domaine du cabinet de la fiche) ;
//   - estAdresseDeFicheQr / boitesDeFicheQr : LA règle « adresse d'une fiche » (RG-06 bis), jumelle de la fonction SQL
//     signalements_qr_adresse_de_fiche (migration 20261112) ; mêmes réponses sur la table de cas commune ;
//   - validerDomaineCabinetQr : format du CHECK signalements_qr_domaines_domaine_format, messageries publiques refusées ;
//   - nomCourtQr : « Marie M. », pour que l'e-mail et la page de confirmation nomment la personne (RG-02) ;
//   - etatGestionnaireQr : état d'une fiche affiché au super admin (5 états en PR 1, les 4 états d'accès en PR 2).

import type {
  EnvoiGestionnaireQr, EtatGestionnairePr1Qr, EtatGestionnaireQr, FicheEtatGestionnaireQr, ValidationDomaineCabinetQr,
} from '@/lib/aj-signalement/types'

// ── Adresses et domaines ─────────────────────────────────────────────────────

/** Adresse canonique (rognée, minuscules) si la valeur contient « @ », sinon null (règle des destinataires actuels). */
export function emailCanoniqueQr(valeur: unknown): string | null {
  const propre = typeof valeur === 'string' ? valeur.trim().toLowerCase() : ''
  return propre.includes('@') ? propre : null
}

/**
 * Étiquette « + » d'une partie locale (« prenom+etiquette@ » : sous-adressage de Microsoft 365, Google Workspace…), avec au
 * moins un caractère avant le premier « + ». Reprise telle quelle par la migration 20261112 (regexp_replace de
 * signalements_qr_emails_gestionnaires), ce que vérifie son test.
 */
export const ETIQUETTE_EMAIL_QR = /^([^@+]+)\+[^@]*@/

/**
 * Boîte de réception d'une adresse : canonique, sans l'étiquette « + » de sa partie locale ; null si ce n'est pas une
 * adresse. Deux adresses de même boîte arrivent au même endroit (RG-06 bis, relecture 2 du lot 6).
 */
export function boiteEmailQr(valeur: unknown): string | null {
  const propre = emailCanoniqueQr(valeur)
  return propre === null ? null : propre.replace(ETIQUETTE_EMAIL_QR, '$1@')
}

/**
 * Partie locale de la boîte (sans étiquette « + ») et domaine d'une adresse ; null si ce n'est pas une adresse à un seul
 * « @ » aux deux parties non vides. Sert à reconnaître l'adresse d'une fiche sur un AUTRE domaine de son cabinet
 * (corrections, tour 2 : un cabinet à deux domaines les livre aux mêmes boîtes) ; même découpage en SQL (split_part de
 * la boîte, migration 20261112).
 */
export function partiesBoiteQr(valeur: unknown): { locale: string; domaine: string } | null {
  const boite = boiteEmailQr(valeur)
  if (boite === null) return null
  const parties = boite.split('@')
  if (parties.length !== 2 || !parties[0] || !parties[1]) return null
  return { locale: parties[0], domaine: parties[1] }
}

/**
 * Boîtes qui sont l'adresse d'une fiche : sa boîte, puis, si elle a une partie locale (un seul « @ »), cette partie
 * locale sur chaque domaine déclaré de son cabinet (un cabinet à deux domaines les livre aux mêmes boîtes) ; rien si la
 * fiche n'a pas d'adresse (pseudonymisée). Les domaines sont pris tels quels (forme canonique de la base) ; une valeur
 * vide ou contenant « @ » ne fait pas de boîte. Sert d'index (refus, masquage, compteur, import) : une adresse est celle
 * de la fiche si et seulement si sa boîte est dans cette liste (estAdresseDeFicheQr).
 */
export function boitesDeFicheQr(ficheEmail: unknown, domainesDuCabinet: ReadonlyArray<string | null | undefined>): string[] {
  const boite = boiteEmailQr(ficheEmail)
  if (boite === null) return []
  const parties = partiesBoiteQr(boite)
  const autres = parties === null ? [] : domainesDuCabinet
    .filter((d): d is string => typeof d === 'string' && d !== '' && !d.includes('@'))
    .map((d) => `${parties.locale}@${d}`)
  return [...new Set([boite, ...autres])]
}

/**
 * LA règle « adresse d'une fiche » (RG-06 bis ; contrôle 2 de la PR 2) : même BOÎTE (canonique, sans l'étiquette « + »
 * de sa partie locale), ou même partie locale de boîte sur un domaine déclaré par le cabinet de la fiche
 * (`domainesDuCabinet`) ; le domaine de la fiche n'entre pas en compte (une fiche forcée sur une messagerie publique
 * garde sa partie locale sur les domaines de son cabinet). Jumelle de signalements_qr_adresse_de_fiche (20261112) :
 * mêmes réponses sur la table de cas commune (tests/helpers/aj-signalement-adresse-de-fiche.cas.json), domaine des
 * entrées : adresses validées (ASCII, sans espace intérieur).
 */
export function estAdresseDeFicheQr(adresse: unknown, ficheEmail: unknown, domainesDuCabinet: ReadonlyArray<string | null | undefined>): boolean {
  const boite = boiteEmailQr(adresse)
  return boite !== null && boitesDeFicheQr(ficheEmail, domainesDuCabinet).includes(boite)
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

/** Le plus récent des envois d'un objet (un renvoi rend les précédents caducs) ; null s'il n'y en a aucun. */
function dernierEnvoiQr(envois: readonly EnvoiGestionnaireQr[], objet: EnvoiGestionnaireQr['objet']): EnvoiGestionnaireQr | null {
  return envois
    .filter((e) => e.objet === objet)
    .reduce<EnvoiGestionnaireQr | null>((plusRecent, e) => {
      if (!plusRecent) return e
      return (dateMs(e.creeLe) || 0) > (dateMs(plusRecent.creeLe) || 0) ? e : plusRecent
    }, null)
}

/** Envoi parti il y a moins de 7 jours, ni accepté ni refusé : son lien est encore utilisable. */
function enAttenteQr(envoi: EnvoiGestionnaireQr, maintenant: Date): boolean {
  if (envoi.accepteLe || envoi.refus || !envoi.envoyeLe) return false
  const age = maintenant.getTime() - dateMs(envoi.creeLe)
  return Number.isFinite(age) && age < DUREE_VALIDITE_ENVOI_QR_MS
}

/**
 * État d'une fiche d'après la confirmation de son adresse (PR 1), dans cet ordre : désactivée ; adresse contestée
 * (« Ce n'est pas moi ») ; adresse confirmée ; sinon le dernier envoi de confirmation fait foi : parti il y a moins de
 * 7 jours et en attente → confirmation envoyée ; expiré, jamais parti, illisible ou absent → confirmation expirée (lien
 * inutilisable : à renvoyer). Les envois « acces » ne comptent pas ici.
 */
function etatConfirmationQr(fiche: FicheEtatGestionnaireQr, envois: readonly EnvoiGestionnaireQr[], maintenant: Date): EtatGestionnairePr1Qr {
  if (!fiche.actif) return 'desactive'
  if (fiche.adresseContesteeLe) return 'adresse_contestee'
  if (fiche.adresseConfirmeeLe) return 'adresse_confirmee'
  const dernier = dernierEnvoiQr(envois, 'confirmation_adresse')
  if (!dernier) return 'confirmation_expiree'
  if (dernier.refus === 'pas_moi') return 'adresse_contestee'
  if (dernier.accepteLe) return 'adresse_confirmee'
  return enAttenteQr(dernier, maintenant) ? 'confirmation_envoyee' : 'confirmation_expiree'
}

/**
 * État d'une fiche affiché au super admin : celui de la confirmation d'adresse (PR 1, etatConfirmationQr), puis, PR 2
 * lot 5, seulement si la fiche porte ses champs d'accès (migration 20261112 appliquée ; sinon l'état de la PR 1, envois
 * « acces » ignorés) : désactivée et contestée restent en tête (les boutons Réactiver et Effacer en dépendent) ; puis la
 * demande d'effacement (fiche active) ; l'accès ouvert (compte relié) ; enfin le dernier envoi « acces » : « Ce n'est pas
 * moi » → contestée, refus pour un compte d'un autre espace → refus_autre_espace, en attente → acces_envoye. Un envoi
 * expiré, jamais parti ou accepté sans liaison rend l'état de la PR 1 (accès à renvoyer).
 */
export function etatGestionnaireQr(
  fiche: FicheEtatGestionnaireQr, envois: readonly EnvoiGestionnaireQr[], maintenant: Date = new Date(),
): EtatGestionnaireQr {
  const confirmation = etatConfirmationQr(fiche, envois, maintenant)
  const acces = fiche.acces
  if (!acces || confirmation === 'desactive' || confirmation === 'adresse_contestee') return confirmation
  if (acces.effacementDemandeLe) return 'effacement_demande'
  if (acces.compteRelie && acces.accesOuvertLe) return 'acces_ouvert'
  const dernier = dernierEnvoiQr(envois, 'acces')
  if (dernier?.refus === 'pas_moi') return 'adresse_contestee'
  if (dernier?.refus === 'compte_autre_espace') return 'refus_autre_espace'
  if (dernier && enAttenteQr(dernier, maintenant)) return 'acces_envoye'
  return confirmation
}
