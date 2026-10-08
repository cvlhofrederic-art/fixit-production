// ── Destination d'un compte connecté selon son rôle ─────────────────────────
// Module pur, sans aucune dépendance : importable par le navigateur, les routes serveur et le middleware (edge).
//
// Reproduit à l'identique la table historique de la page de connexion (session existante et connexion réussie) :
// aucune destination ne change. Le rôle passé doit venir de app_metadata (posé côté serveur, non modifiable par
// l'utilisateur), jamais de user_metadata.
//
//   artisan                                         → /{locale}/artisan/dashboard
//   pro_societe | pro_conciergerie | pro_gestionnaire → /{locale}/pro/dashboard
//   tout rôle commençant par « syndic »             → /{locale}/syndic/dashboard
//   tout autre rôle, absent ou inconnu              → /{locale}/client/dashboard
//     (y compris super_admin, coproprio, locataire, client, particulier)

const ROLES_PRO: readonly string[] = ['pro_societe', 'pro_conciergerie', 'pro_gestionnaire']

export function destinationApresConnexion(role: string | undefined, locale: string): string {
  // Garde de type : app_metadata.role est typé `any` côté Supabase ; une valeur non textuelle suit le cas par défaut.
  const roleTexte = typeof role === 'string' ? role : undefined
  if (roleTexte === 'artisan') return `/${locale}/artisan/dashboard`
  if (roleTexte !== undefined && ROLES_PRO.includes(roleTexte)) return `/${locale}/pro/dashboard`
  if (roleTexte !== undefined && roleTexte.startsWith('syndic')) return `/${locale}/syndic/dashboard`
  return `/${locale}/client/dashboard`
}
