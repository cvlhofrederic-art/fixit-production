// tests/lib/redimensionner-image.test.ts — lib/images/redimensionner-image.ts (lot 3 Sentry du 28/10/2026).
// jsdom n'a pas de canvas : la géométrie est testée seule, et le repli (data: URL d'origine) quand le navigateur ne
// sait pas décoder l'image.

import { describe, it, expect } from 'vitest'
import { COTE_MAX_IMAGE_ARTISAN, calculerDimensions, redimensionnerImage } from '@/lib/images/redimensionner-image'

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
