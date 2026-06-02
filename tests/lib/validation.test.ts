import { describe, it, expect } from 'vitest'
import { createBookingSchema, fixyAiSchema, validateBody, siretSchema, isValidSiret, devisSyncSchema } from '@/lib/validation'

describe('Zod Validation Schemas', () => {
  describe('createBookingSchema', () => {
    it('should accept valid booking data', () => {
      const result = validateBody(createBookingSchema, {
        artisan_id: '550e8400-e29b-41d4-a716-446655440000',
        booking_date: '2026-03-15',
        booking_time: '14:30',
        duration_minutes: 60,
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid date format', () => {
      const result = validateBody(createBookingSchema, {
        artisan_id: '550e8400-e29b-41d4-a716-446655440000',
        booking_date: '15-03-2026',
        booking_time: '14:30',
      })
      expect(result.success).toBe(false)
    })

    it('should reject invalid UUID', () => {
      const result = validateBody(createBookingSchema, {
        artisan_id: 'not-a-uuid',
        booking_date: '2026-03-15',
        booking_time: '14:30',
      })
      expect(result.success).toBe(false)
    })

    it('should reject negative prices', () => {
      const result = validateBody(createBookingSchema, {
        artisan_id: '550e8400-e29b-41d4-a716-446655440000',
        booking_date: '2026-03-15',
        booking_time: '14:30',
        price_ttc: -10,
      })
      expect(result.success).toBe(false)
    })

    it('should reject duration out of range', () => {
      const result = validateBody(createBookingSchema, {
        artisan_id: '550e8400-e29b-41d4-a716-446655440000',
        booking_date: '2026-03-15',
        booking_time: '14:30',
        duration_minutes: 999,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('fixyAiSchema', () => {
    it('should accept valid fixy message', () => {
      const result = validateBody(fixyAiSchema, {
        message: 'mes dispos',
        artisan_id: '550e8400-e29b-41d4-a716-446655440000',
      })
      expect(result.success).toBe(true)
    })

    it('should reject empty message', () => {
      const result = validateBody(fixyAiSchema, {
        message: '',
        artisan_id: '550e8400-e29b-41d4-a716-446655440000',
      })
      expect(result.success).toBe(false)
    })

    it('should reject message over 5000 chars', () => {
      const result = validateBody(fixyAiSchema, {
        message: 'a'.repeat(5001),
        artisan_id: '550e8400-e29b-41d4-a716-446655440000',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('siretSchema', () => {
    it('should accept valid 14-digit SIRET', () => {
      expect(siretSchema.safeParse('12345678901234').success).toBe(true)
    })

    it('should reject short SIRET', () => {
      expect(siretSchema.safeParse('1234567890').success).toBe(false)
    })

    it('should reject non-numeric SIRET', () => {
      expect(siretSchema.safeParse('1234567890abcd').success).toBe(false)
    })
  })

  describe('isValidSiret (Luhn checksum)', () => {
    it('refuse un fake 14 chiffres sans Luhn valide', () => {
      // BUG hotfix audit 04/05/2026 : avant, length===14 suffisait → ce
      // SIRET fake forçait clientType=pro et désactivait la rétractation 14j
      expect(isValidSiret('12345678901234')).toBe(false)
    })

    it('accepte un SIRET valide Luhn (Renault siège 732 829 320 00074)', () => {
      // Vérifié manuellement : alternance ×1/×2 from right, sum % 10 === 0
      expect(isValidSiret('73282932000074')).toBe(true)
    })

    it('accepte avec espaces', () => {
      expect(isValidSiret('732 829 320 00074')).toBe(true)
    })

    it('refuse une chaîne vide', () => {
      expect(isValidSiret('')).toBe(false)
    })

    it('refuse moins de 14 chiffres', () => {
      expect(isValidSiret('1234567890')).toBe(false)
    })

    it('refuse caractères non-numériques', () => {
      expect(isValidSiret('1234567890abcd')).toBe(false)
    })

    it('cas particulier La Poste (SIREN 356 000 000) — somme mod 5 === 0', () => {
      // La Poste n'utilise pas Luhn standard. Validation = somme des 14 chiffres
      // divisible par 5. Test SIRET construit : 35600000000146
      // Sum digits = 3+5+6+0+0+0+0+0+0+0+0+1+4+6 = 25 ; 25 mod 5 = 0 ✓
      expect(isValidSiret('35600000000146')).toBe(true)
    })
  })
})

describe('devisSyncSchema — id de document legacy (fix sync UUID)', () => {
  const base = { docType: 'devis' as const, artisanId: '550e8400-e29b-41d4-a716-446655440000' }

  it('accepte un id legacy horodaté (Date.now()) — la route l\'identifie par numero', () => {
    const result = validateBody(devisSyncSchema, {
      ...base,
      doc: { id: '1779539827817', docNumber: 'DEV-2026-010', status: 'brouillon' },
    })
    expect(result.success).toBe(true)
  })

  it('accepte un id vide ou null (doc legacy sans id canonique)', () => {
    expect(validateBody(devisSyncSchema, { ...base, doc: { id: '', docNumber: 'DEV-2026-009' } }).success).toBe(true)
    expect(validateBody(devisSyncSchema, { ...base, doc: { id: null, docNumber: 'DEV-2026-009' } }).success).toBe(true)
  })

  it('accepte un id UUID canonique (doc créé via stableDocId)', () => {
    const result = validateBody(devisSyncSchema, {
      ...base,
      doc: { id: '50e30094-3af7-442b-b2b0-4e8c8fc12b64', docNumber: null, status: 'brouillon' },
    })
    expect(result.success).toBe(true)
  })

  it('rejette toujours un artisanId non-UUID (garde-fou ownership)', () => {
    const result = validateBody(devisSyncSchema, {
      artisanId: 'not-a-uuid', docType: 'devis', doc: { docNumber: 'DEV-2026-001' },
    })
    expect(result.success).toBe(false)
  })
})
