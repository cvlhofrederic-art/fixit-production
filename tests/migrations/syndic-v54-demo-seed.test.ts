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
