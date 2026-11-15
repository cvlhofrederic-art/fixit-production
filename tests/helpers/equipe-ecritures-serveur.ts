// tests/helpers/equipe-ecritures-serveur.ts
//
// Outils des tests d'une table d'équipe dont les écritures sont réservées aux routes serveur (suite de R36, décision
// VF-A-02) : pro_team_members (20261115_pro_equipe_ecritures_serveur.sql) ; syndic_team_members (T20) peut s'y
// brancher. Deux familles, sans dépendance à une table précise :
//   - lecture des migrations du dépôt : SQL sans commentaires, instructions, historique d'une policy, réouvertures
//     d'écriture aux clients dans les migrations postérieures ;
//   - base PGlite : appel sous un rôle de l'API (jeton de session simulé comme PostgREST) dans un point de
//     sauvegarde, parties 1 et 2 du scénario de contrôle telles que Frédéric les lance, droits effectifs des rôles.

import type { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { erreurPg, type ErreurPg } from './pglite-signalements'

const DOSSIER_MIGRATIONS = join(process.cwd(), 'supabase/migrations')

// ── Lecture des migrations ────────────────────────────────────────────────────────────────────────────────────────

/** SQL sans commentaires : une mention en commentaire ne compte pas comme instruction. */
export function sqlSansCommentaires(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '')
}

/** Texte d'une migration du dépôt, sans ses commentaires. */
export function migrationSansCommentaires(fichier: string): string {
  return sqlSansCommentaires(readFileSync(join(DOSSIER_MIGRATIONS, fichier), 'utf-8'))
}

/** Instructions d'un SQL sans commentaires (découpage aux points-virgules, blocs DO compris). */
export function instructionsSql(sql: string): string[] {
  return sql.split(';').map((s) => s.trim()).filter(Boolean)
}

/** Texte à chercher tel quel dans une expression régulière (tous les métacaractères échappés). */
export function litteralRegex(texte: string): string {
  return texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Migrations du dépôt dans l'ordre où la CLI Supabase les applique (nom de fichier). */
export function migrationsDansLOrdre(): string[] {
  const parNom = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
  return readdirSync(DOSSIER_MIGRATIONS).filter((f) => f.endsWith('.sql')).sort(parNom)
}

/** Chaque CREATE, ALTER ou DROP POLICY qui nomme `policy`, dans l'ordre d'application des migrations. */
export function historiquePolicy(policy: string): Array<{ fichier: string; verbe: string }> {
  const motif = new RegExp(`\\b(CREATE|ALTER|DROP)\\s+POLICY\\s+(?:IF\\s+EXISTS\\s+)?"?${litteralRegex(policy)}"?(?![\\w])`, 'gi')
  return migrationsDansLOrdre().flatMap((fichier) =>
    [...migrationSansCommentaires(fichier).matchAll(motif)].map((m) => ({ fichier, verbe: m[1].toUpperCase() })))
}

/**
 * Vrai si l'instruction `i` (SQL sans commentaires) rouvrirait l'écriture de `table` aux clients :
 *   - policy autre que FOR SELECT posée sur la table (sans FOR, elle vaut FOR ALL), schéma entre guillemets compris
 *     (forme qu'écrit l'éditeur de Supabase) ; une policy d'une autre table qui lit la table ne compte pas ;
 *   - GRANT d'un privilège d'écriture (avant ON) dont un bénéficiaire (après TO) est anon, authenticated ou PUBLIC, sur
 *     la table ou sur toutes les tables du schéma : le schéma « public » du nom de la table ne compte pas comme PUBLIC,
 *     ni « ALL TABLES » comme privilège ;
 *   - vue qui lit la table sans security_invoker vrai (option absente ou fausse) : elle écrirait avec les droits de son
 *     propriétaire ; vue existante repassée aux droits de son propriétaire (ALTER VIEW, ou ALTER TABLE, admis sur une
 *     vue, avec security_invoker faux ou RESET) : la table n'y est pas nommée, toute vue est donc visée ;
 *   - règle qui nomme la table, posée sur elle ou sur une autre table ou vue : ses actions s'exécutent avec les droits
 *     du propriétaire de la relation qui la porte, même sur une vue security_invoker.
 * Hors de portée (le découpage aux points-virgules coupe les corps $$…$$ et les règles à plusieurs actions) : fonction
 * SECURITY DEFINER, déclencheur, actions d'une règle après la première ; la partie 1 du scénario de contrôle les montre
 * sur une vraie base. Chaque expression reste simple : jamais deux quantificateurs voisins qui puissent lire les mêmes
 * caractères (aucun retour arrière super-linéaire).
 */
export function rouvreLEcriture(table: string, i: string): boolean {
  const nommeLaTable = new RegExp(`\\b${litteralRegex(table)}\\b`, 'i')
  const poseeSurLaTable = new RegExp(`\\bON\\s+(?:"?public"?\\.)?"?${litteralRegex(table)}\\b`, 'i')
  const apresGrant = i.split(/\bGRANT\b/i).slice(1).join(' ')
  const privileges = apresGrant.split(/\bON\b/i)[0]
  const beneficiaires = apresGrant.split(/\bTO\b/i).slice(1).join(' ')
  // security_invoker vrai : l'option seule, ou = true, on, yes, 1 ; toute autre valeur (false, off, no, 0) vaut faux.
  const invokerVrai = /\bsecurity_invoker\s*(=\s*'?(true|on|yes|1)'?\s*)?[,)]/i.test(i)
  const policyEcriture = /\bCREATE\s+POLICY\b/i.test(i) && poseeSurLaTable.test(i) && !/\bFOR\s+SELECT\b/i.test(i)
  const grantEcriture = /\bGRANT\b/i.test(i)
    && /\b(ALL|INSERT|UPDATE|DELETE|TRUNCATE)\b/i.test(privileges)
    && /\b(anon|authenticated|PUBLIC)\b/i.test(beneficiaires)
    && (nommeLaTable.test(i) || /\bALL\s+TABLES\s+IN\s+SCHEMA\b/i.test(i))
  const vueDuProprietaire = /\bCREATE\s+(OR\s+REPLACE\s+)?VIEW\b/i.test(i) && nommeLaTable.test(i) && !invokerVrai
  const vueRepassee = /\bALTER\s+(VIEW|TABLE)\b/i.test(i) && /\bsecurity_invoker\b/i.test(i)
    && (/\bRESET\b/i.test(i) || !invokerVrai)
  const regle = /\bCREATE\s+(OR\s+REPLACE\s+)?RULE\b/i.test(i) && nommeLaTable.test(i)
  return policyEcriture || grantEcriture || vueDuProprietaire || vueRepassee || regle
}

/** Instructions des migrations postérieures à `depuis` qui rouvriraient l'écriture de `table` (voir rouvreLEcriture). */
export function reouverturesEcriture(table: string, depuis: string): string[] {
  return migrationsDansLOrdre().filter((f) => f > depuis).flatMap((fichier) =>
    instructionsSql(migrationSansCommentaires(fichier))
      .filter((i) => rouvreLEcriture(table, i))
      .map((i) => `${fichier} : ${i.slice(0, 120)}`))
}

// ── Base PGlite ───────────────────────────────────────────────────────────────────────────────────────────────────

export type RoleApi = 'anon' | 'authenticated' | 'service_role'
export const ROLES_API: readonly RoleApi[] = ['anon', 'authenticated', 'service_role']
export const PRIVILEGES_TABLE = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] as const

export interface ResultatAppel { lignes: Record<string, unknown>[]; nb: number; erreur: ErreurPg | null }

/**
 * Exécute `travail` dans un point de sauvegarde de la transaction en cours : en cas d'erreur, tout ce qu'il a fait est
 * annulé et l'erreur rendue, la transaction continue. `garder: false` annule même en cas de succès.
 */
export async function dansPointDeSauvegarde<T>(
  db: PGlite,
  travail: () => Promise<T>,
  garder = true,
): Promise<{ valeur: T | null; erreur: ErreurPg | null }> {
  await db.exec('SAVEPOINT essai_equipe')
  let resultat: { valeur: T | null; erreur: ErreurPg | null }
  try {
    resultat = { valeur: await travail(), erreur: null }
  } catch (e) {
    resultat = { valeur: null, erreur: erreurPg(e) }
  }
  if (!garder || resultat.erreur) await db.exec('ROLLBACK TO SAVEPOINT essai_equipe')
  await db.exec('RELEASE SAVEPOINT essai_equipe')
  return resultat
}

/** Requête telle que PostgREST la passerait : rôle de l'API et jeton de la session (« sub »), dans un point de sauvegarde. */
export async function sousRole(
  db: PGlite,
  role: RoleApi,
  sub: string | null,
  requete: string,
  params: unknown[] = [],
): Promise<ResultatAppel> {
  const { valeur, erreur } = await dansPointDeSauvegarde(db, async () => {
    await db.query(`SELECT set_config('request.jwt.claims', $1, true)`, [sub ? JSON.stringify({ sub, role }) : ''])
    await db.exec(`SET LOCAL ROLE ${role}`)
    const reponse = await db.query<Record<string, unknown>>(requete, params)
    await db.exec('RESET ROLE')
    return reponse
  })
  return { lignes: valeur?.rows ?? [], nb: valeur?.affectedRows ?? 0, erreur }
}

/** Droits effectifs des rôles de l'API sur une table, privilège par privilège. */
export async function droitsEffectifs(db: PGlite, table: string): Promise<Record<RoleApi, Record<string, boolean>>> {
  const droits = { anon: {}, authenticated: {}, service_role: {} } as Record<RoleApi, Record<string, boolean>>
  for (const role of ROLES_API) {
    for (const privilege of PRIVILEGES_TABLE) {
      const { rows } = await db.query<{ accorde: boolean }>('SELECT has_table_privilege($1, $2, $3) AS accorde', [role, table, privilege])
      droits[role][privilege] = rows[0].accorde
    }
  }
  return droits
}

/** Droits attendus d'une table écrite par le serveur seul : lecture pour tous, écriture pour service_role. */
export function droitsServeurSeul(): Record<RoleApi, Record<string, boolean>> {
  const ligne = (ecriture: boolean) => Object.fromEntries(PRIVILEGES_TABLE.map((p) => [p, p === 'SELECT' || ecriture]))
  return { anon: ligne(false), authenticated: ligne(false), service_role: ligne(true) }
}

/** Les deux requêtes d'un scénario de contrôle (supabase/tests/…) : partie 1 (état) et partie 2 (bloc de test). */
export function partiesDuScenario(chemin: string): { etat: string; test: string } {
  const texte = readFileSync(join(process.cwd(), chemin), 'utf-8').replace(/\r\n/g, '\n')
  const etat = /-- 1\. État\n(select json_build_object[\s\S]*?\) as etat;)/.exec(texte)
  const test = /-- 2\. Test\n(do \$\$[\s\S]*?\n\$\$;)/.exec(texte)
  if (!etat || !test) throw new Error(`Scénario ${chemin} : parties 1 et 2 introuvables`)
  return { etat: etat[1], test: test[1] }
}

/** Partie 1 du scénario (lecture seule) : l'objet JSON qu'affiche l'éditeur SQL. */
export async function etatDuScenario<T>(db: PGlite, requeteEtat: string): Promise<T> {
  return (await db.query<{ etat: T }>(requeteEtat)).rows[0].etat
}

/** Partie 2 du scénario : message de l'erreur qui termine le bloc ; tout ce qu'il a fait est annulé, quoi qu'il arrive. */
export async function bilanDuScenario(db: PGlite, blocTest: string): Promise<string> {
  const { erreur } = await dansPointDeSauvegarde(db, () => db.exec(blocTest), false)
  return erreur?.message ?? 'le bloc s’est terminé sans erreur'
}
