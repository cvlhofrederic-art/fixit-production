// tests/lib/validation-messagerie-pro.test.ts
//
// Schémas de /api/pro/messagerie : metadata.document (devis / rapport / facture renvoyés
// au donneur d'ordre), message écrit par le prestataire, action sur un ordre de mission.

import { describe, it, expect } from 'vitest'
import { documentMessageProSchema, proMessagerieActionSchema, proMessagerieSchema } from '@/lib/validation'

const ARTISAN = '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4'
const DEVIS = { type: 'devis', reference: 'D-2026-014', montant_ttc: 640, description: 'Remplacement colonne EF', date: '2026-10-12' }
const RAPPORT = { type: 'rapport', reference: 'R-2026-007', description: 'Colonne remplacée, essais OK', date: '2026-10-12' }

const ok = (v: unknown) => documentMessageProSchema.safeParse(v).success

describe('documentMessageProSchema', () => {
  it('accepte devis, facture et rapport conformes', () => {
    expect(ok(DEVIS)).toBe(true)
    expect(ok({ ...DEVIS, type: 'facture', reference: 'F-2026-003', montant_ttc: 0 })).toBe(true)
    expect(ok(RAPPORT)).toBe(true)
  })

  it('montant TTC : ≥ 0, obligatoire pour devis / facture, interdit sur un rapport', () => {
    expect(ok({ ...DEVIS, montant_ttc: -1 })).toBe(false)
    expect(ok({ ...DEVIS, montant_ttc: Number.NaN })).toBe(false)
    expect(ok({ ...DEVIS, montant_ttc: '640' })).toBe(false)
    const { montant_ttc: _m, ...devisSansMontant } = DEVIS
    expect(ok(devisSansMontant)).toBe(false)
    expect(ok({ ...devisSansMontant, type: 'facture' })).toBe(false)
    expect(ok({ ...RAPPORT, montant_ttc: 100 })).toBe(false)
  })

  it('type limité à devis | rapport | facture', () => {
    expect(ok({ ...DEVIS, type: 'avoir' })).toBe(false)
    expect(ok({ ...DEVIS, type: undefined })).toBe(false)
  })

  it('référence et description : requises (après trim), longueurs bornées', () => {
    expect(ok({ ...DEVIS, reference: '   ' })).toBe(false)
    expect(ok({ ...DEVIS, reference: 'R'.repeat(61) })).toBe(false)
    expect(ok({ ...DEVIS, reference: 'R'.repeat(60) })).toBe(true)
    expect(ok({ ...DEVIS, description: '' })).toBe(false)
    expect(ok({ ...DEVIS, description: 'x'.repeat(4001) })).toBe(false)
    expect(documentMessageProSchema.parse({ ...DEVIS, reference: '  D-1  ' }).reference).toBe('D-1')
  })

  it('date : AAAA-MM-JJ et date calendaire réelle', () => {
    expect(ok({ ...DEVIS, date: '12/10/2026' })).toBe(false)
    expect(ok({ ...DEVIS, date: '2026-02-30' })).toBe(false)
    expect(ok({ ...DEVIS, date: '2028-02-29' })).toBe(true)
  })

  it('clé inconnue refusée (schéma strict)', () => {
    expect(ok({ ...DEVIS, pdf_url: 'https://exemple.fr/devis.pdf' })).toBe(false)
  })
})

describe('proMessagerieSchema — message écrit par le prestataire', () => {
  const base = { artisan_user_id: ARTISAN, contact_id: ARTISAN, contact_type: 'pro', content: 'Bonjour', type: 'text' }

  it('accepte un texte et un document dans une conversation Pro', () => {
    expect(proMessagerieSchema.safeParse(base).success).toBe(true)
    expect(proMessagerieSchema.safeParse({ ...base, metadata: { cote: 'artisan', document: DEVIS } }).success).toBe(true)
  })

  it('document : seulement en type text et en conversation Pro', () => {
    expect(proMessagerieSchema.safeParse({ ...base, type: 'photo', metadata: { document: DEVIS } }).success).toBe(false)
    expect(proMessagerieSchema.safeParse({ ...base, contact_type: 'particulier', metadata: { document: DEVIS } }).success).toBe(false)
    // contact_type absent = particulier par défaut
    const { contact_type: _c, ...sansType } = base
    expect(proMessagerieSchema.safeParse({ ...sansType, metadata: { document: DEVIS } }).success).toBe(false)
    expect(proMessagerieSchema.safeParse({ ...base, metadata: { document: { ...DEVIS, montant_ttc: -5 } } }).success).toBe(false)
  })

  it("le prestataire n'écrit ni ordre de mission, ni message système, ni côté donneur d'ordre", () => {
    expect(proMessagerieSchema.safeParse({ ...base, type: 'ordre_mission' }).success).toBe(false)
    expect(proMessagerieSchema.safeParse({ ...base, type: 'system' }).success).toBe(false)
    expect(proMessagerieSchema.safeParse({ ...base, metadata: { cote: 'donneur_ordre' } }).success).toBe(false)
    expect(proMessagerieSchema.safeParse({ ...base, metadata: { autre: 1 } }).success).toBe(false)
  })
})

describe('proMessagerieActionSchema — action sur un ordre de mission', () => {
  const MSG = '33333333-3333-4333-8333-333333333333'
  it('message_id UUID et action connue', () => {
    expect(proMessagerieActionSchema.safeParse({ message_id: MSG, action: 'accepte', arrival_time: '09:00', duration_hours: '2' }).success).toBe(true)
    expect(proMessagerieActionSchema.safeParse({ message_id: MSG, action: 'termine', duration_hours: 1.5 }).success).toBe(true)
    expect(proMessagerieActionSchema.safeParse({ message_id: 'abc', action: 'accepte' }).success).toBe(false)
    expect(proMessagerieActionSchema.safeParse({ message_id: MSG, action: 'valide' }).success).toBe(false)
    expect(proMessagerieActionSchema.safeParse({ action: 'accepte' }).success).toBe(false)
  })
})
