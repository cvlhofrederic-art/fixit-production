// @vitest-environment node
// tests/api/ia-secours-syndic.test.ts — secours Groq et Cerebras des agents Syndic.
//
// Les agents Syndic passent par Claude ; sans clé Anthropic, ou si Claude échoue, ils basculent sur Groq puis
// Cerebras. Ces secours nommaient des modèles retirés (`llama-3.3-70b-versatile`, `llama-3.1-8b-instant` chez Groq le
// 16/08/2026, `llama3.1-70b` chez Cerebras) : la bascule ne pouvait plus répondre. Seul `fetch` est simulé.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { CEREBRAS_MODEL_PRIMARY, GROQ_MODEL_PRIMARY, GROQ_MODEL_RAPIDE } from '@/lib/constants'
import { MARGE_RAISONNEMENT } from '@/lib/ai/raisonnement'
import type { DraftPromptInput } from '@/lib/syndic/alfredo-draft'
import { erreurFournisseur, installerFetchIA, poserCles, reponseOpenAI, versCerebras, versClaude, versGroq } from '../helpers/faux-fournisseurs-ia'

vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())
vi.mock('@/lib/auth-helpers', async (orig) => ({
  ...(await orig<typeof import('@/lib/auth-helpers')>()),
  getAuthUser: vi.fn(async () => ({ id: 'u-syndic', app_metadata: { role: 'syndic' } })),
}))

const { POST: chatbotWhatsapp } = await import('@/app/api/syndic/chatbot-whatsapp/route')
const { POST: analyseDevisSyndic } = await import('@/app/api/syndic/analyse-devis/route')
const { generateDraftReply } = await import('@/lib/syndic/alfredo-draft')
const { classifyEmailWithGroq } = await import('@/lib/syndic/alfredo-classify')
const { extractMetadataFromText } = await import('@/lib/syndic/lea-documents-extract')

const requete = (chemin: string, corps: unknown) =>
  new NextRequest(`http://localhost${chemin}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer jeton' },
    body: JSON.stringify(corps),
  })

let remettreCles: () => void

beforeEach(() => {
  // Pas de clé Anthropic : on éprouve le secours.
  remettreCles = poserCles({ claude: false })
})

afterEach(() => {
  remettreCles()
  vi.unstubAllGlobals()
})

describe('/api/syndic/chatbot-whatsapp', () => {
  it('appelle Groq avec openai/gpt-oss-120b, effort bas et budget majoré', async () => {
    const appels = installerFetchIA(() => reponseOpenAI('{"reply":"Obrigado, vamos tratar.","intent":"incident","confidence":0.9,"shouldCreateIncident":true}'))
    const corps = (await (await chatbotWhatsapp(requete('/api/syndic/chatbot-whatsapp', { message: 'Há uma fuga de água.' }))).json()) as { intent: string }
    expect(corps.intent).toBe('incident')
    expect(versGroq(appels)[0].corps).toMatchObject({ model: GROQ_MODEL_PRIMARY, reasoning_effort: 'low', max_tokens: 500 + MARGE_RAISONNEMENT })
  })
})

describe('/api/syndic/analyse-devis (mode seguro)', () => {
  const demande = { content: 'Apólice de seguro multirriscos do condomínio, prémio anual 1 200,00 €.', type: 'seguro', locale: 'pt' }

  it('sans Claude : secours Groq sur openai/gpt-oss-120b, puis Cerebras sur gpt-oss-120b', async () => {
    remettreCles()
    remettreCles = poserCles({ claude: false, cerebras: true })
    const appels = installerFetchIA(url => (url.includes('cerebras') ? reponseOpenAI('Análise do seguro.', CEREBRAS_MODEL_PRIMARY) : erreurFournisseur(404)))
    const reponse = await analyseDevisSyndic(requete('/api/syndic/analyse-devis', demande))
    expect(((await reponse.json()) as { analysis: string }).analysis).toBe('Análise do seguro.')
    expect(versGroq(appels)[0].corps).toMatchObject({ model: GROQ_MODEL_PRIMARY, reasoning_effort: 'low', max_tokens: 5000 + MARGE_RAISONNEMENT })
    expect(versCerebras(appels)[0].corps).toMatchObject({ model: CEREBRAS_MODEL_PRIMARY, reasoning_effort: 'low' })
    expect(versClaude(appels)).toHaveLength(0)
  })

  it('aucune IA configurée : 503, message sans nom de clé', async () => {
    remettreCles()
    remettreCles = poserCles({ groq: false, claude: false })
    installerFetchIA(() => reponseOpenAI('ne doit pas servir'))
    const reponse = await analyseDevisSyndic(requete('/api/syndic/analyse-devis', demande))
    expect(reponse.status).toBe(503)
    const { error } = (await reponse.json()) as { error: string }
    expect(error).toBe('A análise por IA está indisponível de momento. Tente mais tarde.')
    expect(error).not.toMatch(/groq|claude|api|chave/i)
  })
})

describe('Alfredo et Léa (lib/syndic) : modèle du secours Groq', () => {
  it('brouillon de réponse : openai/gpt-oss-120b', async () => {
    const appels = installerFetchIA(() => reponseOpenAI('{"subject_suggested":"Re: Fuite","body_text":"Bonjour,","body_html":"<p>Bonjour,</p>","confidence":0.8}'))
    const entree: DraftPromptInput = {
      email: { from: 'resident@example.test', subject: 'Fuite', body_text: 'Une fuite au 3e.', received_at: '2026-11-15T09:00:00Z' },
      client_context: {} as DraftPromptInput['client_context'],
    }
    const brouillon = await generateDraftReply(entree, 'fr')
    expect(brouillon.subject_suggested).toBe('Re: Fuite')
    expect(versGroq(appels)[0].corps.model).toBe(GROQ_MODEL_PRIMARY)
  })

  it('classement d’un e-mail : openai/gpt-oss-20b', async () => {
    const appels = installerFetchIA(() => reponseOpenAI('{"urgence":"haute","type_demande":"sinistre","resume_court":"Fuite"}', GROQ_MODEL_RAPIDE))
    const resultat = await classifyEmailWithGroq({ from: 'resident@example.test', subject: 'Fuite', body_text: 'Une fuite au 3e.' }, 'fr')
    expect(resultat.urgence).toBe('haute')
    expect(versGroq(appels).map(a => a.corps.model)).toEqual([GROQ_MODEL_RAPIDE])
  })

  it('métadonnées d’un document (Léa) : openai/gpt-oss-120b', async () => {
    const appels = installerFetchIA(() => reponseOpenAI('{"fournisseur":"Plomberie Test","montant_ttc":120}'))
    const meta = await extractMetadataFromText('Facture n° F-7 Plomberie Test — total 120,00 € TTC — échéance 30 jours.')
    expect(meta.fournisseur).toBe('Plomberie Test')
    expect(versGroq(appels)[0].corps.model).toBe(GROQ_MODEL_PRIMARY)
  })
})
