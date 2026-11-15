// @vitest-environment node
// tests/api/ia-texte-relais.test.ts — agents texte artisan / BTP / client : modèle envoyé à Groq, relais par Workers
// AI, messages rendus au client.
//
// Constat des 14-15/11/2026 : Groq a retiré `llama-3.3-70b-versatile` et `llama-3.1-8b-instant` le 16/08/2026 ; le
// secours Cerebras nommait un modèle retiré lui aussi. Tous ces agents répondaient en erreur, et plusieurs routes
// affichaient « GROQ_API_KEY non configurée » ou « Clé API Groq… ». Le relais passe par Workers AI (binding du
// Worker) : la clé Anthropic est refusée en production depuis le 15/11/2026, et ni Anthropic ni Cerebras ne sont des
// sous-traitants déclarés. Seuls `fetch` et le binding sont simulés : lib/groq, lib/workers-ai et lib/ai/relais
// tournent pour de vrai.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { GROQ_MODEL_PRIMARY, GROQ_MODEL_RAPIDE, WORKERS_AI_MODELES } from '@/lib/constants'
import { MARGE_RAISONNEMENT } from '@/lib/ai/raisonnement'
import {
  erreurFournisseur,
  fluxOpenAI,
  installerFetchIA,
  installerWorkersAI,
  poserCles,
  reponseOpenAI,
  retirerWorkersAI,
  sortieWorkersAI,
  versCerebras,
  versClaude,
  versGroq,
} from '../helpers/faux-fournisseurs-ia'

const h = vi.hoisted(() => ({
  utilisateur: { id: 'u-pro', app_metadata: { role: 'artisan' } } as Record<string, unknown>,
  insertion: vi.fn(async (_ligne: Record<string, unknown>) => ({ error: null })),
  scanMarches: vi.fn(),
}))

vi.mock('@/lib/env', async () => (await import('../helpers/faux-fournisseurs-ia')).envAvecWorkersAI())
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())
vi.mock('@/lib/auth-helpers', async (orig) => ({
  ...(await orig<typeof import('@/lib/auth-helpers')>()),
  getAuthUser: vi.fn(async () => h.utilisateur),
  verifyArtisanOwnership: vi.fn(async () => true),
}))
vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: { from: () => ({ insert: h.insertion }) },
}))
vi.mock('@/lib/marches-scanner', () => ({ scanMarches: h.scanMarches }))

const { POST: fixyChat } = await import('@/app/api/fixy-chat/route')
const { POST: fixyAi } = await import('@/app/api/fixy-ai/route')
const { POST: comptableAi } = await import('@/app/api/comptable-ai/route')
const { POST: dceAnalyse } = await import('@/app/api/dce-analyse/route')
const { POST: analyseDevisClient } = await import('@/app/api/client/analyse-devis/route')
const { POST: materiauxAi } = await import('@/app/api/materiaux-ai/route')
const { POST: scanMarchesRoute } = await import('@/app/api/marches/scan/route')
const { POST: classerEmail } = await import('@/app/api/email-agent/classify/route')

const [GEMMA] = WORKERS_AI_MODELES

const requete = (chemin: string, corps: unknown) =>
  new NextRequest(`http://localhost${chemin}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer jeton' },
    body: JSON.stringify(corps),
  })

async function lire(reponse: Response): Promise<string> {
  const lecteur = (reponse.body as ReadableStream<Uint8Array>).getReader()
  const decodeur = new TextDecoder()
  let texte = ''
  for (;;) {
    const { done, value } = await lecteur.read()
    if (done) return texte
    texte += decodeur.decode(value)
  }
}

/** Tout message rendu au client : aucun nom de fournisseur, de modèle ni de clé. */
const FOURNISSEURS = /groq|cerebras|claude|anthropic|workers|cloudflare|gemma|qwen|llama|gpt-oss|api[_ ]?key|clé api/i

/** Groq ne répond plus (modèle retiré) ; Workers AI répond `texte`. Rend les appels réseau et ceux du binding. */
function groqRetireWorkersAIRepond(texte: string) {
  const workersAI = installerWorkersAI(() => sortieWorkersAI(texte))
  const appels = installerFetchIA(() => erreurFournisseur(404))
  return { appels, workersAI }
}

/** Aucune IA configurée : ni clé Groq ni binding Workers AI (la clé Anthropic seule n'y suffit plus). */
function aucuneIA(): () => void {
  remettreCles()
  retirerWorkersAI()
  return poserCles({ groq: false, claude: true })
}

let remettreCles: () => void

beforeEach(() => {
  // Clés Claude et Cerebras posées : la chaîne ne doit appeler ni l'un ni l'autre.
  remettreCles = poserCles({ cerebras: true })
  h.utilisateur = { id: 'u-pro', app_metadata: { role: 'artisan' } }
  h.insertion.mockClear()
  h.scanMarches.mockReset()
})

afterEach(() => {
  remettreCles()
  retirerWorkersAI()
  vi.unstubAllGlobals()
})

describe('/api/fixy-chat', () => {
  it('Groq répond avec openai/gpt-oss-120b', async () => {
    const appels = installerFetchIA(() => reponseOpenAI('Bonjour, je suis Fixy.'))
    const corps = (await (await fixyChat(requete('/api/fixy-chat', { message: 'Bonjour', role: 'copro' }))).json()) as { response: string }
    expect(corps.response).toBe('Bonjour, je suis Fixy.')
    expect(versGroq(appels)[0].corps).toMatchObject({ model: GROQ_MODEL_PRIMARY, temperature: 0.7, reasoning_effort: 'low' })
  })

  it('flux : modèle retiré chez Groq, la réponse de Workers AI arrive au même format', async () => {
    const { appels, workersAI } = groqRetireWorkersAIRepond('Réponse de Gemma')
    const reponse = await fixyChat(requete('/api/fixy-chat', { message: 'Bonjour', role: 'copro', stream: true }))
    expect(reponse.headers.get('content-type')).toBe('text/event-stream')
    expect(await lire(reponse)).toContain('"text":"Réponse de Gemma"')
    expect(workersAI).toHaveLength(1)
    expect(versClaude(appels)).toHaveLength(0)
  })

  it('aucune IA configurée : message d’indisponibilité, sans appel', async () => {
    remettreCles = aucuneIA()
    const appels = installerFetchIA(() => reponseOpenAI('ne doit pas servir'))
    const corps = (await (await fixyChat(requete('/api/fixy-chat', { message: 'Bonjour' }))).json()) as { response: string }
    expect(corps.response).toContain('temporairement indisponible')
    expect(appels).toHaveLength(0)
  })
})

describe('/api/fixy-ai (artisan)', () => {
  const demande = { message: 'Quels sont mes rendez-vous ?', artisan_id: '550e8400-e29b-41d4-a716-446655440000' }

  it('Groq : modèle principal, mode JSON, effort bas', async () => {
    const appels = installerFetchIA(() => reponseOpenAI('{"response":"Aucun rendez-vous demain.","actions":[]}'))
    const corps = (await (await fixyAi(requete('/api/fixy-ai', demande))).json()) as { success: boolean; response: string }
    expect(corps).toMatchObject({ success: true, response: 'Aucun rendez-vous demain.' })
    expect(versGroq(appels)[0].corps).toMatchObject({ model: GROQ_MODEL_PRIMARY, response_format: { type: 'json_object' }, reasoning_effort: 'low' })
  })

  it('modèle retiré chez Groq : Workers AI répond en JSON, l’artisan ne voit aucune erreur ; ni Cerebras ni Claude', async () => {
    const { appels, workersAI } = groqRetireWorkersAIRepond('{"response":"Vous avez deux rendez-vous.","actions":[]}')
    const corps = (await (await fixyAi(requete('/api/fixy-ai', demande))).json()) as { success: boolean; response: string }
    expect(corps).toMatchObject({ success: true, response: 'Vous avez deux rendez-vous.' })
    expect(versGroq(appels).map(a => a.corps.model)).toEqual([GROQ_MODEL_PRIMARY, GROQ_MODEL_RAPIDE])
    expect(versCerebras(appels)).toHaveLength(0)
    expect(versClaude(appels)).toHaveLength(0)
    expect(workersAI[0]).toMatchObject({ modele: GEMMA, entrees: { response_format: { type: 'json_object' } } })
  })

  it('Groq et Workers AI en échec : message générique', async () => {
    installerWorkersAI(() => { throw new Error('3040: Capacity temporarily exceeded') })
    installerFetchIA(() => erreurFournisseur(404))
    const corps = (await (await fixyAi(requete('/api/fixy-ai', demande))).json()) as { success: boolean; response: string }
    expect(corps.success).toBe(false)
    expect(corps.response).toBe('Erreur IA temporaire. Réessaie dans quelques instants.')
  })
})

describe('/api/comptable-ai (mode direct)', () => {
  const demande = (locale: string) => ({ messages: [{ role: 'user', content: 'Quel taux de TVA pour une rénovation ?' }], locale })

  it('modèle retiré chez Groq : Workers AI répond', async () => {
    groqRetireWorkersAIRepond('Le taux réduit de 10 % peut s’appliquer.')
    const corps = (await (await comptableAi(requete('/api/comptable-ai', demande('fr')))).json()) as { reply: string }
    expect(corps.reply).toBe('Le taux réduit de 10 % peut s’appliquer.')
  })

  it('aucune IA configurée : plus de « Clé API Groq non configurée », message dans la langue', async () => {
    remettreCles = aucuneIA()
    installerFetchIA(() => reponseOpenAI('ne doit pas servir'))
    const fr = (await (await comptableAi(requete('/api/comptable-ai', demande('fr')))).json()) as { reply: string }
    const pt = (await (await comptableAi(requete('/api/comptable-ai', demande('pt')))).json()) as { reply: string }
    expect(fr.reply).toBe('⚠️ Le service IA est indisponible pour le moment. Réessayez plus tard.')
    expect(pt.reply).toBe('⚠️ O serviço de IA está indisponível de momento. Tente mais tarde.')
    expect(fr.reply).not.toMatch(FOURNISSEURS)
  })
})

describe('/api/dce-analyse (BTP)', () => {
  const demande = {
    country: 'FR', projectType: 'Rénovation', projectDescription: 'Réfection de la toiture d’un gymnase',
    lots: [{ numero: '1', intitule: 'Couverture' }], budget: 50000, deadline: '2026-12-31',
  }

  it('modèle retiré chez Groq : Workers AI produit l’analyse ; le nom du modèle n’est plus rendu', async () => {
    const { appels } = groqRetireWorkersAIRepond('{"analyseMarche":{"resume":"Marché de couverture"}}')
    const reponse = await dceAnalyse(requete('/api/dce-analyse', demande))
    expect(reponse.status).toBe(200)
    const corps = (await reponse.json()) as { analysis: Record<string, unknown>; meta: Record<string, unknown> }
    expect(corps.analysis).toHaveProperty('analyseMarche')
    expect(corps.meta).not.toHaveProperty('model')
    expect(versGroq(appels)[0].corps).toMatchObject({ model: GROQ_MODEL_PRIMARY, max_tokens: 8000 + MARGE_RAISONNEMENT })
  })

  it('aucune IA configurée : 503, message sans nom de fournisseur ni de clé', async () => {
    remettreCles = aucuneIA()
    installerFetchIA(() => reponseOpenAI('ne doit pas servir'))
    const reponse = await dceAnalyse(requete('/api/dce-analyse', demande))
    expect(reponse.status).toBe(503)
    const { error } = (await reponse.json()) as { error: string }
    expect(error).toBe('L’analyse par IA est indisponible pour le moment. Réessayez plus tard.')
    expect(error).not.toMatch(FOURNISSEURS)
  })
})

describe('/api/client/analyse-devis', () => {
  const devis = 'Devis n° 12\nPlomberie Martin\nRemplacement du chauffe-eau\nTotal : 1 200,00 €\nValable 30 jours'
  const extraction = '{"artisan_nom":"Plomberie Martin","mentions_presentes":[],"mentions_manquantes":[]}'

  it('flux : Groq répond ; le modèle enregistré est le modèle principal, plus un nom écrit en dur', async () => {
    const appels = installerFetchIA((_url, corps) => (corps.stream ? fluxOpenAI('Devis conforme.') : reponseOpenAI(extraction)))
    const reponse = await analyseDevisClient(requete('/api/client/analyse-devis', { content: devis, stream: true }))
    const texte = await lire(reponse)
    expect(texte).toContain('"type":"scores"')
    expect(texte).toContain('"text":"Devis conforme."')
    await vi.waitFor(() => expect(h.insertion).toHaveBeenCalled())
    expect(h.insertion.mock.calls[0][0]).toMatchObject({ model: GROQ_MODEL_PRIMARY })
    expect(versGroq(appels).every(a => a.corps.model === GROQ_MODEL_PRIMARY)).toBe(true)
  })

  it('flux : principal en échec, le repli répond ; le modèle enregistré est celui du repli', async () => {
    installerFetchIA((_url, corps) => {
      if (!corps.stream) return reponseOpenAI(extraction)
      return corps.model === GROQ_MODEL_PRIMARY ? erreurFournisseur(404) : fluxOpenAI('Analyse du repli.')
    })
    const texte = await lire(await analyseDevisClient(requete('/api/client/analyse-devis', { content: devis, stream: true })))
    expect(texte).toContain('"text":"Analyse du repli."')
    await vi.waitFor(() => expect(h.insertion).toHaveBeenCalled())
    expect(h.insertion.mock.calls[0][0]).toMatchObject({ model: GROQ_MODEL_RAPIDE })
  })

  it('flux : modèle retiré chez Groq, Workers AI reprend ; le modèle enregistré est le sien', async () => {
    installerWorkersAI(() => sortieWorkersAI('Analyse de Gemma.'))
    installerFetchIA((_url, corps) => (corps.stream ? erreurFournisseur(404) : reponseOpenAI(extraction)))
    const texte = await lire(await analyseDevisClient(requete('/api/client/analyse-devis', { content: devis, stream: true })))
    expect(texte).toContain('"text":"Analyse de Gemma."')
    await vi.waitFor(() => expect(h.insertion).toHaveBeenCalled())
    expect(h.insertion.mock.calls[0][0]).toMatchObject({ model: GEMMA })
  })

  it('aucune IA configurée : 503 et message générique (plus « Clé API manquante »)', async () => {
    remettreCles = aucuneIA()
    installerFetchIA(() => reponseOpenAI('ne doit pas servir'))
    const reponse = await analyseDevisClient(requete('/api/client/analyse-devis', { content: devis }))
    expect(reponse.status).toBe(503)
    expect(((await reponse.json()) as { error: string }).error).not.toMatch(FOURNISSEURS)
  })
})

describe('/api/materiaux-ai', () => {
  const liste = '[{"name":"Carrelage grès cérame","qty":11,"unit":"m²","category":"Revêtement","norms":["DTU 52.2"],"normDetails":"Pose collée"}]'
  const prix = '{"materials":[{"name":"Carrelage grès cérame","qty":11,"unit":"m²","prices":[],"bestPrice":null,"avgPrice":25}],"totalEstimate":275,"response":"Voici les matériaux."}'

  it('liste sur le petit modèle, prix sur le principal ; modèle retiré : Workers AI reprend les prix', async () => {
    const workersAI = installerWorkersAI(() => sortieWorkersAI(prix))
    let appelsGroq = 0
    const appels = installerFetchIA(() => {
      appelsGroq += 1
      return appelsGroq === 1 ? reponseOpenAI(liste, GROQ_MODEL_RAPIDE) : erreurFournisseur(404)
    })
    const reponse = await materiauxAi(requete('/api/materiaux-ai', { query: 'Carrelage salle de bain 10 m² (test 1)', mode: 'project', locale: 'fr' }))
    const corps = (await reponse.json()) as { success: boolean; materials: Array<{ name: string }> }
    expect(corps.success).toBe(true)
    expect(corps.materials[0].name).toBe('Carrelage grès cérame')
    expect(versGroq(appels).map(a => a.corps.model)).toEqual([GROQ_MODEL_RAPIDE, GROQ_MODEL_PRIMARY, GROQ_MODEL_RAPIDE])
    expect(workersAI).toHaveLength(1)
    // L'ancien secours OpenRouter (modèle gratuit disparu) n'est plus appelé, ni Cerebras, ni Claude.
    expect(appels.some(a => /openrouter|cerebras|anthropic/.test(a.url))).toBe(false)
  })

  it('aucune IA configurée : plus de « GROQ_API_KEY non configurée », message dans la langue', async () => {
    remettreCles = aucuneIA()
    installerFetchIA(() => reponseOpenAI('ne doit pas servir'))
    const corps = (await (await materiauxAi(requete('/api/materiaux-ai', { query: 'Pintura de fachada (teste 2)', locale: 'pt' }))).json()) as { error: string }
    expect(corps.error).toBe('O assistente de materiais está indisponível de momento. Tente mais tarde.')
    expect(corps.error).not.toMatch(FOURNISSEURS)
  })
})

describe('/api/marches/scan', () => {
  const resultat = () => ({ marches: [{ title: 'Réfection de la toiture d’une école', buyer: 'Commune', location: 'Marseille', budgetMin: 50000 }], meta: {} })

  it('résumés : modèle retiré chez Groq, Workers AI les rédige', async () => {
    h.scanMarches.mockResolvedValue(resultat())
    groqRetireWorkersAIRepond('{"summaries":["Toiture d’école à refaire, budget 50 k€."]}')
    const corps = (await (await scanMarchesRoute(requete('/api/marches/scan', { metiers: ['couverture'] }))).json()) as { marches: Array<{ aiSummary?: string }> }
    expect(corps.marches[0].aiSummary).toBe('Toiture d’école à refaire, budget 50 k€.')
  })

  it('aucune IA configurée : marchés rendus sans résumé, sans appel', async () => {
    remettreCles = aucuneIA()
    h.scanMarches.mockResolvedValue(resultat())
    const appels = installerFetchIA(() => reponseOpenAI('ne doit pas servir'))
    const corps = (await (await scanMarchesRoute(requete('/api/marches/scan', { metiers: ['couverture'] }))).json()) as { marches: Array<{ aiSummary?: string }> }
    expect(corps.marches[0].aiSummary).toBeUndefined()
    expect(appels).toHaveLength(0)
  })
})

describe('/api/email-agent/classify', () => {
  const email = { from: 'resident@example.test', subject: 'Fuite d’eau au 3e étage', body: 'Il y a une fuite importante dans la cage d’escalier.' }

  beforeEach(() => {
    h.utilisateur = { id: 'u-syndic', app_metadata: { role: 'syndic' } }
  })

  it('petit appel : openai/gpt-oss-20b, sans repli vers un autre modèle', async () => {
    const appels = installerFetchIA(() => reponseOpenAI('{"urgence":"haute","type":"signalement_panne","resume":"Fuite d’eau","actions_suggerees":[]}', GROQ_MODEL_RAPIDE))
    const corps = (await (await classerEmail(requete('/api/email-agent/classify', email))).json()) as { classification: { urgence: string } }
    expect(corps.classification.urgence).toBe('haute')
    expect(versGroq(appels).map(a => a.corps.model)).toEqual([GROQ_MODEL_RAPIDE])
  })

  it('Groq en échec et pas de relais : classement heuristique, comme avant', async () => {
    retirerWorkersAI()
    installerFetchIA(() => erreurFournisseur(404))
    const corps = (await (await classerEmail(requete('/api/email-agent/classify', email))).json()) as { classification: { urgence: string; type: string } }
    expect(corps.classification).toMatchObject({ urgence: 'haute', type: 'signalement_panne' })
  })
})

describe('lib/rapport-ia', () => {
  const rapport = JSON.stringify({
    introduction: 'Intervention réalisée chez le client pour une fuite.',
    travaux_realises: 'Remplacement du joint et contrôle de l’étanchéité.',
    observations: 'Aucune autre anomalie constatée sur place.',
    conclusion: 'Installation remise en service, fonctionnement normal.',
  })
  const donnees = {
    motif_nom: 'Fuite sous évier', artisan_prenom: 'Jean', artisan_nom: 'Test', client_prenom: 'Marie',
    adresse_chantier: '1 rue de l’Exemple, Marseille', date_intervention: new Date('2026-11-10T12:00:00'),
  }
  const actifInitial = process.env.RAPPORT_IA_ACTIF

  beforeEach(() => {
    process.env.RAPPORT_IA_ACTIF = 'true'
  })

  afterEach(() => {
    if (actifInitial === undefined) delete process.env.RAPPORT_IA_ACTIF
    else process.env.RAPPORT_IA_ACTIF = actifInitial
  })

  it('modèle retiré chez Groq : le texte vient de Workers AI, pas du gabarit de secours', async () => {
    const { genererTexteRapport } = await import('@/lib/rapport-ia')
    const { appels, workersAI } = groqRetireWorkersAIRepond(rapport)
    const contenu = await genererTexteRapport(donnees)
    expect(contenu.introduction).toBe('Intervention réalisée chez le client pour une fuite.')
    expect(contenu.source).toBe('groq') // code enregistré en base et lu par l'appli mobile : inchangé
    expect(versGroq(appels)[0].corps.model).toBe(GROQ_MODEL_PRIMARY)
    expect(workersAI).toHaveLength(1)
  })
})
