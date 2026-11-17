// @vitest-environment node
// tests/migrations/btp_pointage_appareils.execution.test.ts
//
// EXÉCUTION RÉELLE de 20261117_btp_pointage_appareils.sql sur un vrai PostgreSQL (PGlite, WebAssembly, en mémoire ;
// aucune base distante), en un seul exec comme l'éditeur SQL de Supabase. Comptes et données fictifs.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { randomUUID } from 'crypto'
import { ECHAFAUDAGE_SUPABASE_SQL, erreurPg, lireMigrationQr } from '../helpers/pglite-signalements'

const MIGRATION = lireMigrationQr('20261117_btp_pointage_appareils.sql')

const SOCIETE_A = randomUUID()
const PAUL_COMPTE = randomUUID()
const PAUL_FICHE = randomUUID()
const EMPREINTE = 'a'.repeat(64)

let db: PGlite

beforeEach(async () => {
  db = new PGlite()
  await db.exec(ECHAFAUDAGE_SUPABASE_SQL)
  await db.exec(`INSERT INTO auth.users (id) VALUES ('${SOCIETE_A}'), ('${PAUL_COMPTE}');`)
})
afterEach(async () => { await db.close() })

const enregistrer = (empreinte: string, plateforme = 'android', rendreId = false) => db.query<{ id: string }>(
  `INSERT INTO public.pointage_appareils_btp (owner_id, membre_id, user_id, empreinte, plateforme, email_fiche) VALUES ($1, $2, $3, $4, $5, $6)${rendreId ? ' RETURNING id' : ''}`,
  [SOCIETE_A, PAUL_FICHE, PAUL_COMPTE, empreinte, plateforme, 'paul@a.example'],
)
const TABLES = ['pointage_appareils_btp', 'pointage_evenements_btp', 'pointage_lignes_appareil_btp']
const CHANTIER_A = randomUUID()
const CHANTIER_B = randomUUID()

describe('migration 20261117 — téléphones du pointage en arrière-plan, journal de leurs envois, pointages écrits', () => {
  it('crée pointage_appareils_btp vide : colonnes, fuseau par défaut, RLS active sans policy', async () => {
    await db.exec(MIGRATION)
    const colonnes = (await db.query<{ column_name: string; is_nullable: string }>(
      `SELECT column_name, is_nullable FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'pointage_appareils_btp' ORDER BY ordinal_position`,
    )).rows
    expect(colonnes).toEqual([
      { column_name: 'id', is_nullable: 'NO' },
      { column_name: 'owner_id', is_nullable: 'NO' },
      { column_name: 'membre_id', is_nullable: 'NO' },
      { column_name: 'user_id', is_nullable: 'NO' },
      { column_name: 'empreinte', is_nullable: 'NO' },
      { column_name: 'plateforme', is_nullable: 'NO' },
      { column_name: 'email_fiche', is_nullable: 'NO' },
      { column_name: 'fuseau', is_nullable: 'NO' },
      { column_name: 'cree_le', is_nullable: 'NO' },
      { column_name: 'vu_le', is_nullable: 'YES' },
      { column_name: 'retire_le', is_nullable: 'YES' },
      // Un envoi du téléphone traité à la fois.
      { column_name: 'traite_jusqu_au', is_nullable: 'YES' },
    ])
    expect((await db.query('SELECT 1 FROM public.pointage_appareils_btp')).rows).toEqual([])
    await enregistrer(EMPREINTE)
    expect((await db.query('SELECT fuseau, retire_le FROM public.pointage_appareils_btp')).rows).toEqual([{ fuseau: 'Europe/Paris', retire_le: null }])
    expect((await db.query(`SELECT relrowsecurity FROM pg_class WHERE oid = 'public.pointage_appareils_btp'::regclass`)).rows)
      .toEqual([{ relrowsecurity: true }])
    expect((await db.query(`SELECT 1 FROM pg_policies WHERE tablename = 'pointage_appareils_btp'`)).rows).toEqual([])
  })

  it('une empreinte n’appartient qu’à un téléphone ; empreinte SHA-256 hexadécimale et plateforme connue exigées', async () => {
    await db.exec(MIGRATION)
    await enregistrer(EMPREINTE)
    expect(erreurPg(await enregistrer(EMPREINTE, 'ios').catch(e => e)).code).toBe('23505')
    expect(erreurPg(await enregistrer('jeton-en-clair').catch(e => e)).code).toBe('23514')
    expect(erreurPg(await enregistrer('b'.repeat(64), 'windows').catch(e => e)).code).toBe('23514')
    // Un seul téléphone actif par compte : un second n'entre qu'une fois le premier retiré.
    expect(erreurPg(await enregistrer('c'.repeat(64), 'ios').catch(e => e)).code).toBe('23505')
    await db.query('UPDATE public.pointage_appareils_btp SET retire_le = now()')
    await enregistrer('c'.repeat(64), 'ios')
    expect((await db.query('SELECT 1 FROM public.pointage_appareils_btp')).rows).toHaveLength(2)
  })

  it('index unique des téléphones actifs par compte, limité aux téléphones non retirés', async () => {
    await db.exec(MIGRATION)
    const index = (await db.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes WHERE tablename = 'pointage_appareils_btp' AND indexname = 'pointage_appareils_btp_actifs'`,
    )).rows
    expect(index).toHaveLength(1)
    expect(index[0].indexdef).toContain('CREATE UNIQUE INDEX')
    expect(index[0].indexdef).toContain('(user_id)')
    expect(index[0].indexdef).toContain('WHERE (retire_le IS NULL)')
  })

  it('aucun droit pour anon ni authenticated sur les trois tables ; RLS active sans policy ; le serveur garde les siens', async () => {
    await db.exec(MIGRATION)
    for (const table of TABLES) {
      const droits = (await db.query<{ role: string; droit: string; accorde: boolean }>(`
        SELECT r.role, d.droit, has_table_privilege(r.role, 'public.${table}', d.droit) AS accorde
        FROM (VALUES ('anon'), ('authenticated')) AS r(role)
        CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) AS d(droit)`)).rows
      expect(droits.filter(d => d.accorde), table).toEqual([])
      expect(droits).toHaveLength(10)
      expect((await db.query(`SELECT has_table_privilege('service_role', 'public.${table}', 'INSERT') AS ok`)).rows).toEqual([{ ok: true }])
      expect((await db.query(`SELECT relrowsecurity FROM pg_class WHERE oid = 'public.${table}'::regclass`)).rows, table).toEqual([{ relrowsecurity: true }])
      expect((await db.query(`SELECT 1 FROM pg_policies WHERE tablename = '${table}'`)).rows, table).toEqual([])
    }
  })

  it('journal des envois : un même envoi (téléphone, chantier, sens, heure) n’entre qu’une fois ; deux zones à la même heure, si', async () => {
    await db.exec(MIGRATION)
    const { rows: [{ id }] } = await enregistrer(EMPREINTE, 'android', true)
    const journaliser = (chantier: string, sens: string, heure: string) => db.query(
      'INSERT INTO public.pointage_evenements_btp (appareil_id, chantier_id, sens, detecte_le) VALUES ($1, $2, $3, $4)',
      [id, chantier, sens, heure],
    )
    await journaliser(CHANTIER_A, 'enter', '2026-11-16T07:00:00Z')
    expect(erreurPg(await journaliser(CHANTIER_A, 'enter', '2026-11-16T07:00:00Z').catch(e => e)).code).toBe('23505')
    await journaliser(CHANTIER_B, 'enter', '2026-11-16T07:00:00Z')
    await journaliser(CHANTIER_A, 'exit', '2026-11-16T07:00:00Z')
    expect(erreurPg(await journaliser(CHANTIER_A, 'dwell', '2026-11-16T08:00:00Z').catch(e => e)).code).toBe('23514')
    const colonnes = (await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pointage_evenements_btp' ORDER BY ordinal_position`,
    )).rows.map(c => c.column_name)
    expect(colonnes).toEqual(['id', 'appareil_id', 'chantier_id', 'chantier_nom', 'sens', 'detecte_le', 'recu_le'])
    // Téléphone supprimé : son journal et ses liens partent avec lui.
    await db.query('INSERT INTO public.pointage_lignes_appareil_btp (pointage_id, appareil_id, date, ecrit) VALUES ($1, $2, $3, $4)', ['p-1', id, '2026-11-16', '{}'])
    await db.query('DELETE FROM public.pointage_appareils_btp WHERE id = $1', [id])
    expect((await db.query('SELECT 1 FROM public.pointage_evenements_btp')).rows).toEqual([])
    expect((await db.query('SELECT 1 FROM public.pointage_lignes_appareil_btp')).rows).toEqual([])
  })

  it('liens des pointages écrits par le téléphone : un lien par pointage, avec ce qui y a été écrit', async () => {
    await db.exec(MIGRATION)
    const { rows: [{ id }] } = await enregistrer(EMPREINTE, 'android', true)
    const lier = (pointage: string) => db.query(
      'INSERT INTO public.pointage_lignes_appareil_btp (pointage_id, appareil_id, date, ecrit) VALUES ($1, $2, $3, $4)',
      [pointage, id, '2026-11-16', JSON.stringify({ heure_arrivee: '08:00:00' })],
    )
    await lier('p-1')
    expect(erreurPg(await lier('p-1').catch(e => e)).code).toBe('23505')
    expect((await db.query<{ ecrit: unknown }>('SELECT ecrit FROM public.pointage_lignes_appareil_btp')).rows).toEqual([{ ecrit: { heure_arrivee: '08:00:00' } }])
  })

  it('rejouable : relancée, elle ne change rien (lignes, index)', async () => {
    await db.exec(MIGRATION)
    await enregistrer(EMPREINTE)
    await db.exec(MIGRATION)
    expect((await db.query('SELECT empreinte FROM public.pointage_appareils_btp')).rows).toEqual([{ empreinte: EMPREINTE }])
    const index = (await db.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE tablename IN ('pointage_appareils_btp', 'pointage_evenements_btp', 'pointage_lignes_appareil_btp') ORDER BY 1`,
    )).rows.map(i => i.indexname)
    expect(index).toEqual([
      'pointage_appareils_btp_actifs',
      'pointage_appareils_btp_empreinte_key',
      'pointage_appareils_btp_pkey',
      'pointage_evenements_btp_par_heure',
      'pointage_evenements_btp_pkey',
      'pointage_evenements_btp_un_envoi',
      'pointage_lignes_appareil_btp_par_jour',
      'pointage_lignes_appareil_btp_pkey',
    ])
  })

  it('compte supprimé : ses téléphones partent avec lui', async () => {
    await db.exec(MIGRATION)
    await enregistrer(EMPREINTE)
    await db.query('DELETE FROM auth.users WHERE id = $1', [PAUL_COMPTE])
    expect((await db.query('SELECT 1 FROM public.pointage_appareils_btp')).rows).toEqual([])
  })
})
