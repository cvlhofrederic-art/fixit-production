// @vitest-environment node
// tests/migrations/pro_equipe_categorie_derogations.execution.test.ts
//
// EXÉCUTION RÉELLE, sur PostgreSQL (PGlite, en mémoire), des deux migrations du 25/11/2026 de l'équipe BTP, à partir
// de l'état du dépôt (048 puis les ALTER POLICY de 20260610 sur pro_role_permissions, puis 20261115) :
//   - 20261125_pro_team_members_job_title.sql : colonne de catégorie professionnelle, 80 caractères au plus, rejouable ;
//   - 20261125b_pro_role_permissions_ecritures_serveur.sql : AVANT, un salarié connecté s'attribue FULL en écrivant
//     lui-même une dérogation (la faille est reproduite) ; APRÈS, jouée deux fois, toute écriture d'un client est
//     refusée, la lecture du membre reste, et le serveur (service_role) écrit toujours.
// Comptes fictifs (UUID aléatoires).

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { randomUUID } from 'crypto'
import { ECHAFAUDAGE_SUPABASE_SQL, lireMigrationQr } from '../helpers/pglite-signalements'
import { droitsEffectifs, sousRole as sousRoleEnPointDeSauvegarde, type RoleApi } from '../helpers/equipe-ecritures-serveur'

const AUTH_UID_SQL = `
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
`

/**
 * 048 telle quelle, puis les ALTER POLICY de 20260610 sur une ligne (les quatre de pro_team_members, les trois
 * d'écriture de pro_role_permissions ; celle de lecture, sur plusieurs lignes, garde sa forme de 048, équivalente),
 * puis 20261115.
 */
function etatDuDepot(): string {
  const alters = lireMigrationQr('20260610_rls_initplan_wrap.sql').match(
    /^ALTER POLICY "(?:pro_team_(?:select|insert|update|delete)|pro_perms_(?:insert|update|delete))" ON public\.pro_(?:team_members|role_permissions) [^\n]*;$/gm)
  if (alters?.length !== 7) throw new Error('ALTER POLICY de 20260610 introuvables : relire le banc')
  return [lireMigrationQr('048_pro_team_rbac.sql'), ...alters, lireMigrationQr('20261115_pro_equipe_ecritures_serveur.sql')].join('\n')
}

const FORGEE = `INSERT INTO public.pro_role_permissions (company_id, member_id, module_id, access_level)
                VALUES ((SELECT auth.uid()), $1, 'settings', 'FULL')`

describe('migrations du 25/11/2026 de l’équipe BTP, sur l’état du dépôt', () => {
  let db: PGlite
  const comptes = { gerant: randomUUID(), ouvrier: randomUUID() }
  let ligneOuvrier = ''

  /** sousRole pose un point de sauvegarde : il lui faut une transaction, validée ensuite (l'état reste d'un test à l'autre). */
  const sousRole = async (base: PGlite, role: RoleApi, sub: string | null, requete: string, params: unknown[] = []) => {
    await base.exec('BEGIN')
    try { return await sousRoleEnPointDeSauvegarde(base, role, sub, requete, params) } finally { await base.exec('COMMIT') }
  }
  const jouer = async (fichier: string) => { await db.exec(`BEGIN;\n${lireMigrationQr(fichier)}\nCOMMIT;`) }
  const derogationsForgees = async () => Number((await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.pro_role_permissions WHERE company_id = $1`, [comptes.ouvrier])).rows[0].n)

  beforeAll(async () => {
    db = await PGlite.create()
    await db.exec(ECHAFAUDAGE_SUPABASE_SQL + AUTH_UID_SQL)
    await db.exec(etatDuDepot())
    ligneOuvrier = (await db.query<{ id: string }>(
      `INSERT INTO public.pro_team_members (company_id, user_id, email, full_name, role, accepted_at)
       VALUES ($1, $2, 'ouvrier@exemple.test', 'Ouvrier', 'OUVRIER', now()) RETURNING id`,
      [comptes.gerant, comptes.ouvrier])).rows[0].id
    await db.query(`INSERT INTO public.pro_role_permissions (company_id, member_id, module_id, access_level)
                    VALUES ($1, $2, 'devis', 'NONE')`, [comptes.gerant, ligneOuvrier])
  }, 120_000)
  afterAll(async () => { await db?.close() })

  it('AVANT 20261125b : l’ouvrier lit sa ligne d’équipe puis s’écrit une dérogation FULL (faille reproduite)', async () => {
    const lecture = await sousRole(db, 'authenticated', comptes.ouvrier, 'SELECT id FROM public.pro_team_members')
    expect(lecture.lignes).toEqual([{ id: ligneOuvrier }])
    const ecriture = await sousRole(db, 'authenticated', comptes.ouvrier, FORGEE, [ligneOuvrier])
    expect(ecriture.erreur).toBeNull()
    expect(ecriture.nb).toBe(1)
    await db.query('DELETE FROM public.pro_role_permissions WHERE company_id = $1', [comptes.ouvrier])
  })

  it('20261125b jouée deux fois : plus aucune écriture d’un client, lecture et serveur intacts', async () => {
    await jouer('20261125b_pro_role_permissions_ecritures_serveur.sql')
    await jouer('20261125b_pro_role_permissions_ecritures_serveur.sql')

    for (const compte of [comptes.ouvrier, comptes.gerant]) {
      expect((await sousRole(db, 'authenticated', compte, FORGEE, [ligneOuvrier])).erreur?.code).toBe('42501')
      expect((await sousRole(db, 'authenticated', compte, `UPDATE public.pro_role_permissions SET access_level = 'FULL'`)).erreur?.code).toBe('42501')
      expect((await sousRole(db, 'authenticated', compte, 'DELETE FROM public.pro_role_permissions')).erreur?.code).toBe('42501')
    }
    expect(await derogationsForgees()).toBe(0)

    const droits = await droitsEffectifs(db, 'public.pro_role_permissions')
    for (const role of ['anon', 'authenticated'] as const) {
      expect(droits[role]).toMatchObject({ SELECT: true, INSERT: false, UPDATE: false, DELETE: false, TRUNCATE: false })
    }
    const policies = (await db.query<{ policyname: string }>(
      `SELECT policyname FROM pg_policies WHERE tablename = 'pro_role_permissions' ORDER BY 1`)).rows.map((p) => p.policyname)
    expect(policies).toEqual(['pro_perms_select'])

    // Le membre lit toujours ses droits ; le serveur écrit toujours.
    const sesDroits = await sousRole(db, 'authenticated', comptes.ouvrier, 'SELECT module_id, access_level FROM public.pro_role_permissions')
    expect(sesDroits.lignes).toEqual([{ module_id: 'devis', access_level: 'NONE' }])
    const serveur = await sousRole(db, 'service_role', null,
      `INSERT INTO public.pro_role_permissions (company_id, member_id, module_id, access_level) VALUES ($1, $2, 'pointage', 'FULL')`,
      [comptes.gerant, ligneOuvrier])
    expect(serveur.erreur).toBeNull()
  })

  it('20261125 jouée deux fois : colonne job_title, 1 à 80 caractères, null admis, lignes existantes intactes', async () => {
    await jouer('20261125_pro_team_members_job_title.sql')
    await jouer('20261125_pro_team_members_job_title.sql')
    const ecrire = (valeur: string | null) => db.query(
      'UPDATE public.pro_team_members SET job_title = $1 WHERE id = $2', [valeur, ligneOuvrier]).then(() => null, (e: { code?: string }) => e.code)

    expect((await db.query<{ job_title: string | null }>(
      'SELECT job_title FROM public.pro_team_members WHERE id = $1', [ligneOuvrier])).rows[0].job_title).toBeNull()
    expect(await ecrire('Servente')).toBeNull()
    expect(await ecrire('a'.repeat(80))).toBeNull()
    expect(await ecrire(null)).toBeNull()
    expect(await ecrire('a'.repeat(81))).toBe('23514')
    expect(await ecrire('')).toBe('23514')
    const contraintes = (await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_constraint WHERE conname = 'pro_team_members_job_title_longueur'`)).rows[0].n
    expect(contraintes).toBe(1)
  })
})
