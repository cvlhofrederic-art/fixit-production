// tests/lib/tva-thresholds-pt.test.ts
//
// Seuil d'exonération d'IVA au Portugal (art. 53.º CIVA, art. 52.º-B ajouté par le DL 35/2025), vérifié le 17/11/2026 :
// 15 000 € (et non plus 14 500 €, valeur de 2024) ; entre 15 000 € et 18 750 € l'exonération court jusqu'au
// 31 décembre ; au-delà de 18 750 € (+ 25 %), sortie immédiate. Le régime français ne change pas.

import { describe, expect, it } from 'vitest'
import { getTvaStatus, shouldNotify } from '@/lib/tva-thresholds'

describe('getTvaStatus — Portugal', () => {
  it('15 000 € pile : encore exonéré (le seuil est « ne pas dépasser »)', () => {
    const r = getTvaStatus(15_000, 'PT')
    expect(r.status).toBe('warning')
    expect(r.seuil).toBe(15_000)
  })

  it('14 600 € (au-dessus de l’ancien seuil de 2024) : pas dépassé', () => {
    expect(getTvaStatus(14_600, 'PT').status).toBe('warning')
  })

  it('entre 15 000 € et 18 750 € : dépassé, passage au régime normal le 1er janvier suivant', () => {
    const r = getTvaStatus(16_000, 'PT')
    expect(r.status).toBe('exceeded')
    expect(r.seuilMajore).toBe(18_750)
    expect(r.message.pt).toContain('a 1 de janeiro seguinte')
    expect(r.message.pt).toContain('15 dias úteis')
  })

  it('18 750 € pile : pas encore la sortie immédiate ; au-delà : sortie immédiate', () => {
    expect(getTvaStatus(18_750, 'PT').status).toBe('exceeded')
    const r = getTvaStatus(18_751, 'PT')
    expect(r.status).toBe('exceeded_majore')
    expect(r.message.pt).toContain('a saída do regime de isenção é imediata')
    expect(r.taux).toBe(0.23)
  })

  it('sous 80 % du seuil : exonéré ; à partir de 12 000 € : alerte', () => {
    expect(getTvaStatus(11_999, 'PT').status).toBe('safe')
    expect(getTvaStatus(12_000, 'PT').status).toBe('warning')
  })

  it('textes portugais : pas de tiret long, pas d’espace avant « : » ni avant « % »', () => {
    for (const ca of [5_000, 12_500, 16_000, 20_000]) {
      const r = getTvaStatus(ca, 'PT')
      for (const texte of [r.title.pt, r.message.pt, r.badge.pt]) {
        expect(texte).not.toMatch(/[—–]/)
        expect(texte).not.toMatch(/\s:/)
        expect(texte).not.toMatch(/\d\s%/)
      }
    }
  })

  it('les notifications montent d’un niveau quand la sortie devient immédiate', () => {
    expect(shouldNotify('exceeded_majore', 'exceeded')).toBe(true)
    expect(shouldNotify('exceeded', 'exceeded_majore')).toBe(false)
  })
})

describe('getTvaStatus — France (inchangé)', () => {
  it('seuils 37 500 € et 41 250 €', () => {
    expect(getTvaStatus(37_499, 'FR').status).toBe('warning')
    expect(getTvaStatus(37_500, 'FR').status).toBe('exceeded')
    expect(getTvaStatus(41_250, 'FR').status).toBe('exceeded_majore')
    expect(getTvaStatus(10_000, 'FR').message.fr).toContain('art. 293B du CGI')
  })
})
