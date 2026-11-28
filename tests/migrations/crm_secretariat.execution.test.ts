// @vitest-environment node
// tests/migrations/crm_secretariat.execution.test.ts
//
// CRM du secrétariat (22/11/2026) : migration 20261122_crm_secretariat.sql, EXÉCUTÉE sur un vrai PostgreSQL (PGlite, en
// mémoire ; aucune base distante), jouée deux fois (une migration doit se rejouer).
// - Accès : RLS activée, aucune politique, aucun droit pour anon et authenticated (rien depuis le navigateur, même
//   connecté) ; tout pour service_role (routes app/api/crm/*).
// - Valeurs permises : exactement les listes de lib/crm/types.ts (motifs, canaux, priorités, statuts, types d'historique,
//   langues) ; numéro au format E.164, unique ; numéro de demande attribué par la base.
// Données fictives.

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { ECHAFAUDAGE_SUPABASE_SQL, lireMigrationQr } from '../helpers/pglite-signalements'
import { PRIVILEGES_TABLE, dansPointDeSauvegarde, droitsEffectifs, sousRole } from '../helpers/equipe-ecritures-serveur'
import { CANAUX_CRM, LANGUES_CRM, MOTIFS_CRM, PRIORITES_CRM, STATUTS_CRM, TYPES_EVENEMENT_CRM } from '@/lib/crm/types'

const MIGRATION = '20261122_crm_secretariat.sql'
const TABLES = ['public.crm_contacts', 'public.crm_demandes', 'public.crm_evenements'] as const

describe('migration du CRM du secrétariat', () => {
  let db: PGlite

  beforeAll(async () => {
    db = new PGlite()
    await db.exec(ECHAFAUDAGE_SUPABASE_SQL)
    const sql = lireMigrationQr(MIGRATION)
    await db.exec(sql)
    await db.exec(sql)
  })

  afterAll(async () => {
    await db.close()
  })

  beforeEach(async () => {
    await db.exec('BEGIN')
  })

  afterEach(async () => {
    await db.exec('ROLLBACK')
  })

  async function essai(requete: string, params: unknown[] = []) {
    return dansPointDeSauvegarde(db, () => db.query<Record<string, unknown>>(requete, params))
  }

  async function contact(telephone: string | null = null): Promise<string> {
    const { rows } = await db.query<{ id: string }>('INSERT INTO public.crm_contacts (nom, telephone) VALUES ($1, $2) RETURNING id', ['Client fictif', telephone])
    return rows[0].id
  }

  async function demande(contactId: string | null): Promise<{ id: string; numero: number }> {
    const { rows } = await db.query<{ id: string; numero: number }>(
      `INSERT INTO public.crm_demandes (contact_id, titre, motif, canal) VALUES ($1, 'Demande fictive', 'devis', 'appel') RETURNING id, numero`,
      [contactId],
    )
    return rows[0]
  }

  it('RLS activée sur les trois tables, sans aucune politique, sans déclencheur', async () => {
    const { rows } = await db.query<{ table: string; rls: boolean }>(
      `SELECT c.oid::regclass::text AS table, c.relrowsecurity AS rls FROM pg_class c WHERE c.oid = ANY($1::regclass[]) ORDER BY 1`,
      [TABLES],
    )
    expect(rows.map((r) => [r.table, r.rls])).toEqual([
      ['crm_contacts', true],
      ['crm_demandes', true],
      ['crm_evenements', true],
    ])
    const politiques = await db.query(`SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename LIKE 'crm\\_%'`)
    expect(politiques.rows).toHaveLength(0)
    const declencheurs = await db.query(`SELECT 1 FROM pg_trigger WHERE tgrelid = ANY($1::regclass[]) AND NOT tgisinternal`, [TABLES])
    expect(declencheurs.rows).toHaveLength(0)
  })

  it.each(TABLES)('%s : aucun droit pour anon et authenticated, tous pour service_role', async (table) => {
    const tous = (valeur: boolean) => Object.fromEntries(PRIVILEGES_TABLE.map((p) => [p, valeur]))
    expect(await droitsEffectifs(db, table)).toEqual({ anon: tous(false), authenticated: tous(false), service_role: tous(true) })
  })

  it('une session connectée ne lit ni n’écrit rien (refus de droit, pas seulement zéro ligne)', async () => {
    await demande(await contact('+351912345678'))
    for (const requete of ['SELECT * FROM public.crm_demandes', "INSERT INTO public.crm_contacts (nom) VALUES ('intrus')", 'DELETE FROM public.crm_evenements']) {
      const { erreur } = await sousRole(db, 'authenticated', '00000000-0000-4000-8000-000000000001', requete)
      expect(erreur?.code, requete).toBe('42501')
    }
    const lecture = await sousRole(db, 'service_role', null, 'SELECT count(*)::int AS n FROM public.crm_demandes')
    expect(lecture.lignes[0].n).toBe(1)
  })

  it('valeurs permises = listes de lib/crm/types.ts, toute autre refusée', async () => {
    const c = await contact()
    for (const motif of MOTIFS_CRM) expect((await essai(`INSERT INTO public.crm_demandes (titre, motif, canal) VALUES ('x', $1, 'appel')`, [motif])).erreur).toBeNull()
    for (const canal of CANAUX_CRM) expect((await essai(`INSERT INTO public.crm_demandes (titre, motif, canal) VALUES ('x', 'info', $1)`, [canal])).erreur).toBeNull()
    for (const statut of STATUTS_CRM) expect((await essai(`INSERT INTO public.crm_demandes (titre, motif, canal, statut) VALUES ('x', 'info', 'appel', $1)`, [statut])).erreur).toBeNull()
    for (const priorite of PRIORITES_CRM) expect((await essai(`INSERT INTO public.crm_demandes (titre, motif, canal, priorite) VALUES ('x', 'info', 'appel', $1)`, [priorite])).erreur).toBeNull()
    for (const type of TYPES_EVENEMENT_CRM) expect((await essai(`INSERT INTO public.crm_evenements (contact_id, type) VALUES ($1, $2)`, [c, type])).erreur).toBeNull()
    for (const langue of LANGUES_CRM) expect((await essai(`UPDATE public.crm_contacts SET langue = $1 WHERE id = $2`, [langue, c])).erreur).toBeNull()

    const refus = [
      [`INSERT INTO public.crm_demandes (titre, motif, canal) VALUES ('x', 'vente', 'appel')`, []],
      [`INSERT INTO public.crm_demandes (titre, motif, canal) VALUES ('x', 'info', 'sms')`, []],
      [`INSERT INTO public.crm_demandes (titre, motif, canal, statut) VALUES ('x', 'info', 'appel', 'fermee')`, []],
      [`INSERT INTO public.crm_demandes (titre, motif, canal, priorite) VALUES ('x', 'info', 'appel', 'basse')`, []],
      [`INSERT INTO public.crm_demandes (titre, motif, canal) VALUES ('', 'info', 'appel')`, []],
      [`INSERT INTO public.crm_evenements (contact_id, type) VALUES ($1, 'appel_video')`, [c]],
      [`UPDATE public.crm_contacts SET langue = 'en' WHERE id = $1`, [c]],
    ] as const
    for (const [requete, params] of refus) expect((await essai(requete, [...params])).erreur?.code, requete).toBe('23514')
  })

  it.each([
    ['public.crm_demandes', 'motif', MOTIFS_CRM],
    ['public.crm_demandes', 'canal', CANAUX_CRM],
    ['public.crm_demandes', 'statut', STATUTS_CRM],
    ['public.crm_demandes', 'priorite', PRIORITES_CRM],
    ['public.crm_evenements', 'type', TYPES_EVENEMENT_CRM],
    ['public.crm_contacts', 'langue', LANGUES_CRM],
  ] as const)('%s.%s : le CHECK porte exactement la liste de lib/crm/types.ts (ni plus, ni moins)', async (table, colonne, constantes) => {
    const { rows } = await db.query<{ def: string }>(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = $1::regclass AND contype = 'c'`, [table])
    const definitions = rows.map((r) => r.def).filter((d) => d.includes(`(${colonne} = ANY`))
    expect(definitions).toHaveLength(1)
    const valeurs = [...definitions[0].matchAll(/'([^']*)'::text/g)].map((m) => m[1])
    expect(valeurs.toSorted((a, b) => a.localeCompare(b))).toEqual([...constantes].toSorted((a, b) => a.localeCompare(b)))
  })

  it('séquence du numéro de demande : fermée à anon et authenticated, utilisable par service_role', async () => {
    const { rows } = await db.query<{ role: string; usage: boolean }>(
      `SELECT r AS role, has_sequence_privilege(r, pg_get_serial_sequence('public.crm_demandes', 'numero'), 'USAGE') AS usage
       FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) AS r ORDER BY 1`,
    )
    expect(rows).toEqual([
      { role: 'anon', usage: false },
      { role: 'authenticated', usage: false },
      { role: 'service_role', usage: true },
    ])
  })

  it('numéro au format E.164, un seul contact par numéro, plusieurs contacts sans numéro', async () => {
    await contact('+351912345678')
    expect((await essai(`INSERT INTO public.crm_contacts (telephone) VALUES ('+351912345678')`)).erreur?.code).toBe('23505')
    expect((await essai(`INSERT INTO public.crm_contacts (telephone) VALUES ('912345678')`)).erreur?.code).toBe('23514')
    expect((await essai(`INSERT INTO public.crm_contacts (telephone) VALUES ('+0912345678')`)).erreur?.code).toBe('23514')
    await contact(null)
    await contact(null)
    const { rows } = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM public.crm_contacts WHERE telephone IS NULL')
    expect(rows[0].n).toBe(2)
  })

  it('numéro de demande attribué par la base, croissant, jamais choisi par l’appelant', async () => {
    const a = await demande(null)
    const b = await demande(null)
    expect(Number(b.numero)).toBeGreaterThan(Number(a.numero))
    expect((await essai(`INSERT INTO public.crm_demandes (numero, titre, motif, canal) VALUES (1, 'x', 'info', 'appel')`)).erreur?.code).toBe('428C9')
  })

  it('un contact qui a des demandes ne se supprime pas ; supprimer une demande emporte son historique', async () => {
    const c = await contact('+33612345678')
    const d = await demande(c)
    await db.query(`INSERT INTO public.crm_evenements (demande_id, contact_id, type) VALUES ($1, $2, 'creation')`, [d.id, c])
    // ON DELETE RESTRICT : restrict_violation (23001), pas l'erreur générique de clé étrangère (23503).
    expect((await essai('DELETE FROM public.crm_contacts WHERE id = $1', [c])).erreur?.code).toBe('23001')
    await db.query('DELETE FROM public.crm_demandes WHERE id = $1', [d.id])
    const { rows } = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM public.crm_evenements WHERE demande_id = $1', [d.id])
    expect(rows[0].n).toBe(0)
  })

  it('un événement est rattaché à une demande ou à un contact ; identifiant WhatsApp unique', async () => {
    expect((await essai(`INSERT INTO public.crm_evenements (type) VALUES ('note')`)).erreur?.code).toBe('23514')
    const c = await contact()
    await db.query(`INSERT INTO public.crm_evenements (contact_id, type, wa_message_id) VALUES ($1, 'message_entrant', 'wamid.fictif')`, [c])
    expect((await essai(`INSERT INTO public.crm_evenements (contact_id, type, wa_message_id) VALUES ($1, 'message_entrant', 'wamid.fictif')`, [c])).erreur?.code).toBe('23505')
  })
})
