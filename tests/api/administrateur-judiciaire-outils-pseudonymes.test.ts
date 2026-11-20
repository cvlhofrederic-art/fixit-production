// @vitest-environment node
// tests/api/administrateur-judiciaire-outils-pseudonymes.test.ts
//
// Route des outils IA de la succursale Administrateur judiciaire, chemin réel (lib/claude non simulé, seul `fetch` est
// remplacé) : les personnes citées avec leur civilité dans le devis collé, le contexte du PV, les résolutions et le nom
// du fichier de facture sont remplacées par des pseudonymes avant le modèle (décision du 20/11/2026) ; la réponse
// affichée porte les vrais noms ; ni la trace Langfuse ni le journal ne voient un nom.
// Tous les noms sont inventés pour ce test. Clés factices seulement.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { installerFetchIA, poserCles, reponseClaude, versClaude, type AppelIA } from '../helpers/faux-fournisseurs-ia'
import { ANTHROPIC_API_URL } from '@/lib/constants'

const h = vi.hoisted(() => ({
  traces: [] as Array<Record<string, unknown>>,
  reponse: '',
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
const { POST } = await import('@/app/api/administrateur-judiciaire/outils/route')

const FRAGMENTS_INTERDITS = ['kervaliec', 'pelagnier', 'ystarion', 'velasque']
const replier = (texte: string) => texte.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const nomsQuiFuient = (valeur: unknown) => FRAGMENTS_INTERDITS.filter((fragment) => replier(JSON.stringify(valeur)).includes(fragment))

const requete = (corps: unknown) =>
  new NextRequest('http://localhost/api/administrateur-judiciaire/outils', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corps),
  })

/** Système et messages envoyés à Anthropic, en un seul texte. */
const envoye = (appels: AppelIA[]) => {
  const [envoi] = versClaude(appels)
  expect(envoi).toBeDefined()
  const systeme = (envoi.corps.system as Array<{ text: string }>).map((bloc) => bloc.text).join('\n')
  return { systeme, corps: envoi.corps, texte: `${systeme}\n${JSON.stringify(envoi.corps.messages)}` }
}

const journal = () => [logger.error, logger.warn, logger.info].flatMap((espion) => vi.mocked(espion).mock.calls)

let remettreCles: () => void
let appels: AppelIA[]

beforeEach(() => {
  h.traces = []
  h.reponse = ''
  vi.mocked(logger.error).mockClear()
  vi.mocked(logger.warn).mockClear()
  vi.mocked(logger.info).mockClear()
  remettreCles = poserCles()
  appels = installerFetchIA((url) => {
    if (url === ANTHROPIC_API_URL) return reponseClaude(h.reponse)
    throw new Error(`fetch inattendu : ${url}`)
  })
})

afterEach(() => {
  remettreCles()
  vi.unstubAllGlobals()
})

describe('/api/administrateur-judiciaire/outils — pseudonymes des personnes', () => {
  it('analyse de devis : personne citée avec sa civilité → « Personne N », nom de l’entreprise conservé, réponse rétablie', async () => {
    h.reponse = '## Synthèse\nDevis de Toitures Nord SARL pour Personne 2 ; signé par Personne 1.'
    const texte = [
      'DEVIS n° D-2026-118 — Toitures Nord SARL, SIRET 123 456 789 00012, gérant : M. Ystarion Velasque',
      'Client : Mme Pelagnier, occupante du lot 3',
      'Réfection de la couverture : 120 m² × 95,00 € HT = 11 400,00 € HT',
    ].join('\n')
    const res = await POST(requete({ tache: 'analyse-devis', texte }))
    expect(res.status).toBe(200)
    expect((await res.json()).text).toBe('## Synthèse\nDevis de Toitures Nord SARL pour Mme Pelagnier ; signé par M. Ystarion Velasque.')

    const { systeme, texte: tout } = envoye(appels)
    expect(nomsQuiFuient(tout)).toEqual([])
    expect(tout).toContain('Toitures Nord SARL')
    expect(tout).toContain('gérant : Personne 1')
    expect(tout).toContain('Client : Personne 2, occupante du lot 3')
    expect(systeme).toMatch(/pseudonymes/)
  })

  it('projet de PV : personnes citées dans le mandat et les résolutions remplacées, PV rendu avec les vrais noms', async () => {
    h.reponse = '## Bureau de séance\nPrésident : Personne 2 [À COMPLÉTER : confirmer]. Mandat sur requête de Personne 1.'
    const res = await POST(
      requete({
        tache: 'redaction-pv',
        copropriete: 'Le Clos des Vignes',
        resolutions: ['Approbation des comptes 2025', 'Élection de M. Ystarion Velasque comme président de séance'],
        contexte: {
          copropriete: { nom: 'Le Clos des Vignes', mandat: { motif: 'Requête de Mme Pelagnier, copropriétaire', tribunal: 'TJ Lyon' } },
        },
      }),
    )
    expect(res.status).toBe(200)
    expect((await res.json()).text).toBe(
      '## Bureau de séance\nPrésident : M. Ystarion Velasque [À COMPLÉTER : confirmer]. Mandat sur requête de Mme Pelagnier.',
    )

    const { systeme, texte: tout } = envoye(appels)
    expect(nomsQuiFuient(tout)).toEqual([])
    expect(systeme).toContain('Requête de Personne 1, copropriétaire')
    expect(tout).toContain('Élection de Personne 2 comme président de séance')
    expect(tout).toContain('Le Clos des Vignes')
    expect(systeme).toMatch(/pseudonymes/)
  })

  it('lecture de facture : nom du fichier pseudonymisé, champs lus rétablis', async () => {
    h.reponse = JSON.stringify({
      fournisseur: 'Plomberie Centrale',
      siret: '12345678900012',
      numero: 'FAC-2026-077',
      date: '2026-05-28',
      montant_ht: 1000,
      tva: 100,
      montant_ttc: 1100,
      copropriete_probable: 'Le Clos des Vignes',
      compte_charge_suggere: '615 — Entretien et petites réparations',
      libelle: 'Fuite chez Personne 1',
    })
    const png = `data:image/png;base64,${Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('facture')]).toString('base64')}`
    const res = await POST(
      requete({ tache: 'saisie-facture', fichier: png, nomFichier: 'Facture fuite Mme Pelagnier.png', coproprietes: [{ nom: 'Le Clos des Vignes' }] }),
    )
    expect(res.status).toBe(200)
    expect((await res.json()).facture.libelle).toBe('Fuite chez Mme Pelagnier')
    const { texte: tout } = envoye(appels)
    expect(nomsQuiFuient(tout)).toEqual([])
    expect(tout).toContain('Facture fuite Personne 1.png')
  })

  it('ni la trace Langfuse ni le journal ne reçoivent un nom', async () => {
    h.reponse = 'Réponse.'
    await POST(requete({ tache: 'analyse-devis', texte: 'Devis pour Mme Pelagnier : 100 € HT' }))
    await POST(requete({ tache: 'redaction-pv', copropriete: 'Le Clos des Vignes', resolutions: ['Quitus à M. Ystarion Velasque'] }))
    expect(h.traces).toHaveLength(2)
    expect(nomsQuiFuient(h.traces)).toEqual([])
    expect(nomsQuiFuient(journal())).toEqual([])
  })
})
