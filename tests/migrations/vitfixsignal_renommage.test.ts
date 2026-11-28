// @vitest-environment node
// tests/migrations/vitfixsignal_renommage.test.ts
//
// Relecture du TEXTE de la migration 20261126b_vitfixsignal_renommage.sql (décision du 26/11/2026 : le produit de
// signalements par QR code s'appelle « Vitfix Signal ») :
//   - elle ne fait que deux choses : reposer les commentaires (COMMENT ON) qui portaient le nom du produit, et renommer
//     la clé du repère de routage dans auth.users.raw_app_meta_data (aj_signalement_cabinet → vitfixsignal_cabinet) ;
//   - AUCUN autre ordre : ni CREATE, ni ALTER, ni DROP, ni DELETE, ni INSERT, ni GRANT / REVOKE ; aucune table
//     signalements_qr_* n'est écrite ;
//   - chaque commentaire des migrations du dépôt qui nomme le produit y est repris au mot près (aucun oublié) ;
//   - une seule transaction, rejouable ; elle passe après toutes les migrations existantes.
// Son exécution sur un vrai PostgreSQL : tests/migrations/vitfixsignal_renommage.execution.test.ts.

import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CLE_REPERE_CABINET_QR } from '@/lib/vitfixsignal/acces-espace'
import { ANCIENNE_CLE_REPERE_CABINET_QR } from '@/lib/vitfixsignal/ancien-nom'
import { MIGRATIONS_SIGNALEMENTS_QR, lireMigrationQr } from '../helpers/pglite-signalements'

const FICHIER = '20261126b_vitfixsignal_renommage.sql'
const sql = lireMigrationQr(FICHIER)

/** Le SQL sans ses commentaires « -- … » (aucune chaîne de cette migration ne contient « -- »). */
const sansCommentaires = sql.split('\n').map((ligne) => ligne.replace(/--.*$/, '')).join('\n')

/** Ordres SQL, dans l'ordre du fichier (aucune chaîne de cette migration ne contient « ; » suivi d'un saut de ligne). */
const ordres = sansCommentaires.split(/;\s*(?:\n|$)/).map((o) => o.trim().replace(/\s+/g, ' ')).filter(Boolean)

/** Commentaires (COMMENT ON TABLE | COLUMN … IS '…';) d'un texte SQL, une entrée par ordre, tels qu'écrits. */
const commentaires = (texte: string): string[] =>
  texte.split('\n').filter((ligne) => /^COMMENT ON (?:TABLE|COLUMN) /.test(ligne)).map((ligne) => ligne.trim())

const NOM_DU_PRODUIT = /Vitfix Signal|vitfixsignal/

describe('migration 20261126b : place et forme', () => {
  it('passe après toutes les migrations existantes (ordre des noms de fichier)', () => {
    const fichiers = readdirSync(join(process.cwd(), 'supabase/migrations')).filter((f) => f.endsWith('.sql')).sort()
    expect(fichiers.at(-1)).toBe(FICHIER)
    for (const precedente of MIGRATIONS_SIGNALEMENTS_QR) expect(precedente < FICHIER, precedente).toBe(true)
  })

  it('une seule transaction, délai de verrou borné', () => {
    expect(ordres[0]).toBe('begin')
    expect(ordres[1]).toBe("set local lock_timeout = '5s'")
    expect(ordres.at(-1)).toBe('commit')
    expect(ordres.filter((o) => /^(begin|commit|rollback)\b/i.test(o))).toEqual(['begin', 'commit'])
  })

  it('seulement des COMMENT ON et UN UPDATE de auth.users : aucun autre ordre', () => {
    const corps = ordres.slice(2, -1)
    const genres = corps.map((o) => (/^COMMENT ON (TABLE|COLUMN) signalements_qr\w*(\.\w+)? IS '/.test(o) ? 'commentaire' : /^UPDATE auth\.users SET raw_app_meta_data = /.test(o) ? 'repere' : o))
    expect(genres.filter((g) => g === 'commentaire')).toHaveLength(14)
    expect(genres.filter((g) => g === 'repere')).toHaveLength(1)
    expect(genres.filter((g) => g !== 'commentaire' && g !== 'repere')).toEqual([])
    expect(sansCommentaires).not.toMatch(/\b(CREATE|ALTER|DROP|DELETE|INSERT|TRUNCATE|GRANT|REVOKE)\b/i)
  })

  it('en-tête : ordre de mise en production (APRÈS le code), rejouable, contrôle et retour arrière nommés', () => {
    const entete = sql.split('\nbegin;')[0]
    expect(entete).toMatch(/APRÈS la mise en production du code/)
    expect(entete).toMatch(/Rejouable/)
    expect(entete).toContain('tests/migrations/vitfixsignal_renommage.execution.test.ts')
    expect(entete).toContain('docs/rollback-procedures.md')
  })
})

describe('migration 20261126b : commentaires', () => {
  const duDepot = MIGRATIONS_SIGNALEMENTS_QR.flatMap((fichier) => commentaires(lireMigrationQr(fichier)))
  const quiNommentLeProduit = duDepot.filter((c) => NOM_DU_PRODUIT.test(c))

  it('les migrations du dépôt sont bien lues (sinon la comparaison ne garderait rien)', () => {
    expect(duDepot.length).toBeGreaterThan(40)
    expect(quiNommentLeProduit).toHaveLength(14)
  })

  it('chaque commentaire du dépôt qui nomme le produit est repris au mot près, et aucun autre', () => {
    expect([...commentaires(sql)].sort()).toEqual([...quiNommentLeProduit].sort())
  })

  it('chaque objet n’est commenté qu’une fois dans le dépôt (le texte repris est bien celui en place)', () => {
    const objets = duDepot.map((c) => /^COMMENT ON (?:TABLE|COLUMN) (\S+) IS/.exec(c)?.[1])
    const repris = commentaires(sql).map((c) => /^COMMENT ON (?:TABLE|COLUMN) (\S+) IS/.exec(c)?.[1])
    for (const objet of repris) expect(objets.filter((o) => o === objet), String(objet)).toHaveLength(1)
  })

  it('aucun commentaire ne garde l’ancien nom', () => {
    expect(commentaires(sql).join('\n')).not.toMatch(/aj[ _-]?signal/i)
  })
})

describe('migration 20261126b : repère de routage des comptes', () => {
  const update = ordres.find((o) => o.startsWith('UPDATE ')) ?? ''

  it('les deux clés sont celles du code (ancienne lue en repli, nouvelle écrite)', () => {
    expect(ANCIENNE_CLE_REPERE_CABINET_QR).toBe('aj_signalement_cabinet')
    expect(CLE_REPERE_CABINET_QR).toBe('vitfixsignal_cabinet')
    expect(update).toContain(`'${ANCIENNE_CLE_REPERE_CABINET_QR}'`)
    expect(update).toContain(`'${CLE_REPERE_CABINET_QR}'`)
  })

  it('une seule table, une seule colonne écrite ; seuls les comptes qui portent l’ancienne clé', () => {
    expect(update).toMatch(/^UPDATE auth\.users SET raw_app_meta_data = CASE /)
    expect(update.match(/\bSET\b/g)).toHaveLength(1)
    expect(update).toMatch(/ WHERE raw_app_meta_data -> 'aj_signalement_cabinet' IS NOT NULL$/)
    expect(update).not.toMatch(/raw_user_meta_data|updated_at|email|encrypted_password|banned_until/)
  })

  it('aucune autre clé d’app_metadata n’est nommée (role, provider… jamais touchés)', () => {
    const cles = [...update.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
    expect([...new Set(cles)].sort()).toEqual(['aj_signalement_cabinet', 'vitfixsignal_cabinet'])
  })

  it('nouvelle clé déjà présente : gardée (l’ancienne est seulement retirée) ; sinon la valeur est recopiée telle quelle', () => {
    expect(update).toContain("WHEN raw_app_meta_data -> 'vitfixsignal_cabinet' IS NOT NULL THEN raw_app_meta_data - 'aj_signalement_cabinet'")
    expect(update).toContain("ELSE (raw_app_meta_data - 'aj_signalement_cabinet') || jsonb_build_object('vitfixsignal_cabinet', raw_app_meta_data -> 'aj_signalement_cabinet')")
  })
})
