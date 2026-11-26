// tests/lib/btp-alerte-meteo.test.ts — seuils, lecture d'Open-Meteo et texte de l'alerte météo d'un chantier
// (décision de Frédéric du 26/11/2026 : « soumettre un chantier à l'alerte météo par notif ou pas »).

import { describe, expect, it } from 'vitest'
import {
  SEUILS_ALERTE_METEO, alerteDuLendemain, chantierSoumisAlerte, joursDePrevisions, libelleMotifs, motifsDuJour,
  texteAlerteDuLendemain, type JourPrevu,
} from '@/lib/btp/alerte-meteo'

const jour = (p: Partial<JourPrevu> = {}): JourPrevu => ({
  date: '2026-11-27', tempMax: 15, tempMin: 8, rain: 0, windMax: 10, weatherCode: 1, ...p,
})

/** Réponse Open-Meteo (`daily`) de deux jours : aujourd'hui sec, demain selon `demain`. */
const reponse = (demain: Partial<{ max: number; min: number; pluie: number; vent: number }> = {}) => ({
  daily: {
    time: ['2026-11-26', '2026-11-27'],
    temperature_2m_max: [15, demain.max ?? 15],
    temperature_2m_min: [8, demain.min ?? 8],
    precipitation_sum: [0, demain.pluie ?? 0],
    wind_speed_10m_max: [10, demain.vent ?? 10],
    weather_code: [1, 61],
  },
})

describe('seuils de l’alerte (les mêmes que l’écran Météo)', () => {
  it('pluie au-delà de 5 mm, gel sous 0 °C, vent au-delà de 60 km/h, chaleur au-delà de 33 °C', () => {
    expect(SEUILS_ALERTE_METEO).toEqual({ ventKmh: 60, gelC: 0, pluieMm: 5, chaleurC: 33 })
    expect(motifsDuJour(jour({ rain: 12.4 }))).toEqual([{ type: 'pluie', valeur: 12 }])
    expect(motifsDuJour(jour({ tempMin: -3.2 }))).toEqual([{ type: 'gel', valeur: -3 }])
    expect(motifsDuJour(jour({ windMax: 65 }))).toEqual([{ type: 'vent', valeur: 65 }])
    expect(motifsDuJour(jour({ tempMax: 36 }))).toEqual([{ type: 'chaleur', valeur: 36 }])
  })

  it('pile au seuil : pas d’alerte (strictement au-delà, comme l’écran Météo)', () => {
    expect(motifsDuJour(jour({ rain: 5, tempMin: 0, windMax: 60, tempMax: 33 }))).toEqual([])
  })

  it('plusieurs motifs : dans l’ordre vent, gel, pluie, chaleur', () => {
    expect(motifsDuJour(jour({ rain: 20, windMax: 80, tempMin: -1 })).map(m => m.type)).toEqual(['vent', 'gel', 'pluie'])
  })
})

describe('lecture de la réponse Open-Meteo', () => {
  it('jours dans l’ordre, mesures reprises telles quelles', () => {
    expect(joursDePrevisions(reponse({ pluie: 9 }))).toEqual([
      { date: '2026-11-26', tempMax: 15, tempMin: 8, rain: 0, windMax: 10, weatherCode: 1 },
      { date: '2026-11-27', tempMax: 15, tempMin: 8, rain: 9, windMax: 10, weatherCode: 61 },
    ])
  })

  it('un jour dont une mesure manque est écarté ; une réponse illisible ne donne aucun jour', () => {
    const trouee = reponse()
    trouee.daily.precipitation_sum = [0, null as unknown as number]
    expect(joursDePrevisions(trouee).map(j => j.date)).toEqual(['2026-11-26'])
    for (const illisible of [null, 'x', {}, { daily: null }, { daily: { time: 'x' } }]) {
      expect(joursDePrevisions(illisible)).toEqual([])
    }
  })

  it('alerte du lendemain : le second jour de la réponse ; aucune alerte, ou un seul jour : null', () => {
    expect(alerteDuLendemain(joursDePrevisions(reponse({ pluie: 14 })))).toEqual({
      date: '2026-11-27', motifs: [{ type: 'pluie', valeur: 14 }],
    })
    expect(alerteDuLendemain(joursDePrevisions(reponse()))).toBeNull()
    expect(alerteDuLendemain([jour({ rain: 30 })])).toBeNull()
  })
})

describe('texte de la notification et de l’e-mail', () => {
  it('en français', () => {
    expect(texteAlerteDuLendemain('Dalle Villa Durand', [{ type: 'pluie', valeur: 12 }, { type: 'vent', valeur: 65 }], false)).toEqual({
      titre: '🌧️ Alerte météo demain : Dalle Villa Durand',
      corps: 'Prévu demain sur le chantier « Dalle Villa Durand » : pluie 12 mm, vent 65 km/h.',
    })
  })

  it('en portugais', () => {
    expect(texteAlerteDuLendemain('Moradia Gaia', [{ type: 'gel', valeur: -2 }], true)).toEqual({
      titre: '❄️ Alerta meteorológico amanhã: Moradia Gaia',
      corps: 'Previsto para amanhã na obra « Moradia Gaia »: geada -2 °C.',
    })
    expect(libelleMotifs([{ type: 'chaleur', valeur: 35 }, { type: 'pluie', valeur: 8 }], true)).toBe('calor 35 °C, chuva 8 mm')
  })

  it('chantier sans titre : un nom générique', () => {
    expect(texteAlerteDuLendemain('  ', [{ type: 'pluie', valeur: 7 }], false).titre).toBe('🌧️ Alerte météo demain : Chantier')
  })
})

describe('chantier suivi par l’alerte', () => {
  it('seulement s’il est soumis à l’alerte et ni terminé ni annulé', () => {
    expect(chantierSoumisAlerte({ alerteMeteo: true, statut: 'En cours' })).toBe(true)
    expect(chantierSoumisAlerte({ alerte_meteo: true, statut: 'En attente' })).toBe(true)
    expect(chantierSoumisAlerte({ alerteMeteo: false, statut: 'En cours' })).toBe(false)
    expect(chantierSoumisAlerte({ statut: 'En cours' })).toBe(false)
    expect(chantierSoumisAlerte({ alerteMeteo: true, statut: 'Terminé' })).toBe(false)
    expect(chantierSoumisAlerte({ alerteMeteo: true, statut: 'Annulé' })).toBe(false)
  })
})

describe('case de la fiche chantier ↔ colonne alerte_meteo (lib/hooks/use-btp-data.ts)', () => {
  it('écrite seulement quand la fiche la fournit, toujours en booléen ; relue en alerteMeteo', async () => {
    const { mapToSupabase, mapFromSupabase } = await import('@/lib/hooks/use-btp-data')
    expect(mapToSupabase('chantiers', { titre: 'Dalle', alerteMeteo: true }).alerte_meteo).toBe(true)
    expect(mapToSupabase('chantiers', { titre: 'Dalle', alerteMeteo: 'oui' }).alerte_meteo).toBe(false)
    expect('alerte_meteo' in mapToSupabase('chantiers', { titre: 'Dalle' })).toBe(false)
    expect(mapFromSupabase('chantiers', { titre: 'Dalle', alerte_meteo: true }).alerteMeteo).toBe(true)
    expect(mapFromSupabase('chantiers', { titre: 'Dalle' }).alerteMeteo).toBe(false)
  })

  it('le salarié la reçoit dans la vue restreinte de ses chantiers (son téléphone programme l’alerte)', async () => {
    const { COLONNES_VUE_RESTREINTE } = await import('@/lib/btp/perimetre-compte')
    expect(COLONNES_VUE_RESTREINTE.chantiers).toContain('alerte_meteo')
  })
})
