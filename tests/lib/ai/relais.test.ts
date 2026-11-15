// @vitest-environment node
// tests/lib/ai/relais.test.ts — chaîne commune des agents artisan / BTP (lib/ai/relais.ts), budget de raisonnement
// des modèles gpt-oss (lib/ai/raisonnement.ts) et nouvel essai après un 429 (lib/ai/reessai.ts).
//
// Constat des 14-15/11/2026 : Groq a retiré les modèles Llama (16/08/2026, vision le 17/07/2026) et le secours
// Cerebras nommait un modèle retiré lui aussi : tous les agents répondaient « Model does not exist ». Le relais et la
// lecture des images passent par Workers AI (binding du Worker, sans clé) : la clé Anthropic est refusée en production
// depuis le 15/11/2026, et ni Anthropic ni Cerebras ne sont des sous-traitants déclarés. Seuls `fetch` et le binding
// sont simulés : lib/groq, lib/workers-ai et lib/ai/relais tournent pour de vrai.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  appelerIA,
  appelerVision,
  dataUrlDocument,
  fluxIA,
  iaTexteDisponible,
  MAX_OCTETS_DOCUMENT,
  MAX_PAGES_PDF,
  PLAFOND_RELAIS_CARACTERES,
  typeDocument,
  visionDisponible,
} from '@/lib/ai/relais'
import { estModeleRaisonnement, MARGE_RAISONNEMENT, parametresRaisonnement } from '@/lib/ai/raisonnement'
import { delaiApres429 } from '@/lib/ai/reessai'
import {
  CEREBRAS_MODEL_PRIMARY,
  GROQ_MODEL_FALLBACK,
  GROQ_MODEL_PRIMARY,
  GROQ_MODEL_RAPIDE,
  WORKERS_AI_MODELES,
} from '@/lib/constants'
import { logger } from '@/lib/logger'
import {
  dataUrl,
  erreurFournisseur,
  fluxOpenAI,
  installerFetchIA,
  installerWorkersAI,
  pdfSynthetique,
  poserCles,
  reponseOpenAI,
  retirerWorkersAI,
  sortieWorkersAI,
  versCerebras,
  versClaude,
  versGroq,
} from '../../helpers/faux-fournisseurs-ia'

vi.mock('@/lib/env', async () => (await import('../../helpers/faux-fournisseurs-ia')).envAvecWorkersAI())

const [GEMMA, QWEN] = WORKERS_AI_MODELES
const DEMANDE = { messages: [{ role: 'system', content: 'Consigne.' }, { role: 'user', content: 'Question ?' }], max_tokens: 500 }

async function lire(flux: ReadableStream<Uint8Array>): Promise<string> {
  const lecteur = flux.getReader()
  const decodeur = new TextDecoder()
  let texte = ''
  for (;;) {
    const { done, value } = await lecteur.read()
    if (done) return texte
    texte += decodeur.decode(value)
  }
}

let remettreCles: () => void

beforeEach(() => {
  // Clés Groq, Claude et Cerebras posées : la chaîne ne doit appeler ni Claude ni Cerebras.
  remettreCles = poserCles({ cerebras: true })
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined)
  vi.spyOn(logger, 'error').mockImplementation(() => undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  remettreCles()
  retirerWorkersAI()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('modèles (lib/constants.ts)', () => {
  it('plus aucun modèle retiré : gpt-oss chez Groq et Cerebras, Gemma 4 puis Qwen 3.8 chez Workers AI', () => {
    expect(GROQ_MODEL_PRIMARY).toBe('openai/gpt-oss-120b')
    expect(GROQ_MODEL_RAPIDE).toBe('openai/gpt-oss-20b')
    expect(GROQ_MODEL_FALLBACK).toBe(GROQ_MODEL_RAPIDE)
    expect(CEREBRAS_MODEL_PRIMARY).toBe('gpt-oss-120b')
    expect(WORKERS_AI_MODELES).toEqual(['@cf/google/gemma-4-26b-a4b-it', '@cf/qwen/qwen3.8-27b'])
    for (const m of [GROQ_MODEL_PRIMARY, GROQ_MODEL_FALLBACK, CEREBRAS_MODEL_PRIMARY]) expect(m).not.toMatch(/llama/i)
  })
})

describe('lib/ai/raisonnement', () => {
  it('reconnaît les modèles gpt-oss, avec ou sans préfixe', () => {
    expect(estModeleRaisonnement('openai/gpt-oss-120b')).toBe(true)
    expect(estModeleRaisonnement('gpt-oss-120b')).toBe(true)
    expect(estModeleRaisonnement('claude-sonnet-5-5')).toBe(false)
    expect(estModeleRaisonnement(GEMMA)).toBe(false)
  })

  it('gpt-oss : budget majoré de la marge et effort bas par défaut ; autre modèle : inchangé', () => {
    expect(parametresRaisonnement('openai/gpt-oss-120b', 500)).toEqual({ max_tokens: 500 + MARGE_RAISONNEMENT, reasoning_effort: 'low' })
    expect(parametresRaisonnement('gpt-oss-120b', 800, 'medium')).toEqual({ max_tokens: 800 + MARGE_RAISONNEMENT, reasoning_effort: 'medium' })
    expect(parametresRaisonnement('autre-modele', 500)).toEqual({ max_tokens: 500 })
  })
})

describe('appelerIA', () => {
  it('Groq répond : modèle principal gpt-oss, effort bas, budget majoré ; aucun relais', async () => {
    const workersAI = installerWorkersAI(() => sortieWorkersAI('ne doit pas servir'))
    const appels = installerFetchIA(() => reponseOpenAI('Réponse Groq'))
    const r = await appelerIA(DEMANDE, { contexte: 'test' })
    expect(r.choices[0].message.content).toBe('Réponse Groq')
    expect(versGroq(appels)[0].corps).toMatchObject({ model: GROQ_MODEL_PRIMARY, reasoning_effort: 'low', max_tokens: 500 + MARGE_RAISONNEMENT })
    expect(workersAI).toHaveLength(0)
  })

  it('modèle retiré (404) chez Groq : essai du repli, puis Workers AI (Gemma 4) répond ; ni Cerebras ni Claude', async () => {
    const workersAI = installerWorkersAI(() => sortieWorkersAI('Réponse Gemma'))
    const appels = installerFetchIA(() => erreurFournisseur(404))
    const r = await appelerIA(DEMANDE, { contexte: 'test-relais' })
    expect(r.choices[0].message.content).toBe('Réponse Gemma')
    expect(r.model).toBe(GEMMA)
    expect(versGroq(appels).map(a => a.corps.model)).toEqual([GROQ_MODEL_PRIMARY, GROQ_MODEL_FALLBACK])
    expect(versCerebras(appels)).toHaveLength(0)
    expect(versClaude(appels)).toHaveLength(0)
    expect(workersAI[0]).toMatchObject({ modele: GEMMA, entrees: { max_completion_tokens: 500, chat_template_kwargs: { enable_thinking: false } } })
    // Modèle retiré : échec durable, envoyé à Sentry (erreur en 3e argument) pour qu'un retrait ne passe plus inaperçu.
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('échec durable de Groq'),
      expect.objectContaining({ module: 'ia-relais', statut: 404 }),
      expect.objectContaining({ message: expect.stringContaining('Groq 404') }),
    )
  })

  it('Gemma 4 retiré par Cloudflare (5028) : Qwen 3.8 prend la main ; mode JSON transmis', async () => {
    const workersAI = installerWorkersAI(modele => {
      if (modele === GEMMA) throw new Error('5028: model deprecated')
      return sortieWorkersAI('{"ok":true}')
    })
    installerFetchIA(() => erreurFournisseur(404))
    const r = await appelerIA({ ...DEMANDE, response_format: { type: 'json_object' } }, { contexte: 'test' })
    expect(JSON.parse(r.choices[0].message.content)).toEqual({ ok: true })
    expect(workersAI.map(a => a.modele)).toEqual([GEMMA, QWEN])
    expect(workersAI[1].entrees).toMatchObject({ response_format: { type: 'json_object' } })
  })

  it('requête trop grosse pour l’offre gratuite (413) : simple avertissement, pas d’alerte Sentry', async () => {
    installerWorkersAI(() => sortieWorkersAI('Réponse Gemma'))
    installerFetchIA(() => erreurFournisseur(413, 'Request too large'))
    await appelerIA(DEMANDE, { contexte: 'test' })
    expect(logger.error).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('échec passager'), expect.objectContaining({ erreur: expect.stringContaining('413') }))
  })

  it('Gemma retiré (5028) : alerte Sentry, Qwen répond', async () => {
    installerWorkersAI(modele => {
      if (modele === GEMMA) throw new Error('5028: model deprecated')
      return sortieWorkersAI('Réponse Qwen')
    })
    installerFetchIA(() => erreurFournisseur(413))
    const r = await appelerIA(DEMANDE, { contexte: 'test' })
    expect(r.model).toBe(QWEN)
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(`Workers AI ${GEMMA}`),
      expect.objectContaining({ module: 'ia-relais', code: 5028 }),
      expect.anything(),
    )
  })

  it('mode JSON : une réponse de Gemma qui n’est pas du JSON passe la main à Qwen', async () => {
    const workersAI = installerWorkersAI(modele => sortieWorkersAI(modele === GEMMA ? 'Voici la réponse : rien' : '{"ok":true}'))
    installerFetchIA(() => erreurFournisseur(413))
    const r = await appelerIA({ ...DEMANDE, response_format: { type: 'json_object' } }, { contexte: 'test' })
    expect(JSON.parse(r.choices[0].message.content)).toEqual({ ok: true })
    expect(workersAI.map(a => a.modele)).toEqual([GEMMA, QWEN])
  })

  it('tours consécutifs d’un même rôle fusionnés pour Workers AI, message répété gardé une fois', async () => {
    const workersAI = installerWorkersAI(() => sortieWorkersAI('Réponse Gemma'))
    installerFetchIA(() => erreurFournisseur(413))
    await appelerIA({
      messages: [
        { role: 'system', content: 'Consigne.' },
        { role: 'user', content: 'Bonjour' },
        { role: 'assistant', content: 'Bonjour, que puis-je faire ?' },
        { role: 'user', content: 'Mes rendez-vous ?' },
        { role: 'user', content: 'Mes rendez-vous ?' },
        { role: 'user', content: 'Et demain ?' },
      ],
    }, { contexte: 'test' })
    const envoyes = workersAI[0].entrees.messages as Array<{ role: string; content: string }>
    expect(envoyes.map(m => m.role)).toEqual(['system', 'user', 'assistant', 'user'])
    expect(envoyes[3].content).toBe('Mes rendez-vous ?\n\nEt demain ?')
  })

  it('échéance trop proche pour lancer Workers AI : pas de relais, l’erreur de Groq remonte', async () => {
    const workersAI = installerWorkersAI(() => sortieWorkersAI('ne doit pas servir'))
    installerFetchIA(() => erreurFournisseur(413))
    await expect(appelerIA(DEMANDE, { contexte: 'test', budgetMs: 1_000 })).rejects.toThrow(/aucun modèle essayé/)
    expect(workersAI).toHaveLength(0)
  })

  it('quota du compte épuisé (3036) : pas d’essai du second modèle, l’erreur remonte', async () => {
    const workersAI = installerWorkersAI(() => { throw new Error('3036: Account limited') })
    installerFetchIA(() => erreurFournisseur(404))
    await expect(appelerIA(DEMANDE, { contexte: 'test' })).rejects.toThrow(/3036/)
    expect(workersAI).toHaveLength(1)
  })

  it('réponse vide de Groq (budget épuisé par le raisonnement) : relais par Workers AI', async () => {
    installerWorkersAI(() => sortieWorkersAI('Réponse Gemma'))
    installerFetchIA(() => reponseOpenAI('', GROQ_MODEL_PRIMARY, 'length'))
    const r = await appelerIA(DEMANDE, { contexte: 'test' })
    expect(r.choices[0].message.content).toBe('Réponse Gemma')
  })

  it('réponse vide de Groq et relais en échec : la réponse de Groq est rendue, comme avant (repli de la route)', async () => {
    installerWorkersAI(() => { throw new Error('3040: Capacity temporarily exceeded') })
    installerFetchIA(() => reponseOpenAI('', GROQ_MODEL_PRIMARY, 'length'))
    const r = await appelerIA(DEMANDE, { contexte: 'test' })
    expect(r.choices[0].message.content).toBe('')
    expect(r.choices[0].finish_reason).toBe('length')
  })

  it('Workers AI absent (hors Worker) : l’erreur de Groq remonte, sans relais', async () => {
    retirerWorkersAI()
    const appels = installerFetchIA(() => erreurFournisseur(404))
    await expect(appelerIA(DEMANDE, { contexte: 'test' })).rejects.toThrow(/Groq 404/)
    expect(versClaude(appels)).toHaveLength(0)
    expect(versCerebras(appels)).toHaveLength(0)
  })

  it('quota Groq épuisé (429) et relais possible : aucun nouvel essai ni attente, relais aussitôt', async () => {
    installerWorkersAI(() => sortieWorkersAI('Réponse Gemma'))
    const appels = installerFetchIA(() =>
      Response.json({ error: { message: 'rate_limit_exceeded' } }, { status: 429, headers: { 'retry-after': '5' } }))
    const r = await appelerIA(DEMANDE, { contexte: 'test' })
    expect(r.choices[0].message.content).toBe('Réponse Gemma')
    // Un seul essai par modèle (avant : trois, avec 5 s d'attente entre chacun) : l'écran n'abandonne plus avant.
    expect(versGroq(appels).map(a => a.corps.model)).toEqual([GROQ_MODEL_PRIMARY, GROQ_MODEL_FALLBACK])
  })

  it('demande trop longue : pas de relais (quota du compte borné), l’erreur de Groq remonte', async () => {
    const workersAI = installerWorkersAI(() => sortieWorkersAI('ne doit pas servir'))
    installerFetchIA(() => erreurFournisseur(413, 'Request too large'))
    const longue = { messages: [{ role: 'user', content: 'x'.repeat(PLAFOND_RELAIS_CARACTERES + 1) }] }
    await expect(appelerIA(longue, { contexte: 'test' })).rejects.toThrow(/Groq 413/)
    expect(workersAI).toHaveLength(0)
  })

  it('sans clé Groq : Workers AI directement', async () => {
    remettreCles()
    remettreCles = poserCles({ groq: false })
    installerWorkersAI(() => sortieWorkersAI('Réponse Gemma'))
    const appels = installerFetchIA(() => reponseOpenAI('ne doit pas servir'))
    const r = await appelerIA(DEMANDE, { contexte: 'test' })
    expect(r.choices[0].message.content).toBe('Réponse Gemma')
    expect(appels).toHaveLength(0)
  })
})

describe('fluxIA', () => {
  it('flux Groq : seul le texte est rendu (le raisonnement est ignoré)', async () => {
    const appels = installerFetchIA(() => fluxOpenAI('Bonjour'))
    const { flux, modele } = await fluxIA(DEMANDE, { contexte: 'test' })
    expect(modele).toBe(GROQ_MODEL_PRIMARY)
    const texte = await lire(flux)
    expect(texte).toContain('"text":"Bonjour"')
    expect(texte).not.toContain('réfléchis')
    expect(versGroq(appels)[0].corps).toMatchObject({ model: GROQ_MODEL_PRIMARY, stream: true, reasoning_effort: 'low' })
  })

  it('flux : le principal en échec, le repli répond ; le modèle annoncé est celui du repli', async () => {
    installerFetchIA((_url, corps) => (corps.model === GROQ_MODEL_PRIMARY ? erreurFournisseur(404) : fluxOpenAI('Bonjour')))
    const { flux, modele } = await fluxIA(DEMANDE, { contexte: 'test' })
    expect(modele).toBe(GROQ_MODEL_FALLBACK)
    expect(await lire(flux)).toContain('"text":"Bonjour"')
  })

  it('flux Groq en échec : la réponse de Workers AI arrive d’un bloc, au même format', async () => {
    installerWorkersAI(() => sortieWorkersAI('Bonjour de Gemma'))
    installerFetchIA(() => erreurFournisseur(404))
    const { flux, modele } = await fluxIA(DEMANDE, { contexte: 'test' })
    expect(modele).toBe(GEMMA)
    const texte = await lire(flux)
    expect(texte).toBe('data: {"text":"Bonjour de Gemma"}\n\ndata: [DONE]\n\n')
  })
})

describe('appelerVision', () => {
  const demandeDocument = (url: string) => ({
    messages: [{ role: 'user', content: [{ type: 'text', text: 'Lis ce document.' }, { type: 'image_url', image_url: { url } }] }],
    max_tokens: 800,
  })
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d])

  it('image : lue par Workers AI (Gemma 4), document transmis en image_url ; jamais Groq ni Claude', async () => {
    const workersAI = installerWorkersAI(() => sortieWorkersAI('TEXTE LU'))
    const appels = installerFetchIA(() => reponseOpenAI('ne doit pas servir'))
    const r = await appelerVision(demandeDocument(dataUrl('image/png', png)), { contexte: 'test' })
    expect(r.choices[0].message.content).toBe('TEXTE LU')
    expect(appels).toHaveLength(0)
    const message = (workersAI[0].entrees.messages as Array<{ content: Array<{ type: string; image_url?: { url: string } }> }>)[0]
    expect(message.content[1].image_url?.url).toMatch(/^data:image\/png;base64,/)
  })

  it('PDF admis par la route : lu par sa couche de texte, sans aucun modèle', async () => {
    const workersAI = installerWorkersAI(() => sortieWorkersAI('ne doit pas servir'))
    const appels = installerFetchIA(() => reponseOpenAI('ne doit pas servir'))
    const pdf = pdfSynthetique(1, 1, ['Extrait Kbis - Greffe du tribunal de commerce', 'Denomination : MACONNERIE TEST', 'SIRET : 123 456 789 00015'])
    const r = await appelerVision(demandeDocument(dataUrl('application/pdf', pdf)), { contexte: 'test', pdf: true })
    expect(r.choices[0].message.content).toContain('Denomination : MACONNERIE TEST')
    expect(r.choices[0].message.content).toContain('SIRET : 123 456 789 00015')
    expect(workersAI).toHaveLength(0)
    expect(appels).toHaveLength(0)
  })

  it('PDF scanné (sans texte) : rejet, aucun modèle ne lit les PDF', async () => {
    const workersAI = installerWorkersAI(() => sortieWorkersAI('ne doit pas servir'))
    const pdf = dataUrl('application/pdf', pdfSynthetique(1))
    await expect(appelerVision(demandeDocument(pdf), { contexte: 'test', pdf: true })).rejects.toThrow(/sans texte/)
    expect(workersAI).toHaveLength(0)
  })

  it('bornes : PDF non admis, image trop lourde, PDF trop long, adresse web, HEIC — rejet sans appel', async () => {
    const workersAI = installerWorkersAI(() => sortieWorkersAI('ne doit pas servir'))
    const pdf = dataUrl('application/pdf', pdfSynthetique(1, 1, ['Texte du document, assez long pour etre lu tel quel.']))
    await expect(appelerVision(demandeDocument(pdf), { contexte: 'test' })).rejects.toThrow(/format/)
    const imageLourde = dataUrl('image/jpeg', new Uint8Array(MAX_OCTETS_DOCUMENT + 1))
    await expect(appelerVision(demandeDocument(imageLourde), { contexte: 'test' })).rejects.toThrow(/volumineux/)
    const pdfLong = dataUrl('application/pdf', pdfSynthetique(MAX_PAGES_PDF + 1))
    await expect(appelerVision(demandeDocument(pdfLong), { contexte: 'test', pdf: true })).rejects.toThrow(/trop long/)
    const pdfQuatrePages = dataUrl('application/pdf', pdfSynthetique(4))
    await expect(appelerVision(demandeDocument(pdfQuatrePages), { contexte: 'test', pdf: true, maxPagesPdf: 3 })).rejects.toThrow(/trop long/)
    await expect(appelerVision(demandeDocument('https://exemple.test/kbis.png'), { contexte: 'test' })).rejects.toThrow(/format/)
    await expect(appelerVision(demandeDocument('data:image/heic;base64,AAAA'), { contexte: 'test' })).rejects.toThrow(/format/)
    expect(workersAI).toHaveLength(0)
  })

  it('image et Workers AI absent : rejet, pas de secours Groq (aucun modèle de vision en production)', async () => {
    retirerWorkersAI()
    const appels = installerFetchIA(() => reponseOpenAI('ne doit pas servir'))
    await expect(appelerVision(demandeDocument(dataUrl('image/png', png)), { contexte: 'test' })).rejects.toThrow(/indisponible/)
    expect(appels).toHaveLength(0)
  })
})

describe('disponibilité et type des fichiers', () => {
  it('texte : une clé Groq ou Workers AI ; images : Workers AI seul (Claude et Cerebras n’y suffisent plus)', async () => {
    remettreCles()
    remettreCles = poserCles({ groq: false, claude: true, cerebras: true })
    retirerWorkersAI()
    expect(await iaTexteDisponible()).toBe(false)
    expect(await visionDisponible()).toBe(false)
    installerWorkersAI(() => sortieWorkersAI(''))
    expect(await iaTexteDisponible()).toBe(true)
    expect(await visionDisponible()).toBe(true)
    retirerWorkersAI()
    remettreCles()
    remettreCles = poserCles({ groq: true, claude: false })
    expect(await iaTexteDisponible()).toBe(true)
    expect(await visionDisponible()).toBe(false)
  })

  it('reconnaît PDF, PNG, JPEG, GIF et WebP par leurs premiers octets', () => {
    const octets = (...o: number[]) => Uint8Array.from(o)
    expect(typeDocument(octets(0x25, 0x50, 0x44, 0x46, 0x2d))).toBe('application/pdf')
    expect(typeDocument(octets(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe('image/png')
    expect(typeDocument(octets(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg')
    expect(typeDocument(octets(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe('image/gif')
    expect(typeDocument(octets(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50))).toBe('image/webp')
    expect(typeDocument(octets(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x41, 0x56, 0x49, 0x20))).toBeNull()
    expect(typeDocument(octets(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70))).toBeNull() // HEIC
    expect(typeDocument(new Uint8Array())).toBeNull()
  })

  it('data URL d’une image du navigateur : vrai type d’après le contenu, type déclaré gardé sinon', () => {
    const png = Buffer.from(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])).toString('base64')
    expect(dataUrlDocument(`data:image/jpeg;base64,${png}`)).toBe(`data:image/png;base64,${png}`)
    expect(dataUrlDocument(png, 'image/webp')).toBe(`data:image/png;base64,${png}`)
    expect(dataUrlDocument('AAAAAAAA', 'image/webp')).toBe('data:image/webp;base64,AAAAAAAA')
  })
})

describe('nouvel essai après un 429 (lib/ai/reessai)', () => {
  it('attente courte : nouvel essai ; dernier essai ou quota lointain : pas d’attente, modèle suivant', () => {
    expect(delaiApres429('2', 0, 2)).toBe(2000)
    expect(delaiApres429('0', 0, 2)).toBe(0)
    expect(delaiApres429(null, 1, 2)).toBe(4000)
    expect(delaiApres429('2', 2, 2)).toBeNull() // dernier essai : attendre ne sert à rien
    expect(delaiApres429('3600', 0, 2)).toBeNull() // quota du jour épuisé
    expect(delaiApres429('date HTTP', 0, 2)).toBe(2000)
  })
})
