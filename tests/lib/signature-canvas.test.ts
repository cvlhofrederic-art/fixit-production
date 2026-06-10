import { it, expect, vi, afterEach } from 'vitest'
import { svgToImageDataUrl } from '@/lib/signature-canvas'

// Audit 2026-06-10 (Vague 4) — helper canvas extrait à l'identique des deux
// formulaires devis. jsdom ne rend pas réellement le SVG : on mocke Image,
// URL et canvas pour vérifier le contrat (résolution data URL @2x / rejet).

afterEach(() => vi.restoreAllMocks())

// Image factice : déclenche onload (ok=true) ou onerror (ok=false) à l'affectation de src.
function stubImage(ok: boolean) {
  class FakeImg {
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    set src(_v: string) { setTimeout(() => (ok ? this.onload?.() : this.onerror?.()), 0) }
  }
  vi.stubGlobal('Image', FakeImg)
}

function stubCanvas() {
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ scale: vi.fn(), drawImage: vi.fn() }),
    toDataURL: () => 'data:image/png;base64,MOCK',
  }
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) =>
    tag === 'canvas' ? canvas : ({} as HTMLElement)) as typeof document.createElement)
  ;(URL as unknown as { createObjectURL: () => string }).createObjectURL = vi.fn(() => 'blob:mock')
  ;(URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = vi.fn()
  return canvas
}

it('résout en data URL PNG @2x quand l\'image charge', async () => {
  const canvas = stubCanvas()
  stubImage(true)
  const out = await svgToImageDataUrl('<svg/>', 100, 50)
  expect(out).toBe('data:image/png;base64,MOCK')
  expect(canvas.width).toBe(200)   // @2x
  expect(canvas.height).toBe(100)
})

it('rejette si le rendu SVG échoue', async () => {
  stubCanvas()
  stubImage(false)
  await expect(svgToImageDataUrl('<svg/>', 10, 10)).rejects.toThrow('SVG render failed')
})
