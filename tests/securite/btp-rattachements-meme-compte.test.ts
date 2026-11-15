// @vitest-environment node
// tests/securite/btp-rattachements-meme-compte.test.ts — migration 20261115_btp_rattachements_meme_compte.sql, jouée
// sur un vrai PostgreSQL (PGlite, en mémoire) : une fiche BTP ne désigne qu'un chantier, un membre ou une équipe du
// même compte, quelle que soit la voie d'écriture (constat api-coeur-9).
//
// Tables réduites aux colonnes en cause (noms et types du relevé de production du 11/11/2026), politiques d'accès
// « propriétaire seulement » comme en production. Des lignes « anciennes », mal rattachées, existent AVANT la
// migration : elle ne doit ni les lire, ni les modifier, ni empêcher de les réenregistrer telles quelles.
// Aucune donnée réelle : identifiants et libellés inventés.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'

const { PGlite: Base } = await import('@electric-sql/pglite')
const { ECHAFAUDAGE_SUPABASE_SQL, erreurPg, lireMigrationQr } = await import('../helpers/pglite-signalements')

const MIGRATION = '20261115_btp_rattachements_meme_compte.sql'

const A = 'aaaaaaaa-0000-4000-8000-000000000001'
const B = 'bbbbbbbb-0000-4000-8000-000000000001'
const CH_A = 'a1a1a1a1-0000-4000-8000-000000000001'
const CH_A2 = 'a1a1a1a1-0000-4000-8000-000000000002'
const CH_B = 'b2b2b2b2-0000-4000-8000-000000000001'
const CH_B2 = 'b2b2b2b2-0000-4000-8000-000000000002'
const M_A = 'd4d4d4d4-0000-4000-8000-000000000001'
const M_B = 'e5e5e5e5-0000-4000-8000-000000000001'
const EQ_A = 'f6f6f6f6-0000-4000-8000-000000000001'
const EQ_B = 'f6f6f6f6-0000-4000-8000-000000000002'
const EQ_A2 = 'f6f6f6f6-0000-4000-8000-000000000003'
const ANCIEN = '17171717-0000-4000-8000-000000000001'

const TABLES_SQL = `
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $f$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
CREATE TABLE public.chantiers_btp (id uuid PRIMARY KEY, owner_id uuid NOT NULL, titre text NOT NULL);
CREATE TABLE public.membres_btp (id uuid PRIMARY KEY, owner_id uuid NOT NULL, prenom text NOT NULL DEFAULT '', nom text NOT NULL DEFAULT '', equipe_id uuid);
CREATE TABLE public.equipes_btp (id uuid PRIMARY KEY, owner_id uuid NOT NULL, nom text NOT NULL DEFAULT '', chantier_id uuid REFERENCES public.chantiers_btp(id) ON DELETE SET NULL);
CREATE TABLE public.equipe_membres_btp (
  equipe_id uuid NOT NULL REFERENCES public.equipes_btp(id) ON DELETE CASCADE,
  membre_id uuid NOT NULL REFERENCES public.membres_btp(id) ON DELETE CASCADE,
  PRIMARY KEY (equipe_id, membre_id));
CREATE TABLE public.pointages_btp (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, employe text NOT NULL DEFAULT '',
  membre_id uuid REFERENCES public.membres_btp(id) ON DELETE SET NULL, chantier_id uuid REFERENCES public.chantiers_btp(id) ON DELETE SET NULL, notes text);
CREATE TABLE public.depenses_btp (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, label text NOT NULL DEFAULT '',
  chantier_id uuid REFERENCES public.chantiers_btp(id) ON DELETE SET NULL);
CREATE TABLE public.situations_btp (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, chantier text NOT NULL DEFAULT '',
  chantier_id uuid REFERENCES public.chantiers_btp(id));
CREATE TABLE public.retenues_btp (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, chantier_id uuid REFERENCES public.chantiers_btp(id));
CREATE TABLE public.dc4_btp (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, chantier_id uuid REFERENCES public.chantiers_btp(id));
CREATE TABLE public.rapports_btp (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, chantier_id uuid REFERENCES public.chantiers_btp(id) ON DELETE SET NULL);
`

const POLITIQUES_SQL = ['chantiers_btp', 'membres_btp', 'equipes_btp', 'pointages_btp', 'depenses_btp', 'situations_btp', 'retenues_btp', 'dc4_btp', 'rapports_btp']
  .map(t => `ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;
CREATE POLICY ${t}_proprietaire ON public.${t} FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);`)
  .join('\n') + `
ALTER TABLE public.equipe_membres_btp ENABLE ROW LEVEL SECURITY;
CREATE POLICY equipe_membres_proprietaire ON public.equipe_membres_btp FOR ALL
  USING (EXISTS (SELECT 1 FROM public.equipes_btp e WHERE e.id = equipe_id AND e.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.equipes_btp e WHERE e.id = equipe_id AND e.owner_id = auth.uid()));
`

const DONNEES_SQL = `
INSERT INTO public.chantiers_btp VALUES ('${CH_A}', '${A}', 'Cuisine'), ('${CH_A2}', '${A}', 'Salle de bains'),
  ('${CH_B}', '${B}', 'Toiture'), ('${CH_B2}', '${B}', 'Façade');
INSERT INTO public.membres_btp (id, owner_id, prenom) VALUES ('${M_A}', '${A}', 'Paul'), ('${M_B}', '${B}', 'Salarié B');
INSERT INTO public.equipes_btp (id, owner_id, nom) VALUES ('${EQ_A}', '${A}', 'Maçons'), ('${EQ_B}', '${B}', 'Couvreurs'),
  ('${EQ_A2}', '${A}', 'Plaquistes');
-- Lignes anciennes, enregistrées avant la migration et mal rattachées : chantier de B dans une situation de A,
-- salarié de B dans une équipe de A.
INSERT INTO public.situations_btp (id, owner_id, chantier, chantier_id) VALUES ('${ANCIEN}', '${A}', 'Ancienne', '${CH_B}');
INSERT INTO public.equipe_membres_btp VALUES ('${EQ_A2}', '${M_B}');
`

let db: PGlite

/** Code SQLSTATE de l'erreur levée par `sql`, ou null si la requête passe. */
async function codeErreur(sql: string): Promise<string | null> {
  try {
    await db.exec(sql)
    return null
  } catch (e) {
    return erreurPg(e).code ?? 'inconnu'
  }
}

/** Même requête, au nom du compte `compte` (rôle authenticated, politiques d'accès actives). */
async function codeErreurNavigateur(compte: string, sql: string): Promise<string | null> {
  await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${compte}';`)
  try {
    return await codeErreur(sql)
  } finally {
    await db.exec('RESET ROLE; RESET request.jwt.claim.sub;')
  }
}

beforeAll(async () => {
  db = await Base.create()
  await db.exec(ECHAFAUDAGE_SUPABASE_SQL)
  await db.exec(TABLES_SQL)
  await db.exec(POLITIQUES_SQL)
  await db.exec(DONNEES_SQL)
  const migration = lireMigrationQr(MIGRATION)
  await db.exec(migration)
  await db.exec(migration) // rejouable
}, 60_000)

afterAll(async () => {
  await db?.close()
})

describe('migration — rejouable, aucune donnée touchée', () => {
  it('jouée deux fois : un seul déclencheur par table, la ligne ancienne intacte', async () => {
    const { rows } = await db.query<{ table: string; n: number }>(`
      SELECT c.relname AS table, count(*)::int AS n FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
       WHERE NOT t.tgisinternal AND t.tgname LIKE 'btp_%_meme_compte' GROUP BY c.relname ORDER BY c.relname`)
    expect(rows).toEqual([
      'dc4_btp', 'depenses_btp', 'equipe_membres_btp', 'equipes_btp', 'membres_btp', 'pointages_btp', 'rapports_btp', 'retenues_btp', 'situations_btp',
    ].map(table => ({ table, n: 1 })))
    const ancienne = await db.query<{ chantier_id: string }>(`SELECT chantier_id FROM public.situations_btp WHERE id = '${ANCIEN}'`)
    expect(ancienne.rows).toEqual([{ chantier_id: CH_B }])
  })
})

describe('écriture par la route (service role : politiques d’accès contournées)', () => {
  it('pointage sur le chantier d’une autre société : refusé (23503) ; sur un chantier du compte : accepté', async () => {
    expect(await codeErreur(`INSERT INTO public.pointages_btp (owner_id, chantier_id) VALUES ('${A}', '${CH_B}')`)).toBe('23503')
    expect(await codeErreur(`INSERT INTO public.pointages_btp (owner_id, chantier_id) VALUES ('${A}', '${CH_A}')`)).toBeNull()
  })

  it('pointage au nom du salarié d’une autre société, membre rangé dans une équipe d’une autre société : refusés', async () => {
    expect(await codeErreur(`INSERT INTO public.pointages_btp (owner_id, membre_id) VALUES ('${A}', '${M_B}')`)).toBe('23503')
    expect(await codeErreur(`INSERT INTO public.membres_btp (id, owner_id, equipe_id) VALUES (gen_random_uuid(), '${A}', '${EQ_B}')`)).toBe('23503')
    expect(await codeErreur(`INSERT INTO public.membres_btp (id, owner_id, equipe_id) VALUES (gen_random_uuid(), '${A}', '${EQ_A}')`)).toBeNull()
  })

  it('dépense, équipe, retenue, sous-traitant, rapport : même règle', async () => {
    for (const table of ['depenses_btp', 'equipes_btp', 'retenues_btp', 'dc4_btp', 'rapports_btp']) {
      const id = table === 'equipes_btp' ? 'id, ' : ''
      const valeurId = table === 'equipes_btp' ? 'gen_random_uuid(), ' : ''
      expect({ table, code: await codeErreur(`INSERT INTO public.${table} (${id}owner_id, chantier_id) VALUES (${valeurId}'${A}', '${CH_B}')`) })
        .toEqual({ table, code: '23503' })
      expect({ table, code: await codeErreur(`INSERT INTO public.${table} (${id}owner_id, chantier_id) VALUES (${valeurId}'${A}', '${CH_A}')`) })
        .toEqual({ table, code: null })
    }
  })

  it('membre d’une autre société lié à une équipe : refusé ; membre du compte : accepté', async () => {
    expect(await codeErreur(`INSERT INTO public.equipe_membres_btp VALUES ('${EQ_A}', '${M_B}')`)).toBe('23503')
    expect(await codeErreur(`INSERT INTO public.equipe_membres_btp VALUES ('${EQ_A}', '${M_A}')`)).toBeNull()
  })
})

describe('lignes déjà enregistrées', () => {
  it('ligne ancienne mal rattachée : se réenregistre telle quelle, ne peut pas changer pour un autre chantier étranger', async () => {
    expect(await codeErreur(`UPDATE public.situations_btp SET chantier = 'Ancienne (renommée)' WHERE id = '${ANCIEN}'`)).toBeNull()
    expect(await codeErreur(`UPDATE public.situations_btp SET chantier_id = '${CH_B}', chantier = 'Même valeur renvoyée' WHERE id = '${ANCIEN}'`)).toBeNull()
    expect(await codeErreur(`UPDATE public.situations_btp SET chantier_id = '${CH_B2}' WHERE id = '${ANCIEN}'`)).toBe('23503')
    expect(await codeErreur(`UPDATE public.situations_btp SET chantier_id = '${CH_A2}' WHERE id = '${ANCIEN}'`)).toBeNull()
  })

  it('équipe avec un lien ancien vers le salarié d’une autre société : ce que la route écrit (la différence) passe, le lien reste', async () => {
    // Modifier l'équipe comme le fait la route : ajouter puis retirer un membre du compte, sans toucher au lien ancien.
    expect(await codeErreur(`INSERT INTO public.equipe_membres_btp VALUES ('${EQ_A2}', '${M_A}')`)).toBeNull()
    expect(await codeErreur(`DELETE FROM public.equipe_membres_btp WHERE equipe_id = '${EQ_A2}' AND membre_id IN ('${M_A}')`)).toBeNull()
    // Réinsérer le lien ancien est refusé : la route ne supprime donc plus tous les liens pour tout réinsérer.
    expect(await codeErreur(`INSERT INTO public.equipe_membres_btp VALUES ('${EQ_A2}', '${M_B}')`)).toBe('23503')
    const { rows } = await db.query<{ membre_id: string }>(`SELECT membre_id FROM public.equipe_membres_btp WHERE equipe_id = '${EQ_A2}'`)
    expect(rows).toEqual([{ membre_id: M_B }])
  })

  it('suppression d’un chantier : les pointages qui le citaient sont détachés comme avant (ON DELETE SET NULL)', async () => {
    await db.exec(`INSERT INTO public.chantiers_btp VALUES ('c3c3c3c3-0000-4000-8000-000000000001', '${A}', 'Éphémère');
      INSERT INTO public.pointages_btp (owner_id, chantier_id, notes) VALUES ('${A}', 'c3c3c3c3-0000-4000-8000-000000000001', 'détaché');`)
    expect(await codeErreur(`DELETE FROM public.chantiers_btp WHERE id = 'c3c3c3c3-0000-4000-8000-000000000001'`)).toBeNull()
    const { rows } = await db.query<{ chantier_id: string | null }>(`SELECT chantier_id FROM public.pointages_btp WHERE notes = 'détaché'`)
    expect(rows).toEqual([{ chantier_id: null }])
  })
})

describe('écriture au nom d’un compte (rôle authenticated, politiques d’accès actives)', () => {
  it('pointage sur le chantier d’une autre société : refusé ; sur son propre chantier : accepté', async () => {
    expect(await codeErreurNavigateur(A, `INSERT INTO public.pointages_btp (owner_id, chantier_id) VALUES ('${A}', '${CH_B}')`)).toBe('23503')
    expect(await codeErreurNavigateur(A, `INSERT INTO public.pointages_btp (owner_id, chantier_id) VALUES ('${A}', '${CH_A}')`)).toBeNull()
  })

  it('salarié d’une autre société dans sa propre équipe : refusé', async () => {
    expect(await codeErreurNavigateur(A, `INSERT INTO public.equipe_membres_btp VALUES ('${EQ_A}', '${M_B}')`)).toBe('23503')
  })
})
