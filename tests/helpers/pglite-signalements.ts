// tests/helpers/pglite-signalements.ts — vrai PostgreSQL (PGlite, WebAssembly, en mémoire) pour EXÉCUTER les migrations
// d'AJ Signalement dans Vitest, sans service ni base distante (cahier des charges de la PR 3, décision F9).
//
// Échafaudage MINIMAL : il ne reproduit que ce que la chaîne des migrations signalements_qr suppose de Supabase :
//   - les rôles anon, authenticated, service_role (nommés par les REVOKE / GRANT ; service_role contourne la RLS) ;
//   - les droits par défaut que Supabase donne à ces rôles sur le schéma public (sans eux, les REVOKE des migrations
//     ne retireraient rien et l'essai ne montrerait pas l'état réel de la production) ;
//   - auth.users réduite à sa clé : 20261112 y pose une clé étrangère (signalements_qr_gestionnaires.user_id).
// Volontairement ABSENT : extensions (gen_random_uuid, sha256, hashtextextended sont du noyau PostgreSQL), fonctions
// auth.*, set_updated_at (20261104 la crée si elle manque), rôles de PostgREST.
// Chaque migration est appliquée en UN seul exec, comme l'éditeur SQL de Supabase (transaction implicite), fins de
// ligne ramenées à LF (le fichier du dépôt). Aucune donnée réelle : exemples en exemple.test.

import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'fs'
import { join } from 'path'

export const ECHAFAUDAGE_SUPABASE_SQL = `
CREATE ROLE anon NOLOGIN NOINHERIT;
CREATE ROLE authenticated NOLOGIN NOINHERIT;
CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
`

/** Chaîne des migrations d'AJ Signalement, dans l'ordre d'application (ordre des noms de fichier). */
export const MIGRATIONS_SIGNALEMENTS_QR = [
  '20261104_signalements_qr.sql',
  '20261106_signalements_qr_confirmation.sql',
  '20261106_signalements_qr_geoloc_qualite.sql',
  '20261111_signalements_qr_gestionnaires.sql',
  '20261112_signalements_qr_acces_gestionnaires.sql',
  '20261113_signalements_qr_diffusion.sql',
] as const

const DOSSIER_MIGRATIONS = join(process.cwd(), 'supabase/migrations')

/** Texte d'une migration du dépôt : BOM retiré, CRLF → LF (copie de travail Windows). */
export function lireMigrationQr(fichier: string): string {
  let texte = readFileSync(join(DOSSIER_MIGRATIONS, fichier), 'utf-8')
  if (texte.charCodeAt(0) === 0xfeff) texte = texte.slice(1)
  return texte.replace(/\r\n/g, '\n')
}

/** Erreur PostgreSQL réduite à ce que les tests comparent : SQLSTATE et message. */
export interface ErreurPg { code: string | undefined; message: string }

export function erreurPg(e: unknown): ErreurPg {
  if (e && typeof e === 'object') {
    const o = e as { code?: unknown; message?: unknown }
    return { code: typeof o.code === 'string' ? o.code : undefined, message: typeof o.message === 'string' ? o.message : String(e) }
  }
  return { code: undefined, message: String(e) }
}

/** Échec d'une migration : fichier, passe (1 ou 2) et erreur PostgreSQL. */
export class ErreurMigrationQr extends Error {
  readonly fichier: string
  readonly passe: number
  readonly code: string | undefined
  constructor(fichier: string, passe: number, erreur: ErreurPg) {
    super(`Échec de ${fichier} (passe ${passe}) : [${erreur.code ?? '?'}] ${erreur.message}`)
    this.name = 'ErreurMigrationQr'
    this.fichier = fichier
    this.passe = passe
    this.code = erreur.code
  }
}

export interface OptionsBaseQr {
  /** Nombre de passes de la chaîne entière (2 = rejouabilité). */
  passes?: number
  /** Appelé entre la première passe et la suivante (empreinte du schéma, par exemple). */
  apresPremierePasse?: (db: PGlite) => Promise<void>
}

/** Base PGlite neuve : échafaudage, puis la chaîne des migrations, `passes` fois de suite. */
export async function creerBaseSignalementsQr(options: OptionsBaseQr = {}): Promise<PGlite> {
  const passes = options.passes ?? 1
  const migrations = MIGRATIONS_SIGNALEMENTS_QR.map((fichier) => ({ fichier, sql: lireMigrationQr(fichier) }))
  const db = await PGlite.create()
  try {
    await db.exec(ECHAFAUDAGE_SUPABASE_SQL)
    for (let passe = 1; passe <= passes; passe++) {
      if (passe === 2 && options.apresPremierePasse) await options.apresPremierePasse(db)
      for (const m of migrations) {
        try {
          await db.exec(m.sql)
        } catch (e) {
          throw new ErreurMigrationQr(m.fichier, passe, erreurPg(e))
        }
      }
    }
  } catch (e) {
    await db.close()
    throw e
  }
  return db
}

/**
 * Empreinte du schéma public (colonnes, contraintes, index, triggers, fonctions et leurs droits, tables, RLS et droits,
 * lignes de copropriétés) : deux passes de la chaîne doivent donner la même.
 */
export async function empreinteSchemaQr(db: PGlite): Promise<Map<string, string>> {
  const { rows } = await db.query<{ genre: string; nom: string; def: string }>(`
    SELECT 'colonne' AS genre, c.relname || '.' || a.attname AS nom,
           format_type(a.atttypid, a.atttypmod) || CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END
             || coalesce(' DEFAULT ' || pg_get_expr(d.adbin, d.adrelid), '') AS def
      FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
      LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
     WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
    UNION ALL
    SELECT 'contrainte', conrelid::regclass::text || '.' || conname,
           pg_get_constraintdef(oid) || CASE WHEN convalidated THEN '' ELSE ' [NON VALIDÉE]' END
      FROM pg_constraint WHERE connamespace = 'public'::regnamespace
    UNION ALL
    SELECT 'index', i.indexrelid::regclass::text, pg_get_indexdef(i.indexrelid)
      FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid WHERE c.relnamespace = 'public'::regnamespace
    UNION ALL
    SELECT 'trigger', t.tgrelid::regclass::text || '.' || t.tgname, pg_get_triggerdef(t.oid)
      FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid WHERE NOT t.tgisinternal AND c.relnamespace = 'public'::regnamespace
    UNION ALL
    SELECT 'fonction', p.oid::regprocedure::text, md5(pg_get_functiondef(p.oid)) || ' acl=' || coalesce(p.proacl::text, 'défaut')
      FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
    UNION ALL
    SELECT 'table', c.relname, 'rls=' || c.relrowsecurity || ' acl=' || coalesce(c.relacl::text, 'défaut')
      FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'S')
    UNION ALL
    SELECT 'données', 'signalements_qr_coproprietes (lignes)', count(*)::text FROM signalements_qr_coproprietes`)
  return new Map(rows.map((r) => [`${r.genre} ${r.nom}`, r.def]))
}
