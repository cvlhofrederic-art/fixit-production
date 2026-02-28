import { describe, it, expect } from 'vitest'
import { createBookingSchema, fixyAiSchema, validateBody, siretSchema } from '@/lib/validation'

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
})
