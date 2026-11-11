// ── Espace « AJ Signalement » : adresse, droits d'accès, menu, page de connexion de l'espace ──────
//
// Espace indépendant du portail copropriétaire et de l'Administrateur judiciaire (demande de Hugo du 10/11/2026) :
// une adresse à lui (/fr/aj-signalement/), son menu, sa page de connexion professionnelle (/fr/aj-signalement/connexion/,
// demande de Hugo du 11/11/2026 : e-mail et mot de passe, sans choix Particulier / Artisan / Pro). Aujourd'hui seul le
// super admin y entre (y compris en « vue en tant que », _original_role) ; chaque gestionnaire y aura plus tard sa
// page : il suffira d'ajouter son rôle à RoleEspaceQr, une branche à roleEspaceQr et ses entrées de menu
// (« Gestionnaires » pour le super admin).
//
// Module pur, sans aucune dépendance : importé par le middleware (edge), la page de connexion de l'espace, l'espace
// lui-même et les liens du portail et de l'AJ. Seul app_metadata est lu (posé côté serveur), jamais user_metadata. Ces
// décisions ne donnent aucun droit : les routes /api/aj-signalement/* revérifient le super admin côté serveur
// (controlerSuperAdmin). La page de connexion générale de VitFix (/fr/auth/login/) n'en dépend pas.

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

/** Rôles admis dans l'espace. Plus tard : 'gestionnaire' (sa propre page), sans rien changer aux appelants. */
export type RoleEspaceQr = 'super_admin'

export type DecisionAccesEspaceQr =
  | { acces: 'autorise'; role: RoleEspaceQr }
  | { acces: 'connexion' }
  | { acces: 'refuse' }

type MetadonneesApp = Record<string, unknown> | null | undefined

const estObjet = (valeur: unknown): valeur is Record<string, unknown> =>
  typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur)

/** Rôle de l'espace d'après app_metadata ; null : aucun accès. */
function roleEspaceQr(metadonnees: MetadonneesApp): RoleEspaceQr | null {
  if (!estObjet(metadonnees)) return null
  if (metadonnees.role === 'super_admin' || metadonnees._original_role === 'super_admin') return 'super_admin'
  return null
}

/**
 * Décision d'accès pour un utilisateur Supabase (ou null sans session). Seul `app_metadata` est lu.
 * - pas de compte → « connexion » (page de connexion de l'espace) ;
 * - rôle admis → « autorise » ;
 * - tout autre compte, app_metadata absent ou illisible compris → « refuse » (page de connexion de l'espace, avec un
 *   message neutre : aucune donnée, aucun rôle nommé).
 */
export function decisionAccesEspaceQr(utilisateur: { app_metadata?: unknown } | null | undefined): DecisionAccesEspaceQr {
  if (!utilisateur) return { acces: 'connexion' }
  const metadonnees = estObjet(utilisateur.app_metadata) ? utilisateur.app_metadata : null
  const role = roleEspaceQr(metadonnees)
  return role ? { acces: 'autorise', role } : { acces: 'refuse' }
}

/** Lien « AJ Signalement » du portail copropriétaire et de l'AJ : l'adresse de l'espace pour un rôle admis, sinon null. */
export function lienEspaceQr(appMetadata: MetadonneesApp): string | null {
  return roleEspaceQr(appMetadata) ? CHEMIN_ESPACE_QR : null
}

// ── Menu ─────────────────────────────────────────────────────────────────────

/** Vues de l'espace, chacune à son ancre (#signalements…). Plus tard : 'gestionnaires' (super admin). */
export type VueEspaceQr = 'tableau-de-bord' | 'coproprietes' | 'signalements'

export const VUE_PAR_DEFAUT_QR: VueEspaceQr = 'tableau-de-bord'

export interface EntreeMenuQr {
  vue: VueEspaceQr
  libelle: string
  sousTitre: string
  /** Rôles qui voient l'entrée. */
  roles: readonly RoleEspaceQr[]
}

export const ENTREES_MENU_QR: readonly EntreeMenuQr[] = [
  { vue: 'tableau-de-bord', libelle: 'Tableau de bord', sousTitre: 'Vue d’ensemble des signalements reçus par QR code', roles: ['super_admin'] },
  { vue: 'coproprietes', libelle: 'Copropriétés', sousTitre: 'QR codes, affiches et destinataires des e-mails', roles: ['super_admin'] },
  { vue: 'signalements', libelle: 'Signalements', sousTitre: 'Signalements reçus, détail et suivi', roles: ['super_admin'] },
  // Place réservée : « Gestionnaires » (super admin), quand le rôle gestionnaire existera.
]

/** Entrées du menu visibles pour un rôle, dans l'ordre. */
export const entreesMenuQr = (role: RoleEspaceQr): EntreeMenuQr[] => ENTREES_MENU_QR.filter((entree) => entree.roles.includes(role))

/** Vue d'une ancre (« #signalements » ou « signalements ») pour un rôle ; vide, inconnue ou non permise : la vue par défaut. */
export function vueDepuisAncreQr(ancre: string, role: RoleEspaceQr): VueEspaceQr {
  const nom = ancre.replace(/^#/, '')
  return entreesMenuQr(role).find((entree) => entree.vue === nom)?.vue ?? VUE_PAR_DEFAUT_QR
}

/** Vue exactement désignée par l'ancre, sans repli (arrivée après connexion) ; null si l'ancre n'en désigne aucune. */
function vueExacteQr(ancre: string | null | undefined, role: RoleEspaceQr): VueEspaceQr | null {
  const nom = (ancre ?? '').replace(/^#/, '')
  return entreesMenuQr(role).find((entree) => entree.vue === nom)?.vue ?? null
}

/**
 * Vue à afficher après un retour du navigateur (popstate) : sans ancre, la vue par défaut ; ancre d'une vue du rôle,
 * cette vue ; toute autre ancre (lien d'évitement #main-content…), null : la vue en cours reste.
 */
export function vueApresRetourQr(ancre: string, role: RoleEspaceQr): VueEspaceQr | null {
  if (ancre.replace(/^#/, '') === '') return VUE_PAR_DEFAUT_QR
  return vueExacteQr(ancre, role)
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

/**
 * Adresse d'arrivée après la connexion professionnelle : l'espace donné par la page (jamais lu dans l'URL : aucune
 * redirection ouverte possible), plus l'ancre si elle désigne exactement une vue du rôle (#signalements du lien de
 * l'e-mail) ; null si le compte n'a pas accès (la page affiche alors le message neutre).
 */
export function destinationConnexionEspaceQr(espace: string, ancre: string | null | undefined, appMetadata: MetadonneesApp): string | null {
  const role = roleEspaceQr(appMetadata)
  if (!role) return null
  const vue = vueExacteQr(ancre, role)
  return vue ? `${espace}#${vue}` : espace
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
