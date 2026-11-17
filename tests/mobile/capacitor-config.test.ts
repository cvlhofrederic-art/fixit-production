// @vitest-environment node
// tests/mobile/capacitor-config.test.ts — invariants de l'appli Vitfix Pro (capacitor.config.ts et projets natifs).
// L'appli affiche le site (server.url) : une origine mal écrite, une page hors connexion absente ou un identifiant
// qui diffère d'un projet natif à l'autre ne se verraient qu'au lancement sur un téléphone.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import config from '@/capacitor.config'
import { RETOUR_GOOGLE_APP_MOBILE, SCHEMA_APP_MOBILE } from '@/lib/auth/google-app-mobile'

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

  // Retour de « Continuer avec Google » : sans ces déclarations, le lien profond part au navigateur et
  // l'appli ne reçoit jamais la main — panne invisible tant qu'on n'ouvre pas Google sur un téléphone.
  it('le schéma de lien profond est l’identifiant de l’appli, déclaré sur les deux plateformes', () => {
    expect(SCHEMA_APP_MOBILE).toBe(appId)
    expect(RETOUR_GOOGLE_APP_MOBILE).toBe(`${appId}://auth/callback`)

    const manifeste = lire('android/app/src/main/AndroidManifest.xml')
    // Un seul et même intent-filter doit porter les quatre éléments : dispersés dans des filtres différents,
    // Android n'ouvrirait pas l'appli sur le lien, et des assertions mot à mot ne le verraient pas.
    const filtres = manifeste.split('<intent-filter>').slice(1).map((bloc) => bloc.split('</intent-filter>')[0])
    const filtreLien = filtres.find((bloc) => bloc.includes(`android:scheme="${appId}"`))
    expect(filtreLien, 'aucun intent-filter ne déclare le schéma de l’appli').toBeDefined()
    expect(filtreLien).toContain('android.intent.action.VIEW')
    expect(filtreLien).toContain('android.intent.category.DEFAULT')
    expect(filtreLien).toContain('android.intent.category.BROWSABLE')
    expect(filtreLien).toContain(`android:host="${new URL(RETOUR_GOOGLE_APP_MOBILE).host}"`)
    // singleTask : le lien profond revient dans l'instance ouverte (onNewIntent), sans seconde fenêtre.
    expect(manifeste).toContain('android:launchMode="singleTask"')

    const plist = lire('ios/App/App/Info.plist')
    expect(tableauPlist(plist, 'CFBundleURLSchemes')).toContain(`<string>${appId}</string>`)
  })

  // Le 13/11/2026, @capacitor/browser avait été ajouté côté Android seulement : sur iPhone le plugin n'aurait
  // pas été compilé et « Continuer avec Google » aurait levé. Les trois fichiers sont générés par cap sync et
  // suivis par git : un oubli de synchronisation ne se voit qu'au lancement sur un téléphone.
  it('les projets natifs déclarent tous les plugins Capacitor du package.json', () => {
    const paquets = Object.keys(JSON.parse(lire('package.json')).dependencies ?? {})
      .filter((nom) => nom.startsWith('@capacitor/'))
      .filter((nom) => !['@capacitor/core', '@capacitor/cli', '@capacitor/android', '@capacitor/ios'].includes(nom))
    expect(paquets.length).toBeGreaterThan(0)

    const settings = lire('android/capacitor.settings.gradle')
    const build = lire('android/app/capacitor.build.gradle')
    const spm = lire('ios/App/CapApp-SPM/Package.swift')

    for (const paquet of paquets) {
      const court = paquet.slice('@capacitor/'.length)
      const projet = `capacitor-${court}`
      const spmNom = 'Capacitor' + court.split('-').map((m) => m[0].toUpperCase() + m.slice(1)).join('')

      expect(settings, `${paquet} absent de capacitor.settings.gradle`).toContain(`include ':${projet}'`)
      expect(settings, `${paquet} : chemin inattendu`).toContain(`'../node_modules/${paquet}/android'`)
      expect(build, `${paquet} absent de capacitor.build.gradle`).toContain(`implementation project(':${projet}')`)
      expect(spm, `${paquet} absent du Package.swift iOS`).toContain(`.package(name: "${spmNom}"`)
      expect(spm, `${paquet} : produit absent de la cible iOS`).toContain(`.product(name: "${spmNom}"`)
    }
  })

  // L'icône de l'App Store ne doit pas avoir de couche de transparence : Apple rejette l'envoi, et le
  // message arrive après coup, une fois l'archive déposée. Lecture de l'en-tête IHDR du PNG, sans dépendance.
  it('icônes : l’icône App Store est opaque, l’avant-plan Android garde sa transparence', () => {
    const entete = (chemin: string) => {
      const b = readFileSync(join(process.cwd(), chemin))
      return { largeur: b.readUInt32BE(16), hauteur: b.readUInt32BE(20), typeCouleur: b[25] }
    }
    const AVEC_ALPHA = [4, 6] // 4 = gris + alpha, 6 = RVB + alpha

    const appStore = entete('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png')
    expect(appStore).toMatchObject({ largeur: 1024, hauteur: 1024 })
    expect(AVEC_ALPHA, 'transparence interdite sur l’icône App Store').not.toContain(appStore.typeCouleur)

    for (const densite of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
      const carre = entete(`android/app/src/main/res/mipmap-${densite}/ic_launcher.png`)
      expect(AVEC_ALPHA, `mipmap-${densite}/ic_launcher.png`).not.toContain(carre.typeCouleur)
      // L'icône adaptative découpe l'avant-plan : sans transparence, le lanceur affiche un carré plein.
      const avant = entete(`android/app/src/main/res/mipmap-${densite}/ic_launcher_foreground.png`)
      expect(AVEC_ALPHA, `mipmap-${densite}/ic_launcher_foreground.png`).toContain(avant.typeCouleur)
    }

    // Le fond de l'icône adaptative doit être celui du monogramme, sinon un liseré apparaît au découpage.
    const fond = lire('android/app/src/main/res/values/ic_launcher_background.xml')
    expect(premiereCapture(fond, /<color name="ic_launcher_background">([^<]+)<\/color>/)?.toUpperCase()).toBe('#FFFFFF')
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
