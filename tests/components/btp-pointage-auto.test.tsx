// tests/components/btp-pointage-auto.test.tsx — pointage automatique côté téléphone (usePointageAuto, 16/11/2026) :
// fausse géolocalisation du navigateur, horloge simulée. Coordonnées fictives.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  BATTEMENT_MS,
  CLE_CHANTIER_BLOQUE,
  CLE_DERNIERE_PRESENCE,
  CLE_PREFERENCE_AUTO,
  DELAI_NOUVEL_ESSAI_MS,
  usePointageAuto,
  type OptionsPointageAuto,
} from '@/components/dashboard/btp/pointage/usePointageAuto'
import { CONFIRMATION_ARRIVEE_MS, CONFIRMATION_DEPART_MS, type ChantierPointable } from '@/lib/btp/pointage-geo'

const METRES_PAR_DEGRE = 111_195
const VILLA: ChantierPointable = { id: 'villa', titre: 'Villa', latitude: 43.3, longitude: 5.4, rayonM: 100 }
const aMetres = (metres: number) => ({ latitude: VILLA.latitude + metres / METRES_PAR_DEGRE, longitude: VILLA.longitude })

class FausseGeolocalisation {
  succes: PositionCallback | null = null
  erreur: PositionErrorCallback | null = null
  options: PositionOptions | undefined
  watchPosition = vi.fn((succes: PositionCallback, erreur?: PositionErrorCallback | null, options?: PositionOptions) => {
    this.succes = succes
    this.erreur = erreur ?? null
    this.options = options
    return 7
  })
  clearWatch = vi.fn()
  getCurrentPosition = vi.fn()
  lire(metres: number, precision = 10) {
    const { latitude, longitude } = aMetres(metres)
    this.succes?.({ coords: { latitude, longitude, accuracy: precision }, timestamp: Date.now() } as unknown as GeolocationPosition)
  }
  refuser() {
    this.erreur?.({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: 'refus' } as GeolocationPositionError)
  }
}

let geo: FausseGeolocalisation
let autorisation: PermissionState

function options(surcharge: Partial<OptionsPointageAuto> = {}): OptionsPointageAuto {
  return {
    autorise: true,
    chantiers: [VILLA],
    chantierActifId: null,
    pointerArrivee: vi.fn(async () => true),
    pointerDepart: vi.fn(async () => true),
    ...surcharge,
  }
}

const avancer = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }
const lire = async (metres: number, precision?: number) => { await act(async () => { geo.lire(metres, precision) }) }

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(Date.UTC(2026, 10, 16, 7, 0, 0))
  geo = new FausseGeolocalisation()
  autorisation = 'granted'
  Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true })
  Object.defineProperty(navigator, 'permissions', { value: { query: vi.fn(async () => ({ state: autorisation })) }, configurable: true })
  localStorage.clear()
})
afterEach(() => { vi.useRealTimers() })

describe('usePointageAuto', () => {
  it('démarre la surveillance (haute précision) et passe actif à la première position', async () => {
    const { result } = renderHook(() => usePointageAuto(options()))
    act(() => result.current.demarrer())
    expect(geo.watchPosition).toHaveBeenCalledTimes(1)
    expect(geo.options).toMatchObject({ enableHighAccuracy: true })
    expect(result.current.statut).toBe('recherche')
    await lire(500)
    expect(result.current.statut).toBe('actif')
    expect(localStorage.getItem(CLE_PREFERENCE_AUTO)).toBe('1')
  })

  it('arrivée : envoyée une fois après la confirmation, avec le seul chantier et l’instant d’entrée (ni position ni distance)', async () => {
    const opts = options()
    const { result } = renderHook(() => usePointageAuto(opts))
    act(() => result.current.demarrer())
    await lire(400)
    const entree = Date.now() + 1000
    await avancer(1000)
    await lire(30)
    expect(result.current.etat.candidat).toEqual({ chantierId: 'villa', depuis: entree })
    // Battements toutes les 5 s depuis la première position : celui de +30 s n'a que 29 s de présence, celui de +35 s pointe.
    await avancer(CONFIRMATION_ARRIVEE_MS - BATTEMENT_MS)
    expect(opts.pointerArrivee).not.toHaveBeenCalled()
    await avancer(2 * BATTEMENT_MS)
    expect(opts.pointerArrivee).toHaveBeenCalledTimes(1)
    expect(opts.pointerArrivee).toHaveBeenCalledWith('villa', entree)
    expect(result.current.etat.chantierActifId).toBe('villa')
    await avancer(10 * BATTEMENT_MS)
    expect(opts.pointerArrivee).toHaveBeenCalledTimes(1)
  })

  it('envoi refusé ou sans réseau : nouvel essai après DELAI_NOUVEL_ESSAI_MS, pas à chaque battement', async () => {
    const pointerArrivee = vi.fn(async () => false)
    const { result } = renderHook(() => usePointageAuto(options({ pointerArrivee })))
    act(() => result.current.demarrer())
    await lire(20)
    await avancer(CONFIRMATION_ARRIVEE_MS)
    expect(pointerArrivee).toHaveBeenCalledTimes(1)
    await avancer(DELAI_NOUVEL_ESSAI_MS - BATTEMENT_MS)
    expect(pointerArrivee).toHaveBeenCalledTimes(1)
    await lire(20) // la position se rafraîchit (sinon la lecture vieillit au-delà de deux minutes)
    await avancer(BATTEMENT_MS)
    expect(pointerArrivee).toHaveBeenCalledTimes(2)
    expect(result.current.etat.chantierActifId).toBeNull()
  })

  it('départ : envoyé une fois après CONFIRMATION_DEPART_MS hors de la zone élargie', async () => {
    const opts = options({ chantierActifId: 'villa' })
    const { result } = renderHook(() => usePointageAuto(opts))
    act(() => result.current.demarrer())
    await lire(110) // dans la marge de sortie : rien
    await avancer(CONFIRMATION_DEPART_MS + BATTEMENT_MS)
    await lire(120)
    expect(opts.pointerDepart).not.toHaveBeenCalled()
    const sortie = Date.now()
    await lire(600)
    await avancer(CONFIRMATION_DEPART_MS)
    expect(opts.pointerDepart).toHaveBeenCalledTimes(1)
    expect(opts.pointerDepart).toHaveBeenCalledWith('villa', sortie)
    expect(result.current.etat.chantierActifId).toBeNull()
  })

  it('un pointage commencé ou terminé à la main (serveur) remet la détection à zéro', async () => {
    const { result, rerender } = renderHook((p: OptionsPointageAuto) => usePointageAuto(p), { initialProps: options() })
    act(() => result.current.demarrer())
    await lire(20)
    expect(result.current.etat.candidat).not.toBeNull()
    rerender(options({ chantierActifId: 'villa' }))
    expect(result.current.etat).toEqual({
      chantierActifId: 'villa', candidat: null, horsZoneDepuis: null, vuHorsZone: null, derniereDansZone: null, sortieSansTrace: false, chantierBloque: null,
    })
  })

  it('refus de la localisation : surveillance coupée, préférence oubliée', async () => {
    const { result } = renderHook(() => usePointageAuto(options()))
    act(() => result.current.demarrer())
    await act(async () => { geo.refuser() })
    expect(result.current.statut).toBe('refuse')
    expect(geo.clearWatch).toHaveBeenCalledWith(7)
    expect(localStorage.getItem(CLE_PREFERENCE_AUTO)).toBeNull()
  })

  it('non autorisé (gérant n’a pas activé, aucun chantier localisé) : ne démarre pas ; retrait en cours de route : arrêt', async () => {
    const { result, rerender } = renderHook((p: OptionsPointageAuto) => usePointageAuto(p), { initialProps: options({ autorise: false }) })
    act(() => result.current.demarrer())
    expect(geo.watchPosition).not.toHaveBeenCalled()
    rerender(options())
    act(() => result.current.demarrer())
    await lire(20)
    rerender(options({ autorise: false }))
    expect(geo.clearWatch).toHaveBeenCalledWith(7)
    expect(result.current.statut).toBe('arrete')
    expect(localStorage.getItem(CLE_PREFERENCE_AUTO)).toBe('1')
  })

  it('reprise à l’ouverture si l’employé l’avait activé et que la localisation est déjà autorisée', async () => {
    localStorage.setItem(CLE_PREFERENCE_AUTO, '1')
    renderHook(() => usePointageAuto(options()))
    await avancer(1)
    expect(geo.watchPosition).toHaveBeenCalledTimes(1)
  })

  it('pas de reprise sans autorisation déjà donnée (aucune demande sans geste de l’employé)', async () => {
    localStorage.setItem(CLE_PREFERENCE_AUTO, '1')
    autorisation = 'prompt'
    renderHook(() => usePointageAuto(options()))
    await avancer(1)
    expect(geo.watchPosition).not.toHaveBeenCalled()
  })

  it('arrêt par l’employé et fermeture de la page : surveillance coupée', async () => {
    const { result, unmount } = renderHook(() => usePointageAuto(options()))
    act(() => result.current.demarrer())
    act(() => result.current.arreter())
    expect(geo.clearWatch).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(CLE_PREFERENCE_AUTO)).toBeNull()
    act(() => result.current.demarrer())
    unmount()
    expect(geo.clearWatch).toHaveBeenCalledTimes(2)
  })
  it('envoi lent : les battements suivants ne renvoient pas la même arrivée', async () => {
    let finir: (ok: boolean) => void = () => {}
    const pointerArrivee = vi.fn(() => new Promise<boolean>(resolve => { finir = resolve }))
    const { result } = renderHook(() => usePointageAuto(options({ pointerArrivee })))
    act(() => result.current.demarrer())
    await lire(20)
    await avancer(CONFIRMATION_ARRIVEE_MS)
    expect(pointerArrivee).toHaveBeenCalledTimes(1)
    await avancer(6 * BATTEMENT_MS)
    expect(pointerArrivee).toHaveBeenCalledTimes(1)
    await act(async () => { finir(true) })
    expect(result.current.etat.chantierActifId).toBe('villa')
  })

  it('page en arrière-plan 3 h puis téléphone loin du chantier : heure de sortie inconnue, pas de départ automatique', async () => {
    const opts = options({ chantierActifId: 'villa' })
    const { result } = renderHook(() => usePointageAuto(opts))
    act(() => result.current.demarrer())
    await lire(20)
    await avancer(30_000) // suivi continu : la présence se prolonge
    const derniereVue = result.current.etat.derniereDansZone
    expect(derniereVue).toBe(Date.now())
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    try {
      await avancer(3 * 3_600_000)
    } finally {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    }
    expect(result.current.etat.derniereDansZone).toBe(derniereVue)
    await lire(5000)
    await avancer(5 * CONFIRMATION_DEPART_MS)
    expect(opts.pointerDepart).not.toHaveBeenCalled()
    expect(result.current.etat).toMatchObject({ sortieSansTrace: true, derniereDansZone: derniereVue })
  })

  it('veille avec minuteurs gelés, page restée « visible » : le premier battement au réveil ne prolonge pas la présence', async () => {
    const opts = options({ chantierActifId: 'villa' })
    const { result } = renderHook(() => usePointageAuto(opts))
    act(() => result.current.demarrer())
    await lire(20)
    await avancer(30_000)
    const avantVeille = result.current.etat.derniereDansZone
    // Téléphone en veille : rien ne tourne, l'horloge avance de 3 h, puis les minuteurs repartent. Deux battements
    // avec la vieille position : ni le premier (coupure) ni le second (aucune position reçue depuis) ne la prolongent.
    vi.setSystemTime(Date.now() + 3 * 3_600_000)
    await avancer(2 * BATTEMENT_MS)
    expect(result.current.etat.derniereDansZone).toBe(avantVeille)
    await lire(5000)
    await avancer(5 * CONFIRMATION_DEPART_MS)
    expect(opts.pointerDepart).not.toHaveBeenCalled()
    expect(result.current.etat.sortieSansTrace).toBe(true)
  })

  it('« Terminer » sur place, mode automatique actif : pas de nouvelle arrivée avant d’être sorti de la zone (pause sur place)', async () => {
    const pointerArrivee = vi.fn(async () => true)
    const base = options({ chantierActifId: 'villa', pointerArrivee })
    const { result, rerender } = renderHook((p: OptionsPointageAuto) => usePointageAuto(p), { initialProps: base })
    act(() => result.current.demarrer())
    await lire(20)
    // L'employé touche « Terminer le pointage » : le serveur n'a plus de pointage en cours.
    rerender({ ...base, chantierActifId: null })
    expect(result.current.etat.chantierBloque).toBe('villa')
    await avancer(40_000)
    await lire(20)
    await avancer(5 * CONFIRMATION_ARRIVEE_MS)
    expect(pointerArrivee).not.toHaveBeenCalled()
    // Sorti de la zone puis revenu : l'arrivée est de nouveau pointée.
    await lire(500)
    expect(result.current.etat.chantierBloque).toBeNull()
    await lire(20)
    await avancer(CONFIRMATION_ARRIVEE_MS + BATTEMENT_MS)
    expect(pointerArrivee).toHaveBeenCalledTimes(1)
  })

  it('fin d’un pointage commencé à la main : son chantier est bloqué de même, et gardé sur le téléphone pour la journée', async () => {
    const pointerArrivee = vi.fn(async () => true)
    const base = options({ chantierActifId: null, chantierEnCoursId: 'villa', pointerArrivee })
    const { result, rerender } = renderHook((p: OptionsPointageAuto) => usePointageAuto(p), { initialProps: base })
    expect(result.current.etat.chantierBloque).toBeNull()
    rerender({ ...base, chantierEnCoursId: null })
    expect(result.current.etat.chantierBloque).toBe('villa')
    expect(JSON.parse(localStorage.getItem(CLE_CHANTIER_BLOQUE) ?? 'null')).toEqual({ chantierId: 'villa', jour: '2026-11-16' })
    act(() => result.current.demarrer())
    await lire(20)
    await avancer(3 * CONFIRMATION_ARRIVEE_MS)
    expect(pointerArrivee).not.toHaveBeenCalled()
  })

  it('blocage gardé sur le téléphone : page rouverte le même jour, toujours bloqué ; le lendemain, oublié', () => {
    localStorage.setItem(CLE_CHANTIER_BLOQUE, JSON.stringify({ chantierId: 'villa', jour: '2026-11-16' }))
    expect(renderHook(() => usePointageAuto(options())).result.current.etat.chantierBloque).toBe('villa')
    localStorage.setItem(CLE_CHANTIER_BLOQUE, JSON.stringify({ chantierId: 'villa', jour: '2026-11-15' }))
    expect(renderHook(() => usePointageAuto(options())).result.current.etat.chantierBloque).toBeNull()
  })

  it('dernière présence gardée sur le téléphone : la page rouverte sait dater le départ', async () => {
    const opts = options({ pointerArrivee: vi.fn(async () => true) })
    const premier = renderHook(() => usePointageAuto(opts))
    act(() => premier.result.current.demarrer())
    await lire(20)
    await avancer(CONFIRMATION_ARRIVEE_MS + BATTEMENT_MS)
    expect(premier.result.current.etat.chantierActifId).toBe('villa')
    const memorisee = JSON.parse(localStorage.getItem(CLE_DERNIERE_PRESENCE) ?? 'null') as { chantierId: string; instant: number }
    expect(memorisee).toEqual({ chantierId: 'villa', instant: expect.any(Number) })
    premier.unmount()

    const second = renderHook(() => usePointageAuto(options({ chantierActifId: 'villa' })))
    expect(second.result.current.etat.derniereDansZone).toBe(memorisee.instant)
  })

  it('aucune présence connue sur ce téléphone : pas de départ automatique, l’écran le signale', async () => {
    const opts = options({ chantierActifId: 'villa' })
    const { result } = renderHook(() => usePointageAuto(opts))
    act(() => result.current.demarrer())
    await lire(800)
    await avancer(5 * CONFIRMATION_DEPART_MS)
    expect(opts.pointerDepart).not.toHaveBeenCalled()
    expect(result.current.etat.sortieSansTrace).toBe(true)
  })
})
