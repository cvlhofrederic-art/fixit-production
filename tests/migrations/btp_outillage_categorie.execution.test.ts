// @vitest-environment node
// tests/migrations/btp_outillage_categorie.execution.test.ts
//
// EXÉCUTION RÉELLE de 20261128d_btp_outillage_categorie.sql sur un vrai PostgreSQL (PGlite, WebAssembly, en mémoire ;
// aucune base distante), en un seul exec comme l'éditeur SQL de Supabase, après 20261126_btp_outillage.sql (déjà
// appliquée en production le 26/11/2026) et un outil saisi entre les deux. Comptes et données fictifs.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { randomUUID } from 'crypto'
import { ECHAFAUDAGE_SUPABASE_SQL, erreurPg, lireMigrationQr } from '../helpers/pglite-signalements'
import { CATEGORIES_OUTIL } from '@/lib/btp/outillage-regles'

const OUTILLAGE = lireMigrationQr('20261126_btp_outillage.sql')
const MIGRATION = lireMigrationQr('20261128d_btp_outillage_categorie.sql')
const SOCIETE = randomUUID()

let db: PGlite

beforeEach(async () => {
  db = new PGlite()
  await db.exec(ECHAFAUDAGE_SUPABASE_SQL)
  await db.exec(`INSERT INTO auth.users (id) VALUES ('${SOCIETE}')`)
  await db.exec(OUTILLAGE)
  await db.exec(`INSERT INTO public.outillage_btp (owner_id, nom, quantite) VALUES ('${SOCIETE}', 'Betoneira', 2)`)
  await db.exec(MIGRATION)
}, 120_000) // PGlite démarre lentement quand plusieurs fichiers de test tournent en même temps.
afterEach(async () => { await db.close() })

const echec = async (sql: string) => {
  try {
    await db.exec(sql)
    return null
  } catch (e) {
    return erreurPg(e).code
  }
}

describe('migration 20261128d — catégorie des outils BTP', () => {
  it('ajoute une colonne facultative : l’outil déjà saisi reste tel quel, sans catégorie', async () => {
    expect((await db.query(`SELECT nom, quantite, categorie FROM public.outillage_btp`)).rows).toEqual([{ nom: 'Betoneira', quantite: 2, categorie: null }])
    const colonne = await db.query(`SELECT is_nullable, column_default FROM information_schema.columns WHERE table_name = 'outillage_btp' AND column_name = 'categorie'`)
    expect(colonne.rows).toEqual([{ is_nullable: 'YES', column_default: null }])
  })

  it('accepte chaque catégorie du code ; refuse un code mal formé', async () => {
    for (const categorie of CATEGORIES_OUTIL) {
      expect(await echec(`INSERT INTO public.outillage_btp (owner_id, nom, categorie) VALUES ('${SOCIETE}', 'X', '${categorie}')`), categorie).toBeNull()
    }
    for (const mauvais of ['Andaimes', 'mão', '', 'a b', 'x'.repeat(41)]) {
      expect(await echec(`INSERT INTO public.outillage_btp (owner_id, nom, categorie) VALUES ('${SOCIETE}', 'X', '${mauvais}')`), mauvais).toBe('23514')
    }
  })

  it('la table reste réservée au serveur : RLS active, aucune policy, aucun droit pour anon ni authenticated', async () => {
    expect((await db.query(`SELECT relrowsecurity FROM pg_class WHERE oid = 'public.outillage_btp'::regclass`)).rows).toEqual([{ relrowsecurity: true }])
    expect((await db.query(`SELECT count(*)::int AS n FROM pg_policies WHERE tablename = 'outillage_btp'`)).rows).toEqual([{ n: 0 }])
    const droits = await db.query(`
      SELECT r.role, has_column_privilege(r.role, 'public.outillage_btp', 'categorie', 'SELECT') AS lit
      FROM (VALUES ('anon'), ('authenticated')) AS r(role)`)
    expect(droits.rows.filter((r) => (r as { lit: boolean }).lit)).toEqual([])
    expect((await db.query(`SELECT has_column_privilege('service_role', 'public.outillage_btp', 'categorie', 'UPDATE') AS ok`)).rows).toEqual([{ ok: true }])
  })

  it('rejouable : relancée, elle ne change rien et ne double pas la contrainte', async () => {
    await db.exec(`UPDATE public.outillage_btp SET categorie = 'machines'`)
    await db.exec(MIGRATION)
    expect((await db.query(`SELECT categorie FROM public.outillage_btp`)).rows).toEqual([{ categorie: 'machines' }])
    expect((await db.query(`SELECT count(*)::int AS n FROM pg_constraint WHERE conname = 'outillage_btp_categorie_valide'`)).rows).toEqual([{ n: 1 }])
  })

  it('le retour arrière de docs/rollback-procedures.md retire la colonne et rien d’autre', async () => {
    await db.exec(`
      ALTER TABLE public.outillage_btp DROP CONSTRAINT IF EXISTS outillage_btp_categorie_valide;
      ALTER TABLE public.outillage_btp DROP COLUMN IF EXISTS categorie;
    `)
    expect((await db.query(`SELECT nom FROM public.outillage_btp`)).rows).toEqual([{ nom: 'Betoneira' }])
    expect((await db.query(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'outillage_btp' AND column_name = 'categorie'`)).rows).toEqual([{ n: 0 }])
  })
})
