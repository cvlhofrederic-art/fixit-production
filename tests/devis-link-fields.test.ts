// tests/devis-link-fields.test.ts
//
// Lien devis → facture (méthode pro 2026) : une facture issue d'un devis garde
// la référence du devis source (sourceDevisNumber / sourceDevisId). Permet la
// traçabilité et la reprise de l'échéancier d'acomptes (50/30/20) sur la facture.

import { describe, it, expect } from 'vitest'
import { devisLinkFields } from '../lib/devis-utils'

describe('devisLinkFields — lien devis → facture', () => {
  it('extrait id + numéro du devis source', () => {
    expect(devisLinkFields({ id: 'uuid-1', docNumber: 'DEV-2026-003' }))
      .toEqual({ sourceDevisId: 'uuid-1', sourceDevisNumber: 'DEV-2026-003' })
  })

  it('renvoie {} si pas de devis', () => {
    expect(devisLinkFields(null)).toEqual({})
    expect(devisLinkFields(undefined)).toEqual({})
  })

  it('n\'ajoute que les champs présents', () => {
    expect(devisLinkFields({ docNumber: 'DEV-2026-009' })).toEqual({ sourceDevisNumber: 'DEV-2026-009' })
    expect(devisLinkFields({})).toEqual({})
  })
})
