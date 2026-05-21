import { describe, it, expect } from 'vitest'
import { validateNif, extractNif } from '@/lib/nif-pt'

describe('validateNif', () => {
  it('accepts a real PT NIF (Frédéric Neiva Carvalho — first digit 2)', () => {
    expect(validateNif('276873297')).toBe(true)
  })

  it('accepts NIF with spaces formatted as 276 873 297', () => {
    expect(validateNif('276 873 297')).toBe(true)
  })

  it('accepts NIPC starting with 5 (pessoa coletiva)', () => {
    expect(validateNif('500000000')).toBe(true)
  })

  it('rejects NIF with wrong checksum digit', () => {
    expect(validateNif('276873298')).toBe(false)
  })

  it('rejects too short (less than 9 digits)', () => {
    expect(validateNif('12345678')).toBe(false)
  })

  it('rejects too long (more than 9 digits = FR SIRET style)', () => {
    expect(validateNif('12345678901234')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(validateNif('')).toBe(false)
  })

  it('rejects NIF whose first digit is not in [1,2,5,6,8,9]', () => {
    // 3 is not valid for any category
    expect(validateNif('300000005')).toBe(false)
  })

  it('rejects undefined/null gracefully', () => {
    // @ts-expect-error testing runtime safety
    expect(validateNif(undefined)).toBe(false)
    // @ts-expect-error testing runtime safety
    expect(validateNif(null)).toBe(false)
  })
})

describe('extractNif', () => {
  it('extracts NIF from PDF body (3+3+3 spaced format)', () => {
    const text = 'EMITENTE\nNome : Frédéric Neiva Carvalho\nNIF : 276 873 297\nMorada : 109 Av.'
    expect(extractNif(text)).toBe('276873297')
  })

  it('extracts NIF from continuous digit format', () => {
    expect(extractNif('NIF: 276873297 / CAE 81210')).toBe('276873297')
  })

  it('returns null when no valid NIF in text', () => {
    expect(extractNif('Random text 111 222 333 (invalid checksum)')).toBeNull()
  })

  it('returns null on empty input', () => {
    expect(extractNif('')).toBeNull()
    // @ts-expect-error testing runtime safety
    expect(extractNif(null)).toBeNull()
    // @ts-expect-error testing runtime safety
    expect(extractNif(undefined)).toBeNull()
  })

  it('skips invalid candidates and picks the valid one', () => {
    const text = 'Telefone : 912 014 971 \n NIF : 276 873 297'
    expect(extractNif(text)).toBe('276873297')
  })
})
