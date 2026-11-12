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
//   tout autre rôle, absent ou inconnu                → /{locale}/client/dashboard
//     (y compris super_admin, coproprio, locataire, client, particulier)
//
// gestionnaire_signalement (AJ Signalement, PR 2) : gestionnaire d'un cabinet client, sans tableau de bord VitFix.
// L'espace AJ Signalement est en français pour tout cabinet ; le middleware y aiguille le compte vers l'espace de SON
// cabinet (vitfix.io/<identifiant>/suivi/, repère de routage), ou vers la connexion de l'espace (message neutre) sans
// repère. Valeurs écrites ici pour garder le module sans dépendance ; tests/auth/destination-par-role.test.ts vérifie
// qu'elles sont celles de lib/aj-signalement/acces-espace.ts (ROLE_GESTIONNAIRE_QR, CHEMIN_ESPACE_QR).

const ROLES_PRO: readonly string[] = ['pro_societe', 'pro_conciergerie', 'pro_gestionnaire']

const ROLE_GESTIONNAIRE_SIGNALEMENT = 'gestionnaire_signalement'
const ESPACE_AJ_SIGNALEMENT = '/fr/aj-signalement/'

export function destinationApresConnexion(role: unknown, locale: string): string {
  // Garde de type : app_metadata.role est typé `any` côté Supabase ; une valeur non textuelle suit le cas par défaut.
  const roleTexte = typeof role === 'string' ? role : undefined
  if (roleTexte === 'artisan') return `/${locale}/artisan/dashboard`
  if (roleTexte !== undefined && ROLES_PRO.includes(roleTexte)) return `/${locale}/pro/dashboard`
  if (roleTexte !== undefined && roleTexte.startsWith('syndic')) return `/${locale}/syndic/dashboard`
  if (roleTexte === ROLE_GESTIONNAIRE_SIGNALEMENT) return ESPACE_AJ_SIGNALEMENT
  return `/${locale}/client/dashboard`
}
