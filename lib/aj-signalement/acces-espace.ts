// ── Espace « AJ Signalement » : adresse, droits d'accès, menu, page de connexion de l'espace ──────
//
// Espace indépendant du portail copropriétaire et de l'Administrateur judiciaire (demande de Hugo du 10/11/2026) :
// une adresse à lui (/fr/aj-signalement/), son menu, sa page de connexion professionnelle (/fr/aj-signalement/connexion/,
// demande de Hugo du 11/11/2026 : e-mail et mot de passe, sans choix Particulier / Artisan / Pro). Aujourd'hui seul le
// super admin y entre, PAS en « vue en tant que » (_original_role) depuis le 11/11/2026 : même règle que les routes
// (isSuperAdmin, #650) ; chaque gestionnaire y aura plus tard sa page : il suffira d'ajouter son rôle à RoleEspaceQr,
// une branche à roleEspaceQr et ses entrées de menu. Le super admin a, depuis le 11/11/2026, les vues Gestionnaires
// (page profil à l'ancre #gestionnaire/<uuid>), Cabinets et Journal.
//
// Module pur, sans aucune dépendance : importé par le middleware (edge), la page de connexion de l'espace, l'espace
// lui-même et les liens du portail et de l'AJ. Seul app_metadata est lu (posé côté serveur), jamais user_metadata. Ces
// décisions ne donnent aucun droit : les routes /api/aj-signalement/* revérifient le super admin côté serveur
// (controlerAccesQr, rôle ET liste d'e-mails ADMIN_EMAIL, que le navigateur ne connaît pas). La page de connexion
// générale de VitFix (/fr/auth/login/) n'en dépend pas.
// La portée d'un gestionnaire et ses droits sur une copropriété (fin du fichier) sont calculés ici aussi, sur des
// données relues en base par le serveur à chaque appel : c'est la seule fonction d'accès d'AJ Signalement.

import type {
  CoproDroitsQr, DroitsCoproprieteQr, FicheDroitsQr, PorteeQr, ProfilDroitsQr,
} from '@/lib/aj-signalement/types'

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
  // La « vue en tant que » (_original_role) n'entre pas : sinon un super admin en vue d'emprunt verrait la coquille de
  // l'espace et un 403 à chaque appel des routes.
  if (metadonnees.role === 'super_admin') return 'super_admin'
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

export const ENTREES_MENU_QR: readonly EntreeMenuQr[] = [
  { vue: 'tableau-de-bord', libelle: 'Tableau de bord', sousTitre: 'Vue d’ensemble des signalements reçus par QR code', roles: ['super_admin'], barreDuBas: true },
  { vue: 'coproprietes', libelle: 'Copropriétés', sousTitre: 'QR codes, affiches, gestionnaires et destinataires des e-mails', roles: ['super_admin'], barreDuBas: true },
  { vue: 'signalements', libelle: 'Signalements', sousTitre: 'Signalements reçus, détail et suivi', roles: ['super_admin'], barreDuBas: true },
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
 * Ne lit que le rôle : aujourd'hui seul le super admin entre, dans tout espace. PR 2 (page de connexion de chaque
 * cabinet) : lui passer le cabinet de l'espace AVANT d'ajouter le rôle gestionnaire à roleEspaceQr, sinon un
 * gestionnaire d'un autre cabinet serait envoyé dans cet espace.
 */
export function destinationConnexionEspaceQr(espace: string, ancre: string | null | undefined, appMetadata: MetadonneesApp): string | null {
  const role = roleEspaceQr(appMetadata)
  if (!role) return null
  const a = ancreEspaceQr(ancre, role)
  return a ? `${espace}#${texteAncreQr(a)}` : espace
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
