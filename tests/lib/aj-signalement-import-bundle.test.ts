// tests/lib/aj-signalement-import-bundle.test.ts
//
// Garde de taille du Worker Cloudflare (SPEC § 1.9.2, consigne de la PR 1) : fflate, jsPDF et qrcode ne sont chargés
// que dans le navigateur, par await import() au moment du clic, jamais dans le bundle serveur. Le lecteur .xlsx et le
// modèle (seuls utilisateurs de fflate) ne sont importés ni par une route, ni par une page serveur, ni par les modules
// purs que le serveur importe (ligne.ts, csv.ts, export-csv.ts). Lecture du TEXTE des fichiers.
// Et fflate 0.8.3 est déclaré en dépendance directe à la version exacte déjà verrouillée (dépendance de jsPDF) : même
// intégrité dans package-lock.json qu'avant la PR.

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const RACINE = process.cwd()
const lire = (chemin: string) => readFileSync(join(RACINE, chemin), 'utf8')

function fichiersSous(dossier: string): string[] {
  const absolu = join(RACINE, dossier)
  const sortie: string[] = []
  for (const nom of readdirSync(absolu)) {
    const chemin = join(absolu, nom)
    if (statSync(chemin).isDirectory()) sortie.push(...fichiersSous(relative(RACINE, chemin)))
    else if (/\.(ts|tsx)$/.test(nom)) sortie.push(relative(RACINE, chemin).replace(/\\/g, '/'))
  }
  return sortie
}

/** Importe (statiquement OU par import()) l'un de ces modules. */
const importe = (texte: string, nom: string): boolean =>
  new RegExp(`(?:from\\s+|import\\s*\\(\\s*|require\\s*\\(\\s*)['"][^'"]*${nom.replace(/[/.]/g, (c) => `\\${c}`)}['"]`).test(texte)

const LOURDS = ['fflate', 'jspdf', 'qrcode', 'import/lecteur-xlsx', 'import/modele-xlsx']

describe('bundle serveur : aucune bibliothèque lourde de l’import', () => {
  const serveur = [
    ...fichiersSous('app/api'),
    ...fichiersSous('app/(commun)/aj-signalement'),
    ...fichiersSous('app/(commun)/signalement'),
    ...fichiersSous('app/(commun)/cabinet'),
    'middleware.ts',
    'lib/validation.ts',
    'lib/aj-signalement/serveur.ts',
    'lib/aj-signalement/serveur-gestion.ts',
    'lib/aj-signalement/email.ts',
    'lib/aj-signalement/import/ligne.ts',
    'lib/aj-signalement/import/textes.ts',
    'lib/aj-signalement/import/csv.ts',
    'lib/aj-signalement/import/export-csv.ts',
  ]

  it('la liste contrôlée contient bien la route d’import', () => {
    expect(serveur).toContain('app/api/aj-signalement/coproprietes/import/route.ts')
  })

  it.each(serveur)('%s n’importe ni fflate, ni jspdf, ni qrcode, ni le lecteur .xlsx, ni le modèle', (fichier) => {
    const texte = lire(fichier)
    for (const lourd of LOURDS) expect(importe(texte, lourd), `${fichier} → ${lourd}`).toBe(false)
  })

  it('aucun fichier de app/ n’importe fflate ni le lecteur .xlsx ou le modèle', () => {
    for (const fichier of fichiersSous('app')) {
      const texte = lire(fichier)
      for (const lourd of ['fflate', 'import/lecteur-xlsx', 'import/modele-xlsx']) expect(importe(texte, lourd), `${fichier} → ${lourd}`).toBe(false)
    }
  })
})

describe('navigateur : chargement au clic seulement', () => {
  it.each(['lib/aj-signalement/import/lecteur-xlsx.ts', 'lib/aj-signalement/import/modele-xlsx.ts'])('%s charge fflate par await import(), jamais statiquement', (fichier) => {
    const texte = lire(fichier)
    expect(texte).toMatch(/await import\('fflate'\)/)
    expect(texte).not.toMatch(/from\s+['"]fflate['"]/)
  })

  it('qr.ts charge jsPDF et qrcode par await import(), jamais statiquement', () => {
    const texte = lire('lib/aj-signalement/qr.ts')
    expect(texte).toMatch(/await import\('jspdf'\)/)
    expect(texte).toMatch(/await import\('qrcode'\)/)
    expect(texte).not.toMatch(/from\s+['"](?:jspdf|qrcode)['"]/)
  })

  it('l’assistant d’import charge le lecteur et le modèle au clic (aucun import statique)', () => {
    const texte = lire('components/aj-signalement/AssistantImportQr.tsx')
    expect(texte).not.toMatch(/from\s+['"][^'"]*import\/(?:lecteur|modele)-xlsx['"]/)
    expect(texte).toMatch(/await import\('@\/lib\/aj-signalement\/import\/lecteur-xlsx'\)/)
    expect(texte).toMatch(/await import\('@\/lib\/aj-signalement\/import\/modele-xlsx'\)/)
  })
})

describe('dépendance fflate', () => {
  const paquet = JSON.parse(lire('package.json')) as { dependencies: Record<string, string>; devDependencies?: Record<string, string> }
  const verrou = JSON.parse(lire('package-lock.json')) as { packages: Record<string, { version?: string; integrity?: string; dependencies?: Record<string, string>; dev?: boolean }> }

  it('déclarée en dépendance directe, version EXACTE 0.8.3', () => {
    expect(paquet.dependencies.fflate).toBe('0.8.3')
    expect(paquet.devDependencies?.fflate).toBeUndefined()
    expect(verrou.packages[''].dependencies?.fflate).toBe('0.8.3')
  })

  it('verrou inchangé : même version, même intégrité qu’avant la PR (dépendance de production de jsPDF)', () => {
    expect(verrou.packages['node_modules/fflate']).toMatchObject({
      version: '0.8.3',
      integrity: 'sha512-tbZNuJrLwGUp3zshBtdy4W+ORxZuIh8a5ilyIEQDC5rY1f3U20JMry0Ll3WBzU58EZKsEuJFXhb5gwv8CsPvgA==',
    })
    expect(verrou.packages['node_modules/fflate'].dev).toBeUndefined()
    expect(verrou.packages['node_modules/jspdf'].dependencies?.fflate).toBe('^0.8.1')
  })
})
