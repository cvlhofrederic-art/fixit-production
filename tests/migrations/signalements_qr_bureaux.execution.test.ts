// @vitest-environment node
// tests/migrations/signalements_qr_bureaux.execution.test.ts
//
// EXÉCUTION RÉELLE de la migration 20261119_signalements_qr_bureaux.sql (bureaux des cabinets clients, PR 1 sans écran)
// et de son script de retour arrière, sur un vrai PostgreSQL (PGlite, WebAssembly, en mémoire ; aucun service, aucune
// base distante) :
//   - chaîne 20261104 → 20261114 puis la nouvelle, jouée DEUX fois (rejouabilité, même schéma après chaque passe) ; la
//     20261112 seule, puis la nouvelle (la 20261113 et la 20261114 ne sont pas requises) ; la 20261112 rejouée après :
//     son corps de la création d'une fiche revient, rejouer la nouvelle le remet ;
//   - règles : nom unique à la casse et aux espaces près, bureau d'un autre cabinet refusé (fiche et copropriété),
//     copropriété sans cabinet sans bureau, nouvelle fiche sans bureau refusée si le cabinet a un bureau OUVERT (et
//     seulement alors), fiches existantes jamais bloquées, bureau d'une fiche changé mais jamais retiré, bureau fermé
//     refusé pour un nouveau rattachement, fermeture d'un bureau utilisé refusée ;
//   - journal : actions existantes (cabinet.modifie {bureaux}), énumérations et identifiants, jamais le nom ;
//   - droits : RLS sans politique, rien pour anon ni authenticated, EXECUTE à service_role seul ;
//   - retour arrière : il s'exécute, rend le schéma d'avant (empreinte), se rejoue, et la migration repasse ensuite.
// PGlite embarque PostgreSQL 18 ; la production tourne en 17 : rien de propre à la 18 n'est employé.
// Aucune donnée réelle : « Cabinet exemple n », bureaux « Nord » et « Sud », adresses @exemple.test.

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { randomBytes, randomUUID } from 'crypto'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { MIGRATIONS_SIGNALEMENTS_QR, creerBaseSignalementsQr, empreinteSchemaQr, erreurPg, type ErreurPg } from '../helpers/pglite-signalements'

const BUREAUX = '20261119_signalements_qr_bureaux.sql'
const CHEMIN_RETOUR = join(process.cwd(), 'supabase/retours-arriere/20261119_signalements_qr_bureaux.retour.sql')
const AVANT_BUREAUX = MIGRATIONS_SIGNALEMENTS_QR.filter((f) => f !== BUREAUX)
const JUSQUA_1112 = AVANT_BUREAUX.filter((f) => f <= '20261112_signalements_qr_acces_gestionnaires.sql')

/** Script de retour arrière, lu comme une migration (BOM retiré, CRLF → LF). */
function lireRetour(): string {
  let texte = existsSync(CHEMIN_RETOUR) ? readFileSync(CHEMIN_RETOUR, 'utf-8') : ''
  if (texte.charCodeAt(0) === 0xfeff) texte = texte.slice(1)
  return texte.replace(/\r\n/g, '\n')
}

/** Définition actuelle de la création d'une fiche (md5 du texte reconstruit par PostgreSQL). */
async function definitionInviter(base: PGlite): Promise<string> {
  const { rows } = await base.query<{ d: string }>(
    `SELECT md5(pg_get_functiondef('signalements_qr_inviter_gestionnaire(jsonb, jsonb, uuid[], uuid)'::regprocedure)) AS d`)
  return rows[0].d
}

describe('application : chaîne jouée deux fois, ordres possibles', () => {
  it('20261104 → 20261114 puis la nouvelle, deux fois : aucune erreur, même schéma après chaque passe', async () => {
    expect(MIGRATIONS_SIGNALEMENTS_QR).toContain(BUREAUX)
    expect(MIGRATIONS_SIGNALEMENTS_QR.at(-1)).toBe(BUREAUX)
    let premiere = new Map<string, string>()
    const base = await creerBaseSignalementsQr({ passes: 2, apresPremierePasse: async (b) => { premiere = await empreinteSchemaQr(b) } })
    try {
      const seconde = await empreinteSchemaQr(base)
      expect(premiere.size).toBeGreaterThan(0)
      expect(Object.fromEntries(seconde)).toEqual(Object.fromEntries(premiere))
      for (const cle of ['contrainte signalements_qr_gestionnaires.signalements_qr_gestionnaires_bureau_fk',
        'contrainte signalements_qr_coproprietes.signalements_qr_copros_bureau_fk',
        'contrainte signalements_qr_coproprietes.signalements_qr_copros_bureau_cabinet']) {
        expect(premiere.get(cle), cle).toBeDefined()
        expect(premiere.get(cle), cle).not.toContain('NON VALIDÉE')
      }
    } finally {
      await base.close()
    }
  }, 120_000)

  it('après la 20261112 seule (sans la 20261113 ni la 20261114) : elle passe aussi', async () => {
    const base = await creerBaseSignalementsQr({ migrations: [...JUSQUA_1112, BUREAUX] })
    try {
      const { rows } = await base.query<{ n: number }>(`SELECT count(*)::int AS n FROM pg_class WHERE relname = 'signalements_qr_bureaux'`)
      expect(rows[0].n).toBe(1)
    } finally {
      await base.close()
    }
  }, 120_000)

  it('la 20261112 rejouée après : la création d’une fiche reprend son corps sans bureau ; rejouer la nouvelle le remet', async () => {
    const base = await creerBaseSignalementsQr()
    try {
      const avecBureau = await definitionInviter(base)
      await base.exec(readFileSync(join(process.cwd(), 'supabase/migrations/20261112_signalements_qr_acces_gestionnaires.sql'), 'utf-8').replace(/\r\n/g, '\n'))
      expect(await definitionInviter(base)).not.toBe(avecBureau)
      await base.exec(readFileSync(join(process.cwd(), 'supabase/migrations', BUREAUX), 'utf-8').replace(/\r\n/g, '\n'))
      expect(await definitionInviter(base)).toBe(avecBureau)
    } finally {
      await base.close()
    }
  }, 120_000)
})

// ── Règles, sur la chaîne complète ──────────────────────────────────────────────────────────────────────────────────

let db: PGlite

beforeAll(async () => { db = await creerBaseSignalementsQr() }, 120_000)
afterAll(async () => { await db?.close() })
beforeEach(async () => { await db.exec('BEGIN') })
afterEach(async () => { await db.exec('ROLLBACK') })

async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows
}

interface Appel<T> { lignes: T[]; erreur: ErreurPg | null }

/** Requête sous un rôle de l'API, dans un point de sauvegarde : l'erreur est rendue et la transaction continue. */
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

const SUPER_ADMIN = randomUUID()
let compteur = 0

async function cabinet(): Promise<string> {
  compteur += 1
  const [r] = await q<{ id: string }>(
    `INSERT INTO signalements_qr_cabinets (nom, identifiant) VALUES ($1, $2) RETURNING id`,
    [`Cabinet exemple ${compteur}`, `cabinet-exemple-${compteur}`])
  await q(`INSERT INTO signalements_qr_domaines_autorises (cabinet_id, domaine, ajoute_par) VALUES ($1, $2, $3)`,
    [r.id, `cabinet${compteur}.exemple.test`, SUPER_ADMIN])
  return r.id
}

type Resultat = { id: string; cree?: boolean; modifie: boolean }

/** Création (bureau NULL) ou renommage, sous service_role (la clé service des routes). */
const enregistrer = (cab: string | null, bureau: string | null, nom: string | null, acteur: string | null = SUPER_ADMIN) =>
  sous<{ r: Resultat }>('service_role', 'SELECT signalements_qr_enregistrer_bureau($1, $2, $3, $4) AS r', [cab, bureau, nom, acteur])
const fermer = (bureau: string | null, f: boolean | null, acteur: string | null = SUPER_ADMIN) =>
  sous<{ r: Resultat }>('service_role', 'SELECT signalements_qr_fermer_bureau($1, $2, $3) AS r', [bureau, f, acteur])

async function bureau(cab: string, nom: string): Promise<string> {
  const r = await enregistrer(cab, null, nom)
  if (r.erreur) throw new Error(`bureau non créé : ${r.erreur.message}`)
  return r.lignes[0].r.id
}

const domaineDe = async (cab: string) => (await q<{ domaine: string }>('SELECT domaine FROM signalements_qr_domaines_autorises WHERE cabinet_id = $1', [cab]))[0].domaine

/** Fiche écrite directement (service_role), comme une écriture hors des routes : les triggers jugent. */
async function ficheDirecte(cab: string, bureauId: string | null = null, actif = true): Promise<Appel<{ id: string }>> {
  compteur += 1
  return sous<{ id: string }>('service_role',
    `INSERT INTO signalements_qr_gestionnaires (id, cabinet_id, bureau_id, nom, email, actif, cree_par)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6) RETURNING id`,
    [cab, bureauId, `Prénom Nom ${compteur}`, `fiche${compteur}@${await domaineDe(cab)}`, actif, SUPER_ADMIN])
}

/** Création d'une fiche par la fonction de la route (POST /gestionnaires). */
async function inviter(cab: string, bureauId?: string | null): Promise<Appel<{ r: string }>> {
  compteur += 1
  const id = randomUUID()
  const email = `invite${compteur}@${await domaineDe(cab)}`
  const g: Record<string, unknown> = { id, cabinetId: cab, nom: `Prénom Nom ${compteur}`, email, domaineForce: false }
  if (bureauId !== undefined) g.bureauId = bureauId
  return sous<{ r: string }>('service_role', 'SELECT signalements_qr_inviter_gestionnaire($1, $2, $3, $4) AS r', [
    g, { id: randomUUID(), invite_token: randomBytes(24).toString('hex'), email }, [], SUPER_ADMIN,
  ])
}

async function copro(cab: string | null, bureauId: string | null = null, actif = true): Promise<Appel<{ id: string }>> {
  compteur += 1
  return sous<{ id: string }>('service_role',
    `INSERT INTO signalements_qr_coproprietes (nom, jeton, cabinet_id, bureau_id, actif)
     VALUES ($1, replace(gen_random_uuid()::text, '-', ''), $2, $3, $4) RETURNING id`,
    [`Résidence exemple ${compteur}`, cab, bureauId, actif])
}

const bureauDe = async (table: 'signalements_qr_gestionnaires' | 'signalements_qr_coproprietes', id: string) =>
  (await q<{ bureau_id: string | null }>(`SELECT bureau_id FROM ${table} WHERE id = $1`, [id]))[0]?.bureau_id ?? null

interface LigneJournal { action: string; champs: string[]; details: Record<string, unknown>; acteur_id: string; acteur_profil: string; cabinet_id: string }
const journalDe = (cab: string) => q<LigneJournal>(
  `SELECT action, champs, details, acteur_id, acteur_profil, cabinet_id FROM signalements_qr_journal
    WHERE cabinet_id = $1 AND 'bureaux' = ANY (champs) ORDER BY id`, [cab])

describe('table des bureaux : création, renommage, nom unique', () => {
  it('création : bureau ouvert, nom rogné, auteur = l’acteur ; journal cabinet.modifie {bureaux} { bureau: cree, bureauId }', async () => {
    const cab = await cabinet()
    const r = await enregistrer(cab, null, '  Nord  ')
    expect(r.erreur).toBeNull()
    const id = r.lignes[0].r.id
    expect(r.lignes[0].r).toEqual({ id, cree: true, modifie: true })
    expect(await q('SELECT cabinet_id, nom, ferme_le, cree_par FROM signalements_qr_bureaux WHERE id = $1', [id]))
      .toEqual([{ cabinet_id: cab, nom: 'Nord', ferme_le: null, cree_par: SUPER_ADMIN }])
    expect(await journalDe(cab)).toEqual([{
      action: 'cabinet.modifie', champs: ['bureaux'], details: { bureau: 'cree', bureauId: id },
      acteur_id: SUPER_ADMIN, acteur_profil: 'super_admin', cabinet_id: cab,
    }])
  })

  it('nom déjà pris dans le cabinet, à la casse et aux espaces près, bureau fermé compris : nom_pris ; un autre cabinet peut le porter', async () => {
    const cab = await cabinet()
    const nord = await bureau(cab, 'Nord')
    expect((await enregistrer(cab, null, ' NORD ')).erreur).toMatchObject({ code: 'P0001', message: 'nom_pris' })
    await fermer(nord, true)
    expect((await enregistrer(cab, null, 'nord')).erreur).toMatchObject({ code: 'P0001', message: 'nom_pris' })
    const sud = await bureau(cab, 'Sud')
    expect((await enregistrer(cab, sud, 'Nord')).erreur).toMatchObject({ code: 'P0001', message: 'nom_pris' })
    expect((await enregistrer(await cabinet(), null, 'Nord')).erreur).toBeNull()
  })

  it('index unique : une écriture directe d’un nom pris (hors de la fonction) est refusée par la base (23505)', async () => {
    const cab = await cabinet()
    await bureau(cab, 'Nord')
    const r = await sous('service_role', 'INSERT INTO signalements_qr_bureaux (cabinet_id, nom, cree_par) VALUES ($1, $2, $3)', [cab, 'nOrD', SUPER_ADMIN])
    expect(r.erreur?.code).toBe('23505')
    expect(r.erreur?.message).toContain('uq_signalements_qr_bureaux_nom')
  })

  it('renommage : journalisé { bureau: renomme } ; même nom : rien d’écrit ; casse seule changée : permise', async () => {
    const cab = await cabinet()
    const id = await bureau(cab, 'Nord')
    expect((await enregistrer(cab, id, 'Nord')).lignes[0].r).toEqual({ id, cree: false, modifie: false })
    expect((await enregistrer(cab, id, 'NORD')).lignes[0].r).toEqual({ id, cree: false, modifie: true })
    expect((await enregistrer(cab, id, 'Nord-Est')).lignes[0].r).toEqual({ id, cree: false, modifie: true })
    expect((await q<{ nom: string }>('SELECT nom FROM signalements_qr_bureaux WHERE id = $1', [id]))[0].nom).toBe('Nord-Est')
    expect((await journalDe(cab)).map((j) => j.details)).toEqual([
      { bureau: 'cree', bureauId: id }, { bureau: 'renomme', bureauId: id }, { bureau: 'renomme', bureauId: id },
    ])
  })

  it('le journal ne contient jamais le nom du bureau', async () => {
    const cab = await cabinet()
    const id = await bureau(cab, 'Bureau Témoin Unique')
    await enregistrer(cab, id, 'Bureau Témoin Renommé')
    await fermer(id, true)
    await fermer(id, false)
    const texte = JSON.stringify(await q('SELECT * FROM signalements_qr_journal WHERE cabinet_id = $1', [cab]))
    expect(texte).not.toContain('Témoin')
    expect((await journalDe(cab)).map((j) => j.details.bureau)).toEqual(['cree', 'renomme', 'ferme', 'rouvert'])
  })

  it('cabinet inconnu, ou bureau d’un autre cabinet : a_reverifier ; nom vide, trop long, avec un caractère de contrôle, acteur absent : 22023', async () => {
    expect((await enregistrer(randomUUID(), null, 'Nord')).erreur).toMatchObject({ code: 'P0001', message: 'a_reverifier' })
    const cab = await cabinet()
    const autre = await bureau(await cabinet(), 'Sud')
    expect((await enregistrer(cab, autre, 'Ouest')).erreur).toMatchObject({ code: 'P0001', message: 'a_reverifier' })
    for (const nom of ['', '   ', 'x'.repeat(81), 'Nord\nSud', null]) {
      expect((await enregistrer(cab, null, nom)).erreur?.code, String(nom)).toBe('22023')
    }
    expect((await enregistrer(cab, null, 'Nord', null)).erreur?.code).toBe('22023')
    expect((await enregistrer(null, null, 'Nord')).erreur?.code).toBe('22023')
    expect(await q('SELECT 1 FROM signalements_qr_bureaux WHERE cabinet_id = $1', [cab])).toEqual([])
  })

  it('80 caractères : accepté ; contrainte de la table : nom rogné, 1 à 80 caractères, sans contrôle (23514 en écriture directe)', async () => {
    const cab = await cabinet()
    expect((await enregistrer(cab, null, 'x'.repeat(80))).erreur).toBeNull()
    for (const nom of [' Nord', 'Nord ', '', 'x'.repeat(81), 'Nord\tSud']) {
      const r = await sous('service_role', 'INSERT INTO signalements_qr_bureaux (cabinet_id, nom, cree_par) VALUES ($1, $2, $3)', [cab, nom, SUPER_ADMIN])
      expect(r.erreur?.code, JSON.stringify(nom)).toBe('23514')
    }
  })

  it('plafond : 100 bureaux par cabinet (fermés compris), le 101e est refusé (plafond_bureaux) ; un renommage passe', async () => {
    const cab = await cabinet()
    await q(`INSERT INTO signalements_qr_bureaux (cabinet_id, nom, cree_par) SELECT $1, 'Bureau ' || n, $2 FROM generate_series(1, 100) AS n`, [cab, SUPER_ADMIN])
    expect((await enregistrer(cab, null, 'Bureau 101')).erreur).toMatchObject({ code: 'P0001', message: 'plafond_bureaux' })
    const [premier] = await q<{ id: string }>(`SELECT id FROM signalements_qr_bureaux WHERE cabinet_id = $1 AND nom = 'Bureau 1'`, [cab])
    expect((await enregistrer(cab, premier.id, 'Bureau premier')).erreur).toBeNull()
  })

  it('un cabinet qui a des bureaux ne se supprime pas (ON DELETE RESTRICT : 23001)', async () => {
    const cab = await cabinet()
    await bureau(cab, 'Nord')
    expect((await sous('service_role', 'DELETE FROM signalements_qr_cabinets WHERE id = $1', [cab])).erreur?.code).toBe('23001')
  })
})

describe('bureau d’une fiche gestionnaire', () => {
  it('cabinet sans bureau : nouvelle fiche sans bureau acceptée (rien ne change tant qu’aucun bureau n’existe)', async () => {
    const cab = await cabinet()
    expect((await ficheDirecte(cab)).erreur).toBeNull()
    expect((await inviter(cab)).erreur).toBeNull()
  })

  it('cabinet qui a un bureau OUVERT : nouvelle fiche sans bureau refusée (bureau_requis), par la fonction comme en écriture directe', async () => {
    const cab = await cabinet()
    await bureau(cab, 'Nord')
    expect((await inviter(cab)).erreur).toMatchObject({ code: 'P0001', message: 'bureau_requis' })
    expect((await inviter(cab, null)).erreur).toMatchObject({ code: 'P0001', message: 'bureau_requis' })
    expect((await ficheDirecte(cab)).erreur).toMatchObject({ code: 'P0001', message: 'bureau_requis' })
    expect(await q('SELECT 1 FROM signalements_qr_gestionnaires WHERE cabinet_id = $1', [cab])).toEqual([])
  })

  it('cabinet dont tous les bureaux sont fermés : nouvelle fiche sans bureau acceptée', async () => {
    const cab = await cabinet()
    const nord = await bureau(cab, 'Nord')
    await fermer(nord, true)
    expect((await inviter(cab)).erreur).toBeNull()
  })

  it('la fonction de création insère le bureau choisi (bureauId), journal inchangé (gestionnaire.cree)', async () => {
    const cab = await cabinet()
    const nord = await bureau(cab, 'Nord')
    const r = await inviter(cab, nord)
    expect(r.erreur).toBeNull()
    const id = r.lignes[0].r
    expect(await bureauDe('signalements_qr_gestionnaires', id)).toBe(nord)
    expect(await q('SELECT action FROM signalements_qr_journal WHERE gestionnaire_id = $1', [id])).toEqual([{ action: 'gestionnaire.cree' }])
  })

  it('bureau d’un autre cabinet ou inconnu : refusé par la clé étrangère composée (23503), par la fonction comme en écriture directe', async () => {
    const cab = await cabinet()
    const ailleurs = await bureau(await cabinet(), 'Nord')
    expect((await inviter(cab, ailleurs)).erreur?.code).toBe('23503')
    expect((await inviter(cab, randomUUID())).erreur?.code).toBe('23503')
    expect((await ficheDirecte(cab, ailleurs)).erreur?.code).toBe('23503')
  })

  it('bureau fermé : refusé pour une nouvelle fiche et pour un changement (bureau_ferme)', async () => {
    const cab = await cabinet()
    const nord = await bureau(cab, 'Nord')
    const sud = await bureau(cab, 'Sud')
    await fermer(sud, true)
    expect((await inviter(cab, sud)).erreur).toMatchObject({ code: 'P0001', message: 'bureau_ferme' })
    const fiche = (await inviter(cab, nord)).lignes[0].r
    const r = await sous('service_role', 'UPDATE signalements_qr_gestionnaires SET bureau_id = $2 WHERE id = $1', [fiche, sud])
    expect(r.erreur).toMatchObject({ code: 'P0001', message: 'bureau_ferme' })
    expect(await bureauDe('signalements_qr_gestionnaires', fiche)).toBe(nord)
  })

  it('fiche EXISTANTE sans bureau : jamais bloquée (autres champs modifiables), complétée au fil de l’eau', async () => {
    const cab = await cabinet()
    const fiche = (await ficheDirecte(cab)).lignes[0].id
    const nord = await bureau(cab, 'Nord')
    expect((await sous('service_role', `UPDATE signalements_qr_gestionnaires SET nom = 'Prénom Renommé', actif = false WHERE id = $1`, [fiche])).erreur).toBeNull()
    expect((await sous('service_role', 'UPDATE signalements_qr_gestionnaires SET actif = true WHERE id = $1', [fiche])).erreur).toBeNull()
    expect((await sous('service_role', 'UPDATE signalements_qr_gestionnaires SET bureau_id = NULL WHERE id = $1', [fiche])).erreur).toBeNull()
    expect((await sous('service_role', 'UPDATE signalements_qr_gestionnaires SET bureau_id = $2 WHERE id = $1', [fiche, nord])).erreur).toBeNull()
    expect(await bureauDe('signalements_qr_gestionnaires', fiche)).toBe(nord)
  })

  it('fiche qui a un bureau : il se change (même cabinet), il ne se retire pas (bureau_requis)', async () => {
    const cab = await cabinet()
    const nord = await bureau(cab, 'Nord')
    const sud = await bureau(cab, 'Sud')
    const fiche = (await inviter(cab, nord)).lignes[0].r
    expect((await sous('service_role', 'UPDATE signalements_qr_gestionnaires SET bureau_id = $2 WHERE id = $1', [fiche, sud])).erreur).toBeNull()
    expect((await sous('service_role', 'UPDATE signalements_qr_gestionnaires SET bureau_id = NULL WHERE id = $1', [fiche])).erreur)
      .toMatchObject({ code: 'P0001', message: 'bureau_requis' })
    expect(await bureauDe('signalements_qr_gestionnaires', fiche)).toBe(sud)
  })

  it('rattachée à un bureau fermé depuis : la fiche le garde, et reste modifiable (désactivée, réactivée, renommée)', async () => {
    const cab = await cabinet()
    const nord = await bureau(cab, 'Nord')
    const fiche = (await inviter(cab, nord)).lignes[0].r
    await q('UPDATE signalements_qr_gestionnaires SET actif = false WHERE id = $1', [fiche])
    expect((await fermer(nord, true)).erreur).toBeNull()
    expect((await sous('service_role', `UPDATE signalements_qr_gestionnaires SET actif = true, nom = 'Prénom Autre' WHERE id = $1`, [fiche])).erreur).toBeNull()
    expect(await bureauDe('signalements_qr_gestionnaires', fiche)).toBe(nord)
  })
})

describe('bureau d’une copropriété', () => {
  it('facultatif : copropriété d’un cabinet qui a des bureaux, sans bureau, acceptée ; le bureau se pose, se change, se retire', async () => {
    const cab = await cabinet()
    const nord = await bureau(cab, 'Nord')
    const sud = await bureau(cab, 'Sud')
    const c = (await copro(cab)).lignes[0].id
    for (const valeur of [nord, sud, null]) {
      expect((await sous('service_role', 'UPDATE signalements_qr_coproprietes SET bureau_id = $2 WHERE id = $1', [c, valeur])).erreur).toBeNull()
      expect(await bureauDe('signalements_qr_coproprietes', c)).toBe(valeur)
    }
  })

  it('bureau d’un autre cabinet : 23503 ; copropriété sans cabinet : jamais de bureau (23514)', async () => {
    const cab = await cabinet()
    const ailleurs = await bureau(await cabinet(), 'Nord')
    expect((await copro(cab, ailleurs)).erreur?.code).toBe('23503')
    expect((await copro(null, ailleurs)).erreur?.code).toBe('23514')
    const sans = (await copro(null)).lignes[0].id
    expect((await sous('service_role', 'UPDATE signalements_qr_coproprietes SET bureau_id = $2 WHERE id = $1', [sans, ailleurs])).erreur?.code).toBe('23514')
  })

  it('bureau fermé : refusé pour un nouveau rattachement (bureau_ferme) ; déjà rattachée, la copropriété le garde et reste modifiable', async () => {
    const cab = await cabinet()
    const nord = await bureau(cab, 'Nord')
    const c = (await copro(cab, nord, false)).lignes[0].id
    expect((await fermer(nord, true)).erreur).toBeNull()
    expect((await copro(cab, nord)).erreur).toMatchObject({ code: 'P0001', message: 'bureau_ferme' })
    const autre = (await copro(cab)).lignes[0].id
    expect((await sous('service_role', 'UPDATE signalements_qr_coproprietes SET bureau_id = $2 WHERE id = $1', [autre, nord])).erreur)
      .toMatchObject({ code: 'P0001', message: 'bureau_ferme' })
    expect((await sous('service_role', `UPDATE signalements_qr_coproprietes SET nom = 'Résidence renommée', actif = true, bureau_id = $2 WHERE id = $1`, [c, nord])).erreur).toBeNull()
    expect(await bureauDe('signalements_qr_coproprietes', c)).toBe(nord)
  })

  it('changer de bureau ne change pas le cabinet ; le rattachement définitif au cabinet reste (cabinet_fige)', async () => {
    const cab = await cabinet()
    const nord = await bureau(cab, 'Nord')
    const c = (await copro(cab, nord)).lignes[0].id
    expect((await sous('service_role', 'UPDATE signalements_qr_coproprietes SET cabinet_id = $2 WHERE id = $1', [c, await cabinet()])).erreur)
      .toMatchObject({ code: 'P0001', message: 'cabinet_fige' })
  })
})

describe('fermeture et réouverture d’un bureau', () => {
  it('fermer : date posée, journal { bureau: ferme } ; déjà fermé : rien ; rouvrir : date effacée, journal { bureau: rouvert }', async () => {
    const cab = await cabinet()
    const id = await bureau(cab, 'Nord')
    expect((await fermer(id, true)).lignes[0].r).toEqual({ id, modifie: true })
    expect((await q<{ ferme_le: Date | null }>('SELECT ferme_le FROM signalements_qr_bureaux WHERE id = $1', [id]))[0].ferme_le).not.toBeNull()
    expect((await fermer(id, true)).lignes[0].r).toEqual({ id, modifie: false })
    expect((await fermer(id, false)).lignes[0].r).toEqual({ id, modifie: true })
    expect((await fermer(id, false)).lignes[0].r).toEqual({ id, modifie: false })
    expect((await q<{ ferme_le: Date | null }>('SELECT ferme_le FROM signalements_qr_bureaux WHERE id = $1', [id]))[0].ferme_le).toBeNull()
    expect((await journalDe(cab)).map((j) => [j.action, j.champs, j.details])).toEqual([
      ['cabinet.modifie', ['bureaux'], { bureau: 'cree', bureauId: id }],
      ['cabinet.modifie', ['bureaux'], { bureau: 'ferme', bureauId: id }],
      ['cabinet.modifie', ['bureaux'], { bureau: 'rouvert', bureauId: id }],
    ])
  })

  it('bureau encore utilisé (gestionnaire actif ou copropriété active) : bureau_utilise ; rattachements inactifs seulement : fermé', async () => {
    const cab = await cabinet()
    const nord = await bureau(cab, 'Nord')
    const fiche = (await inviter(cab, nord)).lignes[0].r
    expect((await fermer(nord, true)).erreur).toMatchObject({ code: 'P0001', message: 'bureau_utilise' })
    await q('UPDATE signalements_qr_gestionnaires SET actif = false WHERE id = $1', [fiche])
    const c = (await copro(cab, nord)).lignes[0].id
    expect((await fermer(nord, true)).erreur).toMatchObject({ code: 'P0001', message: 'bureau_utilise' })
    await q('UPDATE signalements_qr_coproprietes SET actif = false WHERE id = $1', [c])
    expect((await fermer(nord, true)).erreur).toBeNull()
    expect(await bureauDe('signalements_qr_gestionnaires', fiche)).toBe(nord)
    expect(await bureauDe('signalements_qr_coproprietes', c)).toBe(nord)
  })

  it('bureau inconnu : a_reverifier ; paramètre absent : 22023', async () => {
    expect((await fermer(randomUUID(), true)).erreur).toMatchObject({ code: 'P0001', message: 'a_reverifier' })
    const id = await bureau(await cabinet(), 'Nord')
    expect((await fermer(null, true)).erreur?.code).toBe('22023')
    expect((await fermer(id, null)).erreur?.code).toBe('22023')
    expect((await fermer(id, true, null)).erreur?.code).toBe('22023')
  })
})

describe('droits : anon et authenticated n’ont rien, service_role seul exécute', () => {
  const SIGNATURES = [
    'signalements_qr_enregistrer_bureau(uuid, uuid, text, uuid)',
    'signalements_qr_fermer_bureau(uuid, boolean, uuid)',
    'signalements_qr_inviter_gestionnaire(jsonb, jsonb, uuid[], uuid)',
  ]
  const TRIGGERS = ['signalements_qr_bureau_du_gestionnaire()', 'signalements_qr_bureau_de_la_copropriete()']

  it.each(['anon', 'authenticated'] as const)('%s : ni lecture ni écriture de la table des bureaux ni du bureau d’une fiche, aucune fonction', async (role) => {
    const cab = await cabinet()
    const id = await bureau(cab, 'Nord')
    expect((await sous(role, 'SELECT id FROM signalements_qr_bureaux')).erreur?.code).toBe('42501')
    expect((await sous(role, 'UPDATE signalements_qr_bureaux SET ferme_le = now()')).erreur?.code).toBe('42501')
    expect((await sous(role, 'INSERT INTO signalements_qr_bureaux (cabinet_id, nom, cree_par) VALUES ($1, $2, $3)', [cab, 'Sud', SUPER_ADMIN])).erreur?.code).toBe('42501')
    expect((await sous(role, 'SELECT bureau_id FROM signalements_qr_gestionnaires')).erreur?.code).toBe('42501')
    expect((await sous(role, 'SELECT signalements_qr_fermer_bureau($1, true, $2)', [id, SUPER_ADMIN])).erreur?.code).toBe('42501')
    expect((await sous(role, 'SELECT signalements_qr_enregistrer_bureau($1, NULL, $2, $3)', [cab, 'Sud', SUPER_ADMIN])).erreur?.code).toBe('42501')
    for (const s of [...SIGNATURES, ...TRIGGERS]) {
      expect((await q<{ x: boolean }>(`SELECT has_function_privilege($1, '${s}', 'EXECUTE') AS x`, [role]))[0].x, s).toBe(false)
    }
  })

  it('copropriété : droits d’aujourd’hui gardés (RLS sans politique) : anon ne lit aucune ligne, pas même son bureau', async () => {
    const cab = await cabinet()
    await copro(cab, await bureau(cab, 'Nord'))
    const r = await sous('anon', 'SELECT bureau_id FROM signalements_qr_coproprietes')
    expect(r.erreur).toBeNull()
    expect(r.lignes).toEqual([])
  })

  it('service_role exécute les trois fonctions des routes ; RLS active sans aucune politique sur la table des bureaux', async () => {
    for (const s of SIGNATURES) {
      expect((await q<{ x: boolean }>(`SELECT has_function_privilege('service_role', '${s}', 'EXECUTE') AS x`))[0].x, s).toBe(true)
    }
    const [r] = await q<{ politiques: number; rls: boolean }>(
      `SELECT (SELECT count(*)::int FROM pg_policy WHERE polrelid = 'signalements_qr_bureaux'::regclass) AS politiques,
              (SELECT relrowsecurity FROM pg_class WHERE oid = 'signalements_qr_bureaux'::regclass) AS rls`)
    expect(r).toEqual({ politiques: 0, rls: true })
  })

  it('fonctions SECURITY INVOKER, search_path figé (public, pg_temp)', async () => {
    for (const s of [...SIGNATURES, ...TRIGGERS]) {
      const [r] = await q<{ definer: boolean; config: string[] }>(
        `SELECT prosecdef AS definer, proconfig AS config FROM pg_proc WHERE oid = '${s}'::regprocedure`)
      expect(r, s).toEqual({ definer: false, config: ['search_path=public, pg_temp'] })
    }
  })

  it('journal : liste fermée des actions inchangée (41 actions, aucune « bureau.* »)', async () => {
    const [r] = await q<{ def: string }>(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'signalements_qr_journal_action_valeurs'`)
    const actions = [...r.def.matchAll(/'([^']+)'/g)].map((m) => m[1])
    expect(actions).toHaveLength(41)
    expect(actions.some((a) => a.startsWith('bureau.'))).toBe(false)
  })
})

describe('retour arrière (supabase/retours-arriere/20261119_signalements_qr_bureaux.retour.sql)', () => {
  it('s’exécute sur une base qui a des bureaux et des rattachements, rend le schéma d’avant, garde le journal, se rejoue ; la migration repasse ensuite', async () => {
    const retour = lireRetour()
    expect(retour.length).toBeGreaterThan(0)
    const avant = await creerBaseSignalementsQr({ migrations: AVANT_BUREAUX })
    const base = await creerBaseSignalementsQr()
    try {
      const empreinteAvant = await empreinteSchemaQr(avant)
      // Des bureaux et des rattachements, comme en production après usage.
      await base.exec(`
        INSERT INTO signalements_qr_cabinets (id, nom, identifiant) VALUES ('11111111-1111-4111-8111-111111111111', 'Cabinet exemple', 'cabinet-exemple');
        INSERT INTO signalements_qr_domaines_autorises (cabinet_id, domaine, ajoute_par)
          VALUES ('11111111-1111-4111-8111-111111111111', 'exemple.test', '22222222-2222-4222-8222-222222222222');`)
      const { rows: [b] } = await base.query<{ r: { id: string } }>(
        `SELECT signalements_qr_enregistrer_bureau('11111111-1111-4111-8111-111111111111', NULL, 'Nord', '22222222-2222-4222-8222-222222222222') AS r`)
      await base.query(`INSERT INTO signalements_qr_gestionnaires (id, cabinet_id, bureau_id, nom, email, cree_par)
        VALUES (gen_random_uuid(), '11111111-1111-4111-8111-111111111111', $1, 'Prénom Nom', 'fiche@exemple.test', '22222222-2222-4222-8222-222222222222')`, [b.r.id])
      await base.query(`INSERT INTO signalements_qr_coproprietes (nom, jeton, cabinet_id, bureau_id)
        VALUES ('Résidence exemple', replace(gen_random_uuid()::text, '-', ''), '11111111-1111-4111-8111-111111111111', $1)`, [b.r.id])
      const journalAvant = (await base.query<{ n: number }>('SELECT count(*)::int AS n FROM signalements_qr_journal')).rows[0].n

      await base.exec(retour)
      const apres = await empreinteSchemaQr(base)
      // Seule différence attendue : le nombre de copropriétés (une ajoutée ci-dessus, gardée par le retour).
      const LIGNES = 'données signalements_qr_coproprietes (lignes)'
      expect(Number(apres.get(LIGNES))).toBe(Number(empreinteAvant.get(LIGNES)) + 1)
      apres.set(LIGNES, empreinteAvant.get(LIGNES) ?? '')
      expect(Object.fromEntries(apres)).toEqual(Object.fromEntries(empreinteAvant))
      expect((await base.query<{ n: number }>('SELECT count(*)::int AS n FROM signalements_qr_journal')).rows[0].n).toBe(journalAvant)
      expect((await base.query<{ n: number }>('SELECT count(*)::int AS n FROM signalements_qr_gestionnaires')).rows[0].n).toBe(1)

      // Rejouable, puis la migration repasse (et redonne le schéma avec bureaux).
      await base.exec(retour)
      await base.exec(readFileSync(join(process.cwd(), 'supabase/migrations', BUREAUX), 'utf-8').replace(/\r\n/g, '\n'))
      const { rows } = await base.query<{ n: number }>(`SELECT count(*)::int AS n FROM information_schema.columns
        WHERE table_name IN ('signalements_qr_gestionnaires', 'signalements_qr_coproprietes') AND column_name = 'bureau_id'`)
      expect(rows[0].n).toBe(2)
    } finally {
      await avant.close()
      await base.close()
    }
  }, 180_000)
})
