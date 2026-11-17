// @vitest-environment node
// tests/migrations/doc_sequences_lecture_seule.execution.test.ts
//
// Compteurs de numérotation des devis et factures (table doc_sequences) : constats api-coeur-10 et base-de-donnees-9
// de l'audit des fondations BTP du 11/11/2026 (tous les rôles : artisan comme BTP).
//
// EXÉCUTION RÉELLE sur un vrai PostgreSQL (PGlite, en mémoire ; aucune base distante), avec le rôle authenticated et le
// jeton d'une session (request.jwt.claims, comme PostgREST). État de départ : celui des migrations du dépôt
// (20260602 : table, policy sans commande donc valable pour toutes, next_doc_number ; 20260522 : exécution réservée
// aux comptes connectés ; 20260610 : ALTER POLICY). Puis les migrations postérieures du dépôt qui touchent la table,
// jouées deux fois (une migration doit se rejouer).
// - Avant : une session connectée réécrit elle-même son compteur (remise à zéro, recul) : des numéros déjà émis
//   pouvaient être redistribués.
// - Après : lecture de son propre compteur seulement ; les numéros n'avancent que par next_doc_number.
// Comptes fictifs (UUID aléatoires) ; aucune donnée réelle.

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { randomUUID } from 'crypto'
import { ECHAFAUDAGE_SUPABASE_SQL, lireMigrationQr } from '../helpers/pglite-signalements'
import {
  dansPointDeSauvegarde,
  droitsEffectifs,
  migrationSansCommentaires,
  migrationsDansLOrdre,
  sousRole,
} from '../helpers/equipe-ecritures-serveur'

const TABLE = 'public.doc_sequences'
const DERNIERE_REPRISE = '20260610_rls_initplan_wrap.sql'
const MIGRATION = '20261116_doc_sequences_lecture_seule.sql'
const ARRET_ECRITURE_IMPOSSIBLE = /next_doc_number ne pourrait plus écrire/

// auth.uid() de Supabase : le « sub » du jeton de la requête.
const AUTH_UID_SQL = `
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
CREATE TABLE public.pro_team_members (user_id uuid, company_id uuid, is_active boolean NOT NULL DEFAULT true);
`

/** Extrait d'une migration du dépôt, introuvable = banc à relire (la migration a changé). */
function extrait(fichier: string, motif: RegExp): string {
  const trouve = motif.exec(lireMigrationQr(fichier))
  if (!trouve) throw new Error(`${fichier} : extrait ${motif} introuvable, relire le banc`)
  return trouve[0]
}

/** Dépôt : table, policy et fonction de 20260602 (sans l'amorçage, qui lit devis et factures), droits de 20260522, ALTER de 20260610. */
function etatDuDepot(): string {
  const f = '20260602_doc_sequences_create_seed.sql'
  return [
    extrait(f, /CREATE TABLE IF NOT EXISTS doc_sequences \([\s\S]*?\n\);/),
    extrait(f, /ALTER TABLE doc_sequences ENABLE ROW LEVEL SECURITY;/),
    extrait(f, /DROP POLICY IF EXISTS "doc_sequences_owner_access"[\s\S]*?WITH CHECK \(artisan_user_id = auth\.uid\(\)\);/),
    extrait(f, /CREATE OR REPLACE FUNCTION public\.next_doc_number\([\s\S]*?\$function\$;/),
    extrait('20260522_rls_critical_fixes.sql', /REVOKE EXECUTE ON FUNCTION public\.next_doc_number\(uuid, text, integer\) FROM PUBLIC;/),
    extrait('20260522_rls_critical_fixes.sql', /GRANT EXECUTE ON FUNCTION public\.next_doc_number\(uuid, text, integer\) TO authenticated;/),
    extrait(DERNIERE_REPRISE, /ALTER POLICY "doc_sequences_owner_access" ON public\.doc_sequences [^\n]*;/),
  ].join('\n')
}

/** Migrations postérieures du dépôt qui touchent doc_sequences (hors commentaires), dans l'ordre d'application. */
const CORRECTIONS = migrationsDansLOrdre().filter((f) => f > DERNIERE_REPRISE && /\bdoc_sequences\b/.test(migrationSansCommentaires(f)))

describe('compteurs de numérotation (doc_sequences)', () => {
  let db: PGlite
  const comptes = { societe: randomUUID(), autre: randomUUID() }
  const annee = 2026

  beforeAll(async () => {
    db = await PGlite.create()
    await db.exec(ECHAFAUDAGE_SUPABASE_SQL + AUTH_UID_SQL)
    for (const c of Object.values(comptes)) await db.query('INSERT INTO auth.users (id) VALUES ($1)', [c])
    await db.exec(etatDuDepot())
    await db.query(
      `INSERT INTO public.doc_sequences (artisan_user_id, doc_type, year, last_seq) VALUES ($1, 'devis', $3, 37), ($2, 'devis', $3, 12)`,
      [comptes.societe, comptes.autre, annee],
    )
  })
  afterAll(async () => { await db?.close() })
  // Chaque essai dans une transaction annulée ensuite : la base reste dans l'état posé par les beforeAll.
  beforeEach(async () => { await db.exec('BEGIN') })
  afterEach(async () => { await db.exec('ROLLBACK') })

  const compteur = async (compte: string) =>
    (await db.query<{ last_seq: number }>(`SELECT last_seq FROM public.doc_sequences WHERE artisan_user_id = $1 AND doc_type = 'devis'`, [compte])).rows[0]?.last_seq

  it('état du dépôt avant correction : une session connectée réécrit son propre compteur (faille reproduite)', async () => {
    const { valeur } = await dansPointDeSauvegarde(db, async () => {
      const appel = await sousRole(db, 'authenticated', comptes.societe, `UPDATE public.doc_sequences SET last_seq = 0 WHERE doc_type = 'devis'`)
      return appel.nb
    }, false)
    expect(valeur).toBe(1)
    expect(await compteur(comptes.societe)).toBe(37)
  })

  // Garde de la migration : une fois la policy en lecture seule, next_doc_number (SECURITY DEFINER) n'écrit plus dans
  // la table que si son propriétaire échappe à la RLS. Banc exécuté en superutilisateur : les propriétaires sont
  // changés dans la transaction de l'essai, annulée ensuite.
  const policies = async () =>
    (await db.query<{ policyname: string; cmd: string }>(
      `SELECT policyname, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename = 'doc_sequences'`,
    )).rows

  it('migration arrêtée sans rien appliquer quand le propriétaire de next_doc_number est soumis à la RLS', async () => {
    await db.exec(`CREATE ROLE proprietaire_soumis_rls NOLOGIN;
      ALTER FUNCTION public.next_doc_number(uuid, text, integer) OWNER TO proprietaire_soumis_rls`)
    const { erreur } = await dansPointDeSauvegarde(db, () => db.exec(lireMigrationQr(MIGRATION)), false)
    expect(erreur?.message).toMatch(ARRET_ECRITURE_IMPOSSIBLE)
    expect(await policies()).toEqual([{ policyname: 'doc_sequences_owner_access', cmd: 'ALL' }])
  })

  it('même arrêt quand la table est en FORCE ROW LEVEL SECURITY pour son propriétaire', async () => {
    await db.exec(`CREATE ROLE proprietaire_table_force NOLOGIN;
      ALTER TABLE public.doc_sequences OWNER TO proprietaire_table_force;
      ALTER FUNCTION public.next_doc_number(uuid, text, integer) OWNER TO proprietaire_table_force;
      ALTER TABLE public.doc_sequences FORCE ROW LEVEL SECURITY`)
    const { erreur } = await dansPointDeSauvegarde(db, () => db.exec(lireMigrationQr(MIGRATION)), false)
    expect(erreur?.message).toMatch(ARRET_ECRITURE_IMPOSSIBLE)
    expect(await policies()).toEqual([{ policyname: 'doc_sequences_owner_access', cmd: 'ALL' }])
  })

  it('propriétaire de la table et de la fonction, sans superutilisateur ni FORCE : migration appliquée, next_doc_number avance', async () => {
    await db.exec(`CREATE ROLE proprietaire_table NOLOGIN;
      GRANT USAGE ON SCHEMA auth TO proprietaire_table;
      GRANT EXECUTE ON FUNCTION auth.uid() TO proprietaire_table;
      ALTER TABLE public.doc_sequences OWNER TO proprietaire_table;
      ALTER FUNCTION public.next_doc_number(uuid, text, integer) OWNER TO proprietaire_table`)
    const { erreur } = await dansPointDeSauvegarde(db, () => db.exec(lireMigrationQr(MIGRATION)))
    expect(erreur).toBeNull()
    expect(await policies()).toEqual([{ policyname: 'doc_sequences_lecture_proprietaire', cmd: 'SELECT' }])
    const appel = await sousRole(db, 'authenticated', comptes.societe, `SELECT public.next_doc_number($1, 'devis', 2026) AS n`, [comptes.societe])
    expect(appel.erreur).toBeNull()
    expect(appel.lignes).toEqual([{ n: 'DEV-2026-038' }])
  })

  // Branche BYPASSRLS de la garde : propriétaire non superutilisateur mais exempté de la RLS (cas attendu du rôle
  // postgres de Supabase). La table reste au superutilisateur du banc ; le rôle n'a que les droits dont next_doc_number
  // a besoin. Prémisse vérifiée : ni superutilisateur, ni propriétaire de la table, donc seule cette branche peut
  // laisser passer la migration.
  it('propriétaire de la seule fonction, BYPASSRLS sans superutilisateur, table à un autre rôle : migration appliquée, next_doc_number avance', async () => {
    await db.exec(`CREATE ROLE proprietaire_bypassrls NOLOGIN BYPASSRLS;
      GRANT USAGE ON SCHEMA auth TO proprietaire_bypassrls;
      GRANT EXECUTE ON FUNCTION auth.uid() TO proprietaire_bypassrls;
      GRANT SELECT, INSERT, UPDATE ON public.doc_sequences TO proprietaire_bypassrls;
      ALTER FUNCTION public.next_doc_number(uuid, text, integer) OWNER TO proprietaire_bypassrls`)
    const { rows: [premisse] } = await db.query<{ rolsuper: boolean; rolbypassrls: boolean; proprietaire_table: boolean }>(
      `SELECT o.rolsuper, o.rolbypassrls, o.oid = t.relowner AS proprietaire_table
       FROM pg_proc p JOIN pg_roles o ON o.oid = p.proowner JOIN pg_class t ON t.oid = 'public.doc_sequences'::regclass
       WHERE p.oid = 'public.next_doc_number(uuid,text,integer)'::regprocedure`)
    expect(premisse).toEqual({ rolsuper: false, rolbypassrls: true, proprietaire_table: false })
    const { erreur } = await dansPointDeSauvegarde(db, () => db.exec(lireMigrationQr(MIGRATION)))
    expect(erreur).toBeNull()
    expect(await policies()).toEqual([{ policyname: 'doc_sequences_lecture_proprietaire', cmd: 'SELECT' }])
    const appel = await sousRole(db, 'authenticated', comptes.societe, `SELECT public.next_doc_number($1, 'devis', 2026) AS n`, [comptes.societe])
    expect(appel.erreur).toBeNull()
    expect(appel.lignes).toEqual([{ n: 'DEV-2026-038' }])
  })

  describe('après les migrations du dépôt, jouées deux fois', () => {
    beforeAll(async () => {
      for (const fichier of [...CORRECTIONS, ...CORRECTIONS]) await db.exec(lireMigrationQr(fichier))
    })

    it('une session connectée ne peut ni modifier, ni créer, ni supprimer un compteur', async () => {
      const modification = await sousRole(db, 'authenticated', comptes.societe, `UPDATE public.doc_sequences SET last_seq = 0 WHERE doc_type = 'devis'`)
      const creation = await sousRole(db, 'authenticated', comptes.societe,
        `INSERT INTO public.doc_sequences (artisan_user_id, doc_type, year, last_seq) VALUES ($1, 'facture', 2026, 0)`, [comptes.societe])
      const suppression = await sousRole(db, 'authenticated', comptes.societe, `DELETE FROM public.doc_sequences`)
      for (const appel of [modification, creation, suppression]) {
        expect(appel.erreur?.code).toBe('42501')
      }
      expect(await compteur(comptes.societe)).toBe(37)
    })

    it('lecture : chaque compte voit son seul compteur', async () => {
      const lecture = await sousRole(db, 'authenticated', comptes.societe, 'SELECT artisan_user_id, last_seq FROM public.doc_sequences')
      expect(lecture.erreur).toBeNull()
      expect(lecture.lignes).toEqual([{ artisan_user_id: comptes.societe, last_seq: 37 }])
    })

    it('next_doc_number avance toujours le compteur du compte connecté (seul chemin d\'écriture)', async () => {
      const { valeur } = await dansPointDeSauvegarde(db, async () => {
        const appel = await sousRole(db, 'authenticated', comptes.societe, `SELECT public.next_doc_number($1, 'devis', 2026) AS n`, [comptes.societe])
        return { appel, compteur: await compteur(comptes.societe) }
      }, false)
      expect(valeur?.appel.erreur).toBeNull()
      expect(valeur?.appel.lignes).toEqual([{ n: 'DEV-2026-038' }])
      expect(valeur?.compteur).toBe(38)
    })

    it('droits : lecture pour les clients, écriture pour le seul service_role', async () => {
      const droits = await droitsEffectifs(db, TABLE)
      for (const role of ['anon', 'authenticated'] as const) {
        expect(droits[role]).toEqual({ SELECT: true, INSERT: false, UPDATE: false, DELETE: false, TRUNCATE: false })
      }
      expect(droits.service_role).toEqual({ SELECT: true, INSERT: true, UPDATE: true, DELETE: true, TRUNCATE: true })
    })

    it('une seule policy, en lecture', async () => {
      const { rows } = await db.query<{ cmd: string }>(`SELECT cmd FROM pg_policies WHERE schemaname = 'public' AND tablename = 'doc_sequences'`)
      expect(rows).toEqual([{ cmd: 'SELECT' }])
    })
  })
})
