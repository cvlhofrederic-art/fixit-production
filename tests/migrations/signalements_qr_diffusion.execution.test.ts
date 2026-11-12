// @vitest-environment node
// tests/migrations/signalements_qr_diffusion.execution.test.ts
//
// EXÉCUTION RÉELLE (décision F9 du cahier des charges de la PR 3) des règles SQL de la diffusion d'AJ Signalement, sur un
// vrai PostgreSQL (PGlite, WebAssembly, en mémoire ; aucun service, aucune base distante) : la chaîne entière des
// migrations signalements_qr (20261104, 20261106 ×2, 20261111, 20261112, 20261113) est jouée DEUX fois, puis chaque cas
// du § 10.1 est exécuté sous le rôle service_role (celui de la clé service des routes), dans une transaction annulée à la
// fin du test. Le temps qui passe (24 h, 15 jours, 3 ans) est simulé en antidatant les lignes.
// Décisions de Hugo du 11/11/2026 : H1 = option C (message d'annonce unique, inclusion 15 jours après si pas de refus),
// H7 = date facultative de fin de mission, H11 = un gestionnaire ne diffuse que sur une copropriété attribuée nommément.
// Aucune donnée réelle : adresses en exemple.test.

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { randomUUID } from 'crypto'
import {
  type ErreurPg, creerBaseSignalementsQr, empreinteSchemaQr, erreurPg, lireMigrationQr,
} from '../helpers/pglite-signalements'

let db: PGlite
let empreintePremierePasse = new Map<string, string>()

beforeAll(async () => {
  db = await creerBaseSignalementsQr({
    passes: 2,
    apresPremierePasse: async (base) => { empreintePremierePasse = await empreinteSchemaQr(base) },
  })
}, 120_000)

afterAll(async () => {
  await db?.close()
})

// Chaque test part de la base fraîchement migrée et n'y laisse rien.
beforeEach(async () => { await db.exec('BEGIN') })
afterEach(async () => { await db.exec('ROLLBACK') })

// ── Accès à la base ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Requête en superutilisateur (préparation et contrôle des données du test). */
async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows
}

interface Appel<T> { lignes: T[]; erreur: ErreurPg | null }

/**
 * Requête sous un rôle de l'API (service_role par défaut), dans un point de sauvegarde : une erreur est rendue (code et
 * message PostgreSQL) et la transaction du test continue, rôle rétabli.
 */
async function sous<T = Record<string, unknown>>(role: 'service_role' | 'anon' | 'authenticated', sql: string, params: unknown[] = []): Promise<Appel<T>> {
  await db.exec('SAVEPOINT appel')
  try {
    await db.exec(`SET LOCAL ROLE ${role}`)
    const r = await db.query<T>(sql, params)
    await db.exec('RESET ROLE')
    await db.exec('RELEASE SAVEPOINT appel')
    return { lignes: r.rows, erreur: null }
  } catch (e) {
    await db.exec('ROLLBACK TO SAVEPOINT appel')
    await db.exec('RELEASE SAVEPOINT appel')
    return { lignes: [], erreur: erreurPg(e) }
  }
}
const service = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => sous<T>('service_role', sql, params)

/** Appel qui doit réussir : rend les lignes, échoue avec l'erreur PostgreSQL sinon. */
async function ok<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const r = await service<T>(sql, params)
  if (r.erreur) throw new Error(`appel refusé : [${r.erreur.code}] ${r.erreur.message}\n${sql}`)
  return r.lignes
}

// ── Données d'essai ─────────────────────────────────────────────────────────────────────────────────────────────────

let compteur = 0
const SUPER_ADMIN = randomUUID()

async function cabinet(o: { active?: boolean } = {}): Promise<string> {
  compteur += 1
  const [r] = await q<{ id: string }>(
    `INSERT INTO signalements_qr_cabinets (nom, identifiant, langue, diffusion_contact_email, diffusion_politique_url,
       diffusion_politique_verifiee_le, diffusion_contrat_reference, diffusion_contrat_signe_le, diffusion_activee_le, diffusion_activee_par)
     VALUES ($1, $2, 'fr', 'contact@cabinet-exemple.test', 'https://cabinet-exemple.test/confidentialite', now(),
       'Contrat exemple v1', current_date - 10, CASE WHEN $3::boolean THEN now() END, CASE WHEN $3::boolean THEN $4::uuid END)
     RETURNING id`,
    [`Cabinet exemple ${compteur}`, `cabinet-exemple-${compteur}`, o.active ?? true, SUPER_ADMIN])
  return r.id
}

async function copro(cabinetId: string | null, o: { actif?: boolean; fin?: string | null } = {}): Promise<string> {
  compteur += 1
  const [r] = await q<{ id: string }>(
    `INSERT INTO signalements_qr_coproprietes (nom, jeton, cabinet_id, actif, diffusion_fin_gestion_le)
     VALUES ($1, replace(gen_random_uuid()::text, '-', ''), $2, $3, $4::date) RETURNING id`,
    [`Résidence exemple ${compteur}`, cabinetId, o.actif ?? true, o.fin ?? null])
  return r.id
}

interface Depot {
  email: string
  batiment?: string
  etage?: string
  /** Ancienneté du dépôt (intervalle PostgreSQL) ; « 0 » = maintenant. */
  ilYa?: string
  /** Annonce de la diffusion : par l'accusé (défaut, au dépôt), par le message d'annonce (H1 = C), ou aucune. */
  annonce?: 'accuse' | 'message' | null
  /** Ancienneté de l'annonce (défaut : celle du dépôt). */
  annonceIlYa?: string
  lie?: string | null
}

async function depot(coproId: string, d: Depot): Promise<string> {
  const ilYa = d.ilYa ?? '1 hour'
  const annonce = d.annonce === undefined ? 'accuse' : d.annonce
  const [r] = await q<{ id: string }>(
    `INSERT INTO signalements_qr (copropriete_id, prenom, nom, telephone, email, batiment, etage, num_lot, type_intervention,
       description, created_at, diffusion_annoncee_le, diffusion_annonce_origine, signalement_lie_id)
     VALUES ($1, 'Prénom', 'Nom', '0600000000', $2, $3, $4, '12', 'plomberie', 'Description d’exemple du problème',
       now() - $5::interval, CASE WHEN $6::text IS NULL THEN NULL ELSE now() - $7::interval END, $6::text, $8::uuid)
     RETURNING id`,
    [coproId, d.email, d.batiment ?? 'A', d.etage ?? '1', ilYa, annonce, d.annonceIlYa ?? ilYa, d.lie ?? null])
  return r.id
}

/** Cabinet activé, copropriété active et `n` déclarants annoncés (bâtiment A, étage 1). */
async function immeuble(n: number, o: { prefixe?: string } = {}): Promise<{ cab: string; cop: string; depots: string[] }> {
  const cab = await cabinet()
  const cop = await copro(cab)
  const depots: string[] = []
  for (let i = 0; i < n; i++) depots.push(await depot(cop, { email: `${o.prefixe ?? 'declarant'}${i}@exemple.test` }))
  return { cab, cop, depots }
}

async function maintenant(): Promise<Date> {
  const [r] = await q<{ t: Date }>('SELECT now() AS t')
  return r.t
}

interface Apercu { nb_destinataires: number; nb_exclus_opposition: number; possible: boolean; raison: string | null; instant: Date }

async function apercu(cop: string, o: { portee?: string; batiments?: string[] | null; etages?: string[] | null; signalement?: string | null; annonce?: boolean } = {}): Promise<Appel<Apercu>> {
  return service<Apercu>(
    `SELECT * FROM signalements_qr_diffusion_apercu($1::uuid, $2::text, $3::text[], $4::text[], $5::uuid, $6::boolean)`,
    [cop, o.portee ?? 'copropriete', o.batiments ?? null, o.etages ?? null, o.signalement ?? null, o.annonce ?? false])
}

interface Creation {
  operation?: string
  acteur?: string
  profil?: 'super_admin' | 'gestionnaire'
  gestionnaire?: string | null
  instruction?: string | null
  instructionLe?: string | null
  modele?: string
  objet?: string
  texte?: string
  portee?: string
  cleBatiment?: string | null
  cleEtage?: string | null
  batiments?: string[] | null
  etages?: string[] | null
  signalement?: string | null
  jusquAu?: Date
  attendu?: number
}

interface Cree { diffusion_id: string; nb_destinataires: number; rejeu: boolean }

async function creer(cop: string, c: Creation = {}): Promise<Appel<Cree>> {
  const profil = c.profil ?? 'super_admin'
  const portee = c.portee ?? 'copropriete'
  return service<Cree>(
    `SELECT * FROM signalements_qr_diffusion_creer(
       p_operation => $1::uuid, p_copropriete => $2::uuid, p_acteur => $3::uuid, p_profil => $4::text, p_gestionnaire => $5::uuid,
       p_instruction_reference => $6::text, p_instruction_recue_le => $7::date, p_modele => $8::text, p_objet => $9::text,
       p_texte => $10::text, p_portee => $11::text, p_cle_batiment => $12::text, p_cle_etage => $13::text,
       p_batiments => $14::text[], p_etages => $15::text[], p_signalement => $16::uuid, p_libelle => $17::text,
       p_jusqu_au => $18::timestamptz, p_attendu => $19::integer, p_expediteur => $20::text)`,
    [
      c.operation ?? randomUUID(), cop, c.acteur ?? SUPER_ADMIN, profil, c.gestionnaire ?? null,
      c.instruction === undefined ? (profil === 'super_admin' ? 'Courriel du cabinet du 12/11/2026' : null) : c.instruction,
      c.instructionLe === undefined ? (profil === 'super_admin' ? '2026-11-01' : null) : c.instructionLe,
      c.modele ?? 'coupure_eau', c.objet ?? 'Coupure d’eau demain', c.texte ?? 'L’eau sera coupée demain de 9 h à 10 h.',
      portee,
      c.cleBatiment === undefined ? (portee === 'batiment' || portee === 'etage' ? 'a' : null) : c.cleBatiment,
      c.cleEtage === undefined ? (portee === 'etage' ? '1' : null) : c.cleEtage,
      c.batiments ?? null, c.etages ?? null, c.signalement ?? null, 'Toute la copropriété',
      c.jusquAu ?? (await maintenant()), c.attendu ?? 1000, '"Cabinet exemple" <diffusion@exemple.test>',
    ])
}

async function creerOk(cop: string, c: Creation = {}): Promise<Cree> {
  const r = await creer(cop, c)
  if (r.erreur) throw new Error(`création refusée : [${r.erreur.code}] ${r.erreur.message}`)
  return r.lignes[0]
}

interface LigneLot { destinataire_id: string; email: string; lot: number; reprise: boolean }

const lot = (diffusion: string, taille = 100) =>
  ok<LigneLot>('SELECT * FROM signalements_qr_diffusion_lot($1::uuid, $2::integer)', [diffusion, taille])

async function resultats(diffusion: string, numero: number, r: { envoyes?: string[]; refuses?: string[]; nonPartis?: string[]; code?: string | null }) {
  const [x] = await ok<{ r: { envoyes: number; refuses: number; nonPartis: number; reste: number } }>(
    'SELECT signalements_qr_diffusion_resultats($1::uuid, $2::integer, $3::uuid[], $4::uuid[], $5::uuid[], $6::text) AS r',
    [diffusion, numero, r.envoyes ?? [], r.refuses ?? [], r.nonPartis ?? [], r.code ?? null])
  return x.r
}

/** Réserve un lot puis le déclare entièrement accepté par le service d'e-mail. */
async function envoyerLot(diffusion: string): Promise<LigneLot[]> {
  const lignes = await lot(diffusion)
  if (lignes.length > 0) await resultats(diffusion, lignes[0].lot, { envoyes: lignes.map((l) => l.destinataire_id) })
  return lignes
}

async function opposer(destinataire: string, origine = 'page', emailSaisi: string | null = null): Promise<Appel<{ r: boolean }>> {
  return service<{ r: boolean }>('SELECT signalements_qr_diffusion_opposer($1::uuid, $2::text, $3::text) AS r', [destinataire, origine, emailSaisi])
}

async function lever(destinataire: string): Promise<boolean> {
  const [x] = await ok<{ r: boolean }>('SELECT signalements_qr_diffusion_lever($1::uuid) AS r', [destinataire])
  return x.r
}

async function etats(diffusion: string): Promise<Array<{ id: string; etat: string; code: string | null; lot: number | null }>> {
  return q('SELECT id, etat, code, lot FROM signalements_qr_diffusion_destinataires WHERE diffusion_id = $1 ORDER BY id', [diffusion])
}

async function destinatairesEmails(diffusion: string): Promise<string[]> {
  const lignes = await q<{ email: string }>(
    `SELECT lower(btrim(s.email)) AS email FROM signalements_qr_diffusion_destinataires x
       JOIN signalements_qr s ON s.id = x.signalement_source_id WHERE x.diffusion_id = $1 ORDER BY 1`, [diffusion])
  return lignes.map((l) => l.email)
}

async function destinataireDe(diffusion: string, email: string): Promise<string> {
  const [r] = await q<{ id: string }>(
    `SELECT x.id FROM signalements_qr_diffusion_destinataires x
      WHERE x.diffusion_id = $1 AND x.email_empreinte = signalements_qr_empreinte_email($2)`, [diffusion, email])
  if (!r) throw new Error(`aucun destinataire ${email}`)
  return r.id
}

const nbOppositions = async (cop: string) =>
  (await q<{ n: number }>('SELECT count(*)::int AS n FROM signalements_qr_diffusion_oppositions WHERE copropriete_id = $1', [cop]))[0].n

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

describe('chaîne des migrations signalements_qr jouée deux fois', () => {
  it('la seconde passe ne change rien au schéma (colonnes, contraintes, index, triggers, fonctions et droits, tables)', async () => {
    const apres = await empreinteSchemaQr(db)
    expect(empreintePremierePasse.size).toBeGreaterThan(200)
    const ecarts = [...new Set([...empreintePremierePasse.keys(), ...apres.keys()])]
      .filter((k) => empreintePremierePasse.get(k) !== apres.get(k))
    expect(ecarts).toEqual([])
    expect(apres.get('données signalements_qr_coproprietes (lignes)')).toBe('1')
  })

  it('aucune contrainte laissée NOT VALID ; tables, fonctions et liste du journal en place', async () => {
    const [r] = await q<{ non_validees: number; tables: number; fonctions: number }>(`
      SELECT (SELECT count(*)::int FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND NOT convalidated) AS non_validees,
             (SELECT count(*)::int FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
                AND relname IN ('signalements_qr_diffusions', 'signalements_qr_diffusion_destinataires', 'signalements_qr_diffusion_oppositions')) AS tables,
             (SELECT count(*)::int FROM pg_proc WHERE pronamespace = 'public'::regnamespace
                AND (proname LIKE 'signalements\\_qr\\_diffusion%' OR proname = 'signalements_qr_empreinte_email')) AS fonctions`)
    expect(r).toEqual({ non_validees: 0, tables: 3, fonctions: 22 })
  })

  it('liste du journal : les 34 actions de la 20261111 et les 7 de la diffusion, une seule contrainte', async () => {
    const lignes = await q<{ def: string }>(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conname = 'signalements_qr_journal_action_valeurs' AND conrelid = 'signalements_qr_journal'::regclass`)
    expect(lignes).toHaveLength(1)
    const valeurs = [...lignes[0].def.matchAll(/'([^']+)'/g)].map((m) => m[1])
    expect(valeurs).toHaveLength(41)
    for (const a of ['journal.purge', 'gestionnaire.acces_ouvert', 'diffusion.envoyee', 'diffusion.opposition_levee', 'cabinet.diffusion_suspendue']) {
      expect(valeurs).toContain(a)
    }
  })

  it('rejouer la 20261113 sur une base qui a des diffusions et des oppositions : aucune erreur, rien de perdu', async () => {
    const { cop } = await immeuble(3)
    const d = await creerOk(cop)
    const [premier] = await envoyerLot(d.diffusion_id)
    expect((await opposer(premier.destinataire_id)).lignes[0].r).toBe(true)
    const avant = await empreinteSchemaQr(db)
    await db.exec(lireMigrationQr('20261113_signalements_qr_diffusion.sql'))
    expect(await empreinteSchemaQr(db)).toEqual(avant)
    expect(await nbOppositions(cop)).toBe(1)
    expect((await etats(d.diffusion_id)).filter((e) => e.etat === 'envoye')).toHaveLength(3)
  })

  it('garde du remplacement : une action présente en base et absente de la nouvelle liste arrête la migration (55000)', async () => {
    // État simulé : la contrainte ne connaît pas encore la diffusion mais porte une action inconnue de la 20261113.
    await db.exec(`ALTER TABLE signalements_qr_journal DROP CONSTRAINT signalements_qr_journal_action_valeurs,
      ADD CONSTRAINT signalements_qr_journal_action_valeurs CHECK (action IN ('journal.purge', 'autre.action'))`)
    await db.exec('SAVEPOINT rejeu')
    let erreur: ErreurPg | null = null
    try {
      await db.exec(lireMigrationQr('20261113_signalements_qr_diffusion.sql'))
    } catch (e) {
      erreur = erreurPg(e)
    }
    await db.exec('ROLLBACK TO SAVEPOINT rejeu')
    expect(erreur?.code).toBe('55000')
    expect(erreur?.message).toBe('journal_action_perdue')
    const [r] = await q<{ def: string }>(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conname = 'signalements_qr_journal_action_valeurs'`)
    expect(r.def).toContain('autre.action')
  })
})

describe('droits : clé service seulement', () => {
  const TABLES = ['signalements_qr_diffusions', 'signalements_qr_diffusion_destinataires', 'signalements_qr_diffusion_oppositions']

  it.each(['anon', 'authenticated'] as const)('%s ne lit ni n’écrit aucune des 3 tables (42501)', async (role) => {
    for (const t of TABLES) {
      expect((await sous(role, `SELECT count(*) FROM ${t}`)).erreur?.code, t).toBe('42501')
      expect((await sous(role, `DELETE FROM ${t}`)).erreur?.code, t).toBe('42501')
    }
  })

  it.each(['anon', 'authenticated'] as const)('%s n’exécute aucune fonction de la migration ; service_role les exécute toutes', async (role) => {
    const fonctions = await q<{ sig: string; role_peut: boolean; service_peut: boolean }>(`
      SELECT p.oid::regprocedure::text AS sig, has_function_privilege($1, p.oid, 'EXECUTE') AS role_peut,
             has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_peut
        FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
         AND (p.proname LIKE 'signalements\\_qr\\_diffusion%' OR p.proname = 'signalements_qr_empreinte_email')`, [role])
    expect(fonctions).toHaveLength(22)
    for (const f of fonctions) {
      expect(f.role_peut, f.sig).toBe(false)
      expect(f.service_peut, f.sig).toBe(true)
    }
    const essai = await sous(role, "SELECT signalements_qr_empreinte_email('a@exemple.test')")
    expect(essai.erreur?.code).toBe('42501')
    const purge = await sous(role, 'SELECT * FROM signalements_qr_diffusion_purger()')
    expect(purge.erreur?.code).toBe('42501')
  })

  it('RLS active sur les 3 tables, aucune politique ; séquence des oppositions fermée à anon et authenticated', async () => {
    const [r] = await q<{ rls: number; politiques: number; seq_anon: boolean; seq_auth: boolean }>(`
      SELECT (SELECT count(*)::int FROM pg_class WHERE relname = ANY ($1::text[]) AND relrowsecurity) AS rls,
             (SELECT count(*)::int FROM pg_policies WHERE tablename = ANY ($1::text[])) AS politiques,
             has_sequence_privilege('anon', 'signalements_qr_diffusion_oppositions_id_seq', 'USAGE') AS seq_anon,
             has_sequence_privilege('authenticated', 'signalements_qr_diffusion_oppositions_id_seq', 'USAGE') AS seq_auth`, [TABLES])
    expect(r).toEqual({ rls: 3, politiques: 0, seq_anon: false, seq_auth: false })
  })
})

describe('réglages du cabinet (contraintes)', () => {
  it('activation sans contrat référencé : refusée par la base (23514)', async () => {
    const cab = await cabinet({ active: false })
    await db.exec('SAVEPOINT s')
    let erreur: ErreurPg | null = null
    try {
      await db.exec(`UPDATE signalements_qr_cabinets SET diffusion_contrat_reference = NULL, diffusion_activee_le = now() WHERE id = '${cab}'`)
    } catch (e) { erreur = erreurPg(e) }
    await db.exec('ROLLBACK TO SAVEPOINT s')
    expect(erreur?.code).toBe('23514')
  })

  it('téléphones autorisés : chiffres seuls (« 06 12… » refusé), contact en minuscules, politique en https', async () => {
    const cab = await cabinet()
    for (const [colonne, valeur] of [
      ['diffusion_telephones', "ARRAY['06 12 34 56 78']"], ['diffusion_contact_email', "'Contact@Exemple.test'"],
      ['diffusion_politique_url', "'http://exemple.test/politique'"],
    ]) {
      await db.exec('SAVEPOINT s')
      let erreur: ErreurPg | null = null
      try {
        await db.exec(`UPDATE signalements_qr_cabinets SET ${colonne} = ${valeur} WHERE id = '${cab}'`)
      } catch (e) { erreur = erreurPg(e) }
      await db.exec('ROLLBACK TO SAVEPOINT s')
      expect(erreur?.code, colonne).toBe('23514')
    }
    await db.exec(`UPDATE signalements_qr_cabinets SET diffusion_telephones = ARRAY['0612345678', '351912345678'] WHERE id = '${cab}'`)
  })
})

describe('aperçu et création : destinataires calculés en SQL', () => {
  it('une adresse sous deux casses et des espaces : UN destinataire, adresse de son signalement le plus récent', async () => {
    const { cop } = await immeuble(0)
    await depot(cop, { email: 'Marie@Exemple.test', ilYa: '3 hours' })
    const recent = await depot(cop, { email: '  marie@exemple.test ', ilYa: '1 hour' })
    await depot(cop, { email: 'paul@exemple.test' })
    await depot(cop, { email: 'sans-arobase', ilYa: '2 hours' })
    expect((await apercu(cop)).lignes[0]).toMatchObject({ nb_destinataires: 2, nb_exclus_opposition: 0, possible: true, raison: null })
    const d = await creerOk(cop, { attendu: 2 })
    expect(d).toMatchObject({ nb_destinataires: 2, rejeu: false })
    const [marie] = await q<{ signalement_source_id: string }>(
      `SELECT signalement_source_id FROM signalements_qr_diffusion_destinataires
        WHERE diffusion_id = $1 AND email_empreinte = signalements_qr_empreinte_email('marie@exemple.test')`, [d.diffusion_id])
    expect(marie.signalement_source_id).toBe(recent)
    const lignes = await lot(d.diffusion_id)
    expect(lignes.map((l) => l.email).sort()).toEqual(['marie@exemple.test', 'paul@exemple.test'])
  })

  it('portées bâtiment, étage (couples bruts exacts) et signalement (racine et signalements liés, un niveau)', async () => {
    const { cop } = await immeuble(0)
    await depot(cop, { email: 'a1@exemple.test', batiment: 'A', etage: '1' })
    await depot(cop, { email: 'a2@exemple.test', batiment: ' A ', etage: '2' })
    await depot(cop, { email: 'b1@exemple.test', batiment: 'B', etage: '1' })
    await depot(cop, { email: 'bb1@exemple.test', batiment: 'Bât. B', etage: '1er' })
    const racine = await depot(cop, { email: 'racine@exemple.test', batiment: 'C', etage: '0' })
    await depot(cop, { email: 'lie@exemple.test', batiment: 'D', etage: '0', lie: racine })
    const lieAutre = await depot(cop, { email: 'lie2@exemple.test', batiment: 'D', etage: '3', lie: racine })
    const nb = async (o: Parameters<typeof apercu>[1]) => (await apercu(cop, o)).lignes[0].nb_destinataires
    expect(await nb({ portee: 'batiment', batiments: ['A'] })).toBe(2)
    expect(await nb({ portee: 'batiment', batiments: ['B', 'Bât. B'] })).toBe(2)
    expect(await nb({ portee: 'etage', batiments: ['A', 'B'], etages: ['1', '1'] })).toBe(2)
    expect(await nb({ portee: 'etage', batiments: ['A'], etages: ['2'] })).toBe(1)
    expect(await nb({ portee: 'signalement', signalement: racine })).toBe(3)
    expect(await nb({ portee: 'signalement', signalement: lieAutre })).toBe(3)
    const d = await creerOk(cop, { portee: 'etage', batiments: ['A'], etages: ['2'], cleBatiment: 'a', cleEtage: '2', attendu: 1 })
    expect(await destinatairesEmails(d.diffusion_id)).toEqual(['a2@exemple.test'])
  })

  it('portée signalement : un signalement d’une AUTRE copropriété ne donne personne', async () => {
    const a = await immeuble(1)
    const b = await immeuble(1, { prefixe: 'autre' })
    expect((await apercu(a.cop, { portee: 'signalement', signalement: b.depots[0] })).lignes[0].nb_destinataires).toBe(0)
    const r = await creer(a.cop, { portee: 'signalement', signalement: b.depots[0] })
    expect(r.erreur).toMatchObject({ code: 'P0001', message: 'aucun_destinataire' })
  })

  it('signalements déposés APRÈS l’instant de l’aperçu (p_jusqu_au) : absents', async () => {
    const { cop } = await immeuble(2)
    await depot(cop, { email: 'tardif@exemple.test', ilYa: '0' })
    const instant = (await q<{ t: Date }>("SELECT now() - interval '5 minutes' AS t"))[0].t
    const d = await creerOk(cop, { jusquAu: instant, attendu: 2 })
    expect(d.nb_destinataires).toBe(2)
    expect(await destinatairesEmails(d.diffusion_id)).not.toContain('tardif@exemple.test')
  })

  it('nombre réel supérieur à l’annoncé → perimetre_change ; inférieur (opposition depuis l’aperçu) → création au nombre réel', async () => {
    const { cop } = await immeuble(3)
    expect((await creer(cop, { attendu: 2 })).erreur).toMatchObject({ code: 'P0001', message: 'perimetre_change' })
    const premiere = await creerOk(cop, { attendu: 3 })
    await envoyerLot(premiere.diffusion_id)
    await opposer(await destinataireDe(premiere.diffusion_id, 'declarant0@exemple.test'))
    const seconde = await creerOk(cop, { attendu: 3 })
    expect(seconde.nb_destinataires).toBe(2)
    const [d] = await q<{ nb_destinataires: number; nb_exclus_opposition: number }>(
      'SELECT nb_destinataires, nb_exclus_opposition FROM signalements_qr_diffusions WHERE id = $1', [seconde.diffusion_id])
    expect(d).toEqual({ nb_destinataires: 2, nb_exclus_opposition: 1 })
  })

  it('instant de l’aperçu dans le futur ou de plus de 30 minutes → perimetre_change ; personne → aucun_destinataire', async () => {
    const { cop } = await immeuble(1)
    const futur = (await q<{ t: Date }>("SELECT now() + interval '1 minute' AS t"))[0].t
    const vieux = (await q<{ t: Date }>("SELECT now() - interval '31 minutes' AS t"))[0].t
    expect((await creer(cop, { jusquAu: futur })).erreur?.message).toBe('perimetre_change')
    expect((await creer(cop, { jusquAu: vieux })).erreur?.message).toBe('perimetre_change')
    const vide = await immeuble(0)
    expect((await creer(vide.cop)).erreur).toMatchObject({ code: 'P0001', message: 'aucun_destinataire' })
  })

  it('double clic : même operation_id → même diffusion (rejeu) ; un autre auteur → a_reverifier', async () => {
    const { cop } = await immeuble(2)
    const operation = randomUUID()
    const premiere = await creerOk(cop, { operation })
    const rejeu = await creerOk(cop, { operation })
    expect(rejeu).toEqual({ diffusion_id: premiere.diffusion_id, nb_destinataires: 2, rejeu: true })
    expect((await creer(cop, { operation, acteur: randomUUID() })).erreur).toMatchObject({ code: 'P0001', message: 'a_reverifier' })
    expect((await q<{ n: number }>('SELECT count(*)::int AS n FROM signalements_qr_diffusions WHERE copropriete_id = $1', [cop]))[0].n).toBe(1)
  })

  it('copropriété inactive, sans cabinet, cabinet non activé, fin de mission passée ou du jour → diffusion_inactive', async () => {
    const actif = await cabinet()
    const cas: Array<[string, string]> = [
      [await copro(actif, { actif: false }), 'copropriete_inactive'],
      [await copro(null), 'sans_cabinet'],
      [await copro(await cabinet({ active: false })), 'diffusion_non_activee'],
      [await copro(actif, { fin: '2026-01-01' }), 'fin_gestion'],
    ]
    const [{ aujourdhui }] = await q<{ aujourdhui: string }>("SELECT to_char((now() AT TIME ZONE 'Europe/Paris')::date, 'YYYY-MM-DD') AS aujourdhui")
    cas.push([await copro(actif, { fin: aujourdhui }), 'fin_gestion'])
    for (const [cop, raison] of cas) {
      await depot(cop, { email: 'quelquun@exemple.test' })
      expect((await apercu(cop)).lignes[0], raison).toMatchObject({ possible: false, raison })
      expect((await creer(cop)).erreur, raison).toMatchObject({ code: 'P0001', message: 'diffusion_inactive' })
    }
    const [{ demain }] = await q<{ demain: string }>("SELECT to_char((now() AT TIME ZONE 'Europe/Paris')::date + 1, 'YYYY-MM-DD') AS demain")
    const encore = await copro(actif, { fin: demain })
    await depot(encore, { email: 'quelquun@exemple.test' })
    expect((await apercu(encore)).lignes[0]).toMatchObject({ possible: true, raison: null, nb_destinataires: 1 })
    expect((await creer(encore)).erreur).toBeNull()
  })

  it('super admin : instruction écrite exigée et non future (22023) ; paramètres incohérents → 22023', async () => {
    const { cop } = await immeuble(1)
    expect((await creer(cop, { instruction: null })).erreur?.code).toBe('22023')
    expect((await creer(cop, { instructionLe: '2099-01-01' })).erreur?.code).toBe('22023')
    expect((await creer(cop, { portee: 'lot' })).erreur?.code).toBe('22023')
    expect((await creer(cop, { portee: 'etage', batiments: ['A', 'B'], etages: ['1'] })).erreur?.code).toBe('22023')
    expect((await creer(cop, { portee: 'batiment', batiments: [] })).erreur?.code).toBe('22023')
    expect((await creer(cop, { modele: 'annonce', portee: 'batiment', batiments: ['A'] })).erreur?.code).toBe('22023')
    expect((await apercu(cop, { portee: 'batiment', batiments: null })).erreur?.code).toBe('22023')
  })

  it('H11 : un gestionnaire diffuse sur une copropriété qui lui est attribuée NOMMÉMENT, jamais par « attribuée à tous »', async () => {
    const { cab, cop } = await immeuble(1)
    const compte = randomUUID()
    await q('INSERT INTO auth.users (id) VALUES ($1)', [compte])
    const [g] = await q<{ id: string }>(
      `INSERT INTO signalements_qr_gestionnaires (id, cabinet_id, nom, email, cree_par, adresse_confirmee_le, user_id)
       VALUES (gen_random_uuid(), $1, 'Gestionnaire exemple', 'gestion@exemple.test', $2, now(), $3) RETURNING id`, [cab, SUPER_ADMIN, compte])
    const commeGestionnaire = { profil: 'gestionnaire' as const, acteur: compte, gestionnaire: g.id }
    await q('UPDATE signalements_qr_coproprietes SET attribuee_a_tous = true WHERE id = $1', [cop])
    expect((await creer(cop, commeGestionnaire)).erreur).toMatchObject({ code: '42501', message: 'interdit' })
    await q(`INSERT INTO signalements_qr_attributions (copropriete_id, gestionnaire_id, origine, attribue_par) VALUES ($1, $2, 'super_admin', $3)`,
      [cop, g.id, SUPER_ADMIN])
    expect((await creer(cop, { ...commeGestionnaire, acteur: randomUUID() })).erreur?.code).toBe('42501')
    const d = await creerOk(cop, commeGestionnaire)
    const [ligne] = await q<{ acteur_profil: string; acteur_gestionnaire_id: string; instruction_reference: string | null }>(
      'SELECT acteur_profil, acteur_gestionnaire_id, instruction_reference FROM signalements_qr_diffusions WHERE id = $1', [d.diffusion_id])
    expect(ligne).toEqual({ acteur_profil: 'gestionnaire', acteur_gestionnaire_id: g.id, instruction_reference: null })
    await q('UPDATE signalements_qr_gestionnaires SET actif = false WHERE id = $1', [g.id])
    expect((await creer(cop, commeGestionnaire)).erreur?.code).toBe('42501')
  })

  it('valeurs figées dans la diffusion (un lot rejoué est identique même si la fiche change) ; journal sans texte', async () => {
    const { cab, cop } = await immeuble(1)
    const d = await creerOk(cop)
    await q("UPDATE signalements_qr_cabinets SET nom = 'Nouveau nom' WHERE id = $1", [cab])
    const [f] = await q<Record<string, string>>(
      `SELECT fige_cabinet_nom, fige_cabinet_identifiant, fige_contact_email, fige_politique_url, fige_expediteur, langue
         FROM signalements_qr_diffusions WHERE id = $1`, [d.diffusion_id])
    expect(f.fige_cabinet_nom).toMatch(/^Cabinet exemple \d+$/)
    expect(f).toMatchObject({ fige_contact_email: 'contact@cabinet-exemple.test', langue: 'fr', fige_expediteur: '"Cabinet exemple" <diffusion@exemple.test>' })
    const journal = await q<{ action: string; acteur_profil: string; details: Record<string, unknown> }>(
      "SELECT action, acteur_profil, details FROM signalements_qr_journal WHERE copropriete_id = $1 AND action LIKE 'diffusion.%'", [cop])
    expect(journal).toHaveLength(1)
    expect(journal[0]).toMatchObject({ action: 'diffusion.envoyee', acteur_profil: 'super_admin' })
    expect(journal[0].details).toMatchObject({ portee: 'copropriete', modele: 'coupure_eau', nb_destinataires: 1, nb_exclus: 0 })
    expect(JSON.stringify(journal[0].details)).not.toMatch(/@|eau sera coupée|Coupure/)
  })
})

describe('oppositions : aucune exception, par copropriété', () => {
  it('personne opposée : exclue de l’aperçu (comptée à part), de la création et du lot', async () => {
    const { cop } = await immeuble(3)
    const d1 = await creerOk(cop)
    await envoyerLot(d1.diffusion_id)
    expect((await opposer(await destinataireDe(d1.diffusion_id, 'declarant1@exemple.test'))).lignes[0].r).toBe(true)
    expect((await apercu(cop)).lignes[0]).toMatchObject({ nb_destinataires: 2, nb_exclus_opposition: 1 })
    const d2 = await creerOk(cop, { attendu: 2 })
    expect(await destinatairesEmails(d2.diffusion_id)).toEqual(['declarant0@exemple.test', 'declarant2@exemple.test'])
    expect((await lot(d2.diffusion_id)).map((l) => l.email)).not.toContain('declarant1@exemple.test')
  })

  it('un NOUVEAU signalement après l’opposition ne la lève pas : toujours exclue', async () => {
    const { cop } = await immeuble(1)
    const d1 = await creerOk(cop)
    await envoyerLot(d1.diffusion_id)
    await opposer(await destinataireDe(d1.diffusion_id, 'declarant0@exemple.test'), 'un_clic')
    await depot(cop, { email: 'DECLARANT0@exemple.test', ilYa: '1 minute' })
    expect((await apercu(cop)).lignes[0]).toMatchObject({ nb_destinataires: 0, nb_exclus_opposition: 1 })
    expect((await creer(cop)).erreur?.message).toBe('aucun_destinataire')
    const [annonce] = await ok<{ r: boolean }>(
      "SELECT signalements_qr_diffusion_annonce(id) AS r FROM signalements_qr WHERE email = 'DECLARANT0@exemple.test'")
    expect(annonce.r).toBe(false)
  })

  it('opposition dans la copropriété A : sans effet sur la copropriété B (même adresse)', async () => {
    const a = await immeuble(1)
    const b = await immeuble(1)
    const da = await creerOk(a.cop)
    await envoyerLot(da.diffusion_id)
    await opposer(await destinataireDe(da.diffusion_id, 'declarant0@exemple.test'))
    expect((await apercu(a.cop)).lignes[0].nb_destinataires).toBe(0)
    expect((await apercu(b.cop)).lignes[0]).toMatchObject({ nb_destinataires: 1, nb_exclus_opposition: 0 })
  })

  it('l’opposition annule, dans sa transaction, les lignes en attente de cette adresse dans TOUTES les diffusions de la copropriété ; idempotente', async () => {
    const { cop } = await immeuble(2)
    const d1 = await creerOk(cop)
    const d2 = await creerOk(cop)
    const autre = await immeuble(1)
    const d3 = await creerOk(autre.cop)
    const cible = await destinataireDe(d1.diffusion_id, 'declarant0@exemple.test')
    expect((await opposer(cible)).lignes[0].r).toBe(true)
    expect((await opposer(cible)).lignes[0].r).toBe(true)
    expect(await nbOppositions(cop)).toBe(1)
    for (const d of [d1, d2]) {
      const e = await etats(d.diffusion_id)
      expect(e.filter((x) => x.etat === 'annule' && x.code === 'opposition'), d.diffusion_id).toHaveLength(1)
      expect(e.filter((x) => x.etat === 'en_attente')).toHaveLength(1)
    }
    expect((await etats(d3.diffusion_id)).every((x) => x.etat === 'en_attente')).toBe(true)
    const journal = await q<{ acteur_profil: string; acteur_id: string | null; details: Record<string, unknown> }>(
      "SELECT acteur_profil, acteur_id, details FROM signalements_qr_journal WHERE copropriete_id = $1 AND action = 'diffusion.opposition'", [cop])
    expect(journal).toEqual([{ acteur_profil: 'systeme', acteur_id: null, details: { origine: 'page' } }])
  })

  it('opposition entre deux lots : le lot suivant part sans elle', async () => {
    const { cop } = await immeuble(150)
    const d = await creerOk(cop)
    const premier = await envoyerLot(d.diffusion_id)
    expect(premier).toHaveLength(100)
    const [restante] = await q<{ id: string }>(
      "SELECT id FROM signalements_qr_diffusion_destinataires WHERE diffusion_id = $1 AND etat = 'en_attente' ORDER BY id LIMIT 1", [d.diffusion_id])
    await opposer(restante.id)
    const second = await lot(d.diffusion_id)
    expect(second).toHaveLength(49)
    expect(second.map((l) => l.destinataire_id)).not.toContain(restante.id)
  })

  it('repli (lien expiré) : adresse fausse → aucune ligne ; juste (autre casse) → opposition « lien_expire »', async () => {
    const { cop } = await immeuble(1)
    const d = await creerOk(cop)
    const x = await destinataireDe(d.diffusion_id, 'declarant0@exemple.test')
    expect((await opposer(x, 'lien_expire', 'quelqu.un@exemple.test')).lignes[0].r).toBe(false)
    expect(await nbOppositions(cop)).toBe(0)
    expect((await opposer(x, 'lien_expire', ' Declarant0@Exemple.test ')).lignes[0].r).toBe(true)
    const [o] = await q<{ origine: string; destinataire_id: string }>(
      'SELECT origine, destinataire_id FROM signalements_qr_diffusion_oppositions WHERE copropriete_id = $1', [cop])
    expect(o).toEqual({ origine: 'lien_expire', destinataire_id: x })
    expect((await opposer(x, 'lien_expire')).erreur?.code).toBe('22023')
    expect((await opposer(x, 'demande_cabinet')).erreur?.code).toBe('22023')
    expect((await opposer(randomUUID())).lignes[0].r).toBe(false)
  })

  it('demande écrite reçue par le cabinet : signalement de CETTE copropriété seulement, date gardée, non future', async () => {
    const a = await immeuble(1)
    const b = await immeuble(1)
    const appel = (sig: string, cop: string, date: string) => service<{ r: boolean }>(
      `SELECT signalements_qr_diffusion_opposer_signalement($1::uuid, $2::uuid, $3::uuid, 'super_admin', NULL, $4::date) AS r`,
      [sig, cop, SUPER_ADMIN, date])
    expect((await appel(b.depots[0], a.cop, '2026-11-10')).lignes[0].r).toBe(false)
    expect(await nbOppositions(a.cop) + await nbOppositions(b.cop)).toBe(0)
    expect((await appel(a.depots[0], a.cop, '2099-01-01')).erreur?.code).toBe('22023')
    expect((await appel(a.depots[0], a.cop, '2026-11-10')).lignes[0].r).toBe(true)
    const [o] = await q<{ origine: string; acteur_id: string; demande_recue_le: Date }>(
      'SELECT origine, acteur_id, demande_recue_le FROM signalements_qr_diffusion_oppositions WHERE copropriete_id = $1', [a.cop])
    expect(o.origine).toBe('demande_cabinet')
    expect(o.acteur_id).toBe(SUPER_ADMIN)
    expect((await apercu(a.cop)).lignes[0]).toMatchObject({ nb_destinataires: 0, nb_exclus_opposition: 1 })
  })

  it('« Recevoir à nouveau » : seulement le lien qui a servi, dans les 24 h → la personne est réincluse', async () => {
    const { cop } = await immeuble(1)
    const d = await creerOk(cop)
    const x = await destinataireDe(d.diffusion_id, 'declarant0@exemple.test')
    await opposer(x)
    expect(await lever(x)).toBe(true)
    expect((await apercu(cop)).lignes[0]).toMatchObject({ nb_destinataires: 1, nb_exclus_opposition: 0 })
    const [o] = await q<{ levee_destinataire_id: string; n: number }>(
      `SELECT levee_destinataire_id, (SELECT count(*)::int FROM signalements_qr_journal WHERE copropriete_id = $1
          AND action = 'diffusion.opposition_levee') AS n FROM signalements_qr_diffusion_oppositions WHERE copropriete_id = $1`, [cop])
    expect(o).toEqual({ levee_destinataire_id: x, n: 1 })
    expect(await lever(x)).toBe(false)
  })

  it('levée refusée, SANS écriture : autre lien, plus de 24 h, opposition plainte / demande du cabinet / lien expiré', async () => {
    const { cop } = await immeuble(2)
    const d1 = await creerOk(cop)
    const d2 = await creerOk(cop)
    const x1 = await destinataireDe(d1.diffusion_id, 'declarant0@exemple.test')
    const x2 = await destinataireDe(d2.diffusion_id, 'declarant0@exemple.test')
    const empreinte = async () => q("SELECT * FROM signalements_qr_diffusion_oppositions WHERE copropriete_id = $1 ORDER BY id", [cop])
    const journal = async () => (await q<{ n: number }>("SELECT count(*)::int AS n FROM signalements_qr_journal WHERE copropriete_id = $1", [cop]))[0].n

    await opposer(x1)
    const avant = { opp: await empreinte(), journal: await journal() }
    expect(await lever(x2)).toBe(false)                                  // un autre message de la même personne
    await q("UPDATE signalements_qr_diffusion_oppositions SET created_at = now() - interval '25 hours' WHERE copropriete_id = $1", [cop])
    expect(await lever(x1)).toBe(false)                                  // plus de 24 h
    expect((await empreinte()).map((o) => o.levee_le)).toEqual([null])
    expect(await journal()).toBe(avant.journal)

    for (const origine of ['plainte', 'lien_expire'] as const) {
      await q('DELETE FROM signalements_qr_diffusion_oppositions WHERE copropriete_id = $1', [cop])
      await opposer(x1, origine, origine === 'lien_expire' ? 'declarant0@exemple.test' : null)
      expect(await lever(x1), origine).toBe(false)
    }
    await q('DELETE FROM signalements_qr_diffusion_oppositions WHERE copropriete_id = $1', [cop])
    const [sig] = await q<{ id: string }>("SELECT id FROM signalements_qr WHERE copropriete_id = $1 AND email = 'declarant0@exemple.test'", [cop])
    await ok(`SELECT signalements_qr_diffusion_opposer_signalement($1::uuid, $2::uuid, $3::uuid, 'super_admin', NULL, '2026-11-10')`,
      [sig.id, cop, SUPER_ADMIN])
    expect(await lever(x1)).toBe(false)
    expect((await empreinte()).every((o) => o.levee_le === null)).toBe(true)
  })

  it('lecture du lien : noms figés, adresse (si inchangée), opposée et levable — aucune date d’opposition', async () => {
    const { cop } = await immeuble(1)
    const d = await creerOk(cop)
    const x = await destinataireDe(d.diffusion_id, 'declarant0@exemple.test')
    const lire = async () => (await ok<Record<string, unknown>>('SELECT * FROM signalements_qr_diffusion_lien($1::uuid)', [x]))[0]
    expect(await lire()).toMatchObject({ diffusion_id: d.diffusion_id, copropriete_id: cop, email: 'declarant0@exemple.test', oppose: false, levable: false, langue: 'fr' })
    await opposer(x)
    const apres = await lire()
    expect(apres).toMatchObject({ oppose: true, levable: true })
    expect(Object.keys(apres).filter((k) => /oppos.*(le|date)|created/.test(k))).toEqual([])
    await q("UPDATE signalements_qr SET email = 'nouvelle@exemple.test' WHERE copropriete_id = $1", [cop])
    expect((await lire()).email).toBeNull()
    expect(await ok('SELECT * FROM signalements_qr_diffusion_lien($1::uuid)', [randomUUID()])).toEqual([])
  })
})

describe('envoi par lots', () => {
  it('250 destinataires : lots de 100, 100 et 50 sous les numéros 1, 2, 3 ; plus rien ensuite', async () => {
    const { cop } = await immeuble(250)
    const d = await creerOk(cop)
    const tailles: number[] = []
    const numeros: number[] = []
    for (let i = 0; i < 4; i++) {
      const lignes = await envoyerLot(d.diffusion_id)
      tailles.push(lignes.length)
      if (lignes.length) numeros.push(...new Set(lignes.map((l) => l.lot)))
      expect(lignes.every((l) => !l.reprise)).toBe(true)
    }
    expect(tailles).toEqual([100, 100, 50, 0])
    expect(numeros).toEqual([1, 2, 3])
    expect((await etats(d.diffusion_id)).every((e) => e.etat === 'envoye')).toBe(true)
  })

  it('lot interrompu (en cours depuis plus de 10 minutes) sans opposition : rejoué à l’identique, même numéro', async () => {
    const { cop } = await immeuble(3)
    const d = await creerOk(cop)
    const premier = await lot(d.diffusion_id)
    expect(await lot(d.diffusion_id)).toEqual([])                       // en cours depuis moins de 10 minutes : rien
    await q("UPDATE signalements_qr_diffusion_destinataires SET tente_le = now() - interval '11 minutes' WHERE diffusion_id = $1", [d.diffusion_id])
    const reprise = await lot(d.diffusion_id)
    expect(reprise.map((l) => [l.destinataire_id, l.email, l.lot])).toEqual(premier.map((l) => [l.destinataire_id, l.email, l.lot]))
    expect(reprise.every((l) => l.reprise)).toBe(true)
  })

  it('lot interrompu dont une adresse s’est opposée : cette ligne annulée, les autres sous un NOUVEAU numéro, jamais l’ancien', async () => {
    const { cop } = await immeuble(3)
    const d = await creerOk(cop)
    const premier = await lot(d.diffusion_id)
    expect(premier[0].lot).toBe(1)
    const opposee = premier[1].destinataire_id
    expect((await opposer(opposee)).lignes[0].r).toBe(true)
    expect((await etats(d.diffusion_id)).find((e) => e.id === opposee)?.etat).toBe('en_cours')   // lot en vol : pas touché ici
    await q("UPDATE signalements_qr_diffusion_destinataires SET tente_le = now() - interval '11 minutes' WHERE diffusion_id = $1", [d.diffusion_id])
    const reprise = await lot(d.diffusion_id)
    expect(reprise).toHaveLength(2)
    expect(reprise.map((l) => l.destinataire_id)).not.toContain(opposee)
    expect(new Set(reprise.map((l) => l.lot))).toEqual(new Set([2]))
    expect(reprise.every((l) => !l.reprise)).toBe(true)
    expect((await etats(d.diffusion_id)).find((e) => e.id === opposee)).toMatchObject({ etat: 'annule', code: 'opposition' })
    // Le résultat tardif de l'ancien lot (numéro 1) n'écrit plus rien.
    expect(await resultats(d.diffusion_id, 1, { envoyes: premier.map((l) => l.destinataire_id) })).toMatchObject({ envoyes: 0 })
  })

  it('adresse changée depuis la création → refusée (adresse_changee) ; signalement supprimé → refusée (adresse_absente)', async () => {
    const { cop } = await immeuble(3)
    const d = await creerOk(cop)
    await q("UPDATE signalements_qr SET email = 'autre@exemple.test' WHERE copropriete_id = $1 AND email = 'declarant0@exemple.test'", [cop])
    await q("DELETE FROM signalements_qr WHERE copropriete_id = $1 AND email = 'declarant1@exemple.test'", [cop])
    const lignes = await lot(d.diffusion_id)
    expect(lignes.map((l) => l.email)).toEqual(['declarant2@exemple.test'])
    const codes = (await etats(d.diffusion_id)).map((e) => `${e.etat}:${e.code}`).sort()
    expect(codes).toEqual(['en_cours:null', 'refuse:adresse_absente', 'refuse:adresse_changee'])
  })

  it('copropriété désactivée, fin de mission passée ou cabinet suspendu entre deux lots : arrêt, lignes restantes annulées', async () => {
    for (const geste of ['copro', 'fin', 'cabinet'] as const) {
      const { cab, cop } = await immeuble(150)
      const d = await creerOk(cop)
      await envoyerLot(d.diffusion_id)
      if (geste === 'copro') await q('UPDATE signalements_qr_coproprietes SET actif = false WHERE id = $1', [cop])
      if (geste === 'fin') await q("UPDATE signalements_qr_coproprietes SET diffusion_fin_gestion_le = DATE '2026-01-01' WHERE id = $1", [cop])
      if (geste === 'cabinet') await q('UPDATE signalements_qr_cabinets SET diffusion_activee_le = NULL WHERE id = $1', [cab])
      expect(await lot(d.diffusion_id), geste).toEqual([])
      const e = await etats(d.diffusion_id)
      expect(e.filter((x) => x.etat === 'annule' && x.code === 'diffusion_inactive'), geste).toHaveLength(50)
      expect(e.filter((x) => x.etat === 'envoye')).toHaveLength(100)
    }
  })

  it('plus rien ne part 24 h après la création : en attente → annulées (perime) ; lot interrompu → incertain', async () => {
    const { cop } = await immeuble(150)
    const d = await creerOk(cop)
    await lot(d.diffusion_id)
    await q(`UPDATE signalements_qr_diffusions SET created_at = now() - interval '25 hours' WHERE id = $1;`, [d.diffusion_id])
    await q("UPDATE signalements_qr_diffusion_destinataires SET tente_le = now() - interval '20 hours' WHERE diffusion_id = $1 AND etat = 'en_cours'", [d.diffusion_id])
    expect(await lot(d.diffusion_id)).toEqual([])
    const e = await etats(d.diffusion_id)
    expect(e.filter((x) => x.etat === 'annule' && x.code === 'perime')).toHaveLength(50)
    expect(e.filter((x) => x.etat === 'incertain' && x.code === 'issue_inconnue')).toHaveLength(100)
  })

  it('lot en cours depuis plus de 23 h (clé d’idempotence expirée) : incertain, jamais renvoyé', async () => {
    const { cop } = await immeuble(2)
    const d = await creerOk(cop)
    await lot(d.diffusion_id)
    await q("UPDATE signalements_qr_diffusions SET created_at = now() - interval '23 hours 50 minutes' WHERE id = $1", [d.diffusion_id])
    await q("UPDATE signalements_qr_diffusion_destinataires SET tente_le = now() - interval '23 hours 30 minutes' WHERE diffusion_id = $1", [d.diffusion_id])
    expect(await lot(d.diffusion_id)).toEqual([])
    expect((await etats(d.diffusion_id)).map((e) => `${e.etat}:${e.code}`)).toEqual(['incertain:issue_inconnue', 'incertain:issue_inconnue'])
  })

  it('résultats : acceptés, refusés, limite et quota (remis en attente), contenu refusé au rejeu (incertain) ; seulement les lignes de CE lot en cours', async () => {
    const { cop } = await immeuble(5)
    const d = await creerOk(cop)
    const l = await lot(d.diffusion_id)
    const ids = l.map((x) => x.destinataire_id)
    expect(await resultats(d.diffusion_id, 2, { envoyes: ids })).toMatchObject({ envoyes: 0, reste: 5 })   // autre numéro : rien
    expect(await resultats(d.diffusion_id, 1, { envoyes: [ids[0]], refuses: [ids[1]], nonPartis: [ids[2]], code: 'limite_service' }))
      .toEqual({ envoyes: 1, refuses: 1, nonPartis: 1, reste: 3 })
    expect(await resultats(d.diffusion_id, 1, { nonPartis: [ids[3]], code: 'quota_service' })).toMatchObject({ nonPartis: 1 })
    expect(await resultats(d.diffusion_id, 1, { nonPartis: [ids[4]], code: 'issue_inconnue' })).toMatchObject({ nonPartis: 1, reste: 2 })
    const e = new Map((await etats(d.diffusion_id)).map((x) => [x.id, `${x.etat}:${x.code}`]))
    expect(ids.map((i) => e.get(i))).toEqual([
      'envoye:null', 'refuse:adresse_refusee', 'en_attente:limite_service', 'en_attente:quota_service', 'incertain:issue_inconnue',
    ])
    const relance = await lot(d.diffusion_id)
    expect(relance.map((x) => x.destinataire_id).sort()).toEqual([ids[2], ids[3]].sort())
    expect(relance[0].lot).toBe(2)
    const invalide = await service('SELECT signalements_qr_diffusion_resultats($1::uuid, 1, NULL, NULL, $2::uuid[], NULL)', [d.diffusion_id, [ids[0]]])
    expect(invalide.erreur?.code).toBe('22023')
  })

  it('filet de reprise : diffusions de moins d’une heure ayant des lignes à envoyer, ou un lot interrompu', async () => {
    const a = await immeuble(1)
    const enAttente = await creerOk(a.cop)
    const b = await immeuble(1)
    const enVol = await creerOk(b.cop)
    await lot(enVol.diffusion_id)
    const c = await immeuble(1)
    const vieille = await creerOk(c.cop)
    await q("UPDATE signalements_qr_diffusions SET created_at = now() - interval '61 minutes' WHERE id = $1", [vieille.diffusion_id])
    const liste = async () => (await ok<{ diffusion_id: string }>('SELECT * FROM signalements_qr_diffusions_a_reprendre(10)')).map((r) => r.diffusion_id)
    expect(await liste()).toEqual([enAttente.diffusion_id])
    await q("UPDATE signalements_qr_diffusion_destinataires SET tente_le = now() - interval '11 minutes' WHERE diffusion_id = $1", [enVol.diffusion_id])
    expect((await liste()).sort()).toEqual([enAttente.diffusion_id, enVol.diffusion_id].sort())
  })

  it('historique et compteur du mois : nombres agrégés ; une diffusion entièrement annulée et l’annonce ne comptent pas', async () => {
    const { cab, cop } = await immeuble(2)
    await depot(cop, { email: 'ancien@exemple.test', annonce: null })
    const envoyee = await creerOk(cop)
    await envoyerLot(envoyee.diffusion_id)
    const annulee = await creerOk(cop)
    const annonce = await creerOk(cop, { modele: 'annonce' })
    await envoyerLot(annonce.diffusion_id)
    await q('UPDATE signalements_qr_cabinets SET diffusion_activee_le = NULL WHERE id = $1', [cab])
    await lot(annulee.diffusion_id)
    const [mois] = await ok<{ nb: number; dernier_le: Date }>('SELECT * FROM signalements_qr_diffusions_mois($1::uuid)', [cop])
    expect(mois.nb).toBe(1)
    const liste = await ok<Record<string, unknown>>('SELECT * FROM signalements_qr_diffusions_liste($1::uuid, NULL, 20)', [cop])
    expect(liste).toHaveLength(3)
    const parId = new Map(liste.map((l) => [l.id, l]))
    expect(parId.get(envoyee.diffusion_id)).toMatchObject({ nb_envoyes: 2, nb_annules: 0, nb_attente: 0 })
    expect(parId.get(annulee.diffusion_id)).toMatchObject({ nb_envoyes: 0, nb_annules: 2 })
    expect(parId.get(annonce.diffusion_id)).toMatchObject({ modele: 'annonce', nb_envoyes: 1 })
    expect(JSON.stringify(liste)).not.toMatch(/@|eau sera coupée/)
  })

  it('valeurs présentes : couples (bâtiment, étage) bruts rognés, distincts, avec le nombre d’adresses', async () => {
    const { cop } = await immeuble(0)
    await depot(cop, { email: 'a@exemple.test', batiment: ' A ', etage: '1er' })
    await depot(cop, { email: 'A@exemple.test', batiment: 'A', etage: '1er ' })
    await depot(cop, { email: 'b@exemple.test', batiment: 'A', etage: 'RDC' })
    await depot(cop, { email: 'c@exemple.test', batiment: '', etage: '2' })
    const v = await ok<{ batiment: string; etage: string; nb_adresses: number }>('SELECT * FROM signalements_qr_diffusion_valeurs($1::uuid)', [cop])
    expect(v.map((x) => [x.batiment, x.etage, x.nb_adresses])).toEqual([['', '2', 1], ['A', '1er', 1], ['A', 'RDC', 1]])
  })
})

describe('H1 = option C : message d’annonce unique, inclusion 15 jours après si pas de refus', () => {
  it('cible inversée : l’annonce ne vise que les adresses jamais annoncées, la diffusion ordinaire seulement les autres', async () => {
    const { cop } = await immeuble(1)                                    // annoncée par l'accusé
    await depot(cop, { email: 'ancien1@exemple.test', annonce: null, ilYa: '200 days' })
    await depot(cop, { email: 'ancien2@exemple.test', annonce: null, ilYa: '100 days' })
    expect((await apercu(cop)).lignes[0].nb_destinataires).toBe(1)
    expect((await apercu(cop, { annonce: true })).lignes[0].nb_destinataires).toBe(2)
    const a = await creerOk(cop, { modele: 'annonce', attendu: 2 })
    expect(await destinatairesEmails(a.diffusion_id)).toEqual(['ancien1@exemple.test', 'ancien2@exemple.test'])
  })

  it('annonce partie : chaque signalement de l’adresse est daté (origine message) ; pas inclus avant 15 jours, inclus ensuite, jamais réannoncé', async () => {
    const { cop } = await immeuble(1)
    await depot(cop, { email: 'ancien@exemple.test', annonce: null, ilYa: '200 days' })
    await depot(cop, { email: 'Ancien@exemple.test', annonce: null, ilYa: '100 days' })
    const a = await creerOk(cop, { modele: 'annonce' })
    await envoyerLot(a.diffusion_id)
    const dates = await q<{ origine: string; egal: boolean }>(
      `SELECT s.diffusion_annonce_origine AS origine, s.diffusion_annoncee_le = x.envoye_le AS egal
         FROM signalements_qr s JOIN signalements_qr_diffusion_destinataires x ON x.diffusion_id = $1
        WHERE s.copropriete_id = $2 AND lower(s.email) = 'ancien@exemple.test'`, [a.diffusion_id, cop])
    expect(dates).toEqual([{ origine: 'message', egal: true }, { origine: 'message', egal: true }])
    expect((await apercu(cop)).lignes[0].nb_destinataires).toBe(1)                // pendant 15 jours : pas encore
    expect((await apercu(cop, { annonce: true })).lignes[0].nb_destinataires).toBe(0)   // jamais réannoncé
    await q(`UPDATE signalements_qr SET diffusion_annoncee_le = now() - interval '14 days 23 hours'
              WHERE copropriete_id = $1 AND diffusion_annonce_origine = 'message'`, [cop])
    expect((await apercu(cop)).lignes[0].nb_destinataires).toBe(1)
    await q(`UPDATE signalements_qr SET diffusion_annoncee_le = now() - interval '15 days'
              WHERE copropriete_id = $1 AND diffusion_annonce_origine = 'message'`, [cop])
    expect((await apercu(cop)).lignes[0].nb_destinataires).toBe(2)
  })

  it('refus pendant les 15 jours (bouton du message d’annonce) : jamais inclus', async () => {
    const { cop } = await immeuble(0)
    await depot(cop, { email: 'ancien@exemple.test', annonce: null, ilYa: '30 days' })
    const a = await creerOk(cop, { modele: 'annonce' })
    const [l] = await envoyerLot(a.diffusion_id)
    expect((await opposer(l.destinataire_id)).lignes[0].r).toBe(true)
    await q("UPDATE signalements_qr SET diffusion_annoncee_le = now() - interval '20 days' WHERE copropriete_id = $1", [cop])
    expect((await apercu(cop)).lignes[0]).toMatchObject({ nb_destinataires: 0, nb_exclus_opposition: 1 })
  })

  it('accusé (nouveaux déclarants, art. 13.4) : annonce seulement si la diffusion existe et sans opposition ; datée → inclus aussitôt', async () => {
    const { cab, cop } = await immeuble(0)
    const s = await depot(cop, { email: 'nouveau@exemple.test', annonce: null, ilYa: '0' })
    const annonce = async () => (await ok<{ r: boolean }>('SELECT signalements_qr_diffusion_annonce($1::uuid) AS r', [s]))[0].r
    const faite = async () => (await ok<{ r: boolean }>('SELECT signalements_qr_diffusion_annonce_faite($1::uuid) AS r', [s]))[0].r
    expect(await annonce()).toBe(true)
    await q('UPDATE signalements_qr_cabinets SET diffusion_activee_le = NULL WHERE id = $1', [cab])
    expect(await annonce()).toBe(false)
    expect(await faite()).toBe(false)
    await q('UPDATE signalements_qr_cabinets SET diffusion_activee_le = now() WHERE id = $1', [cab])
    expect(await faite()).toBe(true)
    expect(await faite()).toBe(false)                                       // datée une fois
    const [r] = await q<{ origine: string }>('SELECT diffusion_annonce_origine AS origine FROM signalements_qr WHERE id = $1', [s])
    expect(r.origine).toBe('accuse')
    expect((await apercu(cop)).lignes[0].nb_destinataires).toBe(1)
  })

  it('le message d’annonce est réservé à la copropriété entière (contrainte de la table aussi)', async () => {
    const { cop } = await immeuble(1)
    expect((await creer(cop, { modele: 'annonce', portee: 'batiment', batiments: ['A'] })).erreur?.code).toBe('22023')
    const d = await creerOk(cop)
    await db.exec('SAVEPOINT s')
    let erreur: ErreurPg | null = null
    try {
      await db.exec(`UPDATE signalements_qr_diffusions SET modele = 'annonce', portee = 'batiment', cle_batiment = 'a' WHERE id = '${d.diffusion_id}'`)
    } catch (e) { erreur = erreurPg(e) }
    await db.exec('ROLLBACK TO SAVEPOINT s')
    expect(erreur?.code).toBe('23514')
  })

  it('les résultats d’un lot ne datent que les adresses servies par CE lot (coût borné par le lot)', async () => {
    const { cop } = await immeuble(0)
    await depot(cop, { email: 'ancien1@exemple.test', annonce: null, ilYa: '30 days' })
    await depot(cop, { email: 'ancien2@exemple.test', annonce: null, ilYa: '30 days' })
    const a = await creerOk(cop, { modele: 'annonce' })
    const [premier] = await lot(a.diffusion_id, 1)
    // État posé directement : la ligne du lot 1 est envoyée, ses signalements ne sont pas datés.
    await q("UPDATE signalements_qr_diffusion_destinataires SET etat = 'envoye', envoye_le = now() WHERE id = $1", [premier.destinataire_id])
    const [second] = await lot(a.diffusion_id, 1)
    await resultats(a.diffusion_id, second.lot, { envoyes: [second.destinataire_id] })
    const datees = await q<{ email: string }>(
      'SELECT lower(email) AS email FROM signalements_qr WHERE copropriete_id = $1 AND diffusion_annoncee_le IS NOT NULL', [cop])
    expect(datees.map((d) => d.email)).toEqual([second.email])
  })
})

// Relecture du 12/11 : la datation relisait toutes les lignes envoyées de la diffusion et recalculait l'empreinte de chaque
// signalement de la copropriété, en (lignes envoyées × signalements). Base dédiée : ANALYZE y change les statistiques.
describe('H1 : coût du message d’annonce (base dédiée, statistiques réelles)', () => {
  let base: PGlite
  const EMPREINTE = 'signalements_qr_empreinte_email(text)'
  beforeAll(async () => { base = await creerBaseSignalementsQr() }, 120_000)
  afterAll(async () => { await base?.close() })

  it('index (copropriété, empreinte de l’adresse) sur signalements_qr ; service_role y écrit (droit EXECUTE sur l’empreinte)', async () => {
    const [i] = (await base.query<{ def: string | null }>(
      "SELECT pg_get_indexdef(to_regclass('idx_signalements_qr_copro_empreinte')) AS def")).rows
    expect(i.def ?? 'index absent').toMatch(/ON public\.signalements_qr USING btree \(copropriete_id, signalements_qr_empreinte_email\(email\)\)/)
    await base.exec('BEGIN')
    try {
      await base.exec(`INSERT INTO signalements_qr_coproprietes (id, nom, jeton) VALUES ('44444444-4444-4444-4444-444444444444', 'Résidence exemple', replace(gen_random_uuid()::text, '-', ''));
        SET LOCAL ROLE service_role;
        INSERT INTO signalements_qr (copropriete_id, prenom, nom, telephone, email, batiment, etage, num_lot, type_intervention, description)
        VALUES ('44444444-4444-4444-4444-444444444444', 'P', 'N', '0600000000', 'droit@exemple.test', 'A', '1', '1', 'plomberie', 'Description d’exemple');`)
    } finally {
      await base.exec('ROLLBACK')
    }
  })

  it('2 000 déclarants jamais annoncés, 20 autres copropriétés : chaque résultat de lot calcule au plus 2 empreintes par ligne du lot, quel que soit son rang', async () => {
    const CAB = '55555555-5555-5555-5555-555555555555'
    const COP = '66666666-6666-6666-6666-666666666666'
    await base.exec(`
      INSERT INTO signalements_qr_cabinets (id, nom, identifiant, langue, diffusion_contact_email, diffusion_politique_url,
        diffusion_politique_verifiee_le, diffusion_contrat_reference, diffusion_contrat_signe_le, diffusion_activee_le, diffusion_activee_par)
      VALUES ('${CAB}', 'Cabinet exemple', 'cabinet-exemple-cout', 'fr', 'contact@cabinet-exemple.test',
        'https://cabinet-exemple.test/confidentialite', now(), 'Contrat exemple v1', current_date - 10, now(), gen_random_uuid());
      INSERT INTO signalements_qr_coproprietes (id, nom, jeton, cabinet_id) VALUES ('${COP}', 'Résidence exemple', replace(gen_random_uuid()::text, '-', ''), '${CAB}');
      INSERT INTO signalements_qr_coproprietes (nom, jeton, cabinet_id)
        SELECT 'Autre exemple ' || g, replace(gen_random_uuid()::text, '-', ''), '${CAB}' FROM generate_series(1, 20) g;
      INSERT INTO signalements_qr (copropriete_id, prenom, nom, telephone, email, batiment, etage, num_lot, type_intervention, description, created_at)
        SELECT '${COP}', 'P', 'N', '0600000000', 'ancien' || g || '@exemple.test', 'B' || (g % 20), (g % 10)::text, '1', 'plomberie',
               'Description d’exemple', now() - interval '30 days' FROM generate_series(1, 2000) g;
      INSERT INTO signalements_qr (copropriete_id, prenom, nom, telephone, email, batiment, etage, num_lot, type_intervention, description, created_at,
                                   diffusion_annoncee_le, diffusion_annonce_origine)
        SELECT c.id, 'P', 'N', '0600000000', 'autre' || g || '@exemple.test', 'A', '1', '1', 'plomberie', 'Description d’exemple',
               now() - interval '30 days', now() - interval '30 days', 'accuse'
          FROM (SELECT id FROM signalements_qr_coproprietes WHERE nom LIKE 'Autre exemple %') c, generate_series(1, 400) g;
      ANALYZE;`)
    const sousService = async <T>(sql: string, params: unknown[] = []): Promise<T[]> => {
      await base.exec('SET LOCAL ROLE service_role')
      try { return (await base.query<T>(sql, params)).rows } finally { await base.exec('RESET ROLE') }
    }
    const appels = async () => (await base.query<{ n: number }>(
      `SELECT coalesce(pg_stat_get_xact_function_calls('${EMPREINTE}'::regprocedure), 0)::int AS n`)).rows[0].n
    await base.exec('BEGIN')
    const [ap] = await sousService<{ instant: Date; nb_destinataires: number }>(
      "SELECT * FROM signalements_qr_diffusion_apercu($1, 'copropriete', NULL, NULL, NULL, true)", [COP])
    const [cree] = await sousService<{ diffusion_id: string }>(
      `SELECT * FROM signalements_qr_diffusion_creer(gen_random_uuid(), $1, gen_random_uuid(), 'super_admin', NULL,
         'Courriel du cabinet du 12/11/2026', current_date, 'annonce', 'Objet d’exemple', 'Texte d’exemple du message.',
         'copropriete', NULL, NULL, NULL, NULL, NULL, 'Toute la copropriété', $2, $3, '"Cabinet exemple" <diffusion@exemple.test>')`,
      [COP, new Date(ap.instant.getTime() - 1000), ap.nb_destinataires])
    await base.exec('COMMIT')
    await base.exec('ANALYZE')
    expect(ap.nb_destinataires).toBe(2000)
    const parLot: Array<{ appels: number; ms: number }> = []
    for (let i = 0; i < 3; i++) {
      await base.exec('BEGIN')
      await base.exec("SET LOCAL track_functions = 'all'")
      const lignes = await sousService<{ destinataire_id: string; lot: number }>(
        'SELECT * FROM signalements_qr_diffusion_lot($1, 100)', [cree.diffusion_id])
      const avant = await appels()
      const t = performance.now()
      await sousService("SELECT signalements_qr_diffusion_resultats($1, $2, $3::uuid[], '{}', '{}', NULL)",
        [cree.diffusion_id, lignes[0].lot, lignes.map((l) => l.destinataire_id)])
      parLot.push({ appels: (await appels()) - avant, ms: Math.round(performance.now() - t) })
      await base.exec('COMMIT')
    }
    console.info(`résultats d’annonce, lots 1 à 3 : ${parLot.map((p) => `${p.appels} empreintes en ${p.ms} ms`).join(' ; ')}`)
    const [datees] = (await base.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM signalements_qr WHERE copropriete_id = $1 AND diffusion_annonce_origine = 'message'", [COP])).rows
    expect(datees.n).toBe(300)
    // Avant la correction : 2 100, 2 000 puis 1 900 (toute la copropriété à chaque lot). Après : l'index de la ligne datée.
    for (const p of parLot) expect(p.appels).toBeLessThanOrEqual(200)
  }, 300_000)
})

// Condition 5 de la note (droit.md, option C) : « une seule annonce, sans relance ».
describe('H1 = option C, condition 5 : une seule annonce par adresse, jamais deux', () => {
  /** Annonce de la copropriété : nombre d'adresses de l'aperçu. */
  const apercuAnnonce = async (cop: string) => (await apercu(cop, { annonce: true })).lignes[0].nb_destinataires

  it('annonce créée, pas encore partie : une nouvelle annonce ne compte plus ces adresses (aperçu 0, création aucun_destinataire)', async () => {
    const { cop } = await immeuble(0)
    await depot(cop, { email: 'ancien1@exemple.test', annonce: null, ilYa: '30 days' })
    await depot(cop, { email: 'ancien2@exemple.test', annonce: null, ilYa: '30 days' })
    const a = await creerOk(cop, { modele: 'annonce' })
    expect(a.nb_destinataires).toBe(2)
    expect(await apercuAnnonce(cop)).toBe(0)
    expect((await creer(cop, { modele: 'annonce' })).erreur?.message).toBe('aucun_destinataire')
    await lot(a.diffusion_id)                                               // lot réservé, résultat pas encore reçu
    expect(await apercuAnnonce(cop)).toBe(0)
    // Une adresse que l'annonce A ne visait pas reste à annoncer.
    await depot(cop, { email: 'ancien3@exemple.test', annonce: null, ilYa: '2 days' })
    expect(await apercuAnnonce(cop)).toBe(1)
  })

  it.each([
    ['en_attente', null, 0], ['en_cours', null, 0], ['envoye', null, 0], ['incertain', 'issue_inconnue', 0],
    ['refuse', 'adresse_refusee', 1], ['annule', 'perime', 1], ['annule', 'diffusion_inactive', 1],
  ] as const)('ligne d’annonce « %s » (%s) : l’adresse compte %i fois dans une nouvelle annonce', async (etat, code, attendu) => {
    const { cop } = await immeuble(0)
    await depot(cop, { email: 'ancien@exemple.test', annonce: null, ilYa: '30 days' })
    const a = await creerOk(cop, { modele: 'annonce' })
    // État posé directement (sans datation) : seule la ligne de l'annonce A décide.
    await q(`UPDATE signalements_qr_diffusion_destinataires SET etat = $2, code = $3, lot = 1, tente_le = now(),
               envoye_le = CASE WHEN $2 = 'envoye' THEN now() END WHERE diffusion_id = $1`, [a.diffusion_id, etat, code])
    expect(await apercuAnnonce(cop)).toBe(attendu)
  })

  it('adresse annoncée par un accusé après la création de l’annonce : le lot ne la sert pas (annule, deja_annoncee), ni à la reprise', async () => {
    const { cop } = await immeuble(0)
    for (const email of ['ancien@exemple.test', 'autre@exemple.test', 'troisieme@exemple.test']) {
      await depot(cop, { email, annonce: null, ilYa: '30 days' })
    }
    const a = await creerOk(cop, { modele: 'annonce' })
    // Nouveau dépôt de la même personne : son accusé lui a annoncé la diffusion (art. 13.4), l'annonce ne repart pas.
    await depot(cop, { email: 'Ancien@exemple.test', annonce: 'accuse', ilYa: '0' })
    const attendu = await emailDuPremierEnAttente(a.diffusion_id, ['ancien@exemple.test'])
    const premier = await lot(a.diffusion_id, 1)
    expect(premier.map((l) => l.email)).toEqual([attendu])
    const ancien = await destinataireDe(a.diffusion_id, 'ancien@exemple.test')
    // Lot interrompu : l'adresse servie entre-temps par un accusé est écartée, le reste repart sous un nouveau numéro.
    await q("UPDATE signalements_qr_diffusion_destinataires SET tente_le = now() - interval '11 minutes' WHERE diffusion_id = $1 AND etat = 'en_cours'", [a.diffusion_id])
    await depot(cop, { email: premier[0].email, annonce: 'accuse', ilYa: '0' })
    expect(await lot(a.diffusion_id, 1)).toHaveLength(1)
    const e = new Map((await etats(a.diffusion_id)).map((x) => [x.id, `${x.etat}:${x.code}`]))
    expect(e.get(ancien)).toBe('annule:deja_annoncee')
    expect(e.get(premier[0].destinataire_id)).toBe('annule:deja_annoncee')
    expect([...e.values()].filter((v) => v === 'en_cours:null')).toHaveLength(1)
  })

  it('deux annonces visent la même adresse (état simulé) : la première partie, le lot de la seconde ne la sert pas', async () => {
    const { cop } = await immeuble(0)
    await depot(cop, { email: 'ancien@exemple.test', annonce: null, ilYa: '30 days' })
    const a = await creerOk(cop, { modele: 'annonce' })
    const [b] = await q<{ id: string }>(
      `INSERT INTO signalements_qr_diffusions (copropriete_id, cabinet_id, operation_id, acteur_id, acteur_profil,
         instruction_reference, instruction_recue_le, modele, langue, fige_cabinet_nom, fige_cabinet_identifiant,
         fige_copropriete_nom, fige_contact_email, fige_politique_url, fige_expediteur, perimetre_jusqu_au, objet, texte,
         portee, libelle_perimetre, nb_destinataires)
       SELECT copropriete_id, cabinet_id, gen_random_uuid(), acteur_id, acteur_profil, instruction_reference,
              instruction_recue_le, modele, langue, fige_cabinet_nom, fige_cabinet_identifiant, fige_copropriete_nom,
              fige_contact_email, fige_politique_url, fige_expediteur, perimetre_jusqu_au, objet, texte, portee,
              libelle_perimetre, nb_destinataires
         FROM signalements_qr_diffusions WHERE id = $1 RETURNING id`, [a.diffusion_id])
    await q(`INSERT INTO signalements_qr_diffusion_destinataires (diffusion_id, copropriete_id, email_empreinte, signalement_source_id)
             SELECT $2, copropriete_id, email_empreinte, signalement_source_id FROM signalements_qr_diffusion_destinataires
              WHERE diffusion_id = $1`, [a.diffusion_id, b.id])
    expect((await envoyerLot(a.diffusion_id)).map((l) => l.email)).toEqual(['ancien@exemple.test'])
    // Même si la datation des signalements manquait, la ligne envoyée de A suffit à ne pas réannoncer.
    await q("UPDATE signalements_qr SET diffusion_annoncee_le = NULL, diffusion_annonce_origine = NULL WHERE copropriete_id = $1", [cop])
    expect(await lot(b.id)).toEqual([])
    expect((await etats(b.id)).map((x) => `${x.etat}:${x.code}`)).toEqual(['annule:deja_annoncee'])
  })

  it('message ordinaire : une adresse déjà annoncée part normalement (la règle ne vaut que pour l’annonce)', async () => {
    const { cop } = await immeuble(2)
    const d = await creerOk(cop)
    expect(await envoyerLot(d.diffusion_id)).toHaveLength(2)
  })
})

/** Adresse de la première ligne en attente (ordre du lot : identifiant) hors des adresses écartées. */
async function emailDuPremierEnAttente(diffusion: string, ecartees: string[]): Promise<string> {
  const lignes = await q<{ email: string }>(
    `SELECT lower(btrim(s.email)) AS email FROM signalements_qr_diffusion_destinataires x
       JOIN signalements_qr s ON s.id = x.signalement_source_id
      WHERE x.diffusion_id = $1 AND x.etat = 'en_attente' AND NOT (lower(btrim(s.email)) = ANY ($2::text[]))
      ORDER BY x.id LIMIT 1`, [diffusion, ecartees])
  return lignes[0]?.email ?? ''
}

describe('conservation et purge (§ 2.5, H10)', () => {
  it('opposition active de plus de 3 ans : supprimée sans signalement restant de l’adresse, gardée sinon ; levée : 3 ans après la levée', async () => {
    const { cop } = await immeuble(2)
    const d = await creerOk(cop)
    const x0 = await destinataireDe(d.diffusion_id, 'declarant0@exemple.test')
    const x1 = await destinataireDe(d.diffusion_id, 'declarant1@exemple.test')
    await opposer(x0)
    await opposer(x1)
    await q("UPDATE signalements_qr_diffusion_oppositions SET created_at = now() - interval '3 years 1 day' WHERE copropriete_id = $1", [cop])
    await q("DELETE FROM signalements_qr WHERE copropriete_id = $1 AND email = 'declarant0@exemple.test'", [cop])
    const autre = await immeuble(0)
    await q(`INSERT INTO signalements_qr_diffusion_oppositions (copropriete_id, email_empreinte, origine, destinataire_id, created_at, levee_le, levee_destinataire_id)
             VALUES ($1, signalements_qr_empreinte_email('leve@exemple.test'), 'page', $2, now() - interval '5 years', now() - interval '3 years 1 day', $2),
                    ($1, signalements_qr_empreinte_email('recent@exemple.test'), 'page', $3, now() - interval '5 years', now() - interval '2 years', $3)`,
      [autre.cop, randomUUID(), randomUUID()])
    const [p] = await ok<{ diffusions: number; oppositions: number; perimees: number }>('SELECT * FROM signalements_qr_diffusion_purger()')
    expect(p.oppositions).toBe(2)
    const restantes = await q<{ email_empreinte: Uint8Array }>(
      `SELECT o.copropriete_id = $1 AS ici, o.email_empreinte = signalements_qr_empreinte_email('declarant1@exemple.test') AS d1,
              o.email_empreinte = signalements_qr_empreinte_email('recent@exemple.test') AS recent
         FROM signalements_qr_diffusion_oppositions o WHERE o.copropriete_id IN ($1, $2) ORDER BY o.id`, [cop, autre.cop])
    expect(restantes).toEqual([{ ici: true, d1: true, recent: false }, { ici: false, d1: false, recent: true }])
    const journal = await q<{ details: Record<string, number> }>("SELECT details FROM signalements_qr_journal WHERE action = 'diffusion.purge'")
    expect(journal.at(-1)?.details).toMatchObject({ oppositions: 2 })
  })

  it('diffusion de plus de 3 ans : supprimée avec ses destinataires ; lignes en attente de plus de 24 h : périmées', async () => {
    const a = await immeuble(2)
    const vieille = await creerOk(a.cop)
    const b = await immeuble(3)
    const hier = await creerOk(b.cop)
    await q("UPDATE signalements_qr_diffusions SET created_at = now() - interval '3 years 1 day' WHERE id = $1", [vieille.diffusion_id])
    await q("UPDATE signalements_qr_diffusions SET created_at = now() - interval '25 hours' WHERE id = $1", [hier.diffusion_id])
    const [p] = await ok<{ diffusions: number; oppositions: number; perimees: number }>('SELECT * FROM signalements_qr_diffusion_purger()')
    expect(p).toMatchObject({ diffusions: 1, perimees: 3 })
    expect(await q('SELECT 1 FROM signalements_qr_diffusion_destinataires WHERE diffusion_id = $1', [vieille.diffusion_id])).toEqual([])
    expect((await etats(hier.diffusion_id)).map((e) => `${e.etat}:${e.code}`)).toEqual(['annule:perime', 'annule:perime', 'annule:perime'])
    const [rien] = await ok<{ diffusions: number; oppositions: number; perimees: number }>('SELECT * FROM signalements_qr_diffusion_purger()')
    expect(rien).toEqual({ diffusions: 0, oppositions: 0, perimees: 0 })
  })
})

describe('plpgsql à RETURNS TABLE : aucune référence ambiguë (42702) à l’exécution', () => {
  it('aperçu, création, lot (nouveau, reprise identique, reprise renumérotée) et purge s’exécutent sans 42702', async () => {
    const { cop } = await immeuble(3)
    const erreurs: Array<ErreurPg | null> = []
    erreurs.push((await apercu(cop)).erreur)
    const c = await creer(cop)
    erreurs.push(c.erreur)
    const id = c.lignes[0].diffusion_id
    const vieillir = () => q("UPDATE signalements_qr_diffusion_destinataires SET tente_le = now() - interval '11 minutes' WHERE diffusion_id = $1 AND etat = 'en_cours'", [id])
    const nouveau = await service<LigneLot>('SELECT * FROM signalements_qr_diffusion_lot($1::uuid, 2)', [id])
    erreurs.push(nouveau.erreur)
    await vieillir()
    const identique = await service<LigneLot>('SELECT * FROM signalements_qr_diffusion_lot($1::uuid, 2)', [id])
    erreurs.push(identique.erreur)
    await opposer(nouveau.lignes[0].destinataire_id)
    await vieillir()
    const renumerote = await service<LigneLot>('SELECT * FROM signalements_qr_diffusion_lot($1::uuid, 2)', [id])
    erreurs.push(renumerote.erreur)
    erreurs.push((await service('SELECT * FROM signalements_qr_diffusion_purger()')).erreur)
    expect(erreurs).toEqual([null, null, null, null, null, null])
    expect(identique.lignes.map((l) => [l.lot, l.reprise])).toEqual([[1, true], [1, true]])
    expect(renumerote.lignes.map((l) => [l.destinataire_id, l.lot, l.reprise])).toEqual([[nouveau.lignes[1].destinataire_id, 2, false]])
  })
})
