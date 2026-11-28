/**
 * Contrôle d'origine du middleware sur les requêtes qui modifient (/api/, POST, PATCH, PUT, DELETE).
 *
 * Le Worker sert le site sur vitfix.io ET sur www.vitfix.io (wrangler.toml, [[routes]]). Une page servie sur
 * www.vitfix.io envoie ses requêtes avec l'origine https://www.vitfix.io : elles doivent passer comme celles de
 * https://vitfix.io. Toute autre origine reste refusée (403), y compris un sous-domaine ou un protocole voisin.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}))

const { middleware } = await import('@/middleware')

// Valeur de production (wrangler.toml [vars], deploy-cloudflare.yml) : le test rejoue la liste réelle, quel que soit le shell.
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://vitfix.io')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

async function envoyer(hote: string, methode: string, origine: string | null) {
  const entetes: Record<string, string> = { 'content-type': 'application/json' }
  if (origine !== null) entetes.origin = origine
  const reponse = await middleware(new NextRequest(`https://${hote}/api/health`, { method: methode, headers: entetes, body: '{}' }))
  const corps = reponse.status === 403 ? await reponse.text() : ''
  return {
    statut: reponse.status,
    suite: reponse.headers.get('x-middleware-next'),
    refuseParLeControle: reponse.status === 403 && corps.includes('CSRF'),
  }
}

/** La requête est laissée à la route : ni refus, ni redirection. */
function laisseeALaRoute(r: Awaited<ReturnType<typeof envoyer>>) {
  expect(r.refuseParLeControle).toBe(false)
  expect(r.statut).toBe(200)
  expect(r.suite).toBe('1')
}

/** Motifs des [[routes]] de wrangler.toml, par exemple « www.vitfix.io/* ». */
function motifsDesRoutesDuWorker(): string[] {
  return readFileSync(join(__dirname, '..', '..', 'wrangler.toml'), 'utf8')
    .split('\n')
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne.startsWith('pattern'))
    .map((ligne) => ligne.slice(ligne.indexOf('"') + 1, ligne.lastIndexOf('"')))
}

describe('page servie sur www.vitfix.io : ses requêtes passent le contrôle d’origine', () => {
  it.each(['POST', 'PATCH', 'PUT', 'DELETE'])('%s depuis https://www.vitfix.io', async (methode) => {
    laisseeALaRoute(await envoyer('www.vitfix.io', methode, 'https://www.vitfix.io'))
  })

  it('comme depuis https://vitfix.io (inchangé)', async () => {
    laisseeALaRoute(await envoyer('vitfix.io', 'POST', 'https://vitfix.io'))
  })

  it('sans en-tête Origin (appel de serveur à serveur) : inchangé', async () => {
    laisseeALaRoute(await envoyer('vitfix.io', 'POST', null))
  })
})

describe('chaque adresse servie par le Worker (wrangler.toml, [[routes]]) passe le contrôle d’origine', () => {
  const motifs = motifsDesRoutesDuWorker()

  it('les routes du Worker sont bien lues', () => {
    expect(motifs).toEqual(expect.arrayContaining(['vitfix.io/*', 'www.vitfix.io/*']))
  })

  it.each(motifs)('%s', async (motif) => {
    const hote = motif.endsWith('/*') ? motif.slice(0, -2) : motif
    expect(hote, `route « ${motif} » : une route à joker ou à chemin demande de revoir la liste du middleware`).not.toMatch(/[*/]/)
    laisseeALaRoute(await envoyer(hote, 'POST', `https://${hote}`))
  })
})

describe('les autres origines restent refusées', () => {
  it.each([
    'https://exemple.com',
    'http://www.vitfix.io',
    'https://www.vitfix.io:8443',
    'https://autre.vitfix.io',
    'https://www.vitfix.io.exemple.com',
    'https://wwwvitfix.io',
    'null',
  ])('%s → 403', async (origine) => {
    const r = await envoyer('www.vitfix.io', 'POST', origine)
    expect(r.statut).toBe(403)
    expect(r.refuseParLeControle).toBe(true)
  })
})
