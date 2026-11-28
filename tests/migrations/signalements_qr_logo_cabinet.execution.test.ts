// @vitest-environment node
// tests/migrations/signalements_qr_logo_cabinet.execution.test.ts
//
// EXÉCUTION RÉELLE de la migration 20261114_signalements_qr_logo_cabinet.sql (logo d'un cabinet client, demande de Hugo
// du 13/11/2026) sur un vrai PostgreSQL (PGlite, WebAssembly, en mémoire ; aucun service, aucune base distante) :
//   - ordres d'application possibles en production, chacun joué DEUX fois (rejouabilité, même schéma après chaque
//     passe) : 20261104 → 20261112 puis 20261114 (sans la 20261113, fusionnée mais pas encore appliquée) ; 20261113 puis
//     20261114 ; 20261114 puis 20261113 (la 20261113 remplace la liste fermée du journal : elle doit passer après) ;
//   - contrainte de l'image (PNG seulement, revérifié par la base), fonction d'envoi et de retrait (journal cabinet.modifie,
//     champs {logo}), droits : anon et authenticated n'ont rien, service_role seul exécute.
// Images SYNTHÉTIQUES (tests/helpers/png-synthetique.ts) ; aucune donnée réelle : cabinets en exemple.

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { createHash, randomUUID } from 'crypto'
import { deflateSync } from 'zlib'
import { analyserPngQr } from '@/lib/aj-signalement/logo'
import { creerBaseSignalementsQr, empreinteSchemaQr, erreurPg, type ErreurPg } from '../helpers/pglite-signalements'
import { avecOctet, ihdrPng, lignesBrutes, morceauPng, pngDeMorceaux, pngSynthetique } from '../helpers/png-synthetique'

const AVANT_1113 = [
  '20261104_signalements_qr.sql',
  '20261106_signalements_qr_confirmation.sql',
  '20261106_signalements_qr_geoloc_qualite.sql',
  '20261111_signalements_qr_gestionnaires.sql',
  '20261112_signalements_qr_acces_gestionnaires.sql',
]
const LOGO = '20261114_signalements_qr_logo_cabinet.sql'
const DIFFUSION = '20261113_signalements_qr_diffusion.sql'
const COLONNES_LOGO = ['logo_png', 'logo_largeur', 'logo_hauteur', 'logo_version', 'logo_maj_le']
const SIGNATURE = 'signalements_qr_regler_logo_cabinet(uuid, bytea, integer, integer, uuid)'
const ACTIONS_DIFFUSION = [
  'cabinet.diffusion_activee', 'cabinet.diffusion_suspendue',
  'diffusion.envoyee', 'diffusion.reprise', 'diffusion.opposition', 'diffusion.opposition_levee', 'diffusion.purge',
]

/** Actions de la liste fermée du journal en place. */
async function actionsJournal(db: PGlite): Promise<string[]> {
  const { rows } = await db.query<{ def: string }>(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'signalements_qr_journal_action_valeurs'`)
  return [...(rows[0]?.def ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1])
}

async function colonnesLogo(db: PGlite): Promise<string[]> {
  const { rows } = await db.query<{ attname: string }>(
    `SELECT attname FROM pg_attribute WHERE attrelid = 'signalements_qr_cabinets'::regclass AND attname LIKE 'logo_%' AND NOT attisdropped ORDER BY attnum`)
  return rows.map((r) => r.attname)
}

describe('ordres d’application, chacun joué deux fois', () => {
  const ORDRES: Array<{ nom: string; migrations: string[]; diffusion: boolean }> = [
    { nom: '20261104 → 20261112 puis 20261114 (sans la 20261113)', migrations: [...AVANT_1113, LOGO], diffusion: false },
    { nom: '20261104 → 20261113 puis 20261114', migrations: [...AVANT_1113, DIFFUSION, LOGO], diffusion: true },
    { nom: '20261104 → 20261112, 20261114 puis 20261113', migrations: [...AVANT_1113, LOGO, DIFFUSION], diffusion: true },
  ]

  it.each(ORDRES)('$nom : aucune erreur, même schéma après chaque passe, colonnes et liste du journal attendues', async ({ migrations, diffusion }) => {
    let premiere = new Map<string, string>()
    const db = await creerBaseSignalementsQr({ passes: 2, migrations, apresPremierePasse: async (base) => { premiere = await empreinteSchemaQr(base) } })
    try {
      const seconde = await empreinteSchemaQr(db)
      expect(premiere.size).toBeGreaterThan(0)
      expect(Object.fromEntries(seconde)).toEqual(Object.fromEntries(premiere))
      expect(await colonnesLogo(db)).toEqual(COLONNES_LOGO)
      expect(premiere.get('contrainte signalements_qr_cabinets.signalements_qr_cabinets_logo_png_valide')).not.toContain('NON VALIDÉE')
      const actions = await actionsJournal(db)
      // La 20261114 ne touche pas la liste fermée : 34 actions sans la diffusion, 41 avec, quel que soit l'ordre.
      expect(actions).toContain('cabinet.modifie')
      expect(ACTIONS_DIFFUSION.every((a) => actions.includes(a))).toBe(diffusion)
      expect(actions).toHaveLength(diffusion ? 41 : 34)
    } finally {
      await db.close()
    }
  }, 120_000)
})

// ── Règles, sur la chaîne complète (20261113 puis 20261114) ─────────────────────────────────────────────────────────

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
  return r.id
}

const empreinte16 = (octets: Uint8Array) => createHash('sha256').update(octets).digest('hex').slice(0, 16)

/** Appel de la fonction sous service_role (la clé service des routes). */
const regler = (cab: string | null, png: Uint8Array | null, largeur: number | null, hauteur: number | null, acteur: string | null = SUPER_ADMIN) =>
  sous<{ r: { version: string | null; modifie: boolean } }>(
    'service_role', `SELECT ${'signalements_qr_regler_logo_cabinet'}($1, $2, $3, $4, $5) AS r`, [cab, png, largeur, hauteur, acteur])

interface LigneLogo { logo_png: Uint8Array | null; logo_largeur: number | null; logo_hauteur: number | null; logo_version: string | null; logo_maj_le: Date | null }
const logoDe = async (cab: string) => (await q<LigneLogo>(
  'SELECT logo_png, logo_largeur, logo_hauteur, logo_version, logo_maj_le FROM signalements_qr_cabinets WHERE id = $1', [cab]))[0]

interface LigneJournal { action: string; champs: string[]; details: Record<string, unknown>; acteur_id: string; acteur_profil: string }
const journalDe = (cab: string) => q<LigneJournal>(
  'SELECT action, champs, details, acteur_id, acteur_profil FROM signalements_qr_journal WHERE cabinet_id = $1 ORDER BY id', [cab])

describe('envoi, remplacement et retrait du logo (service_role)', () => {
  it('envoi : image et dimensions enregistrées, version = 16 premiers caractères du SHA-256, journal cabinet.modifie {logo}', async () => {
    const cab = await cabinet()
    const png = pngSynthetique(320, 120)
    const r = await regler(cab, png, 320, 120)
    expect(r.erreur).toBeNull()
    expect(r.lignes[0].r).toEqual({ version: empreinte16(png), modifie: true })
    const ligne = await logoDe(cab)
    expect(Buffer.from(ligne.logo_png ?? []).equals(Buffer.from(png))).toBe(true)
    expect([ligne.logo_largeur, ligne.logo_hauteur, ligne.logo_version]).toEqual([320, 120, empreinte16(png)])
    expect(ligne.logo_maj_le).not.toBeNull()
    expect(await journalDe(cab)).toEqual([{
      action: 'cabinet.modifie', champs: ['logo'], acteur_id: SUPER_ADMIN, acteur_profil: 'super_admin',
      details: { logo: 'envoye', largeur: 320, hauteur: 120, octets: png.length },
    }])
  })

  it('même image renvoyée : rien n’est écrit ni journalisé ; autre image : remplacée, journalisée', async () => {
    const cab = await cabinet()
    const png = pngSynthetique(100, 50)
    await regler(cab, png, 100, 50)
    const avant = await logoDe(cab)
    const encore = await regler(cab, png, 100, 50)
    expect(encore.lignes[0].r).toEqual({ version: empreinte16(png), modifie: false })
    expect((await logoDe(cab)).logo_maj_le).toEqual(avant.logo_maj_le)
    expect(await journalDe(cab)).toHaveLength(1)
    const autre = pngSynthetique(800, 400, { couleur: [10, 20, 30, 255] })
    const r = await regler(cab, autre, 800, 400)
    expect(r.lignes[0].r).toEqual({ version: empreinte16(autre), modifie: true })
    expect((await logoDe(cab)).logo_version).toBe(empreinte16(autre))
    expect((await journalDe(cab)).map((j) => j.details.logo)).toEqual(['envoye', 'envoye'])
  })

  it('retrait : toutes les colonnes du logo vidées, journal { logo: retire } ; second retrait : rien', async () => {
    const cab = await cabinet()
    await regler(cab, pngSynthetique(64, 64), 64, 64)
    const r = await regler(cab, null, null, null)
    expect(r.erreur).toBeNull()
    expect(r.lignes[0].r).toEqual({ version: null, modifie: true })
    expect(await logoDe(cab)).toEqual({ logo_png: null, logo_largeur: null, logo_hauteur: null, logo_version: null, logo_maj_le: null })
    const second = await regler(cab, null, null, null)
    expect(second.lignes[0].r).toEqual({ version: null, modifie: false })
    expect((await journalDe(cab)).map((j) => [j.action, j.champs, j.details])).toEqual([
      ['cabinet.modifie', ['logo'], { logo: 'envoye', largeur: 64, hauteur: 64, octets: pngSynthetique(64, 64).length }],
      ['cabinet.modifie', ['logo'], { logo: 'retire' }],
    ])
  })

  it('cabinet inconnu : P0001 a_reverifier ; acteur absent, ou image sans dimensions : 22023 ; rien d’écrit', async () => {
    expect((await regler(randomUUID(), pngSynthetique(10, 10), 10, 10)).erreur).toMatchObject({ code: 'P0001', message: 'a_reverifier' })
    const cab = await cabinet()
    expect((await regler(cab, pngSynthetique(10, 10), 10, 10, null)).erreur?.code).toBe('22023')
    expect((await regler(cab, pngSynthetique(10, 10), null, null)).erreur?.code).toBe('22023')
    expect((await regler(cab, null, 10, 10)).erreur?.code).toBe('22023')
    expect((await regler(null, null, null, null)).erreur?.code).toBe('22023')
    expect((await logoDe(cab)).logo_png).toBeNull()
    expect(await journalDe(cab)).toEqual([])
  })

  it('le cabinet reste modifiable avec un logo (la contrainte est revérifiée à chaque écriture de la ligne)', async () => {
    const cab = await cabinet()
    await regler(cab, pngSynthetique(800, 400), 800, 400)
    const r = await sous('service_role', `SELECT signalements_qr_enregistrer_cabinet($1, 'Cabinet exemple renommé', NULL, 'pt', NULL, $2) AS r`, [cab, SUPER_ADMIN])
    expect(r.erreur).toBeNull()
    expect((await q<{ nom: string; langue: string; logo_largeur: number }>('SELECT nom, langue, logo_largeur FROM signalements_qr_cabinets WHERE id = $1', [cab]))[0])
      .toEqual({ nom: 'Cabinet exemple renommé', langue: 'pt', logo_largeur: 800 })
  })
})

describe('contrainte : seul un PNG conforme est stocké (23514 sinon, rien d’écrit)', () => {
  const png = pngSynthetique(40, 20)
  const CAS: Array<{ cas: string; image: Uint8Array; largeur: number; hauteur: number }> = [
    { cas: 'signature abîmée (un JPEG ou un SVG renommé)', image: avecOctet(png, 0, 0xff), largeur: 40, hauteur: 20 },
    { cas: 'SVG (texte)', image: new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"></svg>'), largeur: 40, hauteur: 20 },
    { cas: 'premier morceau qui n’est pas IHDR', image: avecOctet(png, 12, 0x58), largeur: 40, hauteur: 20 },
    { cas: 'largeur déclarée différente de l’en-tête', image: png, largeur: 41, hauteur: 20 },
    { cas: 'hauteur déclarée différente de l’en-tête', image: png, largeur: 40, hauteur: 21 },
    { cas: 'plus de 800 px de large', image: pngSynthetique(801, 10), largeur: 801, hauteur: 10 },
    { cas: 'plus de 400 px de haut', image: pngSynthetique(10, 401), largeur: 10, hauteur: 401 },
    { cas: 'tronqué (sans IEND)', image: pngSynthetique(40, 20, { sansFin: true }), largeur: 40, hauteur: 20 },
    { cas: 'octets après IEND (fichier polyglotte)', image: pngSynthetique(40, 20, { queue: new TextEncoder().encode('<script>') }), largeur: 40, hauteur: 20 },
    { cas: 'plus de 200 Kio', image: pngSynthetique(240, 240, { bruit: true }), largeur: 240, hauteur: 240 },
  ]

  it.each(CAS)('$cas', async ({ image, largeur, hauteur }) => {
    const cab = await cabinet()
    const r = await regler(cab, image, largeur, hauteur)
    expect(r.erreur?.code).toBe('23514')
    expect((await logoDe(cab)).logo_png).toBeNull()
    expect(await journalDe(cab)).toEqual([])
  })

  it('écriture directe incohérente (image sans version, version fausse, colonnes partielles) : 23514', async () => {
    const cab = await cabinet()
    const ecrire = (sql: string, params: unknown[]) => sous('service_role', sql, params)
    expect((await ecrire('UPDATE signalements_qr_cabinets SET logo_png = $2, logo_largeur = 40, logo_hauteur = 20, logo_maj_le = now() WHERE id = $1', [cab, png])).erreur?.code).toBe('23514')
    expect((await ecrire(`UPDATE signalements_qr_cabinets SET logo_png = $2, logo_largeur = 40, logo_hauteur = 20, logo_version = '0000000000000000', logo_maj_le = now() WHERE id = $1`, [cab, png])).erreur?.code).toBe('23514')
    expect((await ecrire('UPDATE signalements_qr_cabinets SET logo_largeur = 40 WHERE id = $1', [cab])).erreur?.code).toBe('23514')
    expect((await ecrire('UPDATE signalements_qr_cabinets SET logo_png = $2, logo_largeur = 40, logo_hauteur = 20, logo_version = $3 WHERE id = $1', [cab, png, empreinte16(png)])).erreur?.code).toBe('23514')
    // La même écriture, complète et juste, passe (la contrainte ne refuse que l'incohérent).
    expect((await ecrire('UPDATE signalements_qr_cabinets SET logo_png = $2, logo_largeur = 40, logo_hauteur = 20, logo_version = $3, logo_maj_le = now() WHERE id = $1', [cab, png, empreinte16(png)])).erreur).toBeNull()
  })
})

// Relecture de conformité du 13/11/2026 : la base acceptait des PNG que le serveur refuse (texte, animation, aucun IDAT) ;
// écrits hors de la route (fonction appelée directement, éditeur SQL), les pages annonçaient un logo dont l'image
// renvoyait 404. La contrainte parcourt désormais les morceaux (signalements_qr_png_forme_valide) : même FORME que
// analyserPngQr (lib/aj-signalement/logo.ts). Restent au serveur seul, que la base ne sait pas calculer : les CRC et le
// contenu zlib des IDAT (une telle image n'est jamais servie : la lecture la revérifie).
describe('contrainte : même forme que le serveur (parcours des morceaux)', () => {
  const flux = (l: number, h: number, octetsParPixel = 4) => deflateSync(lignesBrutes(l, h, octetsParPixel))
  const accessoire = (type: string, n: number) => ({ type, donnees: new Uint8Array(n) })
  const iccp = Buffer.concat([Buffer.from('profil\0\0', 'latin1'), deflateSync(Buffer.from('texte libre'))])
  const fin = () => morceauPng('IEND')

  const REFUSEES: Array<{ cas: string; image: Uint8Array<ArrayBuffer> }> = [
    { cas: 'texte (tEXt)', image: pngSynthetique(40, 20, { morceaux: [{ type: 'tEXt', donnees: new TextEncoder().encode('Author\0X') }] }) },
    { cas: 'animation (acTL)', image: pngSynthetique(40, 20, { morceaux: [accessoire('acTL', 8)] }) },
    { cas: 'aucun IDAT', image: pngDeMorceaux(ihdrPng(40, 20), fin()) },
    { cas: 'profil ICC (iCCP)', image: pngSynthetique(40, 20, { morceaux: [{ type: 'iCCP', donnees: iccp }] }) },
    { cas: 'palette (PLTE) en RVBA', image: pngSynthetique(40, 20, { morceaux: [accessoire('PLTE', 9)] }) },
    { cas: 'tRNS en RVBA', image: pngSynthetique(40, 20, { morceaux: [accessoire('tRNS', 6)] }) },
    { cas: 'accessoire de longueur fausse', image: pngSynthetique(40, 20, { morceaux: [accessoire('pHYs', 8)] }) },
    { cas: 'accessoire répété', image: pngSynthetique(40, 20, { morceaux: [accessoire('sRGB', 1), accessoire('sRGB', 1)] }) },
    { cas: 'accessoire après les IDAT', image: pngSynthetique(40, 20, { apresIdat: [accessoire('gAMA', 4)] }) },
    { cas: 'IDAT séparés par un accessoire', image: pngDeMorceaux(ihdrPng(40, 20), morceauPng('IDAT', flux(40, 20).subarray(0, 4)), morceauPng('sRGB', new Uint8Array(1)), morceauPng('IDAT', flux(40, 20).subarray(4)), fin()) },
    { cas: 'second IHDR', image: pngDeMorceaux(ihdrPng(40, 20), ihdrPng(40, 20), morceauPng('IDAT', flux(40, 20)), fin()) },
    { cas: '16 bits', image: pngDeMorceaux(ihdrPng(40, 20, 16, 6), morceauPng('IDAT', flux(40, 20, 8)), fin()) },
    { cas: 'entrelacé (Adam7)', image: pngDeMorceaux(ihdrPng(40, 20, 8, 6, 1), morceauPng('IDAT', flux(40, 20)), fin()) },
    { cas: 'niveaux de gris', image: pngDeMorceaux(ihdrPng(40, 20, 8, 0), morceauPng('IDAT', flux(40, 20, 1)), fin()) },
    { cas: 'palette (type 3) avec PLTE', image: pngDeMorceaux(ihdrPng(40, 20, 8, 3), morceauPng('PLTE', new Uint8Array(3)), morceauPng('IDAT', flux(40, 20, 1)), fin()) },
    { cas: 'type de morceau qui n’est pas en lettres', image: pngDeMorceaux(ihdrPng(40, 20), morceauPng('ID1T', new Uint8Array(2)), morceauPng('IDAT', flux(40, 20)), fin()) },
  ]

  it.each(REFUSEES)('$cas : refusée par la base (23514) comme par le serveur', async ({ image }) => {
    expect(analyserPngQr(image).ok).toBe(false)
    const cab = await cabinet()
    expect((await regler(cab, image, 40, 20)).erreur?.code).toBe('23514')
    expect((await logoDe(cab)).logo_png).toBeNull()
  })

  const ACCEPTEES: Array<{ cas: string; image: Uint8Array<ArrayBuffer> }> = [
    { cas: 'RVBA (canvas)', image: pngSynthetique(40, 20, { couleur: [29, 65, 100, 255] }) },
    { cas: 'RVB', image: pngSynthetique(40, 20, { typeCouleur: 2 }) },
    { cas: 'IDAT découpé en plusieurs morceaux', image: pngSynthetique(40, 20, { bruit: true, tailleIdat: 64 }) },
    { cas: 'accessoires de longueur fixe', image: pngSynthetique(40, 20, { morceaux: [accessoire('sRGB', 1), accessoire('gAMA', 4), accessoire('cHRM', 32), accessoire('sBIT', 4), accessoire('pHYs', 9), accessoire('bKGD', 6)] }) },
    { cas: 'tRNS en RVB', image: pngSynthetique(40, 20, { typeCouleur: 2, morceaux: [accessoire('tRNS', 6), accessoire('sBIT', 3)] }) },
  ]

  it.each(ACCEPTEES)('$cas : acceptée par la base comme par le serveur', async ({ image }) => {
    expect(analyserPngQr(image).ok).toBe(true)
    const cab = await cabinet()
    expect((await regler(cab, image, 40, 20)).erreur).toBeNull()
  })

  it('écart assumé, et documenté dans la migration : CRC faux ou contenu zlib illisible acceptés par la base, refusés par le serveur', async () => {
    const crcFaux = pngSynthetique(40, 20, { morceaux: [{ type: 'sRGB', donnees: Uint8Array.from([0]), crcFaux: true }] })
    const contenu = pngSynthetique(40, 20, { idat: Buffer.from('pas du zlib', 'latin1') })
    for (const image of [crcFaux, contenu]) {
      expect(analyserPngQr(image).ok).toBe(false)
      expect((await regler(await cabinet(), image, 40, 20)).erreur).toBeNull()
    }
  })

  it('la fonction de forme, seule : refus de NULL et des fichiers trop courts ; service_role seul l’exécute', async () => {
    expect((await q<{ r: boolean }>('SELECT signalements_qr_png_forme_valide(NULL) AS r'))[0].r).toBe(false)
    expect((await q<{ r: boolean }>(`SELECT signalements_qr_png_forme_valide('\\x89504e47'::bytea) AS r`))[0].r).toBe(false)
    expect((await q<{ r: boolean }>('SELECT signalements_qr_png_forme_valide($1) AS r', [pngSynthetique(4, 4)]))[0].r).toBe(true)
    const [droits] = await q<Record<string, boolean>>(
      `SELECT has_function_privilege('anon', 'signalements_qr_png_forme_valide(bytea)', 'EXECUTE') AS anon,
              has_function_privilege('authenticated', 'signalements_qr_png_forme_valide(bytea)', 'EXECUTE') AS authenticated,
              has_function_privilege('service_role', 'signalements_qr_png_forme_valide(bytea)', 'EXECUTE') AS service_role`)
    expect(droits).toEqual({ anon: false, authenticated: false, service_role: true })
  })
})

describe('droits : anon et authenticated n’ont rien, service_role seul exécute', () => {
  it.each(['anon', 'authenticated'] as const)('%s : ni lecture des colonnes du logo, ni écriture, ni la fonction', async (role) => {
    const cab = await cabinet()
    await regler(cab, pngSynthetique(16, 16), 16, 16)
    expect((await sous(role, 'SELECT logo_png FROM signalements_qr_cabinets')).erreur?.code).toBe('42501')
    expect((await sous(role, 'SELECT logo_version FROM signalements_qr_cabinets')).erreur?.code).toBe('42501')
    expect((await sous(role, 'UPDATE signalements_qr_cabinets SET logo_png = NULL')).erreur?.code).toBe('42501')
    expect((await sous(role, `SELECT signalements_qr_regler_logo_cabinet($1, NULL, NULL, NULL, $2)`, [cab, SUPER_ADMIN])).erreur?.code).toBe('42501')
    const [droits] = await q<Record<string, boolean>>(
      `SELECT has_table_privilege($1, 'signalements_qr_cabinets', 'SELECT') AS lire_table,
              has_table_privilege($1, 'signalements_qr_cabinets', 'UPDATE') AS ecrire_table,
              bool_or(has_column_privilege($1, 'signalements_qr_cabinets', c, 'SELECT')) AS lire_colonne,
              bool_or(has_column_privilege($1, 'signalements_qr_cabinets', c, 'UPDATE')) AS ecrire_colonne,
              has_function_privilege($1, '${SIGNATURE}', 'EXECUTE') AS executer
         FROM unnest($2::text[]) AS c`, [role, COLONNES_LOGO])
    expect(droits).toEqual({ lire_table: false, ecrire_table: false, lire_colonne: false, ecrire_colonne: false, executer: false })
  })

  it('service_role exécute la fonction ; aucune politique RLS sur la table', async () => {
    const [r] = await q<{ executer: boolean; politiques: number; rls: boolean }>(
      `SELECT has_function_privilege('service_role', '${SIGNATURE}', 'EXECUTE') AS executer,
              (SELECT count(*)::int FROM pg_policy WHERE polrelid = 'signalements_qr_cabinets'::regclass) AS politiques,
              (SELECT relrowsecurity FROM pg_class WHERE oid = 'signalements_qr_cabinets'::regclass) AS rls`)
    expect(r).toEqual({ executer: true, politiques: 0, rls: true })
  })

  it('fonction SECURITY INVOKER, search_path figé (public, pg_temp)', async () => {
    const [r] = await q<{ definer: boolean; config: string[] }>(
      `SELECT prosecdef AS definer, proconfig AS config FROM pg_proc WHERE oid = '${SIGNATURE}'::regprocedure`)
    expect(r).toEqual({ definer: false, config: ['search_path=public, pg_temp'] })
  })
})
