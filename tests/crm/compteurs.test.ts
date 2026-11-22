// CRM du secrétariat : compteurs de l'écran d'accueil (lib/crm/compteurs.ts), lus dans le fuseau de l'équipe.

import { describe, expect, it } from 'vitest'
import { calculerCompteurs, dateCivile, estATraiterAujourdhui, estEnRetard } from '@/lib/crm/compteurs'
import type { StatutCrm } from '@/lib/crm/types'

const d = (statut: StatutCrm, rappel_le: string | null = null, resolue_le: string | null = null) => ({ statut, rappel_le, resolue_le })

// 22/11/2026 à 15:00 à Lisbonne (UTC+0 en hiver).
const MAINTENANT = new Date('2026-11-22T15:00:00Z')

describe('estATraiterAujourdhui', () => {
  it('demande ouverte sans rappel : à traiter', () => {
    expect(estATraiterAujourdhui(d('nouvelle'), MAINTENANT)).toBe(true)
    expect(estATraiterAujourdhui(d('en_attente'), MAINTENANT)).toBe(true)
  })

  it('rappel du jour (même plus tard) ou passé : à traiter ; rappel de demain : non', () => {
    expect(estATraiterAujourdhui(d('en_cours', '2026-11-22T23:30:00Z'), MAINTENANT)).toBe(true)
    expect(estATraiterAujourdhui(d('en_cours', '2026-11-20T09:00:00Z'), MAINTENANT)).toBe(true)
    expect(estATraiterAujourdhui(d('en_attente', '2026-11-23T09:00:00Z'), MAINTENANT)).toBe(false)
  })

  it('résolue : jamais', () => {
    expect(estATraiterAujourdhui(d('resolue'), MAINTENANT)).toBe(false)
  })

  it('le jour se lit dans le fuseau de l’équipe, pas en UTC', () => {
    // 23:30 UTC le 22/11 = 00:30 le 23/11 à Paris : pour une équipe à Paris, ce rappel est pour demain.
    const rappel = '2026-11-22T23:30:00Z'
    expect(dateCivile(new Date(rappel), 'Europe/Lisbon')).toBe('2026-11-22')
    expect(dateCivile(new Date(rappel), 'Europe/Paris')).toBe('2026-11-23')
    expect(estATraiterAujourdhui(d('en_cours', rappel), MAINTENANT, 'Europe/Paris')).toBe(false)
  })
})

describe('estEnRetard', () => {
  it('rappel passé sur une demande ouverte seulement', () => {
    expect(estEnRetard(d('en_cours', '2026-11-22T14:59:00Z'), MAINTENANT)).toBe(true)
    expect(estEnRetard(d('en_cours', '2026-11-22T15:01:00Z'), MAINTENANT)).toBe(false)
    expect(estEnRetard(d('resolue', '2026-11-20T09:00:00Z'), MAINTENANT)).toBe(false)
    expect(estEnRetard(d('nouvelle'), MAINTENANT)).toBe(false)
  })
})

describe('calculerCompteurs', () => {
  it('compte à traiter, en retard et résolues sur 7 jours glissants', () => {
    const demandes = [
      d('nouvelle'),
      d('en_cours', '2026-11-22T10:00:00Z'), // en retard, donc aussi à traiter
      d('en_attente', '2026-11-25T10:00:00Z'), // plus tard
      d('resolue', null, '2026-11-21T10:00:00Z'),
      d('resolue', null, '2026-11-15T15:00:01Z'), // 7 jours moins une seconde
      d('resolue', null, '2026-11-15T14:59:59Z'), // hors fenêtre
      d('resolue', null, null),
    ]
    expect(calculerCompteurs(demandes, MAINTENANT)).toEqual({ aTraiterAujourdhui: 2, enRetard: 1, resoluesSemaine: 2 })
  })

  it('liste vide → zéros', () => {
    expect(calculerCompteurs([], MAINTENANT)).toEqual({ aTraiterAujourdhui: 0, enRetard: 0, resoluesSemaine: 0 })
  })
})
