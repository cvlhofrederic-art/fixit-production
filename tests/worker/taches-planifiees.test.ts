// @vitest-environment node
// tests/worker/taches-planifiees.test.ts — tâches planifiées du Worker (Cron Triggers, worker/taches-planifiees.ts) :
// la route appelée et son secret, le rejeu unique d'un échec, et l'accord entre wrangler.toml, la table des tâches et
// les routes du dépôt (une expression sans tâche ne ferait rien ; une tâche sans expression ne partirait jamais).

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CRON_ALERTE_METEO,
  DELAI_REJEU_TACHE_MS,
  TACHES_PLANIFIEES,
  creerTachesPlanifiees,
  type EnvTaches,
} from '@/worker/taches-planifiees'
import type { ContexteExecution } from '@/worker/cache-pages-publiques'

const RACINE = join(__dirname, '..', '..')
const ctx: ContexteExecution = { waitUntil: () => undefined }

function banc(reponses: Array<Response | Error>) {
  const requetes: Request[] = []
  const attentes: number[] = []
  const gestionnaire = {
    fetch: vi.fn(async (requete: Request) => {
      requetes.push(requete)
      const suivante = reponses.shift() ?? new Response('{}', { status: 200 })
      if (suivante instanceof Error) throw suivante
      return suivante
    }),
  }
  const scheduled = creerTachesPlanifiees<EnvTaches>(gestionnaire, { attendre: async ms => { attentes.push(ms) } })
  return { requetes, attentes, gestionnaire, scheduled }
}

afterEach(() => { vi.restoreAllMocks() })

describe('handler scheduled', () => {
  it('appelle la route de la tâche dans le Worker, avec le secret, une seule fois si elle réussit', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const { requetes, attentes, scheduled } = banc([new Response('{"chantiers":2,"emails":3}', { status: 200 })])

    await scheduled({ cron: CRON_ALERTE_METEO }, { CRON_SECRET: 's3cret' }, ctx)

    expect(requetes).toHaveLength(1)
    expect(new URL(requetes[0].url).pathname).toBe('/api/cron/alerte-meteo')
    expect(requetes[0].method).toBe('GET')
    expect(requetes[0].headers.get('authorization')).toBe('Bearer s3cret')
    expect(attentes).toEqual([])
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('/api/cron/alerte-meteo : 200 {"chantiers":2,"emails":3}'))
  })

  it('une réponse 5xx est rejouée une fois, une minute plus tard, et pas davantage', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { requetes, attentes, scheduled } = banc([new Response('{}', { status: 503 }), new Response('{}', { status: 503 })])

    await scheduled({ cron: CRON_ALERTE_METEO }, { CRON_SECRET: 's3cret' }, ctx)

    expect(requetes).toHaveLength(2)
    expect(attentes).toEqual([DELAI_REJEU_TACHE_MS])
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining(': 503'))
  })

  it('une exception du gestionnaire est rejouée une fois, sans remonter au Worker', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const { requetes, scheduled } = banc([new Error('panne'), new Response('{}', { status: 200 })])

    await expect(scheduled({ cron: CRON_ALERTE_METEO }, { CRON_SECRET: 's3cret' }, ctx)).resolves.toBeUndefined()

    expect(requetes).toHaveLength(2)
  })

  it('un refus 4xx (secret faux) n’est pas rejoué', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { requetes, attentes, scheduled } = banc([new Response('{"error":"Unauthorized"}', { status: 401 })])

    await scheduled({ cron: CRON_ALERTE_METEO }, { CRON_SECRET: 'faux' }, ctx)

    expect(requetes).toHaveLength(1)
    expect(attentes).toEqual([])
  })

  it('sans CRON_SECRET dans le Worker, ou pour une expression inconnue, rien n’est appelé', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const sansSecret = banc([])
    await sansSecret.scheduled({ cron: CRON_ALERTE_METEO }, {}, ctx)
    await sansSecret.scheduled({ cron: CRON_ALERTE_METEO }, { CRON_SECRET: '' }, ctx)
    expect(sansSecret.gestionnaire.fetch).not.toHaveBeenCalled()

    const inconnue = banc([])
    await inconnue.scheduled({ cron: '0 3 * * *' }, { CRON_SECRET: 's3cret' }, ctx)
    expect(inconnue.gestionnaire.fetch).not.toHaveBeenCalled()
  })
})

describe('wrangler.toml, table des tâches et routes : d’accord', () => {
  /** Expressions de [triggers] crons, lues dans wrangler.toml (une seule ligne, chaînes entre guillemets). */
  function cronsDeWrangler(): string[] {
    const toml = readFileSync(join(RACINE, 'wrangler.toml'), 'utf8')
    const bloc = toml.split(/\r?\n\[triggers\]\r?\n/)[1]
    expect(bloc, 'section [triggers] absente de wrangler.toml').toBeDefined()
    const ligne = bloc.split(/\r?\n/).find(l => /^crons\s*=/.test(l))
    expect(ligne, 'clé crons absente de [triggers] : wrangler ne retirerait plus les anciens déclenchements').toBeDefined()
    return [...(ligne as string).matchAll(/"([^"]+)"/g)].map(m => m[1])
  }

  it('chaque expression de wrangler.toml a sa tâche, et chaque tâche son expression', () => {
    expect([...cronsDeWrangler()].sort()).toEqual(Object.keys(TACHES_PLANIFIEES).sort())
  })

  it('chaque tâche appelle une route GET qui existe', () => {
    for (const chemin of Object.values(TACHES_PLANIFIEES)) {
      const fichier = join(RACINE, 'app', ...chemin.split('/').filter(Boolean), 'route.ts')
      expect(existsSync(fichier), `${fichier} introuvable`).toBe(true)
      expect(readFileSync(fichier, 'utf8')).toMatch(/export async function GET\(/)
    }
  })

  it('le point d’entrée du Worker exporte le handler scheduled', () => {
    const entree = readFileSync(join(RACINE, 'worker', 'index.ts'), 'utf8')
    expect(entree).toMatch(/scheduled:\s*creerTachesPlanifiees\(/)
  })
})
