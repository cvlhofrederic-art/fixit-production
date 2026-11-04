// ── Rôles qu'un compte peut s'attribuer lui-même après son inscription ──────
// Module pur, sans aucune dépendance : importable par les routes serveur et les tests.
//
// Seule source de cette liste. Elle est appliquée à deux endroits :
//   - POST /api/auth/init-role (app/api/auth/init-role/route.ts) ;
//   - le trigger trg_sync_user_role sur auth.users (fonction public.sync_user_role_to_app_metadata, dernière migration
//     qui la définit dans supabase/migrations/), qui recopie user_metadata.role — écrit par le client via
//     supabase.auth.signUp / updateUser — dans app_metadata.role quand ce dernier est vide.
// tests/securite/roles-auto-attribuables.test.ts vérifie que la fonction SQL porte exactement cette liste : changer
// l'une sans l'autre fait échouer le test.
//
// SÉCURITÉ : les rôles à privilèges ou dormants — syndic et syndic_*, coproprio, pro_conciergerie, pro_gestionnaire,
// super_admin, admin — n'y figurent pas. Ils ne sont attribués que côté serveur : /api/admin/setup,
// /api/syndic/invite, /api/syndic/team, /api/syndic/coproprios/[id]/acces, /api/pro/invite.
// pro_societe y reste : l'onboarding BTP public (app/(commun)/pro/register) le pose, et il ne donne accès qu'à sa
// propre société, vide.
export const ROLES_AUTO_ATTRIBUABLES = ['client', 'artisan', 'particulier', 'locataire', 'pro_societe'] as const

export type RoleAutoAttribuable = (typeof ROLES_AUTO_ATTRIBUABLES)[number]

export function estRoleAutoAttribuable(role: unknown): role is RoleAutoAttribuable {
  return typeof role === 'string' && (ROLES_AUTO_ATTRIBUABLES as readonly string[]).includes(role)
}
