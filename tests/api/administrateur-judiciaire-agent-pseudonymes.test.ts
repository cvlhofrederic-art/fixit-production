// @vitest-environment node
// tests/api/administrateur-judiciaire-agent-pseudonymes.test.ts
//
// Route des agents IA de la succursale Administrateur judiciaire, chemin réel (lib/claude et lib/groq non simulés,
// seul `fetch` est remplacé) : les noms des personnes et des prestataires du contexte, de l'historique et de la
// question sont remplacés par des pseudonymes avant le modèle (décision du 20/11/2026), y compris sur le secours
// Groq ; la réponse affichée porte les vrais noms ; ni la trace Langfuse ni le journal ne voient un nom.
// Tous les noms sont inventés pour ce test. Clés factices seulement.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import {
  installerFetchIA,
  poserCles,
  reponseClaude,
  reponseOpenAI,
  versClaude,
  versGroq,
  type AppelIA,
} from '../helpers/faux-fournisseurs-ia'
import { ANTHROPIC_API_URL, GROQ_API_URL } from '@/lib/constants'

const h = vi.hoisted(() => ({
  traces: [] as Array<Record<string, unknown>>,
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/env', async () => (await import('../helpers/faux-fournisseurs-ia')).envAvecWorkersAI())
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())
vi.mock('@/lib/supabase-server-component', () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u-aj', email: 'cabinet@exemple.fr', app_metadata: { role: 'syndic' } } } }) },
  })),
}))
vi.mock('@/lib/langfuse', () => ({
  traceAgent: (parametres: Record<string, unknown>, appel: () => Promise<unknown>) => {
    h.traces.push(parametres)
    return appel()
  },
}))

const { logger } = await import('@/lib/logger')
const { POST } = await import('@/app/api/administrateur-judiciaire/agent/route')

const CONTEXTE = {
  dateDuJour: '2026-06-04',
  coproprieteSelectionnee: "Les Jardins d'Ondine",
  coproprietes: [{ code: 'JO', nom: "Les Jardins d'Ondine", lots: 40 }],
  coproprietairesDebiteurs: [
    { nom: 'Ondine Kervaliec', lot: '12', copropriete: "Les Jardins d'Ondine", solde: -4200, statut: 'Mise en demeure' },
    { nom: 'Noé Kervaliec', lot: '14', copropriete: "Les Jardins d'Ondine", solde: -1800, statut: 'Relance' },
    { nom: 'Éloïse Darnetal-Quérec', lot: '3', copropriete: "Les Jardins d'Ondine", solde: -950, statut: 'Relance' },
  ],
  dossiersImpayes: [{ debiteur: 'Ondine Kervaliec', montant: 4200, statut: 'Action en justice' }],
  prestataires: [{ nom: 'Atelier Brumaire SARL', metier: 'Couvreur', ville: 'Rocheville', note: 4 }],
  contrats: [{ copropriete: "Les Jardins d'Ondine", prestataire: 'Atelier Brumaire SARL', type: 'Entretien toiture' }],
  notificationsRecentes: [{ titre: 'Appel', description: 'Appel de Mme Pelagnier (occupante du lot 3), joignable au 06 12 34 56 78' }],
}

const CORPS = {
  agent: 'lea',
  message: 'Où en est le recouvrement d’Éloïse Darnetal-Quérec ? Et celui de Mme Kervaliec ?',
  historique: [
    { role: 'user', content: 'Qui doit le plus ?' },
    { role: 'assistant', content: 'Ondine Kervaliec (lot 12) : 4 200 €. Atelier Brumaire SARL intervient jeudi.' },
  ],
  contexte: CONTEXTE,
}

/** Réponse du modèle : il ne connaît que les pseudonymes. */
const REPONSE_MODELE =
  '**Copropriétaire 3** doit 950 € (relance). Copropriétaire 1 ou Copropriétaire 2 : préciser. Prestataire 1 et Personne 1 sont à rappeler.'
const REPONSE_AFFICHEE =
  '**Éloïse Darnetal-Quérec** doit 950 € (relance). Ondine Kervaliec ou Noé Kervaliec : préciser. Atelier Brumaire SARL et Mme Pelagnier sont à rappeler.'

const FRAGMENTS_INTERDITS = ['kervaliec', 'darnetal', 'querec', 'eloise', 'brumaire', 'pelagnier']
const replier = (texte: string) => texte.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const nomsQuiFuient = (valeur: unknown) => FRAGMENTS_INTERDITS.filter((fragment) => replier(JSON.stringify(valeur)).includes(fragment))

const requete = (corps: unknown) =>
  new NextRequest('http://localhost/api/administrateur-judiciaire/agent', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corps),
  })

let remettreCles: () => void
let appels: AppelIA[]

beforeEach(() => {
  h.traces = []
  vi.mocked(logger.error).mockClear()
  vi.mocked(logger.warn).mockClear()
  vi.mocked(logger.info).mockClear()
  appels = installerFetchIA((url) => {
    if (url === ANTHROPIC_API_URL) return reponseClaude(REPONSE_MODELE)
    if (url === GROQ_API_URL) return reponseOpenAI(REPONSE_MODELE)
    throw new Error(`fetch inattendu : ${url}`)
  })
})

afterEach(() => {
  remettreCles()
  vi.unstubAllGlobals()
})

describe('/api/administrateur-judiciaire/agent — pseudonymes des personnes', () => {
  it('aucun nom ne part chez Anthropic ; la réponse affichée porte les vrais noms', async () => {
    remettreCles = poserCles()
    const res = await POST(requete(CORPS))
    expect(res.status).toBe(200)
    expect((await res.json()).text).toBe(REPONSE_AFFICHEE)

    const [envoi] = versClaude(appels)
    expect(envoi).toBeDefined()
    expect(nomsQuiFuient(envoi.corps)).toEqual([])
    expect(JSON.stringify(envoi.corps)).not.toContain('06 12 34 56 78')

    const systeme = (envoi.corps.system as Array<{ text: string }>).map((bloc) => bloc.text).join('\n')
    expect(systeme).toContain('"nom": "Copropriétaire 3"')
    expect(systeme).toContain('"prestataire": "Prestataire 1"')
    expect(systeme).toContain('Appel de Personne 1 (occupante du lot 3)')
    expect(systeme).toContain("Les Jardins d'Ondine")
    expect(systeme).toMatch(/pseudonymes/)

    const messages = envoi.corps.messages as Array<{ role: string; content: string }>
    expect(messages.map((m) => m.content)).toEqual([
      'Qui doit le plus ?',
      'Copropriétaire 1 (lot 12) : 4 200 €. Prestataire 1 intervient jeudi.',
      'Où en est le recouvrement de Copropriétaire 3 ? Et celui de Copropriétaire 1 ou Copropriétaire 2 ?',
    ])
  })

  it('secours Groq (clé Anthropic absente) : la même requête pseudonymisée, la réponse rétablie', async () => {
    remettreCles = poserCles({ claude: false })
    const res = await POST(requete(CORPS))
    expect(res.status).toBe(200)
    expect((await res.json()).text).toBe(REPONSE_AFFICHEE)
    expect(versClaude(appels)).toEqual([])
    const [envoi] = versGroq(appels)
    expect(envoi).toBeDefined()
    expect(nomsQuiFuient(envoi.corps)).toEqual([])
  })

  it('ni la trace Langfuse ni le journal ne reçoivent un nom ou la table de correspondance', async () => {
    remettreCles = poserCles()
    await POST(requete(CORPS))
    expect(h.traces).toHaveLength(1)
    expect(h.traces[0].prompt).toBe('Où en est le recouvrement de Copropriétaire 3 ? Et celui de Copropriétaire 1 ou Copropriétaire 2 ?')
    expect(nomsQuiFuient(h.traces)).toEqual([])
    const journal = [logger.error, logger.warn, logger.info].flatMap((espion) => vi.mocked(espion).mock.calls)
    expect(nomsQuiFuient(journal)).toEqual([])
  })
})
