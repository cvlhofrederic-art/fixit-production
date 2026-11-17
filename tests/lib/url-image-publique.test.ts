// @vitest-environment node
// lib/storage/images-artisan.ts — urlImagePublique : seule une URL https absolue est publiable (og:image, JSON-LD).

import { describe, it, expect } from 'vitest'
import { urlImagePublique } from '@/lib/storage/images-artisan'

describe('urlImagePublique', () => {
  it.each([
    'https://irluhepekbqgquveaett.supabase.co/storage/v1/object/public/profile-photos/logos/1_a.webp',
    'https://vitfix.io/api/og/?locale=fr',
    '  https://exemple.supabase.co/photo.jpg  ',
    'HTTPS://EXEMPLE.SUPABASE.CO/photo.jpg',
  ])('accepte %s', (valeur) => {
    expect(urlImagePublique(valeur)).toBe(new URL(valeur.trim()).href)
  })

  it.each([
    ['une data: URL', `data:image/png;base64,${'A'.repeat(64)}`],
    ['un blob:', 'blob:https://vitfix.io/3f2a'],
    ['du http', 'http://exemple.supabase.co/photo.jpg'],
    ['javascript:', 'javascript:alert(1)'],
    ['un chemin relatif', '/images/photo.jpg'],
    ['une chaîne vide', ''],
    ['https sans hôte', 'https://'],
    ['https mal formé', 'https://exem ple.com/x'],
  ])('refuse %s', (_cas, valeur) => {
    expect(urlImagePublique(valeur)).toBeNull()
  })

  it('refuse toute valeur non textuelle', () => {
    expect(urlImagePublique(null)).toBeNull()
    expect(urlImagePublique(undefined)).toBeNull()
    expect(urlImagePublique(42)).toBeNull()
    expect(urlImagePublique({ url: 'https://vitfix.io/x.png' })).toBeNull()
  })
})
