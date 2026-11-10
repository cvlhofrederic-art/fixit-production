// ── Espace « AJ Signalement » : adresse, droits d'accès, menu, retour après connexion ─────────────
//
// Espace indépendant du portail copropriétaire et de l'Administrateur judiciaire (demande de Hugo du 10/11/2026) :
// une adresse à lui (/fr/aj-signalement/), son menu, sa connexion. Aujourd'hui seul le super admin y entre (y compris
// en « vue en tant que », _original_role) ; chaque gestionnaire y aura plus tard sa page : il suffira d'ajouter son
// rôle à RoleEspaceQr, une branche à roleEspaceQr et ses entrées de menu (« Gestionnaires » pour le super admin).
//
// Module pur, sans aucune dépendance : importé par le middleware (edge), la page de connexion, l'espace lui-même et les
// liens du portail et de l'AJ. Seul app_metadata est lu (posé côté serveur), jamais user_metadata. Ces décisions ne
// donnent aucun droit : les routes /api/aj-signalement/* revérifient le super admin côté serveur (controlerSuperAdmin).

/** Segment de l'espace, sans préfixe de langue (servi par réécriture depuis /fr/ et /pt/, next.config.ts). */
export const SEGMENT_ESPACE_QR = '/aj-signalement'

export type LangueEspaceQr = 'fr' | 'pt'

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
 * - pas de compte → « connexion » (page de connexion avec retour vers l'espace) ;
 * - rôle admis → « autorise » ;
 * - tout autre compte, app_metadata absent ou illisible compris → « refuse » (message neutre, aucune donnée).
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

/** Vue exactement désignée par l'ancre, sans repli (retour après connexion) ; null si l'ancre n'en désigne aucune. */
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

// ── Connexion ────────────────────────────────────────────────────────────────

/** Paramètre de la page de connexion qui porte l'adresse de retour. */
export const PARAMETRE_RETOUR_QR = 'retour'

/** Retours acceptés, tels qu'ils arrivent, et leur adresse normalisée (liste blanche exacte : rien d'autre). */
const RETOURS_ACCEPTES_QR: ReadonlyMap<string, string> = new Map(
  (['fr', 'pt'] as const).flatMap((langue) => {
    const chemin = cheminEspaceQr(langue)
    return [[chemin, chemin], [chemin.slice(0, -1), chemin]] as const
  }),
)

/** Page de connexion de la langue avec retour vers l'espace de la même langue. */
export function cheminConnexionEspaceQr(langue: string): string {
  const l = langueEspace(langue)
  return `/${l}/auth/login/?${new URLSearchParams({ [PARAMETRE_RETOUR_QR]: cheminEspaceQr(l) }).toString()}`
}

/**
 * Adresse où envoyer un compte qui vient de se connecter avec ?retour=… : l'espace (fr ou pt), plus l'ancre si elle
 * désigne une vue de son rôle ; null si le retour n'est pas exactement l'adresse de l'espace (redirection ouverte) ou
 * si le rôle n'y a pas accès (la page de connexion garde alors la destination habituelle du rôle).
 */
export function retourApresConnexionQr(brut: string | null | undefined, ancre: string | null | undefined, appMetadata: MetadonneesApp): string | null {
  const chemin = brut ? RETOURS_ACCEPTES_QR.get(brut) : undefined
  const role = roleEspaceQr(appMetadata)
  if (!chemin || !role) return null
  const vue = vueExacteQr(ancre, role)
  return vue ? `${chemin}#${vue}` : chemin
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
  refus: {
    titre: 'Accès réservé',
    texte: 'Cet espace n’est pas accessible avec votre compte.',
    retour: 'Retour à l’accueil',
  },
} as const

/**
 * Page du refus (403) rendue par le middleware pour un compte sans accès : HTML minimal, en français, sans script ni
 * donnée, sans dire quel rôle est requis.
 */
export function pageRefusEspaceQr(): string {
  const r = TEXTES_ESPACE_QR.refus
  return [
    '<!doctype html>',
    '<html lang="fr">',
    '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="robots" content="noindex, nofollow, noarchive">',
    `<title>${r.titre}</title>`,
    '<style>body{margin:0;font-family:system-ui,sans-serif;background:#F7F4EE;color:#0D1B2E}main{max-width:32rem;margin:15vh auto;padding:0 1rem}a{color:#0D1B2E}</style>',
    '</head>',
    `<body><main><h1>${r.titre}</h1><p>${r.texte}</p><p><a href="/">${r.retour}</a></p></main></body>`,
    '</html>',
  ].join('\n')
}
