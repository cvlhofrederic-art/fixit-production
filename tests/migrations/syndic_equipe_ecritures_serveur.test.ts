import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { join } from 'path'
import {
  historiquePolicy,
  instructionsSql,
  litteralRegex,
  migrationSansCommentaires,
  migrationsDansLOrdre,
  reouverturesEcriture,
  rouvreLEcriture,
  sqlSansCommentaires,
} from '../helpers/equipe-ecritures-serveur'

// Migration 20261114_syndic_equipe_ecritures_serveur.sql (T20, DT9 élargie) : les écritures de syndic_team_members
// sont réservées aux routes serveur (service role). Retrait des policies d'écriture du titulaire, sous les noms du dépôt
// et sous ceux de la production, et des droits d'écriture des rôles anon et authenticated. Lecture inchangée.
// L'exécution réelle (PGlite, rôle authenticated) est dans syndic_equipe_ecritures_serveur.execution.test.ts. Le
// contrôle des autres migrations passe par l'outil commun aux tables d'équipe (tests/helpers/equipe-ecritures-serveur.ts),
// comme celui de pro_team_members.

const FICHIER = '20261114_syndic_equipe_ecritures_serveur.sql'
const TABLE = 'syndic_team_members'
// Création de la table dans le dépôt (CREATE TABLE IF NOT EXISTS), avec les policies du titulaire et du membre.
const CREATION = '20260527_syndic_team_members.sql'
// Borne du contrôle des autres migrations : la création de la table, et non plus le nom de T20 (voir la fenêtre lue).
const DEPUIS = CREATION
// #649 : retrait de syndic_team_members_member_update_self.
const RETRAIT_649 = '20261104_rls_policies_roles_serveur.sql'

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

/** Ordre des unités de code, avec un comparateur explicite. */
const parTexte = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

const present = existsSync(join(process.cwd(), 'supabase/migrations', FICHIER))
const sql = present ? migrationSansCommentaires(FICHIER) : ''
const liste = instructionsSql(sql)

describe(`Migration ${FICHIER}`, () => {
  it('existe', () => {
    expect(present).toBe(true)
  })

  it.each(POLICIES_ECRITURE)('retire %s (DROP POLICY IF EXISTS … ON public.syndic_team_members)', (policy) => {
    const motif = new RegExp(
      `DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+"${litteralRegex(policy)}"\\s+ON\\s+public\\.syndic_team_members\\s*;`,
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
    expect(sql).not.toMatch(new RegExp(`"?${litteralRegex(policy)}"?`, 'i'))
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
    const revokes = liste.filter((i) => /\bREVOKE\b/i.test(i))
    expect(revokes).toHaveLength(2)
    for (const r of revokes) {
      expect(r).toMatch(/REVOKE\s+INSERT\s*,\s*UPDATE\s*,\s*DELETE\s*,\s*TRUNCATE\s+ON\s+public\.syndic_team_members\s+FROM\s+(anon|authenticated)$/i)
    }
  })

  it('ne touche ni aux données, ni aux tables, ni aux déclencheurs, ni à l’activation de la RLS', () => {
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

/**
 * Ce que le contrôle partagé (rouvreLEcriture) signale dans tout le dépôt pour la table, début de chaque signalement :
 * quatre instructions antérieures à T20, toutes neutralisées. La création de la table (les droits par défaut de
 * Supabase y donnent l'écriture aux clients) l'est par le REVOKE de T20 ; chaque policy, par un DROP qui reste la
 * dernière instruction qui la nomme (RETRAITS).
 */
const SIGNALEES_DEPUIS_LE_DEBUT = [
  '041_rls_complete_audit.sql : CREATE POLICY "syndic_team_cabinet_write"',
  `${CREATION} : CREATE TABLE IF NOT EXISTS syndic_team_members`,
  `${CREATION} : CREATE POLICY "syndic_team_members_cabinet_full_access"`,
  `${CREATION} : CREATE POLICY "syndic_team_members_member_update_self"`,
]
const RETRAITS: Record<string, string> = {
  syndic_team_cabinet_write: FICHIER,
  syndic_team_members_cabinet_full_access: FICHIER,
  syndic_team_members_member_update_self: RETRAIT_649,
}

describe('Base reconstruite depuis le dépôt', () => {
  const signalees = reouverturesEcriture(TABLE, '')

  it.each(POLICIES_ECRITURE)('%s : la dernière instruction qui la nomme est le DROP de cette migration', (policy) => {
    expect(historiquePolicy(policy).at(-1)).toEqual({ fichier: FICHIER, verbe: 'DROP' })
  })

  it('depuis le début du dépôt, le contrôle signale exactement les quatre instructions historiques (041, 20260527)', () => {
    const debuts = signalees
      .map((c) => /^[\w.]+ : (?:CREATE TABLE IF NOT EXISTS syndic_team_members|CREATE POLICY "\w+")/.exec(c)?.[0] ?? c)
    expect(debuts).toEqual(SIGNALEES_DEPUIS_LE_DEBUT)
  })

  it('chaque policy signalée est retirée : la dernière instruction qui la nomme est un DROP (T20, ou #649)', () => {
    const policies = signalees.flatMap((c) => /CREATE POLICY "(\w+)"/.exec(c)?.[1] ?? [])
    expect([...policies].sort(parTexte)).toEqual(Object.keys(RETRAITS).sort(parTexte))
    for (const policy of policies) {
      expect(historiquePolicy(policy).at(-1), policy).toEqual({ fichier: RETRAITS[policy], verbe: 'DROP' })
    }
  })

  // L'ordre des noms n'est pas celui de l'application en production : le contrôle part de la création de la table
  // (DEPUIS). La fenêtre lue contient donc une migration du même jour dont le nom vient avant celui de T20, et une
  // migration antidatée, arrivée sur main (#695) le 15/11/2026, après l'application de T20 : une borne au nom de T20
  // les sautait. La liste exacte « depuis le début », plus haut, les garde aussi.
  it('aucune migration ne rouvre l’écriture des clients depuis la création de la table (policy, GRANT, vue du propriétaire, règle, table recréée, héritage…), fenêtre qui contient les migrations du même jour au nom antérieur à T20 et antidatées', () => {
    expect(reouverturesEcriture(TABLE, DEPUIS)).toEqual([])
    expect(migrationsDansLOrdre().filter((f) => f > DEPUIS)).toEqual(expect.arrayContaining([
      '20261111_marches_lecture_publique_fermee.sql', // antidatée
      '20261114_signalements_qr_logo_cabinet.sql', // même jour que T20, nom avant le sien
    ]))
  })
})

/**
 * Branchement du contrôle sur la table : quelques instructions écrites pour syndic_team_members (l'outil est éprouvé en
 * détail par pro_equipe_ecritures_serveur.test.ts). Les trois premières trompaient l'ancien contrôle de T20 : deux faux
 * positifs prudents, puis un nom de policy qui imite FOR SELECT.
 */
const BRANCHEMENT: Array<{ cas: string; rouvre: boolean; instruction: string }> = [
  { cas: 'policy d’écriture d’une autre table, qui lit la table', rouvre: false,
    instruction: 'CREATE POLICY p ON public.syndic_immeubles FOR INSERT WITH CHECK (cabinet_id IN (SELECT cabinet_id FROM public.syndic_team_members WHERE user_id = auth.uid()))' },
  { cas: 'GRANT de lecture sur toutes les tables du schéma (ALL TABLES n’est pas un privilège)', rouvre: false,
    instruction: 'GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated' },
  { cas: 'policy INSERT dont le nom entre guillemets contient « for select »', rouvre: true,
    instruction: 'CREATE POLICY "lecture for select" ON public.syndic_team_members FOR INSERT WITH CHECK (true)' },
  { cas: 'policy INSERT', rouvre: true,
    instruction: 'CREATE POLICY p ON public.syndic_team_members FOR INSERT WITH CHECK (cabinet_id = auth.uid())' },
  { cas: 'table fille (INHERITS)', rouvre: true, instruction: 'CREATE TABLE public.essai_enfant () INHERITS (public.syndic_team_members)' },
  { cas: 'clé étrangère ON DELETE CASCADE posée sur la table', rouvre: true,
    instruction: 'ALTER TABLE public.syndic_team_members ADD CONSTRAINT f FOREIGN KEY (cabinet_id) REFERENCES public.essai_cabinets (id) ON DELETE CASCADE' },
  { cas: 'table recréée', rouvre: true, instruction: 'CREATE TABLE IF NOT EXISTS syndic_team_members (id uuid PRIMARY KEY)' },
  { cas: 'rôle accordé aux clients (appartenance)', rouvre: true, instruction: 'GRANT service_role TO authenticated' },
]

describe('Contrôle des autres migrations : branchement sur syndic_team_members', () => {
  for (const { cas, rouvre, instruction } of BRANCHEMENT) {
    it(`${cas} : ${rouvre ? 'signalée' : 'admise'}`, () => {
      expect(rouvreLEcriture(TABLE, sqlSansCommentaires(instruction))).toBe(rouvre)
    })
  }
})
