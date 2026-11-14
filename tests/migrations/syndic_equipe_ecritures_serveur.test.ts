import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'

// Migration 20261114_syndic_equipe_ecritures_serveur.sql (T20, DT9 élargie) : les écritures de syndic_team_members
// sont réservées aux routes serveur (service role). Retrait des policies d'écriture du titulaire, sous les noms du dépôt
// et sous ceux de la production, et des droits d'écriture des rôles anon et authenticated. Lecture inchangée.
// L'exécution réelle (PGlite, rôle authenticated) est dans syndic_equipe_ecritures_serveur.execution.test.ts.

const DOSSIER = join(process.cwd(), 'supabase/migrations')
const FICHIER = '20261114_syndic_equipe_ecritures_serveur.sql'

/** SQL sans commentaires : une mention en commentaire ne compte pas comme instruction. */
function sansCommentaires(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '')
}

function lire(fichier: string): string {
  return sansCommentaires(readFileSync(join(DOSSIER, fichier), 'utf-8'))
}

const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Policies d'écriture du titulaire (cabinet_id = auth.uid()), sous leurs deux jeux de noms.
const POLICIES_ECRITURE = [
  'syndic_team_members_cabinet_full_access', // dépôt : 20260527_syndic_team_members.sql (FOR ALL)
  'syndic_team_cabinet_write', // dépôt : 041_rls_complete_audit.sql (FOR ALL)
  'syndic_team_insert', // production (constatée le 06/11 et le 14/11/2026)
  'syndic_team_update', // production
  'syndic_team_delete', // production
]

// Lecture conservée : chaque membre voit sa ligne, le titulaire celles de son cabinet.
const POLICIES_LECTURE = ['syndic_team_members_member_select', 'syndic_team_cabinet_read', 'syndic_team_select']

/** Instructions SQL d'un texte sans commentaires (découpage aux points-virgules, blocs DO compris). */
const instructions = (sql: string) => sql.split(';').map((s) => s.trim()).filter(Boolean)

describe(`Migration ${FICHIER}`, () => {
  it('existe', () => {
    expect(existsSync(join(DOSSIER, FICHIER))).toBe(true)
  })

  const sql = existsSync(join(DOSSIER, FICHIER)) ? lire(FICHIER) : ''

  it.each(POLICIES_ECRITURE)('retire %s (DROP POLICY IF EXISTS … ON public.syndic_team_members)', (policy) => {
    const motif = new RegExp(
      `DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+"${echapper(policy)}"\\s+ON\\s+public\\.syndic_team_members\\s*;`,
      'i',
    )
    expect(sql).toMatch(motif)
  })

  it('ne crée ni ne modifie aucune policy (aucun remplacement)', () => {
    expect(sql).not.toMatch(/\bCREATE\s+POLICY\b/i)
    expect(sql).not.toMatch(/\bALTER\s+POLICY\b/i)
  })

  it('ne vise pas syndic_team_members_member_update_self (retirée par #649, dont le test garde ce DROP en dernier)', () => {
    expect(sql).not.toMatch(/member_update_self/i)
  })

  it.each(POLICIES_LECTURE)('garde la lecture : ne touche pas à %s', (policy) => {
    expect(sql).not.toMatch(new RegExp(`"?${echapper(policy)}"?`, 'i'))
  })

  it('retire INSERT, UPDATE, DELETE et TRUNCATE à anon et à authenticated, chacun sous garde d’existence du rôle', () => {
    for (const role of ['anon', 'authenticated']) {
      const motif = new RegExp(
        `IF\\s+EXISTS\\s*\\(\\s*SELECT\\s+1\\s+FROM\\s+pg_roles\\s+WHERE\\s+rolname\\s*=\\s*'${role}'\\s*\\)\\s*THEN\\s*` +
          `REVOKE\\s+INSERT\\s*,\\s*UPDATE\\s*,\\s*DELETE\\s*,\\s*TRUNCATE\\s+ON\\s+public\\.syndic_team_members\\s+FROM\\s+${role}\\s*;`,
        'i',
      )
      expect(sql, role).toMatch(motif)
    }
  })

  it('ne retire ni la lecture ni aucun autre droit, et n’en donne aucun', () => {
    expect(sql).not.toMatch(/\bGRANT\b/i)
    const revokes = instructions(sql).filter((i) => /\bREVOKE\b/i.test(i))
    expect(revokes).toHaveLength(2)
    for (const r of revokes) {
      expect(r).toMatch(/REVOKE\s+INSERT\s*,\s*UPDATE\s*,\s*DELETE\s*,\s*TRUNCATE\s+ON\s+public\.syndic_team_members\s+FROM\s+(anon|authenticated)$/i)
    }
  })

  it('ne touche ni aux données, ni aux tables, ni aux déclencheurs, ni à l’activation de la RLS', () => {
    const liste = instructions(sql)
    expect(liste.filter((i) => /^(INSERT|UPDATE|DELETE|TRUNCATE|MERGE|COPY)\b/i.test(i))).toEqual([])
    // Aussi dans le bloc DO (ses morceaux commencent par « DO $$ » ou « END IF ») : aucun motif ne touche
    // « REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON … ».
    expect(sql).not.toMatch(/\bINSERT\s+INTO\b/i)
    expect(sql).not.toMatch(/\bUPDATE\s+[\w."]+\s+SET\b/i)
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i)
    expect(sql).not.toMatch(/\bTRUNCATE\s+(TABLE\s+)?(ONLY\s+)?[\w."]+\s*(,|;|\bCASCADE\b|\bRESTRICT\b)/i)
    expect(sql).not.toMatch(/\b(ALTER|DROP|CREATE)\s+TABLE\b/i)
    expect(sql).not.toMatch(/\bTRIGGER\b/i)
    expect(sql).not.toMatch(/ROW\s+LEVEL\s+SECURITY/i)
    expect(sql).not.toMatch(/pro_team_members/i)
  })

  it('borne l’attente des verrous (DROP POLICY verrouille la table)', () => {
    expect(sql).toMatch(/set\s+local\s+lock_timeout\s*=\s*'\d+s'\s*;/i)
  })
})

/** Ordre des unités de code (celui de la CLI Supabase), avec un comparateur explicite. */
const parNom = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

describe('Base reconstruite depuis le dépôt', () => {
  // Ordre d'application : nom de fichier, comme la CLI Supabase.
  const fichiers = readdirSync(DOSSIER).filter((f) => f.endsWith('.sql')).sort(parNom)

  it.each(POLICIES_ECRITURE)('%s : la dernière instruction qui la vise est le DROP de cette migration', (policy) => {
    const motif = new RegExp(`\\b(CREATE|ALTER|DROP)\\s+POLICY\\s+(?:IF\\s+EXISTS\\s+)?"?${echapper(policy)}"?(?![\\w])`, 'gi')
    const trouvees: Array<{ fichier: string; verbe: string }> = []
    for (const fichier of fichiers) {
      for (const m of lire(fichier).matchAll(motif)) {
        trouvees.push({ fichier, verbe: m[1].toUpperCase() })
      }
    }
    expect(trouvees.at(-1)).toEqual({ fichier: FICHIER, verbe: 'DROP' })
  })

  it('aucune migration postérieure ne rouvre une écriture des clients sur syndic_team_members', () => {
    const suivantes = fichiers.filter((f) => f > FICHIER)
    // Tests simples par instruction (aucune expression à quantificateurs enchaînés) ; le nom de la table compte
    // aussi entre guillemets, et un GRANT sur toutes les tables du schéma la vise aussi.
    const visent = (i: string) => /\bsyndic_team_members\b/i.test(i)
    for (const fichier of suivantes) {
      for (const i of instructions(lire(fichier))) {
        // Une policy sans FOR vaut FOR ALL : seule une policy FOR SELECT reste admise sur cette table.
        if (/\bCREATE\s+POLICY\b/i.test(i) && visent(i)) {
          expect(i, fichier).toMatch(/\bFOR\s+SELECT\b/i)
        }
        const grantEcriture =
          /\bGRANT\b/i.test(i) &&
          /\b(ALL|INSERT|UPDATE|DELETE|TRUNCATE)\b/i.test(i) &&
          /\b(anon|authenticated|PUBLIC)\b/i.test(i) &&
          (visent(i) || /\bALL\s+TABLES\s+IN\s+SCHEMA\b/i.test(i))
        expect(grantEcriture, `${fichier} : ${i.slice(0, 120)}`).toBe(false)
      }
    }
  })
})
