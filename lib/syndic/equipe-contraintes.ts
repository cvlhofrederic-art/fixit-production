// ── Équipe d'un cabinet syndic : ce que la base accepte dans syndic_team_members ─────────────────────────────────────
// Module pur, sans aucune dépendance : importable par les routes serveur et les tests.
//
// Seule source, côté code, des rôles d'un membre d'équipe. La liste est appliquée par le code et par la base :
//   - POST et PATCH /api/syndic/team (invitation, changement de rôle) ;
//   - POST /api/admin/init-team-table (ajout direct par un super admin) ;
//   - la contrainte syndic_team_members_role_check, posée par la dernière migration qui la nomme dans
//     supabase/migrations/ (20261115_syndic_equipe_roles_unicite.sql).
// tests/migrations/syndic_equipe_roles_unicite.test.ts vérifie que la contrainte porte exactement cette liste : changer
// l'une sans l'autre fait échouer le test (le 14/11/2026, la production n'en acceptait que 5 : toute invitation
// « Technicien » ou « Juriste » échouait en erreur 500).
//
// Ce sont les sept rôles syndic_* de SyndicRole (lib/syndic/agent-types.ts) ; 'syndic', le titulaire du cabinet, n'a pas
// de ligne d'équipe. Aucun n'est auto-attribuable (lib/auth/roles-auto-attribuables.ts) : ils ne sont posés que côté
// serveur. syndic_tech (gestionnaire technique, accès large) et syndic_technicien (technicien de terrain, accès
// restreint, créé le 17/05/2026) sont deux rôles distincts : ne jamais les confondre.
export const ROLES_EQUIPE_SYNDIC = [
  'syndic_admin',
  'syndic_tech',
  'syndic_technicien',
  'syndic_secretaire',
  'syndic_gestionnaire',
  'syndic_comptable',
  'syndic_juriste',
] as const

export type RoleEquipeSyndic = (typeof ROLES_EQUIPE_SYNDIC)[number]

export function estRoleEquipeSyndic(role: unknown): role is RoleEquipeSyndic {
  return typeof role === 'string' && (ROLES_EQUIPE_SYNDIC as readonly string[]).includes(role)
}

/**
 * Unicité (cabinet_id, email) de la même migration : une adresse n'apparaît qu'une fois par cabinet, la règle que
 * POST /api/syndic/team vérifie déjà avant d'inviter. Nom de la contrainte, lu dans l'erreur 23505 de PostgreSQL
 * (deux invitations simultanées de la même adresse) ; POST /api/admin/init-team-table l'emploie comme cible d'upsert.
 */
export const UNICITE_EMAIL_PAR_CABINET = 'syndic_team_members_cabinet_id_email_key'
