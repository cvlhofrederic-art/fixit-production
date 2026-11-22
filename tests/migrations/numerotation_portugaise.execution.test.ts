// @vitest-environment node
// tests/migrations/numerotation_portugaise.execution.test.ts
//
// Numérotation portugaise (migrations 20261122_numerotation_portugaise.sql puis 20261122b_numerotation_portugaise_artisans.sql,
// demandes de Frédéric du 22/11/2026 : « Numérotation ORC pour PT, DEV pour FR, faut que ça ait du sens ! Pareil les
// factures », puis « Fais au mieux, sois logique ») : un compte dont une fiche est en portugais, société BTP ou artisan,
// reçoit ORC, FT, NC et FA ; tout autre compte garde DEV, FACT, AV et AC.
//
// EXÉCUTION RÉELLE sur un vrai PostgreSQL (PGlite, en mémoire ; aucune base distante), sous le rôle authenticated et le
// jeton d'une session (request.jwt.claims, comme PostgREST). État de départ : fonction et table de 20260602 et droits
// d'exécution de 20260522 (le texte de la fonction a été relevé identique en production le 22/11/2026, aux espaces
// près), puis les deux migrations jouées dans l'ordre, deux fois (elles doivent se rejouer). Comptes fictifs (UUID aléatoires).

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { randomUUID } from 'crypto'
import { ECHAFAUDAGE_SUPABASE_SQL, lireMigrationQr } from '../helpers/pglite-signalements'
import { dansPointDeSauvegarde, sousRole } from '../helpers/equipe-ecritures-serveur'

const MIGRATIONS = ['20261122_numerotation_portugaise.sql', '20261122b_numerotation_portugaise_artisans.sql']
const DERNIERE_MIGRATION = MIGRATIONS[MIGRATIONS.length - 1]

// auth.uid() de Supabase : le « sub » du jeton de la requête ; tables lues par la fonction, réduites à leurs colonnes utiles.
const ECHAFAUDAGE_NUMEROTATION = `
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
ALTER TABLE auth.users ADD COLUMN raw_app_meta_data jsonb;
CREATE TABLE public.pro_team_members (user_id uuid, company_id uuid, is_active boolean NOT NULL DEFAULT true);
CREATE TABLE public.profiles_artisan (user_id uuid, language text);
`

function extrait(fichier: string, motif: RegExp): string {
  const trouve = motif.exec(lireMigrationQr(fichier))
  if (!trouve) throw new Error(`${fichier} : extrait ${motif} introuvable, relire le banc`)
  return trouve[0]
}

/** Table, policy et fonction de 20260602 (sans l'amorçage), droits d'exécution de 20260522. */
function etatDeDepart(): string {
  const f = '20260602_doc_sequences_create_seed.sql'
  return [
    extrait(f, /CREATE TABLE IF NOT EXISTS doc_sequences \([\s\S]*?\n\);/),
    extrait(f, /ALTER TABLE doc_sequences ENABLE ROW LEVEL SECURITY;/),
    extrait(f, /CREATE OR REPLACE FUNCTION public\.next_doc_number\([\s\S]*?\$function\$;/),
    extrait('20260522_rls_critical_fixes.sql', /REVOKE EXECUTE ON FUNCTION public\.next_doc_number\(uuid, text, integer\) FROM PUBLIC;/),
    extrait('20260522_rls_critical_fixes.sql', /GRANT EXECUTE ON FUNCTION public\.next_doc_number\(uuid, text, integer\) TO authenticated;/),
  ].join('\n')
}

describe('numérotation portugaise (next_doc_number)', () => {
  let db: PGlite
  /** Propriétaire, SECURITY DEFINER, search_path et droits d'exécution de la fonction, avant la migration. */
  let traitsAvant: unknown = null
  const traits = async () => (await db.query(
    `SELECT p.proowner::regrole::text AS proprietaire, p.prosecdef AS secdef, p.proconfig AS config,
            has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
            has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated,
            has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role
     FROM pg_proc p WHERE p.oid = 'public.next_doc_number(uuid,text,integer)'::regprocedure`)).rows[0]
  const corpsFonction = async () => (await db.query<{ src: string }>(
    `SELECT prosrc AS src FROM pg_proc WHERE oid = 'public.next_doc_number(uuid,text,integer)'::regprocedure`)).rows[0]?.src
  const comptes = {
    societePt: randomUUID(), societeFr: randomUUID(), societeSansFiche: randomUUID(), societeBascule: randomUUID(),
    societeDeuxFiches: randomUUID(), societeLangueVide: randomUUID(), societeEn: randomUUID(),
    artisanPt: randomUUID(), artisanFr: randomUUID(), membre: randomUUID(), membrePt: randomUUID(), autre: randomUUID(),
  }
  /** Compte sans rôle dans app_metadata (ancien compte), fiche en portugais. */
  const sansRolePt = randomUUID()

  beforeAll(async () => {
    db = await PGlite.create()
    await db.exec(ECHAFAUDAGE_SUPABASE_SQL + ECHAFAUDAGE_NUMEROTATION)
    const societes = Object.entries(comptes).filter(([nom]) => nom.startsWith('societe')).map(([, id]) => id)
    for (const c of Object.values(comptes)) {
      const role = societes.includes(c) || c === comptes.membre || c === comptes.membrePt ? 'pro_societe' : 'artisan'
      await db.query(`INSERT INTO auth.users (id, raw_app_meta_data) VALUES ($1, jsonb_build_object('role', $2::text))`, [c, role])
    }
    await db.query(`INSERT INTO auth.users (id, raw_app_meta_data) VALUES ($1, NULL)`, [sansRolePt])
    await db.exec(etatDeDepart())
    await db.query(
      `INSERT INTO public.profiles_artisan (user_id, language) VALUES
         ($1, 'pt'), ($2, 'fr'), ($3, 'fr'), ($4, 'pt'), ($4, 'fr'), ($5, NULL), ($6, 'en'), ($7, 'pt'), ($8, 'pt'),
         ($9, 'fr'), ($10, 'pt')`,
      [comptes.societePt, comptes.societeFr, comptes.societeBascule, comptes.societeDeuxFiches, comptes.societeLangueVide,
        comptes.societeEn, comptes.artisanPt, comptes.membrePt, comptes.artisanFr, sansRolePt],
    )
    await db.query(
      `INSERT INTO public.pro_team_members (user_id, company_id, is_active) VALUES ($1, $2, true), ($3, $4, true)`,
      [comptes.membre, comptes.societePt, comptes.membrePt, comptes.societeFr],
    )
    // Une société déjà numérotée en français avant la migration : son compteur continue après le passage au portugais.
    await db.query(`INSERT INTO public.doc_sequences (artisan_user_id, doc_type, year, last_seq) VALUES ($1, 'devis', 2026, 5)`, [comptes.societeBascule])
    traitsAvant = await traits()
    for (let i = 0; i < 2; i++) for (const m of MIGRATIONS) await db.exec(lireMigrationQr(m))
  })
  afterAll(async () => { await db?.close() })
  beforeEach(async () => { await db.exec('BEGIN') })
  afterEach(async () => { await db.exec('ROLLBACK') })

  const numero = async (appelant: string, titulaire: string, type: string) => {
    const appel = await sousRole(db, 'authenticated', appelant, `SELECT public.next_doc_number($1, $2, 2026) AS n`, [titulaire, type])
    return appel.erreur ? `erreur ${appel.erreur.code}` : String(appel.lignes[0]?.n)
  }

  it('société BTP à fiche portugaise : ORC, FT, NC, FA ; chaque série a son compteur', async () => {
    const c = comptes.societePt
    expect(await numero(c, c, 'devis')).toBe('ORC-2026-001')
    expect(await numero(c, c, 'devis')).toBe('ORC-2026-002')
    expect(await numero(c, c, 'facture')).toBe('FT-2026-001')
    expect(await numero(c, c, 'avoir')).toBe('NC-2026-001')
    expect(await numero(c, c, 'acompte')).toBe('FA-2026-001')
  })

  it('société en français, sans fiche, à langue vide ou anglaise : DEV, FACT, AV, AC inchangés', async () => {
    for (const c of [comptes.societeFr, comptes.societeSansFiche, comptes.societeLangueVide, comptes.societeEn]) {
      expect(await numero(c, c, 'devis')).toBe('DEV-2026-001')
      expect(await numero(c, c, 'facture')).toBe('FACT-2026-001')
      expect(await numero(c, c, 'avoir')).toBe('AV-2026-001')
      expect(await numero(c, c, 'acompte')).toBe('AC-2026-001')
    }
  })

  it('artisan à fiche portugaise : ORC, FT, NC, FA, comme une société', async () => {
    const c = comptes.artisanPt
    expect(await numero(c, c, 'devis')).toBe('ORC-2026-001')
    expect(await numero(c, c, 'facture')).toBe('FT-2026-001')
    expect(await numero(c, c, 'avoir')).toBe('NC-2026-001')
    expect(await numero(c, c, 'acompte')).toBe('FA-2026-001')
  })

  it('artisan à fiche française : DEV, FACT, AV, AC inchangés', async () => {
    const c = comptes.artisanFr
    expect(await numero(c, c, 'devis')).toBe('DEV-2026-001')
    expect(await numero(c, c, 'facture')).toBe('FACT-2026-001')
    expect(await numero(c, c, 'avoir')).toBe('AV-2026-001')
    expect(await numero(c, c, 'acompte')).toBe('AC-2026-001')
  })

  it('compte sans rôle dans app_metadata, fiche en portugais : ORC (le rôle ne compte plus)', async () => {
    expect(await numero(sansRolePt, sansRolePt, 'devis')).toBe('ORC-2026-001')
  })

  it('société passée au portugais : le compteur continue, sans doublon ni trou (DEV-2026-005 puis ORC-2026-006)', async () => {
    const c = comptes.societeBascule
    await db.query(`UPDATE public.profiles_artisan SET language = 'pt' WHERE user_id = $1`, [c])
    expect(await numero(c, c, 'devis')).toBe('ORC-2026-006')
  })

  it('compte à deux fiches, l\'une en portugais : préfixes portugais', async () => {
    const c = comptes.societeDeuxFiches
    expect(await numero(c, c, 'devis')).toBe('ORC-2026-001')
  })

  it('c\'est la fiche du titulaire de la série qui compte, pas celle de l\'appelant', async () => {
    expect(await numero(comptes.membre, comptes.societePt, 'devis')).toBe('ORC-2026-001')
    expect(await numero(comptes.membrePt, comptes.societeFr, 'devis')).toBe('DEV-2026-001')
  })

  it('autorisation inchangée : un autre compte refusé (42501), un type inconnu refusé par la contrainte (23514)', async () => {
    expect(await numero(comptes.autre, comptes.societePt, 'devis')).toBe('erreur 42501')
    expect(await numero(comptes.societePt, comptes.societePt, 'bon_de_commande')).toBe('erreur 23514')
  })

  it('propriétaire, SECURITY DEFINER, search_path et droits d\'exécution inchangés par la migration', async () => {
    expect(traitsAvant).toMatchObject({ secdef: true, config: ['search_path=public'], authenticated: true })
    expect(await traits()).toEqual(traitsAvant)
  })

  it('appel anonyme toujours refusé par le corps de la fonction', async () => {
    const appel = await sousRole(db, 'anon', null, `SELECT public.next_doc_number($1, 'devis', 2026) AS n`, [comptes.societePt])
    expect(appel.erreur?.code).toBe('42501')
  })

  it('garde : propriétaire de la fonction filtré par la RLS des fiches, migration arrêtée et fonction inchangée', async () => {
    const corps = await corpsFonction()
    await db.exec(`CREATE ROLE proprietaire_soumis_rls NOLOGIN;
      GRANT USAGE ON SCHEMA auth TO proprietaire_soumis_rls;
      GRANT SELECT ON public.profiles_artisan, auth.users TO proprietaire_soumis_rls;
      ALTER TABLE public.profiles_artisan ENABLE ROW LEVEL SECURITY;
      ALTER FUNCTION public.next_doc_number(uuid, text, integer) OWNER TO proprietaire_soumis_rls`)
    const { erreur } = await dansPointDeSauvegarde(db, () => db.exec(lireMigrationQr(DERNIERE_MIGRATION)), false)
    expect(erreur?.message).toMatch(/filtrée par la RLS/)
    expect(await corpsFonction()).toBe(corps)
  })
})
