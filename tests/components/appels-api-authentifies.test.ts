// @vitest-environment node
// Lot 4 Sentry du 28/10/2026 : les routes /api authentifiées par Bearer ne doivent plus être appelées par un
// fetch nu depuis le dashboard (AiChatBot, formulaire BTP). Garde-fou sur le source.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')
// Échappement complet pour construire une expression régulière à partir d'un chemin (CodeQL js/incomplete-sanitization).
const echapper = (texte: string) => texte.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

describe('appels /api authentifiés par fetchAuthentifie', () => {
  it.each([
    ['components/chat/AiChatBot.tsx', ['/api/artisan-clients', '/api/fixy-ai']],
    ['components/DevisFactureFormBTP.tsx', ['/api/artisan-clients']],
  ])('%s n’appelle plus %s avec un fetch nu', (fichier, routes) => {
    const source = lire(fichier)
    expect(source).toContain("import { fetchAuthentifie } from '@/lib/fetch-authentifie'")
    for (const route of routes) {
      const fetchNu = new RegExp(`[^a-zA-Z]fetch\\((\`|')${echapper(route)}`)
      expect(source, `${fichier} : fetch nu vers ${route}`).not.toMatch(fetchNu)
      const fetchAuthentifie = new RegExp(`fetchAuthentifie\\((\`|')${echapper(route)}`)
      expect(source, `${fichier} : appel authentifié vers ${route}`).toMatch(fetchAuthentifie)
    }
  })

  // /api/service-etapes authentifie par les cookies (@supabase/ssr, app/api/service-etapes/route.ts), pas par
  // Bearer : le formulaire BTP garde l'appel d'origine, comme DevisFactureForm.tsx et ServiceEtapesEditor.tsx.
  it('components/DevisFactureFormBTP.tsx garde le fetch d’origine vers /api/service-etapes (authentification par les cookies)', () => {
    const source = lire('components/DevisFactureFormBTP.tsx')
    expect(source).toContain('const res = await fetch(`/api/service-etapes?service_id=${serviceId}`)')
    expect(source).not.toMatch(new RegExp(`fetchAuthentifie\\((\`|')${echapper('/api/service-etapes')}`))
  })
})
