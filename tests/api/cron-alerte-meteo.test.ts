// @vitest-environment node
// tests/api/cron-alerte-meteo.test.ts — e-mail de la veille au soir de l'alerte météo (26/11/2026) : la route
// GET /api/cron/alerte-meteo (secret, statuts de réponse) et son travail, lib/btp/alerte-meteo-serveur.ts
// (chantiers suivis demain, soirée du chantier, destinataires, lots, rejeu, limites). La base est simulée par un faux
// client qui applique vraiment les filtres eq / in reçus ; Open-Meteo par un faux fetch.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { COLONNES_PROFILES_ARTISAN_PRODUCTION } from '../helpers/colonnes-profiles-artisan'
import { COLONNES_BTP } from '@/lib/btp/schema-tables-btp'

type Ligne = Record<string, unknown>
interface Requete { table: string; select: string; filtres: Array<[string, string, unknown]>; ordre: string | null; limite: number | null }
type Lot = { messages: Array<{ to: string; subject: string; html: string }>; cle: string }

const h = vi.hoisted(() => ({
  tables: {} as Record<string, Ligne[]>,
  /** Erreur rendue par la lecture de cette table (ou de la liste des sociétés : 'societes'). */
  pannes: {} as Record<string, { code: string; message: string }>,
  requetes: [] as Requete[],
  lots: [] as Lot[],
  reponseLot: null as null | ((messages: unknown[]) => unknown),
}))

function repondre(r: Requete): { data: unknown; error: unknown } {
  const panne = r.table === 'chantiers_btp' && r.select === 'owner_id' ? h.pannes.societes : h.pannes[r.table]
  if (panne) return { data: null, error: panne }
  let lignes = [...(h.tables[r.table] ?? [])]
  for (const [op, colonne, valeur] of r.filtres) {
    lignes = lignes.filter(l => (op === 'eq' ? l[colonne] === valeur : (valeur as unknown[]).includes(l[colonne])))
  }
  if (r.ordre) lignes.sort((a, b) => String(a[r.ordre as string]).localeCompare(String(b[r.ordre as string])))
  if (r.limite !== null) lignes = lignes.slice(0, r.limite)
  return { data: r.select === 'owner_id' ? lignes.map(l => ({ owner_id: l.owner_id })) : lignes, error: null }
}

vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const r: Requete = { table, select: '', filtres: [], ordre: null, limite: null }
      h.requetes.push(r)
      const b: Record<string, unknown> = {
        select: (s: string) => { r.select = s; return b },
        eq: (c: string, v: unknown) => { r.filtres.push(['eq', c, v]); return b },
        in: (c: string, v: unknown[]) => { r.filtres.push(['in', c, v]); return b },
        order: (c: string) => { r.ordre = c; return b },
        limit: (n: number) => { r.limite = n; return b },
        then: (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(repondre(r)).then(ok, ko),
      }
      return b
    },
  },
}))
vi.mock('@/lib/email', async (io) => ({
  ...(await io<typeof import('@/lib/email')>()),
  sendBatchEmailsDetaille: vi.fn(async (messages: Lot['messages'], options: { idempotencyKey: string }) => {
    h.lots.push({ messages, cle: options.idempotencyKey })
    return h.reponseLot ? h.reponseLot(messages) : { ok: true, acceptes: messages.map((_, i) => i), refuses: [] }
  }),
}))
const journal = vi.hoisted(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: journal }))

const { GET } = await import('@/app/api/cron/alerte-meteo/route')
const { CHANTIERS_PAR_APPEL, PAUSE_ENTRE_LOTS_MS, envoyerAlertesDeLaVeille } = await import('@/lib/btp/alerte-meteo-serveur')

const SOCIETE = 'societe-1'
/** Jeudi 26/11/2026, 18:15 UTC : 18:15 à Lisbonne (le chantier), dans la soirée. */
const JEUDI_SOIR = Date.UTC(2026, 10, 26, 18, 15)
const chantier = (p: Ligne): Ligne => ({
  owner_id: SOCIETE, titre: 'Chantier', statut: 'En cours', latitude: 41.15, longitude: -8.61, alerte_meteo: true, membres_ids: [], ...p,
})
const DALLE = chantier({ id: 'c-dalle', titre: 'Dalle Villa', membres_ids: ['m-joao', 'm-inactif', 'm-joao-bis', 'm-sans-adresse'] })
const INTERIEUR = chantier({ id: 'c-interieur', titre: 'Peinture intérieure', alerte_meteo: false, membres_ids: ['m-ana'] })
const membre = (id: string, email: string | null, p: Ligne = {}): Ligne => ({ id, owner_id: SOCIETE, prenom: id, nom: 'X', email, actif: true, ...p })
const MEMBRES = [
  membre('m-joao', 'joao@exemple.test'),
  membre('m-joao-bis', ' JOAO@exemple.test '), // même adresse, autre casse : un seul e-mail
  membre('m-ana', 'ana@exemple.test'),
  membre('m-paulo', 'paulo@exemple.test'), // par son équipe
  membre('m-inactif', 'rui@exemple.test', { actif: false }), // affecté à la dalle, mais désactivé
  membre('m-sans-adresse', 'pas-une-adresse'),
]

/** Fausse réponse d'Open-Meteo : sept jours depuis le 26/11, pluie par date, décalage horaire du chantier (Lisbonne : 0). */
let pluies: Record<string, number> = {}
let statutMeteo = 200
let decalage = 0
let exception: Error | null = null
const lire = vi.fn(async (_url: string, _init?: RequestInit) => {
  if (exception) throw exception
  if (statutMeteo !== 200) return new Response('', { status: statutMeteo })
  const dates = ['2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02']
  return new Response(JSON.stringify({
    utc_offset_seconds: decalage,
    daily: {
      time: dates, temperature_2m_max: dates.map(() => 15), temperature_2m_min: dates.map(() => 8),
      precipitation_sum: dates.map(d => pluies[d] ?? 0), wind_speed_10m_max: dates.map(() => 10), weather_code: dates.map(() => 61),
    },
  }))
})
const attendre = vi.fn(async (_ms: number) => {})
const envoyer = (maintenantMs = JEUDI_SOIR) => envoyerAlertesDeLaVeille({ maintenantMs, attendre, lire })

beforeEach(() => {
  h.tables = {
    chantiers_btp: [DALLE, INTERIEUR],
    membres_btp: MEMBRES,
    equipes_btp: [{ id: 'e-1', owner_id: SOCIETE, chantier_id: 'c-dalle', equipe_membres_btp: [{ membre_id: 'm-paulo' }] }],
    profiles_artisan: [{ user_id: SOCIETE, company_name: 'VITFIX CONSTRUÇÕES', language: 'pt' }],
  }
  h.pannes = {}
  h.requetes = []
  h.lots = []
  h.reponseLot = null
  pluies = { '2026-11-27': 12 }
  statutMeteo = 200
  decalage = 0
  exception = null
  lire.mockClear()
  attendre.mockClear()
  journal.error.mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe('GET /api/cron/alerte-meteo', () => {
  const appeler = async (entete: string | null = 'Bearer secret-cron') => {
    const headers: Record<string, string> = {}
    if (entete) headers.authorization = entete
    const res = await GET(new NextRequest('https://vitfix.io/api/cron/alerte-meteo', { headers }))
    return { status: res.status, json: await res.json() as Ligne }
  }

  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'secret-cron')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(JEUDI_SOIR)
    vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => lire(String(url), init))
  })

  it('sans en-tête, faux secret, ou secret absent du serveur : 401, rien n’est lu ni envoyé', async () => {
    expect((await appeler(null)).status).toBe(401)
    expect((await appeler('Bearer faux')).status).toBe(401)
    vi.stubEnv('CRON_SECRET', '')
    expect((await appeler('Bearer secret-cron')).status).toBe(401)
    expect(h.requetes).toEqual([])
    expect(h.lots).toEqual([])
    expect(lire).not.toHaveBeenCalled()
  })

  it('soirée de pluie : 200 avec le bilan', async () => {
    const { status, json } = await appeler()
    expect(status).toBe(200)
    expect(json).toMatchObject({ societes: 1, chantiers: 1, alertes: 1, emails: 2 })
  })

  it('à rejouer (aucune prévision lue) : 503, que le Worker rejoue une fois, et Sentry prévenu', async () => {
    statutMeteo = 429
    const { status, json } = await appeler()
    expect(status).toBe(503)
    expect(json).toMatchObject({ previsionsIndisponibles: 1, emails: 0 })
    expect(journal.error).toHaveBeenCalledWith('[cron/alerte-meteo] passage incomplet', expect.objectContaining({ rejouer: true }), expect.any(Error))
  })

  it('lot refusé (quota, clé absente) : 200 sans rejeu, mais Sentry prévenu ; passage complet : rien', async () => {
    h.reponseLot = () => ({ ok: false, code: 'quota', statutHttp: 429, motif: 'daily_quota_exceeded' })
    const refuse = await appeler()
    expect(refuse.status).toBe(200)
    expect(refuse.json).toMatchObject({ lotsEnEchec: 1 })
    expect(journal.error).toHaveBeenCalledTimes(1)
    journal.error.mockClear()
    h.reponseLot = null
    await appeler()
    expect(journal.error).not.toHaveBeenCalled()
  })

  it('colonne alerte_meteo absente de la base : 200 sans envoi, en le disant', async () => {
    h.pannes.societes = { code: '42703', message: 'column chantiers_btp.alerte_meteo does not exist' }
    const { status, json } = await appeler()
    expect(status).toBe(200)
    expect(json.raison).toBe('colonne_absente')
    expect(h.lots).toEqual([])
  })

  it('autre erreur de lecture : 500, sans détail interne', async () => {
    h.pannes.societes = { code: '57014', message: 'canceling statement due to statement timeout' }
    const { status, json } = await appeler()
    expect(status).toBe(500)
    expect(JSON.stringify(json)).not.toContain('statement')
  })

  it('fiches des sociétés illisibles : 500 avant tout envoi (pas d’e-mail en français signé « Vitfix »)', async () => {
    h.pannes.profiles_artisan = { code: 'PGRST003', message: 'timeout' }
    const { status } = await appeler()
    expect(status).toBe(500)
    expect(h.lots).toEqual([])
    expect(lire).not.toHaveBeenCalled()
  })
})

describe('e-mail de la veille : qui, quoi', () => {
  it('pluie demain sur la dalle : un e-mail à chaque salarié actif affecté (lui-même ou son équipe), une fois par adresse', async () => {
    const { bilan, rejouer } = await envoyer()
    expect(rejouer).toBe(false)
    expect(bilan).toMatchObject({ societes: 1, chantiers: 1, alertes: 1, emails: 2, refuses: 0 })
    expect(h.lots).toHaveLength(1)
    const [lot] = h.lots
    expect(lot.cle).toBe('alerte-meteo-2026-11-27-c-dalle')
    expect(lot.messages.map(m => m.to).sort()).toEqual(['joao@exemple.test', 'paulo@exemple.test'])
    expect(lot.messages[0].subject).toBe('[VITFIX CONSTRUÇÕES] 🌧️ Alerta meteorológico amanhã: Dalle Villa')
    expect(lot.messages[0].html).toContain('Previsto para amanhã, sexta-feira, 27 de novembro, na obra « Dalle Villa »: chuva 12 mm.')
    expect(lot.messages[0].html).toContain('/pt/pro/dashboard/?p=meteo')
  })

  it('salarié désactivé, adresse invalide, chantier intérieur (case décochée) : rien', async () => {
    await envoyer()
    const destinataires = h.lots.flatMap(l => l.messages.map(m => m.to.trim().toLowerCase()))
    expect(destinataires).not.toContain('rui@exemple.test')
    expect(destinataires).not.toContain('ana@exemple.test')
    expect(destinataires).not.toContain('pas-une-adresse')
    expect(lire).toHaveBeenCalledTimes(1)
  })

  it('ne lit que les chantiers soumis à l’alerte, en cours ou en attente, et des colonnes qui existent', async () => {
    await envoyer()
    const lectures = h.requetes.filter(r => r.table === 'chantiers_btp')
    for (const r of lectures) {
      expect(r.filtres).toEqual(expect.arrayContaining([['eq', 'alerte_meteo', true], ['in', 'statut', ['En cours', 'En attente']]]))
      expect(r.ordre).not.toBeNull()
      for (const [, colonne] of r.filtres) expect(colonne === 'owner_id' || colonne in COLONNES_BTP.chantiers_btp).toBe(true)
    }
    const fiches = h.requetes.find(r => r.table === 'profiles_artisan') as Requete
    for (const colonne of fiches.select.split(',').map(c => c.trim())) expect(COLONNES_PROFILES_ARTISAN_PRODUCTION).toContain(colonne)
  })

  it('société française : e-mail en français', async () => {
    h.tables.profiles_artisan = [{ user_id: SOCIETE, company_name: 'Provence Pro', language: 'fr' }]
    await envoyer()
    expect(h.lots[0].messages[0].subject).toBe('[Provence Pro] 🌧️ Alerte météo demain : Dalle Villa')
    expect(h.lots[0].messages[0].html).toContain('Prévu demain, vendredi 27 novembre, sur le chantier « Dalle Villa » : pluie 12 mm.')
  })

  it('pas d’alerte demain (la pluie n’arrive qu’après-demain) : aucun e-mail', async () => {
    pluies = { '2026-11-28': 20 }
    const { bilan } = await envoyer()
    expect(bilan).toMatchObject({ chantiers: 1, alertes: 0, emails: 0 })
    expect(h.lots).toEqual([])
  })

  it('« En attente » qui commence demain : son équipe est prévenue ; qui commence plus tard : pas même lu', async () => {
    h.tables.chantiers_btp = [
      chantier({ id: 'c-demain', titre: 'Laje Silva', statut: 'En attente', date_debut: '2026-11-27', membres_ids: ['m-ana'] }),
      chantier({ id: 'c-decembre', titre: 'Muro', statut: 'En attente', date_debut: '2026-12-15', membres_ids: ['m-ana'] }),
      chantier({ id: 'c-fini', titre: 'Fini', statut: 'Terminé', membres_ids: ['m-ana'] }),
    ]
    const { bilan } = await envoyer()
    expect(h.lots.map(l => l.cle)).toEqual(['alerte-meteo-2026-11-27-c-demain'])
    expect(h.lots[0].messages.map(m => m.to)).toEqual(['ana@exemple.test'])
    expect(bilan.chantiers).toBe(1)
    expect(lire).toHaveBeenCalledTimes(1)
  })
})

describe('e-mail de la veille : heure, pannes, limites', () => {
  it('hors de la soirée du chantier (appel en retard, 03:00 à Lisbonne) : rien n’est envoyé', async () => {
    const { bilan, rejouer } = await envoyer(Date.UTC(2026, 10, 27, 3, 0))
    expect(bilan).toMatchObject({ horsFenetre: 1, alertes: 0 })
    expect(h.lots).toEqual([])
    expect(rejouer).toBe(false)
  })

  it('chantier sans position : compté à part, rien n’est demandé à Open-Meteo', async () => {
    h.tables.chantiers_btp = [chantier({ id: 'c-sans', latitude: null, longitude: null, membres_ids: ['m-joao'] })]
    const { bilan, rejouer } = await envoyer()
    expect(bilan).toMatchObject({ sansPosition: 1, previsionsIndisponibles: 0 })
    expect(lire).not.toHaveBeenCalled()
    expect(rejouer).toBe(false)
  })

  it('Open-Meteo borné dans le temps, et toutes les prévisions en échec : à rejouer', async () => {
    statutMeteo = 503
    const { bilan, rejouer } = await envoyer()
    expect(lire.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal)
    expect(bilan.previsionsIndisponibles).toBe(1)
    expect(rejouer).toBe(true)
  })

  it('lot en panne passagère (débit, réseau) : à rejouer, sans doublon (même clé) ; contenu changé (409) : non', async () => {
    h.reponseLot = () => ({ ok: false, code: 'limite', statutHttp: 429, motif: 'rate_limit_exceeded' })
    const premier = await envoyer()
    expect(premier.rejouer).toBe(true)
    expect(premier.bilan.refuses).toBe(2)
    h.reponseLot = () => ({ ok: false, code: 'rejeu_refuse', statutHttp: 409, motif: 'invalid_idempotent_request' })
    const second = await envoyer()
    expect(second.rejouer).toBe(false)
    expect(h.lots.map(l => l.cle)).toEqual(['alerte-meteo-2026-11-27-c-dalle', 'alerte-meteo-2026-11-27-c-dalle'])
  })

  it('une seconde entre deux lots', async () => {
    h.tables.chantiers_btp = [DALLE, chantier({ id: 'c-toit', titre: 'Toiture', membres_ids: ['m-ana'] })]
    await envoyer()
    expect(h.lots).toHaveLength(2)
    expect(attendre.mock.calls).toEqual([[PAUSE_ENTRE_LOTS_MS]])
  })

  it('une société illisible n’empêche pas les autres, et l’appel est à rejouer', async () => {
    h.tables.chantiers_btp = [DALLE, chantier({ id: 'c-autre', owner_id: 'societe-0', membres_ids: [] })]
    h.tables.profiles_artisan.push({ user_id: 'societe-0', company_name: 'Autre', language: 'fr' })
    let premiere = true
    // La première société lue (ordre des identifiants : societe-0) échoue à la lecture de ses employés.
    Object.defineProperty(h.pannes, 'membres_btp', {
      configurable: true, enumerable: true,
      get: () => { if (premiere) { premiere = false; return { code: 'XX000', message: 'panne' } } return undefined },
    })
    const { bilan, rejouer } = await envoyer()
    expect(rejouer).toBe(true)
    expect(bilan.societes).toBe(2)
    expect(h.lots.map(l => l.cle)).toEqual(['alerte-meteo-2026-11-27-c-dalle'])
  })

  it(`au plus ${CHANTIERS_PAR_APPEL} chantiers par appel : le reste est compté, jamais passé sous silence`, async () => {
    pluies = {}
    h.tables.chantiers_btp = Array.from({ length: CHANTIERS_PAR_APPEL + 3 }, (_, i) =>
      chantier({ id: `c-${String(i).padStart(3, '0')}` }))
    const { bilan } = await envoyer()
    expect(lire).toHaveBeenCalledTimes(CHANTIERS_PAR_APPEL)
    expect(bilan).toMatchObject({ chantiers: CHANTIERS_PAR_APPEL, nonTraites: 3 })
  })
})

describe('e-mail de la veille : seconde relecture', () => {
  it('destinataires rangés par adresse : un rejeu renvoie le même lot, dans le même ordre', async () => {
    // Identifiants dans l'ordre inverse des adresses : l'ordre de lecture ne suffit pas, le tri par adresse est prouvé.
    h.tables.membres_btp = [membre('m-a', 'zoe@exemple.test'), membre('m-b', 'bruno@exemple.test'), membre('m-c', 'ana@exemple.test')]
    h.tables.chantiers_btp = [chantier({ id: 'c-dalle', titre: 'Dalle Villa', membres_ids: ['m-a', 'm-b', 'm-c'] })]
    await envoyer()
    expect(h.lots[0].messages.map(m => m.to)).toEqual(['ana@exemple.test', 'bruno@exemple.test', 'zoe@exemple.test'])
    const membresLus = h.requetes.find(r => r.table === 'membres_btp') as Requete
    expect(membresLus.ordre).toBe('id')
  })

  it('prévision en exception (réseau coupé, délai dépassé) : comptée indisponible, à rejouer', async () => {
    exception = new TypeError('fetch failed')
    const { bilan, rejouer } = await envoyer()
    expect(bilan.previsionsIndisponibles).toBe(1)
    expect(rejouer).toBe(true)
  })

  it('un chantier sans GPS et une prévision en panne : à rejouer quand même', async () => {
    statutMeteo = 502
    h.tables.chantiers_btp = [chantier({ id: 'c-sans', latitude: null, longitude: null }), DALLE]
    const { bilan, rejouer } = await envoyer()
    expect(bilan).toMatchObject({ sansPosition: 1, previsionsIndisponibles: 1 })
    expect(rejouer).toBe(true)
  })

  it('lot en panne réseau : à rejouer, et compté parmi les lots en échec', async () => {
    h.reponseLot = () => ({ ok: false, code: 'reseau', statutHttp: null, motif: 'delai_depasse' })
    const { bilan, rejouer } = await envoyer()
    expect(rejouer).toBe(true)
    expect(bilan.lotsEnEchec).toBe(1)
  })

  it.each([
    ['Paris (UTC+1), 19:15', 3600, true],
    ['Martinique (UTC-4), 14:15', -4 * 3600, true],
    ['La Réunion (UTC+4), 22:15', 4 * 3600, true],
    ['Nouvelle-Calédonie (UTC+11), 05:15 le lendemain', 11 * 3600, false],
  ])('heure du chantier : %s → envoi %s', async (_lieu, secondes, envoi) => {
    decalage = secondes as number
    pluies = { '2026-11-27': 12, '2026-11-28': 12 }
    const { bilan } = await envoyer()
    expect(h.lots.length > 0).toBe(envoi)
    expect(bilan.horsFenetre).toBe(envoi ? 0 : 1)
  })

  it('« En attente » qui commence après-demain : lu, mais personne n’est prévenu ce soir', async () => {
    pluies = { '2026-11-27': 12, '2026-11-28': 12 }
    h.tables.chantiers_btp = [chantier({ id: 'c-samedi', statut: 'En attente', date_debut: '2026-11-28', membres_ids: ['m-ana'] })]
    const { bilan } = await envoyer()
    expect(lire).toHaveBeenCalledTimes(1)
    expect(bilan.alertes).toBe(0)
    expect(h.lots).toEqual([])
  })
})
