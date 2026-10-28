// tests/lib/chemin-sur.test.ts
//
// cheminStockageSur : chemins Supabase Storage lus en base (storage_path, pdf_url) avant un appel
// en service role. Les chemins produits par le serveur passent ; ce qui sortirait du bucket ou
// viserait un autre objet est refusé.

import { describe, it, expect } from 'vitest'
import { cheminStockageSur } from '@/lib/storage/chemin-sur'

const CABINET = '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4'

describe('cheminStockageSur', () => {
  it.each([
    [`${CABINET}/cccccccc-cccc-4ccc-8ccc-ccccccccccc1.pdf`],
    [`${CABINET}/pv/pv-ag-2025.pdf`],
    ['factures/2026/F-2026-001.pdf'],
    ['dossier/fichier.v2.final.pdf'],
    ['dossier/Relevé de charges 2025.pdf'],
  ])('accepte %s', (chemin) => {
    expect(cheminStockageSur(chemin)).toBe(true)
  })

  it.each([
    ['vide', ''],
    ['absolu', '/cabinet/doc.pdf'],
    ['segment vide', 'cabinet//doc.pdf'],
    ['barre finale', 'cabinet/'],
    ['« . »', 'cabinet/./doc.pdf'],
    ['« .. »', 'cabinet/../autre/doc.pdf'],
    ['« .. » seul', '..'],
    ['« %2e%2e »', 'cabinet/%2e%2e/autre/doc.pdf'],
    ['« %2E. »', 'cabinet/%2E./doc.pdf'],
    ['« .%2e »', 'cabinet/.%2e/doc.pdf'],
    ['barre inverse', 'cabinet\\..\\doc.pdf'],
    ['« ? »', 'cabinet/doc.pdf?download=autre'],
    ['« # »', 'cabinet/doc.pdf#autre'],
    ['retour à la ligne', 'cabinet/doc\n.pdf'],
    ['caractère NUL', 'cabinet/doc.pdf\u0000.png'],
    ['trop long', `a/${'b'.repeat(1100)}`],
  ])('refuse un chemin %s', (_cas, chemin) => {
    expect(cheminStockageSur(chemin)).toBe(false)
  })

  it.each([[null], [undefined], [42], [{ path: 'a/b' }]])('refuse une valeur non textuelle (%s)', (valeur) => {
    expect(cheminStockageSur(valeur)).toBe(false)
  })
})
