// @vitest-environment node
// Lot 4 Sentry du 28/10/2026 : les routes /api authentifiées par Bearer ne doivent plus être appelées par un
// fetch nu depuis le dashboard (AiChatBot, formulaire BTP). Garde-fou sur le source.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

describe('appels /api authentifiés par fetchAuthentifie', () => {
  it.each([
    ['components/chat/AiChatBot.tsx', ['/api/artisan-clients', '/api/fixy-ai']],
    ['components/DevisFactureFormBTP.tsx', ['/api/artisan-clients', '/api/service-etapes']],
  ])('%s n’appelle plus %s avec un fetch nu', (fichier, routes) => {
    const source = lire(fichier)
    expect(source).toContain("import { fetchAuthentifie } from '@/lib/fetch-authentifie'")
    for (const route of routes) {
      const fetchNu = new RegExp(`[^a-zA-Z]fetch\\((\`|')${route.replace(/\//g, '\\/')}`)
      expect(source, `${fichier} : fetch nu vers ${route}`).not.toMatch(fetchNu)
      expect(source).toContain(`fetchAuthentifie(\`${route}`.replace('`/api/fixy-ai', "'/api/fixy-ai").replace('`', route.includes('fixy') ? "'" : '`'))
    }
  })
})
