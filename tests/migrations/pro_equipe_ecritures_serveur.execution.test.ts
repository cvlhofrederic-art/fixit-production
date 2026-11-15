// @vitest-environment node
// tests/migrations/pro_equipe_ecritures_serveur.execution.test.ts
//
// EXÉCUTION RÉELLE de 20261115_pro_equipe_ecritures_serveur.sql (suite de R36, décision VF-A-02 ; modèle de T20) sur
// un vrai PostgreSQL (PGlite, WebAssembly, en mémoire ; aucun service, aucune base distante), avec le rôle
// authenticated et le jeton d'une session de navigateur (request.jwt.claims, comme PostgREST), sur les deux états de
// départ possibles :
//   - « production » : table, contraintes et policies telles que constatées en lecture seule le 14/11/2026 ;
//   - « dépôt » : la migration 048 telle quelle (avec pro_role_permissions, dont la lecture s'appuie sur
//     pro_team_members), puis les ALTER POLICY de 20260610 sur les policies de pro_team_members.
// AVANT la migration, les écritures du gérant passent (la faille est reproduite) ; APRÈS, jouée deux fois, elles sont
// refusées, la lecture reste, et les routes serveur (service_role) écrivent toujours.
// Comptes fictifs (UUID aléatoires) ; aucune donnée réelle.

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { randomUUID } from 'crypto'
import { ECHAFAUDAGE_SUPABASE_SQL, lireMigrationQr } from '../helpers/pglite-signalements'
import {
  bilanDuScenario,
  dansPointDeSauvegarde,
  droitsEffectifs,
  droitsServeurSeul,
  etatDuScenario,
  partiesDuScenario,
  sousRole,
  type ResultatAppel,
} from '../helpers/equipe-ecritures-serveur'

const MIGRATION = '20261115_pro_equipe_ecritures_serveur.sql'
const TABLE = 'public.pro_team_members'
const SCENARIO = partiesDuScenario('supabase/tests/pro_equipe_ecritures_serveur.sql')

interface FonctionCitee { fonction: string; security_definer: boolean; executable_par_les_clients: boolean }
interface EtatTable {
  policies_ecriture: number
  rls_active: boolean
  proprietaire: string
  fonctions_citant_la_table: FonctionCitee[] | null
  fonctions_ecrivant_la_table: FonctionCitee[] | null
  vues: Array<{ vue: string; type: string; security_invoker: boolean }> | null
  regles_sur_la_table: number
  declencheurs: Array<{ nom: string; fonction: string }> | null
  droits: Array<{ role: string; select: boolean; insert: boolean; update: boolean; delete: boolean; truncate: boolean }>
}

const parTexte = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
const PREFIXE_BILAN = 'BILAN (tout est annulé) : '

// auth.uid() de Supabase : le « sub » du jeton de la requête (OR REPLACE : l'échafaudage partagé pourrait un jour la créer).
const AUTH_UID_SQL = `
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
`

// Production, constats en lecture seule du 14/11/2026 (VT-A-01) et du 15/11/2026 (partie 1 du scénario) : 15 colonnes,
// contrainte du rôle à 6 valeurs, UNIQUE (company_id, email), UNIQUE (invite_token), RLS active, quatre policies
// permissives pour le rôle public sous la forme (SELECT auth.uid()), le déclencheur trg_pro_team_updated_at, et
// next_doc_number(uuid,text,integer), SECURITY DEFINER, seule fonction qui cite la table (corps réduit ici à sa lecture
// de la table : contrôle des membres d'équipe).
const PRODUCTION_SQL = `
CREATE TABLE public.pro_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  phone text DEFAULT '',
  role text NOT NULL
    CONSTRAINT pro_team_members_role_check
    CHECK (role IN ('GERANT', 'CONDUCTEUR_TRAVAUX', 'CHEF_CHANTIER', 'SECRETAIRE', 'COMPTABLE', 'OUVRIER')),
  assigned_chantiers uuid[] DEFAULT '{}',
  invite_token text UNIQUE,
  invite_sent_at timestamptz,
  accepted_at timestamptz,
  last_login_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, email)
);
ALTER TABLE public.pro_team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY pro_team_select ON public.pro_team_members FOR SELECT
  USING ((company_id = (SELECT auth.uid())) OR (user_id = (SELECT auth.uid())));
CREATE POLICY pro_team_insert ON public.pro_team_members FOR INSERT WITH CHECK ((company_id = (SELECT auth.uid())));
CREATE POLICY pro_team_update ON public.pro_team_members FOR UPDATE USING ((company_id = (SELECT auth.uid())));
CREATE POLICY pro_team_delete ON public.pro_team_members FOR DELETE USING ((company_id = (SELECT auth.uid())));
CREATE FUNCTION public.update_pro_team_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_pro_team_updated_at BEFORE UPDATE ON public.pro_team_members
  FOR EACH ROW EXECUTE FUNCTION public.update_pro_team_updated_at();
CREATE FUNCTION public.next_doc_number(p_artisan_id uuid, p_doc_type text, p_annee integer) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_artisan_id <> auth.uid() AND NOT EXISTS (
    SELECT 1 FROM pro_team_members WHERE user_id = auth.uid() AND company_id = p_artisan_id AND is_active
  ) THEN
    RAISE EXCEPTION 'non autorisé' USING ERRCODE = '42501';
  END IF;
  RETURN p_doc_type || '-' || p_annee || '-001';
END;
$$;
`

/** next_doc_number tel que la partie 1 le rend en production (SECURITY DEFINER, exécutable par les clients). */
const NEXT_DOC_NUMBER = 'next_doc_number(uuid,text,integer) true true'

/** Dépôt : 048 telle quelle, puis les quatre ALTER POLICY de 20260610 sur pro_team_members. */
function depotSql(): string {
  const alters = lireMigrationQr('20260610_rls_initplan_wrap.sql')
    .match(/^ALTER POLICY "pro_team_(?:select|insert|update|delete)" ON public\.pro_team_members [^\n]*;$/gm)
  if (alters?.length !== 4) throw new Error('ALTER POLICY de 20260610 sur pro_team_members introuvables : relire le banc')
  return `${lireMigrationQr('048_pro_team_rbac.sql')}\n${alters.join('\n')}\n`
}

const ETATS = [
  { nom: 'production (constats des 14 et 15/11/2026)', sql: () => PRODUCTION_SQL, depot: false, fonctionsCitantes: [NEXT_DOC_NUMBER] },
  { nom: 'dépôt (048, 20260610)', sql: depotSql, depot: true, fonctionsCitantes: [] as string[] },
]
const DECLENCHEURS = ['trg_pro_team_updated_at']

/** Fonctions d'une liste de la partie 1, en « nom security_definer executable_par_les_clients », triées. */
const resume = (liste: FonctionCitee[] | null) =>
  (liste ?? []).map((f) => `${f.fonction} ${f.security_definer} ${f.executable_par_les_clients}`).sort(parTexte)

describe.each(ETATS)('état de départ : $nom', ({ sql, depot, fonctionsCitantes }) => {
  let db: PGlite
  const comptes = { gerant: randomUUID(), membre: randomUUID(), etranger: randomUUID(), autreSociete: randomUUID() }
  const lignes = { gerant: '', membre: '', invitation: '' }

  beforeAll(async () => {
    db = await PGlite.create()
    await db.exec(ECHAFAUDAGE_SUPABASE_SQL + AUTH_UID_SQL)
    await db.exec(sql())
    // Lignes d'exemple, posées en propriétaire de la base (comme les routes, hors RLS) : le gérant, un sous-compte
    // accepté et une invitation en cours de sa société.
    const poser = async (userId: string | null, email: string, role: string, jeton: string | null) => (await db.query<{ id: string }>(
      `INSERT INTO ${TABLE} (company_id, user_id, email, full_name, role, invite_token, invite_sent_at, accepted_at)
       VALUES ($1, $2, $3, 'Exemple', $4, $5, CASE WHEN $5::text IS NULL THEN NULL ELSE now() END,
               CASE WHEN $2::uuid IS NULL THEN NULL ELSE now() END)
       RETURNING id`, [comptes.gerant, userId, email, role, jeton])).rows[0].id
    lignes.gerant = await poser(comptes.gerant, 'gerant@exemple.test', 'GERANT', null)
    lignes.membre = await poser(comptes.membre, 'membre@exemple.test', 'OUVRIER', null)
    lignes.invitation = await poser(null, 'invite@exemple.test', 'CHEF_CHANTIER', 'jeton-exemple')
    if (depot) {
      await db.query(`INSERT INTO public.pro_role_permissions (company_id, member_id, module_id, access_level)
                      VALUES ($1, $2, 'planning', 'READ')`, [comptes.gerant, lignes.membre])
    }
  }, 120_000)
  afterAll(async () => { await db?.close() })
  beforeEach(async () => { await db.exec('BEGIN') })
  afterEach(async () => { await db.exec('ROLLBACK') })

  const nombreDeLignes = async () => Number((await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${TABLE}`)).rows[0].n)
  const lireLigne = async (id: string) => (await db.query<{ company_id: string; user_id: string | null; role: string }>(
    `SELECT company_id, user_id, role FROM ${TABLE} WHERE id = $1`, [id])).rows[0]
  const etat = () => etatDuScenario<EtatTable>(db, SCENARIO.etat)

  /** Écritures d'une session de navigateur : chacune passe avant la migration, toutes échouent après (42501). */
  const ECRITURES: Array<{ cas: string; ecrire: () => Promise<ResultatAppel>; avant: () => Promise<void> }> = [
    {
      cas: '(2) un compte s’ajoute lui-même, en GERANT, dans sa propre « société »',
      ecrire: () => sousRole(db, 'authenticated', comptes.etranger,
        `INSERT INTO ${TABLE} (company_id, user_id, email, role) VALUES ($1, $1, 'soi@exemple.test', 'GERANT')`, [comptes.etranger]),
      avant: async () => { expect(await nombreDeLignes()).toBe(4) },
    },
    {
      cas: '(3) le gérant rattache le compte de quelqu’un d’autre à sa société',
      ecrire: () => sousRole(db, 'authenticated', comptes.gerant,
        `INSERT INTO ${TABLE} (company_id, user_id, email, role) VALUES ($1, $2, 'autre@exemple.test', 'OUVRIER')`,
        [comptes.gerant, comptes.etranger]),
      avant: async () => { expect(await nombreDeLignes()).toBe(4) },
    },
    {
      cas: '(4) le gérant change le rôle d’une invitation déjà envoyée, jusqu’à GERANT',
      ecrire: () => sousRole(db, 'authenticated', comptes.gerant, `UPDATE ${TABLE} SET role = 'GERANT' WHERE id = $1`, [lignes.invitation]),
      avant: async () => { expect((await lireLigne(lignes.invitation)).role).toBe('GERANT') },
    },
    {
      cas: 'le gérant supprime une ligne de son équipe hors de l’application',
      ecrire: () => sousRole(db, 'authenticated', comptes.gerant, `DELETE FROM ${TABLE} WHERE id = $1`, [lignes.membre]),
      avant: async () => { expect(await lireLigne(lignes.membre)).toBeUndefined() },
    },
  ]

  /** (1) Un membre déplace sa ligne : déjà refusé avant (policy du gérant), par le droit retiré après. */
  const deplacerSaLigne = () => sousRole(db, 'authenticated', comptes.membre,
    `UPDATE ${TABLE} SET company_id = $1 WHERE id = $2`, [comptes.autreSociete, lignes.membre])

  /** Rien n'a bougé : trois lignes, le membre dans sa société, l'invitation avec son rôle. */
  const rienNAChange = async () => {
    expect(await nombreDeLignes()).toBe(3)
    expect(await lireLigne(lignes.membre)).toMatchObject({ company_id: comptes.gerant, user_id: comptes.membre })
    expect((await lireLigne(lignes.invitation)).role).toBe('CHEF_CHANTIER')
  }

  describe('avant la migration : la faille est reproduite', () => {
    it.each(ECRITURES)('$cas : accepté', async ({ ecrire, avant }) => {
      expect((await ecrire()).erreur).toBeNull()
      await avant()
    })

    it('(1) un membre ne déplace pas sa ligne vers une autre société (non-régression)', async () => {
      await deplacerSaLigne()
      expect((await lireLigne(lignes.membre)).company_id).toBe(comptes.gerant)
    })

    it('le scénario de contrôle le voit : partie 1 compte les policies d’écriture, partie 2 signale la faille', async () => {
      const e = await etat()
      expect(Number(e.policies_ecriture)).toBe(3)
      expect(e.droits.find((d) => d.role === 'authenticated')).toMatchObject({ insert: true, update: true, delete: true })
      expect([e.fonctions_ecrivant_la_table, e.vues]).toEqual([null, null])
      expect(resume(e.fonctions_citant_la_table)).toEqual(fonctionsCitantes)
      expect(Number(e.regles_sur_la_table)).toBe(0)
      expect((e.declencheurs ?? []).map((d) => d.nom)).toEqual(DECLENCHEURS)
      // Ni définition ni arguments (un webhook Supabase y place ses en-têtes) : le nom et la fonction appelée seulement.
      for (const d of e.declencheurs ?? []) expect(Object.keys(d).sort(parTexte)).toEqual(['fonction', 'nom'])
      expect(e.proprietaire).toBe('postgres')
      // Aucune clé étrangère vers les comptes (production comme dépôt) : l'insertion pour soi passe.
      expect(await bilanDuScenario(db, SCENARIO.test)).toBe('ÉCHEC 2 : ligne créée par une session navigateur')
      expect(await nombreDeLignes()).toBe(3)
    })

    it('la partie 1 repère les fonctions qui écrivent la table (MERGE et schéma entre guillemets compris ; EXECUTE dynamique parmi celles qui la citent)', async () => {
      await db.exec(`CREATE FUNCTION public.essai_ecrit_sql(c uuid) RETURNS void LANGUAGE sql
        AS $$ INSERT INTO public.pro_team_members (company_id, email, role) VALUES (c, 'x@exemple.test', 'OUVRIER') $$`)
      await db.exec(`CREATE FUNCTION public.essai_ecrit_dynamique(c uuid) RETURNS void LANGUAGE plpgsql
        AS $$ BEGIN EXECUTE format('DELETE FROM public.%I WHERE company_id = $1', 'pro_team_members') USING c; END $$`)
      await db.exec(`CREATE FUNCTION public.essai_ecrit_atomique(c uuid) RETURNS void LANGUAGE sql SECURITY DEFINER
        BEGIN ATOMIC DELETE FROM public.pro_team_members WHERE company_id = c; END`)
      await db.exec(`CREATE FUNCTION public.essai_ecrit_merge(c uuid) RETURNS void LANGUAGE plpgsql
        AS $$ BEGIN MERGE INTO "public"."pro_team_members" t USING (SELECT c AS id) s ON t.company_id = s.id
                    WHEN MATCHED THEN DELETE; END $$`)
      // Exécutable par anon seulement : compte comme exécutable par les clients.
      await db.exec('REVOKE EXECUTE ON FUNCTION public.essai_ecrit_atomique(uuid) FROM PUBLIC, anon, authenticated')
      await db.exec('REVOKE EXECUTE ON FUNCTION public.essai_ecrit_merge(uuid) FROM PUBLIC, authenticated')
      const e = await etat()
      expect(resume(e.fonctions_citant_la_table)).toEqual([
        ...fonctionsCitantes,
        'essai_ecrit_atomique(uuid) true false',
        'essai_ecrit_dynamique(uuid) false true',
        'essai_ecrit_merge(uuid) false true',
        'essai_ecrit_sql(uuid) false true',
      ].sort(parTexte))
      expect(resume(e.fonctions_ecrivant_la_table)).toEqual([
        'essai_ecrit_atomique(uuid) true false',
        'essai_ecrit_merge(uuid) false true',
        'essai_ecrit_sql(uuid) false true',
      ])
    })
  })

  describe('après la migration, jouée deux fois', () => {
    let empreintePremierePasse = ''
    const empreinte = async () => JSON.stringify((await db.query(`
      SELECT (SELECT json_agg(json_build_object('nom', policyname, 'cmd', cmd) ORDER BY policyname)
                FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pro_team_members') AS policies,
             (SELECT relacl::text FROM pg_class WHERE oid = '${TABLE}'::regclass) AS droits,
             (SELECT relrowsecurity FROM pg_class WHERE oid = '${TABLE}'::regclass) AS rls`)).rows)

    beforeAll(async () => {
      await db.exec(lireMigrationQr(MIGRATION))
      empreintePremierePasse = await empreinte()
      await db.exec(lireMigrationQr(MIGRATION))
    })

    it('la seconde passe ne change rien (rejouable)', async () => {
      expect(await empreinte()).toBe(empreintePremierePasse)
    })

    it('seule pro_team_select reste, RLS active ; lecture pour tous, écriture pour service_role seul', async () => {
      const { rows } = await db.query<{ policyname: string; cmd: string }>(
        `SELECT policyname, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pro_team_members'`)
      expect(rows).toEqual([{ policyname: 'pro_team_select', cmd: 'SELECT' }])
      expect((await etat()).rls_active).toBe(true)
      expect(await droitsEffectifs(db, TABLE)).toEqual(droitsServeurSeul())
    })

    it.each(ECRITURES)('$cas : refusé (droit retiré, 42501), rien n’est écrit', async ({ ecrire }) => {
      expect((await ecrire()).erreur?.code).toBe('42501')
      await rienNAChange()
    })

    it('(1) un membre déplace sa ligne : refusé (42501) ; un visiteur sans compte (anon) n’écrit rien non plus', async () => {
      expect((await deplacerSaLigne()).erreur?.code).toBe('42501')
      const anon = await sousRole(db, 'anon', null,
        `INSERT INTO ${TABLE} (company_id, user_id, email, role) VALUES ($1, $1, 'anon@exemple.test', 'OUVRIER')`, [comptes.etranger])
      expect(anon.erreur?.code).toBe('42501')
      await rienNAChange()
    })

    it('lecture inchangée : le membre voit sa ligne, le gérant celles de sa société, un compte étranger rien', async () => {
      const ids = async (sub: string) => (await sousRole(db, 'authenticated', sub, `SELECT id FROM ${TABLE}`)).lignes.map((l) => String(l.id)).sort(parTexte)
      expect(await ids(comptes.membre)).toEqual([lignes.membre])
      expect(await ids(comptes.gerant)).toEqual([lignes.gerant, lignes.membre, lignes.invitation].sort(parTexte))
      expect(await ids(comptes.etranger)).toEqual([])
    })

    it.runIf(!depot)('next_doc_number (SECURITY DEFINER, lit la table) : un membre obtient toujours son numéro, un compte étranger 42501', async () => {
      const numero = (sub: string) => sousRole(db, 'authenticated', sub, `SELECT public.next_doc_number($1, 'DEV', 2026) AS n`, [comptes.gerant])
      const duMembre = await numero(comptes.membre)
      expect([duMembre.erreur, duMembre.lignes[0]?.n]).toEqual([null, 'DEV-2026-001'])
      expect((await numero(comptes.etranger)).erreur?.code).toBe('42501')
    })

    it.runIf(depot)('pro_role_permissions : le membre lit toujours ses droits (sa policy de lecture s’appuie sur pro_team_members)', async () => {
      const r = await sousRole(db, 'authenticated', comptes.membre, 'SELECT module_id, access_level FROM public.pro_role_permissions')
      expect(r.erreur).toBeNull()
      expect(r.lignes).toEqual([{ module_id: 'planning', access_level: 'READ' }])
    })

    it('le scénario de contrôle rend l’état et le BILAN attendus (parties 1 et 2, telles que Frédéric les lance)', async () => {
      const e = await etat()
      expect(Number(e.policies_ecriture)).toBe(0)
      expect([e.fonctions_ecrivant_la_table, e.vues]).toEqual([null, null])
      expect(resume(e.fonctions_citant_la_table)).toEqual(fonctionsCitantes)
      expect((e.declencheurs ?? []).map((d) => d.nom)).toEqual(DECLENCHEURS)
      expect(e.droits).toEqual([
        { role: 'anon', select: true, insert: false, update: false, delete: false, truncate: false },
        { role: 'authenticated', select: true, insert: false, update: false, delete: false, truncate: false },
        { role: 'service_role', select: true, insert: true, update: true, delete: true, truncate: true },
      ])
      const bilan = await bilanDuScenario(db, SCENARIO.test)
      expect(bilan.startsWith(PREFIXE_BILAN)).toBe(true)
      const parties = bilan.slice(PREFIXE_BILAN.length).split(' | ')
      expect(parties.map((p) => p.split(' : ')[0])).toEqual(['2 ok', '3 ok', '4 ok', 'suppression ok', '1 ok', '5 ok'])
      for (const p of parties.slice(0, 5)) expect(p).toMatch(/ : permission denied for table pro_team_members$/)
      expect(parties[5]).toBe('5 ok : lecture acceptée, 0 ligne')
      await rienNAChange()
    })

    it('une vue posée à la main sur la table rouvrirait l’écriture : la partie 1 la montre (d’où « vues » attendu à null)', async () => {
      await db.exec(`CREATE VIEW public.essai_vue_equipe AS SELECT * FROM ${TABLE}`)
      const parLaVue = await sousRole(db, 'authenticated', comptes.gerant,
        `INSERT INTO public.essai_vue_equipe (company_id, user_id, email, role) VALUES ($1, $2, 'vue@exemple.test', 'OUVRIER')`,
        [comptes.gerant, comptes.etranger])
      expect(parLaVue.erreur).toBeNull()
      expect((await etat()).vues).toEqual([{ vue: 'essai_vue_equipe', type: 'v', security_invoker: false }])
    })

    it('rejouée par un rôle non propriétaire alors qu’un droit d’écriture a été rendu : erreur visible, rien n’est appliqué', async () => {
      // Un droit rendu à la main, puis la migration relancée par un rôle qui ne possède pas la table : les DROP IF EXISTS
      // ne trouvent rien, le REVOKE ne retire rien (simple avertissement) ; le contrôle final doit lever une erreur.
      await db.exec(`GRANT INSERT ON ${TABLE} TO authenticated`)
      await db.exec(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'executant_non_proprietaire') THEN
          CREATE ROLE executant_non_proprietaire NOLOGIN;
        END IF;
      END $$`)
      // Un droit de lecture suffit pour que REVOKE ne lève pas d'erreur (simple avertissement « aucun droit retiré ») :
      // c'est le cas silencieux que le contrôle final doit rendre visible. Sans aucun droit, REVOKE échoue déjà (42501).
      await db.exec(`GRANT USAGE ON SCHEMA public TO executant_non_proprietaire; GRANT SELECT ON ${TABLE} TO executant_non_proprietaire`)
      const relance = await dansPointDeSauvegarde(db, async () => {
        await db.exec('SET LOCAL ROLE executant_non_proprietaire')
        await db.exec(lireMigrationQr(MIGRATION))
      }, false)
      expect(relance.erreur?.message).toMatch(/^Équipe BTP : un droit d'écriture reste à anon ou authenticated sur pro_team_members/)
    })

    it('les routes serveur (service_role) invitent, acceptent, modifient et suppriment toujours', async () => {
      const etapes: Array<[string, unknown[]]> = [
        [`UPDATE ${TABLE} SET user_id = $1, accepted_at = now(), invite_token = NULL WHERE id = $2`, [comptes.etranger, lignes.invitation]],
        [`UPDATE ${TABLE} SET role = 'COMPTABLE', is_active = false WHERE id = $1`, [lignes.invitation]],
        [`DELETE FROM ${TABLE} WHERE id = $1`, [lignes.invitation]],
      ]
      const invite = await sousRole(db, 'service_role', null,
        `INSERT INTO ${TABLE} (company_id, email, role, invite_token, invite_sent_at) VALUES ($1, 'nouvel@exemple.test', 'SECRETAIRE', 'jeton-exemple-2', now())`,
        [comptes.gerant])
      expect([invite.erreur, invite.nb]).toEqual([null, 1])
      for (const [requete, params] of etapes) {
        const r = await sousRole(db, 'service_role', null, requete, params)
        expect([r.erreur, r.nb], requete).toEqual([null, 1])
      }
    })
  })
})

describe('base sans la table pro_team_members (rôles présents)', () => {
  it('la migration passe sans erreur, deux fois, et ne crée rien (REVOKE seul y échouerait en 42P01)', async () => {
    const db = await PGlite.create()
    try {
      await db.exec(ECHAFAUDAGE_SUPABASE_SQL)
      await db.exec(lireMigrationQr(MIGRATION))
      await db.exec(lireMigrationQr(MIGRATION))
      const { rows } = await db.query<{ absente: boolean }>(`SELECT to_regclass('${TABLE}') IS NULL AS absente`)
      expect(rows[0].absente).toBe(true)
    } finally {
      await db.close()
    }
  }, 60_000)
})
