// @vitest-environment node
// tests/migrations/vitfixsignal_renommage.execution.test.ts
//
// EXÉCUTION RÉELLE de la migration 20261126b_vitfixsignal_renommage.sql sur un vrai PostgreSQL (PGlite, WebAssembly, en
// mémoire ; aucun service, aucune base distante), après la chaîne des migrations signalements_qr du dépôt :
//   - état de la PRODUCTION reconstitué avant elle : les commentaires qui nomment le produit portent l'ancien nom (les
//     fichiers du dépôt, eux, ont été mis à jour par le renommage), et des comptes portent l'ancienne clé du repère de
//     routage dans auth.users.raw_app_meta_data ;
//   - après elle : chaque commentaire est celui du dépôt, plus aucun ne porte l'ancien nom ; l'ancienne clé est
//     devenue la nouvelle, MÊME valeur, sur les seuls comptes qui la portaient ; aucune autre clé, aucun autre compte,
//     aucune autre colonne, aucune ligne des tables signalements_qr_* n'a changé ; le schéma est identique ;
//   - rejouée : rien ne change.
// L'échafaudage commun (tests/helpers/pglite-signalements.ts) réduit auth.users à sa clé : la colonne
// raw_app_meta_data (jsonb, comme chez Supabase) est ajoutée ici. Comptes FICTIFS (exemple.test).

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { creerBaseSignalementsQr, empreinteSchemaQr, lireMigrationQr } from '../helpers/pglite-signalements'

const RENOMMAGE = lireMigrationQr('20261126b_vitfixsignal_renommage.sql')

const G_D_AVANT = '00000000-0000-4000-8000-000000000001'
const G_D_AVANT_2 = '00000000-0000-4000-8000-000000000002'
const G_DEJA_RENOMME = '00000000-0000-4000-8000-000000000003'
const G_DEUX_CLES = '00000000-0000-4000-8000-000000000004'
const SUPER_ADMIN = '00000000-0000-4000-8000-000000000005'
const CLIENT = '00000000-0000-4000-8000-000000000006'
const SANS_METADONNEES = '00000000-0000-4000-8000-000000000007'
const G_SANS_REPERE = '00000000-0000-4000-8000-000000000008'

/** Comptes avant la migration : identifiant → app_metadata (null : colonne vide). */
const COMPTES: Record<string, Record<string, unknown> | null> = {
  [G_D_AVANT]: { provider: 'email', providers: ['email'], role: 'gestionnaire_signalement', aj_signalement_cabinet: 'cabinet-exemple' },
  [G_D_AVANT_2]: { role: 'gestionnaire_signalement', aj_signalement_cabinet: 'autre-cabinet', autre_cle: { imbriquee: [1, 2, 3] } },
  [G_DEJA_RENOMME]: { provider: 'email', role: 'gestionnaire_signalement', vitfixsignal_cabinet: 'cabinet-exemple' },
  [G_DEUX_CLES]: { role: 'gestionnaire_signalement', vitfixsignal_cabinet: 'cabinet-neuf', aj_signalement_cabinet: 'cabinet-exemple' },
  [SUPER_ADMIN]: { provider: 'email', providers: ['email'], role: 'super_admin' },
  [CLIENT]: { provider: 'email', providers: ['email'] },
  [SANS_METADONNEES]: null,
  [G_SANS_REPERE]: { role: 'gestionnaire_signalement' },
}

/** Comptes attendus après la migration. */
const ATTENDUS: Record<string, Record<string, unknown> | null> = {
  ...COMPTES,
  [G_D_AVANT]: { provider: 'email', providers: ['email'], role: 'gestionnaire_signalement', vitfixsignal_cabinet: 'cabinet-exemple' },
  [G_D_AVANT_2]: { role: 'gestionnaire_signalement', vitfixsignal_cabinet: 'autre-cabinet', autre_cle: { imbriquee: [1, 2, 3] } },
  [G_DEUX_CLES]: { role: 'gestionnaire_signalement', vitfixsignal_cabinet: 'cabinet-neuf' },
}

let db: PGlite

async function comptes(): Promise<Record<string, { meta: Record<string, unknown> | null; email: string | null; user_meta: unknown }>> {
  const { rows } = await db.query<{ id: string; email: string | null; raw_app_meta_data: Record<string, unknown> | null; raw_user_meta_data: unknown }>(
    'SELECT id, email, raw_app_meta_data, raw_user_meta_data FROM auth.users ORDER BY id')
  return Object.fromEntries(rows.map((r) => [r.id, { meta: r.raw_app_meta_data, email: r.email, user_meta: r.raw_user_meta_data }]))
}

/** Commentaires des tables et des colonnes du schéma public : « table » ou « table.colonne » → texte. */
async function commentairesEnBase(): Promise<Map<string, string>> {
  const { rows } = await db.query<{ objet: string; texte: string }>(`
    SELECT c.relname || CASE WHEN d.objsubid = 0 THEN '' ELSE '.' || a.attname END AS objet, d.description AS texte
      FROM pg_description d
      JOIN pg_class c ON c.oid = d.objoid AND d.classoid = 'pg_class'::regclass
      LEFT JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.objsubid
     WHERE c.relnamespace = 'public'::regnamespace
     ORDER BY 1`)
  return new Map(rows.map((r) => [r.objet, r.texte]))
}

/** Nombre de lignes de chaque table signalements_qr_* (aucune ne doit bouger). */
async function lignesDesTables(): Promise<Record<string, number>> {
  const { rows } = await db.query<{ relname: string }>(
    `SELECT relname FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND relname LIKE 'signalements_qr%' ORDER BY 1`)
  const comptesParTable: Record<string, number> = {}
  for (const { relname } of rows) {
    const r = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${relname}`)
    comptesParTable[relname] = r.rows[0].n
  }
  return comptesParTable
}

let commentairesDuDepot = new Map<string, string>()
let schemaAvant = new Map<string, string>()
let lignesAvant: Record<string, number> = {}

beforeAll(async () => {
  db = await creerBaseSignalementsQr()
  // auth.users de Supabase : app_metadata et user_metadata en jsonb.
  await db.exec('ALTER TABLE auth.users ADD COLUMN raw_app_meta_data jsonb, ADD COLUMN raw_user_meta_data jsonb')
  for (const [id, meta] of Object.entries(COMPTES)) {
    await db.query('INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data) VALUES ($1, $2, $3::jsonb, $4::jsonb)', [
      id, `compte-${id.slice(-1)}@exemple.test`, meta === null ? null : JSON.stringify(meta), JSON.stringify({ full_name: 'Compte Exemple', aj_signalement_cabinet: 'forge-par-l-utilisateur' }),
    ])
  }
  // Une donnée dans une table du produit : elle ne doit pas bouger.
  await db.exec(`INSERT INTO signalements_qr_cabinets (nom, identifiant) VALUES ('Cabinet Exemple', 'cabinet-exemple')`)

  // Le dépôt (fichiers mis à jour par le renommage) donne les commentaires attendus ; la PRODUCTION, elle, porte encore
  // l'ancien nom : on l'y remet, objet par objet, avant de jouer la migration.
  commentairesDuDepot = await commentairesEnBase()
  for (const [objet, texte] of commentairesDuDepot) {
    if (!/Vitfix Signal|vitfixsignal/.test(texte)) continue
    const ancien = texte.replaceAll('Vitfix Signal', 'AJ Signalement').replaceAll('lib/vitfixsignal/', 'lib/aj-signalement/')
    const cible = objet.includes('.') ? `COLUMN ${objet}` : `TABLE ${objet}`
    await db.exec(`COMMENT ON ${cible} IS '${ancien.replaceAll("'", "''")}'`)
  }
  schemaAvant = await empreinteSchemaQr(db)
  lignesAvant = await lignesDesTables()
}, 120_000)

afterAll(async () => {
  await db?.close()
})

describe('avant la migration : état de la production reconstitué', () => {
  it('14 commentaires portent l’ancien nom ; des comptes portent l’ancienne clé', async () => {
    const enBase = await commentairesEnBase()
    const anciens = [...enBase.entries()].filter(([, texte]) => /aj[ _-]?signal/i.test(texte))
    expect(anciens).toHaveLength(14)
    expect(anciens.map(([objet]) => objet)).toContain('signalements_qr_coproprietes.cle_nom')
    const avant = await comptes()
    expect(Object.keys(avant)).toHaveLength(Object.keys(COMPTES).length)
    expect(avant[G_D_AVANT].meta).toEqual(COMPTES[G_D_AVANT])
  })
})

describe('après la migration (jouée une fois, puis rejouée)', () => {
  beforeAll(async () => {
    await db.exec(RENOMMAGE)
  })

  it('chaque commentaire est celui du dépôt ; plus aucun ne porte l’ancien nom', async () => {
    const enBase = await commentairesEnBase()
    expect(enBase).toEqual(commentairesDuDepot)
    expect([...enBase.values()].filter((texte) => /aj[ _-]?signal/i.test(texte))).toEqual([])
    expect([...enBase.values()].filter((texte) => texte.startsWith('Vitfix Signal : '))).toHaveLength(13)
  })

  it('ancienne clé → nouvelle clé, même valeur ; les autres clés et les autres comptes sont intacts', async () => {
    const apres = await comptes()
    for (const [id, attendu] of Object.entries(ATTENDUS)) expect(apres[id].meta, id).toEqual(attendu)
  })

  it('plus aucun compte ne porte l’ancienne clé ; un compte qui avait déjà la nouvelle la garde', async () => {
    const { rows } = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM auth.users WHERE raw_app_meta_data -> 'aj_signalement_cabinet' IS NOT NULL`)
    expect(rows[0].n).toBe(0)
    const apres = await comptes()
    expect(apres[G_DEUX_CLES].meta).toEqual({ role: 'gestionnaire_signalement', vitfixsignal_cabinet: 'cabinet-neuf' })
    expect(apres[G_DEJA_RENOMME].meta).toEqual(COMPTES[G_DEJA_RENOMME])
  })

  it('aucune autre colonne des comptes n’est touchée (adresse, user_metadata — même s’il porte une clé du même nom)', async () => {
    const apres = await comptes()
    for (const id of Object.keys(COMPTES)) {
      expect(apres[id].email, id).toBe(`compte-${id.slice(-1)}@exemple.test`)
      expect(apres[id].user_meta, id).toEqual({ full_name: 'Compte Exemple', aj_signalement_cabinet: 'forge-par-l-utilisateur' })
    }
  })

  it('colonne vide ou sans repère : laissée telle quelle (NULL reste NULL)', async () => {
    const apres = await comptes()
    expect(apres[SANS_METADONNEES].meta).toBeNull()
    expect(apres[G_SANS_REPERE].meta).toEqual({ role: 'gestionnaire_signalement' })
    expect(apres[CLIENT].meta).toEqual(COMPTES[CLIENT])
  })

  it('schéma identique (colonnes, contraintes, index, triggers, fonctions, droits, RLS) et aucune ligne des tables du produit touchée', async () => {
    expect(await empreinteSchemaQr(db)).toEqual(schemaAvant)
    expect(await lignesDesTables()).toEqual(lignesAvant)
    expect(lignesAvant.signalements_qr_cabinets).toBe(1)
  })

  it('rejouée : aucune erreur, rien ne change', async () => {
    const [comptesAvant, commentairesAvant] = [await comptes(), await commentairesEnBase()]
    await db.exec(RENOMMAGE)
    expect(await comptes()).toEqual(comptesAvant)
    expect(await commentairesEnBase()).toEqual(commentairesAvant)
    expect(await empreinteSchemaQr(db)).toEqual(schemaAvant)
  })

  it('raw_app_meta_data qui n’est pas un objet (tableau, texte) : ignoré sans erreur', async () => {
    await db.exec(`INSERT INTO auth.users (id, raw_app_meta_data) VALUES
      ('00000000-0000-4000-8000-0000000000a1', '["aj_signalement_cabinet"]'::jsonb),
      ('00000000-0000-4000-8000-0000000000a2', '"aj_signalement_cabinet"'::jsonb)`)
    await db.exec(RENOMMAGE)
    const apres = await comptes()
    expect(apres['00000000-0000-4000-8000-0000000000a1'].meta).toEqual(['aj_signalement_cabinet'])
    expect(apres['00000000-0000-4000-8000-0000000000a2'].meta).toBe('aj_signalement_cabinet')
  })
})
