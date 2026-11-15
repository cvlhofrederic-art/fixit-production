// tests/migrations/syndic_equipe_roles_unicite.test.ts
//
// Une seule liste des rôles d'équipe syndic (lib/syndic/equipe-contraintes.ts), et partout la même : contrainte de la
// base posée par la migration 20261115 (et son contrôle préalable), scénario de contrôle de l'éditeur SQL, type
// SyndicRole des agents, pages et libellés de l'écran Équipe. Le 14/11/2026, la production n'acceptait que 5 des 7 rôles
// proposés : ce test empêche que la base et l'application divergent de nouveau sans que personne ne le voie.
// L'exécution réelle de la migration est éprouvée par syndic_equipe_roles_unicite.execution.test.ts (PGlite).

import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import {
  ROLES_EQUIPE_SYNDIC,
  UNICITE_EMAIL_PAR_CABINET,
  estRoleEquipeSyndic,
  type RoleEquipeSyndic,
} from '@/lib/syndic/equipe-contraintes'
import { estRoleAutoAttribuable } from '@/lib/auth/roles-auto-attribuables'
import type { SyndicRole } from '@/lib/syndic/agent-types'
import { ROLE_PAGES } from '@/components/syndic-dashboard/config'
import { ROLE_EMOJIS_TEAM, ROLE_LABELS_TEAM, ROLE_LABELS_TEAM_PT } from '@/components/syndic-dashboard/types'

const MIGRATION = '20261115_syndic_equipe_roles_unicite.sql'
const DOSSIER_MIGRATIONS = join(process.cwd(), 'supabase/migrations')
const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf-8').replace(/\r\n/g, '\n')
const sqlMigration = lire(`supabase/migrations/${MIGRATION}`)
/** Le SQL sans ses commentaires de ligne (le retour arrière documenté en tête n'est pas exécuté). */
const sqlExecute = sqlMigration.replace(/--[^\n]*/g, '')

/** Ordre des codes, avec un comparateur explicite. */
function parTexte(a: string, b: string): number {
  if (a === b) return 0
  return a < b ? -1 : 1
}
const trie = (valeurs: readonly string[]) => [...valeurs].sort(parTexte)
const litteraux = (liste: string) => [...liste.matchAll(/'([^']*)'/g)].map((m) => m[1])

// Garde de compilation (tsc de la CI) : la liste est exactement l'ensemble des rôles syndic_* de SyndicRole.
type Egaux<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const LISTE_EGALE_A_SYNDIC_ROLE: Egaux<RoleEquipeSyndic, Exclude<SyndicRole, 'syndic'>> = true

describe('ROLES_EQUIPE_SYNDIC, la liste unique', () => {
  it('sept rôles distincts, tous syndic_* (le middleware et isSyndicRole les reconnaissent par ce préfixe)', () => {
    expect(LISTE_EGALE_A_SYNDIC_ROLE).toBe(true)
    expect(ROLES_EQUIPE_SYNDIC).toHaveLength(7)
    expect(new Set(ROLES_EQUIPE_SYNDIC).size).toBe(7)
    for (const role of ROLES_EQUIPE_SYNDIC) expect(role.startsWith('syndic_'), role).toBe(true)
  })

  it('syndic_tech et syndic_technicien sont deux rôles distincts, tous deux présents', () => {
    expect(ROLES_EQUIPE_SYNDIC).toContain('syndic_tech')
    expect(ROLES_EQUIPE_SYNDIC).toContain('syndic_technicien')
  })

  it("aucun n'est auto-attribuable : ils ne sont posés que côté serveur", () => {
    for (const role of ROLES_EQUIPE_SYNDIC) expect(estRoleAutoAttribuable(role), role).toBe(false)
  })

  it('les rôles syndic_* de SyndicRole (lib/syndic/agent-types.ts), lus dans le source', () => {
    const source = lire('lib/syndic/agent-types.ts')
    const union = /export type SyndicRole =([\s\S]*?)\n\n/.exec(source)?.[1] ?? ''
    const roles = [...union.matchAll(/\|\s*'([^']+)'/g)].map((m) => m[1]).filter((r) => r !== 'syndic')
    expect(trie(roles)).toEqual(trie(ROLES_EQUIPE_SYNDIC))
  })

  it("chaque rôle a ses pages, ses libellés FR et PT et son emoji dans l'écran Équipe", () => {
    for (const role of ROLES_EQUIPE_SYNDIC) {
      expect(ROLE_PAGES[role]?.length, role).toBeGreaterThan(0)
      expect(ROLE_LABELS_TEAM[role], role).toBeTruthy()
      expect(ROLE_LABELS_TEAM_PT[role], role).toBeTruthy()
      expect(ROLE_EMOJIS_TEAM[role], role).toBeTruthy()
    }
  })

  it('estRoleEquipeSyndic : la liste exacte, sensible à la casse, rien d’autre', () => {
    for (const role of ROLES_EQUIPE_SYNDIC) expect(estRoleEquipeSyndic(role)).toBe(true)
    for (const role of ['syndic', 'super_admin', 'admin', 'Syndic_tech', 'syndic_tech ', '', 'syndic_gestor_condominio', null, undefined, 3]) {
      expect(estRoleEquipeSyndic(role), String(role)).toBe(false)
    }
  })
})

describe(`migration ${MIGRATION}`, () => {
  it('pose la contrainte du rôle avec exactement la liste unique', () => {
    const pose = /ADD CONSTRAINT syndic_team_members_role_check\s+CHECK \(role IN \(([^)]*)\)\)/.exec(sqlExecute)
    expect(pose).not.toBeNull()
    expect(trie(litteraux(pose![1]))).toEqual(trie(ROLES_EQUIPE_SYNDIC))
  })

  it('contrôle les lignes existantes avec la même liste avant de rien changer', () => {
    const controle = /WHERE role NOT IN \(([^)]*)\)/.exec(sqlExecute)
    expect(controle).not.toBeNull()
    expect(trie(litteraux(controle![1]))).toEqual(trie(ROLES_EQUIPE_SYNDIC))
    expect(sqlExecute.indexOf('WHERE role NOT IN')).toBeLessThan(sqlExecute.indexOf('ALTER TABLE'))
  })

  it("est la dernière migration qui nomme la contrainte du rôle : c'est la sienne qui est en place", () => {
    const fichiers = readdirSync(DOSSIER_MIGRATIONS).filter((f) => f.endsWith('.sql')).sort(parTexte)
    const nomment = fichiers.filter((f) => readFileSync(join(DOSSIER_MIGRATIONS, f), 'utf-8').includes('syndic_team_members_role_check'))
    expect(nomment.at(-1)).toBe(MIGRATION)
  })

  it("pose l'unicité (cabinet_id, email) sous le nom que lit POST /api/syndic/team", () => {
    expect(sqlExecute).toMatch(new RegExp(`ADD CONSTRAINT ${UNICITE_EMAIL_PAR_CABINET} UNIQUE \\(cabinet_id, email\\)`))
  })

  it('un seul bloc DO, donc tout ou rien, même sous psql (une instruction par transaction)', () => {
    expect(sqlExecute.trim()).toMatch(/^DO \$\$[\s\S]*\n\$\$;$/)
    expect(sqlExecute.match(/\$\$/g)).toHaveLength(2)
  })

  it('ne touche à aucune donnée, policy, droit, index ni déclencheur ; seule la contrainte du rôle est retirée', () => {
    expect(sqlExecute).not.toMatch(/\b(INSERT\s+INTO|DELETE\s+FROM|TRUNCATE|GRANT|REVOKE|POLICY|TRIGGER)\b/i)
    expect(sqlExecute).not.toMatch(/\bUPDATE\s+\S+\s+SET\b/i)
    expect([...sqlExecute.matchAll(/\bDROP\s+(\w+)(?:\s+IF\s+EXISTS)?\s+(\w+)/gi)].map((m) => `${m[1]} ${m[2]}`))
      .toEqual(['CONSTRAINT syndic_team_members_role_check'])
  })

  it('aucun SQL laissé en commentaire (collé dans l’éditeur, il ne ferait rien) : le retour arrière est dans la documentation', () => {
    expect(sqlMigration).not.toMatch(/^--\s+(ALTER|DROP|CREATE)\b/im)
    expect(sqlMigration).toContain('docs/rollback-procedures.md')
  })
})

describe('retour arrière de docs/rollback-procedures.md', () => {
  const doc = lire('docs/rollback-procedures.md')
  const section = doc.split('## Migration 20261115 — Équipe syndic : rôles et unicité de l\'adresse par cabinet')[1] ?? ''
  const bloc = /```sql\n-- Rollback \(production\)\n([\s\S]*?)\n```/.exec(section)?.[1] ?? ''

  it('un seul bloc DO exécutable, donc tout ou rien dans l’éditeur comme sous psql', () => {
    expect(bloc.trim()).toMatch(/^DO \$\$[\s\S]*\n\$\$;$/)
    expect(bloc.match(/\$\$/g)).toHaveLength(2)
  })

  it('revient aux 5 rôles de la production du 14/11/2026, après avoir vérifié qu’aucune ligne ne porte les 2 nouveaux', () => {
    const rolesProduction = trie(ROLES_EQUIPE_SYNDIC.filter((r) => r !== 'syndic_technicien' && r !== 'syndic_juriste'))
    const controle = /WHERE role NOT IN \(([^)]*)\)/.exec(bloc)
    const pose = /ADD CONSTRAINT syndic_team_members_role_check\s+CHECK \(role IN \(([^)]*)\)\)/.exec(bloc)
    expect(trie(litteraux(controle?.[1] ?? ''))).toEqual(rolesProduction)
    expect(trie(litteraux(pose?.[1] ?? ''))).toEqual(rolesProduction)
    expect(bloc.indexOf('WHERE role NOT IN')).toBeLessThan(bloc.indexOf('ALTER TABLE'))
    expect(bloc).toContain(`DROP CONSTRAINT IF EXISTS ${UNICITE_EMAIL_PAR_CABINET}`)
  })
})

describe('scénario de contrôle supabase/tests/syndic_equipe_roles_unicite.sql', () => {
  const sqlScenario = lire('supabase/tests/syndic_equipe_roles_unicite.sql')

  it('vérifie les rôles de la liste unique', () => {
    const liste = /roles_application\(role\) as \(\s*select unnest\(array\[([^\]]*)\]\)/.exec(sqlScenario)
    expect(liste).not.toBeNull()
    expect(trie(litteraux(liste![1]))).toEqual(trie(ROLES_EQUIPE_SYNDIC))
  })

  it('lecture seule : une seule requête select, aucune écriture', () => {
    const execute = sqlScenario.replace(/--[^\n]*/g, '').trim()
    expect(execute).toMatch(/^with roles_application/)
    expect(execute.match(/;/g)).toHaveLength(1)
    expect(execute).not.toMatch(/\b(insert|update|delete|truncate|alter|drop|create|grant|revoke|do)\b\s/i)
  })
})
