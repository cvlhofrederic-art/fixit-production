import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'

// Migration 20261104_rls_policies_roles_serveur.sql : retrait de policies RLS dont la condition
// reposait sur une donnée modifiable par l'utilisateur (raw_user_meta_data), sur une table qu'il
// ne peut pas lire (auth.users), ou laissait des colonnes libres (syndic_team_members).

const DOSSIER = join(process.cwd(), 'supabase/migrations')
const FICHIER = '20261104_rls_policies_roles_serveur.sql'

/** SQL sans commentaires : une mention en commentaire ne compte pas comme instruction. */
function sansCommentaires(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '')
}

function lire(fichier: string): string {
  return sansCommentaires(readFileSync(join(DOSSIER, fichier), 'utf-8'))
}

const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const POLICIES_RETIREES: ReadonlyArray<{ table: string; policy: string }> = [
  { table: 'syndic_team_members', policy: 'syndic_team_members_member_update_self' },
  { table: 'ref_taux', policy: 'ref_taux_admin_write' },
  { table: 'ref_taux', policy: 'ref_taux_admin_update' },
  { table: 'ref_taux', policy: 'ref_taux_admin_delete' },
  { table: 'ref_taux_audit', policy: 'ref_taux_audit_admin' },
  { table: 'audit_logs', policy: 'audit_logs_super_admin_read' },
  { table: 'documents_audit_log', policy: 'documents_audit_log_super_admin' },
]

// Policies conservées : lecture de ses propres données, accès du cabinet, service role.
const POLICIES_CONSERVEES = [
  'syndic_team_members_cabinet_full_access',
  'syndic_team_members_member_select',
  'ref_taux_read',
  'audit_logs_service_role_all',
  'documents_audit_log_service',
  'documents_audit_log_owner_read',
]

describe(`Migration ${FICHIER}`, () => {
  it('existe', () => {
    expect(existsSync(join(DOSSIER, FICHIER))).toBe(true)
  })

  const sql = existsSync(join(DOSSIER, FICHIER)) ? lire(FICHIER) : ''

  it.each(POLICIES_RETIREES)('retire $policy sur public.$table (DROP POLICY IF EXISTS)', ({ table, policy }) => {
    const motif = new RegExp(
      `DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+"${echapper(policy)}"\\s+ON\\s+public\\.${echapper(table)}\\s*;`,
      'i',
    )
    expect(sql).toMatch(motif)
  })

  it('ne crée ni ne modifie aucune policy (aucun remplacement)', () => {
    expect(sql).not.toMatch(/\bCREATE\s+POLICY\b/i)
    expect(sql).not.toMatch(/\bALTER\s+POLICY\b/i)
  })

  it('ne lit ni raw_user_meta_data ni auth.users', () => {
    expect(sql).not.toMatch(/raw_user_meta_data/i)
    expect(sql).not.toMatch(/user_metadata/i)
    expect(sql).not.toMatch(/auth\.users/i)
  })

  it.each(POLICIES_CONSERVEES)('ne touche pas à %s', (policy) => {
    expect(sql).not.toMatch(new RegExp(`"${echapper(policy)}"`, 'i'))
  })

  it('ne touche ni aux tables, ni aux droits, ni à l’activation de la RLS', () => {
    expect(sql).not.toMatch(/\b(ALTER|DROP|CREATE)\s+TABLE\b/i)
    expect(sql).not.toMatch(/\b(GRANT|REVOKE)\b/i)
    expect(sql).not.toMatch(/ROW\s+LEVEL\s+SECURITY/i)
  })

  it('borne l’attente des verrous (DROP POLICY verrouille la table)', () => {
    expect(sql).toMatch(/set\s+local\s+lock_timeout\s*=\s*'\d+s'\s*;/i)
  })
})

describe('Base reconstruite depuis le dépôt', () => {
  // Ordre d'application : nom de fichier, comme la CLI Supabase.
  const fichiers = readdirSync(DOSSIER).filter((f) => f.endsWith('.sql')).sort()

  it.each(POLICIES_RETIREES)('$policy : la dernière instruction qui la vise est le DROP de cette migration', ({ policy }) => {
    const motif = new RegExp(`\\b(CREATE|ALTER|DROP)\\s+POLICY\\s+(?:IF\\s+EXISTS\\s+)?"${echapper(policy)}"`, 'gi')
    const instructions: Array<{ fichier: string; verbe: string }> = []
    for (const fichier of fichiers) {
      for (const m of lire(fichier).matchAll(motif)) {
        instructions.push({ fichier, verbe: m[1].toUpperCase() })
      }
    }
    expect(instructions.at(-1)).toEqual({ fichier: FICHIER, verbe: 'DROP' })
  })

  it('aucune policy ne teste raw_user_meta_data après cette migration', () => {
    // Les policies retirées ici sont les seules du dépôt à lire raw_user_meta_data : une
    // migration plus récente ne doit pas en réintroduire (fonctions et triggers non visés).
    const suivantes = fichiers.filter((f) => f > FICHIER)
    for (const fichier of suivantes) {
      expect(lire(fichier), fichier).not.toMatch(/\b(CREATE|ALTER)\s+POLICY\b[^;]*raw_user_meta_data/i)
    }
  })
})
