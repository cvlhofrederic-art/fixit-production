// @vitest-environment node
// tests/api/ia-documents.test.ts — lecture des documents (Kbis, pièce d'identité, ticket de caisse, facture
// fournisseur, OCR de l'agent e-mail).
//
// Le seul modèle de vision de Groq (`meta-llama/llama-4-scout-17b-16e-instruct`) a été retiré le 17/07/2026 : depuis,
// chaque lecture échouait (pièce d'identité et Kbis jugés illisibles, KYC rejetés). Les images sont désormais lues par
// Workers AI (binding du Worker, sans clé ; Cloudflare est déjà sous-traitant déclaré), les PDF par leur couche de
// texte, sans modèle (lib/ai/relais.ts). Seuls `fetch` et le binding sont simulés.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { WORKERS_AI_MODELES } from '@/lib/constants'
import {
  installerFetchIA,
  installerWorkersAI,
  pdfSynthetique,
  poserCles,
  reponseOpenAI,
  retirerWorkersAI,
  sortieWorkersAI,
} from '../helpers/faux-fournisseurs-ia'

const h = vi.hoisted(() => ({ utilisateur: { id: 'u-artisan', app_metadata: { role: 'artisan' } } as Record<string, unknown> | null }))

vi.mock('@/lib/env', async () => (await import('../helpers/faux-fournisseurs-ia')).envAvecWorkersAI())
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())
vi.mock('@/lib/auth-helpers', async (orig) => ({
  ...(await orig<typeof import('@/lib/auth-helpers')>()),
  getAuthUser: vi.fn(async () => h.utilisateur),
}))

const { POST: verifierKbis } = await import('@/app/api/verify-kbis/route')
const { POST: verifierIdentite } = await import('@/app/api/verify-id/route')
const { POST: lireTicket } = await import('@/app/api/receipt-scan/route')
const { POST: lireFactureFournisseur } = await import('@/app/api/supplier-invoice-scan/route')
const { POST: lireDocumentEmail } = await import('@/app/api/email-agent/ocr/route')

const [GEMMA] = WORKERS_AI_MODELES
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d])
const IMAGE_DATA_URL = `data:image/jpeg;base64,${Buffer.from(JPEG).toString('base64')}`
const KBIS_PDF = pdfSynthetique(1, 1, [
  'EXTRAIT KBIS - Greffe du tribunal de commerce',
  'Denomination : MACONNERIE DUPONT SARL',
  'SIRET : 123 456 789 00012',
  'Adresse du siege : 1 rue de la Paix 13001 Marseille',
])

function formulaire(url: string, champs: Record<string, string | File>): NextRequest {
  const fd = new FormData()
  for (const [cle, valeur] of Object.entries(champs)) fd.append(cle, valeur)
  return new NextRequest(url, { method: 'POST', body: fd })
}

function json(url: string, corps: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer jeton' },
    body: JSON.stringify(corps),
  })
}

/** Data URL de l'image transmise au modèle (deuxième partie du message : consigne, puis document). */
const imageEnvoyee = (entrees: Record<string, unknown>) =>
  (entrees.messages as Array<{ content: Array<{ type: string; image_url?: { url: string } }> }>)[0].content
    .find(p => p.type === 'image_url')?.image_url?.url ?? ''

const FOURNISSEURS = /groq|cerebras|claude|anthropic|workers|cloudflare|gemma|qwen|llama|model|api[_ ]?key|clé/i

let remettreCles: () => void

beforeEach(() => {
  remettreCles = poserCles()
  h.utilisateur = { id: 'u-artisan', app_metadata: { role: 'artisan' } }
  // Aucun appel réseau réel : un test qui appellerait Groq par régression recevrait cette réponse.
  installerFetchIA(() => reponseOpenAI('ne doit pas servir'))
})

afterEach(() => {
  remettreCles()
  retirerWorkersAI()
  vi.unstubAllGlobals()
})

describe('/api/verify-kbis', () => {
  it('Kbis en PDF : lu par sa couche de texte, sans aucun modèle ni appel réseau', async () => {
    const workersAI = installerWorkersAI(() => sortieWorkersAI('ne doit pas servir'))
    const appels = installerFetchIA(() => reponseOpenAI('ne doit pas servir'))
    const reponse = await verifierKbis(formulaire('http://localhost/api/verify-kbis', {
      file: new File([KBIS_PDF], 'kbis.pdf', { type: 'application/pdf' }),
      market: 'fr_artisan',
    }))
    expect(reponse.status).toBe(200)
    const corps = (await reponse.json()) as { success: boolean; extracted: { identifiant: string | null } }
    expect(corps).toMatchObject({ success: true, extracted: { identifiant: '12345678900012' } })
    expect(workersAI).toHaveLength(0)
    expect(appels).toHaveLength(0)
  })

  it('Kbis photographié : lu par Workers AI (Gemma 4)', async () => {
    const workersAI = installerWorkersAI(() => sortieWorkersAI(
      'EXTRAIT KBIS\nDénomination : MAÇONNERIE DUPONT SARL\nSIRET : 123 456 789 00012\nAdresse du siège : 1 rue de la Paix 13001 Marseille'))
    const reponse = await verifierKbis(formulaire('http://localhost/api/verify-kbis', {
      file: new File([JPEG], 'kbis.jpg', { type: 'image/jpeg' }),
      market: 'fr_artisan',
    }))
    expect(((await reponse.json()) as { extracted: { identifiant: string } }).extracted.identifiant).toBe('12345678900012')
    expect(workersAI[0].modele).toBe(GEMMA)
    expect(imageEnvoyee(workersAI[0].entrees)).toMatch(/^data:image\/jpeg;base64,/)
  })

  it('session exigée (lecture sur le quota du compte, route sans appelant dans l’application) ; plus de 5 Mo : refus', async () => {
    const workersAI = installerWorkersAI(() => sortieWorkersAI('ne doit pas servir'))
    h.utilisateur = null
    const anonyme = await verifierKbis(formulaire('http://localhost/api/verify-kbis', {
      file: new File([KBIS_PDF], 'kbis.pdf', { type: 'application/pdf' }), market: 'fr_artisan',
    }))
    expect(anonyme.status).toBe(401)
    h.utilisateur = { id: 'u-artisan', app_metadata: { role: 'artisan' } }
    const lourd = await verifierKbis(formulaire('http://localhost/api/verify-kbis', {
      file: new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'kbis.pdf', { type: 'application/pdf' }), market: 'fr_artisan',
    }))
    expect(lourd.status).toBe(400)
    expect(workersAI).toHaveLength(0)
  })

  it('lecture en échec : message lisible, sans nom de fournisseur ni détail technique', async () => {
    installerWorkersAI(() => { throw new Error('3040: Capacity temporarily exceeded') })
    const reponse = await verifierKbis(formulaire('http://localhost/api/verify-kbis', {
      file: new File([JPEG], 'kbis.jpg', { type: 'image/jpeg' }),
      market: 'pt_artisan',
    }))
    expect(reponse.status).toBe(422)
    const { message } = (await reponse.json()) as { message: string }
    expect(message).toBe('Documento ilegível ou qualidade insuficiente. Verifique que a Certidão está legível.')
    expect(message).not.toMatch(FOURNISSEURS)
  })
})

describe('/api/verify-id', () => {
  const champs = () => ({ file: new File([JPEG], 'cni.jpg', { type: 'image/jpeg' }), nom: 'Dupont', prenom: 'Jean' })

  it('lit la pièce d’identité avec Workers AI et retrouve le nom et le prénom', async () => {
    const workersAI = installerWorkersAI(() =>
      sortieWorkersAI('RÉPUBLIQUE FRANÇAISE — CARTE NATIONALE D’IDENTITÉ\nNom : DUPONT\nPrénom(s) : JEAN\nNé(e) le : 01.01.1980 à MARSEILLE'))
    const appels = installerFetchIA(() => reponseOpenAI('ne doit pas servir'))
    const corps = (await (await verifierIdentite(formulaire('http://localhost/api/verify-id', champs()))).json()) as Record<string, unknown>
    expect(corps).toMatchObject({ status: 'verified', nomFound: true, prenomFound: true, ocrConfidence: 75 })
    expect(workersAI).toHaveLength(1)
    expect(appels).toHaveLength(0)
  })

  it('type déclaré par le navigateur faux (PNG annoncé en JPEG) : le modèle reçoit le vrai type', async () => {
    const workersAI = installerWorkersAI(() => sortieWorkersAI('CARTE NATIONALE D’IDENTITÉ — Nom : DUPONT — Prénom : JEAN'))
    await verifierIdentite(formulaire('http://localhost/api/verify-id', { ...champs(), file: new File([PNG], 'cni.jpg', { type: 'image/jpeg' }) }))
    expect(imageEnvoyee(workersAI[0].entrees)).toMatch(/^data:image\/png;base64,/)
  })

  it('route publique : poids contrôlé avant toute lecture (plus de 5 Mo : 400), aucun appel', async () => {
    const workersAI = installerWorkersAI(() => sortieWorkersAI('ne doit pas servir'))
    const lourd = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'cni.jpg', { type: 'image/jpeg' })
    const reponse = await verifierIdentite(formulaire('http://localhost/api/verify-id', { ...champs(), file: lourd }))
    expect(reponse.status).toBe(400)
    expect(((await reponse.json()) as { error: string }).error).toBe('Fichier trop volumineux (5 Mo maximum)')
    expect(workersAI).toHaveLength(0)
  })

  it('route publique : plafond quotidien toutes adresses confondues ; atteint, 429 sans appel', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit')
    const limite = vi.mocked(checkRateLimit)
    limite.mockImplementation(async (cle: string) => cle !== 'verify_id_jour')
    try {
      const workersAI = installerWorkersAI(() => sortieWorkersAI('ne doit pas servir'))
      const reponse = await verifierIdentite(formulaire('http://localhost/api/verify-id', champs()))
      expect(reponse.status).toBe(429)
      expect(limite).toHaveBeenCalledWith('verify_id_jour', 300, 86_400_000)
      expect(workersAI).toHaveLength(0)
    } finally {
      limite.mockImplementation(async () => true)
    }
  })

  it('route publique : un PDF n’est pas lu, vérification non validée comme avant', async () => {
    const workersAI = installerWorkersAI(() => sortieWorkersAI('ne doit pas servir'))
    const reponse = await verifierIdentite(formulaire('http://localhost/api/verify-id', { ...champs(), file: new File([KBIS_PDF], 'cni.pdf', { type: 'application/pdf' }) }))
    expect(await reponse.json()).toMatchObject({ status: 'failed', ocrConfidence: 0 })
    expect(workersAI).toHaveLength(0)
  })

  it('lecture en échec : confiance nulle, vérification non validée (comme avant)', async () => {
    installerWorkersAI(() => { throw new Error('3006: Request too large') })
    const reponse = await verifierIdentite(formulaire('http://localhost/api/verify-id', champs()))
    expect(reponse.status).toBe(200)
    expect(await reponse.json()).toMatchObject({ status: 'failed', ocrConfidence: 0 })
  })
})

describe('/api/receipt-scan', () => {
  const ticket = {
    store: 'Leroy Merlin', date: '2026-11-10', totalHT: null, totalTTC: 17, confidence: 'haute',
    lines: [{ name: 'Sac ciment 35 kg', qty: 2, unit: 'sac', unitPrice: 8.5, totalPrice: 17 }],
  }

  it('lit le ticket avec Workers AI en mode JSON, sans Groq', async () => {
    const workersAI = installerWorkersAI(() => sortieWorkersAI(JSON.stringify(ticket)))
    const appels = installerFetchIA(() => reponseOpenAI('ne doit pas servir'))
    const reponse = await lireTicket(json('http://localhost/api/receipt-scan', { image_base64: IMAGE_DATA_URL, mime_type: 'image/jpeg' }))
    const { result } = (await reponse.json()) as { result: { store: string; lines: unknown[]; confidence: string } }
    expect(result).toMatchObject({ store: 'Leroy Merlin', confidence: 'haute' })
    expect(result.lines).toHaveLength(1)
    expect(workersAI[0].entrees).toMatchObject({ response_format: { type: 'json_object' } })
    expect(appels).toHaveLength(0)
  })

  it('PNG annoncé en JPEG par le navigateur : le modèle reçoit le vrai type', async () => {
    const png = Buffer.from(PNG).toString('base64')
    const workersAI = installerWorkersAI(() => sortieWorkersAI(JSON.stringify(ticket)))
    await lireTicket(json('http://localhost/api/receipt-scan', { image_base64: `data:image/jpeg;base64,${png}` }))
    expect(imageEnvoyee(workersAI[0].entrees)).toBe(`data:image/png;base64,${png}`)
  })

  it('Workers AI absent : 503 et message générique (plus « Groq API non configurée »)', async () => {
    retirerWorkersAI()
    const appels = installerFetchIA(() => reponseOpenAI('ne doit pas servir'))
    const reponse = await lireTicket(json('http://localhost/api/receipt-scan', { image_base64: IMAGE_DATA_URL }))
    expect(reponse.status).toBe(503)
    const { error } = (await reponse.json()) as { error: string }
    expect(error).toBe('Analyse indisponible pour le moment. Réessayez plus tard.')
    expect(error).not.toMatch(FOURNISSEURS)
    expect(appels).toHaveLength(0)
  })

  it('lecture en échec : résultat vide et message générique', async () => {
    installerWorkersAI(() => { throw new Error('3040: Capacity temporarily exceeded') })
    const corps = (await (await lireTicket(json('http://localhost/api/receipt-scan', { image_base64: IMAGE_DATA_URL }))).json()) as { result: { lines: unknown[] }; error: string }
    expect(corps.result.lines).toEqual([])
    expect(corps.error).toBe('Analyse vision échouée')
  })
})

describe('/api/supplier-invoice-scan (BTP)', () => {
  it('lit la facture fournisseur avec Workers AI', async () => {
    const facture = {
      supplier: 'Point P', invoiceRef: 'F-001', date: '2026-11-02', totalHT: 100, totalTTC: 120, confidence: 'haute',
      lines: [{ name: 'Plaque de plâtre BA13', qty: 10, unit: 'u', unitPriceHT: 10, tvaRate: 20 }],
    }
    installerWorkersAI(() => sortieWorkersAI(JSON.stringify(facture)))
    const reponse = await lireFactureFournisseur(json('http://localhost/api/supplier-invoice-scan', { image_base64: IMAGE_DATA_URL }))
    const { result } = (await reponse.json()) as { result: { supplier: string; lines: Array<{ tvaRate: number }> } }
    expect(result.supplier).toBe('Point P')
    expect(result.lines[0].tvaRate).toBe(20)
  })

  it('Workers AI absent : 503 et message générique', async () => {
    retirerWorkersAI()
    const reponse = await lireFactureFournisseur(json('http://localhost/api/supplier-invoice-scan', { image_base64: IMAGE_DATA_URL }))
    expect(reponse.status).toBe(503)
    expect(((await reponse.json()) as { error: string }).error).not.toMatch(FOURNISSEURS)
  })
})

describe('/api/email-agent/ocr', () => {
  it('lit le document avec Workers AI', async () => {
    installerWorkersAI(() => sortieWorkersAI('{"montant":"850,00 €","type_document":"facture","confidence":"moyenne"}'))
    const reponse = await lireDocumentEmail(json('http://localhost/api/email-agent/ocr', { image_base64: IMAGE_DATA_URL }))
    const { result } = (await reponse.json()) as { result: { montant: string; confidence: string } }
    expect(result).toMatchObject({ montant: '850,00 €', confidence: 'moyenne' })
  })

  it('Workers AI absent : 503 et message générique', async () => {
    retirerWorkersAI()
    const reponse = await lireDocumentEmail(json('http://localhost/api/email-agent/ocr', { image_base64: IMAGE_DATA_URL }))
    expect(reponse.status).toBe(503)
    expect(((await reponse.json()) as { error: string }).error).not.toMatch(FOURNISSEURS)
  })
})
