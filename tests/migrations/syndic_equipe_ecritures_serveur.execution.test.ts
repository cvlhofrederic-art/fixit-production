// @vitest-environment node
// tests/migrations/syndic_equipe_ecritures_serveur.execution.test.ts
//
// EXÉCUTION RÉELLE de 20261114_syndic_equipe_ecritures_serveur.sql (T20, DT9 élargie) sur un vrai PostgreSQL (PGlite,
// WebAssembly, en mémoire ; aucun service, aucune base distante), avec le rôle authenticated et le jeton d'une session
// de navigateur (request.jwt.claims, comme PostgREST), sur les deux états de départ possibles :
//   - « production » : table, contrainte du rôle et policies telles que constatées en lecture seule le 14/11/2026, et
//     déclencheur de date relevé le 15/11/2026 ;
//   - « dépôt » : la migration 20260527 du dépôt, la section 12 de la 041, puis le retrait de member_update_self (#649).
// Scénario A23 du dossier M0 (D4) : AVANT T20, les écritures du titulaire passent (la faille est reproduite) ; APRÈS T20,
// jouée deux fois, elles sont refusées, la lecture reste, et les routes serveur (service_role) écrivent toujours.
// Comptes fictifs (UUID aléatoires) ; aucune donnée réelle.

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { randomUUID } from 'crypto'
import { readFileSync } from 'fs'
import { join } from 'path'
import { ECHAFAUDAGE_SUPABASE_SQL, erreurPg, lireMigrationQr, type ErreurPg } from '../helpers/pglite-signalements'

const T20 = '20261114_syndic_equipe_ecritures_serveur.sql'

/** Les deux requêtes du scénario que Frédéric lance dans l'éditeur SQL (supabase/tests/…) : état, puis bloc de test. */
function scenario(): { etat: string; test: string } {
  const texte = readFileSync(join(process.cwd(), 'supabase/tests/syndic_equipe_ecritures_serveur.sql'), 'utf-8').replace(/\r\n/g, '\n')
  const etat = texte.match(/-- 1\. État\n(select json_build_object[\s\S]*?\) as etat;)/)
  const test = texte.match(/-- 2\. Test\n(do \$\$[\s\S]*?\n\$\$;)/)
  if (!etat || !test) throw new Error('Scénario supabase/tests/syndic_equipe_ecritures_serveur.sql : parties 1 et 2 introuvables')
  return { etat: etat[1], test: test[1] }
}

interface FonctionCitee {
  fonction: string
  security_definer: boolean
  executable_par_les_clients: boolean
  fonction_de_declencheur: boolean
}

interface EtatTable {
  policies_ecriture: number
  rls_active: boolean
  proprietaire: string
  fonctions_citant_la_table: FonctionCitee[] | null
  fonctions_ecrivant_la_table: FonctionCitee[] | null
  vues: Array<{ vue: string; type: string; security_invoker: boolean; regle_d_ecriture: boolean }> | null
  regles_sur_la_table: number
  declencheurs: Array<{ nom: string; fonction: string; definition?: never }> | null
  droits: Array<{ role: string; select: boolean; insert: boolean; update: boolean; delete: boolean; truncate: boolean }>
}

/** Ordre des unités de code, avec un comparateur explicite. */
const parTexte = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** Fonctions d'une liste de la partie 1, en « nom security_definer executable_par_les_clients », triées. */
const resume = (liste: FonctionCitee[] | null) =>
  (liste ?? []).map((f) => `${f.fonction} ${f.security_definer} ${f.executable_par_les_clients}`).sort(parTexte)

const PREFIXE_BILAN = 'BILAN (tout est annulé) : '

// auth.uid() de Supabase : le « sub » du jeton de la requête (OR REPLACE : l'échafaudage partagé pourrait un jour la créer).
const AUTH_UID_SQL = `
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
`

// Production, constat en lecture seule du 14/11/2026 (VT-A-01) : 14 colonnes, contrainte du rôle à 5 valeurs,
// UNIQUE (invite_token), RLS active, quatre policies permissives pour le rôle public ; déclencheur de date
// trg_team_updated_at relevé le 15/11/2026 (sa fonction ne nomme pas la table).
const PRODUCTION_SQL = `
CREATE TABLE public.syndic_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id uuid NOT NULL,
  user_id uuid,
  email text,
  full_name text,
  phone text,
  role text NOT NULL DEFAULT 'syndic_gestionnaire'
    CONSTRAINT syndic_team_members_role_check
    CHECK (role IN ('syndic_admin', 'syndic_tech', 'syndic_secretaire', 'syndic_gestionnaire', 'syndic_comptable')),
  invite_token text UNIQUE,
  invite_sent_at timestamptz,
  accepted_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  custom_modules jsonb
);
CREATE FUNCTION public.update_team_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_team_updated_at BEFORE UPDATE ON public.syndic_team_members
  FOR EACH ROW EXECUTE FUNCTION public.update_team_updated_at();
ALTER TABLE public.syndic_team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY syndic_team_select ON public.syndic_team_members FOR SELECT USING (cabinet_id = auth.uid() OR user_id = auth.uid());
CREATE POLICY syndic_team_insert ON public.syndic_team_members FOR INSERT WITH CHECK (cabinet_id = auth.uid());
CREATE POLICY syndic_team_update ON public.syndic_team_members FOR UPDATE USING (cabinet_id = auth.uid());
CREATE POLICY syndic_team_delete ON public.syndic_team_members FOR DELETE USING (cabinet_id = auth.uid());
`

/** Dépôt : 20260527 telle quelle, section 12 de la 041 (lecture et écriture du cabinet), puis le DROP de #649. */
function depotSql(): string {
  const creation = lireMigrationQr('20260527_syndic_team_members.sql')
  const section041 = lireMigrationQr('041_rls_complete_audit.sql').match(/-- ── 12\. syndic_team_members[\s\S]*?(?=\n-- ── 13\.)/)
  const retrait649 = lireMigrationQr('20261104_rls_policies_roles_serveur.sql').match(
    /DROP POLICY IF EXISTS "syndic_team_members_member_update_self" ON public\.syndic_team_members;/,
  )
  if (!section041 || !retrait649) throw new Error('Section 12 de la 041 ou DROP de #649 introuvable : relire le banc')
  return `${creation}\n${section041[0]}\n${retrait649[0]}\n`
}

const ETATS = [
  {
    nom: 'production (constat du 14/11/2026)',
    sql: () => PRODUCTION_SQL,
    lecture: ['syndic_team_select'],
    ecritureAvant: 3,
    declencheurs: ['trg_team_updated_at'],
    // Sans clé étrangère en production : l'insertion pour soi passe, le scénario le signale.
    scenarioAvant: /^ÉCHEC 2 : ligne créée par une session navigateur$/,
  },
  {
    nom: 'dépôt (20260527, 041, #649)',
    sql: depotSql,
    lecture: ['syndic_team_cabinet_read', 'syndic_team_members_member_select'],
    ecritureAvant: 2,
    declencheurs: ['syndic_team_members_updated_at'],
    // Clé étrangère vers auth.users dans le dépôt : le compte fictif n'y est pas, l'insertion échoue autrement.
    scenarioAvant: /violates foreign key constraint/,
  },
]

type Role = 'anon' | 'authenticated' | 'service_role'
interface Appel { lignes: Record<string, unknown>[]; nb: number; erreur: ErreurPg | null }

describe.each(ETATS)('état de départ : $nom', ({ sql, lecture, ecritureAvant, declencheurs, scenarioAvant }) => {
  let db: PGlite
  const TITULAIRE = randomUUID() // compte du cabinet (cabinet_id)
  const MEMBRE = randomUUID() // membre accepté du cabinet
  const AUTRE = randomUUID() // compte étranger au cabinet
  const AUTRE_CABINET = randomUUID()
  let ligneMembre = ''
  let ligneInvitation = ''

  beforeAll(async () => {
    db = await PGlite.create()
    await db.exec(ECHAFAUDAGE_SUPABASE_SQL + AUTH_UID_SQL)
    await db.exec(sql())
    // Données d'exemple, posées en propriétaire de la base (comme les routes, hors RLS).
    for (const id of [TITULAIRE, MEMBRE, AUTRE, AUTRE_CABINET]) {
      await db.query('INSERT INTO auth.users (id, email) VALUES ($1, $2)', [id, `${id}@exemple.test`])
    }
    const membre = await db.query<{ id: string }>(
      `INSERT INTO public.syndic_team_members (cabinet_id, user_id, email, full_name, role, accepted_at, is_active)
       VALUES ($1, $2, 'membre@exemple.test', 'Membre Exemple', 'syndic_gestionnaire', now(), true) RETURNING id`,
      [TITULAIRE, MEMBRE],
    )
    const invitation = await db.query<{ id: string }>(
      `INSERT INTO public.syndic_team_members (cabinet_id, email, full_name, role, invite_token, invite_sent_at, is_active)
       VALUES ($1, 'invite@exemple.test', 'Invité Exemple', 'syndic_comptable', 'jeton-exemple', now(), true) RETURNING id`,
      [TITULAIRE],
    )
    ligneMembre = membre.rows[0].id
    ligneInvitation = invitation.rows[0].id
  }, 120_000)
  afterAll(async () => { await db?.close() })
  beforeEach(async () => { await db.exec('BEGIN') })
  afterEach(async () => { await db.exec('ROLLBACK') })

  /** Requête sous un rôle de l'API et un jeton, dans un point de sauvegarde : l'erreur est rendue, la transaction continue. */
  async function sous(role: Role, sub: string | null, requete: string, params: unknown[] = []): Promise<Appel> {
    await db.exec('SAVEPOINT appel')
    try {
      await db.query(`SELECT set_config('request.jwt.claims', $1, true)`, [sub ? JSON.stringify({ sub, role }) : ''])
      await db.exec(`SET LOCAL ROLE ${role}`)
      const r = await db.query<Record<string, unknown>>(requete, params)
      await db.exec('RESET ROLE')
      await db.exec('RELEASE SAVEPOINT appel')
      return { lignes: r.rows, nb: r.affectedRows ?? 0, erreur: null }
    } catch (e) {
      await db.exec('ROLLBACK TO SAVEPOINT appel')
      await db.exec('RELEASE SAVEPOINT appel')
      return { lignes: [], nb: 0, erreur: erreurPg(e) }
    }
  }

  const ligne = async (id: string) =>
    (await db.query<{ cabinet_id: string; user_id: string | null; role: string }>(
      'SELECT cabinet_id, user_id, role FROM public.syndic_team_members WHERE id = $1', [id])).rows[0]
  const nombreLignes = async () =>
    Number((await db.query<{ n: number }>('SELECT count(*)::int AS n FROM public.syndic_team_members')).rows[0].n)

  /** Partie 1 du scénario (lecture seule), telle que Frédéric la lance. */
  const etatScenario = async (): Promise<EtatTable> =>
    (await db.query<{ etat: EtatTable }>(scenario().etat)).rows[0].etat

  /** Partie 2 du scénario : message de l'erreur qui termine le bloc (« BILAN … » si tout est refusé). */
  async function bilanScenario(): Promise<string> {
    await db.exec('SAVEPOINT scenario')
    let message = 'le bloc s’est terminé sans erreur'
    try {
      await db.exec(scenario().test)
    } catch (e) {
      message = erreurPg(e).message
    }
    await db.exec('ROLLBACK TO SAVEPOINT scenario')
    await db.exec('RELEASE SAVEPOINT scenario')
    return message
  }

  // Cas d'écriture de A23 (2 à 4) et suppression : passent avant T20, refusés après.
  const inserePourSoi = () => sous('authenticated', AUTRE,
    `INSERT INTO public.syndic_team_members (cabinet_id, user_id, is_active) VALUES ($1, $1, true)`, [AUTRE])
  const inserePourUnAutre = () => sous('authenticated', TITULAIRE,
    `INSERT INTO public.syndic_team_members (cabinet_id, user_id, role, is_active) VALUES ($1, $2, 'syndic_admin', true)`,
    [TITULAIRE, AUTRE])
  const changeRoleInvitation = () => sous('authenticated', TITULAIRE,
    `UPDATE public.syndic_team_members SET role = 'syndic_admin' WHERE id = $1`, [ligneInvitation])
  const supprimeMembre = () => sous('authenticated', TITULAIRE,
    'DELETE FROM public.syndic_team_members WHERE id = $1', [ligneMembre])
  const deplaceSaLigne = () => sous('authenticated', MEMBRE,
    'UPDATE public.syndic_team_members SET cabinet_id = $1 WHERE id = $2', [AUTRE_CABINET, ligneMembre])

  describe('avant T20 : la faille est reproduite', () => {
    it('(2) un compte s’ajoute lui-même dans son propre « cabinet »', async () => {
      const r = await inserePourSoi()
      expect(r.erreur).toBeNull()
      expect(await nombreLignes()).toBe(3)
    })

    it('(3) le titulaire rattache le compte de quelqu’un d’autre à son équipe, en administrateur', async () => {
      const r = await inserePourUnAutre()
      expect(r.erreur).toBeNull()
      expect(await nombreLignes()).toBe(3)
    })

    it('(4) le titulaire change le rôle d’une invitation déjà envoyée', async () => {
      const r = await changeRoleInvitation()
      expect(r.erreur).toBeNull()
      expect((await ligne(ligneInvitation)).role).toBe('syndic_admin')
    })

    it('le titulaire supprime une ligne de son équipe hors de l’application', async () => {
      const r = await supprimeMembre()
      expect(r.erreur).toBeNull()
      expect(await ligne(ligneMembre)).toBeUndefined()
    })

    it('(1) un membre ne déplace pas sa ligne vers un autre cabinet (déjà fermé, non-régression)', async () => {
      await deplaceSaLigne()
      expect((await ligne(ligneMembre)).cabinet_id).toBe(TITULAIRE)
    })

    it('la partie 1 repère une fonction SQL qui écrirait la table, dit si elle est SECURITY DEFINER et si les clients l’exécutent', async () => {
      await db.exec(`CREATE FUNCTION public.essai_ecrit_equipe(c uuid) RETURNS void LANGUAGE sql
        AS $$ INSERT INTO public.syndic_team_members (cabinet_id) VALUES (c) $$`)
      const etat = await etatScenario()
      // Droit d'exécution par défaut (PUBLIC, et les droits par défaut du schéma) : exécutable par les clients.
      const attendu = [
        { fonction: 'essai_ecrit_equipe(uuid)', security_definer: false, executable_par_les_clients: true, fonction_de_declencheur: false },
      ]
      expect(etat.fonctions_ecrivant_la_table).toEqual(attendu)
      expect(etat.fonctions_citant_la_table).toEqual(attendu)
    })

    it('la partie 1 voit aussi une écriture par EXECUTE dynamique (seulement parmi les fonctions qui citent la table), un corps SQL standard (BEGIN ATOMIC) et MERGE sur le nom entre guillemets', async () => {
      await db.exec(`CREATE FUNCTION public.essai_ecrit_dynamique(c uuid) RETURNS void LANGUAGE plpgsql
        AS $$ BEGIN EXECUTE format('INSERT INTO public.%I (cabinet_id) VALUES ($1)', 'syndic_team_members') USING c; END $$`)
      await db.exec(`CREATE FUNCTION public.essai_ecrit_atomique(c uuid) RETURNS void LANGUAGE sql SECURITY DEFINER
        BEGIN ATOMIC INSERT INTO public.syndic_team_members (cabinet_id) VALUES (c); END`)
      await db.exec(`CREATE FUNCTION public.essai_ecrit_merge(c uuid) RETURNS void LANGUAGE plpgsql
        AS $$ BEGIN MERGE INTO "public"."syndic_team_members" t USING (SELECT c AS id) s ON t.cabinet_id = s.id
                    WHEN MATCHED THEN DELETE; END $$`)
      await db.exec(`CREATE FUNCTION public.essai_ecrit_authentifie(c uuid) RETURNS void LANGUAGE sql
        AS $$ TRUNCATE TABLE public.syndic_team_members $$`)
      // Aucun client ne l'exécute ; exécutable par anon seul, ou par authenticated seul : compte comme exécutable
      // par les clients.
      await db.exec('REVOKE EXECUTE ON FUNCTION public.essai_ecrit_atomique(uuid) FROM PUBLIC, anon, authenticated')
      await db.exec('REVOKE EXECUTE ON FUNCTION public.essai_ecrit_merge(uuid) FROM PUBLIC, authenticated')
      await db.exec('REVOKE EXECUTE ON FUNCTION public.essai_ecrit_authentifie(uuid) FROM PUBLIC, anon')
      const etat = await etatScenario()
      expect(resume(etat.fonctions_citant_la_table)).toEqual([
        'essai_ecrit_atomique(uuid) true false',
        'essai_ecrit_authentifie(uuid) false true',
        'essai_ecrit_dynamique(uuid) false true',
        'essai_ecrit_merge(uuid) false true',
      ])
      expect(resume(etat.fonctions_ecrivant_la_table)).toEqual([
        'essai_ecrit_atomique(uuid) true false',
        'essai_ecrit_authentifie(uuid) false true',
        'essai_ecrit_merge(uuid) false true',
      ])
    })

    it('le scénario de contrôle le voit : partie 1 compte les policies d’écriture, partie 2 signale la faille', async () => {
      const etat = await etatScenario()
      expect(Number(etat.policies_ecriture)).toBe(ecritureAvant)
      expect(etat.droits.find((d) => d.role === 'authenticated')).toMatchObject({ insert: true, update: true, delete: true })
      expect(etat.fonctions_ecrivant_la_table).toBeNull()
      expect(etat.fonctions_citant_la_table).toBeNull()
      expect(etat.vues).toBeNull()
      expect(Number(etat.regles_sur_la_table)).toBe(0)
      expect((etat.declencheurs ?? []).map((d) => d.nom)).toEqual(declencheurs)
      // Ni définition ni arguments (un webhook Supabase y place ses en-têtes) : le nom et la fonction appelée seulement.
      for (const d of etat.declencheurs ?? []) expect(Object.keys(d).sort(parTexte)).toEqual(['fonction', 'nom'])
      expect(etat.proprietaire).toBe('postgres')
      expect(await bilanScenario()).toMatch(scenarioAvant)
      expect(await nombreLignes()).toBe(2)
    })
  })

  describe('après T20, jouée deux fois', () => {
    let etatPremierePasse = ''

    const etat = async () => JSON.stringify((await db.query(`
      SELECT (SELECT json_agg(json_build_object('nom', policyname, 'cmd', cmd) ORDER BY policyname)
                FROM pg_policies WHERE schemaname = 'public' AND tablename = 'syndic_team_members') AS policies,
             (SELECT relacl::text FROM pg_class WHERE oid = 'public.syndic_team_members'::regclass) AS droits,
             (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.syndic_team_members'::regclass) AS rls`)).rows)

    beforeAll(async () => {
      await db.exec(lireMigrationQr(T20))
      etatPremierePasse = await etat()
      await db.exec(lireMigrationQr(T20))
    })

    it('la seconde passe ne change rien (rejouable)', async () => {
      expect(await etat()).toBe(etatPremierePasse)
    })

    it('(6) aucune policy d’écriture ne reste sur la table, quels qu’en soient les noms ; la lecture reste ; RLS active', async () => {
      const { rows } = await db.query<{ policyname: string; cmd: string }>(
        `SELECT policyname, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename = 'syndic_team_members' ORDER BY policyname`)
      expect(rows.filter((p) => p.cmd !== 'SELECT')).toEqual([])
      expect(rows.map((p) => p.policyname)).toEqual(lecture)
      const rls = await db.query<{ relrowsecurity: boolean }>(
        `SELECT relrowsecurity FROM pg_class WHERE oid = 'public.syndic_team_members'::regclass`)
      expect(rls.rows[0].relrowsecurity).toBe(true)
    })

    it('anon et authenticated n’ont plus aucun droit d’écriture ; la lecture et service_role sont intacts', async () => {
      const { rows } = await db.query<{ role: string; droit: string; accorde: boolean }>(`
        SELECT r.role, d.droit, has_table_privilege(r.role, 'public.syndic_team_members', d.droit) AS accorde
          FROM (VALUES ('anon'), ('authenticated'), ('service_role')) r(role)
         CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) d(droit)`)
      for (const { role, droit, accorde } of rows) {
        const attendu = role === 'service_role' || droit === 'SELECT'
        expect(accorde, `${role} ${droit}`).toBe(attendu)
      }
    })

    it.each([
      ['(2) un compte s’ajoute lui-même dans son propre « cabinet »', inserePourSoi],
      ['(3) le titulaire rattache le compte de quelqu’un d’autre', inserePourUnAutre],
      ['(4) le titulaire change le rôle d’une invitation', changeRoleInvitation],
      ['le titulaire supprime une ligne de son équipe', supprimeMembre],
      ['(1) un membre déplace sa ligne vers un autre cabinet', deplaceSaLigne],
    ])('%s : refusé (droit retiré, 42501), rien n’est écrit', async (_cas, ecrire) => {
      const r = await ecrire()
      expect(r.erreur?.code).toBe('42501')
      expect(await nombreLignes()).toBe(2)
      expect(await ligne(ligneMembre)).toMatchObject({ cabinet_id: TITULAIRE, user_id: MEMBRE })
      expect((await ligne(ligneInvitation)).role).toBe('syndic_comptable')
    })

    it('un visiteur sans compte (anon) ne peut rien écrire non plus', async () => {
      const r = await sous('anon', null,
        `INSERT INTO public.syndic_team_members (cabinet_id, user_id, is_active) VALUES ($1, $1, true)`, [AUTRE])
      expect(r.erreur?.code).toBe('42501')
      expect(await nombreLignes()).toBe(2)
    })

    it('(5) lecture inchangée : le membre voit sa ligne, le titulaire celles de son cabinet, un autre compte rien', async () => {
      const duMembre = await sous('authenticated', MEMBRE, 'SELECT id FROM public.syndic_team_members')
      expect(duMembre.erreur).toBeNull()
      expect(duMembre.lignes.map((l) => l.id)).toEqual([ligneMembre])
      const duTitulaire = await sous('authenticated', TITULAIRE, 'SELECT id FROM public.syndic_team_members ORDER BY id')
      expect(duTitulaire.erreur).toBeNull()
      expect(duTitulaire.lignes.map((l) => String(l.id)).sort(parTexte)).toEqual([ligneMembre, ligneInvitation].sort(parTexte))
      const dUnAutre = await sous('authenticated', AUTRE, 'SELECT id FROM public.syndic_team_members')
      expect(dUnAutre.erreur).toBeNull()
      expect(dUnAutre.lignes).toEqual([])
    })

    it('le scénario de contrôle rend l’état et le BILAN attendus (parties 1 et 2, telles que Frédéric les lance)', async () => {
      const etat = await etatScenario()
      expect(Number(etat.policies_ecriture)).toBe(0)
      expect(etat.rls_active).toBe(true)
      expect(etat.fonctions_ecrivant_la_table).toBeNull()
      expect(etat.fonctions_citant_la_table).toBeNull()
      expect(etat.vues).toBeNull()
      expect(Number(etat.regles_sur_la_table)).toBe(0)
      expect((etat.declencheurs ?? []).map((d) => d.nom)).toEqual(declencheurs)
      expect(etat.droits).toEqual([
        { role: 'anon', select: true, insert: false, update: false, delete: false, truncate: false },
        { role: 'authenticated', select: true, insert: false, update: false, delete: false, truncate: false },
        { role: 'service_role', select: true, insert: true, update: true, delete: true, truncate: true },
      ])
      const bilan = await bilanScenario()
      expect(bilan.startsWith(PREFIXE_BILAN)).toBe(true)
      const parties = bilan.slice(PREFIXE_BILAN.length).split(' | ')
      expect(parties.map((p) => p.split(' : ')[0])).toEqual(['2 ok', '3 ok', '4 ok', 'suppression ok', '1 ok', '5 ok'])
      for (const p of parties.slice(0, 5)) expect(p).toMatch(/ : permission denied for table syndic_team_members$/)
      expect(parties[5]).toBe('5 ok : lecture acceptée, 0 ligne')
      expect(await nombreLignes()).toBe(2)
    })

    it('une vue posée à la main sur la table rouvrirait l’écriture : la partie 1 la montre (d’où « vues » attendu à null)', async () => {
      await db.exec('CREATE VIEW public.essai_vue_equipe AS SELECT * FROM public.syndic_team_members')
      const parLaVue = await sous('authenticated', TITULAIRE,
        `INSERT INTO public.essai_vue_equipe (cabinet_id, user_id, role, is_active) VALUES ($1, $2, 'syndic_admin', true)`,
        [TITULAIRE, AUTRE])
      expect(parLaVue.erreur).toBeNull()
      expect(await nombreLignes()).toBe(3)
      expect((await etatScenario()).vues).toEqual([
        { vue: 'essai_vue_equipe', type: 'v', security_invoker: false, regle_d_ecriture: false },
      ])
    })

    it('security_invoker est lu à sa valeur : une vue à 1 le rend vrai (un client n’écrit toujours pas par elle, 42501), une vue à off le rend faux', async () => {
      // PostgreSQL garde l'option telle qu'elle est écrite (security_invoker=1) : seule sa conversion en booléen la lit.
      await db.exec('CREATE VIEW public.essai_vue_invoker WITH (security_invoker = 1) AS SELECT * FROM public.syndic_team_members')
      await db.exec('CREATE VIEW public.essai_vue_fausse WITH (security_invoker = off) AS SELECT * FROM public.syndic_team_members')
      const parLaVue = await sous('authenticated', TITULAIRE,
        `INSERT INTO public.essai_vue_invoker (cabinet_id, user_id, role, is_active) VALUES ($1, $2, 'syndic_admin', true)`,
        [TITULAIRE, AUTRE])
      expect(parLaVue.erreur?.code).toBe('42501')
      expect(await nombreLignes()).toBe(2)
      expect((await etatScenario()).vues).toEqual([
        { vue: 'essai_vue_fausse', type: 'v', security_invoker: false, regle_d_ecriture: false },
        { vue: 'essai_vue_invoker', type: 'v', security_invoker: true, regle_d_ecriture: false },
      ])
    })

    it('une règle d’écriture posée ailleurs (table relais, ou vue même security_invoker) rouvrirait l’écriture : la partie 1 les montre', async () => {
      // Les actions d'une règle s'exécutent avec les droits du propriétaire de la table ou de la vue qui la porte.
      const insertion = `INSERT INTO public.syndic_team_members (cabinet_id, user_id, role, is_active)
        VALUES (NEW.cabinet_id, NEW.user_id, 'syndic_admin', true)`
      await db.exec('CREATE TABLE public.essai_relais (cabinet_id uuid, user_id uuid)')
      await db.exec(`CREATE RULE essai_relais_ecrit AS ON INSERT TO public.essai_relais DO INSTEAD ${insertion}`)
      await db.exec(`CREATE VIEW public.essai_vue_relais WITH (security_invoker = true)
        AS SELECT cabinet_id, user_id FROM public.essai_relais`)
      await db.exec(`CREATE RULE essai_vue_relais_ecrit AS ON INSERT TO public.essai_vue_relais DO INSTEAD ${insertion}`)
      const parLaTable = await sous('authenticated', TITULAIRE,
        'INSERT INTO public.essai_relais (cabinet_id, user_id) VALUES ($1, $2)', [TITULAIRE, AUTRE])
      expect(parLaTable.erreur).toBeNull()
      const parLaVue = await sous('authenticated', AUTRE_CABINET,
        'INSERT INTO public.essai_vue_relais (cabinet_id, user_id) VALUES ($1, $2)', [AUTRE_CABINET, AUTRE])
      expect(parLaVue.erreur).toBeNull()
      expect(await nombreLignes()).toBe(4)
      // Une règle ON UPDATE suffit aussi : elle change le rôle d'une invitation, que l'UPDATE direct ne peut plus toucher.
      await db.exec('CREATE TABLE public.essai_relais_maj (id uuid)')
      await db.query('INSERT INTO public.essai_relais_maj (id) VALUES ($1)', [ligneInvitation])
      await db.exec(`CREATE RULE essai_relais_maj_ecrit AS ON UPDATE TO public.essai_relais_maj DO ALSO
        UPDATE public.syndic_team_members SET role = 'syndic_admin' WHERE id = OLD.id`)
      const parLaMaj = await sous('authenticated', TITULAIRE, 'UPDATE public.essai_relais_maj SET id = id')
      expect(parLaMaj.erreur).toBeNull()
      expect((await ligne(ligneInvitation)).role).toBe('syndic_admin')
      expect((await etatScenario()).vues).toEqual([
        { vue: 'essai_relais', type: 'r', security_invoker: false, regle_d_ecriture: true },
        { vue: 'essai_relais_maj', type: 'r', security_invoker: false, regle_d_ecriture: true },
        { vue: 'essai_vue_relais', type: 'v', security_invoker: true, regle_d_ecriture: true },
      ])
    })

    it('un déclencheur SECURITY DEFINER que les clients n’exécutent pas écrit quand même la table : la partie 1 le montre', async () => {
      await db.exec('CREATE TABLE public.essai_source (cabinet_id uuid, user_id uuid)')
      await db.exec(`CREATE FUNCTION public.essai_declencheur_ecrit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
        BEGIN
          INSERT INTO public.syndic_team_members (cabinet_id, user_id, role, is_active)
            VALUES (NEW.cabinet_id, NEW.user_id, 'syndic_admin', true);
          RETURN NEW;
        END $$`)
      await db.exec('REVOKE EXECUTE ON FUNCTION public.essai_declencheur_ecrit() FROM PUBLIC, anon, authenticated')
      await db.exec(`CREATE TRIGGER essai_declencheur AFTER INSERT ON public.essai_source
        FOR EACH ROW EXECUTE FUNCTION public.essai_declencheur_ecrit()`)
      // Le droit EXECUTE d'une fonction de déclencheur n'est pas vérifié quand le déclencheur part.
      const r = await sous('authenticated', TITULAIRE,
        'INSERT INTO public.essai_source (cabinet_id, user_id) VALUES ($1, $2)', [TITULAIRE, AUTRE])
      expect(r.erreur).toBeNull()
      expect(await nombreLignes()).toBe(3)
      const etat = await etatScenario()
      const attendu = [
        { fonction: 'essai_declencheur_ecrit()', security_definer: true, executable_par_les_clients: false, fonction_de_declencheur: true },
      ]
      expect(etat.fonctions_ecrivant_la_table).toEqual(attendu)
      expect(etat.fonctions_citant_la_table).toEqual(attendu)
    })

    it('une règle posée sur la table elle-même : la partie 1 la compte (d’où « regles_sur_la_table » attendu à 0)', async () => {
      await db.exec('CREATE RULE essai_regle_equipe AS ON DELETE TO public.syndic_team_members DO INSTEAD NOTHING')
      const etat = await etatScenario()
      expect(Number(etat.regles_sur_la_table)).toBe(1)
      expect(etat.vues).toBeNull()
    })

    it('rejouée par un rôle non propriétaire alors qu’un droit d’écriture a été rendu : erreur visible, rien n’est appliqué', async () => {
      // Un droit rendu à la main, puis la migration relancée par un rôle qui ne possède pas la table : les DROP IF EXISTS
      // ne trouvent rien, le REVOKE ne retire rien (simple avertissement) ; le contrôle final doit lever une erreur.
      await db.exec('GRANT INSERT ON public.syndic_team_members TO authenticated')
      await db.exec(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'executant_non_proprietaire') THEN
          CREATE ROLE executant_non_proprietaire NOLOGIN;
        END IF;
      END $$`)
      await db.exec('GRANT USAGE ON SCHEMA public TO executant_non_proprietaire')
      // Un droit de lecture suffit pour que REVOKE ne lève pas d'erreur (simple avertissement « aucun droit retiré ») :
      // c'est le cas silencieux que le contrôle final doit rendre visible. Sans aucun droit, REVOKE échoue déjà (42501).
      await db.exec('GRANT SELECT ON public.syndic_team_members TO executant_non_proprietaire')
      await db.exec('SAVEPOINT relance')
      let message = 'aucune erreur'
      try {
        await db.exec('SET LOCAL ROLE executant_non_proprietaire')
        await db.exec(lireMigrationQr(T20))
      } catch (e) {
        message = erreurPg(e).message
      }
      await db.exec('ROLLBACK TO SAVEPOINT relance')
      await db.exec('RELEASE SAVEPOINT relance')
      expect(message).toMatch(/^T20 : un droit d'écriture reste à anon ou authenticated sur syndic_team_members/)
    })

    it('les routes serveur (service_role) invitent, modifient et suppriment toujours', async () => {
      const invite = await sous('service_role', null,
        `INSERT INTO public.syndic_team_members (cabinet_id, email, role, invite_token, invite_sent_at, is_active)
         VALUES ($1, 'nouvel@exemple.test', 'syndic_secretaire', 'jeton-exemple-2', now(), true) RETURNING id`, [TITULAIRE])
      expect(invite.erreur).toBeNull()
      const id = String(invite.lignes[0].id)
      const accepte = await sous('service_role', null,
        `UPDATE public.syndic_team_members SET user_id = $1, accepted_at = now(), invite_token = NULL WHERE id = $2`, [AUTRE, id])
      expect(accepte.erreur).toBeNull()
      expect(accepte.nb).toBe(1)
      const retire = await sous('service_role', null, 'DELETE FROM public.syndic_team_members WHERE id = $1', [id])
      expect(retire.erreur).toBeNull()
      expect(retire.nb).toBe(1)
    })
  })
})

describe('base sans la table syndic_team_members (rôles présents)', () => {
  it('T20 passe sans erreur, deux fois, et ne crée rien (REVOKE seul y échouerait en 42P01)', async () => {
    const db = await PGlite.create()
    try {
      await db.exec(ECHAFAUDAGE_SUPABASE_SQL)
      await db.exec(lireMigrationQr(T20))
      await db.exec(lireMigrationQr(T20))
      const { rows } = await db.query<{ absente: boolean }>(`SELECT to_regclass('public.syndic_team_members') IS NULL AS absente`)
      expect(rows[0].absente).toBe(true)
    } finally {
      await db.close()
    }
  }, 60_000)
})
