// tests/lib/btp-pointage-arriere-plan.test.ts — règles du pointage BTP « téléphone en poche »
// (lib/btp/pointage-arriere-plan.ts, 17/11/2026) : instant d'un événement, jeton du téléphone, zone du système.

import { describe, expect, it } from 'vitest'
import {
  AGE_MAX_EVENEMENT_MS, RAYON_MIN_ZONE_SYSTEME_M, RETARD_NOTE_MS, empreinteJeton, evenementSchema, instantEvenement,
  jetonDeLEnTete, noteArriveeTardive, nouveauJeton, rayonZoneSysteme,
} from '@/lib/btp/pointage-arriere-plan'
import { TOLERANCE_HORLOGE_MS } from '@/lib/btp/pointage-regles'

const T = Date.UTC(2026, 10, 17, 9, 0, 0)
const CHANTIER = '3e4f5a6b-7c8d-4e9f-8a1b-2c3d4e5f6a01'

describe('instant d’un événement', () => {
  it('sans heure : celle de réception', () => {
    expect(instantEvenement(undefined, T)).toBe(T)
  })

  it('heure de détection passée : retenue, arrondie à la milliseconde', () => {
    expect(instantEvenement(T - 5 * 60_000 + 0.4, T)).toBe(T - 5 * 60_000)
  })

  it('future (horloge du téléphone en avance, même de beaucoup) : celle de réception', () => {
    expect(instantEvenement(T + TOLERANCE_HORLOGE_MS, T)).toBe(T)
    expect(instantEvenement(T + 3_600_000, T)).toBe(T)
  })

  it('12 h tout juste : retenue ; plus vieille : refusée (file du téléphone vidée tard)', () => {
    expect(instantEvenement(T - AGE_MAX_EVENEMENT_MS, T)).toBe(T - AGE_MAX_EVENEMENT_MS)
    expect(instantEvenement(T - AGE_MAX_EVENEMENT_MS - 1, T)).toBeNull()
  })

  it('valeur non finie : refusée', () => {
    expect(instantEvenement(Number.NaN, T)).toBeNull()
    expect(instantEvenement(Number.POSITIVE_INFINITY, T)).toBeNull()
  })
})

describe('note d’une arrivée reçue tard', () => {
  it('jusqu’à 15 min après la détection : aucune ; au-delà : le retard en minutes, à vérifier', () => {
    expect(noteArriveeTardive(T, T)).toBeNull()
    expect(noteArriveeTardive(T - RETARD_NOTE_MS, T)).toBeNull()
    expect(noteArriveeTardive(T - RETARD_NOTE_MS - 1, T)).toBe('Arrivée reçue 15 min après sa détection par le téléphone (envoi retardé) : à vérifier.')
    expect(noteArriveeTardive(T - 125 * 60_000, T)).toBe('Arrivée reçue 125 min après sa détection par le téléphone (envoi retardé) : à vérifier.')
  })
})

describe('jeton du téléphone', () => {
  it('32 octets aléatoires en base64url : 43 caractères, jamais deux fois le même', () => {
    const premier = nouveauJeton()
    expect(premier).toMatch(/^[\w-]{43}$/)
    expect(nouveauJeton()).not.toBe(premier)
  })

  it('empreinte SHA-256 en hexadécimal (vecteur connu de la norme)', async () => {
    expect(await empreinteJeton('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('en-tête « Bearer » : jeton lu ; absent, trop court, autre schéma ou suivi d’autre chose : null', () => {
    const jeton = nouveauJeton()
    expect(jetonDeLEnTete(`Bearer ${jeton}`)).toBe(jeton)
    expect(jetonDeLEnTete(`  Bearer ${jeton}  `)).toBe(jeton)
    expect(jetonDeLEnTete(null)).toBeNull()
    expect(jetonDeLEnTete('Bearer court')).toBeNull()
    expect(jetonDeLEnTete(`Basic ${jeton}`)).toBeNull()
    expect(jetonDeLEnTete(`Bearer ${jeton} autre`)).toBeNull()
  })
})

describe('zone du système et événement', () => {
  it('rayon du chantier, jamais sous le minimum que le système sait tenir', () => {
    expect(rayonZoneSysteme(50)).toBe(RAYON_MIN_ZONE_SYSTEME_M)
    expect(rayonZoneSysteme(RAYON_MIN_ZONE_SYSTEME_M)).toBe(RAYON_MIN_ZONE_SYSTEME_M)
    expect(rayonZoneSysteme(300.4)).toBe(300)
  })

  it('événement lu : chantier, entrée ou sortie, heure ; centre, rayon et autres champs écartés', () => {
    const lu = evenementSchema.safeParse({
      identifier: CHANTIER, transition: 'enter', enter: true, time: T, latitude: 43.25, longitude: 5.38, radius: 150, payload: { v: 1 },
    })
    expect(lu.success && lu.data).toEqual({ identifier: CHANTIER, transition: 'enter', time: T })
    expect(evenementSchema.safeParse({ identifier: 'bureau', transition: 'enter' }).success).toBe(false)
    expect(evenementSchema.safeParse({ identifier: CHANTIER, transition: 'dwell' }).success).toBe(false)
    expect(evenementSchema.safeParse({ identifier: CHANTIER, transition: 'exit', time: 'hier' }).success).toBe(false)
  })
})
