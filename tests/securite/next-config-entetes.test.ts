/**
 * En-têtes que Next et OpenNext posent d'eux-mêmes, hors headers() de next.config.ts : « x-powered-by: Next.js »
 * (pages HTML, next/dist/server/send-payload.js) et « x-opennext: 1 » (@opennextjs/aws core/routing/util.js) dépendent
 * tous deux de poweredByHeader. On vérifie la configuration réellement exportée, après withSentryConfig.
 * Espaces privés (succursale AJ, espace AJ Signalement) : X-Robots-Tag sur leurs pages rendues.
 */
import { describe, expect, it } from 'vitest'
import configurationNext from '@/next.config'
import { SOURCE_IDENTIFIANT_CABINET_QR } from '@/lib/aj-signalement/chemin-cabinet'

describe('next.config.ts : en-têtes du framework', () => {
  it('désactive poweredByHeader, y compris après withSentryConfig', () => {
    expect(configurationNext.poweredByHeader).toBe(false)
  })
})

type RegleEntetes = { source: string; headers: Array<{ key: string; value: string }> }

describe('next.config.ts : espaces jamais indexables', () => {
  const robotsDe = async (source: string): Promise<string | undefined> => {
    const regles: RegleEntetes[] = (await configurationNext.headers?.()) ?? []
    return regles.find((regle) => regle.source === source)?.headers.find((entete) => entete.key === 'X-Robots-Tag')?.value
  }

  it.each(['/:locale(fr|pt)/aj-signalement/:path*', '/aj-signalement/:path*'])('espace AJ Signalement (%s) : noindex', async (source) => {
    expect(await robotsDe(source)).toBe('noindex, nofollow, noarchive')
  })

  it.each(['/:locale(fr|pt)/administrateur-judiciaire/:path*', '/administrateur-judiciaire/:path*'])('succursale AJ (%s) : inchangée', async (source) => {
    expect(await robotsDe(source)).toBe('noindex, nofollow, noarchive')
  })

  // Chemin public d'un cabinet client (vitfix.io/<identifiant>/…) et ses pages internes : le jeton est l'adresse du
  // formulaire, jamais indexée (le middleware pose aussi l'en-tête, OpenNext n'ajoutant pas headers() à ses réponses).
  it.each([
    `/:identifiant(${SOURCE_IDENTIFIANT_CABINET_QR})/signalement/:path*`,
    `/:identifiant(${SOURCE_IDENTIFIANT_CABINET_QR})/confirmation-adresse/:path*`,
    // Ouverture de l'accès d'un gestionnaire (PR 2, lot 3).
    `/:identifiant(${SOURCE_IDENTIFIANT_CABINET_QR})/invitation/:path*`,
    '/cabinet/:path*',
  ])('chemin public d’un cabinet (%s) : noindex', async (source) => {
    expect(await robotsDe(source)).toBe('noindex, nofollow, noarchive')
  })
})
