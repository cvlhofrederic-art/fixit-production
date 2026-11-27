// tests/lib/btp-alerte-meteo.test.ts — seuils, lecture d'Open-Meteo, dates, texte et règle de suivi de l'alerte météo
// d'un chantier (décision de Frédéric du 26/11/2026 : « soumettre un chantier à l'alerte météo par notif ou pas »).

import { describe, expect, it } from 'vitest'
import {
  SEUILS_ALERTE_METEO, alerteDuJour, chantierSuiviLe, dateDecalee, dateLocale, debutDuChantier, decalageDuChantier,
  jourEnLettres, joursDePrevisions, libelleMotifs, momentAuChantier, motifsDuJour, positionPourAlerte,
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

/** Réponse de sept jours (comme forecast_days=7) avec la pluie donnée jour par jour. */
const semaine = (pluies: Array<number | null>) => ({
  daily: {
    time: ['2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02'],
    temperature_2m_max: Array(7).fill(15),
    temperature_2m_min: Array(7).fill(8),
    precipitation_sum: pluies,
    wind_speed_10m_max: Array(7).fill(10),
    weather_code: Array(7).fill(1),
  },
})

describe('seuils de l’alerte (les mêmes que l’écran Météo)', () => {
  it('pluie au-delà de 5 mm, gel sous 0 °C, vent au-delà de 60 km/h, chaleur au-delà de 33 °C', () => {
    expect(SEUILS_ALERTE_METEO).toEqual({ ventKmh: 60, gelC: 0, pluieMm: 5, chaleurC: 33 })
    expect(motifsDuJour(jour({ rain: 12.44 }))).toEqual([{ type: 'pluie', valeur: 12.4 }])
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

  it('alerte d’une journée : cherchée par sa date ; sans alerte ou absente : null', () => {
    expect(alerteDuJour(joursDePrevisions(reponse({ pluie: 14 })), '2026-11-27')).toEqual({
      date: '2026-11-27', motifs: [{ type: 'pluie', valeur: 14 }],
    })
    expect(alerteDuJour(joursDePrevisions(reponse()), '2026-11-27')).toBeNull()
    expect(alerteDuJour(joursDePrevisions(reponse({ pluie: 14 })), '2026-11-28')).toBeNull()
  })

  it('un jour incomplet ne décale pas les suivants : demain sec reste sec, même si après-demain est pluvieux', () => {
    for (const pluies of [[null, 0, 14, 0, 0, 0, 0], [0, null, 14, 0, 0, 0, 0]]) {
      const jours = joursDePrevisions(semaine(pluies))
      expect(alerteDuJour(jours, '2026-11-27')).toBeNull()
      expect(alerteDuJour(jours, '2026-11-28')).toEqual({ date: '2026-11-28', motifs: [{ type: 'pluie', valeur: 14 }] })
    }
  })
})

describe('dates et heure du chantier', () => {
  it('dateDecalee : fins de mois et d’année, sans fuseau', () => {
    expect(dateDecalee('2026-11-30', 1)).toBe('2026-12-01')
    expect(dateDecalee('2026-12-31', 1)).toBe('2027-01-01')
    expect(dateDecalee('2026-03-01', -1)).toBe('2026-02-28')
    expect(dateDecalee('2026-10-25', 1)).toBe('2026-10-26')
  })

  it('dateLocale : la date de l’appareil, pas la date UTC (fuseau fixé : à Lisbonne l’hiver, ou en UTC, rien ne se verrait)', () => {
    const tzInitial = process.env.TZ
    try {
      process.env.TZ = 'Europe/Paris'
      expect(dateLocale(new Date(2026, 10, 27, 0, 30))).toBe('2026-11-27') // 26/11 23:30 UTC
      process.env.TZ = 'Atlantic/Azores'
      expect(dateLocale(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05') // 06/01 00:59 UTC
    } finally {
      if (tzInitial === undefined) delete process.env.TZ
      else process.env.TZ = tzInitial
    }
  })

  it('décalage horaire de la réponse, borné ; heure et lendemain au chantier', () => {
    expect(decalageDuChantier({ utc_offset_seconds: 3600 })).toBe(3600)
    expect(decalageDuChantier({ utc_offset_seconds: -3600 })).toBe(-3600)
    for (const illisible of [{}, null, { utc_offset_seconds: '3600' }, { utc_offset_seconds: 999999 }]) {
      expect(decalageDuChantier(illisible)).toBeNull()
    }
    const instant = Date.UTC(2026, 10, 26, 18, 15)
    expect(momentAuChantier(instant, 0)).toEqual({ date: '2026-11-26', heure: 18, demain: '2026-11-27' }) // Lisbonne, hiver
    expect(momentAuChantier(instant, 3600)).toEqual({ date: '2026-11-26', heure: 19, demain: '2026-11-27' }) // Paris
    expect(momentAuChantier(instant, -3600)).toEqual({ date: '2026-11-26', heure: 17, demain: '2026-11-27' }) // Açores
    expect(momentAuChantier(Date.UTC(2026, 10, 26, 23, 30), 3600)).toEqual({ date: '2026-11-27', heure: 0, demain: '2026-11-28' })
  })
})

describe('texte de la notification et de l’e-mail', () => {
  it('en français, avec le jour visé en lettres', () => {
    expect(texteAlerteDuLendemain('Dalle Villa Durand', [{ type: 'pluie', valeur: 12 }, { type: 'vent', valeur: 65 }], false, '2026-11-27')).toEqual({
      titre: '🌧️ Alerte météo demain : Dalle Villa Durand',
      corps: 'Prévu demain, vendredi 27 novembre, sur le chantier « Dalle Villa Durand » : pluie 12 mm, vent 65 km/h.',
    })
  })

  it('en portugais', () => {
    expect(texteAlerteDuLendemain('Moradia Gaia', [{ type: 'gel', valeur: -2 }], true, '2026-11-27')).toEqual({
      titre: '❄️ Alerta meteorológico amanhã: Moradia Gaia',
      corps: 'Previsto para amanhã, sexta-feira, 27 de novembro, na obra « Moradia Gaia »: geada -2 °C.',
    })
    expect(libelleMotifs([{ type: 'chaleur', valeur: 35 }, { type: 'pluie', valeur: 8 }], true)).toBe('calor 35 °C, chuva 8 mm')
    // Pluie au dixième, comme l'écran Météo : juste au-dessus du seuil, jamais « 5 mm ».
    const [pluie] = motifsDuJour(jour({ rain: 5.3 }))
    expect(libelleMotifs([pluie], false)).toBe('pluie 5,3 mm')
    expect(libelleMotifs([pluie], true)).toBe('chuva 5,3 mm')
  })

  it('sans date (ou date illisible) : « demain » seul ; chantier sans titre : un nom générique', () => {
    expect(texteAlerteDuLendemain('Dalle', [{ type: 'pluie', valeur: 7 }], false).corps).toBe('Prévu demain sur le chantier « Dalle » : pluie 7 mm.')
    expect(texteAlerteDuLendemain('Dalle', [{ type: 'pluie', valeur: 7 }], true, 'n/a').corps).toBe('Previsto para amanhã na obra « Dalle »: chuva 7 mm.')
    expect(jourEnLettres('2026-11-30', false)).toBe('lundi 30 novembre')
    expect(texteAlerteDuLendemain('  ', [{ type: 'pluie', valeur: 7 }], false).titre).toBe('🌧️ Alerte météo demain : Chantier')
  })
})

describe('chantier suivi par l’alerte tel jour (règle commune au téléphone et à l’e-mail)', () => {
  const DEMAIN = '2026-11-27'

  it('case cochée et chantier en cours : suivi, sous le nom de la base comme de l’écran', () => {
    expect(chantierSuiviLe({ alerteMeteo: true, statut: 'En cours' }, DEMAIN)).toBe(true)
    expect(chantierSuiviLe({ alerte_meteo: true, statut: 'En cours' }, DEMAIN)).toBe(true)
  })

  it('« En attente » : seulement pour son premier jour (la veille de la dalle), jamais pour un chantier lointain', () => {
    expect(chantierSuiviLe({ alerte_meteo: true, statut: 'En attente', date_debut: DEMAIN }, DEMAIN)).toBe(true)
    expect(chantierSuiviLe({ alerteMeteo: true, statut: 'En attente', dateDebut: DEMAIN }, DEMAIN)).toBe(true)
    expect(chantierSuiviLe({ alerteMeteo: true, statut: 'En attente', dateDebut: '2026-12-15' }, DEMAIN)).toBe(false)
    expect(chantierSuiviLe({ alerteMeteo: true, statut: 'En attente', dateDebut: '2026-11-20' }, DEMAIN)).toBe(false)
    expect(chantierSuiviLe({ alerteMeteo: true, statut: 'En attente' }, DEMAIN)).toBe(false)
  })

  it('case décochée, terminé, annulé ou statut inconnu : jamais', () => {
    expect(chantierSuiviLe({ alerteMeteo: false, statut: 'En cours' }, DEMAIN)).toBe(false)
    expect(chantierSuiviLe({ statut: 'En cours' }, DEMAIN)).toBe(false)
    expect(chantierSuiviLe({ alerteMeteo: 'true', statut: 'En cours' }, DEMAIN)).toBe(false)
    for (const statut of ['Terminé', 'Annulé', 'Suspendu', undefined]) {
      expect(chantierSuiviLe({ alerteMeteo: true, statut, dateDebut: DEMAIN }, DEMAIN)).toBe(false)
    }
  })

  it('date de début : la partie date seulement, sous l’un ou l’autre nom', () => {
    expect(debutDuChantier({ date_debut: '2026-11-27T00:00:00' })).toBe('2026-11-27')
    expect(debutDuChantier({ dateDebut: '2026-11-27' })).toBe('2026-11-27')
    expect(debutDuChantier({ dateDebut: '' })).toBeNull()
    expect(debutDuChantier({ dateDebut: 20261127 })).toBeNull()
  })

  it('position utilisable : celle dont l’URL des prévisions a besoin', () => {
    expect(positionPourAlerte(43.25, 5.38)).toBe(true)
    expect(positionPourAlerte('41.15', '-8.61')).toBe(true)
    expect(positionPourAlerte(null, null)).toBe(false)
    expect(positionPourAlerte('', '')).toBe(false)
    expect(positionPourAlerte(95, 5)).toBe(false)
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

  it('le salarié la reçoit dans la vue restreinte de ses chantiers, avec la date de début', async () => {
    const { COLONNES_VUE_RESTREINTE } = await import('@/lib/btp/perimetre-compte')
    expect(COLONNES_VUE_RESTREINTE.chantiers).toEqual(expect.arrayContaining(['alerte_meteo', 'date_debut', 'statut', 'latitude', 'longitude']))
  })
})

describe('affectation sans le statut (lib/btp/pointage-regles.ts) : même règle que chantiersAffectes', () => {
  it('directe ou par l’équipe ; chantiersAffectes = les affectés « En cours »', async () => {
    const { estAffecte, chantiersAffectes } = await import('@/lib/btp/pointage-regles')
    const joao = { id: 'm-joao' }
    const equipes = [{ id: 'e-1', chantier_id: 'c-b', equipe_membres_btp: [{ membre_id: 'm-joao' }] }, { id: 'e-2', chantier_id: 'c-c' }]
    const chantiers = [
      { id: 'c-a', statut: 'En cours', membres_ids: ['m-joao'] },
      { id: 'c-b', statut: 'En attente', membres_ids: [] },
      { id: 'c-c', statut: 'En cours', membres_ids: ['m-paulo'] },
      { id: 'c-d', statut: 'En cours' },
    ]
    expect(chantiers.filter(c => estAffecte(joao, c, equipes)).map(c => c.id)).toEqual(['c-a', 'c-b'])
    expect(chantiersAffectes(joao, chantiers, equipes).map(c => c.id))
      .toEqual(chantiers.filter(c => c.statut === 'En cours' && estAffecte(joao, c, equipes)).map(c => c.id))
  })
})
