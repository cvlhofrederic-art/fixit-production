// @vitest-environment node
// tests/api/cron-alerte-meteo.test.ts — GET /api/cron/alerte-meteo : e-mail de secours de la veille aux salariés
// affectés aux chantiers soumis à l'alerte météo (26/11/2026).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

type Ligne = Record<string, unknown>

const h = vi.hoisted(() => ({
  chantiersSoumis: [] as Ligne[],
  erreurLecture: null as null | { code: string; message: string },
  fiches: [] as Ligne[],
  donnees: new Map<string, { membres: Ligne[]; chantiersEnCours: Ligne[]; equipes: Ligne[] }>(),
  lots: [] as Array<{ messages: Array<{ to: string; subject: string; html: string }>; cle: string }>,
  pluieDemain: 12,
  filtres: [] as Array<[string, unknown]>,
}))

vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const b: Record<string, unknown> = {}
      b.select = () => b
      b.eq = (c: string, v: unknown) => { h.filtres.push([c, v]); return b }
      b.in = () => Promise.resolve({ data: h.fiches, error: null })
      b.limit = () => Promise.resolve(table === 'chantiers_btp'
        ? { data: h.erreurLecture ? null : h.chantiersSoumis, error: h.erreurLecture }
        : { data: [], error: null })
      return b
    },
  },
}))
vi.mock('@/lib/btp/pointage-serveur', () => ({
  lireDonneesSociete: vi.fn(async (societe: string) => ({ societeId: societe, ...(h.donnees.get(societe) ?? { membres: [], chantiersEnCours: [], equipes: [] }) })),
}))
vi.mock('@/lib/email', async (io) => ({
  ...(await io<typeof import('@/lib/email')>()),
  sendBatchEmailsDetaille: vi.fn(async (messages: Array<{ to: string; subject: string; html: string }>, options: { idempotencyKey: string }) => {
    h.lots.push({ messages, cle: options.idempotencyKey })
    return { ok: true, acceptes: messages.map((_, i) => i), refuses: [] }
  }),
}))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }))

const { GET } = await import('@/app/api/cron/alerte-meteo/route')

const SOCIETE = 'societe-1'
const DALLE = { id: 'c-dalle', owner_id: SOCIETE, titre: 'Dalle Villa', statut: 'En cours', latitude: 43.3, longitude: 5.38, alerte_meteo: true, membres_ids: ['m-joao'] }
const INTERIEUR = { ...DALLE, id: 'c-interieur', titre: 'Peinture intérieure', alerte_meteo: false, membres_ids: ['m-joao', 'm-ana'] }
const JOAO = { id: 'm-joao', prenom: 'João', nom: 'Silva', email: 'joao@exemple.test', actif: true }
const ANA = { id: 'm-ana', prenom: 'Ana', nom: 'Costa', email: 'ana@exemple.test', actif: true }
const PAULO = { id: 'm-paulo', prenom: 'Paulo', nom: 'Dias', email: 'paulo@exemple.test', actif: true, equipe_id: 'e-1' }
const INACTIF = { id: 'm-inactif', prenom: 'Rui', nom: 'Lopes', email: 'rui@exemple.test', actif: false }

const appeler = async (entete: string | null = 'Bearer secret-cron') => {
  const headers: Record<string, string> = {}
  if (entete) headers.authorization = entete
  const res = await GET(new NextRequest('https://vitfix.io/api/cron/alerte-meteo', { headers }))
  return { status: res.status, json: await res.json() as Ligne }
}

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 'secret-cron')
  h.chantiersSoumis = [{ owner_id: SOCIETE }]
  h.erreurLecture = null
  h.fiches = [{ user_id: SOCIETE, company_name: 'VITFIX CONSTRUÇÕES', language: 'pt' }]
  h.donnees.clear()
  h.donnees.set(SOCIETE, {
    membres: [JOAO, ANA, PAULO, INACTIF],
    chantiersEnCours: [DALLE, INTERIEUR],
    equipes: [{ id: 'e-1', chantier_id: 'c-dalle', equipe_membres_btp: [] }],
  })
  h.lots = []
  h.filtres = []
  h.pluieDemain = 12
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({
    daily: {
      time: ['2026-11-26', '2026-11-27'],
      temperature_2m_max: [15, 15], temperature_2m_min: [8, 8],
      precipitation_sum: [0, h.pluieDemain], wind_speed_10m_max: [10, 10], weather_code: [1, 61],
    },
  })))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('GET /api/cron/alerte-meteo — accès', () => {
  it('sans secret côté serveur, sans en-tête ou avec un faux : 401, rien n’est lu ni envoyé', async () => {
    expect((await appeler(null)).status).toBe(401)
    expect((await appeler('Bearer faux')).status).toBe(401)
    vi.stubEnv('CRON_SECRET', '')
    expect((await appeler('Bearer ')).status).toBe(401)
    expect(h.lots).toEqual([])
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})

describe('GET /api/cron/alerte-meteo — envoi', () => {
  it('ne lit que les chantiers en cours soumis à l’alerte', async () => {
    await appeler()
    expect(h.filtres).toEqual(expect.arrayContaining([['alerte_meteo', true], ['statut', 'En cours']]))
  })

  it('pluie demain sur la dalle : un e-mail à chaque salarié actif affecté (lui-même ou son équipe), en portugais', async () => {
    const { status, json } = await appeler()
    expect(status).toBe(200)
    expect(json).toMatchObject({ chantiers: 1, alertes: 1, emails: 2 })
    expect(h.lots).toHaveLength(1)
    const [lot] = h.lots
    expect(lot.cle).toBe('alerte-meteo-2026-11-27-c-dalle')
    expect(lot.messages.map(m => m.to).sort()).toEqual(['joao@exemple.test', 'paulo@exemple.test'])
    expect(lot.messages[0].subject).toBe('[VITFIX CONSTRUÇÕES] 🌧️ Alerta meteorológico amanhã: Dalle Villa')
    expect(lot.messages[0].html).toContain('Previsto para amanhã na obra « Dalle Villa »: chuva 12 mm.')
    expect(lot.messages[0].html).toContain('/pt/pro/dashboard/?p=meteo')
  })

  it('chantier intérieur (non soumis), salarié inactif ou non affecté : personne d’autre ne reçoit rien', async () => {
    await appeler()
    const destinataires = h.lots.flatMap(l => l.messages.map(m => m.to))
    expect(destinataires).not.toContain('ana@exemple.test')
    expect(destinataires).not.toContain('rui@exemple.test')
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('société française : e-mail en français', async () => {
    h.fiches = [{ user_id: SOCIETE, company_name: 'Provence Pro', language: 'fr' }]
    await appeler()
    expect(h.lots[0].messages[0].subject).toBe('[Provence Pro] 🌧️ Alerte météo demain : Dalle Villa')
  })

  it('pas d’alerte demain : aucun e-mail', async () => {
    h.pluieDemain = 2
    const { json } = await appeler()
    expect(json).toMatchObject({ chantiers: 1, alertes: 0, emails: 0 })
    expect(h.lots).toEqual([])
  })

  it('colonne alerte_meteo absente de la base : 200 sans envoi, en le disant', async () => {
    h.erreurLecture = { code: '42703', message: 'column chantiers_btp.alerte_meteo does not exist' }
    const { status, json } = await appeler()
    expect(status).toBe(200)
    expect(json.raison).toBe('colonne_absente')
    expect(h.lots).toEqual([])
  })

  it('autre erreur de lecture : 500, sans détail interne', async () => {
    h.erreurLecture = { code: '57014', message: 'canceling statement due to statement timeout' }
    const { status, json } = await appeler()
    expect(status).toBe(500)
    expect(JSON.stringify(json)).not.toContain('statement')
  })
})
