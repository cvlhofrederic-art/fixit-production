// @vitest-environment node
// tests/migrations/syndic_equipe_roles_unicite.execution.test.ts
//
// EXÉCUTION RÉELLE de 20261115_syndic_equipe_roles_unicite.sql sur un vrai PostgreSQL (PGlite, WebAssembly, en
// mémoire ; aucun service, aucune base distante), sur les deux états de départ possibles :
//   - « production » : la table telle que constatée en lecture seule le 14/11/2026 (VT-A-01) et le 15/11/2026 (T20
//     appliquée) ;
//   - « dépôt » : la migration 20260527 du dépôt, telle quelle.
// AVANT la migration, les deux défauts sont reproduits : « Technicien » (et « Juriste » en production) refusés par la
// base, upsert de /api/admin/init-team-table impossible (42P10). APRÈS, jouée deux fois : les 7 rôles de l'application
// passent, l'adresse est unique par cabinet (sous le nom de contrainte que lit la route), l'upsert d'init-team-table
// n'ajoute qu'une adresse nouvelle sans réécrire une ligne existante, et les lignes, policies, droits, colonnes et
// déclencheurs sont intacts. La migration s'arrête sans rien appliquer quand une ligne ou une autre contrainte s'y
// oppose ; le retour arrière de docs/rollback-procedures.md est joué lui aussi.
// Comptes fictifs (UUID aléatoires) ; aucune donnée réelle.

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { randomUUID } from 'crypto'
import { readFileSync } from 'fs'
import { join } from 'path'
import { ECHAFAUDAGE_SUPABASE_SQL, erreurPg, lireMigrationQr, type ErreurPg } from '../helpers/pglite-signalements'
import { ROLES_EQUIPE_SYNDIC, UNICITE_EMAIL_PAR_CABINET } from '@/lib/syndic/equipe-contraintes'

const MIGRATION = '20261115_syndic_equipe_roles_unicite.sql'
const migration = () => lireMigrationQr(MIGRATION)

const lireTexte = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf-8').replace(/\r\n/g, '\n')
/** La requête de contrôle que Frédéric lance dans l'éditeur SQL, avant puis après la migration. */
const scenario = () => lireTexte('supabase/tests/syndic_equipe_roles_unicite.sql')

/** Le bloc de retour arrière de docs/rollback-procedures.md, tel qu'on le collerait dans l'éditeur SQL. */
function retourArriere(): string {
  const doc = lireTexte('docs/rollback-procedures.md')
  const section = doc.split('## Migration 20261115 — Équipe syndic : rôles et unicité')[1] ?? ''
  const bloc = /```sql\n(-- Rollback \(production\)\n[\s\S]*?)\n```/.exec(section)
  if (!bloc) throw new Error('Retour arrière de la migration 20261115 (équipe syndic) introuvable dans docs/rollback-procedures.md')
  return bloc[1]
}

interface EtatScenario {
  controles_du_role: Array<{ nom: string; nb_valeurs: number; validee: boolean }> | null
  roles_refuses: string[] | null
  roles_en_trop: string[] | null
  unicites: Array<{ nom: string; colonnes: string[]; partiel: boolean; contrainte: boolean }> | null
  unicite_email_par_cabinet: boolean
  lignes: number
  lignes_role_hors_liste: number
  doublons_email_par_cabinet: number
  doublons_email_casse_ignoree_par_cabinet: number
  emails_dans_plusieurs_cabinets: number
}

/** Ordre des codes (celui de PostgreSQL en collation C), avec un comparateur explicite. */
function parTexte(a: string, b: string): number {
  if (a === b) return 0
  return a < b ? -1 : 1
}
const trie = (valeurs: readonly string[]) => [...valeurs].sort(parTexte)
/** Unicités dans l'ordre de leur nom, celui du scénario (json_agg … order by nom). */
const parNom = <T extends { nom: string }>(liste: readonly T[]) => [...liste].sort((a, b) => parTexte(a.nom, b.nom))

// auth.uid() de Supabase, nommée par les policies des deux états : le « sub » du jeton de la requête.
const AUTH_UID_SQL = `
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
`

// Production au 15/11/2026.
// Constaté (lecture seule) : les 14 colonnes dans leur ordre ; dans pg_constraint, la clé primaire, UNIQUE
// (invite_token) et le contrôle du rôle à 5 valeurs, sans clé étrangère (VT-A-01, 14/11) ; RLS active, une seule policy
// (syndic_team_select), SELECT seul pour anon et authenticated, déclencheur trg_team_updated_at (constat T20, 15/11).
// HYPOTHÈSE, non relevée par les constats : NOT NULL et valeurs par défaut du script d'origine supabase-team.sql (email
// NOT NULL, full_name NOT NULL DEFAULT '', role NOT NULL sans valeur par défaut), types de phone et custom_modules.
const PRODUCTION_SQL = `
CREATE TABLE public.syndic_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id uuid NOT NULL,
  user_id uuid,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  phone text,
  role text NOT NULL
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
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.syndic_team_members FROM anon, authenticated;
`

const UNICITE_ID = { nom: 'syndic_team_members_pkey', colonnes: ['id'], partiel: false, contrainte: true }
const UNICITE_JETON = { nom: 'syndic_team_members_invite_token_key', colonnes: ['invite_token'], partiel: false, contrainte: true }
const UNICITE_EMAIL_DEPOT = { nom: 'syndic_team_members_email_unique_idx', colonnes: ['email'], partiel: true, contrainte: false }
const UNICITE_PAR_CABINET = { nom: UNICITE_EMAIL_PAR_CABINET, colonnes: ['cabinet_id', 'email'], partiel: false, contrainte: true }

const ETATS = [
  {
    nom: 'production (constats du 14 et du 15/11/2026)',
    sql: () => PRODUCTION_SQL,
    rolesAvant: ['syndic_admin', 'syndic_comptable', 'syndic_gestionnaire', 'syndic_secretaire', 'syndic_tech'],
    unicitesAvant: [UNICITE_ID, UNICITE_JETON],
    emailNullable: false,
    // Pas d'unicité de l'adresse sur tous les cabinets en production : la migration n'en pose pas.
    autreCabinetMemeAdresseApres: null as string | null,
    // Le retour arrière documenté est celui de la production (5 rôles).
    retourArriereDocumente: true,
  },
  {
    nom: 'dépôt (20260527)',
    sql: () => lireMigrationQr('20260527_syndic_team_members.sql'),
    rolesAvant: ['syndic_admin', 'syndic_comptable', 'syndic_gestionnaire', 'syndic_juriste', 'syndic_secretaire', 'syndic_tech'],
    unicitesAvant: [UNICITE_EMAIL_DEPOT, UNICITE_JETON, UNICITE_ID],
    emailNullable: true,
    // L'index partiel du dépôt (adresse unique sur tous les cabinets) reste en place : la migration n'y touche pas.
    autreCabinetMemeAdresseApres: '23505',
    retourArriereDocumente: false,
  },
]

type Role = 'anon' | 'authenticated' | 'service_role'
interface Appel { lignes: Record<string, unknown>[]; nb: number; erreur: ErreurPg | null }

describe.each(ETATS)('état de départ : $nom', (etatDepart) => {
  const { sql, rolesAvant, unicitesAvant, emailNullable, autreCabinetMemeAdresseApres, retourArriereDocumente } = etatDepart
  let db: PGlite
  const CABINET = randomUUID() // compte du cabinet (cabinet_id)
  const AUTRE_CABINET = randomUUID()
  const MEMBRE = randomUUID() // compte d'un membre accepté
  const rolesRefusesAvant = ROLES_EQUIPE_SYNDIC.filter((r) => !rolesAvant.includes(r))
  let lignesDepart = 0
  let donneesAvant = ''
  let catalogueAvant: Catalogue

  beforeAll(async () => {
    db = await PGlite.create()
    await db.exec(ECHAFAUDAGE_SUPABASE_SQL + AUTH_UID_SQL)
    await db.exec(sql())
    // Comptes fictifs (clé étrangère vers auth.users dans le dépôt).
    for (const id of [CABINET, AUTRE_CABINET, MEMBRE]) {
      await db.query('INSERT INTO auth.users (id, email) VALUES ($1, $2)', [id, `${id}@exemple.test`])
    }
    // Lignes d'exemple, posées en propriétaire (comme les routes, hors RLS) : un membre accepté (le rôle de la seule
    // ligne de la production), une invitation en attente et, là où la colonne l'admet, un membre sans adresse.
    await db.query(
      `INSERT INTO public.syndic_team_members (cabinet_id, user_id, email, full_name, role, accepted_at, is_active)
       VALUES ($1, $2, 'membre@exemple.test', 'Membre Exemple', 'syndic_tech', now(), true)`, [CABINET, MEMBRE])
    await db.query(
      `INSERT INTO public.syndic_team_members (cabinet_id, email, full_name, role, invite_token, invite_sent_at, is_active)
       VALUES ($1, 'invite@exemple.test', 'Invité Exemple', 'syndic_comptable', 'jeton-exemple', now(), true)`, [CABINET])
    if (emailNullable) {
      await db.query(
        `INSERT INTO public.syndic_team_members (cabinet_id, email, full_name, role, is_active)
         VALUES ($1, NULL, 'Sans Adresse', 'syndic_gestionnaire', true)`, [CABINET])
    }
    lignesDepart = await nombreLignes()
    donneesAvant = await donnees()
    catalogueAvant = await catalogue()
  }, 120_000)
  afterAll(async () => { await db?.close() })
  beforeEach(async () => { await db.exec('BEGIN') })
  afterEach(async () => { await db.exec('ROLLBACK') })

  /** Requête sous un rôle de l'API, dans un point de sauvegarde : l'erreur est rendue, la transaction continue. */
  async function sous(role: Role, requete: string, params: unknown[] = []): Promise<Appel> {
    await db.exec('SAVEPOINT appel')
    try {
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

  /** Un script SQL joué comme dans l'éditeur, dans un point de sauvegarde : rend son erreur, ou null. */
  async function jouer(texte: string, role: 'postgres' | Role = 'postgres'): Promise<ErreurPg | null> {
    await db.exec('SAVEPOINT script')
    try {
      if (role !== 'postgres') await db.exec(`SET LOCAL ROLE ${role}`)
      await db.exec(texte)
      await db.exec('RESET ROLE')
      await db.exec('RELEASE SAVEPOINT script')
      return null
    } catch (e) {
      await db.exec('ROLLBACK TO SAVEPOINT script')
      await db.exec('RELEASE SAVEPOINT script')
      return erreurPg(e)
    }
  }
  const jouerMigration = (role: 'postgres' | Role = 'postgres') => jouer(migration(), role)

  // Écritures des routes serveur (service_role) : invitation (POST /api/syndic/team) et upsert d'init-team-table tel
  // que PostgREST le traduit. Route avant correctif : ON CONFLICT (email) DO UPDATE des colonnes envoyées ; après :
  // ignoreDuplicates, soit ON CONFLICT (cabinet_id, email) DO NOTHING.
  const inviter = (cabinet: string, email: string | null, role: string) => sous('service_role',
    `INSERT INTO public.syndic_team_members (cabinet_id, email, full_name, role, invite_token, invite_sent_at)
     VALUES ($1, $2, 'Nouvel Exemple', $3, $4, now()) RETURNING id`, [cabinet, email, role, randomUUID()])
  const COLONNES_UPSERT = `INSERT INTO public.syndic_team_members (cabinet_id, user_id, email, full_name, role, accepted_at, is_active)
     VALUES ($1, NULL, $2, 'Ajout Admin', $3, now(), true)`
  const upsertAncien = (email: string, role: string) => sous('service_role',
    `${COLONNES_UPSERT}
     ON CONFLICT (email) DO UPDATE SET cabinet_id = EXCLUDED.cabinet_id, user_id = EXCLUDED.user_id,
       email = EXCLUDED.email, full_name = EXCLUDED.full_name, role = EXCLUDED.role,
       accepted_at = EXCLUDED.accepted_at, is_active = EXCLUDED.is_active
     RETURNING id`, [CABINET, email, role])
  const upsertNouveau = (email: string, role: string) => sous('service_role',
    `${COLONNES_UPSERT} ON CONFLICT (cabinet_id, email) DO NOTHING RETURNING id, role`, [CABINET, email, role])

  /** Toutes les lignes, colonne par colonne, dans un ordre stable. */
  async function donnees(): Promise<string> {
    const r = await db.query('SELECT * FROM public.syndic_team_members ORDER BY id')
    return JSON.stringify(r.rows)
  }
  async function nombreLignes(): Promise<number> {
    return Number((await db.query<{ n: number }>('SELECT count(*)::int AS n FROM public.syndic_team_members')).rows[0].n)
  }
  const ligneParAdresse = async (email: string) =>
    (await db.query<Record<string, unknown>>(
      'SELECT user_id, full_name, role, is_active, accepted_at, invite_token FROM public.syndic_team_members WHERE email = $1',
      [email])).rows

  interface Catalogue { contraintes: string; index: string; policies: string; droits: string; colonnes: string; declencheurs: string }
  /** Ce que la migration pourrait toucher, par famille (définitions, sans les OID). */
  async function catalogue(): Promise<Catalogue> {
    const { rows } = await db.query<Record<keyof Catalogue, unknown>>(`
      SELECT
        (SELECT json_agg(json_build_object('nom', conname, 'type', contype, 'def', pg_get_constraintdef(oid), 'validee', convalidated)
                ORDER BY conname)
           FROM pg_constraint WHERE conrelid = 'public.syndic_team_members'::regclass) AS contraintes,
        (SELECT json_agg(pg_get_indexdef(indexrelid) ORDER BY pg_get_indexdef(indexrelid))
           FROM pg_index WHERE indrelid = 'public.syndic_team_members'::regclass) AS index,
        (SELECT json_agg(json_build_object('nom', policyname, 'cmd', cmd, 'qual', qual, 'with_check', with_check) ORDER BY policyname)
           FROM pg_policies WHERE schemaname = 'public' AND tablename = 'syndic_team_members') AS policies,
        (SELECT json_build_object('acl', relacl::text, 'rls', relrowsecurity, 'proprietaire', relowner::regrole::text)
           FROM pg_class WHERE oid = 'public.syndic_team_members'::regclass) AS droits,
        (SELECT json_agg(json_build_object('nom', column_name, 'type', data_type, 'nullable', is_nullable, 'defaut', column_default)
                ORDER BY ordinal_position)
           FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'syndic_team_members') AS colonnes,
        (SELECT json_agg(tgname::text ORDER BY tgname) FROM pg_trigger
          WHERE tgrelid = 'public.syndic_team_members'::regclass AND NOT tgisinternal) AS declencheurs`)
    const ligne = rows[0]
    return Object.fromEntries(Object.entries(ligne).map(([k, v]) => [k, JSON.stringify(v)])) as unknown as Catalogue
  }

  const etatScenario = async (): Promise<EtatScenario> =>
    (await db.query<{ etat: EtatScenario }>(scenario())).rows[0].etat

  /** Valeurs citées par chaque contrainte CHECK qui porte sur la colonne role. */
  async function controlesDuRole(): Promise<Array<{ nom: string; valeurs: string[] }>> {
    const { rows } = await db.query<{ nom: string; def: string }>(`
      SELECT c.conname AS nom, pg_get_constraintdef(c.oid) AS def
        FROM pg_constraint c
       WHERE c.conrelid = 'public.syndic_team_members'::regclass AND c.contype = 'c'
         AND EXISTS (SELECT 1 FROM pg_attribute a
                      WHERE a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey) AND a.attname = 'role')
       ORDER BY c.conname`)
    return rows.map(({ nom, def }) => ({ nom, valeurs: trie([...def.matchAll(/'([^']*)'/g)].map((m) => m[1])) }))
  }

  describe('avant la migration : les deux défauts sont reproduits', () => {
    it('la base refuse des rôles que l’application propose (invitation en erreur 500)', async () => {
      expect(rolesRefusesAvant.length).toBeGreaterThan(0)
      for (const role of rolesRefusesAvant) {
        const r = await inviter(CABINET, `${role}@exemple.test`, role)
        expect(r.erreur?.code, role).toBe('23514')
        expect(r.erreur?.message, role).toContain('syndic_team_members_role_check')
      }
      for (const role of rolesAvant) {
        const r = await inviter(CABINET, `${role}@exemple.test`, role)
        expect(r.erreur, role).toBeNull()
      }
    })

    it('l’upsert d’init-team-table échoue toujours (42P10), avec l’ancienne cible (email) comme avec la nouvelle', async () => {
      expect((await upsertAncien('invite@exemple.test', 'syndic_tech')).erreur?.code).toBe('42P10')
      expect((await upsertNouveau('nouveau@exemple.test', 'syndic_tech')).erreur?.code).toBe('42P10')
      expect(await nombreLignes()).toBe(lignesDepart)
    })

    it('le scénario de contrôle rend l’état attendu', async () => {
      const etat = await etatScenario()
      expect(etat.controles_du_role).toEqual([{ nom: 'syndic_team_members_role_check', nb_valeurs: rolesAvant.length, validee: true }])
      expect(etat.roles_refuses).toEqual(trie(rolesRefusesAvant))
      expect(etat.roles_en_trop).toBeNull()
      expect(etat.unicites).toEqual(parNom(unicitesAvant))
      expect(etat.unicite_email_par_cabinet).toBe(false)
      expect(Number(etat.lignes)).toBe(lignesDepart)
      expect(Number(etat.lignes_role_hors_liste)).toBe(0)
      expect(Number(etat.doublons_email_par_cabinet)).toBe(0)
      expect(Number(etat.doublons_email_casse_ignoree_par_cabinet)).toBe(0)
      expect(Number(etat.emails_dans_plusieurs_cabinets)).toBe(0)
    })
  })

  describe('la migration s’arrête sans rien appliquer quand une ligne ou une contrainte s’y oppose', () => {
    it('une ligne porte un rôle hors des 7 : message qui le nomme, rien n’est appliqué, la ligne reste', async () => {
      // Contrainte retirée à la main puis rôle inconnu posé : la seule façon d'obtenir une telle ligne.
      await db.exec('ALTER TABLE public.syndic_team_members DROP CONSTRAINT syndic_team_members_role_check')
      await db.query(`INSERT INTO public.syndic_team_members (cabinet_id, email, role) VALUES ($1, 'stagiaire@exemple.test', 'syndic_stagiaire')`, [CABINET])
      const avant = { catalogue: await catalogue(), donnees: await donnees() }
      const erreur = await jouerMigration()
      expect(erreur?.message).toMatch(/^Équipe syndic : rôle hors des 7 de l'application sur des lignes existantes : 'syndic_stagiaire' \(1\)\. Rien n'est appliqué/)
      expect(await catalogue()).toEqual(avant.catalogue)
      expect(await donnees()).toBe(avant.donnees)
    })

    it('une adresse figure deux fois dans un même cabinet : message, rien n’est appliqué', async () => {
      // Possible en production (aucune unicité) ; dans le dépôt, l'index partiel l'empêche : il est retiré pour l'essai.
      await db.exec('DROP INDEX IF EXISTS public.syndic_team_members_email_unique_idx')
      await db.query(`INSERT INTO public.syndic_team_members (cabinet_id, email, role) VALUES ($1, 'invite@exemple.test', 'syndic_tech')`, [CABINET])
      const avant = { catalogue: await catalogue(), donnees: await donnees() }
      const erreur = await jouerMigration()
      expect(erreur?.message).toMatch(/^Équipe syndic : 1 adresse\(s\) en double dans un même cabinet\. Rien n'est appliqué/)
      expect(await catalogue()).toEqual(avant.catalogue)
      expect(await donnees()).toBe(avant.donnees)
    })

    it('une autre contrainte CHECK porte sur le rôle : erreur après les changements, et tout est annulé', async () => {
      await db.exec(`ALTER TABLE public.syndic_team_members ADD CONSTRAINT autre_controle_role CHECK (role <> 'syndic_juriste')`)
      const avant = await catalogue()
      const erreur = await jouerMigration()
      expect(erreur?.message).toMatch(/^Équipe syndic : 2 contraintes CHECK portent sur role/)
      expect(await catalogue()).toEqual(avant)
    })

    it('le nom de l’unicité est déjà pris par une autre (colonnes différentes) : erreur, tout est annulé', async () => {
      await db.exec(`ALTER TABLE public.syndic_team_members ADD CONSTRAINT ${UNICITE_EMAIL_PAR_CABINET} UNIQUE (invite_token, email)`)
      const avant = await catalogue()
      const erreur = await jouerMigration()
      expect(erreur?.message).toMatch(/ne porte pas sur \(cabinet_id, email\)\. Rien n'est appliqué/)
      expect(await catalogue()).toEqual(avant)
    })

    it('lancée par un rôle qui ne possède pas la table : refusée (42501), rien n’est appliqué', async () => {
      const avant = await catalogue()
      const erreur = await jouerMigration('authenticated')
      expect(erreur?.code).toBe('42501')
      expect(await catalogue()).toEqual(avant)
    })

    it('base sans la table : passe deux fois sans erreur et ne crée rien', async () => {
      await db.exec('ALTER TABLE public.syndic_team_members RENAME TO syndic_team_members_a_part')
      expect(await jouerMigration()).toBeNull()
      expect(await jouerMigration()).toBeNull()
      const { rows } = await db.query<{ absente: boolean }>(`SELECT to_regclass('public.syndic_team_members') IS NULL AS absente`)
      expect(rows[0].absente).toBe(true)
    })
  })

  describe('après la migration, jouée deux fois', () => {
    let cataloguePremierePasse: Catalogue
    let delaiApres = ''

    beforeAll(async () => {
      await db.exec(migration())
      cataloguePremierePasse = await catalogue()
      await db.exec(migration())
      delaiApres = String((await db.query<{ lock_timeout: string }>('SHOW lock_timeout')).rows[0].lock_timeout)
    })

    it('la seconde passe ne change rien (rejouable) ; le délai de verrou ne survit pas au bloc', async () => {
      expect(await catalogue()).toEqual(cataloguePremierePasse)
      expect(delaiApres).toBe('0')
    })

    it('aucune ligne existante n’est modifiée ; policies, droits, colonnes et déclencheurs intacts', async () => {
      expect(await donnees()).toBe(donneesAvant)
      const apres = await catalogue()
      expect(apres.policies).toBe(catalogueAvant.policies)
      expect(apres.droits).toBe(catalogueAvant.droits)
      expect(apres.colonnes).toBe(catalogueAvant.colonnes)
      expect(apres.declencheurs).toBe(catalogueAvant.declencheurs)
    })

    it('une seule contrainte CHECK sur le rôle, validée, avec exactement les 7 rôles de l’application', async () => {
      expect(await controlesDuRole()).toEqual([{ nom: 'syndic_team_members_role_check', valeurs: trie(ROLES_EQUIPE_SYNDIC) }])
      const { rows } = await db.query<{ convalidated: boolean }>(`SELECT convalidated FROM pg_constraint
        WHERE conrelid = 'public.syndic_team_members'::regclass AND conname = 'syndic_team_members_role_check'`)
      expect(rows[0].convalidated).toBe(true)
    })

    it.each([...ROLES_EQUIPE_SYNDIC])('invitation « %s » acceptée par la base', async (role) => {
      const r = await inviter(CABINET, `nouveau.${role}@exemple.test`, role)
      expect(r.erreur).toBeNull()
      expect(r.lignes).toHaveLength(1)
    })

    it.each(['syndic', 'super_admin', 'admin', 'syndic_gestor_condominio', 'Syndic_tech', 'syndic_technicien ', ''])(
      'rôle « %s » toujours refusé (23514)', async (role) => {
        const r = await inviter(CABINET, 'refuse@exemple.test', role)
        expect(r.erreur?.code).toBe('23514')
        expect(await nombreLignes()).toBe(lignesDepart)
      })

    it('la même adresse deux fois dans un cabinet : refusée (23505), sous le nom de contrainte que lit la route', async () => {
      const r = await inviter(CABINET, 'invite@exemple.test', 'syndic_tech')
      expect(r.erreur?.code).toBe('23505')
      // Dans le dépôt, l'index partiel (adresse unique sur tous les cabinets), plus ancien, est vérifié le premier :
      // retiré le temps de l'essai pour voir la contrainte de la migration, la seule qu'a la production.
      await db.exec('DROP INDEX IF EXISTS public.syndic_team_members_email_unique_idx')
      const seule = await inviter(CABINET, 'invite@exemple.test', 'syndic_tech')
      expect(seule.erreur?.code).toBe('23505')
      expect(seule.erreur?.message).toContain(UNICITE_EMAIL_PAR_CABINET)
      expect(await nombreLignes()).toBe(lignesDepart)
    })

    it('la même adresse dans un autre cabinet : inchangé (acceptée en production, refusée par l’index du dépôt)', async () => {
      const r = await inviter(AUTRE_CABINET, 'invite@exemple.test', 'syndic_tech')
      expect(r.erreur?.code ?? null).toBe(autreCabinetMemeAdresseApres)
    })

    it.runIf(emailNullable)('plusieurs membres sans adresse dans un même cabinet : acceptés', async () => {
      expect((await inviter(CABINET, null, 'syndic_juriste')).erreur).toBeNull()
      expect((await inviter(CABINET, null, 'syndic_technicien')).erreur).toBeNull()
      expect(await nombreLignes()).toBe(lignesDepart + 2)
    })

    it('upsert d’init-team-table : une ligne existante n’est jamais réécrite (DO NOTHING), aucune ligne rendue', async () => {
      // Membre accepté puis désactivé par son cabinet : ni son compte, ni son nom, ni son rôle, ni son statut ne bougent.
      await db.exec(`UPDATE public.syndic_team_members SET is_active = false WHERE email = 'membre@exemple.test'`)
      const avant = await ligneParAdresse('membre@exemple.test')
      const membre = await upsertNouveau('membre@exemple.test', 'syndic_technicien')
      expect(membre.erreur).toBeNull()
      expect(membre.lignes).toEqual([])
      expect(await ligneParAdresse('membre@exemple.test')).toEqual(avant)
      expect(avant[0]).toMatchObject({ user_id: MEMBRE, full_name: 'Membre Exemple', role: 'syndic_tech', is_active: false })
      // Invitation en attente : ni acceptée, ni changée de rôle, jeton intact.
      const invitation = await upsertNouveau('invite@exemple.test', 'syndic_admin')
      expect(invitation.lignes).toEqual([])
      expect(await ligneParAdresse('invite@exemple.test')).toEqual([
        expect.objectContaining({ role: 'syndic_comptable', accepted_at: null, invite_token: 'jeton-exemple' }),
      ])
      expect(await nombreLignes()).toBe(lignesDepart)
    })

    it('upsert d’init-team-table : une adresse nouvelle du cabinet est ajoutée', async () => {
      const r = await upsertNouveau('ajout@exemple.test', 'syndic_juriste')
      expect(r.erreur).toBeNull()
      expect(r.lignes).toEqual([expect.objectContaining({ role: 'syndic_juriste' })])
      expect(await nombreLignes()).toBe(lignesDepart + 1)
    })

    it('le scénario de contrôle rend l’état attendu après la migration', async () => {
      const etat = await etatScenario()
      expect(etat.controles_du_role).toEqual([{ nom: 'syndic_team_members_role_check', nb_valeurs: 7, validee: true }])
      expect(etat.roles_refuses).toBeNull()
      expect(etat.roles_en_trop).toBeNull()
      expect(etat.unicites).toEqual(parNom([...unicitesAvant, UNICITE_PAR_CABINET]))
      expect(etat.unicite_email_par_cabinet).toBe(true)
      expect(Number(etat.lignes)).toBe(lignesDepart)
      expect(Number(etat.lignes_role_hors_liste)).toBe(0)
      expect(Number(etat.doublons_email_par_cabinet)).toBe(0)
    })

    it('le scénario de contrôle compte, pour information, les adresses qui ne diffèrent que par la casse', async () => {
      expect((await inviter(CABINET, 'INVITE@exemple.test', 'syndic_tech')).erreur).toBeNull()
      const etat = await etatScenario()
      expect(Number(etat.doublons_email_par_cabinet)).toBe(0)
      expect(Number(etat.doublons_email_casse_ignoree_par_cabinet)).toBe(1)
    })

    it.runIf(retourArriereDocumente)('retour arrière documenté (joué deux fois) : contraintes et index d’avant la migration, lignes intactes', async () => {
      expect(await jouer(retourArriere())).toBeNull()
      expect(await jouer(retourArriere())).toBeNull()
      const apres = await catalogue()
      expect(apres.contraintes).toBe(catalogueAvant.contraintes)
      expect(apres.index).toBe(catalogueAvant.index)
      expect(apres.policies).toBe(catalogueAvant.policies)
      expect(await donnees()).toBe(donneesAvant)
      expect((await etatScenario()).roles_refuses).toEqual(['syndic_juriste', 'syndic_technicien'])
    })

    it.runIf(retourArriereDocumente)('retour arrière refusé si une ligne porte un rôle nouveau : rien n’est appliqué', async () => {
      expect((await inviter(CABINET, 'technicien@exemple.test', 'syndic_technicien')).erreur).toBeNull()
      const avant = await catalogue()
      const erreur = await jouer(retourArriere())
      expect(erreur?.message).toMatch(/^Retour arrière impossible : 1 ligne\(s\) portent un rôle que l'ancienne contrainte refuse\. Rien n'est appliqué\.$/)
      expect(await catalogue()).toEqual(avant)
    })
  })
})
