// tests/lib/syndic-messagerie-pro.test.ts
//
// Règle commune « qui parle ? » de la messagerie Pro (syndic et prestataire peuvent être le même
// compte en démo) et lecture des documents envoyés par le prestataire.

import { describe, it, expect } from 'vitest'
import { coteDuMessage, documentDuMessage, statutOrdre } from '@/lib/syndic/messagerie-pro'

const ARTISAN = 'artisan-1'

describe('coteDuMessage', () => {
  it('metadata.cote présent : on le croit, même si sender_id = artisan', () => {
    expect(coteDuMessage({ type: 'text', sender_id: ARTISAN, metadata: { cote: 'donneur_ordre' } }, ARTISAN)).toBe('donneur_ordre')
    expect(coteDuMessage({ type: 'text', sender_id: 'syndic', metadata: { cote: 'artisan' } }, ARTISAN)).toBe('artisan')
  })

  it("sans cote : un ordre de mission vient du donneur d'ordre", () => {
    expect(coteDuMessage({ type: 'ordre_mission', sender_id: ARTISAN, metadata: {} }, ARTISAN)).toBe('donneur_ordre')
  })

  it('sans cote : artisan si sender_id = conversation.artisan_id, donneur d’ordre sinon', () => {
    expect(coteDuMessage({ type: 'text', sender_id: ARTISAN, metadata: null }, ARTISAN)).toBe('artisan')
    expect(coteDuMessage({ type: 'system', sender_id: ARTISAN }, ARTISAN)).toBe('artisan')
    expect(coteDuMessage({ type: 'text', sender_id: 'syndic-1' }, ARTISAN)).toBe('donneur_ordre')
  })

  it('valeur de cote inconnue ignorée', () => {
    expect(coteDuMessage({ type: 'text', sender_id: ARTISAN, metadata: { cote: 'autre' } }, ARTISAN)).toBe('artisan')
  })
})

describe('documentDuMessage', () => {
  it('lit un devis complet', () => {
    expect(documentDuMessage({ cote: 'artisan', document: { type: 'devis', reference: 'D-2026-014', montant_ttc: 640, description: 'Remplacement colonne EF', date: '2026-10-12' } }))
      .toEqual({ type: 'devis', reference: 'D-2026-014', montant_ttc: 640, description: 'Remplacement colonne EF', date: '2026-10-12' })
  })

  it('rapport sans montant', () => {
    expect(documentDuMessage({ document: { type: 'rapport', reference: 'R-1', description: 'Fuite réparée', date: '2026-10-12' } }))
      .toEqual({ type: 'rapport', reference: 'R-1', description: 'Fuite réparée', date: '2026-10-12' })
  })

  it('type inconnu, document absent ou métadonnées invalides → null', () => {
    expect(documentDuMessage({ document: { type: 'photo', reference: 'x' } })).toBeNull()
    expect(documentDuMessage({ cote: 'artisan' })).toBeNull()
    expect(documentDuMessage(null)).toBeNull()
    expect(documentDuMessage('texte')).toBeNull()
  })
})

describe('statutOrdre', () => {
  it('statuts écrits par PATCH /api/pro/messagerie, en_attente par défaut', () => {
    for (const s of ['en_attente', 'accepte', 'refuse', 'en_cours', 'termine']) expect(statutOrdre({ statut: s })).toBe(s)
    expect(statutOrdre({ statut: 'bizarre' })).toBe('en_attente')
    expect(statutOrdre(null)).toBe('en_attente')
  })
})
