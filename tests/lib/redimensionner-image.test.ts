// tests/lib/redimensionner-image.test.ts — lib/images/redimensionner-image.ts (lot 3 Sentry du 28/10/2026).
// jsdom n'a pas de canvas : la géométrie est testée seule, et le repli (data: URL d'origine) quand le navigateur ne
// sait pas décoder l'image.

import { afterEach, describe, it, expect, vi } from 'vitest'
import { COTE_MAX_IMAGE_ARTISAN, QUALITE_WEBP, calculerDimensions, redimensionnerImage } from '@/lib/images/redimensionner-image'

describe('calculerDimensions', () => {
  it('ne touche pas une image déjà sous 512 px, sans jamais l’agrandir', () => {
    expect(COTE_MAX_IMAGE_ARTISAN).toBe(512)
    expect(calculerDimensions(300, 200)).toEqual({ largeur: 300, hauteur: 200 })
    expect(calculerDimensions(512, 512)).toEqual({ largeur: 512, hauteur: 512 })
    expect(calculerDimensions(64, 64)).toEqual({ largeur: 64, hauteur: 64 })
  })

  it('ramène le plus grand côté à 512 px en gardant le rapport', () => {
    expect(calculerDimensions(2048, 1024)).toEqual({ largeur: 512, hauteur: 256 })
    expect(calculerDimensions(1000, 3000)).toEqual({ largeur: 171, hauteur: 512 })
    expect(calculerDimensions(4000, 4000)).toEqual({ largeur: 512, hauteur: 512 })
    expect(calculerDimensions(10000, 10, 512)).toEqual({ largeur: 512, hauteur: 1 })
  })

  it('accepte un autre côté maximal et refuse des dimensions invalides', () => {
    expect(calculerDimensions(800, 600, 200)).toEqual({ largeur: 200, hauteur: 150 })
    expect(calculerDimensions(0, 600)).toEqual({ largeur: 0, hauteur: 0 })
    expect(calculerDimensions(800, Number.NaN)).toEqual({ largeur: 0, hauteur: 0 })
    expect(calculerDimensions(800, 600, 0)).toEqual({ largeur: 0, hauteur: 0 })
  })
})

describe('redimensionnerImage (sans canvas : repli)', () => {
  it('renvoie la data: URL d’origine quand l’image ne peut pas être décodée', async () => {
    const octets = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const fichier = new Blob([octets], { type: 'image/png' })
    // jsdom ne décode jamais l'image : le délai de décodage déclenche le repli.
    const resultat = await redimensionnerImage(fichier, 512, 50)
    expect(resultat.redimensionnee).toBe(false)
    expect(resultat.dataUrl.startsWith('data:image/png;base64,')).toBe(true)
    expect(resultat.dataUrl).toContain(Buffer.from(octets).toString('base64'))
  })
})

describe('redimensionnerImage (canvas simulé : format demandé)', () => {
  /** Canvas simulé : chaque dessin est noté, et l'encodeur rend le format demandé, sauf ceux qu'il ne sait pas écrire. */
  function simulerCanvas(formatsConnus: string[]) {
    const traces: string[] = []
    const contexte = {
      fillStyle: '',
      fillRect: vi.fn(() => traces.push(`fond ${contexte.fillStyle}`)),
      drawImage: vi.fn(() => traces.push('image')),
    }
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 3136, height: 2000, close: vi.fn() })))
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(contexte as unknown as CanvasRenderingContext2D)
    const encoder = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((rappel, type = 'image/png') => {
      rappel(new Blob([new Uint8Array([1, 2, 3])], { type: formatsConnus.includes(type) ? type : 'image/png' }))
    })
    return { traces, encoder }
  }

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('écrit une photo en JPEG sur fond blanc (le JPEG n’a pas de transparence)', async () => {
    const { traces, encoder } = simulerCanvas(['image/jpeg', 'image/png'])
    const resultat = await redimensionnerImage(new Blob([new Uint8Array([9])], { type: 'image/heic' }), 1568, 1000, { type: 'image/jpeg', qualite: 0.82 })
    expect(resultat.redimensionnee).toBe(true)
    expect(resultat.dataUrl.startsWith('data:image/jpeg;base64,')).toBe(true)
    expect(encoder).toHaveBeenCalledTimes(1)
    expect(encoder.mock.calls[0].slice(1)).toEqual(['image/jpeg', 0.82])
    expect(traces).toEqual(['fond #ffffff', 'image'])
  })

  it('garde le WebP par défaut, sans fond, et le PNG quand le navigateur ne sait pas écrire le WebP', async () => {
    const webp = simulerCanvas(['image/webp', 'image/png'])
    const logo = await redimensionnerImage(new Blob([new Uint8Array([9])], { type: 'image/png' }), COTE_MAX_IMAGE_ARTISAN, 1000)
    expect(logo.dataUrl.startsWith('data:image/webp;base64,')).toBe(true)
    expect(webp.encoder.mock.calls[0].slice(1)).toEqual(['image/webp', QUALITE_WEBP])
    expect(webp.traces).toEqual(['image'])
    vi.restoreAllMocks()

    // Safari : pas d'encodeur WebP, il rend du PNG ; la fonction le reprend en PNG plutôt que d'échouer.
    const safari = simulerCanvas(['image/png'])
    const repli = await redimensionnerImage(new Blob([new Uint8Array([9])], { type: 'image/png' }), COTE_MAX_IMAGE_ARTISAN, 1000)
    expect(repli.dataUrl.startsWith('data:image/png;base64,')).toBe(true)
    expect(safari.encoder.mock.calls.map((appel) => appel[1])).toEqual(['image/webp', 'image/png'])
  })
})
