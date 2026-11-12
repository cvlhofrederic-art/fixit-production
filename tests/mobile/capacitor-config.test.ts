// @vitest-environment node
// tests/mobile/capacitor-config.test.ts — invariants de l'appli Vitfix Pro (capacitor.config.ts et projets natifs).
// L'appli affiche le site (server.url) : une origine mal écrite, une page hors connexion absente ou un identifiant
// qui diffère d'un projet natif à l'autre ne se verraient qu'au lancement sur un téléphone.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import config from '@/capacitor.config'

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

const premiereCapture = (texte: string, motif: RegExp): string | undefined => motif.exec(texte)?.[1]

// Contenu du tableau qui suit une clé d'Info.plist (sans expression régulière à quantificateur paresseux).
const tableauPlist = (plist: string, cle: string): string => {
  const debutCle = plist.indexOf(`<key>${cle}</key>`)
  if (debutCle === -1) return ''
  const debut = plist.indexOf('<array>', debutCle)
  const fin = plist.indexOf('</array>', debut)
  return debut === -1 || fin === -1 ? '' : plist.slice(debut, fin)
}

const server = config.server ?? {}
const urlDepart = new URL(server.url ?? '')

describe('capacitor.config.ts — l’appli affiche l’espace mobile du site', () => {
  it('server.url est une origine https seule, sans chemin ni barre finale', () => {
    expect(urlDepart.protocol).toBe('https:')
    expect(urlDepart.hostname).toBe('vitfix.io')
    // Android tire de server.url la règle d'origine du pont JavaScript : un chemin la rendrait invalide.
    expect(server.url).toBe(urlDepart.origin)
  })

  it('le départ est l’espace mobile artisan, sans langue et avec la barre finale du site', () => {
    expect(server.appStartPath).toBe('/pro/mobile/')
  })

  it('ni trafic en clair, ni navigation élargie, ni débogage de la WebView', () => {
    expect(server.cleartext).not.toBe(true)
    expect(server.allowNavigation).toBeUndefined()
    expect(config.android?.allowMixedContent).toBe(false)
    expect(config.android?.webContentsDebuggingEnabled).toBe(false)
  })

  it('la page hors connexion existe dans webDir et renvoie au point de départ de l’appli', () => {
    const webDir = config.webDir ?? ''
    const errorPath = server.errorPath ?? ''
    expect(errorPath).not.toBe('')
    // cap sync exige un index.html dans webDir.
    expect(existsSync(join(process.cwd(), webDir, 'index.html'))).toBe(true)
    const page = lire(join(webDir, errorPath))
    expect(page).toContain(`href="${server.url}${server.appStartPath}"`)
    expect(page).toContain('<html lang="fr">')
  })

  it('iOS : un fichier local existe au chemin de départ, sinon l’appli quitte au lancement', () => {
    // CAPBridgeViewController.loadWebView contrôle appLocation + appStartPath même quand server.url est défini.
    const webDir = config.webDir ?? ''
    expect(existsSync(join(process.cwd(), webDir, server.appStartPath ?? '', 'index.html'))).toBe(true)
  })
})

describe('identité de l’appli identique dans les projets natifs', () => {
  const appId = config.appId ?? ''
  const appName = config.appName ?? ''

  it('nom et identifiant Vitfix Pro', () => {
    expect(appId).toBe('io.vitfix.pro')
    expect(appName).toBe('Vitfix Pro')
  })

  it('Android : namespace, applicationId, paquet de MainActivity et chaînes', () => {
    const gradle = lire('android/app/build.gradle')
    expect(premiereCapture(gradle, /namespace = "([^"]+)"/)).toBe(appId)
    expect(premiereCapture(gradle, /applicationId "([^"]+)"/)).toBe(appId)

    const cheminActivite = `android/app/src/main/java/${appId.split('.').join('/')}/MainActivity.java`
    expect(lire(cheminActivite)).toContain(`package ${appId};`)

    const chaines = lire('android/app/src/main/res/values/strings.xml')
    expect(premiereCapture(chaines, /<string name="app_name">([^<]+)<\/string>/)).toBe(appName)
    expect(premiereCapture(chaines, /<string name="package_name">([^<]+)<\/string>/)).toBe(appId)
  })

  it('iOS : bundle identifier de chaque configuration, nom affiché et domaine lié à l’appli', () => {
    const projet = lire('ios/App/App.xcodeproj/project.pbxproj')
    const identifiants = [...projet.matchAll(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g)].map((m) => m[1])
    expect(identifiants.length).toBeGreaterThan(0)
    expect(new Set(identifiants)).toEqual(new Set([appId]))

    const plist = lire('ios/App/App/Info.plist')
    expect(premiereCapture(plist, /<key>CFBundleDisplayName<\/key>\s*<string>([^<]+)<\/string>/)).toBe(appName)
    // limitsNavigationsToAppBoundDomains : sans l'hôte de server.url dans WKAppBoundDomains, iOS refuse de l'afficher.
    expect(config.ios?.limitsNavigationsToAppBoundDomains).toBe(true)
    expect(tableauPlist(plist, 'WKAppBoundDomains')).toContain(`<string>${urlDepart.hostname}</string>`)
    // La page hors connexion iOS est servie depuis capacitor://localhost : localhost (ou server.hostname) aussi.
    expect(tableauPlist(plist, 'WKAppBoundDomains')).toContain(`<string>${server.hostname ?? 'localhost'}</string>`)
  })

  it('plus aucune trace de l’ancien nom « Fixit » dans les fichiers d’identité', () => {
    for (const chemin of [
      'capacitor.config.ts',
      'android/app/build.gradle',
      'android/app/src/main/res/values/strings.xml',
      'ios/App/App/Info.plist',
      'ios/App/App.xcodeproj/project.pbxproj',
    ]) {
      expect(lire(chemin), chemin).not.toMatch(/fixit/i)
    }
  })
})
