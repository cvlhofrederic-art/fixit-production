// @vitest-environment node
// tests/migrations/pro_equipe_ecritures_serveur.execution.test.ts
//
// EXÉCUTION RÉELLE de 20261115_pro_equipe_ecritures_serveur.sql (suite de R36, décision VF-A-02 ; modèle de T20) sur
// un vrai PostgreSQL (PGlite, WebAssembly, en mémoire ; aucun service, aucune base distante), avec le rôle
// authenticated et le jeton d'une session de navigateur (request.jwt.claims, comme PostgREST), sur les deux états de
// départ possibles :
//   - « production » : table, contraintes et policies telles que constatées en lecture seule le 14/11/2026, déclencheur
//     de date tel que relevé le 17/11/2026 ;
//   - « dépôt » : la migration 048 telle quelle (avec pro_role_permissions, dont la lecture s'appuie sur
//     pro_team_members), puis les ALTER POLICY de 20260610 sur les policies de pro_team_members.
// AVANT la migration, les écritures du gérant passent (la faille est reproduite) ; APRÈS, jouée deux fois, elles sont
// refusées, la lecture reste, et les routes serveur (service_role) écrivent toujours. Les contournements qu'un
// propriétaire de la base poserait à la main (vue, règle, déclencheur SECURITY DEFINER, héritage, partition, clé
// étrangère) rouvrent l'écriture, ou changent les écritures du serveur (déclencheur posé sur la table, fonction du
// déclencheur attendu remplacée sous le même nom ou dotée d'un SET search_path qui détourne now(), déclencheur attendu
// recréé pour d'autres écritures) : la partie 1 du scénario de contrôle montre chacun, comme tout changement du
// déclencheur attendu qui ne touche pas au corps de sa fonction (mode de sécurité, UPDATE OF, clause WHEN, argument,
// désactivation), et un déclencheur de webhook sans rendre ses arguments, pas plus que la requête de relecture que donne
// sa consigne ; des témoins gardent ce qu'elle ne peut pas voir (nom écrit U&"…", valeur par défaut de colonne).
// Comptes fictifs (UUID aléatoires) ; aucune donnée réelle.

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { createHash, randomUUID } from 'crypto'
import { readFileSync } from 'fs'
import { join } from 'path'
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
const CHEMIN_SCENARIO = 'supabase/tests/pro_equipe_ecritures_serveur.sql'
const SCENARIO = partiesDuScenario(CHEMIN_SCENARIO)

/** Requête donnée en commentaire dans la consigne d'un scénario : de la ligne qui répond à `debut` à celle qui répond à
 *  `fin`, sans le « -- » qui ouvre chaque ligne. */
function requeteDeLaConsigne(chemin: string, debut: RegExp, fin: RegExp): string {
  const lignes = readFileSync(join(process.cwd(), chemin), 'utf-8').replace(/\r\n/g, '\n').split('\n')
  const premiere = lignes.findIndex((l) => debut.test(l))
  const derniere = lignes.findIndex((l, i) => i > premiere && fin.test(l))
  if (premiere < 0 || derniere < 0) throw new Error(`Scénario ${chemin} : requête de la consigne introuvable (${debut} … ${fin})`)
  return lignes.slice(premiere, derniere + 1).map((l) => l.replace(/^--/, '')).join('\n')
}
/**
 * Requête de relecture des déclencheurs « sans leurs arguments » que donne la consigne de la partie 1, telle que
 * Frédéric la lance en production : le test du webhook l'exécute.
 */
const RELECTURE_DECLENCHEURS = requeteDeLaConsigne(CHEMIN_SCENARIO, /^--\s+select tgname,/, /not tgisinternal;$/)
/** Ligne de cette requête : codes, nombre d'arguments, et définition coupée avant les arguments. */
interface DeclencheurRelu {
  tgname: string
  tgtype: number
  tgenabled: string
  tgnargs: number
  colonnes: string
  quand: boolean
  definition: string
}

interface FonctionCitee {
  fonction: string
  security_definer: boolean
  executable_par_les_clients: boolean
  fonction_de_declencheur: boolean
  sql_dynamique: boolean
}
/** Les seuls champs d'une fonction dans la partie 1 : jamais son corps, qui peut contenir une clé. */
const CHAMPS_FONCTION = ['executable_par_les_clients', 'fonction', 'fonction_de_declencheur', 'security_definer', 'sql_dynamique']
/** Entrée de « declencheurs » : jamais de définition ni d'arguments, seulement des codes et des empreintes. */
interface EntreeDeclencheur {
  nom: string
  fonction: string
  type: number
  actif: string
  empreinte: string
  empreinte_declencheur: string
}
/** Les seuls champs d'un déclencheur dans la partie 1 (un webhook Supabase place ses en-têtes dans ses arguments). */
const CHAMPS_DECLENCHEUR = ['actif', 'empreinte', 'empreinte_declencheur', 'fonction', 'nom', 'type']
/** Les champs de premier niveau de la partie 1, triés : un champ ajouté (des arguments en hexadécimal…) se voit. */
const CHAMPS_PARTIE_1 = ['cles_etrangeres', 'declencheurs', 'droits', 'empreinte_next_doc_number',
  'fonctions_citant_la_table', 'fonctions_ecrivant_la_table', 'heritage', 'policies', 'policies_ecriture', 'proprietaire',
  'regles_sur_la_table', 'rls_active', 'vues']
interface EtatTable {
  policies_ecriture: number
  rls_active: boolean
  proprietaire: string
  fonctions_citant_la_table: FonctionCitee[] | null
  fonctions_ecrivant_la_table: FonctionCitee[] | null
  vues: Array<{ vue: string; type: string; security_invoker: boolean; regle_d_ecriture: boolean }> | null
  heritage: Array<{ table: string; lien: string }> | null
  regles_sur_la_table: number
  cles_etrangeres: Array<{ contrainte: string; vers: string; suppression: string; mise_a_jour: string }> | null
  empreinte_next_doc_number: string | null
  declencheurs: EntreeDeclencheur[] | null
  droits: Array<{ role: string; select: boolean; insert: boolean; update: boolean; delete: boolean; truncate: boolean }>
}

const parTexte = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
const PREFIXE_BILAN = 'BILAN (tout est annulé) : '

/** Corps de déclencheur qui impose à la ligne écrite le rôle qu'un client a choisi (table relais essai_consigne). */
const IMPOSE_LE_ROLE =
  'NEW.role := coalesce((SELECT c.role FROM public.essai_consigne c WHERE c.company_id = NEW.company_id LIMIT 1), NEW.role);'

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
// de la table : contrôle des membres d'équipe). La fonction de date est celle de 048, sans SECURITY DEFINER, avec le
// SET search_path de la 071 (lecture du 17/11/2026 : voir DECLENCHEURS_LUS_EN_PRODUCTION).
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
CREATE FUNCTION public.update_pro_team_updated_at() RETURNS trigger LANGUAGE plpgsql
  SET search_path = pg_catalog, public AS $$
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

/** next_doc_number tel que la partie 1 le rend en production (SECURITY DEFINER, exécutable par les clients, ni fonction
 *  de déclencheur ni SQL dynamique). */
const NEXT_DOC_NUMBER = 'next_doc_number(uuid,text,integer) true true false false'

/** Dépôt : 048 telle quelle, puis les quatre ALTER POLICY de 20260610 sur pro_team_members. */
function depotSql(): string {
  const alters = lireMigrationQr('20260610_rls_initplan_wrap.sql')
    .match(/^ALTER POLICY "pro_team_(?:select|insert|update|delete)" ON public\.pro_team_members [^\n]*;$/gm)
  if (alters?.length !== 4) throw new Error('ALTER POLICY de 20260610 sur pro_team_members introuvables : relire le banc')
  return `${lireMigrationQr('048_pro_team_rbac.sql')}\n${alters.join('\n')}\n`
}

const ETATS = [
  { nom: 'production (constats des 14, 15 et 17/11/2026)', sql: () => PRODUCTION_SQL, depot: false, fonctionsCitantes: [NEXT_DOC_NUMBER] },
  { nom: 'dépôt (048, 20260610)', sql: depotSql, depot: true, fonctionsCitantes: [] as string[] },
]
/**
 * Déclencheurs attendus sur la table, les mêmes dans les deux états (048) : celui de date seul, BEFORE UPDATE, par
 * ligne (type 19). Sa fonction diffère : avec le SET search_path de la 071 en production, sans dans le dépôt, où elle
 * sert aussi trg_pro_perms_updated_at (pro_role_permissions, hors de la liste de la table).
 */
const DECLENCHEURS = [{ nom: 'trg_pro_team_updated_at', fonction: 'update_pro_team_updated_at()', type: 19 }]
/** Le déclencheur attendu, que les essais remplacent, recréent ou désactivent. */
const [DECLENCHEUR] = DECLENCHEURS
/**
 * « declencheurs » lu en production le 17/11/2026 vers 12:00 UTC (requête à part, même calcul que la partie 1 ;
 * PostgreSQL 17.6, search_path de l'éditeur SQL, où public est visible) : l'état « production » doit le rendre au
 * caractère près (PGlite, PostgreSQL 18.6, le reproduit ; un changement de format de PGlite fait échouer le test).
 */
const DECLENCHEURS_LUS_EN_PRODUCTION: EntreeDeclencheur[] = [{
  nom: 'trg_pro_team_updated_at', fonction: 'update_pro_team_updated_at()', type: 19, actif: 'O',
  empreinte: '40588a5266ec', empreinte_declencheur: 'cabcbdb0ce56',
}]

/** Fonctions d'une liste de la partie 1, en « nom security_definer executable_par_les_clients fonction_de_declencheur
 *  sql_dynamique », triées. */
const resume = (liste: FonctionCitee[] | null) => (liste ?? [])
  .map((f) => `${f.fonction} ${f.security_definer} ${f.executable_par_les_clients} ${f.fonction_de_declencheur} ${f.sql_dynamique}`)
  .sort(parTexte)

/**
 * Fonctions d'essai posées avant la migration : définition (après « CREATE FUNCTION public. »), droit d'exécution
 * retiré, résumé attendu, et si le motif d'écriture doit la retenir (sinon, elle n'est que dans les fonctions qui citent
 * la table). Aucun client ne l'exécute, ou anon seul, ou authenticated seul : ces deux derniers comptent comme
 * exécutables par les clients.
 */
const FONCTIONS_ESSAI: Array<{ definition: string; retirer?: string; resume: string; ecrit: boolean }> = [
  { definition: `essai_ecrit_sql(c uuid) RETURNS void LANGUAGE sql
      AS $$ INSERT INTO public.pro_team_members (company_id, email, role) VALUES (c, 'x@exemple.test', 'OUVRIER') $$`,
    resume: 'essai_ecrit_sql(uuid) false true false false', ecrit: true },
  { definition: `essai_ecrit_dynamique(c uuid) RETURNS void LANGUAGE plpgsql
      AS $$ BEGIN EXECUTE format('DELETE FROM public.%I WHERE company_id = $1', 'pro_team_members') USING c; END $$`,
    resume: 'essai_ecrit_dynamique(uuid) false true false true', ecrit: false },
  { definition: `essai_ecrit_atomique(c uuid) RETURNS void LANGUAGE sql SECURITY DEFINER
      BEGIN ATOMIC DELETE FROM public.pro_team_members WHERE company_id = c; END`,
    retirer: 'PUBLIC, anon, authenticated', resume: 'essai_ecrit_atomique(uuid) true false false false', ecrit: true },
  { definition: `essai_ecrit_merge(c uuid) RETURNS void LANGUAGE plpgsql
      AS $$ BEGIN MERGE INTO "public"."pro_team_members" t USING (SELECT c AS id) s ON t.company_id = s.id
                  WHEN MATCHED THEN DELETE; END $$`,
    retirer: 'PUBLIC, authenticated', resume: 'essai_ecrit_merge(uuid) false true false false', ecrit: true },
  { definition: `essai_ecrit_vidage() RETURNS void LANGUAGE sql AS $$ TRUNCATE TABLE ${TABLE} $$`,
    retirer: 'PUBLIC, anon', resume: 'essai_ecrit_vidage() false true false false', ecrit: true },
  { definition: `essai_ecrit_vidage_court() RETURNS void LANGUAGE sql AS $$ TRUNCATE ${TABLE} $$`,
    resume: 'essai_ecrit_vidage_court() false true false false', ecrit: true },
  { definition: `essai_ecrit_role(c uuid) RETURNS void LANGUAGE sql
      AS $$ UPDATE public.pro_team_members SET role = 'GERANT' WHERE company_id = c $$`,
    resume: 'essai_ecrit_role(uuid) false true false false', ecrit: true },
  { definition: `essai_ecrit_only(c uuid) RETURNS void LANGUAGE sql
      AS $$ DELETE FROM ONLY public.pro_team_members WHERE company_id = c $$`,
    resume: 'essai_ecrit_only(uuid) false true false false', ecrit: true },
  // Deux espaces avant le point, un retour à la ligne indenté après : un motif qui n'admettrait qu'une espace, ou au
  // plus un blanc, de chaque côté du point ne verrait pas ce corps.
  { definition: `essai_ecrit_espaces(c uuid) RETURNS void LANGUAGE sql
      AS $$ INSERT INTO public  .
        pro_team_members (company_id, email, role) VALUES (c, 'y@exemple.test', 'OUVRIER') $$`,
    resume: 'essai_ecrit_espaces(uuid) false true false false', ecrit: true },
]

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

  /** Empreintes qu'affiche la partie 1 (début du SHA-256), calculées ici depuis les définitions lues à part. */
  const hache = (texte: string) => createHash('sha256').update(texte, 'utf8').digest('hex').slice(0, 12)
  const empreinteDe = async (fonction: string) =>
    hache((await db.query<{ def: string }>('SELECT pg_get_functiondef($1::regprocedure) AS def', [fonction])).rows[0].def)
  const empreinteDeclencheurDe = async (nom: string) =>
    hache((await db.query<{ def: string }>(
      `SELECT pg_get_triggerdef(oid) AS def FROM pg_trigger WHERE tgrelid = '${TABLE}'::regclass AND tgname = $1`,
      [nom])).rows[0].def)

  /** Entrée de « declencheurs » attendue pour un déclencheur de la table, empreintes calculées ici. */
  const entreeDeclencheur = async (nom: string, fonction: string, type: number, actif = 'O'): Promise<EntreeDeclencheur> =>
    ({ nom, fonction, type, actif, empreinte: await empreinteDe(fonction), empreinte_declencheur: await empreinteDeclencheurDe(nom) })

  /** declencheurs attendu : ceux de DECLENCHEURS (le déclencheur de date), empreintes calculées dans l'état présent. */
  const declencheursAttendus = () => Promise.all(DECLENCHEURS.map((d) => entreeDeclencheur(d.nom, d.fonction, d.type)))

  /** Recrée le déclencheur attendu sous le même nom et sur la même fonction : moment, clause WHEN et arguments donnés. */
  const recreeDeclencheurAttendu = (moment: string, quand = '', args = '') => db.exec(
    `DROP TRIGGER ${DECLENCHEUR.nom} ON ${TABLE};
     CREATE TRIGGER ${DECLENCHEUR.nom} ${moment} ON ${TABLE}
       FOR EACH ROW ${quand} EXECUTE FUNCTION public.${DECLENCHEUR.fonction.replace('()', `(${args})`)}`)

  /** Partie 1 sans la liste des déclencheurs : ce qui doit rester identique quand seul un déclencheur change. */
  const sansDeclencheurs = (e: EtatTable): EtatTable => ({ ...e, declencheurs: null })

  /** Table relais que les clients écrivent : le gérant y choisit le rôle « GERANT » pour sa société. */
  async function poseConsigne() {
    await db.exec('CREATE TABLE public.essai_consigne (company_id uuid, role text)')
    const consigne = await sousRole(db, 'authenticated', comptes.gerant,
      `INSERT INTO public.essai_consigne (company_id, role) VALUES ($1, 'GERANT')`, [comptes.gerant])
    expect(consigne.erreur).toBeNull()
  }

  /**
   * Remplace sous le même nom (CREATE OR REPLACE) la fonction du déclencheur attendu : elle date la ligne, et impose le
   * rôle. Dans l'état « dépôt », elle sert aussi trg_pro_perms_updated_at : aucun essai n'écrit ensuite
   * pro_role_permissions (qui n'a pas de colonne role).
   */
  const remplaceFonctionAttendue = () => db.exec(`CREATE OR REPLACE FUNCTION public.${DECLENCHEUR.fonction} RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      NEW.updated_at = now();
      ${IMPOSE_LE_ROLE}
      RETURN NEW;
    END $$`)

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
      expect([e.fonctions_ecrivant_la_table, e.vues, e.heritage, e.cles_etrangeres]).toEqual([null, null, null, null])
      expect(resume(e.fonctions_citant_la_table)).toEqual(fonctionsCitantes)
      expect(Number(e.regles_sur_la_table)).toBe(0)
      expect(e.declencheurs).toEqual(await declencheursAttendus())
      // Ni définition ni arguments (un webhook Supabase y place ses en-têtes) : des noms, des codes et des empreintes.
      for (const d of e.declencheurs ?? []) expect(Object.keys(d).sort(parTexte)).toEqual(CHAMPS_DECLENCHEUR)
      expect(e.proprietaire).toBe('postgres')
      // Aucune clé étrangère vers les comptes (production comme dépôt) : l'insertion pour soi passe.
      expect(await bilanDuScenario(db, SCENARIO.test)).toBe('ÉCHEC 2 : ligne créée par une session navigateur')
      expect(await nombreDeLignes()).toBe(3)
    })

    it('la partie 1 repère les fonctions qui écrivent la table (INSERT, UPDATE, DELETE, ONLY, MERGE, TRUNCATE avec ou sans TABLE, schéma entre guillemets ou entouré de blancs : deux espaces avant le point, un retour à la ligne après), le SQL dynamique, et n’en sort aucun corps', async () => {
      for (const f of FONCTIONS_ESSAI) {
        await db.exec(`CREATE FUNCTION public.${f.definition}`)
        if (f.retirer) await db.exec(`REVOKE EXECUTE ON FUNCTION public.${f.resume.split(' ')[0]} FROM ${f.retirer}`)
      }
      const e = await etat()
      expect(resume(e.fonctions_ecrivant_la_table))
        .toEqual(FONCTIONS_ESSAI.filter((f) => f.ecrit).map((f) => f.resume).sort(parTexte))
      expect(resume(e.fonctions_citant_la_table))
        .toEqual([...fonctionsCitantes, ...FONCTIONS_ESSAI.map((f) => f.resume)].sort(parTexte))
      for (const f of [...(e.fonctions_citant_la_table ?? []), ...(e.fonctions_ecrivant_la_table ?? [])]) {
        expect(Object.keys(f).sort(parTexte), f.fonction).toEqual(CHAMPS_FONCTION)
      }
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
      expect([Number(e.policies_ecriture), Number(e.regles_sur_la_table)]).toEqual([0, 0])
      expect([e.fonctions_ecrivant_la_table, e.vues, e.heritage, e.cles_etrangeres]).toEqual([null, null, null, null])
      // Empreinte du corps de next_doc_number : présente en production, absente du dépôt (048 seule).
      expect(e.empreinte_next_doc_number === null).toBe(depot)
      expect(resume(e.fonctions_citant_la_table)).toEqual(fonctionsCitantes)
      expect(e.declencheurs).toEqual(await declencheursAttendus())
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

    /** Action d'un contournement : rattache en GERANT le compte de la ligne écrite (NEW), dans la société de ce compte. */
    const rattacherEnGerant = (email: string) =>
      `INSERT INTO ${TABLE} (company_id, user_id, email, role) VALUES (NEW.company_id, NEW.user_id, '${email}', 'GERANT')`
    const RELAIS = 'CREATE TABLE public.essai_relais (company_id uuid, user_id uuid)'

    /**
     * Contournements qu'un propriétaire de la base poserait à la main après la migration : les actions d'une vue sans
     * security_invoker, d'une règle (même sur une vue security_invoker), d'un déclencheur SECURITY DEFINER ou d'une clé
     * étrangère à action s'exécutent avec les droits de leur propriétaire, et une requête héritée n'est vérifiée que sur
     * la table mère : donc malgré les droits retirés aux clients. La partie 1 doit montrer chacun (d'où vues,
     * fonctions_ecrivant_la_table, heritage et cles_etrangeres attendus à null) : `vu` lit ce qu'elle en dit,
     * `attendu` est ce qu'elle doit en dire.
     */
    const CONTOURNEMENTS: Array<{
      cas: string
      poser: string[]
      ecrire: () => Promise<ResultatAppel>
      ecrit: () => Promise<void>
      vu: (e: EtatTable) => unknown
      attendu: unknown
    }> = [
      {
        cas: 'vue sans security_invoker',
        poser: [`CREATE VIEW public.essai_vue_equipe AS SELECT * FROM ${TABLE}`],
        ecrire: () => sousRole(db, 'authenticated', comptes.gerant,
          `INSERT INTO public.essai_vue_equipe (company_id, user_id, email, role) VALUES ($1, $2, 'vue@exemple.test', 'OUVRIER')`,
          [comptes.gerant, comptes.etranger]),
        ecrit: async () => { expect(await nombreDeLignes()).toBe(4) },
        vu: (e) => e.vues,
        attendu: [{ vue: 'essai_vue_equipe', type: 'v', security_invoker: false, regle_d_ecriture: false }],
      },
      {
        // ON INSERT … DO INSTEAD, sur une table que les clients écrivent.
        cas: 'règle INSERT d’une table relais',
        poser: [RELAIS, `CREATE RULE essai_relais_ecrit AS ON INSERT TO public.essai_relais
          DO INSTEAD ${rattacherEnGerant('relais@exemple.test')}`],
        ecrire: () => sousRole(db, 'authenticated', comptes.etranger,
          'INSERT INTO public.essai_relais (company_id, user_id) VALUES ($1, $1)', [comptes.etranger]),
        ecrit: async () => { expect(await nombreDeLignes()).toBe(4) },
        vu: (e) => e.vues,
        attendu: [{ vue: 'essai_relais', type: 'r', security_invoker: false, regle_d_ecriture: true }],
      },
      {
        // ON INSERT … DO INSTEAD, sur une vue security_invoker (sans effet sur les actions d'une règle).
        cas: 'règle INSERT d’une vue security_invoker',
        poser: [
          RELAIS,
          'CREATE VIEW public.essai_vue_relais WITH (security_invoker = true) AS SELECT company_id, user_id FROM public.essai_relais',
          `CREATE RULE essai_vue_relais_ecrit AS ON INSERT TO public.essai_vue_relais
            DO INSTEAD ${rattacherEnGerant('vue-relais@exemple.test')}`,
        ],
        ecrire: () => sousRole(db, 'authenticated', comptes.autreSociete,
          'INSERT INTO public.essai_vue_relais (company_id, user_id) VALUES ($1, $1)', [comptes.autreSociete]),
        ecrit: async () => { expect(await nombreDeLignes()).toBe(4) },
        vu: (e) => e.vues,
        attendu: [{ vue: 'essai_vue_relais', type: 'v', security_invoker: true, regle_d_ecriture: true }],
      },
      {
        // ON UPDATE … DO ALSO, sur une table relais : passe l'invitation en GERANT, ce que l'UPDATE direct ne peut plus.
        cas: 'règle UPDATE d’une table relais',
        poser: [
          'CREATE TABLE public.essai_relais_maj (id uuid)',
          `INSERT INTO public.essai_relais_maj (id) SELECT id FROM ${TABLE} WHERE invite_token IS NOT NULL`,
          `CREATE RULE essai_relais_maj_ecrit AS ON UPDATE TO public.essai_relais_maj
            DO ALSO UPDATE ${TABLE} SET role = 'GERANT' WHERE id = OLD.id`,
        ],
        ecrire: () => sousRole(db, 'authenticated', comptes.gerant, 'UPDATE public.essai_relais_maj SET id = id'),
        ecrit: async () => { expect((await lireLigne(lignes.invitation)).role).toBe('GERANT') },
        vu: (e) => e.vues,
        attendu: [{ vue: 'essai_relais_maj', type: 'r', security_invoker: false, regle_d_ecriture: true }],
      },
      {
        // Fonction que les clients n'exécutent pas : le droit EXECUTE n'est pas vérifié quand le déclencheur part.
        cas: 'déclencheur SECURITY DEFINER',
        poser: [
          'CREATE TABLE public.essai_source (company_id uuid, user_id uuid)',
          `CREATE FUNCTION public.essai_declencheur_ecrit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
            AS $$ BEGIN ${rattacherEnGerant('declencheur@exemple.test')}; RETURN NEW; END $$`,
          'REVOKE EXECUTE ON FUNCTION public.essai_declencheur_ecrit() FROM PUBLIC, anon, authenticated',
          `CREATE TRIGGER essai_declencheur AFTER INSERT ON public.essai_source
            FOR EACH ROW EXECUTE FUNCTION public.essai_declencheur_ecrit()`,
        ],
        ecrire: () => sousRole(db, 'authenticated', comptes.etranger,
          'INSERT INTO public.essai_source (company_id, user_id) VALUES ($1, $1)', [comptes.etranger]),
        ecrit: async () => { expect(await nombreDeLignes()).toBe(4) },
        vu: (e) => [resume(e.fonctions_ecrivant_la_table), resume(e.fonctions_citant_la_table), e.vues],
        attendu: [
          ['essai_declencheur_ecrit() true false true false'],
          [...fonctionsCitantes, 'essai_declencheur_ecrit() true false true false'].sort(parTexte),
          null,
        ],
      },
      {
        // ON DELETE … DO ALSO, sur une table relais : supprime le membre, ce que le DELETE direct ne peut plus.
        cas: 'règle DELETE d’une table relais',
        poser: [
          'CREATE TABLE public.essai_relais_suppr (id uuid)',
          `INSERT INTO public.essai_relais_suppr (id) SELECT id FROM ${TABLE} WHERE role = 'OUVRIER'`,
          `CREATE RULE essai_relais_suppr_ecrit AS ON DELETE TO public.essai_relais_suppr
            DO ALSO DELETE FROM ${TABLE} WHERE id = OLD.id`,
        ],
        ecrire: () => sousRole(db, 'authenticated', comptes.etranger, 'DELETE FROM public.essai_relais_suppr'),
        ecrit: async () => { expect(await lireLigne(lignes.membre)).toBeUndefined() },
        vu: (e) => e.vues,
        attendu: [{ vue: 'essai_relais_suppr', type: 'r', security_invoker: false, regle_d_ecriture: true }],
      },
      {
        // Une table fille que les clients écrivent : ses lignes sont lues comme des lignes de la table, par le serveur
        // (service_role) comme par une requête sans ONLY.
        cas: 'table fille (INHERITS)',
        poser: [`CREATE TABLE public.essai_enfant () INHERITS (${TABLE})`],
        ecrire: () => sousRole(db, 'authenticated', comptes.etranger,
          `INSERT INTO public.essai_enfant (company_id, user_id, email, role) VALUES ($1, $2, 'enfant@exemple.test', 'GERANT')`,
          [comptes.gerant, comptes.etranger]),
        ecrit: async () => {
          const lu = await sousRole(db, 'service_role', null, `SELECT role FROM ${TABLE} WHERE user_id = $1`, [comptes.etranger])
          expect(lu.lignes).toEqual([{ role: 'GERANT' }])
        },
        vu: (e) => e.heritage,
        attendu: [{ table: 'essai_enfant', lien: 'enfant' }],
      },
      {
        // Une requête héritée n'est vérifiée que sur la table mère : ses droits et sa RLS, pas ceux de la table.
        cas: 'table mère (INHERIT)',
        poser: ['CREATE TABLE public.essai_mere (id uuid, role text)', `ALTER TABLE ${TABLE} INHERIT public.essai_mere`],
        ecrire: () => sousRole(db, 'authenticated', comptes.etranger,
          `UPDATE public.essai_mere SET role = 'GERANT' WHERE id = $1`, [lignes.invitation]),
        ecrit: async () => { expect((await lireLigne(lignes.invitation)).role).toBe('GERANT') },
        vu: (e) => e.heritage,
        attendu: [{ table: 'essai_mere', lien: 'parente' }],
      },
      {
        // Même principe pour une table partitionnée dont la table devient la partition par défaut ; un INSERT par la
        // table partitionnée est en plus routé vers la table : un compte étranger s'y inscrit GERANT.
        cas: 'partition rattachée (ATTACH PARTITION)',
        poser: [
          `CREATE TABLE public.essai_partitionnee (LIKE ${TABLE} INCLUDING DEFAULTS) PARTITION BY LIST (role)`,
          `ALTER TABLE public.essai_partitionnee ATTACH PARTITION ${TABLE} DEFAULT`,
        ],
        ecrire: () => sousRole(db, 'authenticated', comptes.etranger,
          `INSERT INTO public.essai_partitionnee (company_id, user_id, email, role) VALUES ($1, $2, 'partition@exemple.test', 'GERANT')`,
          [comptes.gerant, comptes.etranger]),
        ecrit: async () => {
          const { rows } = await db.query<{ role: string }>(`SELECT role FROM ONLY ${TABLE} WHERE user_id = $1`, [comptes.etranger])
          expect(rows).toEqual([{ role: 'GERANT' }])
        },
        vu: (e) => e.heritage,
        attendu: [{ table: 'essai_partitionnee', lien: 'parente' }],
      },
      {
        // L'action référentielle s'exécute avec les droits du propriétaire ; ses déclencheurs, internes, ne sont pas
        // dans « declencheurs » (vérifié pour chaque contournement).
        cas: 'clé étrangère ON DELETE CASCADE',
        poser: [
          'CREATE TABLE public.essai_societes (id uuid PRIMARY KEY)',
          `INSERT INTO public.essai_societes (id) SELECT DISTINCT company_id FROM ${TABLE}`,
          `ALTER TABLE ${TABLE} ADD CONSTRAINT essai_societe_fk FOREIGN KEY (company_id)
            REFERENCES public.essai_societes (id) ON DELETE CASCADE`,
        ],
        ecrire: () => sousRole(db, 'authenticated', comptes.etranger,
          'DELETE FROM public.essai_societes WHERE id = $1', [comptes.gerant]),
        ecrit: async () => { expect(await nombreDeLignes()).toBe(0) },
        vu: (e) => e.cles_etrangeres,
        attendu: [{ contrainte: 'essai_societe_fk', vers: 'essai_societes', suppression: 'c', mise_a_jour: 'a' }],
      },
      {
        // Même sans action, un TRUNCATE … CASCADE de la table référencée vide la table ; lancé par une fonction SECURITY
        // DEFINER qui ne nomme pas la table, il n'apparaît dans aucune liste de fonctions : seule la clé le trahit.
        cas: 'clé étrangère sans action, TRUNCATE … CASCADE',
        poser: [
          'CREATE TABLE public.essai_societes (id uuid PRIMARY KEY)',
          `INSERT INTO public.essai_societes (id) SELECT DISTINCT company_id FROM ${TABLE}`,
          `ALTER TABLE ${TABLE} ADD CONSTRAINT essai_societe_fk FOREIGN KEY (company_id) REFERENCES public.essai_societes (id)`,
          `CREATE FUNCTION public.essai_vider_societes() RETURNS void LANGUAGE sql SECURITY DEFINER
            AS $$ TRUNCATE public.essai_societes CASCADE $$`,
        ],
        ecrire: () => sousRole(db, 'authenticated', comptes.etranger, 'SELECT public.essai_vider_societes()'),
        ecrit: async () => { expect(await nombreDeLignes()).toBe(0) },
        vu: (e) => [e.cles_etrangeres, resume(e.fonctions_citant_la_table)],
        attendu: [[{ contrainte: 'essai_societe_fk', vers: 'essai_societes', suppression: 'a', mise_a_jour: 'a' }], fonctionsCitantes],
      },
    ]

    it.each(CONTOURNEMENTS)('contournement posé à la main, $cas : le client écrit quand même, la partie 1 le montre',
      async ({ poser, ecrire, ecrit, vu, attendu }) => {
        for (const instruction of poser) await db.exec(instruction)
        expect((await ecrire()).erreur).toBeNull()
        await ecrit()
        const e = await etat()
        expect(vu(e)).toEqual(attendu)
        // Aucun ne touche aux déclencheurs de la table (ceux d'une clé étrangère sont internes) : leur liste reste
        // l'attendue.
        expect(e.declencheurs).toEqual(await declencheursAttendus())
      })

    it('security_invoker est lu à sa valeur, seul parmi les options de la vue : 1 le rend vrai (un client n’écrit pas par la vue, 42501), off faux, security_barrier ne compte pas', async () => {
      // PostgreSQL garde l'option telle qu'elle est écrite (security_invoker=1) : seule sa conversion en booléen la lit.
      for (const [vue, options] of [['un', 'security_invoker = 1'], ['off', 'security_invoker = off'],
        ['barriere', 'security_barrier'], ['deux', 'security_barrier, security_invoker = on']]) {
        await db.exec(`CREATE VIEW public.essai_vue_${vue} WITH (${options}) AS SELECT * FROM ${TABLE}`)
      }
      const parLaVue = await sousRole(db, 'authenticated', comptes.gerant,
        `INSERT INTO public.essai_vue_un (company_id, email, role) VALUES ($1, 'un@exemple.test', 'OUVRIER')`, [comptes.gerant])
      expect(parLaVue.erreur?.code).toBe('42501')
      await rienNAChange()
      const lues = ((await etat()).vues ?? []).map((v) => [v.vue, v.type, v.security_invoker, v.regle_d_ecriture])
      expect(lues).toEqual([
        ['essai_vue_barriere', 'v', false, false],
        ['essai_vue_deux', 'v', true, false],
        ['essai_vue_off', 'v', false, false],
        ['essai_vue_un', 'v', true, false],
      ])
    })

    it('un droit rendu sur une seule colonne (lecture, insertion, modification) se voit dans « droits » ; sans policy d’écriture, la RLS le neutralise', async () => {
      await db.exec(`REVOKE SELECT ON ${TABLE} FROM anon`)
      await db.exec(`GRANT SELECT (id), INSERT (email) ON ${TABLE} TO anon`)
      await db.exec(`GRANT UPDATE (role) ON ${TABLE} TO authenticated`)
      const droits = (await etat()).droits
      expect(droits.find((d) => d.role === 'anon'))
        .toEqual({ role: 'anon', select: true, insert: true, update: false, delete: false, truncate: false })
      expect(droits.find((d) => d.role === 'authenticated'))
        .toEqual({ role: 'authenticated', select: true, insert: false, update: true, delete: false, truncate: false })
      const maj = await sousRole(db, 'authenticated', comptes.gerant,
        `UPDATE ${TABLE} SET role = 'GERANT' WHERE id = $1`, [lignes.invitation])
      expect([maj.erreur, maj.nb]).toEqual([null, 0])
      await rienNAChange()
    })

    it('les clés étrangères de la table sortent toutes, avec leurs codes d’action (aucune, set null, set default…)', async () => {
      await db.exec(`CREATE TABLE public.essai_societes (id uuid PRIMARY KEY);
        CREATE TABLE public.essai_comptes (id uuid PRIMARY KEY);
        INSERT INTO public.essai_societes (id) SELECT DISTINCT company_id FROM ${TABLE};
        INSERT INTO public.essai_comptes (id) SELECT DISTINCT user_id FROM ${TABLE} WHERE user_id IS NOT NULL;
        ALTER TABLE ${TABLE} ADD CONSTRAINT essai_fk_aucune FOREIGN KEY (company_id) REFERENCES public.essai_societes (id);
        ALTER TABLE ${TABLE} ADD CONSTRAINT essai_fk_sans_compte FOREIGN KEY (user_id) REFERENCES public.essai_comptes (id)
          ON UPDATE SET NULL ON DELETE SET DEFAULT`)
      expect((await etat()).cles_etrangeres).toEqual([
        { contrainte: 'essai_fk_aucune', vers: 'essai_societes', suppression: 'a', mise_a_jour: 'a' },
        { contrainte: 'essai_fk_sans_compte', vers: 'essai_comptes', suppression: 'd', mise_a_jour: 'n' },
      ])
    })

    it.runIf(!depot)('empreinte_next_doc_number : 12 caractères hexadécimaux, qui changent avec le corps de la fonction', async () => {
      const avant = (await etat()).empreinte_next_doc_number
      expect(avant).toMatch(/^[0-9a-f]{12}$/)
      await db.exec(`CREATE OR REPLACE FUNCTION public.next_doc_number(p_artisan_id uuid, p_doc_type text, p_annee integer)
        RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
        AS $$ BEGIN RETURN p_doc_type || '-' || p_annee || '-002'; END; $$`)
      const apres = (await etat()).empreinte_next_doc_number
      expect(apres).toMatch(/^[0-9a-f]{12}$/)
      expect(apres).not.toBe(avant)
    })

    it('une règle posée sur la table elle-même est comptée à part (d’où « regles_sur_la_table » attendu à 0)', async () => {
      await db.exec(`CREATE RULE essai_regle_equipe AS ON DELETE TO ${TABLE} DO INSTEAD NOTHING`)
      const e = await etat()
      expect([Number(e.regles_sur_la_table), e.vues]).toEqual([1, null])
    })

    it.runIf(!depot)('état « production » (lecture du 17/11/2026) : la partie 1 y rend exactement les déclencheurs lus en production, empreintes réelles 40588a5266ec et cabcbdb0ce56 comprises (cet état reproduit la production au caractère près ; après une montée de version de PGlite, un écart est à relire)', async () => {
      expect((await etat()).declencheurs).toEqual(DECLENCHEURS_LUS_EN_PRODUCTION)
    })

    it('un déclencheur posé à la main sur la table (BEFORE INSERT), dont la fonction ne nomme pas la table, impose aux invitations du serveur un rôle lu dans une table que les clients écrivent : seule la liste « declencheurs » le montre (d’où son attendu)', async () => {
      const reference = await etat()
      await poseConsigne()
      await db.exec(`CREATE FUNCTION public.essai_role_impose() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          ${IMPOSE_LE_ROLE}
          RETURN NEW;
        END $$`)
      await db.exec(`CREATE TRIGGER essai_role_impose BEFORE INSERT ON ${TABLE}
        FOR EACH ROW EXECUTE FUNCTION public.essai_role_impose()`)
      // La route serveur invite un ouvrier : la ligne est enregistrée gérant.
      const invite = await sousRole(db, 'service_role', null,
        `INSERT INTO ${TABLE} (company_id, email, role) VALUES ($1, 'consigne@exemple.test', 'OUVRIER') RETURNING role`,
        [comptes.gerant])
      expect([invite.erreur, invite.lignes]).toEqual([null, [{ role: 'GERANT' }]])
      const e = await etat()
      // Tous les autres champs gardent leur valeur.
      expect(sansDeclencheurs(e)).toEqual(sansDeclencheurs(reference))
      // BEFORE INSERT, par ligne : type 7 (1 + 2 + 4).
      expect(e.declencheurs).toEqual([
        await entreeDeclencheur('essai_role_impose', 'essai_role_impose()', 7),
        ...await declencheursAttendus(),
      ])
    })

    it('la fonction du déclencheur attendu remplacée sous le même nom (CREATE OR REPLACE), qui lit le rôle dans une table que les clients écrivent : la route serveur qui accepte une invitation lui donne ce rôle ; dans la partie 1, seule l’empreinte de sa fonction change (d’où son attendu)', async () => {
      const reference = await etat()
      const [attendu] = await declencheursAttendus()
      await poseConsigne()
      await remplaceFonctionAttendue()
      // La route serveur accepte l'invitation (chef de chantier) : la ligne devient celle d'un gérant.
      const accepte = await sousRole(db, 'service_role', null,
        `UPDATE ${TABLE} SET user_id = $1, accepted_at = now(), invite_token = NULL WHERE id = $2 RETURNING role`,
        [comptes.etranger, lignes.invitation])
      expect([accepte.erreur, accepte.lignes]).toEqual([null, [{ role: 'GERANT' }]])
      const e = await etat()
      expect(sansDeclencheurs(e)).toEqual(sansDeclencheurs(reference))
      expect(e.declencheurs).toEqual([{ ...attendu, empreinte: await empreinteDe(DECLENCHEUR.fonction) }])
      expect(e.declencheurs?.[0].empreinte).not.toBe(attendu.empreinte)
    })

    it('le déclencheur attendu recréé sous le même nom pour les insertions aussi (BEFORE INSERT OR UPDATE), sur sa fonction remplacée : les invitations de la route serveur reçoivent le rôle choisi par un client ; dans la partie 1, son type passe de 19 à 23', async () => {
      const reference = await etat()
      await poseConsigne()
      await remplaceFonctionAttendue()
      await recreeDeclencheurAttendu('BEFORE INSERT OR UPDATE')
      const invite = await sousRole(db, 'service_role', null,
        `INSERT INTO ${TABLE} (company_id, email, role) VALUES ($1, 'recree@exemple.test', 'OUVRIER') RETURNING role`,
        [comptes.gerant])
      expect([invite.erreur, invite.lignes]).toEqual([null, [{ role: 'GERANT' }]])
      const e = await etat()
      expect(sansDeclencheurs(e)).toEqual(sansDeclencheurs(reference))
      // 23 = 1 (par ligne) + 2 (BEFORE) + 4 (INSERT) + 16 (UPDATE).
      expect(e.declencheurs).toEqual([await entreeDeclencheur(DECLENCHEUR.nom, DECLENCHEUR.fonction, 23)])
      expect(e.declencheurs?.[0].empreinte_declencheur).not.toBe(reference.declencheurs?.[0].empreinte_declencheur)
    })

    it('la fonction du déclencheur attendu dotée d’un SET search_path qui place un schéma avant pg_catalog : son now() devient celui de ce schéma, à chaque modification du serveur ; dans la partie 1, seule son empreinte change', async () => {
      const reference = await etat()
      await db.exec(`CREATE SCHEMA essai_piege;
        CREATE TABLE essai_piege.journal (vu timestamptz);
        CREATE FUNCTION essai_piege.now() RETURNS timestamptz LANGUAGE sql
          AS $$ INSERT INTO essai_piege.journal VALUES (pg_catalog.now()) RETURNING '2000-01-01 00:00:00+00'::timestamptz $$;
        GRANT USAGE ON SCHEMA essai_piege TO service_role;
        GRANT INSERT, SELECT ON essai_piege.journal TO service_role`)
      await db.exec(`ALTER FUNCTION public.${DECLENCHEUR.fonction} SET search_path = essai_piege, pg_catalog`)
      const maj = await sousRole(db, 'service_role', null,
        `UPDATE ${TABLE} SET full_name = 'Membre Renommé' WHERE id = $1
         RETURNING updated_at = '2000-01-01 00:00:00+00'::timestamptz AS date_piegee`, [lignes.membre])
      expect([maj.erreur, maj.lignes]).toEqual([null, [{ date_piegee: true }]])
      expect(Number((await db.query<{ n: number }>('SELECT count(*)::int AS n FROM essai_piege.journal')).rows[0].n)).toBe(1)
      const e = await etat()
      expect(sansDeclencheurs(e)).toEqual(sansDeclencheurs(reference))
      const [avant] = reference.declencheurs ?? []
      expect(e.declencheurs).toEqual([{ ...avant, empreinte: await empreinteDe(DECLENCHEUR.fonction) }])
      expect(e.declencheurs?.[0].empreinte).not.toBe(avant.empreinte)
    })

    // Changements du déclencheur attendu qui ne touchent pas au corps de sa fonction : chacun ne change que son champ.
    const CHANGEMENTS_SANS_CORPS: Array<{ cas: string; poser: () => Promise<unknown>; champ: keyof EntreeDeclencheur; type: number; actif: string }> = [
      { cas: 'sa fonction passée dans l’autre mode (SECURITY DEFINER ou INVOKER)', champ: 'empreinte', type: 19, actif: 'O',
        poser: async () => {
          const { rows } = await db.query<{ definer: boolean }>(
            'SELECT prosecdef AS definer FROM pg_proc WHERE oid = $1::regprocedure', [DECLENCHEUR.fonction])
          await db.exec(`ALTER FUNCTION public.${DECLENCHEUR.fonction} ${rows[0].definer ? 'SECURITY INVOKER' : 'SECURITY DEFINER'}`)
        } },
      { cas: 'recréé pour les seules modifications du rôle (UPDATE OF role)', champ: 'empreinte_declencheur', type: 19, actif: 'O',
        poser: () => recreeDeclencheurAttendu('BEFORE UPDATE OF role') },
      { cas: 'recréé avec une clause WHEN', champ: 'empreinte_declencheur', type: 19, actif: 'O',
        poser: () => recreeDeclencheurAttendu('BEFORE UPDATE', 'WHEN (OLD.role IS DISTINCT FROM NEW.role)') },
      { cas: 'recréé avec un argument', champ: 'empreinte_declencheur', type: 19, actif: 'O',
        poser: () => recreeDeclencheurAttendu('BEFORE UPDATE', '', "'essai'") },
      { cas: 'désactivé', champ: 'actif', type: 19, actif: 'D',
        poser: () => db.exec(`ALTER TABLE ${TABLE} DISABLE TRIGGER ${DECLENCHEUR.nom}`) },
    ]

    it.each(CHANGEMENTS_SANS_CORPS)('le déclencheur attendu, $cas, sans toucher au corps de sa fonction : dans la partie 1, seul le champ « $champ » change', async ({ poser, champ, type, actif }) => {
      const reference = await etat()
      await poser()
      const e = await etat()
      expect(sansDeclencheurs(e)).toEqual(sansDeclencheurs(reference))
      const [avant] = reference.declencheurs ?? []
      const [apres] = e.declencheurs ?? []
      expect(apres).toEqual(await entreeDeclencheur(DECLENCHEUR.nom, DECLENCHEUR.fonction, type, actif))
      const champsChanges = (Object.keys(apres) as Array<keyof EntreeDeclencheur>).filter((k) => apres[k] !== avant[k])
      expect(champsChanges).toEqual([champ])
    })

    /** Ce que portent les arguments du webhook d'essai : rien ne doit en sortir, ni de la partie 1 ni de la relecture. */
    const ARGUMENTS_DU_WEBHOOK = /cle-essai-secrete|exemple\.test\/crochet/

    it('un déclencheur de webhook (fonction SECURITY DEFINER hors du schéma public, arguments qui portent une clé) : la partie 1 le montre sans rendre ses arguments, ni dans un champ ajouté ni dans un champ existant, et la requête de relecture de la consigne non plus', async () => {
      const reference = await etat()
      await db.exec(`CREATE SCHEMA essai_webhooks;
        CREATE FUNCTION essai_webhooks.http_request() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN NEW; END $$;
        CREATE TRIGGER essai_webhook AFTER INSERT ON ${TABLE} FOR EACH ROW
          EXECUTE FUNCTION essai_webhooks.http_request('https://exemple.test/crochet', 'POST', '{"Authorization":"Bearer cle-essai-secrete"}')`)
      const e = await etat()
      // AFTER INSERT, par ligne : type 5 (1 + 4).
      expect(e.declencheurs).toEqual([
        await entreeDeclencheur('essai_webhook', 'essai_webhooks.http_request()', 5),
        ...await declencheursAttendus(),
      ])
      // Ni en clair, ni dans un champ ajouté (des arguments en hexadécimal, par exemple), ni collés à la valeur d'un champ
      // existant (le propriétaire, par exemple) : les champs restent ceux attendus, et les autres gardent leur valeur.
      expect(JSON.stringify(e)).not.toMatch(ARGUMENTS_DU_WEBHOOK)
      expect(Object.keys(e).sort(parTexte)).toEqual(CHAMPS_PARTIE_1)
      expect(sansDeclencheurs(e)).toEqual(sansDeclencheurs(reference))
      for (const d of e.declencheurs ?? []) expect(Object.keys(d).sort(parTexte)).toEqual(CHAMPS_DECLENCHEUR)
      // La requête de relecture de la consigne, telle que Frédéric la lance : chaque définition s'arrête à la signature
      // de la fonction, les arguments ne sont jamais affichés.
      const relus = (await db.query<DeclencheurRelu>(RELECTURE_DECLENCHEURS)).rows.toSorted((a, b) => parTexte(a.tgname, b.tgname))
      expect(JSON.stringify(relus)).not.toMatch(ARGUMENTS_DU_WEBHOOK)
      expect(relus).toEqual([
        { tgname: 'essai_webhook', tgtype: 5, tgenabled: 'O', tgnargs: 3, colonnes: '', quand: false,
          definition: `CREATE TRIGGER essai_webhook AFTER INSERT ON ${TABLE} FOR EACH ROW EXECUTE FUNCTION essai_webhooks.http_request()` },
        { tgname: DECLENCHEUR.nom, tgtype: DECLENCHEUR.type, tgenabled: 'O', tgnargs: 0, colonnes: '', quand: false,
          definition: `CREATE TRIGGER ${DECLENCHEUR.nom} BEFORE UPDATE ON ${TABLE} FOR EACH ROW EXECUTE FUNCTION ${DECLENCHEUR.fonction}` },
      ])
    })

    it('témoin des limites : un nom écrit U&"…" dans le corps échappe aux deux listes de fonctions (d’où la consigne : la partie 1 ne prouve pas l’absence d’une écriture cachée)', async () => {
      // \0070 est le « p » de pro_team_members : le corps ne contient pas le nom en toutes lettres.
      await db.exec(`CREATE FUNCTION public.essai_ecrit_cache(c uuid, u uuid) RETURNS void LANGUAGE sql SECURITY DEFINER
        AS $$ INSERT INTO public.U&"\\0070ro_team_members" (company_id, user_id, email, role) VALUES (c, u, 'cache@exemple.test', 'GERANT') $$`)
      const r = await sousRole(db, 'authenticated', comptes.gerant, 'SELECT public.essai_ecrit_cache($1, $2)',
        [comptes.gerant, comptes.etranger])
      expect(r.erreur).toBeNull()
      expect(await nombreDeLignes()).toBe(4)
      const e = await etat()
      expect([resume(e.fonctions_citant_la_table), e.fonctions_ecrivant_la_table]).toEqual([fonctionsCitantes, null])
    })

    it('témoin des limites : une valeur par défaut de colonne qui appelle une fonction (ici le rôle, lu dans une table que les clients écrivent) change les insertions du serveur qui omettent la colonne, et la partie 1 reste identique (d’où la consigne)', async () => {
      const reference = await etat()
      await poseConsigne()
      await db.exec(`CREATE FUNCTION public.essai_role_par_defaut() RETURNS text LANGUAGE sql
        AS $$ SELECT role FROM public.essai_consigne LIMIT 1 $$`)
      await db.exec(`ALTER TABLE ${TABLE} ALTER COLUMN role SET DEFAULT public.essai_role_par_defaut()`)
      const invite = await sousRole(db, 'service_role', null,
        `INSERT INTO ${TABLE} (company_id, email) VALUES ($1, 'defaut@exemple.test') RETURNING role`, [comptes.gerant])
      expect([invite.erreur, invite.lignes]).toEqual([null, [{ role: 'GERANT' }]])
      expect(await etat()).toEqual(reference)
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
