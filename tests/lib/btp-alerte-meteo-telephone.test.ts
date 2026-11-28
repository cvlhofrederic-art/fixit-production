// tests/lib/btp-alerte-meteo-telephone.test.ts — programmation de l'alerte météo de la veille sur le téléphone
// (appli Vitfix Pro, 26/11/2026) : 18 h la veille de chaque journée en alerte des trois jours suivants (le dimanche soir
// pour le lundi), tout de suite après 18 h (une seule fois), annulée quand l'alerte, la case, le statut ou l'affectation
// disparaissent, jamais sur une prévision illisible ; mémoire de l'appareil purgée ; journées cherchées par leur date.
// L'heure du téléphone est passée en paramètre ; le fuseau est fixé à Europe/Paris (le poste est à Lisbonne, la CI en
// UTC, où une date UTC prise pour la date locale passerait inaperçue).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dateDecalee } from '@/lib/btp/alerte-meteo'
import {
  annulerAlertesProgrammees, cleNotificationAlerte, generationAlertes, programmerAlertesMeteo, type ChantierPourAlerte,
} from '@/lib/btp/alerte-meteo-telephone'

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
  annuler: vi.fn(async (_cle: string) => true),
  enAttente: vi.fn(async (_cle: string) => enAttente),
  autorisation: vi.fn(async () => true),
})
/** Jeudi 26/11/2026 à l'heure dite, heure du téléphone. */
const jeudi = (heure: number, minute = 15) => new Date(2026, 10, 26, heure, minute)
const cles = (o: ReturnType<typeof outils>) => o.programmer.mock.calls.map(c => c[0].cle)

const TZ_INITIAL = process.env.TZ
beforeEach(() => {
  process.env.TZ = 'Europe/Paris'
  localStorage.clear()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  if (TZ_INITIAL === undefined) delete process.env.TZ
  else process.env.TZ = TZ_INITIAL
})
const memoire = (cle: string) => localStorage.getItem('vitfix_btp_alerte_meteo_' + cle)

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
  it('journées passées retirées (une notification restée en attente est annulée) ; celle du jour et les suivantes gardées', async () => {
    localStorage.setItem('vitfix_btp_alerte_meteo_' + cleNotificationAlerte('c-dalle', '2026-11-20'), 'programmee')
    localStorage.setItem('vitfix_btp_alerte_meteo_' + cleNotificationAlerte('c-toit', '2026-11-21'), 'affichee')
    localStorage.setItem('vitfix_btp_alerte_meteo_' + cleNotificationAlerte('c-dalle', '2026-11-26'), 'affichee')
    localStorage.setItem('vitfix_btp_alerte_meteo_' + CLE_VENDREDI, 'programmee')
    localStorage.setItem('autre_cle', 'x')
    const o = outils()
    await programmerAlertesMeteo([DALLE], false, o, jeudi(9), meteo({ '2026-11-27': 12 }))
    expect(memoire(cleNotificationAlerte('c-dalle', '2026-11-20'))).toBeNull()
    expect(memoire(cleNotificationAlerte('c-toit', '2026-11-21'))).toBeNull()
    expect(o.annuler.mock.calls).toEqual([[cleNotificationAlerte('c-dalle', '2026-11-20')]])
    expect(memoire(cleNotificationAlerte('c-dalle', '2026-11-26'))).toBe('affichee')
    expect(memoire(CLE_VENDREDI)).toBe('programmee')
    expect(localStorage.getItem('autre_cle')).toBe('x')
  })

  it('déconnexion : les notifications encore programmées sont annulées, la mémoire reste ; jamais plus d’attente que prévu', async () => {
    localStorage.setItem('vitfix_btp_alerte_meteo_' + CLE_VENDREDI, 'programmee')
    localStorage.setItem('vitfix_btp_alerte_meteo_' + cleNotificationAlerte('c-toit', '2026-11-27'), 'affichee')
    const annuler = vi.fn(async (_cle: string) => {})
    await annulerAlertesProgrammees(annuler)
    expect(annuler.mock.calls).toEqual([[CLE_VENDREDI]])
    expect(localStorage.getItem('vitfix_btp_alerte_meteo_' + CLE_VENDREDI)).toBe('programmee')

    const bloquee = vi.fn(() => new Promise<void>(() => {}))
    const debut = Date.now()
    await annulerAlertesProgrammees(bloquee, 50)
    expect(Date.now() - debut).toBeLessThan(1000)
    await expect(annulerAlertesProgrammees(vi.fn(async () => { throw new Error('module') }), 50)).resolves.toBeUndefined()
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

describe('seconde relecture : enchaînements, heure réelle, autorisation, annulations', () => {
  it('deux chantiers suivis : chacun sa notification ; décocher l’un n’annule que la sienne', async () => {
    const TOIT: ChantierPourAlerte = { ...DALLE, id: 'c-toit', titre: 'Toiture' }
    const o = outils()
    await programmerAlertesMeteo([DALLE, TOIT], false, o, jeudi(9), meteo({ '2026-11-27': 12 }))
    expect(cles(o)).toEqual([CLE_VENDREDI, cleNotificationAlerte('c-toit', '2026-11-27')])
    await programmerAlertesMeteo([DALLE, { ...TOIT, alerteMeteo: false }], false, o, jeudi(15), meteo({ '2026-11-27': 12 }))
    expect(o.annuler.mock.calls).toEqual([[cleNotificationAlerte('c-toit', '2026-11-27')]])
  })

  it('alerte disparue puis revenue le soir : remontrée (la clé a été oubliée à l’annulation)', async () => {
    const o = outils()
    await programmerAlertesMeteo([DALLE], false, o, jeudi(9), meteo({ '2026-11-27': 12 }))
    await programmerAlertesMeteo([DALLE], false, o, jeudi(15), meteo({ '2026-11-27': 1 }))
    expect(memoire(CLE_VENDREDI)).toBeNull()
    const bilan = await programmerAlertesMeteo([DALLE], false, o, jeudi(19), meteo({ '2026-11-27': 12 }))
    expect(bilan.affichees).toBe(1)
  })

  it('annulation en échec (module natif) : la trace reste, l’annulation est refaite au passage suivant', async () => {
    const o = outils()
    await programmerAlertesMeteo([DALLE], false, o, jeudi(9), meteo({ '2026-11-27': 12 }))
    o.annuler.mockResolvedValueOnce(false)
    const premier = await programmerAlertesMeteo([], false, o, jeudi(15), meteo({}))
    expect(premier.annulees).toBe(0)
    expect(memoire(CLE_VENDREDI)).toBe('programmee')
    const second = await programmerAlertesMeteo([], false, o, jeudi(16), meteo({}))
    expect(second.annulees).toBe(1)
    expect(memoire(CLE_VENDREDI)).toBeNull()
  })

  it('position GPS retirée après la programmation : la notification est annulée', async () => {
    const o = outils()
    await programmerAlertesMeteo([DALLE], false, o, jeudi(9), meteo({ '2026-11-27': 12 }))
    const bilan = await programmerAlertesMeteo([{ ...DALLE, latitude: null, longitude: null }], false, o, jeudi(15), meteo({}))
    expect(o.annuler).toHaveBeenCalledWith(CLE_VENDREDI)
    expect(bilan.annulees).toBe(1)
  })

  it('autorisation refusée : demandée une seule fois par passage, rien de programmé, les annulations ont lieu', async () => {
    const o = outils()
    await programmerAlertesMeteo([DALLE], false, o, jeudi(9), meteo({ '2026-11-27': 12 }))
    const refus = { ...outils(), autorisation: vi.fn(async () => false) }
    const TOIT: ChantierPourAlerte = { ...DALLE, id: 'c-toit' }
    await programmerAlertesMeteo([{ ...DALLE, alerteMeteo: false }, TOIT], false, refus, jeudi(10),
      meteo({ '2026-11-27': 12, '2026-11-28': 12, '2026-11-29': 12 }))
    expect(refus.autorisation).toHaveBeenCalledTimes(1)
    expect(refus.programmer).not.toHaveBeenCalled()
    expect(refus.annuler).toHaveBeenCalledWith(CLE_VENDREDI)
  })

  it('aucune alerte à programmer : l’autorisation n’est pas demandée', async () => {
    const o = outils()
    await programmerAlertesMeteo([DALLE], false, o, jeudi(9), meteo({}))
    expect(o.autorisation).not.toHaveBeenCalled()
  })

  it('passage qui franchit 18 h : décidé à l’heure réelle ; notification déjà partie, rien n’est republié', async () => {
    const o = outils(false)
    await programmerAlertesMeteo([DALLE], false, o, jeudi(9), meteo({ '2026-11-27': 12 }))
    let heure = new Date(2026, 10, 26, 17, 59, 58)
    const horloge = () => heure
    const lente = vi.fn(async () => {
      heure = new Date(2026, 10, 26, 18, 0, 2)
      return meteo({ '2026-11-27': 12 })()
    })
    await programmerAlertesMeteo([DALLE], false, o, horloge, lente)
    expect(o.programmer).toHaveBeenCalledTimes(1)
    expect(memoire(CLE_VENDREDI)).toBe('affichee')
  })

  it('prévision lue un autre jour que la veille : le texte dit de quel jour elle date', async () => {
    const o = outils()
    const vendredi = new Date(2026, 10, 27, 7, 30)
    await programmerAlertesMeteo([DALLE], false, o, vendredi, meteo({ '2026-11-28': 9, '2026-11-30': 15 }, '2026-11-27'))
    const corps = Object.fromEntries(o.programmer.mock.calls.map(c => [c[0].cle, c[0].corps]))
    expect(corps[cleNotificationAlerte('c-dalle', '2026-11-28')]).toBe('Prévu demain, samedi 28 novembre, sur le chantier « Dalle Villa » : pluie 9 mm.')
    expect(corps[cleNotificationAlerte('c-dalle', '2026-11-30')])
      .toBe('Prévu demain, lundi 30 novembre, sur le chantier « Dalle Villa » : pluie 15 mm (prévision du vendredi 27 novembre).')
  })

  it('lecture des prévisions bornée dans le temps', async () => {
    const o = outils()
    const lire = meteo({ '2026-11-27': 12 })
    await programmerAlertesMeteo([DALLE], false, o, jeudi(9), lire)
    const init = (lire.mock.calls[0] as unknown as [string, RequestInit | undefined])[1]
    expect(init?.signal).toBeInstanceOf(AbortSignal)
  })

  it('déconnexion pendant un passage : ce passage ne programme plus rien après l’annulation', async () => {
    const o = outils()
    let reprendre: () => void = () => {}
    const suspendue = vi.fn(async () => {
      await new Promise<void>(r => { reprendre = r })
      return meteo({ '2026-11-27': 12 })()
    })
    const passage = programmerAlertesMeteo([DALLE], false, o, jeudi(9), suspendue)
    await vi.waitFor(() => expect(suspendue).toHaveBeenCalled())
    await annulerAlertesProgrammees(o.annuler)
    reprendre()
    await passage
    expect(o.programmer).not.toHaveBeenCalled()
  })
})

describe('troisième relecture : passage qui ne vaut plus', () => {
  it('chantier sans GPS en tête de liste : les suivants sont quand même traités', async () => {
    const TOIT: ChantierPourAlerte = { ...DALLE, id: 'c-toit', titre: 'Toiture' }
    const o = outils()
    const bilan = await programmerAlertesMeteo([{ ...DALLE, id: 'c-sans', latitude: null, longitude: null }, DALLE, TOIT], false, o,
      jeudi(9), meteo({ '2026-11-27': 12 }))
    expect(cles(o)).toEqual([CLE_VENDREDI, cleNotificationAlerte('c-toit', '2026-11-27')])
    expect(bilan.ignorees).toBe(1)
  })

  it('passage suspendu puis repris le lendemain : il ne programme ni n’affiche rien (le suivant recalcule ses dates)', async () => {
    const o = outils()
    let heure = new Date(2026, 10, 26, 17, 5)
    const lendemain = vi.fn(async () => {
      heure = new Date(2026, 10, 27, 7, 30)
      return meteo({ '2026-11-27': 12, '2026-11-28': 9 }, '2026-11-27')()
    })
    await programmerAlertesMeteo([DALLE], false, o, () => heure, lendemain)
    expect(o.programmer).not.toHaveBeenCalled()
  })

  it('dialogue d’autorisation répondu le lendemain : rien n’est programmé', async () => {
    let heure = new Date(2026, 10, 26, 17, 5)
    const o = { ...outils(), autorisation: vi.fn(async () => { heure = new Date(2026, 10, 27, 7, 30); return true }) }
    await programmerAlertesMeteo([DALLE], false, o, () => heure, meteo({ '2026-11-27': 12 }))
    expect(o.programmer).not.toHaveBeenCalled()
  })

  it('passage déclenché avant une déconnexion et lancé après : il garde la génération de son déclenchement et ne programme rien', async () => {
    const o = outils()
    const declenchement = generationAlertes()
    await annulerAlertesProgrammees(o.annuler)
    await programmerAlertesMeteo([DALLE], false, o, jeudi(9), meteo({ '2026-11-27': 12 }), declenchement)
    expect(o.programmer).not.toHaveBeenCalled()
  })

  it('déconnexion pendant la programmation : la notification tout juste programmée est annulée, sans trace', async () => {
    const o = outils()
    o.programmer.mockImplementationOnce(async () => {
      await annulerAlertesProgrammees(o.annuler)
      return true
    })
    const bilan = await programmerAlertesMeteo([DALLE], false, o, jeudi(9), meteo({ '2026-11-27': 12 }))
    expect(o.annuler).toHaveBeenCalledWith(CLE_VENDREDI)
    expect(memoire(CLE_VENDREDI)).toBeNull()
    expect(bilan.programmees).toBe(0)
  })
})
