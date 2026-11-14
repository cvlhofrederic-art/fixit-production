// @vitest-environment node
// tests/migrations/artisan_photos_lecture_proprietaire.execution.test.ts
//
// EXÉCUTION RÉELLE de la migration 20261114_artisan_photos_lecture_proprietaire.sql sur un vrai PostgreSQL
// (PGlite, en mémoire ; aucun service, aucune base distante) :
//   - avant elle, la table des photos de chantier se lit sans compte (politique de lecture « true ») ;
//   - après elle, jouée DEUX fois (rejouabilité), seul le propriétaire de la fiche lit ses photos ; le service role
//     (routes API) lit tout comme avant ; les politiques d'écriture du propriétaire restent utilisables ;
//   - le nom de la politique ouverte varie selon l'historique de la base : chaque nom connu est essayé, ainsi qu'une
//     base déjà corrigée ;
//   - aucune ligne n'est modifiée ni supprimée.
// Aucune donnée réelle : comptes et photos d'exemple.

import { afterEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { ECHAFAUDAGE_SUPABASE_SQL } from '../helpers/pglite-signalements'

const FICHIER = '20261114_artisan_photos_lecture_proprietaire.sql'
const CHEMIN = join(process.cwd(), 'supabase/migrations', FICHIER)

const COMPTE_A = '11111111-1111-4111-8111-111111111111'
const COMPTE_B = '22222222-2222-4222-8222-222222222222'
const FICHE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const FICHE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

/** Ce que la migration suppose de Supabase et du schéma : auth.uid(), les fiches, les photos et leurs politiques d'écriture. */
const SCHEMA_PHOTOS_SQL = `
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE TABLE public.profiles_artisan (id uuid PRIMARY KEY, user_id uuid);
CREATE TABLE public.artisan_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id uuid NOT NULL,
  url text NOT NULL,
  label text DEFAULT '',
  lat double precision,
  lng double precision
);
ALTER TABLE public.profiles_artisan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artisan_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_lecture ON public.profiles_artisan FOR SELECT USING (true);
CREATE POLICY artisan_photos_owner_insert ON public.artisan_photos FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles_artisan p WHERE p.id = artisan_id AND p.user_id = auth.uid()));
CREATE POLICY artisan_photos_owner_update ON public.artisan_photos FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles_artisan p WHERE p.id = artisan_id AND p.user_id = auth.uid()));
CREATE POLICY artisan_photos_owner_delete ON public.artisan_photos FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles_artisan p WHERE p.id = artisan_id AND p.user_id = auth.uid()));
INSERT INTO public.profiles_artisan (id, user_id) VALUES ('${FICHE_A}', '${COMPTE_A}'), ('${FICHE_B}', '${COMPTE_B}');
INSERT INTO public.artisan_photos (artisan_id, url, label, lat, lng) VALUES
  ('${FICHE_A}', 'https://stockage.exemple.test/a-1.jpg', 'Avant travaux', 43.3, 5.4),
  ('${FICHE_A}', 'https://stockage.exemple.test/a-2.jpg', 'Après travaux', 43.3, 5.4),
  ('${FICHE_B}', 'https://stockage.exemple.test/b-1.jpg', 'Toiture', 41.1, -8.6);
`

function lireMigration(): string {
  let texte = readFileSync(CHEMIN, 'utf-8')
  if (texte.charCodeAt(0) === 0xfeff) texte = texte.slice(1)
  return texte.replace(/\r\n/g, '\n')
}

let db: PGlite | null = null
afterEach(async () => {
  if (db) await db.close()
  db = null
})

/** Base neuve : échafaudage Supabase, schéma des photos, puis la politique de lecture historique demandée. */
async function creerBase(politiqueDeLecture: string | null): Promise<PGlite> {
  const base = await PGlite.create()
  await base.exec(ECHAFAUDAGE_SUPABASE_SQL)
  await base.exec(SCHEMA_PHOTOS_SQL)
  if (politiqueDeLecture) await base.exec(politiqueDeLecture)
  return base
}

/** Libellés des photos visibles par un rôle (et, pour un compte connecté, son identifiant). */
async function photosVues(base: PGlite, role: 'anon' | 'authenticated' | 'service_role', compte = ''): Promise<string[]> {
  await base.exec(`SELECT set_config('request.jwt.claim.sub', '${compte}', false); SET ROLE ${role};`)
  try {
    const { rows } = await base.query<{ label: string }>('SELECT label FROM public.artisan_photos ORDER BY label')
    return rows.map((r) => r.label)
  } finally {
    await base.exec('RESET ROLE;')
  }
}

async function politiques(base: PGlite): Promise<Array<{ policyname: string; cmd: string; qual: string | null }>> {
  const { rows } = await base.query<{ policyname: string; cmd: string; qual: string | null }>(
    `SELECT policyname, cmd, qual FROM pg_policies WHERE schemaname = 'public' AND tablename = 'artisan_photos' ORDER BY policyname`)
  return rows
}

const TOUTES = ['Après travaux', 'Avant travaux', 'Toiture']
const CELLES_DE_A = ['Après travaux', 'Avant travaux']

const HISTORIQUES: Array<{ nom: string; sql: string | null }> = [
  { nom: 'politique « artisan_photos_public_read » (migration 041)', sql: 'CREATE POLICY "artisan_photos_public_read" ON public.artisan_photos FOR SELECT USING (true);' },
  { nom: 'politique « artisan_photos_select » (nom cité par la migration 069)', sql: 'CREATE POLICY artisan_photos_select ON public.artisan_photos FOR SELECT USING (true);' },
  { nom: 'politique ouverte sous un nom inconnu du dépôt', sql: 'CREATE POLICY "Photos visibles par tous" ON public.artisan_photos FOR SELECT USING (true);' },
  { nom: 'base déjà sans politique de lecture ouverte', sql: null },
]

describe(`Migration ${FICHIER} — texte`, () => {
  it('existe', () => {
    expect(existsSync(CHEMIN)).toBe(true)
  })

  /** SQL sans commentaires : une mention en commentaire ne compte pas comme instruction. */
  const sql = existsSync(CHEMIN) ? lireMigration().replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '') : ''

  it('borne l’attente des verrous (DROP POLICY verrouille la table)', () => {
    expect(sql).toMatch(/set\s+local\s+lock_timeout\s*=\s*'5s'\s*;/i)
  })

  it('ne touche qu’aux politiques de public.artisan_photos : ni table, ni droits, ni données, ni stockage', () => {
    expect(sql).not.toMatch(/\b(ALTER|DROP|CREATE)\s+TABLE\b/i)
    expect(sql).not.toMatch(/\b(GRANT|REVOKE|TRUNCATE)\b/i)
    expect(sql).not.toMatch(/\b(INSERT\s+INTO|DELETE\s+FROM)\b/i)
    expect(sql).not.toMatch(/\bUPDATE\s+(?:public\.)?\w+\s+SET\b/i)
    expect(sql).not.toMatch(/\bstorage\./i)
    expect(sql).not.toMatch(/ROW\s+LEVEL\s+SECURITY/i)
    const tablesVisees = [...sql.matchAll(/\bon\s+(public\.\w+)/gi)].map((m) => m[1].toLowerCase())
    expect(tablesVisees.length).toBeGreaterThan(0)
    expect(new Set(tablesVisees)).toEqual(new Set(['public.artisan_photos']))
  })
})

describe(`Migration ${FICHIER} — exécution`, () => {

  it.each(HISTORIQUES)('$nom : après deux passes, seul le propriétaire lit ses photos', async ({ sql }) => {
    db = await creerBase(sql)
    // Avant la migration : la politique ouverte laisse tout lire sans compte (le défaut corrigé).
    expect(await photosVues(db, 'anon')).toEqual(sql ? TOUTES : [])

    const migration = lireMigration()
    await db.exec(migration)
    const apresUnePasse = await politiques(db)
    await db.exec(migration)
    expect(await politiques(db)).toEqual(apresUnePasse)

    expect(await photosVues(db, 'anon')).toEqual([])
    expect(await photosVues(db, 'authenticated', COMPTE_B)).toEqual(['Toiture'])
    expect(await photosVues(db, 'authenticated', COMPTE_A)).toEqual(CELLES_DE_A)
    expect(await photosVues(db, 'service_role')).toEqual(TOUTES)

    // Plus aucune politique de lecture ouverte ; les politiques d'écriture du propriétaire sont intactes.
    expect(apresUnePasse.filter((p) => p.cmd === 'SELECT').map((p) => p.policyname)).toEqual(['artisan_photos_owner_select'])
    expect(apresUnePasse.some((p) => p.qual === 'true')).toBe(false)
    expect(apresUnePasse.map((p) => p.policyname)).toEqual(expect.arrayContaining([
      'artisan_photos_owner_insert', 'artisan_photos_owner_update', 'artisan_photos_owner_delete',
    ]))
  }, 120_000)

  it('aucune ligne modifiée ni supprimée ; le propriétaire modifie encore ses photos, pas celles d’un autre', async () => {
    db = await creerBase('CREATE POLICY "artisan_photos_public_read" ON public.artisan_photos FOR SELECT USING (true);')
    const avant = await db.query('SELECT id, artisan_id, url, label, lat, lng FROM public.artisan_photos ORDER BY url')
    await db.exec(lireMigration())
    const apres = await db.query('SELECT id, artisan_id, url, label, lat, lng FROM public.artisan_photos ORDER BY url')
    expect(apres.rows).toEqual(avant.rows)

    await db.exec(`SELECT set_config('request.jwt.claim.sub', '${COMPTE_A}', false); SET ROLE authenticated;`)
    try {
      const siennes = await db.query(`UPDATE public.artisan_photos SET label = 'Renommée' WHERE artisan_id = '${FICHE_A}' RETURNING id`)
      expect(siennes.rows).toHaveLength(2)
      const autres = await db.query(`UPDATE public.artisan_photos SET label = 'Renommée' WHERE artisan_id = '${FICHE_B}' RETURNING id`)
      expect(autres.rows).toHaveLength(0)
    } finally {
      await db.exec('RESET ROLE;')
    }
  }, 120_000)
})
