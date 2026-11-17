import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'

// Migration 20261111_marches_lecture_publique_fermee.sql : retrait de la politique de lecture directe de la table
// `marches`. La lecture publique des appels d'offres passe par /api/marches et sa liste blanche de colonnes
// (lib/marches-public.ts, tests/api/marches-acces.test.ts) : une politique choisit des lignes, pas des colonnes.
// Même forme que tests/migrations/rls_policies_roles_serveur.test.ts.

const DOSSIER = join(process.cwd(), 'supabase/migrations')
const FICHIER = '20261111_marches_lecture_publique_fermee.sql'
const POLITIQUE_RETIREE = 'marches_public_read'

// Politiques conservées : le publieur connecté lit et modifie ses propres marchés, l'insertion reste contrôlée.
const POLITIQUES_CONSERVEES = ['marches_publisher_read', 'marches_publisher_update', 'marches_insert']

/** SQL sans commentaires : une mention en commentaire ne compte pas comme instruction. */
function sansCommentaires(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '')
}

function lire(fichier: string): string {
  return sansCommentaires(readFileSync(join(DOSSIER, fichier), 'utf-8'))
}

describe(`Migration ${FICHIER}`, () => {
  it('existe', () => {
    expect(existsSync(join(DOSSIER, FICHIER))).toBe(true)
  })

  const sql = existsSync(join(DOSSIER, FICHIER)) ? lire(FICHIER) : ''

  it(`retire ${POLITIQUE_RETIREE} sur public.marches (DROP POLICY IF EXISTS, rejouable)`, () => {
    expect(sql).toMatch(new RegExp(`DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+"${POLITIQUE_RETIREE}"\\s+ON\\s+public\\.marches\\s*;`, 'i'))
  })

  it('ne crée ni ne modifie aucune politique (retrait seul, sans remplacement)', () => {
    expect(sql).not.toMatch(/\bCREATE\s+POLICY\b/i)
    expect(sql).not.toMatch(/\bALTER\s+POLICY\b/i)
  })

  it.each(POLITIQUES_CONSERVEES)('ne touche pas à %s', (politique) => {
    expect(sql).not.toMatch(new RegExp(`\\b${politique}\\b`, 'i'))
  })

  it('ne touche ni aux tables, ni aux droits, ni à l’activation de la RLS', () => {
    expect(sql).not.toMatch(/\b(ALTER|DROP|CREATE)\s+TABLE\b/i)
    expect(sql).not.toMatch(/\b(GRANT|REVOKE)\b/i)
    expect(sql).not.toMatch(/ROW\s+LEVEL\s+SECURITY/i)
  })

  it('ne modifie aucune ligne (les marchés déjà enregistrés restent tels quels)', () => {
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE)\b/i)
  })

  it('borne l’attente des verrous (DROP POLICY verrouille la table)', () => {
    expect(sql).toMatch(/set\s+local\s+lock_timeout\s*=\s*'\d+s'\s*;/i)
  })
})

describe('Base reconstruite depuis le dépôt', () => {
  // Ordre d'application : nom de fichier, comme la CLI Supabase.
  const fichiers = readdirSync(DOSSIER).filter((f) => f.endsWith('.sql')).sort()

  it(`${POLITIQUE_RETIREE} : la dernière instruction qui la vise est le DROP de cette migration`, () => {
    const motif = new RegExp(`\\b(CREATE|ALTER|DROP)\\s+POLICY\\s+(?:IF\\s+EXISTS\\s+)?"?${POLITIQUE_RETIREE}"?(?![A-Za-z0-9_])`, 'gi')
    const instructions: Array<{ fichier: string; verbe: string }> = []
    for (const fichier of fichiers) {
      for (const m of lire(fichier).matchAll(motif)) {
        instructions.push({ fichier, verbe: m[1].toUpperCase() })
      }
    }
    // Créée par 006_bourse_marches.sql, retirée ici, et jamais recréée ensuite.
    expect(instructions.length).toBeGreaterThanOrEqual(2)
    expect(instructions.at(-1)).toEqual({ fichier: FICHIER, verbe: 'DROP' })
  })

  it('aucune migration postérieure ne pose sur marches une politique sans condition de compte', () => {
    // Une politique créée ou modifiée après ce retrait doit dépendre du compte connecté (auth.uid()) : une lecture
    // ouverte à tous reviendrait sur toutes les colonnes de la table, quel que soit le nom de la politique.
    const suivantes = fichiers.filter((f) => f > FICHIER)
    for (const fichier of suivantes) {
      const politiques = lire(fichier).match(/\b(CREATE|ALTER)\s+POLICY\b[^;]*;/gi) ?? []
      for (const politique of politiques.filter((p) => /\bON\s+(public\.)?marches\b(?!_)/i.test(p))) {
        expect(politique, fichier).toMatch(/auth\.uid\(\)/i)
      }
    }
  })
})
