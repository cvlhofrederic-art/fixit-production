// ── Espace « AJ Signalement » : adresse, droits d'accès, menu, page de connexion de l'espace ──────
//
// Espace indépendant du portail copropriétaire et de l'Administrateur judiciaire (demande de Hugo du 10/11/2026) :
// une adresse à lui (/fr/aj-signalement/), son menu, sa page de connexion professionnelle (/fr/aj-signalement/connexion/,
// demande de Hugo du 11/11/2026 : e-mail et mot de passe, sans choix Particulier / Artisan / Pro). Seul le super admin
// entre dans l'espace global, PAS en « vue en tant que » (_original_role) depuis le 11/11/2026 : même règle que les
// routes (isSuperAdmin, #650). Le super admin a, depuis le 11/11/2026, les vues Gestionnaires (page profil à l'ancre
// #gestionnaire/<uuid>), Cabinets et Journal.
// PR 2, lot 4 (Hugo, 11/11/2026, SPEC § 6) : chaque cabinet client a SON espace sous vitfix.io/<identifiant>/ (connexion
// /<identifiant>/connexion/, suivi /<identifiant>/suivi/). Le gestionnaire y entre par son rôle serveur
// (gestionnaire_signalement) ET le repère de routage app_metadata.aj_signalement_cabinet, égal à l'identifiant du
// cabinet de la page : les décisions reçoivent donc ce cabinet. Il n'entre jamais dans l'espace global, ni dans celui
// d'un autre cabinet ; il est aiguillé vers le sien (aiguillageGestionnaireQr). Le super admin, lui, est renvoyé de
// l'espace d'un cabinet vers son espace global.
//
// Module pur, sans autre dépendance que chemin-cabinet.ts (pur lui aussi) : importé par le middleware (edge), les pages
// de connexion, l'espace lui-même et les liens du portail et de l'AJ. Seul app_metadata est lu (posé côté serveur), jamais
// user_metadata. Ces décisions ne donnent aucun droit : les routes /api/aj-signalement/* revérifient tout côté serveur
// (controlerAccesQr : rôle ET liste d'e-mails ADMIN_EMAIL pour le super admin, fiche ACTIVE relue par user_id à chaque
// appel pour un gestionnaire). La page de connexion générale de VitFix (/fr/auth/login/) n'en dépend pas ; la fin du
// « mot de passe oublié » (route et page communes /auth/update-password/) lit connexionApresMotDePasseQr (PR 2, lot 6).
// La portée d'un gestionnaire et ses droits sur une copropriété (fin du fichier) sont calculés ici aussi, sur des
// données relues en base par le serveur à chaque appel : c'est la seule fonction d'accès d'AJ Signalement.

import type {
  CoproDroitsQr, DroitsCoproprieteQr, EspaceCabinetQr, FicheDroitsQr, PorteeQr, ProfilDroitsQr,
} from '@/lib/aj-signalement/types'
import { cheminConnexionCabinetQr, cheminSuiviCabinetQr, validerIdentifiantCabinetQr } from '@/lib/aj-signalement/chemin-cabinet'

/** Rôle serveur (app_metadata.role) d'un compte gestionnaire d'un cabinet client, posé à l'acceptation de son accès. */
export const ROLE_GESTIONNAIRE_QR = 'gestionnaire_signalement'

/**
 * Repère de routage posé dans app_metadata à l'acceptation (identifiant du chemin de SON cabinet) : il sert au
 * middleware, qui n'a pas la base, à aiguiller le gestionnaire vers vitfix.io/<identifiant>/suivi/. Il ne donne AUCUN
 * droit : les routes ne lisent que la fiche.
 */
export const CLE_REPERE_CABINET_QR = 'aj_signalement_cabinet'

/** Segment de l'espace, sans préfixe de langue (servi par réécriture depuis /fr/ et /pt/, next.config.ts). */
export const SEGMENT_ESPACE_QR = '/aj-signalement'

/** Page de connexion professionnelle de l'espace, sans préfixe de langue (réécritures exactes, next.config.ts). */
const SEGMENT_CONNEXION_QR = `${SEGMENT_ESPACE_QR}/connexion`

export type LangueEspaceQr = 'fr' | 'pt'

/** Langues qui ont une page de l'espace (réécritures de next.config.ts) ; en, nl, es n'en ont pas. */
const LANGUES_ESPACE_QR: readonly string[] = ['fr', 'pt'] satisfies readonly LangueEspaceQr[]

const langueEspace = (langue: string): LangueEspaceQr => (langue === 'pt' ? 'pt' : 'fr')

/** Adresse de l'espace dans une langue (barre finale : le site est en trailingSlash). Pas de page sous en, nl, es. */
export const cheminEspaceQr = (langue: string): string => `/${langueEspace(langue)}${SEGMENT_ESPACE_QR}/`

/** Adresse de l'espace (liens du portail, de l'AJ et de l'e-mail envoyé à l'administrateur). */
export const CHEMIN_ESPACE_QR = cheminEspaceQr('fr')

/**
 * Le chemin, SANS préfixe de langue, vise-t-il l'espace ? Segment exact : jamais la page publique ouverte par le QR
 * code (/signalement/<jeton>/), ni un segment voisin (/aj-signalements/), ni la route /api/aj-signalement/*.
 */
export function viseEspaceQr(cheminSansLangue: string): boolean {
  return cheminSansLangue === SEGMENT_ESPACE_QR || cheminSansLangue.startsWith(`${SEGMENT_ESPACE_QR}/`)
}

/**
 * Le chemin, SANS préfixe de langue, est-il la page de connexion de l'espace ? Segment exact, avec ou sans barre
 * finale (jamais /aj-signalement/connexionx/ ni un sous-chemin). Elle fait partie de l'espace (viseEspaceQr) mais n'en
 * redirige jamais un visiteur sans accès vers elle-même (pas de boucle, redirectionEspaceQr).
 */
export function estConnexionEspaceQr(cheminSansLangue: string): boolean {
  return cheminSansLangue === SEGMENT_CONNEXION_QR || cheminSansLangue === `${SEGMENT_CONNEXION_QR}/`
}

// ── Droits ───────────────────────────────────────────────────────────────────

/** Rôles admis : le super admin dans l'espace global, le gestionnaire dans l'espace de SON cabinet (PR 2). */
export type RoleEspaceQr = 'super_admin' | 'gestionnaire'

export type DecisionAccesEspaceQr =
  | { acces: 'autorise'; role: RoleEspaceQr }
  | { acces: 'connexion' }
  | { acces: 'refuse' }

type MetadonneesApp = Record<string, unknown> | null | undefined

const estObjet = (valeur: unknown): valeur is Record<string, unknown> =>
  typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur)

/** Super admin d'après app_metadata.role seul (la « vue en tant que », _original_role, n'entre pas). */
const estSuperAdminQr = (metadonnees: MetadonneesApp): boolean => estObjet(metadonnees) && metadonnees.role === 'super_admin'

/**
 * Repère de routage d'un compte gestionnaire : l'identifiant de SON cabinet, s'il est un identifiant valable (format et
 * noms réservés, validerIdentifiantCabinetQr) ; null pour tout autre compte, sans repère ou au repère mal formé. Il
 * aiguille seulement : il ne donne aucun droit.
 */
export function repereCabinetQr(metadonnees: MetadonneesApp): string | null {
  if (!estObjet(metadonnees) || metadonnees.role !== ROLE_GESTIONNAIRE_QR) return null
  const repere = metadonnees[CLE_REPERE_CABINET_QR]
  return typeof repere === 'string' && validerIdentifiantCabinetQr(repere).ok ? repere : null
}

/**
 * Rôle d'après app_metadata dans un espace ; null : aucun accès. Espace global (cabinet absent) : le super admin seul
 * (sinon il verrait, en « vue en tant que », la coquille de l'espace et un 403 à chaque appel des routes). Espace d'un
 * cabinet : le gestionnaire dont le repère est ce cabinet, seul (le super admin a son espace global).
 */
function roleEspaceQr(metadonnees: MetadonneesApp, cabinet?: string | null): RoleEspaceQr | null {
  if (!estObjet(metadonnees)) return null
  if (cabinet === undefined || cabinet === null) return estSuperAdminQr(metadonnees) ? 'super_admin' : null
  return repereCabinetQr(metadonnees) === cabinet ? 'gestionnaire' : null
}

/**
 * Décision d'accès pour un utilisateur Supabase (ou null sans session), dans l'espace global ou dans celui d'un cabinet
 * (identifiant du cabinet de la page). Seul `app_metadata` est lu.
 * - pas de compte → « connexion » (page de connexion de l'espace) ;
 * - rôle admis dans CET espace → « autorise » ;
 * - tout autre compte, app_metadata absent ou illisible compris → « refuse » (page de connexion de l'espace, avec un
 *   message neutre : aucune donnée, aucun rôle nommé, rien ne dit qu'un autre cabinet existe).
 */
export function decisionAccesEspaceQr(
  utilisateur: { app_metadata?: unknown } | null | undefined,
  cabinet?: string | null,
): DecisionAccesEspaceQr {
  if (!utilisateur) return { acces: 'connexion' }
  const metadonnees = estObjet(utilisateur.app_metadata) ? utilisateur.app_metadata : null
  const role = roleEspaceQr(metadonnees, cabinet)
  return role ? { acces: 'autorise', role } : { acces: 'refuse' }
}

/** Lien « AJ Signalement » du portail copropriétaire et de l'AJ : l'adresse de l'espace global pour un rôle admis, sinon null. */
export function lienEspaceQr(appMetadata: MetadonneesApp): string | null {
  return roleEspaceQr(appMetadata) ? CHEMIN_ESPACE_QR : null
}

// ── Menu ─────────────────────────────────────────────────────────────────────

/**
 * Vues de l'espace, chacune à son ancre (#signalements…). Depuis le 11/11/2026 (demandes de Hugo du 10/11) : les fiches
 * des gestionnaires (page profil à l'ancre #gestionnaire/<uuid>), les cabinets clients et le journal (super admin).
 */
export type VueEspaceQr = 'tableau-de-bord' | 'coproprietes' | 'signalements' | 'gestionnaires' | 'cabinets' | 'journal'

export const VUE_PAR_DEFAUT_QR: VueEspaceQr = 'tableau-de-bord'

/** Vues servies par l'instance unique de TableauSignalementsQr (un seul chargement du tableau). */
export const VUES_TABLEAU_QR: readonly VueEspaceQr[] = ['tableau-de-bord', 'coproprietes', 'signalements']

export interface EntreeMenuQr {
  vue: VueEspaceQr
  libelle: string
  sousTitre: string
  /** Rôles qui voient l'entrée. */
  roles: readonly RoleEspaceQr[]
  /** Présente dans la barre du bas du téléphone (5 places au plus). */
  barreDuBas: boolean
}

/** Les trois vues du tableau, communes au super admin et au gestionnaire (mêmes libellés, point 7.7 du plan). */
const TOUS_LES_ROLES_QR: readonly RoleEspaceQr[] = ['super_admin', 'gestionnaire']

export const ENTREES_MENU_QR: readonly EntreeMenuQr[] = [
  { vue: 'tableau-de-bord', libelle: 'Tableau de bord', sousTitre: 'Vue d’ensemble des signalements reçus par QR code', roles: TOUS_LES_ROLES_QR, barreDuBas: true },
  { vue: 'coproprietes', libelle: 'Copropriétés', sousTitre: 'QR codes, affiches, gestionnaires et destinataires des e-mails', roles: TOUS_LES_ROLES_QR, barreDuBas: true },
  { vue: 'signalements', libelle: 'Signalements', sousTitre: 'Signalements reçus, détail et suivi', roles: TOUS_LES_ROLES_QR, barreDuBas: true },
  { vue: 'gestionnaires', libelle: 'Gestionnaires', sousTitre: 'Fiches, adresses confirmées, copropriétés attribuées et page de suivi', roles: ['super_admin'], barreDuBas: true },
  { vue: 'cabinets', libelle: 'Cabinets', sousTitre: 'Cabinets clients : adresse vitfix.io/<identifiant>/ et domaines e-mail', roles: ['super_admin'], barreDuBas: true },
  // Journal : barre latérale seulement (barre du bas pleine), joignable depuis la vue Cabinets.
  { vue: 'journal', libelle: 'Journal', sousTitre: 'Actions du super admin et des gestionnaires (12 mois)', roles: ['super_admin'], barreDuBas: false },
]

/** Entrées du menu visibles pour un rôle, dans l'ordre. */
export const entreesMenuQr = (role: RoleEspaceQr): EntreeMenuQr[] => ENTREES_MENU_QR.filter((entree) => entree.roles.includes(role))

/** Entrées de la barre du bas du téléphone pour un rôle. */
export const entreesBarreDuBasQr = (role: RoleEspaceQr): EntreeMenuQr[] => entreesMenuQr(role).filter((entree) => entree.barreDuBas)

/** Vue désignée par une ancre, et la fiche ouverte pour la page profil d'un gestionnaire. */
export interface AncreEspaceQr {
  vue: VueEspaceQr
  gestionnaireId: string | null
}

/** Page profil : « gestionnaire/<uuid> » en minuscules, rien d'autre (jamais de chemin ni de suite). */
const ANCRE_GESTIONNAIRE_QR = /^gestionnaire\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/

/**
 * Ancre exactement reconnue pour un rôle (« #cabinets », « cabinets », « #gestionnaire/<uuid> ») ; null si elle ne
 * désigne aucune vue de ce rôle (lien d'évitement #main-content, ancre inconnue ou avec une suite).
 */
export function ancreEspaceQr(ancre: string | null | undefined, role: RoleEspaceQr): AncreEspaceQr | null {
  const nom = (ancre ?? '').replace(/^#/, '')
  const vues = entreesMenuQr(role).map((entree) => entree.vue)
  const profil = ANCRE_GESTIONNAIRE_QR.exec(nom)
  if (profil) return vues.includes('gestionnaires') ? { vue: 'gestionnaires', gestionnaireId: profil[1] } : null
  const vue = vues.find((v) => v === nom)
  return vue ? { vue, gestionnaireId: null } : null
}

/** Ancre à poser dans l'adresse, sans « # » : la vue, ou « gestionnaire/<uuid> » pour une page profil. */
export const texteAncreQr = (a: AncreEspaceQr): string => (a.gestionnaireId ? `gestionnaire/${a.gestionnaireId}` : a.vue)

/** Vue d'une ancre (« #signalements » ou « signalements ») pour un rôle ; vide, inconnue ou non permise : la vue par défaut. */
export function vueDepuisAncreQr(ancre: string, role: RoleEspaceQr): VueEspaceQr {
  return ancreEspaceQr(ancre, role)?.vue ?? VUE_PAR_DEFAUT_QR
}

/**
 * Vue à afficher après un retour du navigateur (popstate) : sans ancre, la vue par défaut ; ancre d'une vue du rôle,
 * cette vue ; toute autre ancre (lien d'évitement #main-content…), null : la vue en cours reste.
 */
export function vueApresRetourQr(ancre: string, role: RoleEspaceQr): VueEspaceQr | null {
  if (ancre.replace(/^#/, '') === '') return VUE_PAR_DEFAUT_QR
  return ancreEspaceQr(ancre, role)?.vue ?? null
}

// ── Connexion professionnelle de l'espace ────────────────────────────────────

/** Page de connexion de l'espace dans une langue (/fr/aj-signalement/connexion/), sans paramètre. */
export const cheminConnexionEspaceQr = (langue: string): string => `/${langueEspace(langue)}${SEGMENT_CONNEXION_QR}/`

/**
 * Redirection du middleware pour un chemin SANS préfixe de langue (null : la requête suit son cours). Le chemin
 * renvoyé est lui aussi sans langue : le middleware le place sous /fr/ ou /pt/ (en, nl, es → /pt/).
 * - page de connexion de l'espace : servie sans session et à un compte sans accès (message neutre, aucune boucle) ;
 *   un compte admis est envoyé dans l'espace ;
 * - reste de l'espace : sans session ou sans accès → page de connexion de l'espace ; accès → la page.
 * Depuis en, nl ou es (aucune page dans ces langues), toujours un renvoi vers la même destination.
 * Un gestionnaire n'est jamais admis ici : le middleware l'aiguille avant vers SON espace (aiguillageGestionnaireQr).
 */
export function redirectionEspaceQr(
  cheminSansLangue: string,
  langue: string,
  utilisateur: { app_metadata?: unknown } | null | undefined,
): string | null {
  if (!viseEspaceQr(cheminSansLangue)) return null
  const admis = decisionAccesEspaceQr(utilisateur).acces === 'autorise'
  const pageDeLaLangue = LANGUES_ESPACE_QR.includes(langue)
  if (estConnexionEspaceQr(cheminSansLangue)) {
    if (admis) return `${SEGMENT_ESPACE_QR}/`
    return pageDeLaLangue ? null : `${SEGMENT_CONNEXION_QR}/`
  }
  if (!admis) return `${SEGMENT_CONNEXION_QR}/`
  return pageDeLaLangue ? null : `${SEGMENT_ESPACE_QR}/`
}

/** Adresse plus l'ancre si elle désigne exactement une vue du rôle (#signalements du lien de l'e-mail), sinon l'adresse seule. */
function avecAncreQr(adresse: string, ancre: string | null | undefined, role: RoleEspaceQr): string {
  const a = ancreEspaceQr(ancre, role)
  return a ? `${adresse}#${texteAncreQr(a)}` : adresse
}

/**
 * Adresse d'arrivée après la connexion professionnelle : l'espace donné par la page (jamais lu dans l'URL : aucune
 * redirection ouverte possible), plus l'ancre si elle désigne exactement une vue du rôle ; null si le compte n'a pas
 * accès (la page affiche alors le message neutre).
 * - page d'un cabinet (identifiant du cabinet passé par la page) : son gestionnaire → l'espace du cabinet ; le super
 *   admin → son espace global ; tout autre compte (gestionnaire d'un autre cabinet compris) → null ;
 * - page globale : le super admin → l'espace global ; un gestionnaire au repère valable → l'espace de SON cabinet ;
 *   tout autre compte → null.
 */
export function destinationConnexionEspaceQr(
  espace: string, ancre: string | null | undefined, appMetadata: MetadonneesApp, cabinet?: string | null,
): string | null {
  if (cabinet !== undefined && cabinet !== null) {
    if (roleEspaceQr(appMetadata, cabinet) === 'gestionnaire') return avecAncreQr(espace, ancre, 'gestionnaire')
    return estSuperAdminQr(appMetadata) ? avecAncreQr(CHEMIN_ESPACE_QR, ancre, 'super_admin') : null
  }
  if (roleEspaceQr(appMetadata) === 'super_admin') return avecAncreQr(espace, ancre, 'super_admin')
  const repere = repereCabinetQr(appMetadata)
  return repere ? avecAncreQr(cheminSuiviCabinetQr(repere), ancre, 'gestionnaire') : null
}

// ── Espace de chaque cabinet (PR 2, lot 4) : décisions du middleware ─────────

/**
 * Redirection du middleware pour l'espace d'un cabinet (chemin reconnu par cheminEspaceCabinetQr), null : la page est
 * servie. Adresses sans langue (l'espace est en français pour tout cabinet). Matrice du plan § 1.5 :
 * - /<id>/ : toujours le suivi (le middleware n'a même pas besoin de la session) ;
 * - /<id>/connexion/ : servie sans session et à tout compte sans accès ici (message neutre, aucune boucle ; un
 *   gestionnaire d'un autre cabinet compris : rien ne lui dit qu'il n'est pas de ce cabinet). La page porte le nom du
 *   cabinet de l'adresse, pour tout visiteur : l'existence et le nom d'un cabinet client se lisent sous son adresse
 *   (identifiant inconnu : 404), choix à valider par Hugo et Frédéric (relecture du lot 6, cabinet-du-chemin.ts) ; le
 *   gestionnaire de CE cabinet → le suivi ; le super admin → son espace global ;
 * - /<id>/suivi/ : le gestionnaire de CE cabinet → servi ; le super admin → son espace global ; tout autre cas → la
 *   connexion du cabinet.
 */
export function redirectionEspaceCabinetQr(
  chemin: EspaceCabinetQr,
  utilisateur: { app_metadata?: unknown } | null | undefined,
): string | null {
  const { page, identifiant } = chemin
  if (page === 'accueil') return cheminSuiviCabinetQr(identifiant)
  const metadonnees = utilisateur && estObjet(utilisateur.app_metadata) ? utilisateur.app_metadata : null
  if (estSuperAdminQr(metadonnees)) return CHEMIN_ESPACE_QR
  const duCabinet = roleEspaceQr(metadonnees, identifiant) === 'gestionnaire'
  if (page === 'connexion') return duCabinet ? cheminSuiviCabinetQr(identifiant) : null
  return duCabinet ? null : cheminConnexionCabinetQr(identifiant)
}

/**
 * Chemin sans langue et sans barre finale (« / » pour l'accueil) : toutes les « / » finales retirées, sauf pour un chemin
 * d'un caractère. Sans expression régulière : `/\/+$/` revenait en arrière à chaque « / » d'une longue suite non finale
 * du chemin de la requête, en temps quadratique (SonarCloud S8786). Exporté pour sa table de cas.
 */
export function sansBarreFinaleQr(chemin: string): string {
  if (chemin.length <= 1) return chemin
  let fin = chemin.length
  while (fin > 0 && chemin[fin - 1] === '/') fin -= 1
  return chemin.slice(0, fin)
}

/** Accueil d'une langue (« », « / ») ou connexion générale (/auth/login), avec ou sans barre finale. */
const estAccueilOuConnexionGeneraleQr = (chemin: string): boolean => chemin === '' || chemin === '/' || chemin === '/auth/login'

/**
 * Pages d'où un gestionnaire est aiguillé vers l'espace de SON cabinet (chemins sans langue, ceux que le middleware
 * contrôle avec la session) : accueil, connexion générale, tableaux de bord client, pro, artisan, syndic, copropriétaire,
 * succursale AJ, espace global AJ Signalement et sa connexion. Jamais une page publique (fiche artisan, blog…).
 */
function estPageAiguilleeQr(chemin: string): boolean {
  return estAccueilOuConnexionGeneraleQr(chemin)
    || chemin === '/client/dashboard' || chemin.startsWith('/client/dashboard/')
    || chemin.startsWith('/pro/')
    || chemin === '/artisan/dashboard' || chemin.startsWith('/artisan/dashboard/')
    || chemin.startsWith('/syndic/')
    || chemin.startsWith('/coproprietaire/')
    || chemin === '/administrateur-judiciaire' || chemin.startsWith('/administrateur-judiciaire/')
    || viseEspaceQr(chemin)
}

/**
 * Aiguillage d'un compte gestionnaire (app_metadata seul) depuis un chemin SANS langue ; null : rien à faire (tout autre
 * compte, ou une page publique). Adresse rendue sans langue, jamais sous /pt/ :
 * - repère valable : les pages de estPageAiguilleeQr → /<repère>/suivi/ ;
 * - sans repère (ou repère mal formé) : accueil et connexion générale → connexion de l'espace global (message neutre ;
 *   aucune boucle : cette page sert un compte non admis) ; ailleurs, comme aujourd'hui.
 * Il aiguille seulement : chaque route /api/aj-signalement/* refait le contrôle sur la fiche.
 */
export function aiguillageGestionnaireQr(cheminSansLangue: string, appMetadata: MetadonneesApp): string | null {
  if (!estObjet(appMetadata) || appMetadata.role !== ROLE_GESTIONNAIRE_QR) return null
  const chemin = sansBarreFinaleQr(cheminSansLangue)
  const repere = repereCabinetQr(appMetadata)
  if (repere) return estPageAiguilleeQr(chemin) || estPageAiguilleeQr(`${chemin}/`) ? cheminSuiviCabinetQr(repere) : null
  return estAccueilOuConnexionGeneraleQr(chemin) ? cheminConnexionEspaceQr('fr') : null
}

// ── Fin du « mot de passe oublié » (PR 2, lot 6, point 7.9 du plan) ─────────

/**
 * Connexion où renvoyer un compte gestionnaire qui vient de choisir son nouveau mot de passe (page commune
 * /auth/update-password/, qui renvoie sinon vers la connexion générale, avec le choix Particulier / Artisan / Pro que
 * Hugo refuse pour un professionnel) : la connexion de SON cabinet si le repère est valable, sinon la connexion de
 * l'espace (message neutre). Tout autre compte (super admin compris : il est aussi l'administrateur de tout VitFix) :
 * null, la page garde son comportement. app_metadata seul.
 */
export function connexionApresMotDePasseQr(appMetadata: MetadonneesApp): string | null {
  if (!estObjet(appMetadata) || appMetadata.role !== ROLE_GESTIONNAIRE_QR) return null
  const repere = repereCabinetQr(appMetadata)
  return repere ? cheminConnexionCabinetQr(repere) : cheminConnexionEspaceQr('fr')
}

/**
 * Destination de retour reçue par la page commune (réponse de POST /api/auth/update-password) : suivie seulement si elle
 * a l'une des deux formes que rend connexionApresMotDePasseQr (aucune redirection ouverte, rien d'une autre origine) ;
 * sinon null (la page garde /auth/login).
 */
export function retourConnexionMotDePasseQr(valeur: unknown): string | null {
  if (typeof valeur !== 'string') return null
  if (valeur === cheminConnexionEspaceQr('fr')) return valeur
  const m = /^\/([^/]+)\/connexion\/$/.exec(valeur)
  return m && validerIdentifiantCabinetQr(m[1]).ok ? cheminConnexionCabinetQr(m[1]) : null
}

// ── Textes ───────────────────────────────────────────────────────────────────

/** Textes de l'espace (français : outil de l'administrateur, comme le tableau de bord). */
export const TEXTES_ESPACE_QR = {
  nom: 'AJ Signalement',
  marque: 'Signalements par QR code',
  menu: 'Menu AJ Signalement',
  verification: 'Vérification de l’accès…',
  redirectionConnexion: 'Redirection vers la page de connexion…',
  seConnecter: 'Se connecter',
  indisponible: 'Votre session n’a pas pu être vérifiée (réseau ou serveur lent). Réessayez dans un instant.',
  reessayer: 'Réessayer',
  seDeconnecter: 'Se déconnecter',
  deconnexionImpossible: 'La déconnexion a échoué. Réessayez.',
  panneauAdmin: 'Panneau admin',
  /** Compte connecté sans accès (page de connexion de l'espace) : ne nomme aucun rôle, n'affiche aucune donnée. */
  sansAcces: 'Cet espace n’est pas accessible avec votre compte.',
} as const

// ── Portée d'un gestionnaire et droits sur une copropriété (SPEC § 1.5, RG-05) ──────────────────────────────────
//
// Q1 (Hugo, 10/11/2026) : les droits suivent l'attribution, même pour le créateur d'une copropriété. Q2 : « attribuée à
// tous » (copropriété de test) donne la lecture, le statut et les e-mails à tous les gestionnaires actifs de SON
// cabinet, jamais la modification de la fiche. En PR 1, seul le super admin se connecte : la page de suivi qu'il voit
// pour un gestionnaire est calculée par porteeGestionnaireQr ; les droits d'un gestionnaire connecté viennent en PR 2.

/** Portée vide (aucune copropriété) : ensembles neufs à chaque appel. */
export const porteeVideQr = (): PorteeQr => ({ visibles: new Set<string>(), modifiables: new Set<string>() })

/**
 * Portée d'une fiche relue en base : fiche inactive → rien ; sinon, parmi les copropriétés de SON cabinet seulement,
 * visibles = attributions explicites ∪ « à tous », modifiables = attributions explicites (origine « creation »
 * comprise). Une attribution vers une copropriété d'un autre cabinet, sans cabinet ou inconnue ne donne rien.
 */
export function porteeGestionnaireQr(
  fiche: FicheDroitsQr, copros: readonly CoproDroitsQr[], attributions: ReadonlySet<string>,
): PorteeQr {
  const portee = { visibles: new Set<string>(), modifiables: new Set<string>() }
  if (!fiche.actif) return portee
  for (const copro of copros) {
    if (copro.cabinetId === null || copro.cabinetId !== fiche.cabinetId) continue
    if (attributions.has(copro.id)) {
      portee.visibles.add(copro.id)
      portee.modifiables.add(copro.id)
    } else if (copro.attribueeATous) {
      portee.visibles.add(copro.id)
    }
  }
  return portee
}

const AUCUN_DROIT_QR: DroitsCoproprieteQr = { voir: false, changerStatut: false, modifierFiche: false, administrer: false }

/**
 * Droits d'un profil sur une copropriété (matrice SPEC § 1.5) : super admin, tout ; gestionnaire, voir et changer le
 * statut dans sa portée, modifier la fiche si elle lui est attribuée explicitement, jamais administrer ; aucun, rien.
 * L'existence de la copropriété (404) est vérifiée par la route.
 */
export function droitsSurCoproprieteQr(profil: ProfilDroitsQr, coproId: string, portee: PorteeQr): DroitsCoproprieteQr {
  if (profil === 'super_admin') return { voir: true, changerStatut: true, modifierFiche: true, administrer: true }
  if (profil !== 'gestionnaire' || !portee.visibles.has(coproId)) return { ...AUCUN_DROIT_QR }
  return { voir: true, changerStatut: true, modifierFiche: portee.modifiables.has(coproId), administrer: false }
}
