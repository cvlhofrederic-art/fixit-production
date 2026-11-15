// @vitest-environment node
// tests/migrations/profiles_artisan_lecture_anonyme.execution.test.ts
//
// EXÉCUTION RÉELLE de la migration 20261115_profiles_artisan_lecture_anonyme.sql (NON exécutée en production : c'est
// Frédéric qui la lance, après le déploiement du code) sur un vrai PostgreSQL (PGlite, en mémoire, aucune base distante).
// Table reconstruite avec les 90 colonnes de production et la politique de lecture des fiches actives, rôles et droits
// par défaut de Supabase. Vérifié :
//   - avant : droits par défaut de Supabase, toutes les colonnes lisibles par un visiteur sans compte (anon) ;
//   - après, en deux passes (rejouable) : anon ne lit que les colonnes des pages publiques (lib/fiche-publique.ts),
//     une lecture de toutes les colonnes est refusée, les comptes connectés lisent comme avant, la politique des lignes
//     tient toujours (fiche inactive invisible) ;
//   - les pages publiques et les lectures serveur avec la clé publique passent encore ;
//   - un droit de lecture venu d'ailleurs (PUBLIC) fait échouer le script sans rien changer ;
//   - table absente : rien à faire, aucune erreur.
// Aucune donnée réelle : une fiche d'exemple.

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'fs'
import { join } from 'path'
import { COLONNES_LECTURE_ANONYME, SELECT_FICHE_PUBLIQUE, SELECT_RECHERCHE_PUBLIQUE, colonnesSelection } from '@/lib/fiche-publique'
import { COLONNES_PROFILES_ARTISAN_PRIVEES, COLONNES_PROFILES_ARTISAN_PRODUCTION } from '../helpers/colonnes-profiles-artisan'
import { ECHAFAUDAGE_SUPABASE_SQL, erreurPg } from '../helpers/pglite-signalements'

const MIGRATION = (() => {
  let texte = readFileSync(join(process.cwd(), 'supabase/migrations/20261115_profiles_artisan_lecture_anonyme.sql'), 'utf-8')
  if (texte.charCodeAt(0) === 0xfeff) texte = texte.slice(1)
  return texte.replace(/\r\n/g, '\n')
})()

const TYPES: Record<string, string> = {
  id: 'uuid PRIMARY KEY', user_id: 'uuid', active: 'boolean', verified: 'boolean', categories: 'text[]',
  intervention_zones: 'jsonb', paiement_modes: 'jsonb', kyc_checks: 'jsonb', rating_avg: 'numeric', rating_count: 'integer',
  zone_radius_km: 'integer', latitude: 'double precision', longitude: 'double precision', hourly_rate: 'numeric',
}

// Table de production reconstruite : 90 colonnes, RLS et politique « fiches actives » (relevé du 15/11/2026).
const TABLE_PRODUCTION_SQL = `
CREATE TABLE public.profiles_artisan (
  ${COLONNES_PROFILES_ARTISAN_PRODUCTION.map((c) => `${c} ${TYPES[c] ?? 'text'}`).join(',\n  ')}
);
CREATE TABLE public.services (id uuid PRIMARY KEY, artisan_id uuid, name text, active boolean);
ALTER TABLE public.profiles_artisan ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active artisan profiles" ON public.profiles_artisan FOR SELECT USING (active = true);
INSERT INTO public.profiles_artisan (id, user_id, active, verified, slug, company_name, phone, email, language, kbis_url,
  id_document_verso_url, paiement_modes, kyc_status, kyc_score)
VALUES ('4f0b7c1e-2a3d-4e5f-8a9b-0c1d2e3f4a5b', '550e8400-e29b-41d4-a716-446655440000', true, true, 'batiment-sud-exemple',
  'BATIMENT SUD EXEMPLE', '04 00 00 00 00', 'contact@batiment-sud.test', 'fr', 'exemple/kbis/exemple.pdf',
  'exemple/identity-verso/exemple.png', '[{"type":"virement","iban":"IBAN-EXEMPLE"}]', 'approved', '80'),
  ('1b4e28ba-2fa1-11d2-883f-0016d3cca427', null, false, true, 'fiche-inactive', 'FICHE INACTIVE', null, null, 'fr', null,
  null, null, null, null);
`

async function base(avecTable = true): Promise<PGlite> {
  const db = await PGlite.create()
  await db.exec(ECHAFAUDAGE_SUPABASE_SQL)
  if (avecTable) await db.exec(TABLE_PRODUCTION_SQL)
  return db
}

/** Lecture sous un rôle, comme PostgREST (SET ROLE), puis retour au superutilisateur. */
async function lireEnTantQue(db: PGlite, role: string, sql: string) {
  await db.exec(`SET ROLE ${role}`)
  try {
    return await db.query<Record<string, unknown>>(sql)
  } finally {
    await db.exec('RESET ROLE')
  }
}

async function colonnesLisibles(db: PGlite, role: string): Promise<string[]> {
  const { rows } = await db.query<{ colonne: string }>(
    `SELECT column_name AS colonne FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles_artisan'
        AND has_column_privilege($1, 'public.profiles_artisan', column_name, 'SELECT')
      ORDER BY column_name`, [role])
  return rows.map((r) => r.colonne)
}

describe('liste du script = liste du code', () => {
  it('le tableau colonnes_publiques de la migration est exactement COLONNES_LECTURE_ANONYME', () => {
    const tableau = MIGRATION.match(/colonnes_publiques constant text\[\] := array\[([\s\S]*?)\];/)
    expect(tableau).not.toBeNull()
    const colonnes = [...(tableau?.[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
    expect(colonnes).toEqual([...COLONNES_LECTURE_ANONYME])
    expect(colonnes).toHaveLength(26)
  })
})

describe('exécution sur une table reconstruite comme en production', () => {
  let db: PGlite

  beforeAll(async () => {
    db = await base()
  }, 60_000)

  afterAll(async () => {
    await db.close()
  })

  it('avant : droits par défaut de Supabase, anon lit toutes les colonnes', async () => {
    expect(await colonnesLisibles(db, 'anon')).toHaveLength(COLONNES_PROFILES_ARTISAN_PRODUCTION.length)
    const { rows } = await lireEnTantQue(db, 'anon', 'SELECT kbis_url FROM public.profiles_artisan')
    expect(rows).toEqual([{ kbis_url: 'exemple/kbis/exemple.pdf' }])
  })

  it('deux passes sans erreur ; anon ne lit plus que les colonnes des pages publiques', async () => {
    await db.exec(MIGRATION)
    await db.exec(MIGRATION)

    expect(await colonnesLisibles(db, 'anon')).toEqual([...COLONNES_LECTURE_ANONYME])
    expect((await colonnesLisibles(db, 'anon')).filter((c) => COLONNES_PROFILES_ARTISAN_PRIVEES.includes(c))).toEqual([])
  })

  it.each(['kbis_url', 'id_document_verso_url', 'paiement_modes', 'kyc_status', '*'])('anon : SELECT %s refusé', async (colonne) => {
    const erreur = await lireEnTantQue(db, 'anon', `SELECT ${colonne} FROM public.profiles_artisan`).then(() => null, erreurPg)
    expect(erreur?.code).toBe('42501')
  })

  it('anon : la fiche publique et la recherche se lisent, la politique des lignes tient (fiche inactive invisible)', async () => {
    const fiche = await lireEnTantQue(db, 'anon',
      `SELECT ${SELECT_FICHE_PUBLIQUE} FROM public.profiles_artisan WHERE slug = 'batiment-sud-exemple'`)
    expect(fiche.rows).toHaveLength(1)
    expect(fiche.rows[0]).toMatchObject({ company_name: 'BATIMENT SUD EXEMPLE', phone: '04 00 00 00 00', email: 'contact@batiment-sud.test' })

    const recherche = await lireEnTantQue(db, 'anon',
      `SELECT ${colonnesSelection(SELECT_RECHERCHE_PUBLIQUE).join(', ')} FROM public.profiles_artisan WHERE active = true AND language = 'fr'`)
    expect(recherche.rows.map((r) => r.slug)).toEqual(['batiment-sud-exemple'])

    const inactive = await lireEnTantQue(db, 'anon', `SELECT id FROM public.profiles_artisan WHERE slug = 'fiche-inactive'`)
    expect(inactive.rows).toEqual([])
  })

  it('anon : lectures serveur avec la clé publique (métadonnées, JSON-LD, existence, sitemap)', async () => {
    for (const sql of [
      'SELECT company_name, bio, categories, company_city, rating_avg, rating_count, language, profile_photo_url, slug FROM public.profiles_artisan',
      'SELECT company_name, categories, company_city, rating_avg, rating_count, language, latitude, longitude, profile_photo_url, slug, phone FROM public.profiles_artisan',
      'SELECT id, slug, language, legal_form FROM public.profiles_artisan',
      'SELECT id, slug, language FROM public.profiles_artisan WHERE verified = true AND active = true',
    ]) {
      const { rows } = await lireEnTantQue(db, 'anon', sql)
      expect(rows).toHaveLength(1)
    }
  })

  it('comptes connectés et serveur : lecture inchangée', async () => {
    expect(await colonnesLisibles(db, 'authenticated')).toHaveLength(COLONNES_PROFILES_ARTISAN_PRODUCTION.length)
    expect(await colonnesLisibles(db, 'service_role')).toHaveLength(COLONNES_PROFILES_ARTISAN_PRODUCTION.length)
    const { rows } = await lireEnTantQue(db, 'authenticated', `SELECT kbis_url FROM public.profiles_artisan WHERE active = true`)
    expect(rows).toEqual([{ kbis_url: 'exemple/kbis/exemple.pdf' }])
  })
})

describe('cas particuliers', () => {
  it('un droit de lecture accordé à PUBLIC : le script s’arrête en erreur et rien n’est changé', async () => {
    const db = await base()
    try {
      await db.exec('GRANT SELECT ON public.profiles_artisan TO PUBLIC')
      const erreur = await db.exec(MIGRATION).then(() => null, erreurPg)
      expect(erreur?.message).toContain('Colonnes encore lisibles sans compte après le retrait')
      expect(erreur?.message).toContain('kbis_url')
      // Transaction annulée : anon garde sa lecture directe d'avant (droit sur la table entière).
      const { rows } = await db.query<{ acl: string }>(`SELECT relacl::text AS acl FROM pg_class WHERE oid = 'public.profiles_artisan'::regclass`)
      expect(rows[0].acl).toMatch(/anon=[a-zA-Z]*r/)
    } finally {
      await db.close()
    }
  }, 60_000)

  it('table absente : aucune erreur, rien à faire', async () => {
    const db = await base(false)
    try {
      await expect(db.exec(MIGRATION)).resolves.toBeDefined()
    } finally {
      await db.close()
    }
  }, 60_000)
})
