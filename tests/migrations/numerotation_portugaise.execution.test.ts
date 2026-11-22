// @vitest-environment node
// tests/migrations/numerotation_portugaise.execution.test.ts
//
// Numérotation portugaise (migration 20261122_numerotation_portugaise.sql, demande de Frédéric du 22/11/2026 :
// « Numérotation ORC pour PT, DEV pour FR, faut que ça ait du sens ! Pareil les factures ») : une fiche en
// portugais reçoit ORC, FT, NC et FA ; toute autre fiche garde DEV, FACT, AV et AC.
//
// EXÉCUTION RÉELLE sur un vrai PostgreSQL (PGlite, en mémoire ; aucune base distante), sous le rôle authenticated et le
// jeton d'une session (request.jwt.claims, comme PostgREST). État de départ : fonction, table et droits de 20260602 et
// 20260522 (relevés identiques en production le 22/11/2026), puis la migration jouée deux fois (elle doit se rejouer).
// Comptes fictifs (UUID aléatoires) ; aucune donnée réelle.

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { randomUUID } from 'crypto'
import { ECHAFAUDAGE_SUPABASE_SQL, lireMigrationQr } from '../helpers/pglite-signalements'
import { sousRole } from '../helpers/equipe-ecritures-serveur'

const MIGRATION = '20261122_numerotation_portugaise.sql'

// auth.uid() de Supabase : le « sub » du jeton de la requête ; tables lues par la fonction, réduites à leurs colonnes utiles.
const ECHAFAUDAGE_NUMEROTATION = `
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
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
  const comptes = { portugal: randomUUID(), france: randomUUID(), sansFiche: randomUUID(), bascule: randomUUID(), membre: randomUUID(), autre: randomUUID() }

  beforeAll(async () => {
    db = await PGlite.create()
    await db.exec(ECHAFAUDAGE_SUPABASE_SQL + ECHAFAUDAGE_NUMEROTATION)
    for (const c of Object.values(comptes)) await db.query('INSERT INTO auth.users (id) VALUES ($1)', [c])
    await db.exec(etatDeDepart())
    await db.query(
      `INSERT INTO public.profiles_artisan (user_id, language) VALUES ($1, 'pt'), ($2, 'fr'), ($3, 'fr')`,
      [comptes.portugal, comptes.france, comptes.bascule],
    )
    await db.query(`INSERT INTO public.pro_team_members (user_id, company_id, is_active) VALUES ($1, $2, true)`, [comptes.membre, comptes.portugal])
    // Une fiche déjà numérotée en français avant la migration : son compteur continue après le passage au portugais.
    await db.query(`INSERT INTO public.doc_sequences (artisan_user_id, doc_type, year, last_seq) VALUES ($1, 'devis', 2026, 5)`, [comptes.bascule])
    traitsAvant = await traits()
    for (let i = 0; i < 2; i++) await db.exec(lireMigrationQr(MIGRATION))
  })
  afterAll(async () => { await db?.close() })
  beforeEach(async () => { await db.exec('BEGIN') })
  afterEach(async () => { await db.exec('ROLLBACK') })

  const numero = async (appelant: string, titulaire: string, type: string) => {
    const appel = await sousRole(db, 'authenticated', appelant, `SELECT public.next_doc_number($1, $2, 2026) AS n`, [titulaire, type])
    return appel.erreur ? `erreur ${appel.erreur.code}` : String(appel.lignes[0]?.n)
  }

  it('fiche en portugais : ORC, FT, NC, FA ; chaque série a son compteur', async () => {
    const c = comptes.portugal
    expect(await numero(c, c, 'devis')).toBe('ORC-2026-001')
    expect(await numero(c, c, 'devis')).toBe('ORC-2026-002')
    expect(await numero(c, c, 'facture')).toBe('FT-2026-001')
    expect(await numero(c, c, 'avoir')).toBe('NC-2026-001')
    expect(await numero(c, c, 'acompte')).toBe('FA-2026-001')
  })

  it('fiche en français ou compte sans fiche : DEV, FACT, AV, AC inchangés', async () => {
    for (const c of [comptes.france, comptes.sansFiche]) {
      expect(await numero(c, c, 'devis')).toBe('DEV-2026-001')
      expect(await numero(c, c, 'facture')).toBe('FACT-2026-001')
      expect(await numero(c, c, 'avoir')).toBe('AV-2026-001')
      expect(await numero(c, c, 'acompte')).toBe('AC-2026-001')
    }
  })

  it('fiche passée au portugais : le compteur continue, sans doublon ni trou (DEV-2026-005 puis ORC-2026-006)', async () => {
    const c = comptes.bascule
    await db.query(`UPDATE public.profiles_artisan SET language = 'pt' WHERE user_id = $1`, [c])
    expect(await numero(c, c, 'devis')).toBe('ORC-2026-006')
  })

  it('membre actif de l\'équipe d\'une société portugaise : numéro de la série de la société, en ORC', async () => {
    expect(await numero(comptes.membre, comptes.portugal, 'devis')).toBe('ORC-2026-001')
  })

  it('autorisation inchangée : un autre compte est refusé, un type inconnu aussi', async () => {
    expect(await numero(comptes.autre, comptes.portugal, 'devis')).toBe('erreur 42501')
    expect(await numero(comptes.portugal, comptes.portugal, 'bon_de_commande')).toMatch(/^erreur /)
  })

  it('propriétaire, SECURITY DEFINER, search_path et droits d\'exécution inchangés par la migration', async () => {
    expect(traitsAvant).toMatchObject({ secdef: true, config: ['search_path=public'], authenticated: true })
    expect(await traits()).toEqual(traitsAvant)
  })

  it('appel anonyme toujours refusé par le corps de la fonction', async () => {
    const appel = await sousRole(db, 'anon', null, `SELECT public.next_doc_number($1, 'devis', 2026) AS n`, [comptes.portugal])
    expect(appel.erreur?.code).toBe('42501')
  })
})
