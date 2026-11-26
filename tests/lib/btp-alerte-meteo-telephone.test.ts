// tests/lib/btp-alerte-meteo-telephone.test.ts — programmation de l'alerte météo de la veille sur le téléphone
// (appli Vitfix Pro, 26/11/2026) : 18 h la veille de chaque journée en alerte des trois jours suivants (le dimanche soir
// pour le lundi), tout de suite après 18 h (une seule fois), annulée quand l'alerte, la case, le statut ou l'affectation
// disparaissent, jamais sur une prévision illisible ; mémoire de l'appareil purgée ; journées cherchées par leur date.
// L'heure du téléphone est passée en paramètre : rien ne dépend de l'horloge ni du fuseau de la machine.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dateDecalee } from '@/lib/btp/alerte-meteo'
import { cleNotificationAlerte, programmerAlertesMeteo, type ChantierPourAlerte } from '@/lib/btp/alerte-meteo-telephone'

const DALLE: ChantierPourAlerte = { id: 'c-dalle', titre: 'Dalle Villa', statut: 'En cours', latitude: 43.3, longitude: 5.38, alerteMeteo: true }
const CLE_VENDREDI = cleNotificationAlerte('c-dalle', '2026-11-27')

/** Fausse réponse d'Open-Meteo sur sept jours à partir de `debut` (date du chantier), avec la pluie donnée par date. */
const meteo = (pluies: Record<string, number>, debut = '2026-11-26') => vi.fn(async () => {
  const dates = Array.from({ length: 7 }, (_, i) => dateDecalee(debut, i))
  return new Response(JSON.stringify({
    utc_offset_seconds: 0,
    daily: {
      time: dates,
      temperature_2m_max: dates.map(() => 15), temperature_2m_min: dates.map(() => 8),
      precipitation_sum: dates.map(d => pluies[d] ?? 0), wind_speed_10m_max: dates.map(() => 10), weather_code: dates.map(() => 61),
    },
  }))
})

const outils = (enAttente = false) => ({
  programmer: vi.fn(async (_p: { cle: string; titre: string; corps: string; a?: Date; extra?: Record<string, unknown> }) => true),
  annuler: vi.fn(async (_cle: string) => {}),
  enAttente: vi.fn(async (_cle: string) => enAttente),
})
/** Jeudi 26/11/2026 à l'heure dite, heure du téléphone. */
const jeudi = (heure: number, minute = 15) => new Date(2026, 10, 26, heure, minute)
const cles = (o: ReturnType<typeof outils>) => o.programmer.mock.calls.map(c => c[0].cle)

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('alerte météo de la veille sur le téléphone', () => {
  it('avant 18 h : programmée pour 18 h aujourd’hui, avec le texte et le jour de l’alerte', async () => {
    const o = outils()
    const bilan = await programmerAlertesMeteo([DALLE], false, o, jeudi(9), meteo({ '2026-11-27': 12 }))
    expect(bilan).toMatchObject({ programmees: 1, affichees: 0, annulees: 0 })
    expect(o.programmer).toHaveBeenCalledWith({
      cle: CLE_VENDREDI,
      titre: '🌧️ Alerte météo demain : Dalle Villa',
      corps: 'Prévu demain, vendredi 27 novembre, sur le chantier « Dalle Villa » : pluie 12 mm.',
      a: new Date(2026, 10, 26, 18, 0, 0, 0),
      extra: { chantierId: 'c-dalle', date: '2026-11-27' },
    })
  })

  it('trois journées couvertes : depuis le vendredi matin, la pluie du lundi sonne le dimanche à 18 h', async () => {
    const o = outils()
    const vendredi = new Date(2026, 10, 27, 7, 30)
    await programmerAlertesMeteo([DALLE], false, o, vendredi, meteo({ '2026-11-30': 15 }, '2026-11-27'))
    expect(o.programmer).toHaveBeenCalledTimes(1)
    expect(o.programmer.mock.calls[0][0]).toMatchObject({
      cle: cleNotificationAlerte('c-dalle', '2026-11-30'),
      a: new Date(2026, 10, 29, 18, 0, 0, 0),
    })
  })

  it('pas au-delà de trois journées', async () => {
    const o = outils()
    await programmerAlertesMeteo([DALLE], false, o, jeudi(9), meteo({ '2026-11-30': 20, '2026-12-01': 20 }))
    expect(o.programmer).not.toHaveBeenCalled()
  })

  it('reprogrammée à chaque passage avant 18 h (la même clé remplace la précédente)', async () => {
    const o = outils()
    await programmerAlertesMeteo([DALLE], false, o, jeudi(8), meteo({ '2026-11-27': 9 }))
    await programmerAlertesMeteo([DALLE], false, o, jeudi(13), meteo({ '2026-11-27': 15 }))
    expect(cles(o)).toEqual([CLE_VENDREDI, CLE_VENDREDI])
  })

  it('après 18 h : affichée tout de suite, sans heure, une seule fois même si l’appli est rouverte', async () => {
    const o = outils()
    await programmerAlertesMeteo([DALLE], true, o, jeudi(19), meteo({ '2026-11-27': 12 }))
    const bilan = await programmerAlertesMeteo([DALLE], true, o, jeudi(21), meteo({ '2026-11-27': 12 }))
    expect(o.programmer).toHaveBeenCalledTimes(1)
    const appel = o.programmer.mock.calls[0][0]
    expect(appel.a).toBeUndefined()
    expect(appel.titre).toBe('🌧️ Alerta meteorológico amanhã: Dalle Villa')
    expect(bilan.affichees).toBe(0)
  })

  it('programmée pour 18 h et partie : rien de plus quand l’appli est rouverte après 18 h', async () => {
    const o = outils(false)
    await programmerAlertesMeteo([DALLE], false, o, jeudi(10), meteo({ '2026-11-27': 12 }))
    await programmerAlertesMeteo([DALLE], false, o, jeudi(20), meteo({ '2026-11-27': 12 }))
    expect(o.programmer).toHaveBeenCalledTimes(1)
    expect(o.enAttente).toHaveBeenCalledWith(CLE_VENDREDI)
  })

  it('programmée pour 18 h mais restée en attente (appli tuée, alarme perdue) : remplacée et affichée tout de suite', async () => {
    const o = outils(true)
    await programmerAlertesMeteo([DALLE], false, o, jeudi(10), meteo({ '2026-11-27': 12 }))
    const bilan = await programmerAlertesMeteo([DALLE], false, o, jeudi(20), meteo({ '2026-11-27': 12 }))
    expect(o.annuler).toHaveBeenCalledWith(CLE_VENDREDI)
    expect(o.programmer).toHaveBeenCalledTimes(2)
    expect(o.programmer.mock.calls[1][0].a).toBeUndefined()
    expect(bilan.affichees).toBe(1)
    await programmerAlertesMeteo([DALLE], false, o, jeudi(21), meteo({ '2026-11-27': 12 }))
    expect(o.programmer).toHaveBeenCalledTimes(2)
  })

  it('l’alerte de la journée disparaît : la notification programmée est annulée', async () => {
    const o = outils()
    await programmerAlertesMeteo([DALLE], false, o, jeudi(9), meteo({ '2026-11-27': 12 }))
    const bilan = await programmerAlertesMeteo([DALLE], false, o, jeudi(15), meteo({ '2026-11-27': 1 }))
    expect(bilan.annulees).toBe(1)
    expect(o.annuler).toHaveBeenCalledWith(CLE_VENDREDI)
  })

  it('pas d’alerte et rien de programmé : ni notification ni annulation', async () => {
    const o = outils()
    await programmerAlertesMeteo([DALLE], false, o, jeudi(9), meteo({}))
    expect(o.programmer).not.toHaveBeenCalled()
    expect(o.annuler).not.toHaveBeenCalled()
  })
})

describe('chantier sorti de l’alerte après la programmation : annulée avant 18 h', () => {
  for (const [cas, liste] of [
    ['case décochée', [{ ...DALLE, alerteMeteo: false }]],
    ['chantier terminé', [{ ...DALLE, statut: 'Terminé' }]],
    ['absent de la liste (salarié affecté ailleurs, chantier retiré de sa vue)', []],
  ] as Array<[string, ChantierPourAlerte[]]>) {
    it(cas, async () => {
      const o = outils()
      await programmerAlertesMeteo([DALLE], false, o, jeudi(9), meteo({ '2026-11-27': 12 }))
      const bilan = await programmerAlertesMeteo(liste, false, o, jeudi(15), meteo({ '2026-11-27': 12 }))
      expect(o.annuler).toHaveBeenCalledWith(CLE_VENDREDI)
      expect(bilan.annulees).toBe(1)
      expect(o.programmer).toHaveBeenCalledTimes(1)
    })
  }

  it('annulée puis l’alerte revient le soir : affichée (la clé a bien été oubliée)', async () => {
    const o = outils()
    await programmerAlertesMeteo([DALLE], false, o, jeudi(9), meteo({ '2026-11-27': 12 }))
    await programmerAlertesMeteo([{ ...DALLE, alerteMeteo: false }], false, o, jeudi(15), meteo({ '2026-11-27': 12 }))
    const bilan = await programmerAlertesMeteo([DALLE], false, o, jeudi(19), meteo({ '2026-11-27': 12 }))
    expect(bilan.affichees).toBe(1)
  })

  it('prévision injoignable pour un chantier encore suivi : rien n’est annulé', async () => {
    const o = outils()
    await programmerAlertesMeteo([DALLE], false, o, jeudi(9), meteo({ '2026-11-27': 12 }))
    const panne = vi.fn(async () => { throw new TypeError('Failed to fetch') })
    const bilan = await programmerAlertesMeteo([DALLE], false, o, jeudi(15), panne)
    expect(o.annuler).not.toHaveBeenCalled()
    expect(bilan.ignorees).toBe(1)
  })

  it('journée absente de la prévision (incomplète) : la notification déjà programmée reste', async () => {
    const o = outils()
    await programmerAlertesMeteo([DALLE], false, o, jeudi(9), meteo({ '2026-11-27': 12 }))
    const trouee = vi.fn(async () => new Response(JSON.stringify({
      daily: {
        time: ['2026-11-26', '2026-11-27'], temperature_2m_max: [15, 15], temperature_2m_min: [8, 8],
        precipitation_sum: [0, null], wind_speed_10m_max: [10, 10], weather_code: [1, 61],
      },
    })))
    await programmerAlertesMeteo([DALLE], false, o, jeudi(15), trouee)
    expect(o.annuler).not.toHaveBeenCalled()
  })
})

describe('quels chantiers', () => {
  it('non soumis, terminé, ou « En attente » lointain : laissés de côté sans appel météo ; sans position : ignoré', async () => {
    const o = outils()
    const lire = meteo({ '2026-11-27': 30 })
    const bilan = await programmerAlertesMeteo([
      { ...DALLE, id: 'interieur', alerteMeteo: false },
      { ...DALLE, id: 'fini', statut: 'Terminé' },
      { ...DALLE, id: 'lointain', statut: 'En attente', dateDebut: '2026-12-15' },
      { ...DALLE, id: 'sans-gps', latitude: null, longitude: null },
    ], false, o, jeudi(9), lire)
    expect(o.programmer).not.toHaveBeenCalled()
    expect(lire).not.toHaveBeenCalled()
    expect(bilan.ignorees).toBe(1)
  })

  it('« En attente » qui commence demain : la veille du premier jour est prévenue (gérant, liste complète)', async () => {
    const o = outils()
    await programmerAlertesMeteo([{ ...DALLE, statut: 'En attente', date_debut: '2026-11-27' }], false, o, jeudi(9),
      meteo({ '2026-11-27': 12, '2026-11-28': 12 }))
    expect(cles(o)).toEqual([CLE_VENDREDI])
  })

  it('service météo injoignable : revu au prochain passage, sans erreur', async () => {
    const o = outils()
    const bilan = await programmerAlertesMeteo([DALLE], false, o, jeudi(9), vi.fn(async () => new Response('', { status: 503 })))
    expect(bilan.ignorees).toBe(1)
    expect(o.programmer).not.toHaveBeenCalled()
  })

  it('notification refusée par le téléphone (permission) : rien n’est retenu, nouvel essai au passage suivant', async () => {
    const o = { ...outils(), programmer: vi.fn(async () => false) }
    await programmerAlertesMeteo([DALLE], false, o, jeudi(19), meteo({ '2026-11-27': 12 }))
    await programmerAlertesMeteo([DALLE], false, o, jeudi(20), meteo({ '2026-11-27': 12 }))
    expect(o.programmer).toHaveBeenCalledTimes(2)
  })

  it('module natif en échec : le passage s’arrête sans lever', async () => {
    const o = { ...outils(), programmer: vi.fn(async () => { throw new Error('module introuvable') }) }
    await expect(programmerAlertesMeteo([DALLE], false, o, jeudi(9), meteo({ '2026-11-27': 12 }))).resolves.toMatchObject({ programmees: 0 })
  })
})

describe('mémoire de l’appareil et fuseaux', () => {
  it('les journées passées sont oubliées, les suivantes gardées, sans annulation', async () => {
    localStorage.setItem('vitfix_btp_alerte_meteo_' + cleNotificationAlerte('c-dalle', '2026-11-20'), 'programmee')
    localStorage.setItem('vitfix_btp_alerte_meteo_' + cleNotificationAlerte('c-dalle', '2026-11-26'), 'affichee')
    localStorage.setItem('vitfix_btp_alerte_meteo_' + CLE_VENDREDI, 'programmee')
    localStorage.setItem('autre_cle', 'x')
    const o = outils()
    await programmerAlertesMeteo([DALLE], false, o, jeudi(9), meteo({ '2026-11-27': 12 }))
    expect(localStorage.getItem('vitfix_btp_alerte_meteo_' + cleNotificationAlerte('c-dalle', '2026-11-20'))).toBeNull()
    expect(localStorage.getItem('vitfix_btp_alerte_meteo_' + cleNotificationAlerte('c-dalle', '2026-11-26'))).toBeNull()
    expect(localStorage.getItem('vitfix_btp_alerte_meteo_' + CLE_VENDREDI)).toBe('programmee')
    expect(localStorage.getItem('autre_cle')).toBe('x')
    expect(o.annuler).not.toHaveBeenCalled()
  })

  it('téléphone en avance sur le chantier (00 h 30 à Paris, 23 h 30 à Lisbonne) : jamais d’alerte « demain » pour le jour même', async () => {
    const o = outils()
    const minuitEtDemi = new Date(2026, 10, 27, 0, 30)
    await programmerAlertesMeteo([DALLE], false, o, minuitEtDemi, meteo({ '2026-11-27': 12 }, '2026-11-26'))
    expect(o.programmer).not.toHaveBeenCalled()
    await programmerAlertesMeteo([DALLE], false, o, minuitEtDemi, meteo({ '2026-11-28': 12 }, '2026-11-26'))
    expect(o.programmer.mock.calls[0][0]).toMatchObject({ cle: cleNotificationAlerte('c-dalle', '2026-11-28'), a: new Date(2026, 10, 27, 18, 0, 0, 0) })
  })
})
