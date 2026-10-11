import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

/**
 * Seeds SQL manuels (supabase/seed) : aucune donnée personnelle versionnée.
 *
 * syndic-v54-demo-seed.sql ciblait le compte à peupler par l'e-mail de connexion réel du
 * super admin, et nommait le propriétaire comme gestionnaire des édifices. Le compte cible
 * est désormais un paramètre documenté (<EMAIL_COMPTE_DEMO>, à remplacer par l'e-mail du
 * compte de démo) et le gestionnaire un nom fictif. Sans remplacement, le garde existant
 * (« Compte introuvable ») arrête le script avant toute insertion.
 */

const DOSSIER = join(process.cwd(), 'supabase', 'seed')
const lire = (nom: string): string => readFileSync(join(DOSSIER, nom), 'utf-8')
const SEEDS = readdirSync(DOSSIER).filter((nom) => nom.endsWith('.sql'))

describe('Seeds SQL — aucune donnée personnelle', () => {
  it('parcourt les seeds du dossier', () => {
    expect(SEEDS).toContain('syndic-v54-demo-seed.sql')
  })

  it.each(SEEDS)('%s : ni adresse e-mail personnelle ni prénom du propriétaire', (nom) => {
    const sql = lire(nom)
    expect(sql).not.toMatch(/admincvlho|cvlho|@gmail\.com/i)
    expect(sql).not.toMatch(/Fr[ée]d[ée]ric/i)
  })
})

describe('syndic-v54-demo-seed.sql — compte de démo en paramètre', () => {
  const sql = lire('syndic-v54-demo-seed.sql')
  const debutBloc = sql.indexOf('DO $$')

  it("résout le cabinet par le paramètre <EMAIL_COMPTE_DEMO>, documenté dans l'en-tête", () => {
    expect(sql).toContain("SELECT id INTO v_cab FROM auth.users WHERE email = '<EMAIL_COMPTE_DEMO>' LIMIT 1;")
    expect(debutBloc).toBeGreaterThan(0)
    expect(sql.slice(0, debutBloc)).toMatch(/<EMAIL_COMPTE_DEMO>.*e-mail du compte de démo/)
  })

  it("s'arrête avant toute insertion tant que le paramètre n'est pas remplacé", () => {
    const garde = sql.indexOf("RAISE EXCEPTION 'Compte introuvable")
    expect(garde).toBeGreaterThan(sql.indexOf('WHERE email ='))
    expect(garde).toBeLessThan(sql.indexOf('INSERT INTO'))
    expect(sql.slice(garde, sql.indexOf('\n', garde))).toContain('<EMAIL_COMPTE_DEMO>')
  })

  it('les trois édifices ont un gestionnaire fictif', () => {
    expect(sql.match(/'Gabinete Vitfix Portugal'/g)).toHaveLength(3)
  })
})

/**
 * syndic-v54-demo-seed-fr.sql (démo client française) : même mécanique et mêmes tables que le
 * seed portugais. Il n'a jamais tourné en local (pas de Postgres sur le poste) : ces contrôles
 * textuels attrapent les régressions de structure avant qu'il ne soit lancé en production.
 */
describe('syndic-v54-demo-seed-fr.sql — structure alignée sur le seed portugais', () => {
  const sqlFr = lire('syndic-v54-demo-seed-fr.sql')
  const sqlPt = lire('syndic-v54-demo-seed.sql')
  /** Colonnes de chaque INSERT, par table (première occurrence). */
  const colonnes = (sql: string): Record<string, string> => {
    const parTable: Record<string, string> = {}
    for (const m of sql.matchAll(/^\s*INSERT INTO (\w+) \(([^)]*)\)/gm)) parTable[m[1]] ??= m[2].replace(/\s+/g, ' ').trim()
    return parTable
  }
  const premierInsert = sqlFr.search(/^\s*INSERT INTO/m)

  it('résout le cabinet par <EMAIL_COMPTE_DEMO> et s’arrête avant toute insertion sans remplacement', () => {
    expect(sqlFr).toContain("SELECT id INTO v_cab FROM auth.users WHERE email = '<EMAIL_COMPTE_DEMO>' LIMIT 1;")
    const garde = sqlFr.indexOf("RAISE EXCEPTION 'Compte introuvable")
    expect(garde).toBeGreaterThan(0)
    expect(garde).toBeLessThan(premierInsert)
  })

  it('refuse d’être appliqué deux fois sur le même cabinet (garde avant le premier INSERT)', () => {
    const garde = sqlFr.indexOf("RAISE EXCEPTION 'Seed FR déjà appliqué")
    expect(garde).toBeGreaterThan(0)
    expect(garde).toBeLessThan(premierInsert)
  })

  it('mêmes tables et mêmes colonnes que le seed portugais (plus la ligne cabinet du pré-contrôle)', () => {
    const fr = colonnes(sqlFr)
    const pt = colonnes(sqlPt)
    expect(Object.keys(fr).sort()).toEqual([...Object.keys(pt), 'syndic_cabinets'].sort())
    for (const table of Object.keys(pt)) expect(fr[table], table).toBe(pt[table])
  })

  it('factures : numéros uniques et TTC = HT × (1 + TVA)', () => {
    const lignes = [...sqlFr.matchAll(/'FC-' \|\| v_annee \|\| '-(\d{4})', [^,]+(?:,[^,]+)?, [^,]+(?:,[^,]+)?, ([\d.]+), (\d+), ([\d.]+), '/g)]
    expect(lignes.length).toBe(17)
    expect(new Set(lignes.map((l) => l[1])).size).toBe(lignes.length)
    for (const [, numero, ht, tva, ttc] of lignes) {
      expect(Number(ttc), `FC-${numero}`).toBeCloseTo(Math.round(Number(ht) * (1 + Number(tva) / 100) * 100) / 100, 2)
    }
  })

  it('statuts des impayés et des factures autorisés par les CHECK (20260516_lea_compta_tables.sql)', () => {
    /** Corps d'un INSERT (jusqu'au « ; » de fin de ligne). */
    const bloc = (table: string) => {
      const debutBloc = sqlFr.indexOf(`INSERT INTO ${table} `)
      return sqlFr.slice(debutBloc, sqlFr.indexOf(');', debutBloc) + 2)
    }
    const derniersChamps = (table: string) =>
      [...bloc(table).matchAll(/'([a-z_]+)'(?:, '[^']*')?\)[,;]/g)].map((m) => m[1])
    const statutsFactures = derniersChamps('syndic_factures_copro')
    expect(statutsFactures).toHaveLength(17)
    statutsFactures.forEach((s) => expect(['a_regler', 'partiellement_regle', 'reglee', 'contestee', 'annulee']).toContain(s))
    const statutsImpayes = [...bloc('syndic_impayes').matchAll(/, \d+, '([a-z_]+)', '/g)].map((m) => m[1])
    expect(statutsImpayes).toHaveLength(6)
    statutsImpayes.forEach((s) => expect(['ouvert', 'en_recouvrement', 'solde', 'passe_perte']).toContain(s))
  })
})
