// ── Destination d'un compte connecté selon son rôle ─────────────────────────
// Module pur, sans aucune dépendance : importable par le navigateur, les routes serveur et le middleware (edge).
//
// Reproduit à l'identique la table historique de la page de connexion (session existante et connexion réussie) :
// aucune destination ne change. Le rôle passé doit venir de app_metadata (posé côté serveur, non modifiable par
// l'utilisateur), jamais de user_metadata.
//
//   artisan                                           → /{locale}/artisan/dashboard
//   pro_societe | pro_conciergerie | pro_gestionnaire → /{locale}/pro/dashboard
//   tout rôle commençant par « syndic »               → /{locale}/syndic/dashboard
//   gestionnaire_signalement                          → /fr/aj-signalement/ (toute langue)
//   secretariat                                       → /admin/crm/ (CRM du secrétariat, route interne sans langue)
//   tout autre rôle, absent ou inconnu                → /{locale}/client/dashboard
//     (y compris super_admin, coproprio, locataire, client, particulier)
//
// gestionnaire_signalement (AJ Signalement, PR 2) : gestionnaire d'un cabinet client, sans tableau de bord VitFix.
// L'espace AJ Signalement est en français pour tout cabinet ; le middleware y aiguille le compte vers l'espace de SON
// cabinet (vitfix.io/<identifiant>/suivi/, repère de routage), ou vers la connexion de l'espace (message neutre) sans
// repère. Valeurs écrites ici pour garder le module sans dépendance ; tests/auth/destination-par-role.test.ts vérifie
// qu'elles sont celles de lib/aj-signalement/acces-espace.ts (ROLE_GESTIONNAIRE_QR, CHEMIN_ESPACE_QR).
//
// Dans l'appli Vitfix Pro (option appMobile, voir lib/app-mobile.ts), deux rôles changent de destination :
//   artisan                        → l'espace mobile /{locale}/pro/mobile, qui ne lit que la fiche profiles_artisan
//                                   (séparation artisan / BTP, .claude/rules/artisan-vs-btp.md) ;
//   pro_societe, salarié de terrain → /{locale}/pro/dashboard/?p=pointage (voir pageAppliSocieteBtp ci-dessous).
// Tous les autres gardent leur destination, dans l'appli comme dans un navigateur.
// Seule cette table sait si la connexion a lieu dans l'appli (option appMobile). Le middleware, lui, ne peut pas le
// savoir — estAppMobile ne vit que dans le navigateur — et applique donc la même règle à TOUTE visite de /pro/mobile,
// d'où qu'elle vienne. En pratique rien n'y mène hors de l'appli : aucun écran du site ne porte ce lien.

const ROLES_PRO: readonly string[] = ['pro_societe', 'pro_conciergerie', 'pro_gestionnaire']

// Salariés d'une société BTP dont le poste de travail est le chantier : dans l'appli, leur compte s'ouvre directement
// sur le pointage (23/11/2026). Le gérant, la secrétaire et le comptable gardent le tableau de bord.
// Ce partage vient de Frédéric (« donne leur accès au module de pointage ») ; ce n'est PAS une déduction de
// lib/permissions.ts : l'ouvrier et la secrétaire y ont tous deux « pointage: READ », donc la matrice ne permet pas
// de distinguer le poste de chantier du poste de bureau. Elle le ferait pour le chef de chantier et le conducteur de
// travaux, qui ont « FULL » comme le gérant ; et le comptable est le seul à n'avoir aucun accès (« NONE »).
// Noms recopiés de ProTeamRole pour garder ce module sans dépendance ; tests/auth/destination-par-role.test.ts vérifie
// qu'ils sont bien des rôles d'équipe existants, que le comptable est le seul sans accès au pointage, et que tout
// rôle d'équipe est classé d'un côté ou de l'autre.
const ROLES_EQUIPE_TERRAIN: readonly string[] = ['OUVRIER', 'CHEF_CHANTIER', 'CONDUCTEUR_TRAVAUX']

// Barre finale et requête écrites telles quelles : le site est en trailingSlash, cette forme évite une redirection de
// plus sur le téléphone d'un employé. C'est aussi le lien que le gérant partage, au caractère près
// (components/dashboard/btp/pointage/OngletAffectations.tsx).
const PAGE_POINTAGE = '/pro/dashboard/?p=pointage'
const PAGE_DASHBOARD_PRO = '/pro/dashboard'

/**
 * Page d'ouverture d'un compte de société BTP dans l'appli Vitfix Pro, sans préfixe de langue : le pointage pour un
 * salarié de terrain, le tableau de bord pour tout autre compte de la société (gérant compris).
 * Le rôle d'équipe doit venir de app_metadata.pro_team_role (posé par le serveur à l'acceptation de l'invitation,
 * non modifiable par l'utilisateur) ; absent, c'est le compte de la société elle-même.
 * Appelée par la connexion (ci-dessous) ET par le middleware, qui aiguille le départ de l'appli (/pro/mobile) :
 * une seule décision pour les deux chemins.
 */
export function pageAppliSocieteBtp(proTeamRole: unknown): string {
  const roleTexte = typeof proTeamRole === 'string' ? proTeamRole : undefined
  return roleTexte !== undefined && ROLES_EQUIPE_TERRAIN.includes(roleTexte) ? PAGE_POINTAGE : PAGE_DASHBOARD_PRO
}

const ROLE_GESTIONNAIRE_SIGNALEMENT = 'gestionnaire_signalement'
const ESPACE_AJ_SIGNALEMENT = '/fr/aj-signalement/'

// CRM du secrétariat (22/11/2026) : valeurs de lib/crm/types.ts (ROLE_SECRETARIAT, CHEMIN_CRM), recopiées pour garder le
// module sans dépendance ; tests/auth/destination-par-role.test.ts vérifie qu'elles sont identiques.
const ROLE_SECRETARIAT = 'secretariat'
const ECRAN_CRM = '/admin/crm/'

export interface OptionsDestination {
  /** Connexion faite dans l'appli Vitfix Pro (et non dans un navigateur). */
  appMobile?: boolean
  /** Rôle d'équipe d'un sous-compte de société BTP (app_metadata.pro_team_role), absent pour le compte de la société. */
  proTeamRole?: unknown
}

export function destinationApresConnexion(role: unknown, locale: string, options: OptionsDestination = {}): string {
  // Garde de type : app_metadata.role est typé `any` côté Supabase ; une valeur non textuelle suit le cas par défaut.
  const roleTexte = typeof role === 'string' ? role : undefined
  if (roleTexte === 'artisan') return options.appMobile ? `/${locale}/pro/mobile` : `/${locale}/artisan/dashboard`
  if (roleTexte === 'pro_societe' && options.appMobile) return `/${locale}${pageAppliSocieteBtp(options.proTeamRole)}`
  if (roleTexte !== undefined && ROLES_PRO.includes(roleTexte)) return `/${locale}/pro/dashboard`
  if (roleTexte !== undefined && roleTexte.startsWith('syndic')) return `/${locale}/syndic/dashboard`
  if (roleTexte === ROLE_GESTIONNAIRE_SIGNALEMENT) return ESPACE_AJ_SIGNALEMENT
  if (roleTexte === ROLE_SECRETARIAT) return ECRAN_CRM
  return `/${locale}/client/dashboard`
}
