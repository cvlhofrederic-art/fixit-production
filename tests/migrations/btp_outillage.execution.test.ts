// @vitest-environment node
// tests/migrations/btp_outillage.execution.test.ts
//
// EXÉCUTION RÉELLE de 20261126_btp_outillage.sql sur un vrai PostgreSQL (PGlite, WebAssembly, en mémoire ; aucune base
// distante), en un seul exec comme l'éditeur SQL de Supabase. La migration ne crée que deux tables nouvelles : la base
// de départ n'a besoin que des rôles Supabase et de auth.users (plus un chantier, pour vérifier qu'il n'est pas touché).
// Comptes et données fictifs.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { randomUUID } from 'crypto'
import { ECHAFAUDAGE_SUPABASE_SQL, erreurPg, lireMigrationQr } from '../helpers/pglite-signalements'

const MIGRATION = lireMigrationQr('20261126_btp_outillage.sql')
const SOCIETE = randomUUID()
const CHANTIER = randomUUID()
const TABLES = ['outillage_btp', 'verifications_outillage_btp'] as const

let db: PGlite

beforeEach(async () => {
  db = new PGlite()
  await db.exec(ECHAFAUDAGE_SUPABASE_SQL)
  await db.exec(`
    CREATE TABLE public.chantiers_btp (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, titre text NOT NULL, statut text NOT NULL DEFAULT 'En attente');
    INSERT INTO auth.users (id) VALUES ('${SOCIETE}');
    INSERT INTO public.chantiers_btp (id, owner_id, titre, statut) VALUES ('${CHANTIER}', '${SOCIETE}', 'Moradia', 'En cours');
  `)
  await db.exec(MIGRATION)
})
afterEach(async () => { await db.close() })

const echecInsertion = async (sql: string) => {
  try {
    await db.exec(sql)
    return null
  } catch (e) {
    return erreurPg(e).code
  }
}

describe('migration 20261126 — outillage BTP', () => {
  it('crée les deux tables vides, avec leurs valeurs par défaut', async () => {
    for (const table of TABLES) {
      expect((await db.query(`SELECT count(*)::int AS n FROM public.${table}`)).rows).toEqual([{ n: 0 }])
    }
    await db.exec(`INSERT INTO public.outillage_btp (owner_id, nom, chantier_id) VALUES ('${SOCIETE}', 'Betoneira', '${CHANTIER}')`)
    expect((await db.query(`SELECT type, quantite, etat, retire_le, created_at IS NOT NULL AS date FROM public.outillage_btp`)).rows)
      .toEqual([{ type: 'outil', quantite: 1, etat: 'ok', retire_le: null, date: true }])
  })

  it('refuse ce que la route refuse aussi : type, état, nom vide, quantité, longueurs', async () => {
    const insert = (colonnes: string, valeurs: string) =>
      echecInsertion(`INSERT INTO public.outillage_btp (owner_id, ${colonnes}) VALUES ('${SOCIETE}', ${valeurs})`)
    expect(await insert('nom, type', `'X', 'camion'`)).toBe('23514')
    expect(await insert('nom, etat', `'X', 'perdu'`)).toBe('23514')
    expect(await insert('nom', `'   '`)).toBe('23514')
    expect(await insert('nom, quantite', `'X', 0`)).toBe('23514')
    expect(await insert('nom, quantite', `'X', 1000`)).toBe('23514')
    expect(await insert('nom', `'${'x'.repeat(121)}'`)).toBe('23514')
    expect(await insert('nom, reference', `'X', '${'x'.repeat(81)}'`)).toBe('23514')
    expect(await insert('nom', `NULL`)).toBe('23502')
    // Un compte qui n'existe pas : refusé (clé étrangère vers auth.users).
    expect(await echecInsertion(`INSERT INTO public.outillage_btp (owner_id, nom) VALUES ('${randomUUID()}', 'X')`)).toBe('23503')
  })

  it('une vérification porte sur un vendredi, et sa liste est un tableau', async () => {
    const verif = (vendredi: string, lignes = `'[]'`) => echecInsertion(
      `INSERT INTO public.verifications_outillage_btp (owner_id, chantier_id, vendredi, valide_par, lignes) VALUES ('${SOCIETE}', '${CHANTIER}', '${vendredi}', '${SOCIETE}', ${lignes})`,
    )
    expect(await verif('2026-11-27')).toBeNull()
    expect(await verif('2026-11-26')).toBe('23514')
    expect(await verif('2026-11-27', `'{}'`)).toBe('23514')
    // Une seconde vérification de la même semaine s'ajoute (aucune contrainte d'unicité).
    expect(await verif('2026-11-27')).toBeNull()
  })

  it('un chantier supprimé ne supprime ni l’outil ni la vérification, et ne bloque pas la suppression', async () => {
    await db.exec(`
      INSERT INTO public.outillage_btp (owner_id, nom, chantier_id) VALUES ('${SOCIETE}', 'Betoneira', '${CHANTIER}');
      INSERT INTO public.verifications_outillage_btp (owner_id, chantier_id, vendredi, valide_par) VALUES ('${SOCIETE}', '${CHANTIER}', '2026-11-27', '${SOCIETE}');
      DELETE FROM public.chantiers_btp WHERE id = '${CHANTIER}';
    `)
    for (const table of TABLES) {
      expect((await db.query(`SELECT count(*)::int AS n FROM public.${table}`)).rows).toEqual([{ n: 1 }])
    }
  })

  it('RLS active sans policy, aucun droit pour anon ni authenticated ; le service role écrit', async () => {
    for (const table of TABLES) {
      expect((await db.query(`SELECT relrowsecurity FROM pg_class WHERE oid = 'public.${table}'::regclass`)).rows).toEqual([{ relrowsecurity: true }])
      expect((await db.query(`SELECT count(*)::int AS n FROM pg_policies WHERE tablename = '${table}'`)).rows).toEqual([{ n: 0 }])
      const droits = await db.query(`
        SELECT r.role, d.droit, has_table_privilege(r.role, 'public.${table}', d.droit) AS accorde
        FROM (VALUES ('anon'), ('authenticated')) AS r(role), (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) AS d(droit)`)
      expect(droits.rows.filter((r) => (r as { accorde: boolean }).accorde)).toEqual([])
      expect((await db.query(`SELECT has_table_privilege('service_role', 'public.${table}', 'INSERT') AS ok`)).rows).toEqual([{ ok: true }])
    }
  })

  it('rejouable : relancée, elle ne change rien et ne double aucun index', async () => {
    await db.exec(`INSERT INTO public.outillage_btp (owner_id, nom) VALUES ('${SOCIETE}', 'Escadote')`)
    const avant = JSON.stringify((await db.query(`SELECT indexname FROM pg_indexes WHERE tablename IN ('outillage_btp', 'verifications_outillage_btp') ORDER BY 1`)).rows)
    await db.exec(MIGRATION)
    expect(JSON.stringify((await db.query(`SELECT indexname FROM pg_indexes WHERE tablename IN ('outillage_btp', 'verifications_outillage_btp') ORDER BY 1`)).rows)).toBe(avant)
    expect((await db.query(`SELECT nom FROM public.outillage_btp`)).rows).toEqual([{ nom: 'Escadote' }])
  })

  it('ne touche à aucune table existante', async () => {
    expect((await db.query(`SELECT id, titre, statut FROM public.chantiers_btp`)).rows).toEqual([{ id: CHANTIER, titre: 'Moradia', statut: 'En cours' }])
    expect((await db.query(`SELECT relrowsecurity FROM pg_class WHERE oid = 'public.chantiers_btp'::regclass`)).rows).toEqual([{ relrowsecurity: false }])
  })
})
