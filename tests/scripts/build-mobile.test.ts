// @vitest-environment node
/**
 * scripts/build-mobile.sh remplace next.config.ts par une configuration d'export le temps de `npm run build`.
 *
 * Avant le correctif, la restauration était une ligne placée après le build : sous `set -e`, un build en échec
 * faisait sortir le script avant elle, et le dépôt gardait la configuration d'export (sans rewrites, redirects,
 * en-têtes ni Sentry) plus une copie next.config.backup.ts non ignorée par git. Ces tests exécutent le vrai script
 * dans un dossier temporaire, avec `npm` et `npx` remplacés par des doublures qui journalisent leurs appels.
 */
import { spawnSync } from 'node:child_process'
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const SCRIPT = resolve(__dirname, '../../scripts/build-mobile.sh')
const CONFIG_WEB = "// configuration web d'origine\nexport default { trailingSlash: true }\n"

let dossier: string

function ecrireExecutable(chemin: string, contenu: string) {
  writeFileSync(chemin, contenu)
  chmodSync(chemin, 0o755)
}

function lancer(options: { buildReussi: boolean }) {
  const env: NodeJS.ProcessEnv = { ...process.env, FAKE_BUILD_EXIT: options.buildReussi ? '0' : '1' }
  // Sous Windows la clé s'écrit « Path » : la remplacer plutôt que d'en ajouter une seconde.
  const clePath = Object.keys(env).find((cle) => cle.toUpperCase() === 'PATH') ?? 'PATH'
  env[clePath] = `${join(dossier, 'bin')}${delimiter}${env[clePath] ?? ''}`
  return spawnSync('bash', ['scripts/build-mobile.sh', 'android'], { cwd: dossier, env, encoding: 'utf8' })
}

function appels(): string[] {
  const journal = join(dossier, 'appels.log')
  return existsSync(journal) ? readFileSync(journal, 'utf8').trim().split('\n') : []
}

beforeEach(() => {
  dossier = mkdtempSync(join(tmpdir(), 'build-mobile-'))
  mkdirSync(join(dossier, 'scripts'))
  mkdirSync(join(dossier, 'bin'))
  copyFileSync(SCRIPT, join(dossier, 'scripts/build-mobile.sh'))
  ecrireExecutable(join(dossier, 'scripts/check-mobile-compat.sh'), '#!/bin/bash\nexit 0\n')
  writeFileSync(join(dossier, 'next.config.ts'), CONFIG_WEB)
  // Doublure de npm : journalise l'appel, garde la configuration vue pendant le build, puis réussit ou échoue.
  ecrireExecutable(
    join(dossier, 'bin/npm'),
    '#!/bin/bash\necho "npm $*" >> appels.log\ncp next.config.ts config-pendant-build.ts\nexit "$FAKE_BUILD_EXIT"\n',
  )
  ecrireExecutable(join(dossier, 'bin/npx'), '#!/bin/bash\necho "npx $*" >> appels.log\nexit 0\n')
})

afterEach(() => {
  rmSync(dossier, { recursive: true, force: true })
})

describe('scripts/build-mobile.sh — restauration de next.config.ts', () => {
  it('restaure next.config.ts et ne laisse aucune copie quand le build Next échoue', () => {
    const resultat = lancer({ buildReussi: false })

    expect(resultat.status).not.toBe(0)
    expect(readFileSync(join(dossier, 'config-pendant-build.ts'), 'utf8')).toContain("output: 'export'")
    expect(readFileSync(join(dossier, 'next.config.ts'), 'utf8')).toBe(CONFIG_WEB)
    expect(existsSync(join(dossier, 'next.config.backup.ts'))).toBe(false)
    expect(appels()).toEqual(['npm run build'])
  })

  it('restaure next.config.ts avant de synchroniser Capacitor quand le build réussit', () => {
    const resultat = lancer({ buildReussi: true })

    expect(resultat.status, resultat.stderr).toBe(0)
    expect(readFileSync(join(dossier, 'config-pendant-build.ts'), 'utf8')).toContain("output: 'export'")
    expect(readFileSync(join(dossier, 'next.config.ts'), 'utf8')).toBe(CONFIG_WEB)
    expect(existsSync(join(dossier, 'next.config.backup.ts'))).toBe(false)
    expect(appels()).toEqual(['npm run build', 'npx cap sync', 'npx cap open android'])
  })

  it("refuse de démarrer si une copie d'un build interrompu traîne encore, sans toucher à la configuration", () => {
    const copieOrpheline = "// copie laissée par un build précédent\nexport default {}\n"
    writeFileSync(join(dossier, 'next.config.backup.ts'), copieOrpheline)

    const resultat = lancer({ buildReussi: true })

    expect(resultat.status).not.toBe(0)
    expect(resultat.stderr).toContain('next.config.backup.ts')
    expect(readFileSync(join(dossier, 'next.config.ts'), 'utf8')).toBe(CONFIG_WEB)
    expect(readFileSync(join(dossier, 'next.config.backup.ts'), 'utf8')).toBe(copieOrpheline)
    expect(appels()).toEqual([])
  })
})
