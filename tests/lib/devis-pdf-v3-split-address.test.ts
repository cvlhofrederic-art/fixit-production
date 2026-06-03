import { describe, it, expect } from 'vitest'
import { splitAddressV3 } from '@/lib/pdf/devis-pdf-v3'

// Bug #1 (hardening) — V3 splitAddress ne gérait que les codes postaux FR
// (\d{5}). Les codes PT (XXXX-XXX, ex "4430-319 Vila Nova de Gaia") tombaient
// dans le fallback → ville non séparée, toute l'adresse écrasée sur la ligne rue.
// On miroite la logique du générateur V2 (lib/pdf/devis-generator-v2.ts), mais
// en conservant le CONTRAT de retour V3 : { street, city: string | null }.

describe('splitAddressV3 — FR (5 chiffres)', () => {
  it('sépare rue et code postal/ville (avec virgule)', () => {
    const r = splitAddressV3('12 Boulevard Longchamp, 13001 Marseille')
    expect(r).toEqual({ street: '12 Boulevard Longchamp', city: '13001 Marseille' })
  })

  it('sépare rue et code postal/ville (sans virgule)', () => {
    const r = splitAddressV3('5 Rue de la Paix 75002 Paris')
    expect(r).toEqual({ street: '5 Rue de la Paix', city: '75002 Paris' })
  })
})

describe('splitAddressV3 — PT (XXXX-XXX)', () => {
  it('sépare rue et code postal/ville portugais (avec virgule)', () => {
    const r = splitAddressV3('Rua de Santa Catarina 100, 4430-319 Vila Nova de Gaia')
    expect(r).toEqual({ street: 'Rua de Santa Catarina 100', city: '4430-319 Vila Nova de Gaia' })
  })

  it('sépare rue et code postal/ville portugais (sans virgule)', () => {
    const r = splitAddressV3('Avenida da Boavista 1000 4100-129 Porto')
    expect(r).toEqual({ street: 'Avenida da Boavista 1000', city: '4100-129 Porto' })
  })
})

describe('splitAddressV3 — fallback', () => {
  it('renvoie city=null si aucun code postal détecté', () => {
    const r = splitAddressV3('Lieu-dit Les Oliviers')
    expect(r).toEqual({ street: 'Lieu-dit Les Oliviers', city: null })
  })

  it('renvoie street vide et city=null pour une chaîne vide', () => {
    const r = splitAddressV3('')
    expect(r).toEqual({ street: '', city: null })
  })
})
