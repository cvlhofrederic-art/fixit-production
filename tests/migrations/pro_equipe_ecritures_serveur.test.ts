import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { join } from 'path'
import {
  historiquePolicy,
  instructionsSql,
  litteralRegex,
  migrationSansCommentaires,
  reouverturesEcriture,
  rouvreLEcriture,
  sqlSansCommentaires,
} from '../helpers/equipe-ecritures-serveur'

// Migration 20261115_pro_equipe_ecritures_serveur.sql (suite de R36, décision VF-A-02 ; modèle de T20) : les écritures
// de pro_team_members sont réservées aux routes serveur (service role). Retrait des policies d'écriture du gérant
// (mêmes noms dans le dépôt et en production) et des droits d'écriture des rôles anon et authenticated ; lecture
// inchangée. L'exécution réelle (PGlite, rôle authenticated) est dans pro_equipe_ecritures_serveur.execution.test.ts.

const FICHIER = '20261115_pro_equipe_ecritures_serveur.sql'
const TABLE = 'public.pro_team_members'

// Policies d'écriture du gérant (company_id = auth.uid()) : 048, reprises par 20260610, mêmes noms en production.
const POLICIES_ECRITURE = ['pro_team_insert', 'pro_team_update', 'pro_team_delete']
// Lecture conservée : chaque membre voit sa ligne, le gérant celles de sa société (pro_perms_select s'y appuie).
const POLICY_LECTURE = 'pro_team_select'

const present = existsSync(join(process.cwd(), 'supabase/migrations', FICHIER))
const sql = present ? migrationSansCommentaires(FICHIER) : ''
const liste = instructionsSql(sql)

/** Ce que la migration ne doit jamais faire : chaque motif cherché dans le SQL sans commentaires. */
const INTERDITS: Array<[string, RegExp]> = [
  ['créer une policy', /\bCREATE\s+POLICY\b/i],
  ['modifier une policy', /\bALTER\s+POLICY\b/i],
  ['donner un droit', /\bGRANT\b/i],
  ['insérer une ligne', /\bINSERT\s+INTO\b/i],
  ['modifier une ligne', /\bUPDATE\s+[\w."]+\s+SET\b/i],
  ['supprimer une ligne', /\bDELETE\s+FROM\b/i],
  ['vider une table', /\bTRUNCATE\s+(TABLE\s+)?(ONLY\s+)?[\w."]+\s*(,|;|\bCASCADE\b|\bRESTRICT\b)/i],
  ['créer, modifier ou supprimer une table', /\b(ALTER|DROP|CREATE)\s+TABLE\b/i],
  ['toucher un déclencheur', /\bTRIGGER\b/i],
  ['changer l’activation de la RLS', /ROW\s+LEVEL\s+SECURITY/i],
  ['toucher la policy de lecture', new RegExp(`"?${litteralRegex(POLICY_LECTURE)}"?`, 'i')],
  ['viser une autre table d’équipe', /syndic_team_members|pro_role_permissions|pro_team_audit_log/i],
]

describe(`Migration ${FICHIER}`, () => {
  it('existe', () => {
    expect(present).toBe(true)
  })

  it.each(POLICIES_ECRITURE)('retire %s (DROP POLICY IF EXISTS … ON public.pro_team_members)', (policy) => {
    const attendu = `DROP POLICY IF EXISTS "${policy}" ON ${TABLE}`
    expect(liste.map((i) => i.replace(/\s+/g, ' '))).toContain(attendu)
  })

  it.each(INTERDITS)('ne fait pas ceci : %s', (_quoi, motif) => {
    expect(sql).not.toMatch(motif)
  })

  it('retire INSERT, UPDATE, DELETE et TRUNCATE à anon et à authenticated, chacun sous garde d’existence du rôle, rien d’autre', () => {
    const revokes = liste.filter((i) => /\bREVOKE\b/i.test(i)).map((i) => i.replace(/\s+/g, ' ').replace(/^.*\bTHEN /i, ''))
    expect(revokes).toEqual([
      `REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ${TABLE} FROM anon`,
      `REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ${TABLE} FROM authenticated`,
    ])
    for (const role of ['anon', 'authenticated']) {
      expect(sql.replace(/\s+/g, ' '), role).toContain(
        `IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ${TABLE} FROM ${role};`)
    }
  })

  it('aucune instruction de données hors du bloc de contrôle', () => {
    expect(liste.filter((i) => /^(INSERT|UPDATE|DELETE|TRUNCATE|MERGE|COPY)\b/i.test(i))).toEqual([])
  })

  it('borne l’attente des verrous (DROP POLICY verrouille la table)', () => {
    expect(sql).toMatch(/set\s+local\s+lock_timeout\s*=\s*'\d+s'\s*;/i)
  })
})

describe('Base reconstruite depuis le dépôt', () => {
  it.each(POLICIES_ECRITURE)('%s : créée par 048, la dernière instruction qui la nomme est le DROP de cette migration', (policy) => {
    const historique = historiquePolicy(policy)
    expect(historique[0]).toEqual({ fichier: '048_pro_team_rbac.sql', verbe: 'CREATE' })
    expect(historique.at(-1)).toEqual({ fichier: FICHIER, verbe: 'DROP' })
  })

  it('aucune migration postérieure ne rouvre l’écriture des clients (policy, GRANT, vue du propriétaire, règle)', () => {
    expect(reouverturesEcriture('pro_team_members', FICHIER)).toEqual([])
  })
})

/** Instructions types, une par cas que le contrôle des migrations postérieures doit trancher : [cas, SQL, rouvre ?]. */
const INSTRUCTIONS_TYPES: Array<[string, string, boolean]> = [
  ['policy INSERT', 'CREATE POLICY p ON public.pro_team_members FOR INSERT WITH CHECK (true)', true],
  ['policy sans FOR (vaut FOR ALL), noms entre guillemets comme les écrit l’éditeur de Supabase',
    'create policy "p" on "public"."pro_team_members" as permissive to authenticated using (true)', true],
  ['policy de lecture', 'CREATE POLICY p ON public.pro_team_members FOR SELECT USING (true)', false],
  ['policy d’écriture d’une autre table, qui lit la table',
    'CREATE POLICY p ON public.pro_role_permissions FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.pro_team_members))', false],
  ['GRANT INSERT à authenticated', 'GRANT INSERT ON public.pro_team_members TO authenticated', true],
  ['GRANT UPDATE d’une colonne à PUBLIC, noms entre guillemets', 'GRANT UPDATE (role) ON TABLE "public"."pro_team_members" TO PUBLIC', true],
  ['GRANT ALL sur toutes les tables du schéma, à anon', 'GRANT ALL ON ALL TABLES IN SCHEMA public TO anon', true],
  ['GRANT dans un bloc conditionnel', `DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles r JOIN pg_namespace n ON true) THEN
    GRANT DELETE ON public.pro_team_members TO authenticated`, true],
  ['GRANT ALL à service_role (le schéma public du nom ne compte pas comme PUBLIC)', 'GRANT ALL ON public.pro_team_members TO service_role', false],
  ['GRANT de lecture sur toutes les tables (ALL TABLES n’est pas un privilège)', 'GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated', false],
  ['droits par défaut des tables à venir', 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT INSERT ON TABLES TO authenticated', false],
  ['vue sans security_invoker', 'CREATE VIEW public.v AS SELECT * FROM public.pro_team_members', true],
  ['vue security_invoker = false, entre apostrophes', "CREATE OR REPLACE VIEW public.v WITH (security_invoker = 'false') AS SELECT * FROM public.pro_team_members", true],
  ['vue security_invoker = off, suivie d’une autre option',
    'CREATE VIEW public.v WITH (security_invoker = off, security_barrier) AS SELECT * FROM public.pro_team_members', true],
  ['vue security_invoker (option seule, en dernier)', 'CREATE VIEW public.v WITH (security_barrier, security_invoker) AS SELECT * FROM public.pro_team_members', false],
  ['vue security_invoker = 1', 'CREATE VIEW public.v WITH (security_invoker = 1) AS SELECT * FROM public.pro_team_members', false],
  ['vue d’une autre table', 'CREATE VIEW public.v AS SELECT * FROM public.pro_role_permissions', false],
  ['vue repassée par ALTER VIEW … SET (security_invoker = false)', 'ALTER VIEW public.v SET (security_invoker = false)', true],
  ['vue repassée par ALTER TABLE … RESET (security_invoker)', 'ALTER TABLE public.v RESET (security_invoker)', true],
  ['vue confirmée par ALTER VIEW … SET (security_invoker = on)', 'ALTER VIEW public.v SET (security_invoker = on)', false],
  ['règle d’une table relais qui écrit la table',
    'CREATE RULE r AS ON INSERT TO public.relais DO INSTEAD INSERT INTO public.pro_team_members (company_id) VALUES (NEW.id)', true],
  ['règle posée sur la table', 'CREATE OR REPLACE RULE r AS ON DELETE TO public.pro_team_members DO INSTEAD NOTHING', true],
  ['règle d’une autre table', 'CREATE RULE r AS ON DELETE TO public.relais DO INSTEAD NOTHING', false],
]

describe('Contrôle des migrations postérieures : instructions types', () => {
  it.each(INSTRUCTIONS_TYPES)('%s', (_cas, instruction, rouvre) => {
    expect(rouvreLEcriture('pro_team_members', sqlSansCommentaires(instruction))).toBe(rouvre)
  })
})
