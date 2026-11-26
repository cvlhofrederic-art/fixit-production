// tests/lib/btp-alerte-meteo-telephone.test.ts — programmation de l'alerte météo de la veille sur le téléphone
// (appli Vitfix Pro, 26/11/2026) : 18 h la veille, tout de suite après 18 h (une seule fois), annulée si l'alerte
// disparaît, rien pour un chantier non soumis à l'alerte ou sans position.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleNotificationAlerte, programmerAlertesMeteo, type ChantierPourAlerte } from '@/lib/btp/alerte-meteo-telephone'

const DALLE: ChantierPourAlerte = { id: 'c-dalle', titre: 'Dalle Villa', statut: 'En cours', latitude: 43.3, longitude: 5.38, alerteMeteo: true }

/** Fausse réponse d'Open-Meteo : aujourd'hui sec, demain `pluie` mm. */
const meteo = (pluie: number) => vi.fn(async () => new Response(JSON.stringify({
  daily: {
    time: ['2026-11-26', '2026-11-27'],
    temperature_2m_max: [15, 15], temperature_2m_min: [8, 8],
    precipitation_sum: [0, pluie], wind_speed_10m_max: [10, 10], weather_code: [1, 61],
  },
})))

const outils = () => ({ programmer: vi.fn(async () => true), annuler: vi.fn(async () => {}) })
const a = (heure: number) => new Date(2026, 10, 26, heure, 15)

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('alerte météo de la veille sur le téléphone', () => {
  it('avant 18 h : programmée pour 18 h aujourd’hui, avec le texte de l’alerte', async () => {
    const o = outils()
    const bilan = await programmerAlertesMeteo([DALLE], false, o, a(9), meteo(12))
    expect(bilan).toMatchObject({ programmees: 1, affichees: 0 })
    expect(o.programmer).toHaveBeenCalledWith({
      cle: cleNotificationAlerte('c-dalle', '2026-11-27'),
      titre: '🌧️ Alerte météo demain : Dalle Villa',
      corps: 'Prévu demain sur le chantier « Dalle Villa » : pluie 12 mm.',
      a: new Date(2026, 10, 26, 18, 0, 0, 0),
      extra: { chantierId: 'c-dalle', date: '2026-11-27' },
    })
  })

  it('reprogrammée à chaque ouverture avant 18 h (la même clé remplace la précédente)', async () => {
    const o = outils()
    await programmerAlertesMeteo([DALLE], false, o, a(8), meteo(9))
    await programmerAlertesMeteo([DALLE], false, o, a(13), meteo(15))
    expect(o.programmer).toHaveBeenCalledTimes(2)
    const cles = o.programmer.mock.calls.map(c => (c as unknown as [{ cle: string }])[0].cle)
    expect(new Set(cles).size).toBe(1)
  })

  it('après 18 h : affichée tout de suite, une seule fois même si l’appli est rouverte', async () => {
    const o = outils()
    await programmerAlertesMeteo([DALLE], true, o, a(19), meteo(12))
    await programmerAlertesMeteo([DALLE], true, o, a(21), meteo(12))
    expect(o.programmer).toHaveBeenCalledTimes(1)
    const appel = (o.programmer.mock.calls[0] as unknown as [{ a?: Date; titre: string }])[0]
    expect(appel.a).toBeUndefined()
    expect(appel.titre).toBe('🌧️ Alerta meteorológico amanhã: Dalle Villa')
  })

  it('déjà programmée pour 18 h : rien de plus quand l’appli est rouverte après 18 h', async () => {
    const o = outils()
    await programmerAlertesMeteo([DALLE], false, o, a(10), meteo(12))
    await programmerAlertesMeteo([DALLE], false, o, a(20), meteo(12))
    expect(o.programmer).toHaveBeenCalledTimes(1)
  })

  it('l’alerte de demain disparaît : la notification programmée est annulée', async () => {
    const o = outils()
    await programmerAlertesMeteo([DALLE], false, o, a(9), meteo(12))
    const bilan = await programmerAlertesMeteo([DALLE], false, o, a(15), meteo(1))
    expect(bilan.annulees).toBe(1)
    expect(o.annuler).toHaveBeenCalledWith(cleNotificationAlerte('c-dalle', '2026-11-27'))
  })

  it('pas d’alerte demain et rien de programmé : ni notification ni annulation', async () => {
    const o = outils()
    await programmerAlertesMeteo([DALLE], false, o, a(9), meteo(2))
    expect(o.programmer).not.toHaveBeenCalled()
    expect(o.annuler).not.toHaveBeenCalled()
  })

  it('chantier non soumis à l’alerte, terminé ou sans position : laissé de côté, sans appel météo', async () => {
    const o = outils()
    const lire = meteo(30)
    const bilan = await programmerAlertesMeteo([
      { ...DALLE, id: 'interieur', alerteMeteo: false },
      { ...DALLE, id: 'fini', statut: 'Terminé' },
      { ...DALLE, id: 'sans-gps', latitude: null, longitude: null },
    ], false, o, a(9), lire)
    expect(o.programmer).not.toHaveBeenCalled()
    expect(lire).toHaveBeenCalledTimes(0)
    expect(bilan.ignorees).toBe(1)
  })

  it('service météo injoignable : le chantier est revu à la prochaine ouverture, sans erreur', async () => {
    const o = outils()
    const lire = vi.fn(async () => { throw new TypeError('Failed to fetch') })
    const bilan = await programmerAlertesMeteo([DALLE], false, o, a(9), lire)
    expect(bilan.ignorees).toBe(1)
    expect(o.programmer).not.toHaveBeenCalled()
  })

  it('notification refusée par le téléphone (permission) : rien n’est retenu, nouvel essai à la prochaine ouverture', async () => {
    const o = { programmer: vi.fn(async () => false), annuler: vi.fn(async () => {}) }
    await programmerAlertesMeteo([DALLE], false, o, a(19), meteo(12))
    await programmerAlertesMeteo([DALLE], false, o, a(20), meteo(12))
    expect(o.programmer).toHaveBeenCalledTimes(2)
  })
})
