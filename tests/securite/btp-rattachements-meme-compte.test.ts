// @vitest-environment node
// tests/securite/btp-rattachements-meme-compte.test.ts — migration 20261115_btp_rattachements_meme_compte.sql, jouée
// sur un vrai PostgreSQL (PGlite, en mémoire) : une fiche BTP ne désigne qu'un chantier, un membre ou une équipe du
// même compte, quelle que soit la voie d'écriture (constat api-coeur-9).
//
// Tables réduites aux colonnes en cause (noms et types du relevé de production du 11/11/2026, plus
// chantiers_btp.membres_ids de la migration 20261116), politiques d'accès « propriétaire seulement » comme en
// production. Des lignes « anciennes », mal rattachées, existent AVANT la migration : elle ne doit ni les lire, ni les
// modifier, ni empêcher de les réenregistrer telles quelles. Les autres tables, qui n'ont pas de colonne membres_ids,
// montrent que son contrôle ne gêne pas une table qui ne la porte pas (base d'avant la migration 20261116).
// Aucune donnée réelle : identifiants et libellés inventés.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
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
const M_A2 = 'd4d4d4d4-0000-4000-8000-000000000002'
const M_B = 'e5e5e5e5-0000-4000-8000-000000000001'
/** Employé supprimé avant la migration, resté dans la liste d'un chantier (membres_ids n'a pas de clé étrangère). */
const M_SUPPRIME = 'd4d4d4d4-0000-4000-8000-0000000000ff'
const EQ_A = 'f6f6f6f6-0000-4000-8000-000000000001'
const EQ_B = 'f6f6f6f6-0000-4000-8000-000000000002'
const EQ_A2 = 'f6f6f6f6-0000-4000-8000-000000000003'
const ANCIEN = '17171717-0000-4000-8000-000000000001'

const TABLES_SQL = `
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $f$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
CREATE TABLE public.chantiers_btp (id uuid PRIMARY KEY, owner_id uuid NOT NULL, titre text NOT NULL,
  membres_ids uuid[] NOT NULL DEFAULT '{}'::uuid[]);
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
INSERT INTO public.membres_btp (id, owner_id, prenom) VALUES ('${M_A}', '${A}', 'Paul'), ('${M_A2}', '${A}', 'Léa'),
  ('${M_B}', '${B}', 'Salarié B');
INSERT INTO public.equipes_btp (id, owner_id, nom) VALUES ('${EQ_A}', '${A}', 'Maçons'), ('${EQ_B}', '${B}', 'Couvreurs'),
  ('${EQ_A2}', '${A}', 'Plaquistes');
-- Lignes anciennes, enregistrées avant la migration et mal rattachées : chantier de B dans une situation de A,
-- salarié de B dans une équipe de A.
INSERT INTO public.situations_btp (id, owner_id, chantier, chantier_id) VALUES ('${ANCIEN}', '${A}', 'Ancienne', '${CH_B}');
INSERT INTO public.equipe_membres_btp VALUES ('${EQ_A2}', '${M_B}');
-- Chantier de A dont la liste d'employés porte, avant la migration, le salarié de B et un employé supprimé depuis.
UPDATE public.chantiers_btp SET membres_ids = ARRAY['${M_B}', '${M_SUPPRIME}', '${M_A}']::uuid[] WHERE id = '${CH_A2}';
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
      'chantiers_btp', 'dc4_btp', 'depenses_btp', 'equipe_membres_btp', 'equipes_btp', 'membres_btp', 'pointages_btp', 'rapports_btp',
      'retenues_btp', 'situations_btp',
    ].map(table => ({ table, n: 1 })))
    const ancienne = await db.query<{ chantier_id: string }>(`SELECT chantier_id FROM public.situations_btp WHERE id = '${ANCIEN}'`)
    expect(ancienne.rows).toEqual([{ chantier_id: CH_B }])
    const liste = await db.query<{ membres_ids: string[] }>(`SELECT membres_ids FROM public.chantiers_btp WHERE id = '${CH_A2}'`)
    expect(liste.rows).toEqual([{ membres_ids: [M_B, M_SUPPRIME, M_A] }])
  })
})

describe('employés affectés à un chantier (membres_ids, migration 20261116)', () => {
  it('création : employés du compte acceptés, liste vide aussi ; un salarié d’une autre société refusé (23503)', async () => {
    expect(await codeErreur(`INSERT INTO public.chantiers_btp (id, owner_id, titre, membres_ids) VALUES (gen_random_uuid(), '${A}', 'Garage', ARRAY['${M_A}', '${M_A2}']::uuid[])`)).toBeNull()
    expect(await codeErreur(`INSERT INTO public.chantiers_btp (id, owner_id, titre) VALUES (gen_random_uuid(), '${A}', 'Sans employé')`)).toBeNull()
    expect(await codeErreur(`INSERT INTO public.chantiers_btp (id, owner_id, titre, membres_ids) VALUES (gen_random_uuid(), '${A}', 'Garage', ARRAY['${M_A}', '${M_B}']::uuid[])`)).toBe('23503')
    expect(await codeErreur(`INSERT INTO public.chantiers_btp (id, owner_id, titre, membres_ids) VALUES (gen_random_uuid(), '${A}', 'Garage', ARRAY['${M_SUPPRIME}']::uuid[])`)).toBe('23503')
  })

  it('modification : seul un employé AJOUTÉ est contrôlé ; la liste ancienne se réenregistre et se réduit librement', async () => {
    // Autre champ modifié : la liste ancienne (salarié de B, employé supprimé) n'est pas remise en cause.
    expect(await codeErreur(`UPDATE public.chantiers_btp SET titre = 'Salle de bains (renommée)' WHERE id = '${CH_A2}'`)).toBeNull()
    // Liste renvoyée avec un employé du compte en plus : acceptée.
    expect(await codeErreur(`UPDATE public.chantiers_btp SET membres_ids = ARRAY['${M_B}', '${M_SUPPRIME}', '${M_A}', '${M_A2}']::uuid[] WHERE id = '${CH_A2}'`)).toBeNull()
    // Salarié d'une autre société ajouté : refusé, la liste ne bouge pas.
    expect(await codeErreur(`UPDATE public.chantiers_btp SET membres_ids = array_append(membres_ids, '${M_B}'::uuid) WHERE id = '${CH_A}'`)).toBe('23503')
    // Employés retirés : accepté.
    expect(await codeErreur(`UPDATE public.chantiers_btp SET membres_ids = ARRAY['${M_A}']::uuid[] WHERE id = '${CH_A2}'`)).toBeNull()
    const { rows } = await db.query<{ id: string; membres_ids: string[] }>(
      `SELECT id, membres_ids FROM public.chantiers_btp WHERE id IN ('${CH_A}', '${CH_A2}') ORDER BY id`)
    expect(rows).toEqual([{ id: CH_A, membres_ids: [] }, { id: CH_A2, membres_ids: [M_A] }])
  })

  it('au nom d’un compte : le salarié d’une autre société est refusé, le sien accepté', async () => {
    expect(await codeErreurNavigateur(A, `INSERT INTO public.chantiers_btp (id, owner_id, titre, membres_ids) VALUES (gen_random_uuid(), '${A}', 'Cave', ARRAY['${M_B}']::uuid[])`)).toBe('23503')
    expect(await codeErreurNavigateur(A, `INSERT INTO public.chantiers_btp (id, owner_id, titre, membres_ids) VALUES (gen_random_uuid(), '${A}', 'Cave', ARRAY['${M_A}']::uuid[])`)).toBeNull()
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

/**
 * Bloc SQL du retour arrière d'une migration, tel qu'écrit dans docs/rollback-procedures.md : premier bloc ```sql de la
 * section dont le titre cite le fichier de la migration (deux migrations portent la date 20261115).
 */
function procedureDeRetour(fichier: string): string {
  const texte = readFileSync(join(process.cwd(), 'docs/rollback-procedures.md'), 'utf-8').replace(/\r\n/g, '\n')
  const section = texte.split(/\n(?=## )/).find(s => s.split('\n', 1)[0].includes(fichier))
  if (!section) throw new Error(`docs/rollback-procedures.md : aucune section dont le titre cite ${fichier}`)
  const bloc = /```sql\n([\s\S]*?)\n```/.exec(section)
  if (!bloc) throw new Error(`docs/rollback-procedures.md : aucun bloc SQL dans la section de ${fichier}`)
  return bloc[1]
}

// Retour arrière que Frédéric lancerait dans l'éditeur SQL (relecture adverse du 17/11/2026), joué tel qu'écrit sur une
// base à part où la migration est appliquée. La règle reste appliquée par la route /api/btp
// (tests/api/btp-ecriture-rattachements.test.ts).
describe('retour arrière de la migration (docs/rollback-procedures.md)', () => {
  let base: PGlite

  beforeAll(async () => {
    base = await Base.create()
    await base.exec(ECHAFAUDAGE_SUPABASE_SQL)
    await base.exec(TABLES_SQL)
    await base.exec(POLITIQUES_SQL)
    await base.exec(DONNEES_SQL)
    await base.exec(lireMigrationQr(MIGRATION))
  }, 60_000)

  afterAll(async () => {
    await base?.close()
  })

  it('retire les dix déclencheurs et les deux fonctions sans toucher aux lignes, se rejoue, et la base n’impose plus la règle', async () => {
    const retour = procedureDeRetour(MIGRATION)
    await base.exec(retour)
    await base.exec(retour) // rejouable

    const declencheurs = await base.query(`SELECT tgname FROM pg_trigger WHERE NOT tgisinternal AND tgname LIKE 'btp_%_meme_compte'`)
    expect(declencheurs.rows).toEqual([])
    const fonctions = await base.query(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname LIKE 'btp_%_meme_compte'`)
    expect(fonctions.rows).toEqual([])
    const ancienne = await base.query<{ chantier_id: string }>(`SELECT chantier_id FROM public.situations_btp WHERE id = '${ANCIEN}'`)
    expect(ancienne.rows).toEqual([{ chantier_id: CH_B }])
    const liste = await base.query<{ membres_ids: string[] }>(`SELECT membres_ids FROM public.chantiers_btp WHERE id = '${CH_A2}'`)
    expect(liste.rows).toEqual([{ membres_ids: [M_B, M_SUPPRIME, M_A] }])
    // Plus de déclencheur : un rattachement hors du compte n'est plus refusé par la base.
    await base.exec(`INSERT INTO public.pointages_btp (owner_id, chantier_id) VALUES ('${A}', '${CH_B}')`)
  })

  it('garde le délai d’attente des verrous de la migration, posé avant le premier DROP', () => {
    // Chaque DROP TRIGGER verrouille toute la table, lectures comprises, jusqu'à la fin du retour : sans ce délai,
    // l'éditeur SQL attendrait sans limite derrière une transaction longue (contre-relecture du 17/11/2026).
    const delai = lireMigrationQr(MIGRATION).split('\n').find(l => /^set local lock_timeout\b/i.test(l))
    expect(delai).toBe("set local lock_timeout = '5s';")
    const lignes = procedureDeRetour(MIGRATION).split('\n')
    const premierDrop = lignes.findIndex(l => /^DROP\b/i.test(l))
    expect(premierDrop).toBeGreaterThan(0)
    expect(lignes.slice(0, premierDrop)).toContain(delai)
  })

  it('l’en-tête de la migration renvoie à cette procédure, sous le titre exact de sa section', () => {
    // Celui qui ouvre la migration pour la lancer voit où se trouve sa marche arrière, sans la confondre avec celle de
    // l'autre migration 20261115 (équipe BTP), comme dans les migrations voisines.
    const lignes = lireMigrationQr(MIGRATION).split('\n')
    const entete = lignes.slice(0, lignes.findIndex(l => l.trim() !== '' && !l.startsWith('--')))
    const renvois = entete.flatMap(l => /^-- Retour arrière : docs\/rollback-procedures\.md, section « (.+) »\.$/.exec(l)?.[1] ?? [])
    expect(renvois).toHaveLength(1)
    const titres = readFileSync(join(process.cwd(), 'docs/rollback-procedures.md'), 'utf-8').replace(/\r\n/g, '\n')
      .split('\n').filter(l => l.startsWith('## ')).map(l => l.slice(3))
    expect(titres).toContain(renvois[0])
    expect(renvois[0]).toContain(MIGRATION) // la section dont le bloc SQL est joué plus haut
  })
})
