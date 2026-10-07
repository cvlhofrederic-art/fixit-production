import { describe, it, expect, afterEach } from 'vitest'
import { dateApi } from '@/lib/syndic/v54/i18n/dates'
import type { V54Locale } from '@/lib/syndic/v54/i18n'

/**
 * dateApi : dates renvoyées par l'API syndic v54 (« AAAA-MM-JJ » ou horodatage ISO)
 * affichées en JJ/MM/AAAA dans la langue du dashboard ; toute autre valeur est rendue telle quelle.
 */

const TZ_INITIAL = process.env.TZ
afterEach(() => {
  if (TZ_INITIAL === undefined) delete process.env.TZ
  else process.env.TZ = TZ_INITIAL
})

const LANGUES: V54Locale[] = ['pt-PT', 'fr-FR']

describe('dateApi — date seule (colonne DATE)', () => {
  it.each(LANGUES)('%s : AAAA-MM-JJ → JJ/MM/AAAA', (locale) => {
    expect(dateApi('2026-06-30', locale)).toBe('30/06/2026')
    expect(dateApi('2026-01-05', locale)).toBe('05/01/2026')
    expect(dateApi('2028-02-29', locale)).toBe('29/02/2028')
  })

  it.each(['America/Los_Angeles', 'Pacific/Kiritimati', 'Europe/Lisbon', 'Europe/Paris'])('aucun décalage de jour, fuseau %s', (tz) => {
    process.env.TZ = tz
    expect(dateApi('2026-06-30', 'pt-PT')).toBe('30/06/2026')
    expect(dateApi('2026-01-01', 'fr-FR')).toBe('01/01/2026')
    expect(dateApi('2026-12-31', 'fr-FR')).toBe('31/12/2026')
  })
})

describe('dateApi — horodatage ISO', () => {
  it.each(LANGUES)('%s : jour civil dans le fuseau du navigateur', (locale) => {
    process.env.TZ = 'Europe/Lisbon'
    expect(dateApi('2026-05-01T10:00:00Z', locale)).toBe('01/05/2026')
    expect(dateApi('2026-05-01T10:00:00.123+00:00', locale)).toBe('01/05/2026')
    // 23 h 30 UTC = 0 h 30 le lendemain à Lisbonne (heure d'été, UTC+1).
    expect(dateApi('2026-05-01T23:30:00Z', locale)).toBe('02/05/2026')
  })

  it('décalage sans minutes ou sans deux-points (format texte de Postgres : « +00 », « +0100 »)', () => {
    process.env.TZ = 'Europe/Lisbon'
    expect(dateApi('2026-05-01 10:00:00+00', 'pt-PT')).toBe('01/05/2026')
    expect(dateApi('2026-05-01T23:30:00+00', 'fr-FR')).toBe('02/05/2026')
    expect(dateApi('2026-05-01T10:00:00+0100', 'fr-FR')).toBe('01/05/2026')
  })

  it('horodatage sans fuseau (heure locale) et séparateur espace', () => {
    process.env.TZ = 'Europe/Paris'
    expect(dateApi('2026-05-01T08:15', 'fr-FR')).toBe('01/05/2026')
    expect(dateApi('2026-05-01 08:15:00', 'fr-FR')).toBe('01/05/2026')
  })
})

describe('dateApi — valeur non ISO rendue telle quelle', () => {
  it.each([
    '30/06/2026',
    '21 de novembro de 2026',
    'Prazo expirado',
    '8 jours restants',
    '25/05',
    '2026-06',
    '2026-02-30',
    '2026-02-29',
    '2026-13-01',
    '2026-00-10',
    '0026-05-01',
    ' 2026-06-30',
    '2026-06-30x',
    '2026-02-30T10:00:00Z',
    '—',
  ])('« %s »', (valeur) => {
    expect(dateApi(valeur, 'pt-PT')).toBe(valeur)
    expect(dateApi(valeur, 'fr-FR')).toBe(valeur)
  })

  it('vide, null ou undefined → chaîne vide (les repli « — » des écrans restent actifs)', () => {
    expect(dateApi('', 'pt-PT')).toBe('')
    expect(dateApi(null, 'fr-FR')).toBe('')
    expect(dateApi(undefined, 'pt-PT')).toBe('')
    expect(dateApi(undefined, 'pt-PT') || '—').toBe('—')
  })
})
