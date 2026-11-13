/**
 * Garde-fous des parcours E2E AJ Signalement (PR 2, lot 6 ; SPEC § 2.11 et piège 13 de la PR 2).
 *
 * La CI de ce dépôt PUBLIC passe à Playwright les clés de la base réelle (NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY : .github/workflows/tests.yml) et publie le rapport HTML en artefact pendant 14 jours.
 * Aucune spec AJ Signalement ne doit donc se connecter ni écrire en base, ni garder une trace (traces, captures,
 * vidéos) : toutes les réponses /api/aj-signalement/** sont simulées par page.route (toute requête non prévue est
 * interrompue), et les seules données sont fictives (@exemple.test). Ce test lit le texte de chaque
 * e2e/aj-signalement-*.spec.ts et échoue si l'une de ces règles est enfreinte.
 *
 * PR 3, lot 10 (cahier § 10.1) : étendu à e2e/aj-signalement-desinscription.spec.ts (page publique de désinscription
 * des messages de diffusion) et à tous : aucun service d'e-mail (ni Resend, ni lib/email). La page de désinscription est
 * rendue par le serveur, qui lit le cabinet du chemin (langue, contact) : en CI, cette lecture part vers la base réelle.
 * Elle doit donc rester une LECTURE (aucune écriture, aucune fonction SQL), ce que le dernier bloc vérifie sur le code
 * de la page ; ses écritures (opposition, reprise, repli) passent par /api/aj-signalement/**, simulées.
 */
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

const DOSSIER_E2E = join(process.cwd(), 'e2e')
const specs = readdirSync(DOSSIER_E2E).filter((f) => /^aj-signalement-.*\.spec\.ts$/.test(f))
const texte = (fichier: string) => readFileSync(join(DOSSIER_E2E, fichier), 'utf8')
const lireRacine = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8').replace(/\r\n/g, '\n')

/** Corps d'une fonction exportée `export async function <nom>(` jusqu'à la première ligne `}` en colonne 0. */
function corpsFonction(source: string, nom: string): string {
  const debut = source.indexOf(`export async function ${nom}(`)
  if (debut < 0) return ''
  const fin = source.indexOf('\n}\n', debut)
  return source.slice(debut, fin < 0 ? undefined : fin + 2)
}

describe('specs E2E AJ Signalement', () => {
  it('au moins une spec existe (la page d’invitation et la connexion professionnelle sont parcourues)', () => {
    expect(specs).toContain('aj-signalement-gestionnaire.spec.ts')
  })

  it('la page publique de désinscription des messages de diffusion est parcourue (PR 3, cahier § 10.1)', () => {
    expect(specs).toContain('aj-signalement-desinscription.spec.ts')
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

    it('aucun service d’e-mail : ni Resend, ni lib/email, ni import du code de l’application', () => {
      expect(source).not.toMatch(/resend/i)
      expect(source).not.toMatch(/lib\/email|sendEmail|sendBatchEmails|envoyer(?:Lot|Diffusion)/)
      expect(source).not.toMatch(/from\s+['"]@\//)
      expect(source).not.toMatch(/smtp|sendgrid|mailgun|postmark|nodemailer/i)
    })
  })
})

describe('e2e/aj-signalement-desinscription.spec.ts : page sans coquille, aucune requête tierce', () => {
  const fichier = 'aj-signalement-desinscription.spec.ts'
  const source = specs.includes(fichier) ? texte(fichier) : ''

  it('toute requête hors du serveur testé est interrompue et notée (route « **/* » enregistrée AVANT la route de l’API)', () => {
    const toutes = source.indexOf("page.route('**/*'")
    const api = source.indexOf("page.route('**/api/aj-signalement/**'")
    expect(toutes).toBeGreaterThanOrEqual(0)
    // Playwright essaie les routes de la dernière enregistrée à la première : celle de l'API passe donc avant le filet.
    expect(api).toBeGreaterThan(toutes)
    expect(source).toMatch(/tierces\)\.toEqual\(\[\]\)/)
  })

  it('fragment effacé avant tout appel, no-referrer, ni audience ni bandeau de consentement, ni en-tête ni pied', () => {
    expect(source).toMatch(/replaceState|hashAuxAppels/)
    expect(source).toContain('no-referrer')
    expect(source).toMatch(/googletagmanager/)
    expect(source).toMatch(/cloudflareinsights/)
    expect(source).toMatch(/application\/ld\+json/)
    expect(source).toMatch(/locator\('header'\)/)
    expect(source).toMatch(/locator\('footer'\)/)
  })
})

describe('page parcourue par e2e/aj-signalement-desinscription.spec.ts : seule une lecture du cabinet côté serveur', () => {
  const page = lireRacine('app/(sans-coquille)/cabinet/[identifiant]/desinscription/page.tsx')
  const serveur = lireRacine('lib/aj-signalement/serveur-desinscription.ts')

  it('la page n’appelle que cabinetDuCheminDesinscriptionQr (aucun client de base, aucune route, aucun e-mail)', () => {
    const imports = [...page.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'([^']+)'/g)].map((m) => [m[2], m[1].replace(/\s+/g, ' ').trim()])
    expect(imports.filter(([module]) => module === '@/lib/aj-signalement/serveur-desinscription'))
      .toEqual([['@/lib/aj-signalement/serveur-desinscription', 'cabinetDuCheminDesinscriptionQr']])
    expect(page).not.toMatch(/supabase|@\/lib\/email|fetch\(/)
  })

  it('cabinetDuCheminDesinscriptionQr et lireCabinetDesinscriptionQr ne font qu’un select par identifiant', () => {
    const corps = `${corpsFonction(serveur, 'cabinetDuCheminDesinscriptionQr')}\n${corpsFonction(serveur, 'lireCabinetDesinscriptionQr')}`
    expect(corps).toContain('.select(')
    expect(corps).toContain(".eq('identifiant', identifiant)")
    expect(corps).not.toMatch(/\.(insert|update|upsert|delete|rpc)\(/)
    expect(corps).not.toMatch(/sendEmail|envoyer|journaliser(?!RepliDiffusionQr)/)
  })
})
