// @vitest-environment node
// tests/migrations/syndic_equipe_ecritures_serveur.execution.test.ts
//
// EXÉCUTION RÉELLE de 20261114_syndic_equipe_ecritures_serveur.sql (T20, DT9 élargie) sur un vrai PostgreSQL (PGlite,
// WebAssembly, en mémoire ; aucun service, aucune base distante), avec le rôle authenticated et le jeton d'une session
// de navigateur (request.jwt.claims, comme PostgREST), sur les deux états de départ possibles :
//   - « production » : table, contrainte du rôle et policies telles que constatées en lecture seule le 14/11/2026 ;
//   - « dépôt » : la migration 20260527 du dépôt, la section 12 de la 041, puis le retrait de member_update_self (#649).
// Scénario A23 du dossier M0 (D4) : AVANT T20, les écritures du titulaire passent (la faille est reproduite) ; APRÈS T20,
// jouée deux fois, elles sont refusées, la lecture reste, et les routes serveur (service_role) écrivent toujours.
// Comptes fictifs (UUID aléatoires) ; aucune donnée réelle.

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { randomUUID } from 'crypto'
import { readFileSync } from 'fs'
import { join } from 'path'
import { ECHAFAUDAGE_SUPABASE_SQL, erreurPg, lireMigrationQr, type ErreurPg } from '../helpers/pglite-signalements'

const T20 = '20261114_syndic_equipe_ecritures_serveur.sql'

/** Les deux requêtes du scénario que Frédéric lance dans l'éditeur SQL (supabase/tests/…) : état, puis bloc de test. */
function scenario(): { etat: string; test: string } {
  const texte = readFileSync(join(process.cwd(), 'supabase/tests/syndic_equipe_ecritures_serveur.sql'), 'utf-8').replace(/\r\n/g, '\n')
  const etat = texte.match(/-- 1\. État\n(select json_build_object[\s\S]*?\) as etat;)/)
  const test = texte.match(/-- 2\. Test\n(do \$\$[\s\S]*?\n\$\$;)/)
  if (!etat || !test) throw new Error('Scénario supabase/tests/syndic_equipe_ecritures_serveur.sql : parties 1 et 2 introuvables')
  return { etat: etat[1], test: test[1] }
}

interface EtatTable {
  policies_ecriture: number
  rls_active: boolean
  droits: Array<{ role: string; select: boolean; insert: boolean; update: boolean; delete: boolean; truncate: boolean }>
}

// auth.uid() de Supabase : le « sub » du jeton de la requête.
const AUTH_UID_SQL = `
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
`

// Production, constat en lecture seule du 14/11/2026 (VT-A-01) : 14 colonnes, contrainte du rôle à 5 valeurs,
// UNIQUE (invite_token), RLS active, quatre policies permissives pour le rôle public.
const PRODUCTION_SQL = `
CREATE TABLE public.syndic_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id uuid NOT NULL,
  user_id uuid,
  email text,
  full_name text,
  phone text,
  role text NOT NULL DEFAULT 'syndic_gestionnaire'
    CONSTRAINT syndic_team_members_role_check
    CHECK (role IN ('syndic_admin', 'syndic_tech', 'syndic_secretaire', 'syndic_gestionnaire', 'syndic_comptable')),
  invite_token text UNIQUE,
  invite_sent_at timestamptz,
  accepted_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  custom_modules jsonb
);
ALTER TABLE public.syndic_team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY syndic_team_select ON public.syndic_team_members FOR SELECT USING (cabinet_id = auth.uid() OR user_id = auth.uid());
CREATE POLICY syndic_team_insert ON public.syndic_team_members FOR INSERT WITH CHECK (cabinet_id = auth.uid());
CREATE POLICY syndic_team_update ON public.syndic_team_members FOR UPDATE USING (cabinet_id = auth.uid());
CREATE POLICY syndic_team_delete ON public.syndic_team_members FOR DELETE USING (cabinet_id = auth.uid());
`

/** Dépôt : 20260527 telle quelle, section 12 de la 041 (lecture et écriture du cabinet), puis le DROP de #649. */
function depotSql(): string {
  const creation = lireMigrationQr('20260527_syndic_team_members.sql')
  const section041 = lireMigrationQr('041_rls_complete_audit.sql').match(/-- ── 12\. syndic_team_members[\s\S]*?(?=\n-- ── 13\.)/)
  const retrait649 = lireMigrationQr('20261104_rls_policies_roles_serveur.sql').match(
    /DROP POLICY IF EXISTS "syndic_team_members_member_update_self" ON public\.syndic_team_members;/,
  )
  if (!section041 || !retrait649) throw new Error('Section 12 de la 041 ou DROP de #649 introuvable : relire le banc')
  return `${creation}\n${section041[0]}\n${retrait649[0]}\n`
}

const ETATS = [
  { nom: 'production (constat du 14/11/2026)', sql: () => PRODUCTION_SQL, lecture: ['syndic_team_select'], ecritureAvant: 3 },
  {
    nom: 'dépôt (20260527, 041, #649)',
    sql: depotSql,
    lecture: ['syndic_team_cabinet_read', 'syndic_team_members_member_select'],
    ecritureAvant: 2,
  },
]

type Role = 'anon' | 'authenticated' | 'service_role'
interface Appel { lignes: Record<string, unknown>[]; nb: number; erreur: ErreurPg | null }

describe.each(ETATS)('état de départ : $nom', ({ sql, lecture, ecritureAvant }) => {
  let db: PGlite
  const TITULAIRE = randomUUID() // compte du cabinet (cabinet_id)
  const MEMBRE = randomUUID() // membre accepté du cabinet
  const AUTRE = randomUUID() // compte étranger au cabinet
  const AUTRE_CABINET = randomUUID()
  let ligneMembre = ''
  let ligneInvitation = ''

  beforeAll(async () => {
    db = await PGlite.create()
    await db.exec(ECHAFAUDAGE_SUPABASE_SQL + AUTH_UID_SQL)
    await db.exec(sql())
    // Données d'exemple, posées en propriétaire de la base (comme les routes, hors RLS).
    for (const id of [TITULAIRE, MEMBRE, AUTRE, AUTRE_CABINET]) {
      await db.query('INSERT INTO auth.users (id, email) VALUES ($1, $2)', [id, `${id}@exemple.test`])
    }
    const membre = await db.query<{ id: string }>(
      `INSERT INTO public.syndic_team_members (cabinet_id, user_id, email, full_name, role, accepted_at, is_active)
       VALUES ($1, $2, 'membre@exemple.test', 'Membre Exemple', 'syndic_gestionnaire', now(), true) RETURNING id`,
      [TITULAIRE, MEMBRE],
    )
    const invitation = await db.query<{ id: string }>(
      `INSERT INTO public.syndic_team_members (cabinet_id, email, full_name, role, invite_token, invite_sent_at, is_active)
       VALUES ($1, 'invite@exemple.test', 'Invité Exemple', 'syndic_comptable', 'jeton-exemple', now(), true) RETURNING id`,
      [TITULAIRE],
    )
    ligneMembre = membre.rows[0].id
    ligneInvitation = invitation.rows[0].id
  }, 120_000)
  afterAll(async () => { await db?.close() })
  beforeEach(async () => { await db.exec('BEGIN') })
  afterEach(async () => { await db.exec('ROLLBACK') })

  /** Requête sous un rôle de l'API et un jeton, dans un point de sauvegarde : l'erreur est rendue, la transaction continue. */
  async function sous(role: Role, sub: string | null, requete: string, params: unknown[] = []): Promise<Appel> {
    await db.exec('SAVEPOINT appel')
    try {
      await db.query(`SELECT set_config('request.jwt.claims', $1, true)`, [sub ? JSON.stringify({ sub, role }) : ''])
      await db.exec(`SET LOCAL ROLE ${role}`)
      const r = await db.query<Record<string, unknown>>(requete, params)
      await db.exec('RESET ROLE')
      await db.exec('RELEASE SAVEPOINT appel')
      return { lignes: r.rows, nb: r.affectedRows ?? 0, erreur: null }
    } catch (e) {
      await db.exec('ROLLBACK TO SAVEPOINT appel')
      await db.exec('RELEASE SAVEPOINT appel')
      return { lignes: [], nb: 0, erreur: erreurPg(e) }
    }
  }

  const ligne = async (id: string) =>
    (await db.query<{ cabinet_id: string; user_id: string | null; role: string }>(
      'SELECT cabinet_id, user_id, role FROM public.syndic_team_members WHERE id = $1', [id])).rows[0]
  const nombreLignes = async () =>
    Number((await db.query<{ n: number }>('SELECT count(*)::int AS n FROM public.syndic_team_members')).rows[0].n)

  /** Partie 1 du scénario (lecture seule), telle que Frédéric la lance. */
  const etatScenario = async (): Promise<EtatTable> =>
    (await db.query<{ etat: EtatTable }>(scenario().etat)).rows[0].etat

  /** Partie 2 du scénario : message de l'erreur qui termine le bloc (« BILAN … » si tout est refusé). */
  async function bilanScenario(): Promise<string> {
    await db.exec('SAVEPOINT scenario')
    let message = 'le bloc s’est terminé sans erreur'
    try {
      await db.exec(scenario().test)
    } catch (e) {
      message = erreurPg(e).message
    }
    await db.exec('ROLLBACK TO SAVEPOINT scenario')
    await db.exec('RELEASE SAVEPOINT scenario')
    return message
  }

  // Cas d'écriture de A23 (2 à 4) et suppression : passent avant T20, refusés après.
  const inserePourSoi = () => sous('authenticated', AUTRE,
    `INSERT INTO public.syndic_team_members (cabinet_id, user_id, is_active) VALUES ($1, $1, true)`, [AUTRE])
  const inserePourUnAutre = () => sous('authenticated', TITULAIRE,
    `INSERT INTO public.syndic_team_members (cabinet_id, user_id, role, is_active) VALUES ($1, $2, 'syndic_admin', true)`,
    [TITULAIRE, AUTRE])
  const changeRoleInvitation = () => sous('authenticated', TITULAIRE,
    `UPDATE public.syndic_team_members SET role = 'syndic_admin' WHERE id = $1`, [ligneInvitation])
  const supprimeMembre = () => sous('authenticated', TITULAIRE,
    'DELETE FROM public.syndic_team_members WHERE id = $1', [ligneMembre])
  const deplaceSaLigne = () => sous('authenticated', MEMBRE,
    'UPDATE public.syndic_team_members SET cabinet_id = $1 WHERE id = $2', [AUTRE_CABINET, ligneMembre])

  describe('avant T20 : la faille est reproduite', () => {
    it('(2) un compte s’ajoute lui-même dans son propre « cabinet »', async () => {
      const r = await inserePourSoi()
      expect(r.erreur).toBeNull()
      expect(await nombreLignes()).toBe(3)
    })

    it('(3) le titulaire rattache le compte de quelqu’un d’autre à son équipe, en administrateur', async () => {
      const r = await inserePourUnAutre()
      expect(r.erreur).toBeNull()
      expect(await nombreLignes()).toBe(3)
    })

    it('(4) le titulaire change le rôle d’une invitation déjà envoyée', async () => {
      const r = await changeRoleInvitation()
      expect(r.erreur).toBeNull()
      expect((await ligne(ligneInvitation)).role).toBe('syndic_admin')
    })

    it('le titulaire supprime une ligne de son équipe hors de l’application', async () => {
      const r = await supprimeMembre()
      expect(r.erreur).toBeNull()
      expect(await ligne(ligneMembre)).toBeUndefined()
    })

    it('(1) un membre ne déplace pas sa ligne vers un autre cabinet (déjà fermé, non-régression)', async () => {
      await deplaceSaLigne()
      expect((await ligne(ligneMembre)).cabinet_id).toBe(TITULAIRE)
    })

    it('le scénario de contrôle le voit : partie 1 compte les policies d’écriture, partie 2 ne rend pas de BILAN', async () => {
      const etat = await etatScenario()
      expect(Number(etat.policies_ecriture)).toBe(ecritureAvant)
      expect(etat.droits.find((d) => d.role === 'authenticated')).toMatchObject({ insert: true, update: true, delete: true })
      expect(await bilanScenario()).not.toMatch(/^BILAN/)
      expect(await nombreLignes()).toBe(2)
    })
  })

  describe('après T20, jouée deux fois', () => {
    let etatPremierePasse = ''

    const etat = async () => JSON.stringify((await db.query(`
      SELECT (SELECT json_agg(json_build_object('nom', policyname, 'cmd', cmd) ORDER BY policyname)
                FROM pg_policies WHERE schemaname = 'public' AND tablename = 'syndic_team_members') AS policies,
             (SELECT relacl::text FROM pg_class WHERE oid = 'public.syndic_team_members'::regclass) AS droits,
             (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.syndic_team_members'::regclass) AS rls`)).rows)

    beforeAll(async () => {
      await db.exec(lireMigrationQr(T20))
      etatPremierePasse = await etat()
      await db.exec(lireMigrationQr(T20))
    })

    it('la seconde passe ne change rien (rejouable)', async () => {
      expect(await etat()).toBe(etatPremierePasse)
    })

    it('(6) aucune policy d’écriture ne reste sur la table, quels qu’en soient les noms ; la lecture reste ; RLS active', async () => {
      const { rows } = await db.query<{ policyname: string; cmd: string }>(
        `SELECT policyname, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename = 'syndic_team_members' ORDER BY policyname`)
      expect(rows.filter((p) => p.cmd !== 'SELECT')).toEqual([])
      expect(rows.map((p) => p.policyname)).toEqual(lecture)
      const rls = await db.query<{ relrowsecurity: boolean }>(
        `SELECT relrowsecurity FROM pg_class WHERE oid = 'public.syndic_team_members'::regclass`)
      expect(rls.rows[0].relrowsecurity).toBe(true)
    })

    it('anon et authenticated n’ont plus aucun droit d’écriture ; la lecture et service_role sont intacts', async () => {
      const { rows } = await db.query<{ role: string; droit: string; accorde: boolean }>(`
        SELECT r.role, d.droit, has_table_privilege(r.role, 'public.syndic_team_members', d.droit) AS accorde
          FROM (VALUES ('anon'), ('authenticated'), ('service_role')) r(role)
         CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) d(droit)`)
      for (const { role, droit, accorde } of rows) {
        const attendu = role === 'service_role' || droit === 'SELECT'
        expect(accorde, `${role} ${droit}`).toBe(attendu)
      }
    })

    it.each([
      ['(2) un compte s’ajoute lui-même dans son propre « cabinet »', inserePourSoi],
      ['(3) le titulaire rattache le compte de quelqu’un d’autre', inserePourUnAutre],
      ['(4) le titulaire change le rôle d’une invitation', changeRoleInvitation],
      ['le titulaire supprime une ligne de son équipe', supprimeMembre],
      ['(1) un membre déplace sa ligne vers un autre cabinet', deplaceSaLigne],
    ])('%s : refusé (droit retiré, 42501), rien n’est écrit', async (_cas, ecrire) => {
      const r = await ecrire()
      expect(r.erreur?.code).toBe('42501')
      expect(await nombreLignes()).toBe(2)
      expect(await ligne(ligneMembre)).toMatchObject({ cabinet_id: TITULAIRE, user_id: MEMBRE })
      expect((await ligne(ligneInvitation)).role).toBe('syndic_comptable')
    })

    it('un visiteur sans compte (anon) ne peut rien écrire non plus', async () => {
      const r = await sous('anon', null,
        `INSERT INTO public.syndic_team_members (cabinet_id, user_id, is_active) VALUES ($1, $1, true)`, [AUTRE])
      expect(r.erreur?.code).toBe('42501')
      expect(await nombreLignes()).toBe(2)
    })

    it('(5) lecture inchangée : le membre voit sa ligne, le titulaire celles de son cabinet, un autre compte rien', async () => {
      const duMembre = await sous('authenticated', MEMBRE, 'SELECT id FROM public.syndic_team_members')
      expect(duMembre.erreur).toBeNull()
      expect(duMembre.lignes.map((l) => l.id)).toEqual([ligneMembre])
      const duTitulaire = await sous('authenticated', TITULAIRE, 'SELECT id FROM public.syndic_team_members ORDER BY id')
      expect(duTitulaire.erreur).toBeNull()
      expect(duTitulaire.lignes.map((l) => l.id).sort()).toEqual([ligneMembre, ligneInvitation].sort())
      const dUnAutre = await sous('authenticated', AUTRE, 'SELECT id FROM public.syndic_team_members')
      expect(dUnAutre.erreur).toBeNull()
      expect(dUnAutre.lignes).toEqual([])
    })

    it('le scénario de contrôle rend l’état et le BILAN attendus (parties 1 et 2, telles que Frédéric les lance)', async () => {
      const etat = await etatScenario()
      expect(Number(etat.policies_ecriture)).toBe(0)
      expect(etat.rls_active).toBe(true)
      expect(etat.droits).toEqual([
        { role: 'anon', select: true, insert: false, update: false, delete: false, truncate: false },
        { role: 'authenticated', select: true, insert: false, update: false, delete: false, truncate: false },
        { role: 'service_role', select: true, insert: true, update: true, delete: true, truncate: true },
      ])
      expect(await bilanScenario()).toMatch(
        /^BILAN \(tout est annulé\) : 2 ok : .+ \| 3 ok : .+ \| 4 ok : .+ \| suppression ok : .+ \| 1 ok : .+ \| 5 ok : lecture acceptée, 0 ligne$/,
      )
      expect(await nombreLignes()).toBe(2)
    })

    it('les routes serveur (service_role) invitent, modifient et suppriment toujours', async () => {
      const invite = await sous('service_role', null,
        `INSERT INTO public.syndic_team_members (cabinet_id, email, role, invite_token, invite_sent_at, is_active)
         VALUES ($1, 'nouvel@exemple.test', 'syndic_secretaire', 'jeton-exemple-2', now(), true) RETURNING id`, [TITULAIRE])
      expect(invite.erreur).toBeNull()
      const id = String(invite.lignes[0].id)
      const accepte = await sous('service_role', null,
        `UPDATE public.syndic_team_members SET user_id = $1, accepted_at = now(), invite_token = NULL WHERE id = $2`, [AUTRE, id])
      expect(accepte.erreur).toBeNull()
      expect(accepte.nb).toBe(1)
      const retire = await sous('service_role', null, 'DELETE FROM public.syndic_team_members WHERE id = $1', [id])
      expect(retire.erreur).toBeNull()
      expect(retire.nb).toBe(1)
    })
  })
})
