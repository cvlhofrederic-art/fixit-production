import { describe, expect, it } from 'vitest'
import { getAlternateUrls, translateUrl } from '@/lib/i18n/url-translator'

describe('translateUrl', () => {
  describe('home', () => {
    it('FR home → PT home', () => {
      expect(translateUrl('/fr/', 'pt')).toBe('/pt/')
    })

    it('PT home → EN home', () => {
      expect(translateUrl('/pt/', 'en')).toBe('/en/')
    })

    it('FR home → NL home', () => {
      expect(translateUrl('/fr/', 'nl')).toBe('/nl/')
    })
  })

  describe('static global pages with equivalents', () => {
    it('FR CGU → PT termos', () => {
      expect(translateUrl('/fr/cgu', 'pt')).toBe('/pt/termos')
    })

    it('PT termos → EN terms', () => {
      expect(translateUrl('/pt/termos', 'en')).toBe('/en/terms')
    })

    it('FR mentions-legales → EN legal-notices', () => {
      expect(translateUrl('/fr/mentions-legales', 'en')).toBe('/en/legal-notices')
    })

    it('FR comment-ca-marche → PT como-funciona', () => {
      expect(translateUrl('/fr/comment-ca-marche', 'pt')).toBe('/pt/como-funciona')
    })

    it('FR tarifs → PT precos', () => {
      expect(translateUrl('/fr/tarifs', 'pt')).toBe('/pt/precos')
    })

    it('FR a-propos → EN (no equivalent) → null', () => {
      // a-propos n'existe pas en EN → drapeau caché côté UI.
      expect(translateUrl('/fr/a-propos', 'en')).toBeNull()
    })
  })

  describe('Porto multilingual SEO pages', () => {
    it('FR plombier-porto → PT canalizador-porto', () => {
      expect(translateUrl('/fr/plombier-porto', 'pt')).toBe('/pt/perto-de-mim/canalizador-porto')
    })

    it('FR plombier-porto → EN plumber-porto', () => {
      expect(translateUrl('/fr/plombier-porto', 'en')).toBe('/en/plumber-porto')
    })

    it('EN plumber-porto → FR plombier-porto', () => {
      expect(translateUrl('/en/plumber-porto', 'fr')).toBe('/fr/plombier-porto')
    })

    it('PT canalizador-porto → FR plombier-porto', () => {
      expect(translateUrl('/pt/perto-de-mim/canalizador-porto', 'fr')).toBe('/fr/plombier-porto')
    })

    it('FR electricien-porto → PT eletricista-porto', () => {
      expect(translateUrl('/fr/electricien-porto', 'pt')).toBe('/pt/perto-de-mim/eletricista-porto')
    })

    it('Porto page → NL (no equivalent) → null', () => {
      // Pas de page Porto en NL → drapeau caché.
      expect(translateUrl('/fr/plombier-porto', 'nl')).toBeNull()
    })
  })

  describe('Marseille SEO pages (no equivalent in other locales)', () => {
    it('Marseille service page → PT → null (marchés séparés)', () => {
      expect(translateUrl('/fr/pres-de-chez-moi/plombier-marseille', 'pt')).toBeNull()
    })

    it('Marseille ville page → EN → null', () => {
      expect(translateUrl('/fr/ville/marseille', 'en')).toBeNull()
    })

    it('Marseille services page → NL → null', () => {
      expect(translateUrl('/fr/services/electricien', 'nl')).toBeNull()
    })
  })

  describe('PT-only programmatic SEO pages (Tâmega e Sousa)', () => {
    it('canalizador-marco-de-canaveses → FR → null', () => {
      // Tâmega e Sousa = marché PT, pas d'équivalent FR. Drapeau caché.
      expect(translateUrl('/pt/perto-de-mim/canalizador-marco-de-canaveses', 'fr')).toBeNull()
    })

    it('eletricista-amarante → EN → null', () => {
      expect(translateUrl('/pt/perto-de-mim/eletricista-amarante', 'en')).toBeNull()
    })
  })

  describe('trailing slash robustness', () => {
    it('handles trailing slash on input', () => {
      expect(translateUrl('/fr/cgu/', 'pt')).toBe('/pt/termos')
    })

    it('handles trailing slash on Porto page', () => {
      expect(translateUrl('/fr/plombier-porto/', 'en')).toBe('/en/plumber-porto')
    })
  })

  describe('unknown paths', () => {
    it('unknown FR path → PT → null', () => {
      expect(translateUrl('/fr/some-random-page-that-does-not-exist', 'pt')).toBeNull()
    })

    it('non-locale path → null', () => {
      expect(translateUrl('/some-totally-random-thing', 'fr')).toBeNull()
    })
  })
})

describe('getAlternateUrls', () => {
  it('returns the full equivalence record for a known page', () => {
    const alts = getAlternateUrls('/fr/plombier-porto')
    expect(alts).not.toBeNull()
    expect(alts?.fr).toBe('/fr/plombier-porto')
    expect(alts?.pt).toBe('/pt/perto-de-mim/canalizador-porto')
    expect(alts?.en).toBe('/en/plumber-porto')
  })

  it('returns null for an unknown page', () => {
    expect(getAlternateUrls('/fr/this-does-not-exist')).toBeNull()
  })
})
