// @vitest-environment node
// tests/mobile/chaine-publication.test.ts — invariants des deux chaînes d'envoi vers les stores.
// Ces workflows ne tournent que sur demande : une dérive ne se verrait qu'au moment d'envoyer une version,
// trop tard. Les pièges couverts ici ont tous un coût réel — archive impossible sans schéma partagé, signature
// de développement refusée par App Store Connect, versionCode figé que la Play Console rejette au deuxième
// envoi, binaire signé publié en artefact sur un dépôt public.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import config from '@/capacitor.config'

// Fins de ligne normalisées : le dépôt est en core.autocrlf=true, donc ces fichiers arrivent en CRLF sur le
// poste Windows de Frédéric et en LF sur les runners. Sans cela, les assertions multilignes passeraient en CI
// et échoueraient chez lui dès le premier checkout.
const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8').replace(/\r\n/g, '\n')

// Les commentaires de ces workflows citent les options qu'ils expliquent (« -allowProvisioningUpdates »…) :
// les retirer avant de découper le fichier, sinon une assertion tombe sur le commentaire et non sur la commande.
const sansCommentaires = (texte: string) =>
  texte
    .split('\n')
    .filter((ligne) => !/^\s*#/.test(ligne))
    .join('\n')

const SCHEMA = 'ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme'
const PROJET = 'ios/App/App.xcodeproj/project.pbxproj'
const GRADLE = 'android/app/build.gradle'
const WF_IOS = '.github/workflows/mobile-ios.yml'
const WF_ANDROID = '.github/workflows/mobile-android-release.yml'

// Contenu de la section nommée d'un project.pbxproj.
const section = (projet: string, nom: string): string => {
  const debut = projet.indexOf(`/* Begin ${nom} section */`)
  const fin = projet.indexOf(`/* End ${nom} section */`)
  return debut === -1 || fin === -1 ? '' : projet.slice(debut, fin)
}

// Contenu d'un bloc XCBuildConfiguration repéré par son nom de configuration, dans la section donnée.
const blocsConfiguration = (projet: string, nom: string): string[] =>
  section(projet, 'XCBuildConfiguration')
    .split('isa = XCBuildConfiguration;')
    .slice(1)
    .filter((bloc) => new RegExp(`name = ${nom};`).test(bloc))

describe('iPhone — l’archive doit être fabricable sur un runner sans Xcode ouvert', () => {
  it('le schéma App est partagé et suivi par git', () => {
    // Xcode fabrique les schémas dans xcuserdata, qui n'est pas suivi : sans ce fichier, xcodebuild échoue
    // par « scheme not found » et aucune archive n'est produite.
    expect(existsSync(join(process.cwd(), SCHEMA))).toBe(true)
  })

  it('le schéma vise bien la cible App du projet et archive en Release', () => {
    const schema = lire(SCHEMA)
    const identifiant = /BlueprintIdentifier = "([0-9A-F]+)"/.exec(schema)?.[1]
    expect(identifiant, 'aucun BlueprintIdentifier dans le schéma').toBeDefined()

    // L'identifiant doit désigner une vraie cible native du projet, sinon le schéma pointe dans le vide.
    const cibles = section(lire(PROJET), 'PBXNativeTarget')
    expect(cibles).toContain(`${identifiant} /* App */`)

    expect(schema).toMatch(/<ArchiveAction[^>]*\n?\s*buildConfiguration = "Release"/)
    expect(schema).toContain('buildForArchiving = "YES"')
  })

  it('la configuration Release ne fige aucune identité de signature', () => {
    // La signature est automatique : Xcode choisit lui-même le certificat sur le runner. Toute identité
    // figée le met en conflit et l'archive s'arrête sur « App has conflicting provisioning settings » —
    // constaté au premier envoi TestFlight du 22/11/2026, avec « Apple Distribution » comme avec
    // « iPhone Developer », la valeur du gabarit Capacitor.
    for (const bloc of blocsConfiguration(lire(PROJET), 'Release')) {
      expect(bloc).not.toContain('CODE_SIGN_IDENTITY')
    }
  })

  it('aucun identifiant d’équipe Apple n’est écrit dans le dépôt public', () => {
    // Il arrive par secret au moment du build (DEVELOPMENT_TEAM sur la ligne de commande xcodebuild).
    expect(lire(PROJET)).not.toContain('DEVELOPMENT_TEAM')
    expect(lire(WF_IOS)).toContain('DEVELOPMENT_TEAM="$APPLE_TEAM_ID"')
  })

  it('l’archive est fabriquée sans signature, qui n’a lieu qu’à l’export', () => {
    // En signature automatique, `xcodebuild archive` réclame un profil « iOS App Development », qu'Apple
    // refuse à une équipe sans appareil enregistré — ce qu'un runner n'a jamais : « Your team has no devices
    // from which to generate a provisioning profile » (second envoi raté, 23/11/2026). Le profil App Store,
    // lui, ne contient aucun appareil : la signature se fait donc une seule fois, à l'export.
    // Bornes prises sur les noms d'étapes, dans un fichier dont les commentaires ont été retirés.
    const workflow = sansCommentaires(lire(WF_IOS))
    const debutArchive = workflow.indexOf("- name: Archiver l'application")
    const debutExport = workflow.indexOf('- name: Exporter et envoyer sur TestFlight')
    expect(debutArchive, 'étape d’archivage absente').toBeGreaterThan(-1)
    expect(debutExport, 'étape d’export absente, ou placée avant l’archivage').toBeGreaterThan(debutArchive)

    const archive = workflow.slice(debutArchive, debutExport)
    expect(archive).toContain('CODE_SIGNING_ALLOWED=NO')
    expect(archive).not.toContain('-allowProvisioningUpdates')

    const exportation = workflow.slice(debutExport)
    expect(exportation).toContain('-allowProvisioningUpdates')
    expect(exportation).toContain('-authenticationKeyPath')
  })

  it('la conformité au chiffrement est déclarée, sinon TestFlight bloque chaque build', () => {
    // Sans cette clé, l'archive arrive bien sur App Store Connect mais reste en « Conformité manquante » :
    // les testeurs internes ne voient rien tant que le questionnaire n'est pas rempli à la main, build par build.
    const plist = lire('ios/App/App/Info.plist')
    expect(plist).toMatch(/<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/)
  })

  it('le guide prescrit le rôle Admin pour la clé d’API, seul à ouvrir les certificats', () => {
    // App Manager compile puis échoue sur « cloud-managed distribution certificates ».
    const guide = lire('MOBILE_GUIDE.md')
    expect(guide).toContain('rôle **Admin**')
    expect(guide).not.toContain('rôle **App Manager**')
  })

  it('le guide donne la commande openssl utilisable dans Git Bash', () => {
    // Sans MSYS_NO_PATHCONV=1, Git Bash réécrit le -subj en chemin Windows et le certificat sort faux.
    const guide = lire('MOBILE_GUIDE.md')
    expect(guide).toMatch(/MSYS_NO_PATHCONV=1 openssl req/)
  })
})

describe('Android — le bundle doit être signé et numéroté par la CI', () => {
  const gradle = lire(GRADLE)

  it('le versionCode vient de l’environnement, pas d’une constante', () => {
    // La Play Console refuse un versionCode déjà envoyé : figé à 1, le deuxième dépôt échoue.
    expect(gradle).toContain('System.getenv("ANDROID_VERSION_CODE")')
    expect(gradle).not.toMatch(/versionCode\s+\d+/)
  })

  it('la clé d’envoi vient de l’environnement et sert au type release', () => {
    expect(gradle).toContain('System.getenv("ANDROID_KEYSTORE_FILE")')
    expect(gradle).toContain('signingConfig signingConfigs.release')
    // Aucun chemin ni mot de passe en clair dans le dépôt.
    expect(gradle).not.toMatch(/storePassword\s+["']/)
    expect(gradle).not.toMatch(/keyPassword\s+["']/)
  })

  it('le workflow envoie sur l’identifiant d’application de capacitor.config.ts', () => {
    expect(lire(WF_ANDROID)).toContain(`PLAY_PACKAGE_NAME: ${config.appId}`)
  })

  it('le statut d’envoi est réglable et vaut draft par défaut', () => {
    // Tant que l'appli n'a jamais été publiée, Google refuse une version « completed » : le premier envoi
    // doit arriver en brouillon, sans quoi le dépôt échoue après la construction du bundle.
    const workflow = lire(WF_ANDROID)
    expect(workflow).toContain('PLAY_STATUS: ${{ inputs.statut }}')
    expect(workflow).toContain('options: [draft, completed]')
    // Bloc de l'entrée « statut » isolé par index, et non par une expression régulière à quantificateurs
    // imbriqués : celle-ci partait en retour sur trace exponentiel (CodeQL, « Inefficient regular expression »).
    const debut = workflow.indexOf('      statut:')
    const fin = workflow.indexOf('      notes:')
    expect(debut, 'entrée « statut » absente du workflow').toBeGreaterThan(-1)
    expect(fin, 'entrée « notes » absente après « statut »').toBeGreaterThan(debut)
    expect(workflow.slice(debut, fin)).toContain('default: draft')
  })
})

describe('les deux workflows d’envoi respectent les règles CI du dépôt', () => {
  for (const chemin of [WF_IOS, WF_ANDROID]) {
    describe(chemin, () => {
      const workflow = lire(chemin)

      it('ne tourne que sur demande', () => {
        // Un déclenchement sur PR consommerait un numéro de version à chaque poussée.
        expect(workflow).toContain('workflow_dispatch:')
        expect(workflow).not.toMatch(/^\s{2}(pull_request|push|schedule):/m)
      })

      it('part sans aucune permission, et n’accorde que la lecture au job', () => {
        expect(workflow).toContain('permissions: {}')
        expect(workflow).toContain('contents: read')
      })

      it('épingle chaque action par un SHA de commit', () => {
        const versions = [...workflow.matchAll(/uses: [^@\s]+@(\S+)/g)].map((m) => m[1])
        expect(versions.length).toBeGreaterThan(0)
        for (const version of versions) expect(version).toMatch(/^[0-9a-f]{40}$/)
      })

      it('ne publie aucun binaire signé en artefact', () => {
        // Les artefacts d'un dépôt public sont téléchargeables par n'importe qui.
        expect(workflow).not.toContain('upload-artifact')
      })

      it('efface le matériel de signature même quand le job échoue', () => {
        expect(workflow).toMatch(/if: always\(\)\n\s+run: rm -/)
      })
    })
  }
})
