/**
 * Garde-fous des parcours E2E AJ Signalement (PR 2, lot 6 ; SPEC § 2.11 et piège 13 de la PR 2).
 *
 * La CI de ce dépôt PUBLIC passe à Playwright les clés de la base réelle (NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY : .github/workflows/tests.yml) et publie le rapport HTML en artefact pendant 14 jours.
 * Aucune spec AJ Signalement ne doit donc se connecter ni écrire en base, ni garder une trace (traces, captures,
 * vidéos) : toutes les réponses /api/aj-signalement/** sont simulées par page.route (toute requête non prévue est
 * interrompue), et les seules données sont fictives (@exemple.test). Ce test lit le texte de chaque
 * e2e/aj-signalement-*.spec.ts et échoue si l'une de ces règles est enfreinte.
 */
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

const DOSSIER_E2E = join(process.cwd(), 'e2e')
const specs = readdirSync(DOSSIER_E2E).filter((f) => /^aj-signalement-.*\.spec\.ts$/.test(f))
const texte = (fichier: string) => readFileSync(join(DOSSIER_E2E, fichier), 'utf8')

describe('specs E2E AJ Signalement', () => {
  it('au moins une spec existe (la page d’invitation et la connexion professionnelle sont parcourues)', () => {
    expect(specs).toContain('aj-signalement-gestionnaire.spec.ts')
  })

  describe.each(specs)('%s', (fichier) => {
    const source = texte(fichier)

    it('toutes les réponses /api/aj-signalement/** sont simulées, toute requête non prévue interrompue', () => {
      expect(source).toContain("page.route('**/api/aj-signalement/**'")
      expect(source).toContain('route.abort(')
    })

    it('ni trace, ni capture, ni vidéo (rapport publié en artefact)', () => {
      expect(source).toMatch(/trace:\s*'off'/)
      expect(source).toMatch(/screenshot:\s*'off'/)
      expect(source).toMatch(/video:\s*'off'/)
    })

    it('aucune adresse de production, aucune clé, aucun mot de passe de compte de test', () => {
      expect(source).not.toMatch(/vitfix\.io/i)
      expect(source).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
      expect(source).not.toMatch(/E2E_[A-Z_]*PASSWORD/)
      expect(source).not.toMatch(/process\.env/)
      expect(source).not.toMatch(/supabase\.co/i)
    })

    it('adresses e-mail fictives seulement (@exemple.test)', () => {
      const adresses = source.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []
      expect(adresses.length).toBeGreaterThan(0)
      for (const adresse of adresses) expect(adresse.endsWith('@exemple.test'), adresse).toBe(true)
    })

    it('aucune connexion ni écriture en base : pas de saisie de mot de passe sur la page de connexion, pas de client Supabase', () => {
      expect(source).not.toMatch(/@supabase\//)
      expect(source).not.toMatch(/signInWithPassword|createClient/)
    })
  })
})
