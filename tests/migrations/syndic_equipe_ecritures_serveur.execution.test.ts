// @vitest-environment node
// tests/migrations/syndic_equipe_ecritures_serveur.execution.test.ts
//
// EXÉCUTION RÉELLE de 20261114_syndic_equipe_ecritures_serveur.sql (T20, DT9 élargie) sur un vrai PostgreSQL (PGlite,
// WebAssembly, en mémoire ; aucun service, aucune base distante), avec le rôle authenticated et le jeton d'une session
// de navigateur (request.jwt.claims, comme PostgREST), sur les deux états de départ possibles :
//   - « production » : table, contrainte du rôle et policies telles que constatées en lecture seule le 14/11/2026,
//     déclencheur de date relevé le 15/11/2026, et sa fonction telle que lue le 17/11/2026 (mêmes empreintes) ;
//   - « dépôt » : la migration 20260527 du dépôt, la section 12 de la 041, puis le retrait de member_update_self (#649).
// Scénario A23 du dossier M0 (D4) : AVANT T20, les écritures du titulaire passent (la faille est reproduite) ; APRÈS T20,
// jouée deux fois, elles sont refusées, la lecture reste, et les routes serveur (service_role) écrivent toujours. Les
// contournements qu'un propriétaire de la base poserait à la main rouvrent l'écriture (vue, règle, déclencheur ou
// fonction SECURITY DEFINER, héritage, partition, clé étrangère à action), changent les écritures du serveur
// (déclencheur posé sur la table, fonction du déclencheur attendu remplacée sous le même nom ou dont le SET
// search_path change au point de détourner now(), déclencheur attendu recréé pour d'autres écritures) ou la préparent :
// un droit de colonne reste neutralisé par la RLS tant qu'aucune policy d'écriture n'existe, et une clé sans action ne
// sert qu'avec un TRUNCATE … CASCADE lancé par une fonction SECURITY DEFINER. La partie 1 du scénario de contrôle
// montre chacun, comme tout changement du déclencheur attendu qui ne touche pas au corps de sa fonction (mode de
// sécurité, UPDATE OF, clause WHEN, argument, désactivation), et un déclencheur de webhook sans rendre ses arguments,
// pas plus que la requête de relecture des déclencheurs donnée par sa consigne ; des témoins gardent ce qu'elle ne
// peut pas voir (nom écrit U&"…", valeur par défaut de colonne).
// Comptes fictifs (UUID aléatoires) ; aucune donnée réelle.

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { createHash, randomUUID } from 'crypto'
import { readFileSync } from 'fs'
import { join } from 'path'
import { ECHAFAUDAGE_SUPABASE_SQL, erreurPg, lireMigrationQr, type ErreurPg } from '../helpers/pglite-signalements'

const T20 = '20261114_syndic_equipe_ecritures_serveur.sql'

/**
 * Les requêtes du scénario que Frédéric lance dans l'éditeur SQL (supabase/tests/…) : état, bloc de test, et relecture
 * des déclencheurs sans leurs arguments, que donne la consigne (ses lignes de commentaire mises bout à bout).
 */
function scenario(): { etat: string; test: string; relecture: string } {
  const texte = readFileSync(join(process.cwd(), 'supabase/tests/syndic_equipe_ecritures_serveur.sql'), 'utf-8').replace(/\r\n/g, '\n')
  const etat = texte.match(/-- 1\. État\n(select json_build_object[\s\S]*?\) as etat;)/)
  const test = texte.match(/-- 2\. Test\n(do \$\$[\s\S]*?\n\$\$;)/)
  const consigne = texte.split('\n').filter((l) => l.startsWith('--')).map((l) => l.slice(2).trim()).join('\n')
  const relecture = /select tgname,[\s\S]*?not tgisinternal;/.exec(consigne)
  if (!etat || !test || !relecture) {
    throw new Error('Scénario supabase/tests/syndic_equipe_ecritures_serveur.sql : parties 1 et 2, ou relecture des déclencheurs, introuvables')
  }
  return { etat: etat[1], test: test[1], relecture: relecture[0] }
}

interface FonctionCitee {
  fonction: string
  security_definer: boolean
  executable_par_les_clients: boolean
  fonction_de_declencheur: boolean
}

interface CleEtrangere { contrainte: string; vers: string; suppression: string; mise_a_jour: string }

/** Entrée de « declencheurs » : jamais de définition ni d'arguments, seulement des codes et des empreintes. */
interface EntreeDeclencheur {
  nom: string
  fonction: string
  type: number
  actif: string
  empreinte: string
  empreinte_declencheur: string
}

interface EtatTable {
  policies_ecriture: number
  rls_active: boolean
  proprietaire: string
  fonctions_citant_la_table: FonctionCitee[] | null
  fonctions_ecrivant_la_table: FonctionCitee[] | null
  vues: Array<{ vue: string; type: string; security_invoker: boolean; regle_d_ecriture: boolean }> | null
  heritage: Array<{ table: string; lien: string }> | null
  regles_sur_la_table: number
  cles_etrangeres: CleEtrangere[] | null
  declencheurs: EntreeDeclencheur[] | null
  droits: Array<{ role: string; select: boolean; insert: boolean; update: boolean; delete: boolean; truncate: boolean }>
}

/** Ordre des unités de code, avec un comparateur explicite. */
const parTexte = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** Fonctions d'une liste de la partie 1, en « nom security_definer executable_par_les_clients », triées. */
const resume = (liste: FonctionCitee[] | null) =>
  (liste ?? []).map((f) => `${f.fonction} ${f.security_definer} ${f.executable_par_les_clients}`).sort(parTexte)

const PREFIXE_BILAN = 'BILAN (tout est annulé) : '

/** Corps de déclencheur qui impose à la ligne écrite le rôle qu'un client a choisi (table relais essai_consigne). */
const IMPOSE_LE_ROLE =
  'NEW.role := coalesce((SELECT c.role FROM public.essai_consigne c WHERE c.cabinet_id = NEW.cabinet_id LIMIT 1), NEW.role);'

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
// trg_team_updated_at relevé le 15/11/2026 (sa fonction ne nomme pas la table), dont la fonction est SECURITY DEFINER
// avec un search_path vide (lecture du 17/11/2026) ; ni clé étrangère ni héritage (lecture du 16/11/2026).
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
CREATE FUNCTION public.update_team_updated_at() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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

/**
 * Clés étrangères de 20260527 vers auth.users (état « dépôt » seulement, où 20260527 crée la table) : à la suppression
 * d'un compte, les lignes de son cabinet partent (c) et sa ligne de membre perd son compte (n). La production n'en a
 * aucune (lecture du 16/11/2026).
 */
const CLES_DU_DEPOT: CleEtrangere[] = [
  { contrainte: 'syndic_team_members_cabinet_id_fkey', vers: 'auth.users', suppression: 'c', mise_a_jour: 'a' },
  { contrainte: 'syndic_team_members_user_id_fkey', vers: 'auth.users', suppression: 'n', mise_a_jour: 'a' },
]

const ETATS = [
  {
    nom: 'production (constats du 14 au 17/11/2026)',
    sql: () => PRODUCTION_SQL,
    // Empreintes du déclencheur de date relevées en production le 17/11/2026 (PostgreSQL 17.6, éditeur SQL).
    empreintesProduction: { empreinte: '4c078d78adb5', empreinte_declencheur: 'abd2e2292260' } as Pick<EntreeDeclencheur, 'empreinte' | 'empreinte_declencheur'> | null,
    lecture: ['syndic_team_select'],
    ecritureAvant: 3,
    declencheur: { nom: 'trg_team_updated_at', fonction: 'update_team_updated_at()' },
    cles: [] as CleEtrangere[],
    // Sans clé étrangère en production : l'insertion pour soi passe, le scénario le signale.
    scenarioAvant: /^ÉCHEC 2 : ligne créée par une session navigateur$/,
  },
  {
    nom: 'dépôt (20260527, 041, #649)',
    sql: depotSql,
    empreintesProduction: null,
    lecture: ['syndic_team_cabinet_read', 'syndic_team_members_member_select'],
    ecritureAvant: 2,
    declencheur: { nom: 'syndic_team_members_updated_at', fonction: 'syndic_team_members_set_updated_at()' },
    cles: CLES_DU_DEPOT,
    // Clé étrangère vers auth.users dans le dépôt : le compte fictif n'y est pas, l'insertion échoue autrement.
    scenarioAvant: /violates foreign key constraint/,
  },
]

/** Droits attendus après T20 dans la partie 1 : lecture seule pour les clients, tout pour les routes serveur. */
const DROITS_APRES_T20 = [
  { role: 'anon', select: true, insert: false, update: false, delete: false, truncate: false },
  { role: 'authenticated', select: true, insert: false, update: false, delete: false, truncate: false },
  { role: 'service_role', select: true, insert: true, update: true, delete: true, truncate: true },
]

type Role = 'anon' | 'authenticated' | 'service_role'
interface Appel { lignes: Record<string, unknown>[]; nb: number; erreur: ErreurPg | null }

describe.each(ETATS)('état de départ : $nom', ({ sql, lecture, ecritureAvant, declencheur, cles, scenarioAvant, empreintesProduction }) => {
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

  /** cles_etrangeres attendu : les clés de l'état de départ, plus celles posées par le test (rangées par nom). */
  const clesAttendues = (...posees: CleEtrangere[]) => {
    const toutes = [...posees, ...cles].sort((a, b) => parTexte(a.contrainte, b.contrainte))
    return toutes.length > 0 ? toutes : null
  }

  /** Empreintes qu'affiche la partie 1 (début du SHA-256), calculées ici depuis les définitions lues à part. */
  const hache = (texte: string) => createHash('sha256').update(texte, 'utf8').digest('hex').slice(0, 12)
  const empreinteDe = async (fonction: string) =>
    hache((await db.query<{ def: string }>('SELECT pg_get_functiondef($1::regprocedure) AS def', [fonction])).rows[0].def)
  const empreinteDeclencheurDe = async (nom: string) =>
    hache((await db.query<{ def: string }>(
      `SELECT pg_get_triggerdef(oid) AS def FROM pg_trigger WHERE tgrelid = 'public.syndic_team_members'::regclass AND tgname = $1`,
      [nom])).rows[0].def)

  /** Entrée de « declencheurs » attendue pour un déclencheur de la table, empreintes calculées ici. */
  const entreeDeclencheur = async (nom: string, fonction: string, type: number, actif = 'O'): Promise<EntreeDeclencheur> =>
    ({ nom, fonction, type, actif, empreinte: await empreinteDe(fonction), empreinte_declencheur: await empreinteDeclencheurDe(nom) })

  /** declencheurs attendu : le déclencheur de date de l'état de départ (BEFORE UPDATE, par ligne : type 19). */
  const declencheursAttendus = async () => [await entreeDeclencheur(declencheur.nom, declencheur.fonction, 19)]

  /** Recrée le déclencheur attendu sous le même nom et sur la même fonction : moment, clause WHEN et arguments donnés. */
  const recreeDeclencheurAttendu = (moment: string, quand = '', args = '') => db.exec(
    `DROP TRIGGER ${declencheur.nom} ON public.syndic_team_members;
     CREATE TRIGGER ${declencheur.nom} ${moment} ON public.syndic_team_members
       FOR EACH ROW ${quand} EXECUTE FUNCTION public.${declencheur.fonction.replace('()', `(${args})`)}`)

  /** Partie 1 sans la liste des déclencheurs : ce qui doit rester identique quand seul un déclencheur change. */
  const sansDeclencheurs = (etat: EtatTable): EtatTable => ({ ...etat, declencheurs: null })

  /** Table relais que les clients écrivent : le titulaire y choisit le rôle « syndic_admin » pour son cabinet. */
  async function poseConsigne() {
    await db.exec('CREATE TABLE public.essai_consigne (cabinet_id uuid, role text)')
    const consigne = await sous('authenticated', TITULAIRE,
      `INSERT INTO public.essai_consigne (cabinet_id, role) VALUES ($1, 'syndic_admin')`, [TITULAIRE])
    expect(consigne.erreur).toBeNull()
  }

  /** Remplace sous le même nom (CREATE OR REPLACE) la fonction du déclencheur attendu : elle date la ligne, et impose le rôle. */
  const remplaceFonctionAttendue = () => db.exec(`CREATE OR REPLACE FUNCTION public.${declencheur.fonction} RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      NEW.updated_at = now();
      ${IMPOSE_LE_ROLE}
      RETURN NEW;
    END $$`)

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

    it('la partie 1 voit aussi une écriture par EXECUTE dynamique (seulement parmi les fonctions qui citent la table), un corps SQL standard (BEGIN ATOMIC), MERGE sur le nom entre guillemets, UPDATE, DELETE FROM ONLY et TRUNCATE avec ou sans TABLE', async () => {
      await db.exec(`CREATE FUNCTION public.essai_ecrit_dynamique(c uuid) RETURNS void LANGUAGE plpgsql
        AS $$ BEGIN EXECUTE format('INSERT INTO public.%I (cabinet_id) VALUES ($1)', 'syndic_team_members') USING c; END $$`)
      await db.exec(`CREATE FUNCTION public.essai_ecrit_atomique(c uuid) RETURNS void LANGUAGE sql SECURITY DEFINER
        BEGIN ATOMIC INSERT INTO public.syndic_team_members (cabinet_id) VALUES (c); END`)
      await db.exec(`CREATE FUNCTION public.essai_ecrit_merge(c uuid) RETURNS void LANGUAGE plpgsql
        AS $$ BEGIN MERGE INTO "public"."syndic_team_members" t USING (SELECT c AS id) s ON t.cabinet_id = s.id
                    WHEN MATCHED THEN DELETE; END $$`)
      await db.exec(`CREATE FUNCTION public.essai_ecrit_authentifie(c uuid) RETURNS void LANGUAGE sql
        AS $$ TRUNCATE TABLE public.syndic_team_members $$`)
      await db.exec(`CREATE FUNCTION public.essai_ecrit_role(c uuid) RETURNS void LANGUAGE sql
        AS $$ UPDATE public.syndic_team_members SET role = 'syndic_admin' WHERE cabinet_id = c $$`)
      await db.exec(`CREATE FUNCTION public.essai_ecrit_only(c uuid) RETURNS void LANGUAGE sql
        AS $$ DELETE FROM ONLY public.syndic_team_members WHERE cabinet_id = c $$`)
      await db.exec(`CREATE FUNCTION public.essai_ecrit_vidage_court() RETURNS void LANGUAGE sql
        AS $$ TRUNCATE public.syndic_team_members $$`)
      // Aucun client ne l'exécute ; exécutable par anon seul, ou par authenticated seul : compte comme exécutable
      // par les clients.
      await db.exec('REVOKE EXECUTE ON FUNCTION public.essai_ecrit_atomique(uuid) FROM PUBLIC, anon, authenticated')
      await db.exec('REVOKE EXECUTE ON FUNCTION public.essai_ecrit_merge(uuid) FROM PUBLIC, authenticated')
      await db.exec('REVOKE EXECUTE ON FUNCTION public.essai_ecrit_authentifie(uuid) FROM PUBLIC, anon')
      const etat = await etatScenario()
      const ecrivent = [
        'essai_ecrit_atomique(uuid) true false',
        'essai_ecrit_authentifie(uuid) false true',
        'essai_ecrit_merge(uuid) false true',
        'essai_ecrit_only(uuid) false true',
        'essai_ecrit_role(uuid) false true',
        'essai_ecrit_vidage_court() false true',
      ]
      expect(resume(etat.fonctions_citant_la_table)).toEqual([...ecrivent, 'essai_ecrit_dynamique(uuid) false true'].sort(parTexte))
      expect(resume(etat.fonctions_ecrivant_la_table)).toEqual(ecrivent)
    })

    it('le scénario de contrôle le voit : partie 1 compte les policies d’écriture, partie 2 signale la faille', async () => {
      const etat = await etatScenario()
      expect(Number(etat.policies_ecriture)).toBe(ecritureAvant)
      expect(etat.droits.find((d) => d.role === 'authenticated')).toMatchObject({ insert: true, update: true, delete: true })
      expect(etat.fonctions_ecrivant_la_table).toBeNull()
      expect(etat.fonctions_citant_la_table).toBeNull()
      expect(etat.vues).toBeNull()
      expect(etat.heritage).toBeNull()
      expect(etat.cles_etrangeres).toEqual(clesAttendues())
      expect(Number(etat.regles_sur_la_table)).toBe(0)
      expect(etat.declencheurs).toEqual(await declencheursAttendus())
      // Ni définition ni arguments (un webhook Supabase y place ses en-têtes) : des noms, des codes et des empreintes.
      for (const d of etat.declencheurs ?? []) {
        expect(Object.keys(d).sort(parTexte)).toEqual(['actif', 'empreinte', 'empreinte_declencheur', 'fonction', 'nom', 'type'])
      }
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
      expect(etat.heritage).toBeNull()
      expect(etat.cles_etrangeres).toEqual(clesAttendues())
      expect(Number(etat.regles_sur_la_table)).toBe(0)
      expect(etat.declencheurs).toEqual(await declencheursAttendus())
      expect(etat.droits).toEqual(DROITS_APRES_T20)
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

    it('security_invoker est lu à sa valeur, seul parmi les options de la vue : 1 le rend vrai (un client n’écrit toujours pas par elle, 42501), off faux, security_barrier ne compte pas', async () => {
      // PostgreSQL garde l'option telle qu'elle est écrite (security_invoker=1) : seule sa conversion en booléen la lit.
      // Sans le filtre sur le nom de l'option, la vue security_barrier serait lue security_invoker, et la vue à deux
      // options ferait échouer la partie 1 (sous-requête qui rend plusieurs lignes).
      await db.exec('CREATE VIEW public.essai_vue_invoker WITH (security_invoker = 1) AS SELECT * FROM public.syndic_team_members')
      await db.exec('CREATE VIEW public.essai_vue_fausse WITH (security_invoker = off) AS SELECT * FROM public.syndic_team_members')
      await db.exec('CREATE VIEW public.essai_vue_barriere WITH (security_barrier) AS SELECT * FROM public.syndic_team_members')
      await db.exec(`CREATE VIEW public.essai_vue_deux WITH (security_barrier, security_invoker = on)
        AS SELECT * FROM public.syndic_team_members`)
      const parLaVue = await sous('authenticated', TITULAIRE,
        `INSERT INTO public.essai_vue_invoker (cabinet_id, user_id, role, is_active) VALUES ($1, $2, 'syndic_admin', true)`,
        [TITULAIRE, AUTRE])
      expect(parLaVue.erreur?.code).toBe('42501')
      expect(await nombreLignes()).toBe(2)
      expect((await etatScenario()).vues).toEqual([
        { vue: 'essai_vue_barriere', type: 'v', security_invoker: false, regle_d_ecriture: false },
        { vue: 'essai_vue_deux', type: 'v', security_invoker: true, regle_d_ecriture: false },
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

    it('un déclencheur posé à la main sur la table (BEFORE INSERT), dont la fonction ne nomme pas la table, impose aux invitations du serveur un rôle lu dans une table que les clients écrivent : seule la liste « declencheurs » le montre (d’où son attendu)', async () => {
      await poseConsigne()
      await db.exec(`CREATE FUNCTION public.essai_role_impose() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          ${IMPOSE_LE_ROLE}
          RETURN NEW;
        END $$`)
      await db.exec(`CREATE TRIGGER essai_role_impose BEFORE INSERT ON public.syndic_team_members
        FOR EACH ROW EXECUTE FUNCTION public.essai_role_impose()`)
      // La route serveur invite en comptable : la ligne est enregistrée administrateur.
      const invite = await sous('service_role', null,
        `INSERT INTO public.syndic_team_members (cabinet_id, email, role, is_active)
         VALUES ($1, 'consigne@exemple.test', 'syndic_comptable', true) RETURNING role`, [TITULAIRE])
      expect([invite.erreur, invite.lignes]).toEqual([null, [{ role: 'syndic_admin' }]])
      const etat = await etatScenario()
      // Tous les autres champs gardent leur valeur attendue.
      expect([Number(etat.policies_ecriture), etat.rls_active, etat.fonctions_citant_la_table, etat.fonctions_ecrivant_la_table,
        etat.vues, Number(etat.regles_sur_la_table), etat.heritage]).toEqual([0, true, null, null, null, 0, null])
      expect(etat.cles_etrangeres).toEqual(clesAttendues())
      expect(etat.droits).toEqual(DROITS_APRES_T20)
      // BEFORE INSERT, par ligne : type 7 (1 + 2 + 4).
      expect(etat.declencheurs).toEqual([
        await entreeDeclencheur('essai_role_impose', 'essai_role_impose()', 7),
        ...await declencheursAttendus(),
      ])
    })

    it.runIf(empreintesProduction !== null)('l’état « production » reproduit le déclencheur de date de la production au caractère près : la partie 1 y rend les empreintes relevées le 17/11/2026', async () => {
      expect(await etatScenario()).toMatchObject({
        declencheurs: [{ nom: 'trg_team_updated_at', fonction: 'update_team_updated_at()', type: 19, actif: 'O', ...empreintesProduction }],
      })
    })

    it('la fonction du déclencheur attendu remplacée sous le même nom (CREATE OR REPLACE), qui lit le rôle dans une table que les clients écrivent : la route serveur qui accepte une invitation lui donne ce rôle ; dans la partie 1, seule l’empreinte de sa fonction change (d’où son attendu)', async () => {
      const reference = await etatScenario()
      const [attendu] = await declencheursAttendus()
      await poseConsigne()
      await remplaceFonctionAttendue()
      // La route serveur accepte l'invitation (comptable) : la ligne devient administrateur.
      const accepte = await sous('service_role', null,
        'UPDATE public.syndic_team_members SET user_id = $1, accepted_at = now(), invite_token = NULL WHERE id = $2 RETURNING role',
        [AUTRE, ligneInvitation])
      expect([accepte.erreur, accepte.lignes]).toEqual([null, [{ role: 'syndic_admin' }]])
      const etat = await etatScenario()
      expect(sansDeclencheurs(etat)).toEqual(sansDeclencheurs(reference))
      expect(etat.declencheurs).toEqual([{ ...attendu, empreinte: await empreinteDe(declencheur.fonction) }])
      expect(etat.declencheurs?.[0].empreinte).not.toBe(attendu.empreinte)
    })

    it('le déclencheur attendu recréé sous le même nom pour les insertions aussi (BEFORE INSERT OR UPDATE), sur sa fonction remplacée : les invitations de la route serveur reçoivent le rôle choisi par un client ; dans la partie 1, son type passe de 19 à 23', async () => {
      const reference = await etatScenario()
      await poseConsigne()
      await remplaceFonctionAttendue()
      await recreeDeclencheurAttendu('BEFORE INSERT OR UPDATE')
      const invite = await sous('service_role', null,
        `INSERT INTO public.syndic_team_members (cabinet_id, email, role, is_active)
         VALUES ($1, 'recree@exemple.test', 'syndic_comptable', true) RETURNING role`, [TITULAIRE])
      expect([invite.erreur, invite.lignes]).toEqual([null, [{ role: 'syndic_admin' }]])
      const etat = await etatScenario()
      expect(sansDeclencheurs(etat)).toEqual(sansDeclencheurs(reference))
      // 23 = 1 (par ligne) + 2 (BEFORE) + 4 (INSERT) + 16 (UPDATE).
      expect(etat.declencheurs).toEqual([await entreeDeclencheur(declencheur.nom, declencheur.fonction, 23)])
      expect(etat.declencheurs?.[0].empreinte_declencheur).not.toBe(reference.declencheurs?.[0].empreinte_declencheur)
    })

    it('la fonction du déclencheur attendu dotée d’un SET search_path qui place un schéma avant pg_catalog : son now() devient celui de ce schéma, à chaque modification du serveur ; dans la partie 1, seule son empreinte change', async () => {
      const reference = await etatScenario()
      await db.exec(`CREATE SCHEMA essai_piege;
        CREATE TABLE essai_piege.journal (vu timestamptz);
        CREATE FUNCTION essai_piege.now() RETURNS timestamptz LANGUAGE sql
          AS $$ INSERT INTO essai_piege.journal VALUES (pg_catalog.now()) RETURNING '2000-01-01 00:00:00+00'::timestamptz $$;
        GRANT USAGE ON SCHEMA essai_piege TO service_role;
        GRANT INSERT, SELECT ON essai_piege.journal TO service_role`)
      await db.exec(`ALTER FUNCTION public.${declencheur.fonction} SET search_path = essai_piege, pg_catalog`)
      const maj = await sous('service_role', null,
        `UPDATE public.syndic_team_members SET full_name = 'Membre Renommé' WHERE id = $1
         RETURNING updated_at = '2000-01-01 00:00:00+00'::timestamptz AS date_piegee`, [ligneMembre])
      expect([maj.erreur, maj.lignes]).toEqual([null, [{ date_piegee: true }]])
      expect(Number((await db.query<{ n: number }>('SELECT count(*)::int AS n FROM essai_piege.journal')).rows[0].n)).toBe(1)
      const etat = await etatScenario()
      expect(sansDeclencheurs(etat)).toEqual(sansDeclencheurs(reference))
      const [avant] = reference.declencheurs ?? []
      expect(etat.declencheurs).toEqual([{ ...avant, empreinte: await empreinteDe(declencheur.fonction) }])
      expect(etat.declencheurs?.[0].empreinte).not.toBe(avant.empreinte)
    })

    // Changements du déclencheur attendu qui ne touchent pas au corps de sa fonction : chacun ne change que son champ.
    const CHANGEMENTS_SANS_CORPS: Array<{ cas: string; poser: () => Promise<unknown>; champ: keyof EntreeDeclencheur; type: number; actif: string }> = [
      { cas: 'sa fonction passée dans l’autre mode (SECURITY DEFINER ou INVOKER)', champ: 'empreinte', type: 19, actif: 'O',
        poser: async () => {
          const { rows } = await db.query<{ definer: boolean }>(
            'SELECT prosecdef AS definer FROM pg_proc WHERE oid = $1::regprocedure', [declencheur.fonction])
          await db.exec(`ALTER FUNCTION public.${declencheur.fonction} ${rows[0].definer ? 'SECURITY INVOKER' : 'SECURITY DEFINER'}`)
        } },
      { cas: 'recréé pour les seules modifications du rôle (UPDATE OF role)', champ: 'empreinte_declencheur', type: 19, actif: 'O',
        poser: () => recreeDeclencheurAttendu('BEFORE UPDATE OF role') },
      { cas: 'recréé avec une clause WHEN', champ: 'empreinte_declencheur', type: 19, actif: 'O',
        poser: () => recreeDeclencheurAttendu('BEFORE UPDATE', 'WHEN (OLD.role IS DISTINCT FROM NEW.role)') },
      { cas: 'recréé avec un argument', champ: 'empreinte_declencheur', type: 19, actif: 'O',
        poser: () => recreeDeclencheurAttendu('BEFORE UPDATE', '', "'essai'") },
      { cas: 'désactivé', champ: 'actif', type: 19, actif: 'D',
        poser: () => db.exec(`ALTER TABLE public.syndic_team_members DISABLE TRIGGER ${declencheur.nom}`) },
    ]

    it.each(CHANGEMENTS_SANS_CORPS)('le déclencheur attendu, $cas, sans toucher au corps de sa fonction : dans la partie 1, seul le champ « $champ » change', async ({ poser, champ, type, actif }) => {
      const reference = await etatScenario()
      await poser()
      const etat = await etatScenario()
      expect(sansDeclencheurs(etat)).toEqual(sansDeclencheurs(reference))
      const [avant] = reference.declencheurs ?? []
      const [apres] = etat.declencheurs ?? []
      expect(apres).toEqual(await entreeDeclencheur(declencheur.nom, declencheur.fonction, type, actif))
      const champsChanges = (Object.keys(apres) as Array<keyof EntreeDeclencheur>).filter((k) => apres[k] !== avant[k])
      expect(champsChanges).toEqual([champ])
    })

    it('un déclencheur de webhook (fonction SECURITY DEFINER hors du schéma public, arguments qui portent une clé) : la partie 1 le montre sans rendre ses arguments, ni dans un champ ajouté ni collés à un champ existant, et la relecture des déclencheurs de la consigne ne les affiche pas', async () => {
      const avantLeWebhook = await etatScenario()
      await db.exec(`CREATE SCHEMA essai_webhooks;
        CREATE FUNCTION essai_webhooks.http_request() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN NEW; END $$;
        CREATE TRIGGER essai_webhook AFTER INSERT ON public.syndic_team_members FOR EACH ROW
          EXECUTE FUNCTION essai_webhooks.http_request('https://exemple.test/crochet', 'POST', '{"Authorization":"Bearer cle-essai-secrete"}')`)
      const traces = /cle-essai-secrete|exemple\.test\/crochet/
      const etat = await etatScenario()
      // AFTER INSERT, par ligne : type 5 (1 + 4).
      expect(etat.declencheurs).toEqual([
        await entreeDeclencheur('essai_webhook', 'essai_webhooks.http_request()', 5),
        ...await declencheursAttendus(),
      ])
      expect(JSON.stringify(etat)).not.toMatch(traces)
      // Aucun champ de plus au premier niveau (des arguments rendus en hexadécimal, par exemple), et rien de collé à la
      // valeur d'un champ existant (le propriétaire, par exemple) : hors déclencheurs, la partie 1 ne bouge pas.
      expect(Object.keys(etat).sort(parTexte)).toEqual(['cles_etrangeres', 'declencheurs', 'droits', 'fonctions_citant_la_table',
        'fonctions_ecrivant_la_table', 'heritage', 'policies', 'policies_ecriture', 'proprietaire', 'regles_sur_la_table',
        'rls_active', 'vues'])
      expect(sansDeclencheurs(etat)).toEqual(sansDeclencheurs(avantLeWebhook))
      // La relecture des déclencheurs de la consigne, telle que Frédéric la lance : le nombre d'arguments se lit, leur
      // texte jamais, et chaque définition s'arrête à la signature de la fonction. Toutes les lignes rendues sont lues
      // (une par déclencheur : une ligne doublée, qui afficherait les arguments, ne se cache pas derrière l'autre).
      const lignesRelues = (await db.query<{ tgname: string }>(scenario().relecture)).rows
      expect(JSON.stringify(lignesRelues)).not.toMatch(traces)
      const relus = new Map(lignesRelues.map((r) => [r.tgname, r]))
      expect(lignesRelues).toHaveLength(relus.size)
      expect(relus).toEqual(new Map([
        ['essai_webhook', { tgname: 'essai_webhook', tgtype: 5, tgenabled: 'O', tgnargs: 3, colonnes: '', quand: false,
          definition: 'CREATE TRIGGER essai_webhook AFTER INSERT ON public.syndic_team_members FOR EACH ROW EXECUTE FUNCTION essai_webhooks.http_request()' }],
        [declencheur.nom, { tgname: declencheur.nom, tgtype: 19, tgenabled: 'O', tgnargs: 0, colonnes: '', quand: false,
          definition: `CREATE TRIGGER ${declencheur.nom} BEFORE UPDATE ON public.syndic_team_members FOR EACH ROW EXECUTE FUNCTION ${declencheur.fonction}` }],
      ]))
    })

    // Héritage : une requête héritée n'est vérifiée que sur la table nommée (ses droits et sa RLS), pas sur la table.
    it('une table mère posée à la main (INHERIT) : un compte étranger change par elle le rôle d’une invitation, la partie 1 la montre (d’où « heritage » attendu à null)', async () => {
      await db.exec('CREATE TABLE public.essai_mere (id uuid, role text)')
      await db.exec('ALTER TABLE public.syndic_team_members INHERIT public.essai_mere')
      const parLaMere = await sous('authenticated', AUTRE,
        `UPDATE public.essai_mere SET role = 'syndic_admin' WHERE id = $1`, [ligneInvitation])
      expect(parLaMere.erreur).toBeNull()
      expect((await ligne(ligneInvitation)).role).toBe('syndic_admin')
      expect((await etatScenario()).heritage).toEqual([{ table: 'essai_mere', lien: 'parente' }])
    })

    it('une table partitionnée posée à la main (ATTACH PARTITION … DEFAULT) : un compte étranger s’y inscrit administrateur du cabinet, la ligne est routée vers la table, la partie 1 la montre', async () => {
      await db.exec(`CREATE TABLE public.essai_partitionnee (LIKE public.syndic_team_members INCLUDING DEFAULTS)
        PARTITION BY LIST (role)`)
      await db.exec('ALTER TABLE public.essai_partitionnee ATTACH PARTITION public.syndic_team_members DEFAULT')
      const parLaPartitionnee = await sous('authenticated', AUTRE,
        `INSERT INTO public.essai_partitionnee (cabinet_id, user_id, role, is_active) VALUES ($1, $2, 'syndic_admin', true)`,
        [TITULAIRE, AUTRE])
      expect(parLaPartitionnee.erreur).toBeNull()
      const routee = await db.query<{ role: string }>('SELECT role FROM ONLY public.syndic_team_members WHERE user_id = $1', [AUTRE])
      expect(routee.rows).toEqual([{ role: 'syndic_admin' }])
      expect((await etatScenario()).heritage).toEqual([{ table: 'essai_partitionnee', lien: 'parente' }])
    })

    it('une table fille posée à la main (INHERITS) : un compte étranger y ajoute une ligne que le serveur lit comme une ligne de l’équipe, la partie 1 la montre', async () => {
      await db.exec('CREATE TABLE public.essai_enfant () INHERITS (public.syndic_team_members)')
      const parLaFille = await sous('authenticated', AUTRE,
        `INSERT INTO public.essai_enfant (cabinet_id, user_id, role, is_active) VALUES ($1, $2, 'syndic_admin', true)`,
        [TITULAIRE, AUTRE])
      expect(parLaFille.erreur).toBeNull()
      // Le serveur (service_role, requête sans ONLY) le lit administrateur du cabinet du titulaire.
      const luParLeServeur = await sous('service_role', null,
        'SELECT cabinet_id, role FROM public.syndic_team_members WHERE user_id = $1', [AUTRE])
      expect(luParLeServeur.lignes).toEqual([{ cabinet_id: TITULAIRE, role: 'syndic_admin' }])
      expect((await etatScenario()).heritage).toEqual([{ table: 'essai_enfant', lien: 'enfant' }])
    })

    // Clés étrangères : les actions référentielles s'exécutent avec les droits du propriétaire de la table ; leurs
    // déclencheurs, internes, ne sont pas dans « declencheurs ».
    it('une clé étrangère à action posée à la main (ON UPDATE et ON DELETE CASCADE) vers une table que les clients écrivent : un compte étranger déplace l’équipe vers un autre cabinet, puis la supprime ; la partie 1 la montre', async () => {
      await db.exec('CREATE TABLE public.essai_cabinets (id uuid PRIMARY KEY)')
      await db.exec('INSERT INTO public.essai_cabinets (id) SELECT DISTINCT cabinet_id FROM public.syndic_team_members')
      await db.exec(`ALTER TABLE public.syndic_team_members ADD CONSTRAINT essai_cabinet_fk FOREIGN KEY (cabinet_id)
        REFERENCES public.essai_cabinets (id) ON UPDATE CASCADE ON DELETE CASCADE`)
      const deplace = await sous('authenticated', AUTRE, 'UPDATE public.essai_cabinets SET id = $1 WHERE id = $2', [AUTRE_CABINET, TITULAIRE])
      expect(deplace.erreur).toBeNull()
      expect((await ligne(ligneMembre)).cabinet_id).toBe(AUTRE_CABINET)
      const supprime = await sous('authenticated', AUTRE, 'DELETE FROM public.essai_cabinets WHERE id = $1', [AUTRE_CABINET])
      expect(supprime.erreur).toBeNull()
      expect(await nombreLignes()).toBe(0)
      const etat = await etatScenario()
      expect(etat.cles_etrangeres).toEqual(
        clesAttendues({ contrainte: 'essai_cabinet_fk', vers: 'essai_cabinets', suppression: 'c', mise_a_jour: 'c' }))
      expect(etat.declencheurs).toEqual(await declencheursAttendus())
    })

    it('une clé étrangère sans action, et un TRUNCATE … CASCADE de la table référencée lancé par une fonction SECURITY DEFINER qui ne nomme pas la table : un compte étranger vide l’équipe ; seule la clé le trahit dans la partie 1', async () => {
      await db.exec('CREATE TABLE public.essai_cabinets (id uuid PRIMARY KEY)')
      await db.exec('INSERT INTO public.essai_cabinets (id) SELECT DISTINCT cabinet_id FROM public.syndic_team_members')
      await db.exec(`ALTER TABLE public.syndic_team_members ADD CONSTRAINT essai_cabinet_fk FOREIGN KEY (cabinet_id)
        REFERENCES public.essai_cabinets (id)`)
      await db.exec(`CREATE FUNCTION public.essai_vider_cabinets() RETURNS void LANGUAGE sql SECURITY DEFINER
        AS $$ TRUNCATE public.essai_cabinets CASCADE $$`)
      const vidage = await sous('authenticated', AUTRE, 'SELECT public.essai_vider_cabinets()')
      expect(vidage.erreur).toBeNull()
      expect(await nombreLignes()).toBe(0)
      const etat = await etatScenario()
      expect(etat.cles_etrangeres).toEqual(
        clesAttendues({ contrainte: 'essai_cabinet_fk', vers: 'essai_cabinets', suppression: 'a', mise_a_jour: 'a' }))
      expect([etat.fonctions_citant_la_table, etat.fonctions_ecrivant_la_table]).toEqual([null, null])
    })

    it('un droit rendu sur une seule colonne (lecture, insertion, modification) se voit dans « droits » ; sans policy d’écriture, la RLS neutralise l’insertion (refus de la RLS, 42501) et la modification (aucune ligne)', async () => {
      await db.exec('REVOKE SELECT ON public.syndic_team_members FROM anon')
      await db.exec('GRANT SELECT (id), INSERT (email) ON public.syndic_team_members TO anon')
      await db.exec('GRANT UPDATE (role) ON public.syndic_team_members TO authenticated')
      expect((await etatScenario()).droits.slice(0, 2)).toEqual([
        { role: 'anon', select: true, insert: true, update: false, delete: false, truncate: false },
        { role: 'authenticated', select: true, insert: false, update: true, delete: false, truncate: false },
      ])
      // Le droit de colonne passe le contrôle des droits (sinon : « permission denied », 42501 aussi) ; la RLS, sans policy
      // INSERT, refuse la ligne.
      const insertion = await sous('anon', null, `INSERT INTO public.syndic_team_members (email) VALUES ('colonne@exemple.test')`)
      expect(insertion.erreur).toEqual({ code: '42501', message: 'new row violates row-level security policy for table "syndic_team_members"' })
      expect(await nombreLignes()).toBe(2)
      const maj = await sous('authenticated', TITULAIRE,
        `UPDATE public.syndic_team_members SET role = 'syndic_admin' WHERE id = $1`, [ligneInvitation])
      expect([maj.erreur, maj.nb]).toEqual([null, 0])
      expect((await ligne(ligneInvitation)).role).toBe('syndic_comptable')
    })

    it('un droit de colonne donné à PUBLIC survit à T20 rejouée (REVOKE pour anon et authenticated, contrôle final sur la table seule) : seule la partie 1 le montre', async () => {
      await db.exec('GRANT UPDATE (role) ON public.syndic_team_members TO PUBLIC')
      await db.exec(lireMigrationQr(T20))
      const droits = (await etatScenario()).droits
      expect(droits.map((d) => [d.role, d.update])).toEqual([['anon', true], ['authenticated', true], ['service_role', true]])
      const maj = await sous('anon', null,
        `UPDATE public.syndic_team_members SET role = 'syndic_admin' WHERE id = $1`, [ligneInvitation])
      expect([maj.erreur, maj.nb]).toEqual([null, 0])
    })

    it('une fonction SECURITY DEFINER exécutable par les clients, qui écrit la table avec des espaces autour du point du schéma (deux avant, un retour à la ligne indenté après) : un client s’en sert, la partie 1 la montre', async () => {
      // Un motif qui n'admettrait qu'une espace, ou au plus un blanc, de chaque côté du point ne verrait pas ce corps.
      await db.exec(`CREATE FUNCTION public.essai_ecrit_espaces(c uuid, u uuid) RETURNS void LANGUAGE sql SECURITY DEFINER
        AS $$ INSERT INTO public  .
          syndic_team_members (cabinet_id, user_id, role, is_active) VALUES (c, u, 'syndic_admin', true) $$`)
      const r = await sous('authenticated', TITULAIRE, 'SELECT public.essai_ecrit_espaces($1, $2)', [TITULAIRE, AUTRE])
      expect(r.erreur).toBeNull()
      expect(await nombreLignes()).toBe(3)
      const etat = await etatScenario()
      const attendu = [
        { fonction: 'essai_ecrit_espaces(uuid,uuid)', security_definer: true, executable_par_les_clients: true, fonction_de_declencheur: false },
      ]
      expect(etat.fonctions_ecrivant_la_table).toEqual(attendu)
      expect(etat.fonctions_citant_la_table).toEqual(attendu)
    })

    it('témoin des limites : un nom écrit U&"…" dans le corps échappe aux deux listes de fonctions (d’où la consigne : la partie 1 ne prouve pas l’absence d’une écriture cachée)', async () => {
      // \0073 est le « s » de syndic_team_members : le corps ne contient pas le nom en toutes lettres.
      await db.exec(`CREATE FUNCTION public.essai_ecrit_cache(c uuid, u uuid) RETURNS void LANGUAGE sql SECURITY DEFINER
        AS $$ INSERT INTO public.U&"\\0073yndic_team_members" (cabinet_id, user_id, role, is_active) VALUES (c, u, 'syndic_admin', true) $$`)
      const r = await sous('authenticated', TITULAIRE, 'SELECT public.essai_ecrit_cache($1, $2)', [TITULAIRE, AUTRE])
      expect(r.erreur).toBeNull()
      expect(await nombreLignes()).toBe(3)
      const etat = await etatScenario()
      expect([etat.fonctions_citant_la_table, etat.fonctions_ecrivant_la_table]).toEqual([null, null])
    })

    it('témoin des limites : une valeur par défaut de colonne qui appelle une fonction (ici le rôle, lu dans une table que les clients écrivent) change les insertions du serveur qui omettent la colonne, et la partie 1 reste identique (d’où la consigne)', async () => {
      const reference = await etatScenario()
      await poseConsigne()
      await db.exec(`CREATE FUNCTION public.essai_role_par_defaut() RETURNS text LANGUAGE sql
        AS $$ SELECT role FROM public.essai_consigne LIMIT 1 $$`)
      await db.exec('ALTER TABLE public.syndic_team_members ALTER COLUMN role SET DEFAULT public.essai_role_par_defaut()')
      const invite = await sous('service_role', null,
        `INSERT INTO public.syndic_team_members (cabinet_id, email, is_active)
         VALUES ($1, 'defaut@exemple.test', true) RETURNING role`, [TITULAIRE])
      expect([invite.erreur, invite.lignes]).toEqual([null, [{ role: 'syndic_admin' }]])
      expect(await etatScenario()).toEqual(reference)
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
