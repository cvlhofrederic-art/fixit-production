// tests/migrations/signalements_qr_logo_cabinet.test.ts
//
// Migration 20261114_signalements_qr_logo_cabinet.sql (AJ Signalement, demande de Hugo du 13/11/2026 : « pouvoir ajouter
// le logo au cabinet et aux PDF »). Le TEXTE SQL est contrôlé ici : additive, rejouable, sans politique RLS, droits à
// service_role seul, indépendante de la 20261113 (fusionnée, pas encore appliquée : la liste fermée du journal n'est pas
// touchée). Les règles elles-mêmes (contrainte de l'image, envoi, retrait, journal, droits) sont exécutées sur un vrai
// PostgreSQL par signalements_qr_logo_cabinet.execution.test.ts (PGlite).

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const DOSSIER = join(process.cwd(), 'supabase/migrations')
const FICHIER = '20261114_signalements_qr_logo_cabinet.sql'
const CHEMIN = join(DOSSIER, FICHIER)
const sql = existsSync(CHEMIN) ? readFileSync(CHEMIN, 'utf-8').replace(/\r\n/g, '\n') : ''
/** Le SQL sans ses commentaires : une mention en commentaire ne compte pas comme instruction. */
const code = sql.replace(/--[^\n]*/g, '')
/** Ce qui s'exécute une seule fois, à l'application : le SQL sans le corps des fonctions (balise $fn$). */
const horsFonctions = code.replace(/\$fn\$[\s\S]*?\$fn\$/g, '$fn$ $fn$')
const entete = sql.slice(0, Math.max(0, sql.indexOf('-- ── 1.')))

const trie = (valeurs: Iterable<string>) => [...valeurs].sort((a, b) => a.localeCompare(b))

/** Colonnes ajoutées au cabinet, avec leur type. */
const COLONNES: Record<string, string> = {
  logo_png: 'BYTEA',
  logo_largeur: 'INTEGER',
  logo_hauteur: 'INTEGER',
  logo_version: 'TEXT',
  logo_maj_le: 'TIMESTAMPTZ',
}
const FONCTION = 'signalements_qr_regler_logo_cabinet'
const SIGNATURE = 'uuid, bytea, integer, integer, uuid'
/** Relecture de conformité du 13/11/2026 : forme du PNG vérifiée par la contrainte, morceau par morceau. */
const FORME = 'signalements_qr_png_forme_valide'

interface FonctionSql { nom: string; types: string; entete: string; corps: string }

function fonctionsDefinies(texte: string): FonctionSql[] {
  const motif = /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(\w+)\s*\(([^)]*)\)([\s\S]*?)\bAS\s+\$fn\$([\s\S]*?)\$fn\$/gi
  return [...texte.matchAll(motif)].map((m) => ({
    nom: m[1],
    types: m[2].split(',').map((p) => p.trim()).filter(Boolean).map((p) => p.split(/\s+/).slice(1).join(' ').toLowerCase()).join(', '),
    entete: m[3],
    corps: m[4],
  }))
}

describe(`Migration ${FICHIER} : fichier et ordre`, () => {
  it('existe et passe après la dernière migration appliquée des signalements (20261112) et après la 20261113', () => {
    expect(existsSync(CHEMIN)).toBe(true)
    const fichiers = readdirSync(DOSSIER).sort((a, b) => a.localeCompare(b))
    expect(fichiers.indexOf(FICHIER)).toBeGreaterThan(fichiers.indexOf('20261112_signalements_qr_acces_gestionnaires.sql'))
    expect(fichiers.indexOf(FICHIER)).toBeGreaterThan(fichiers.indexOf('20261113_signalements_qr_diffusion.sql'))
  })

  it('l’en-tête dit quand l’appliquer : après la 20261111 (cabinets, journal), avant ou après la 20261113', () => {
    expect(entete.length).toBeGreaterThan(0)
    expect(entete).toMatch(/APRÈS 20261111_signalements_qr_gestionnaires\.sql/)
    expect(entete).toMatch(/avant ou après la 20261113/)
    expect(entete).toMatch(/cabinet\.modifie/)
  })

  // Relecture de conformité du 13/11/2026 : les e-mails de signalement aux gestionnaires partent en lot, sans pièce jointe
  // possible, donc sans logo ; seul l'accusé de réception le porte.
  it('l’en-tête dit où paraît le logo : l’accusé de réception, pas les e-mails de signalement', () => {
    // Texte suivi : les lignes de commentaire mises bout à bout.
    const suivi = entete.replace(/\n--[ \t]*/g, ' ')
    expect(suivi).not.toMatch(/accusé de réception et de signalement/)
    expect(suivi).toMatch(/dans l'accusé de réception envoyé au déclarant/)
    expect(suivi).toMatch(/ni dans les e-mails de signalement envoyés aux gestionnaires/)
  })

  it('l’en-tête dit ce que la base vérifie et ce qu’elle laisse au serveur (CRC, contenu zlib des IDAT)', () => {
    expect(entete).toMatch(/signalements_qr_png_forme_valide/)
    expect(entete).toMatch(/CRC/)
    expect(entete).toMatch(/zlib/)
  })

  it('se termine par la relecture du schéma par PostgREST', () => {
    expect(code).toMatch(/NOTIFY pgrst, 'reload schema';\s*$/)
  })

  it('en-tête : chaque message P0001 levé y est cité ; codes levés : P0001 et 22023 seulement', () => {
    const leves = new Set([...code.matchAll(/RAISE EXCEPTION '([a-z_]+)' USING ERRCODE = 'P0001'/g)].map((m) => m[1]))
    expect(trie(leves)).toEqual(['a_reverifier'])
    expect([...leves].filter((m) => !new RegExp(`\\b${m}\\b`).test(entete))).toEqual([])
    const codes = new Set([...code.matchAll(/RAISE EXCEPTION '[a-z_]+' USING ERRCODE = '([0-9A-Z]{5})'/g)].map((m) => m[1]))
    expect(trie(codes)).toEqual(['22023', 'P0001'])
  })
})

describe('Colonnes et contrainte de l’image', () => {
  it.each(Object.entries(COLONNES))('%s (%s) : ADD COLUMN IF NOT EXISTS sur signalements_qr_cabinets, sans défaut', (colonne, type) => {
    expect(code).toMatch(new RegExp(`ALTER TABLE signalements_qr_cabinets ADD COLUMN IF NOT EXISTS ${colonne} ${type};`))
  })

  it('aucune autre table ni colonne : seulement les 5 colonnes du logo', () => {
    const ajouts = [...code.matchAll(/ADD COLUMN IF NOT EXISTS (\w+)/g)].map((m) => m[1])
    expect(trie(ajouts)).toEqual(trie(Object.keys(COLONNES)))
    expect(code).not.toMatch(/CREATE TABLE/)
  })

  it('contrainte nommée, créée seulement si absente de pg_constraint, en NOT VALID puis VALIDATE', () => {
    const nom = 'signalements_qr_cabinets_logo_png_valide'
    expect(code).toMatch(new RegExp(`IF NOT EXISTS \\(SELECT 1 FROM pg_constraint WHERE conname = '${nom}'\\s+AND conrelid = 'signalements_qr_cabinets'::regclass\\)`))
    expect(code).toMatch(new RegExp(`ADD CONSTRAINT ${nom} CHECK \\([\\s\\S]*?\\) NOT VALID;`))
    expect(code).toMatch(new RegExp(`ALTER TABLE signalements_qr_cabinets VALIDATE CONSTRAINT ${nom};`))
  })

  it('la contrainte revérifie l’image : signature et IHDR, fin IEND, poids, dimensions lues dans l’en-tête, version = empreinte', () => {
    const m = /ADD CONSTRAINT signalements_qr_cabinets_logo_png_valide CHECK \(([\s\S]*?)\) NOT VALID;/.exec(code)
    const regle = m?.[1] ?? ''
    // Signature PNG (8 octets), longueur 13 et type « IHDR » du premier morceau.
    expect(regle).toContain("'\\x89504e470d0a1a0a0000000d49484452'::bytea")
    // Morceau IEND final (longueur 0, type, CRC fixe) : rien après la fin de l'image.
    expect(regle).toContain("'\\x0000000049454e44ae426082'::bytea")
    expect(regle).toMatch(/octet_length\(logo_png\) BETWEEN \d+ AND 204800/)
    expect(regle).toMatch(/logo_largeur BETWEEN 1 AND 800/)
    expect(regle).toMatch(/logo_hauteur BETWEEN 1 AND 400/)
    for (const octet of [16, 17, 18, 19, 20, 21, 22, 23]) expect(regle).toContain(`get_byte(logo_png, ${octet})`)
    // Morceaux parcourus (même forme que analyserPngQr) : la fonction IMMUTABLE de la migration.
    expect(regle).toContain(`${FORME}(logo_png)`)
    expect(regle).toMatch(/logo_version = left\(encode\(sha256\(logo_png\), 'hex'\), 16\)/)
    // Tout ou rien : un logo complet, ou aucune colonne renseignée.
    expect(regle).toMatch(/logo_png IS NULL AND logo_largeur IS NULL AND logo_hauteur IS NULL AND logo_version IS NULL AND logo_maj_le IS NULL/)
  })
})

describe('Fonction d’envoi et de retrait', () => {
  const fonctions = fonctionsDefinies(code)

  const envoi = fonctions.find((f) => f.nom === FONCTION)

  it(`deux fonctions : ${FORME}(bytea), IMMUTABLE, et ${FONCTION}(${SIGNATURE}) ; SECURITY INVOKER, search_path figé`, () => {
    expect(fonctions.map((f) => `${f.nom}(${f.types})`)).toEqual([`${FORME}(bytea)`, `${FONCTION}(${SIGNATURE})`])
    expect(fonctions[0].entete).toMatch(/RETURNS boolean\s+LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SECURITY INVOKER SET search_path = public, pg_temp/)
    expect(envoi?.entete).toMatch(/RETURNS jsonb\s+LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp/)
  })

  it('la fonction de forme ne lève rien et n’écrit rien (elle rend vrai ou faux)', () => {
    const corps = fonctions[0]?.corps ?? ''
    expect(corps).not.toMatch(/RAISE|INSERT|UPDATE|DELETE/)
  })

  it('journal : action EXISTANTE cabinet.modifie, champs {logo}, profil super_admin ; aucune autre action', () => {
    const corps = envoi?.corps ?? ''
    const actions = new Set([...corps.matchAll(/'super_admin', '([a-z_.]+)'/g)].map((m) => m[1]))
    expect([...actions]).toEqual(['cabinet.modifie'])
    expect(corps).toMatch(/ARRAY\['logo'\]/)
    expect(corps).toMatch(/jsonb_build_object\('logo', 'envoye', 'largeur', p_largeur, 'hauteur', p_hauteur, 'octets', octet_length\(p_png\)\)/)
    expect(corps).toMatch(/jsonb_build_object\('logo', 'retire'\)/)
    expect(corps).toMatch(/FOR UPDATE/)
  })

  it('EXECUTE retiré à PUBLIC, anon et authenticated, donné à service_role seul (signatures complètes)', () => {
    for (const f of [`${FORME}(bytea)`, `${FONCTION}(${SIGNATURE})`]) {
      expect(code).toContain(`REVOKE EXECUTE ON FUNCTION ${f} FROM PUBLIC, anon, authenticated;`)
    }
    expect([...code.matchAll(/\bGRANT\b[^;]*;/g)].map((m) => m[0])).toEqual([
      `GRANT  EXECUTE ON FUNCTION ${FORME}(bytea) TO service_role;`,
      `GRANT  EXECUTE ON FUNCTION ${FONCTION}(${SIGNATURE}) TO service_role;`,
    ])
  })
})

describe('Sûreté de la migration', () => {
  it('aucune politique RLS, aucun droit à anon ou authenticated ; droits de la table retirés de nouveau (nouvelles colonnes)', () => {
    expect(code).not.toMatch(/\bPOLICY\b/i)
    expect(code).not.toMatch(/\bTO\s+(anon|authenticated|PUBLIC)\b/i)
    expect(code).toContain('REVOKE ALL ON signalements_qr_cabinets FROM anon, authenticated;')
  })

  it('indépendante de la 20261113 : la liste fermée du journal n’est ni nommée ni remplacée, aucun objet de la diffusion', () => {
    expect(code).not.toMatch(/signalements_qr_journal_action_valeurs/)
    expect(code).not.toMatch(/\bdiffusion/i)
    expect(horsFonctions).not.toMatch(/\bDROP\b/i)
  })

  it('aucune écriture de données à l’application (hors du corps de la fonction)', () => {
    expect(horsFonctions).not.toMatch(/\b(INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|TRUNCATE)\b/i)
  })

  // Aucun nom de client réel : garde commune à tout le périmètre (tests/lib/aj-signalement-identifiants-reserves.test.ts).
  it('aucun logo dans le fichier (dépôt public) : ni image en ligne, ni valeur bytea littérale autre que les marqueurs PNG', () => {
    expect(sql).not.toMatch(/data:image|base64,/i)
    const litteraux = [...code.matchAll(/'\\x([0-9a-f]+)'::bytea/g)].map((m) => m[1])
    expect(trie(litteraux)).toEqual(trie(['0000000049454e44ae426082', '89504e470d0a1a0a', '89504e470d0a1a0a0000000d49484452']))
  })
})
