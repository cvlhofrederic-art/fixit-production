// tests/components/btp-position-sur-place.test.ts — mesure de la position du téléphone pour « Placer à ma position
// actuelle » (components/dashboard/btp/pointage/positionSurPlace.ts, 16/11/2026). Géolocalisation simulée.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DUREE_MAX_ATTENTE_MS, DUREE_MESURE_MS, ECART_ALERTE_M, PRECISION_MAX_PLACEMENT_M, PRECISION_VISEE_M,
  arrondiCoordonnee, ecartAvecPositionEnregistreeM, mesurerPositionSurPlace, type ResultatMesure,
} from '@/components/dashboard/btp/pointage/positionSurPlace'
import {
  confirmationPlacement, libelleBoutonPlacer, messageChantierPlace, messagePlacementImpossible,
} from '@/components/dashboard/btp/pointage/textes'

/** Fausse API de géolocalisation : `lire` envoie une lecture, `echouer` une erreur, à la surveillance en cours. */
function fausseGeolocalisation() {
  let succes: PositionCallback | null = null
  let echec: PositionErrorCallback | null = null
  const brut = {
    watchPosition: vi.fn((s: PositionCallback, e?: PositionErrorCallback | null) => { succes = s; echec = e ?? null; return 42 }),
    clearWatch: vi.fn(),
    getCurrentPosition: vi.fn(),
  }
  const lire = (latitude: number, longitude: number, accuracy: number) =>
    succes?.({ coords: { latitude, longitude, accuracy }, timestamp: Date.now() } as unknown as GeolocationPosition)
  const echouer = (code: number) => echec?.({ code, message: '' } as GeolocationPositionError)
  return { geo: brut as unknown as Geolocation, brut, lire, echouer }
}

/** Le résultat, s'il est déjà connu (sans faire avancer le temps). */
async function resultatSiConnu(promesse: Promise<ResultatMesure>): Promise<ResultatMesure | 'en attente'> {
  return Promise.race([promesse, Promise.resolve('en attente' as const)])
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('mesurerPositionSurPlace', () => {
  it('sans API de géolocalisation : indisponible', async () => {
    await expect(mesurerPositionSurPlace(undefined)).resolves.toEqual({ ok: false, raison: 'indisponible' })
  })

  it('lecture assez précise : conclut tout de suite, en haute précision et sans position en cache, puis arrête la surveillance', async () => {
    const f = fausseGeolocalisation()
    const promesse = mesurerPositionSurPlace(f.geo)
    const options = (f.brut.watchPosition.mock.calls[0] as unknown[])[2]
    expect(options).toMatchObject({ enableHighAccuracy: true, maximumAge: 0 })
    f.lire(43.25, 5.38, PRECISION_VISEE_M)
    expect(await resultatSiConnu(promesse)).toEqual({ ok: true, mesure: { latitude: 43.25, longitude: 5.38, precisionM: PRECISION_VISEE_M } })
    expect(f.brut.clearWatch).toHaveBeenCalledWith(42)
  })

  it('garde la lecture la plus précise ; la fenêtre ne repart pas à chaque lecture et conclut à son terme', async () => {
    const f = fausseGeolocalisation()
    const promesse = mesurerPositionSurPlace(f.geo)
    f.lire(43.3, 5.4, 22)
    await vi.advanceTimersByTimeAsync(10_000)
    f.lire(43.25, 5.38, 14)
    f.lire(43.2, 5.3, 60)
    await vi.advanceTimersByTimeAsync(DUREE_MESURE_MS - 10_000 - 1)
    expect(await resultatSiConnu(promesse)).toBe('en attente')
    await vi.advanceTimersByTimeAsync(1)
    expect(await resultatSiConnu(promesse)).toEqual({ ok: true, mesure: { latitude: 43.25, longitude: 5.38, precisionM: 14 } })
    expect(f.brut.clearWatch).toHaveBeenCalledWith(42)
  })

  it('meilleure lecture moins précise que le seuil : refus avec la précision obtenue ; le seuil lui-même passe', async () => {
    const f = fausseGeolocalisation()
    const refus = mesurerPositionSurPlace(f.geo)
    f.lire(43.25, 5.38, PRECISION_MAX_PLACEMENT_M + 1)
    await vi.advanceTimersByTimeAsync(DUREE_MESURE_MS)
    expect(await refus).toEqual({ ok: false, raison: 'imprecise', precisionM: PRECISION_MAX_PLACEMENT_M + 1 })

    const g = fausseGeolocalisation()
    const accord = mesurerPositionSurPlace(g.geo)
    g.lire(43.25, 5.38, PRECISION_MAX_PLACEMENT_M)
    await vi.advanceTimersByTimeAsync(DUREE_MESURE_MS)
    expect(await accord).toMatchObject({ ok: true })
  })

  it('autorisation refusée : refus immédiat et surveillance arrêtée', async () => {
    const f = fausseGeolocalisation()
    const promesse = mesurerPositionSurPlace(f.geo)
    f.echouer(1)
    expect(await resultatSiConnu(promesse)).toEqual({ ok: false, raison: 'refusee' })
    expect(f.brut.clearWatch).toHaveBeenCalledWith(42)
  })

  it('position indisponible ou délai d’une lecture : la mesure continue ; sans aucune lecture, introuvable après l’attente maximale', async () => {
    const f = fausseGeolocalisation()
    const promesse = mesurerPositionSurPlace(f.geo)
    f.echouer(2)
    f.echouer(3)
    await vi.advanceTimersByTimeAsync(DUREE_MAX_ATTENTE_MS - 1)
    expect(await resultatSiConnu(promesse)).toBe('en attente')
    await vi.advanceTimersByTimeAsync(1)
    expect(await promesse).toEqual({ ok: false, raison: 'introuvable' })
    expect(f.brut.clearWatch).toHaveBeenCalledWith(42)
  })

  it('la fenêtre de mesure part de la première lecture : le temps de la demande d’autorisation ne compte pas', async () => {
    const f = fausseGeolocalisation()
    const promesse = mesurerPositionSurPlace(f.geo)
    await vi.advanceTimersByTimeAsync(20_000)
    f.lire(43.25, 5.38, 18)
    await vi.advanceTimersByTimeAsync(DUREE_MESURE_MS - 1)
    expect(await resultatSiConnu(promesse)).toBe('en attente')
    await vi.advanceTimersByTimeAsync(1)
    expect(await promesse).toEqual({ ok: true, mesure: { latitude: 43.25, longitude: 5.38, precisionM: 18 } })
  })

  it('lectures inutilisables ignorées : point (0, 0), coordonnées hors bornes, précision absente ou négative', async () => {
    const f = fausseGeolocalisation()
    const promesse = mesurerPositionSurPlace(f.geo)
    f.lire(0, 0, 3)
    f.lire(95, 5.38, 3)
    f.lire(43.25, 5.38, Number.NaN)
    f.lire(43.25, 5.38, -1)
    await vi.advanceTimersByTimeAsync(DUREE_MAX_ATTENTE_MS)
    expect(await promesse).toEqual({ ok: false, raison: 'introuvable' })
  })

  it('lecture livrée pendant l’appel à watchPosition : la surveillance est quand même arrêtée', async () => {
    const brut = {
      watchPosition: vi.fn((s: PositionCallback) => {
        s({ coords: { latitude: 43.25, longitude: 5.38, accuracy: 5 }, timestamp: 0 } as unknown as GeolocationPosition)
        return 9
      }),
      clearWatch: vi.fn(),
      getCurrentPosition: vi.fn(),
    }
    expect(await mesurerPositionSurPlace(brut as unknown as Geolocation)).toMatchObject({ ok: true })
    expect(brut.clearWatch).toHaveBeenCalledWith(9)
  })
})

describe('écart et arrondi', () => {
  it('écart avec la position enregistrée, au mètre ; null sans position valable', () => {
    const mesure = { latitude: 43.25, longitude: 5.38, precisionM: 8 }
    expect(ecartAvecPositionEnregistreeM(mesure, 43.25, 5.38)).toBe(0)
    const ecart = ecartAvecPositionEnregistreeM(mesure, 43.251, 5.38)
    expect(ecart).toBeGreaterThanOrEqual(110)
    expect(ecart).toBeLessThanOrEqual(112)
    expect(ecartAvecPositionEnregistreeM(mesure, null, null)).toBeNull()
    expect(ecartAvecPositionEnregistreeM(mesure, 0, 0)).toBeNull()
  })

  it('coordonnée enregistrée au millionième de degré', () => {
    expect(arrondiCoordonnee(43.2512345678)).toBe(43.251235)
    expect(arrondiCoordonnee(-8.6123454)).toBe(-8.612345)
  })
})

describe('textes', () => {
  it('alerte de la confirmation à partir de ECART_ALERTE_M d’écart', () => {
    expect(confirmationPlacement('Villa', 5, ECART_ALERTE_M - 1, false)).not.toContain('Attention')
    expect(confirmationPlacement('Villa', 5, ECART_ALERTE_M, false)).toContain('Attention : vous êtes à 1 km')
  })

  it('en portugais : bouton, confirmation, refus et succès', () => {
    expect(libelleBoutonPlacer(false, true)).toBe('Colocar na minha posição atual')
    expect(libelleBoutonPlacer(true, true)).toBe('A medir a posição…')
    const alerte = confirmationPlacement('Moradia', 7.6, 1240, true)
    expect(alerte).toContain('Colocar a obra « Moradia » na sua posição atual (precisão ± 8 m)?')
    expect(alerte).toContain('Atenção: está a 1,2 km da posição registada da obra. Está mesmo nesta obra?')
    expect(confirmationPlacement('Moradia', 7.6, 300, true)).toContain('Fica a 300 m da posição registada até agora.')
    expect(messagePlacementImpossible('imprecise', 31, true)).toContain('(± 31 m; no máximo ± 25 m)')
    expect(messagePlacementImpossible('refusee', undefined, true)).toContain('Localização recusada')
    expect(messageChantierPlace(7.6, true)).toBe('Posição da obra colocada aqui (± 8 m)')
  })
})
