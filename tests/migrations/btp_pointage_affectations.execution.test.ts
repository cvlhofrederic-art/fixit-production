// @vitest-environment node
// tests/migrations/btp_pointage_affectations.execution.test.ts
//
// EXÉCUTION RÉELLE de 20261116_btp_pointage_affectations.sql sur un vrai PostgreSQL (PGlite, WebAssembly, en
// mémoire ; aucune base distante), en un seul exec comme l'éditeur SQL de Supabase. Tables reproduites d'après le
// relevé en lecture seule de la production du 16/11/2026 (colonnes, types, valeurs par défaut, contraintes de
// vérification, clés étrangères). Comptes et données fictifs.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { randomUUID } from 'crypto'
import { ECHAFAUDAGE_SUPABASE_SQL, erreurPg, lireMigrationQr } from '../helpers/pglite-signalements'

const MIGRATION = lireMigrationQr('20261116_btp_pointage_affectations.sql')

const TABLES_PRODUCTION = `
CREATE TABLE public.chantiers_btp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titre text NOT NULL, client text, adresse text,
  latitude double precision, longitude double precision,
  geo_rayon_m integer NOT NULL DEFAULT 100,
  date_debut date, date_fin date, budget numeric,
  statut text NOT NULL DEFAULT 'En attente' CHECK (statut IN ('En attente', 'En cours', 'Terminé', 'Annulé')),
  description text, equipe text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  marge_prevue_pct numeric, tva_taux numeric DEFAULT 20.00, montant_facture numeric DEFAULT 0,
  acompte_recu numeric DEFAULT 0, penalite_retard_jour numeric DEFAULT 0,
  ville text, code_postal text, sous_taches jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE TABLE public.membres_btp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prenom text NOT NULL, nom text NOT NULL, email text
);
CREATE TABLE public.pointages_btp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  membre_id uuid REFERENCES public.membres_btp(id) ON DELETE SET NULL,
  chantier_id uuid REFERENCES public.chantiers_btp(id) ON DELETE SET NULL,
  employe text NOT NULL, poste text, chantier_nom text,
  date date NOT NULL, heure_arrivee time NOT NULL, heure_depart time,
  pause_minutes integer NOT NULL DEFAULT 60, heures_travaillees numeric, notes text,
  mode text NOT NULL DEFAULT 'manuel' CHECK (mode IN ('manuel', 'geo_auto', 'geo_confirme')),
  arrivee_lat double precision, arrivee_lng double precision, depart_lat double precision, depart_lng double precision,
  distance_m integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pointages_btp_owner ON public.pointages_btp(owner_id);
CREATE INDEX idx_pointages_btp_membre ON public.pointages_btp(membre_id);
ALTER TABLE public.chantiers_btp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pointages_btp ENABLE ROW LEVEL SECURITY;
`

const SOCIETE_A = randomUUID()
const SOCIETE_B = randomUUID()
const PAUL = randomUUID()
const JEAN = randomUUID()
const VILLA = randomUUID()

let db: PGlite

async function creerBase(): Promise<PGlite> {
  const base = new PGlite()
  await base.exec(ECHAFAUDAGE_SUPABASE_SQL)
  await base.exec(TABLES_PRODUCTION)
  await base.exec(`
    INSERT INTO auth.users (id) VALUES ('${SOCIETE_A}'), ('${SOCIETE_B}');
    INSERT INTO public.membres_btp (id, owner_id, prenom, nom) VALUES ('${PAUL}', '${SOCIETE_A}', 'Paul', 'Exemple'), ('${JEAN}', '${SOCIETE_A}', 'Jean', 'Test');
    INSERT INTO public.chantiers_btp (id, owner_id, titre, statut, latitude, longitude, geo_rayon_m, updated_at)
      VALUES ('${VILLA}', '${SOCIETE_A}', 'Villa', 'En cours', 43.25, 5.38, 150, '2026-11-01T10:00:00Z');
    INSERT INTO public.pointages_btp (owner_id, membre_id, chantier_id, employe, date, heure_arrivee, heure_depart, mode, distance_m)
      VALUES ('${SOCIETE_A}', '${PAUL}', '${VILLA}', 'Paul Exemple', '2026-11-13', '08:00', '16:00', 'geo_confirme', 12);
  `)
  return base
}

const instantane = async (requete: string) => JSON.stringify((await db.query(requete)).rows)

const pointerOuvert = (owner: string, membre: string | null) => db.query(
  `INSERT INTO public.pointages_btp (owner_id, membre_id, employe, date, heure_arrivee) VALUES ($1, $2, 'x', '2026-11-16', '08:30')`,
  [owner, membre],
)

beforeEach(async () => { db = await creerBase() })
afterEach(async () => { await db.close() })

describe('migration 20261116 — pointage BTP', () => {
  it('ajoute chantiers_btp.membres_ids (uuid[], non nul, vide par défaut) sans toucher aux lignes existantes', async () => {
    const chantiersAvant = await instantane('SELECT * FROM public.chantiers_btp ORDER BY id')
    const pointagesAvant = await instantane('SELECT * FROM public.pointages_btp ORDER BY id')
    await db.exec(MIGRATION)

    const colonne = (await db.query<{ data_type: string; is_nullable: string; column_default: string }>(
      `SELECT data_type, is_nullable, column_default FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'chantiers_btp' AND column_name = 'membres_ids'`,
    )).rows
    expect(colonne).toEqual([{ data_type: 'ARRAY', is_nullable: 'NO', column_default: "'{}'::uuid[]" }])

    const chantiersApres = (await db.query<Record<string, unknown>>('SELECT * FROM public.chantiers_btp ORDER BY id')).rows
    expect(chantiersApres.map(l => l.membres_ids)).toEqual([[]])
    expect(JSON.stringify(chantiersApres.map(({ membres_ids: _nouvelle, ...reste }) => reste))).toBe(chantiersAvant)
    expect(await instantane('SELECT * FROM public.pointages_btp ORDER BY id')).toBe(pointagesAvant)
  })

  it('un seul pointage en cours par employé et par société ; le reste passe', async () => {
    await db.exec(MIGRATION)
    await pointerOuvert(SOCIETE_A, PAUL)
    expect(erreurPg(await pointerOuvert(SOCIETE_A, PAUL).catch(e => e)).code).toBe('23505')

    // Clos, d'un autre employé, d'une autre société, ou sans fiche : autorisés.
    await db.query(`UPDATE public.pointages_btp SET heure_depart = '12:00' WHERE membre_id = $1 AND heure_depart IS NULL`, [PAUL])
    await pointerOuvert(SOCIETE_A, PAUL)
    await pointerOuvert(SOCIETE_A, JEAN)
    await pointerOuvert(SOCIETE_B, PAUL)
    await pointerOuvert(SOCIETE_A, null)
    await pointerOuvert(SOCIETE_A, null)
    expect((await db.query('SELECT 1 FROM public.pointages_btp')).rows).toHaveLength(7)
  })

  it('rejouable : relancée, elle ne change rien et ne crée pas de second index', async () => {
    await db.exec(MIGRATION)
    await db.query(`UPDATE public.chantiers_btp SET membres_ids = ARRAY['${PAUL}']::uuid[]`)
    await db.exec(MIGRATION)
    const index = (await db.query(`SELECT indexname FROM pg_indexes WHERE tablename = 'pointages_btp' AND indexname LIKE 'pointages_btp_un_ouvert%'`)).rows
    expect(index).toEqual([{ indexname: 'pointages_btp_un_ouvert_par_membre' }])
    expect((await db.query('SELECT membres_ids FROM public.chantiers_btp')).rows).toEqual([{ membres_ids: [PAUL] }])
  })

  it('deux pointages en cours du même employé déjà en base : échec, et rien n’est appliqué (transaction)', async () => {
    await pointerOuvert(SOCIETE_A, PAUL)
    await pointerOuvert(SOCIETE_A, PAUL)
    expect(erreurPg(await db.exec(MIGRATION).catch(e => e)).code).toBe('23505')
    await db.exec('ROLLBACK')
    const colonne = await db.query(`SELECT 1 FROM information_schema.columns WHERE table_name = 'chantiers_btp' AND column_name = 'membres_ids'`)
    expect(colonne.rows).toEqual([])
    expect((await db.query("SELECT to_regclass('public.pointage_reglages_btp') AS t")).rows).toEqual([{ t: null }])
  })

  it('base sans les tables BTP (job CI) : passe sans erreur', async () => {
    const vide = new PGlite()
    try {
      await vide.exec(ECHAFAUDAGE_SUPABASE_SQL)
      await expect(vide.exec(MIGRATION)).resolves.toBeDefined()
    } finally {
      await vide.close()
    }
  })

  it('aucune policy ni aucun droit modifiés', async () => {
    const droits = 'SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_name IN (\'chantiers_btp\', \'pointages_btp\') ORDER BY 1, 2'
    const avant = await instantane(droits)
    const policiesAvant = await instantane('SELECT * FROM pg_policies ORDER BY policyname')
    await db.exec(MIGRATION)
    expect(await instantane(droits)).toBe(avant)
    expect(await instantane('SELECT * FROM pg_policies ORDER BY policyname')).toBe(policiesAvant)
  })
  it('pointage_reglages_btp : créée vide, RLS active sans policy, aucun droit pour anon ni authenticated, rejouable', async () => {
    await db.exec(MIGRATION)
    await db.exec(MIGRATION)
    const colonnes = (await db.query<{ column_name: string; is_nullable: string }>(
      `SELECT column_name, is_nullable FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'pointage_reglages_btp' ORDER BY ordinal_position`,
    )).rows
    expect(colonnes).toEqual([
      { column_name: 'owner_id', is_nullable: 'NO' },
      { column_name: 'auto_active', is_nullable: 'NO' },
      { column_name: 'confirme_le', is_nullable: 'YES' },
      { column_name: 'confirme_par', is_nullable: 'YES' },
      { column_name: 'modifie_le', is_nullable: 'NO' },
    ])
    expect((await db.query('SELECT 1 FROM public.pointage_reglages_btp')).rows).toEqual([])
    expect((await db.query(`SELECT relrowsecurity FROM pg_class WHERE oid = 'public.pointage_reglages_btp'::regclass`)).rows)
      .toEqual([{ relrowsecurity: true }])
    expect((await db.query(`SELECT 1 FROM pg_policies WHERE tablename = 'pointage_reglages_btp'`)).rows).toEqual([])
    const droits = (await db.query<{ role: string; droit: string; accorde: boolean }>(`
      SELECT r.role, d.droit, has_table_privilege(r.role, 'public.pointage_reglages_btp', d.droit) AS accorde
      FROM (VALUES ('anon'), ('authenticated')) AS r(role)
      CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) AS d(droit)`)).rows
    expect(droits.filter(d => d.accorde)).toEqual([])
    expect(droits).toHaveLength(10)
    // Le rôle du serveur (service_role, qui contourne la RLS) garde ses droits.
    expect((await db.query(`SELECT has_table_privilege('service_role', 'public.pointage_reglages_btp', 'INSERT') AS ok`)).rows).toEqual([{ ok: true }])
  })
})
