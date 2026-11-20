// Images des PDF BTP (lib/pdf/images-pdf.ts), générateur V3 et gabarit Method Soluções.
// Avant : un PNG à couche alpha (logo, signature : tout PNG exporté par un canvas) était incorporé brut par
// jsPDF, près d'1 Mo par PDF ; une photo à zones transparentes sortait sur fond noir dans le JPEG de l'annexe.
// Les images sont celles d'un vrai canvas Chromium ; jsdom ne dessinant pas, le canvas est simulé et note
// l'ordre de ses opérations.
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateDevisPdfV3, type PdfV3Input } from '@/lib/pdf/devis-pdf-v3'
import { METHOD_SOLUCOES_PROFIL_ID } from '@/lib/pdf/modeles-societes'
import { URL_LOGO_METHOD, URL_POLICE_METHOD, URL_POLICE_METHOD_GRAS } from '@/lib/pdf/modele-method-solucoes'
import { PNG_ALPHA_4X2, canvasFactice, imageChargee, imagesDuPdf, type ImageDuPdf } from './helpers/images-pdf'
import { entreePdfV3 } from './helpers/entree-pdf-v3'

/** Police et logo du gabarit Method servis depuis public/, comme en production. */
const RESSOURCES: Record<string, string> = {
  [URL_POLICE_METHOD]: 'public/fonts/LiberationSans-Regular.ttf',
  [URL_POLICE_METHOD_GRAS]: 'public/fonts/LiberationSans-Bold.ttf',
  [URL_LOGO_METHOD]: 'public/images/modeles-pdf/method-solucoes-logo.png',
}

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => 'blob:test')
  URL.revokeObjectURL = vi.fn()
})

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const chemin = RESSOURCES[url]
    if (!chemin) return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) }
    const octets = readFileSync(join(process.cwd(), chemin))
    return { ok: true, status: 200, arrayBuffer: async () => octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength) }
  }))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const ligne = { id: 1, description: 'Ravalement de façade', qty: 1, unit: 'f', priceHT: 1000, tvaRate: 20, totalHT: 1000 }
const SIGNATURE = {
  svg_data: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100"/>',
  signataire: 'Client Exemple', timestamp: '2026-11-18T10:00:00Z', document_ref: 'DEV-2026-050', hash_sha256: 'a'.repeat(64),
}
const PHOTO = {
  id: 'p1', url: 'https://example.supabase.co/storage/v1/object/public/photos/facade.png',
  label: 'Façade sur cour', taken_at: '2026-11-10T09:30:00Z', lat: 43.3, lng: 5.4,
}
const METHOD = { artisan: { id: METHOD_SOLUCOES_PROFIL_ID, company_name: 'Empresa Exemplo' }, modele: 'method-solucoes' as const }

function entree(surcharge: Partial<PdfV3Input> = {}): PdfV3Input {
  return entreePdfV3({
    docNumber: 'DEV-2026-050', docDate: '2026-11-17', executionDelay: '2 semaines', companyName: 'Société Exemple BTP',
    companySiret: '12345678900011', clientName: 'Client Exemple', clientAddress: '2 avenue B 13008 Marseille',
    interventionAddress: '2 avenue B 13008 Marseille', recoveryFee: '', lines: [ligne], laborLines: [ligne],
    totalTTC: 1200, tvaBreakdown: [{ rate: 20, base: 1000, amount: 200 }], svgToImageDataUrl: async () => PNG_ALPHA_4X2,
    ...surcharge,
  })
}

/** Les deux images 4 × 2 du PNG : ses couleurs (qui portent le masque) et son masque de transparence. */
const imagesDuPng = (images: ImageDuPdf[]) => images.filter((i) => i.largeur === 4 && i.hauteur === 2)

describe('PDF BTP — PNG à couche alpha compressés sans perte', () => {
  it('V3 : le logo de la société, passé par un canvas, est compressé ; sa transparence est gardée', async () => {
    canvasFactice()
    vi.stubGlobal('Image', imageChargee(4, 2))
    const { fichier } = await generateDevisPdfV3(entree({ fetchFreshLogo: async () => PNG_ALPHA_4X2 }))
    const png = imagesDuPng(imagesDuPdf(fichier))
    expect(png.map((i) => i.filtre)).toEqual(['FlateDecode', 'FlateDecode'])
    expect(png.filter((i) => i.masque)).toHaveLength(1)
  })

  it('V3 : la signature électronique du client est compressée', async () => {
    const { fichier } = await generateDevisPdfV3(entree({ signatureData: SIGNATURE }))
    const png = imagesDuPng(imagesDuPdf(fichier))
    expect(png.map((i) => i.filtre)).toEqual(['FlateDecode', 'FlateDecode'])
    expect(png.filter((i) => i.masque)).toHaveLength(1)
  })

  it('gabarit Method : la signature électronique dans le cachet est compressée', async () => {
    const { fichier } = await generateDevisPdfV3(entree({ ...METHOD, isHorsEtablissement: true, signatureData: SIGNATURE }))
    const png = imagesDuPng(imagesDuPdf(fichier))
    expect(png.map((i) => i.filtre)).toEqual(['FlateDecode', 'FlateDecode'])
    expect(png.filter((i) => i.masque)).toHaveLength(1)
  })
})

describe('PDF BTP — photos de l\'annexe posées sur un fond blanc avant le JPEG', () => {
  it('V3 : fond blanc sur tout le canvas, puis la photo', async () => {
    const operations = canvasFactice()
    vi.stubGlobal('Image', imageChargee(4, 2))
    const { fichier } = await generateDevisPdfV3(entree({ docType: 'facture', docNumber: 'FACT-2026-050', selectedPhotos: [PHOTO] }))
    expect(operations).toEqual(['fillStyle #ffffff', 'fillRect 0 0 4 2', 'drawImage'])
    expect(imagesDuPdf(fichier)).toContainEqual({ largeur: 4, hauteur: 2, filtre: 'DCTDecode', masque: false })
  })

  it('gabarit Method : fond blanc sur tout le canvas, puis la photo', async () => {
    const operations = canvasFactice()
    vi.stubGlobal('Image', imageChargee(4, 2))
    const { fichier } = await generateDevisPdfV3(entree({ ...METHOD, docType: 'facture', docNumber: 'FACT-2026-050', selectedPhotos: [PHOTO] }))
    expect(operations).toEqual(['fillStyle #ffffff', 'fillRect 0 0 4 2', 'drawImage'])
    expect(imagesDuPdf(fichier)).toContainEqual({ largeur: 4, hauteur: 2, filtre: 'DCTDecode', masque: false })
  })
})
