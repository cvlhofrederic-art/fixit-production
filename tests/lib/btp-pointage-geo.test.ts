// tests/lib/btp-pointage-geo.test.ts — détection de l'arrivée et du départ d'un chantier (pointage BTP, 16/11/2026).
// Coordonnées fictives autour d'un point de Marseille ; aucune donnée réelle.

import { describe, expect, it } from 'vitest'
import {
  AGE_MAX_LECTURE_MS,
  CONFIRMATION_ARRIVEE_MS,
  CONFIRMATION_DEPART_MS,
  ETAT_DETECTION_INITIAL,
  MARGE_SORTIE_M,
  PRECISION_MAX_M,
  RAYON_MAX_M,
  RAYON_MIN_M,
  RAYON_PAR_DEFAUT_M,
  chantierDansLaZone,
  coordonneesValides,
  distanceAuChantierM,
  etatPourPointage,
  evaluerDetection,
  lectureExploitable,
  rayonEffectifM,
  type ChantierPointable,
  type EtatDetection,
  type LecturePosition,
} from '@/lib/btp/pointage-geo'

const METRES_PAR_DEGRE_LAT = 111_195 // rayon terrestre de 6 371 km
const BASE = { lat: 43.3, lng: 5.4 }
/** Position à `metres` au nord du point de base. */
const auNord = (metres: number) => ({ lat: BASE.lat + metres / METRES_PAR_DEGRE_LAT, lng: BASE.lng })

const CHANTIER_A: ChantierPointable = { id: 'A', titre: 'Villa A', latitude: BASE.lat, longitude: BASE.lng, rayonM: 100 }
const CHANTIER_B: ChantierPointable = { id: 'B', titre: 'Immeuble B', ...(() => { const p = auNord(150); return { latitude: p.lat, longitude: p.lng } })(), rayonM: 100 }

const T0 = 1_800_000_000_000
const lire = (metres: number, instant: number, precisionM: number | null = 10): LecturePosition => ({ ...auNord(metres), precisionM, horodatage: instant })

describe('bornes et validité', () => {
  it('rayon : défaut 100 m hors nombre positif, borné à [25, 500], chaîne numérique acceptée', () => {
    expect(rayonEffectifM(undefined)).toBe(RAYON_PAR_DEFAUT_M)
    expect(rayonEffectifM(0)).toBe(RAYON_PAR_DEFAUT_M)
    expect(rayonEffectifM(-20)).toBe(RAYON_PAR_DEFAUT_M)
    expect(rayonEffectifM(Number.NaN)).toBe(RAYON_PAR_DEFAUT_M)
    expect(rayonEffectifM(10)).toBe(RAYON_MIN_M)
    expect(rayonEffectifM(5000)).toBe(RAYON_MAX_M)
    expect(rayonEffectifM('150')).toBe(150)
    expect(rayonEffectifM(149.6)).toBe(150)
  })

  it('coordonnées : nombres finis dans les bornes, jamais le point (0, 0)', () => {
    expect(coordonneesValides(43.3, 5.4)).toBe(true)
    expect(coordonneesValides(0, 0)).toBe(false)
    expect(coordonneesValides(null, 5.4)).toBe(false)
    expect(coordonneesValides(91, 5.4)).toBe(false)
    expect(coordonneesValides(43.3, -181)).toBe(false)
    expect(coordonneesValides('43.3', 5.4)).toBe(false)
  })

  it('distance au mètre près (haversine)', () => {
    expect(distanceAuChantierM(auNord(80), CHANTIER_A)).toBe(80)
    expect(distanceAuChantierM(auNord(1234), CHANTIER_A)).toBe(1234)
  })

  it('lecture exploitable : récente, précise, coordonnées valables', () => {
    expect(lectureExploitable(lire(0, T0), T0)).toBe(true)
    expect(lectureExploitable(lire(0, T0, null), T0)).toBe(true)
    expect(lectureExploitable(lire(0, T0, PRECISION_MAX_M + 1), T0)).toBe(false)
    expect(lectureExploitable(lire(0, T0), T0 + AGE_MAX_LECTURE_MS + 1)).toBe(false)
    expect(lectureExploitable({ lat: 0, lng: 0, precisionM: 5, horodatage: T0 }, T0)).toBe(false)
    expect(lectureExploitable(null, T0)).toBe(false)
  })

  it('chantier dans la zone : le plus proche des chantiers dont le rayon contient la position', () => {
    expect(chantierDansLaZone(auNord(90), [CHANTIER_A, CHANTIER_B])).toEqual({ chantier: CHANTIER_B, distanceM: 60 })
    expect(chantierDansLaZone(auNord(40), [CHANTIER_A, CHANTIER_B])).toEqual({ chantier: CHANTIER_A, distanceM: 40 })
    expect(chantierDansLaZone(auNord(400), [CHANTIER_A, CHANTIER_B])).toBeNull()
  })
})

/** Rejoue une suite de lectures (mètres au nord, instant) et renvoie les décisions non nulles. */
function rejouer(lectures: Array<[number, number] | [number, number, number | null]>, depart: EtatDetection = ETAT_DETECTION_INITIAL) {
  let etat = depart
  const decisions = []
  for (const [metres, instant, precision] of lectures) {
    const resultat = evaluerDetection(etat, lire(metres, instant, precision === undefined ? 10 : precision), [CHANTIER_A], instant)
    etat = resultat.etat
    if (resultat.decision.type !== 'aucune') decisions.push(resultat.decision)
  }
  return { etat, decisions }
}

describe('arrivée', () => {
  it('pointée après CONFIRMATION_ARRIVEE_MS dans la zone, à l’instant de l’entrée et à la distance de la dernière lecture', () => {
    const { decisions, etat } = rejouer([[300, T0], [50, T0 + 1000], [40, T0 + 1000 + CONFIRMATION_ARRIVEE_MS - 1]])
    expect(decisions).toEqual([])
    expect(etat.candidat).toEqual({ chantierId: 'A', depuis: T0 + 1000 })
    const suite = rejouer([[30, T0 + 1000 + CONFIRMATION_ARRIVEE_MS]], etat)
    expect(suite.decisions).toEqual([{ type: 'arrivee', chantierId: 'A', distanceM: 30, depuis: T0 + 1000 }])
  })

  it('passer devant le chantier sans s’arrêter ne pointe rien', () => {
    const { decisions, etat } = rejouer([[300, T0], [60, T0 + 5000], [250, T0 + 10_000], [80, T0 + 50_000]])
    expect(decisions).toEqual([])
    // Retour dans la zone : le compte repart de zéro.
    expect(etat.candidat).toEqual({ chantierId: 'A', depuis: T0 + 50_000 })
  })

  it('juste au bord : dans le rayon pointe, un mètre au-delà ne pointe pas', () => {
    expect(rejouer([[100, T0], [100, T0 + CONFIRMATION_ARRIVEE_MS]]).decisions).toHaveLength(1)
    expect(rejouer([[101, T0], [101, T0 + CONFIRMATION_ARRIVEE_MS]]).decisions).toEqual([])
  })

  it('une lecture imprécise ne compte pas et n’efface pas le candidat', () => {
    const { decisions, etat } = rejouer([[20, T0], [20, T0 + 10_000, PRECISION_MAX_M + 50]])
    expect(decisions).toEqual([])
    expect(etat.candidat).toEqual({ chantierId: 'A', depuis: T0 })
  })

  it('options : confirmation immédiate possible', () => {
    const resultat = evaluerDetection(ETAT_DETECTION_INITIAL, lire(10, T0), [CHANTIER_A], T0, { confirmationArriveeMs: 0 })
    expect(resultat.decision).toEqual({ type: 'arrivee', chantierId: 'A', distanceM: 10, depuis: T0 })
  })
})

describe('départ', () => {
  // Vu sur place une seconde avant la première lecture de chaque scénario.
  const surPlace: EtatDetection = etatPourPointage('A', T0 - 1000)

  it('pointé après CONFIRMATION_DEPART_MS au-delà du rayon + marge, à l’instant de la sortie', () => {
    const sortie = 100 + MARGE_SORTIE_M + 1
    const { decisions, etat } = rejouer([[sortie, T0], [400, T0 + CONFIRMATION_DEPART_MS - 1]], surPlace)
    expect(decisions).toEqual([])
    expect(etat.horsZoneDepuis).toBe(T0)
    const suite = rejouer([[500, T0 + CONFIRMATION_DEPART_MS]], etat)
    expect(suite.decisions).toEqual([{ type: 'depart', chantierId: 'A', distanceM: 500, depuis: T0 }])
  })

  it('les sauts du GPS en bordure (dans la marge) ne coupent pas le pointage', () => {
    const { decisions, etat } = rejouer([[120, T0], [130, T0 + 90_000], [100 + MARGE_SORTIE_M, T0 + 200_000]], surPlace)
    expect(decisions).toEqual([])
    expect(etat.horsZoneDepuis).toBeNull()
  })

  it('la marge s’élargit à la précision annoncée', () => {
    // Précision 80 m : seuil de sortie = 100 + 80 = 180 m.
    expect(rejouer([[170, T0, 80], [170, T0 + CONFIRMATION_DEPART_MS, 80]], surPlace).decisions).toEqual([])
    expect(rejouer([[181, T0, 80], [181, T0 + CONFIRMATION_DEPART_MS, 80]], surPlace).decisions).toHaveLength(1)
  })

  it('revenir dans la zone avant la confirmation annule la sortie', () => {
    const { decisions, etat } = rejouer([[300, T0], [50, T0 + 30_000], [300, T0 + 70_000]], surPlace)
    expect(decisions).toEqual([])
    expect(etat.horsZoneDepuis).toBe(T0 + 70_000)
  })

  it('un chantier actif absent de la liste (sans GPS, plus affecté) n’est jamais quitté automatiquement', () => {
    const ailleurs: EtatDetection = etatPourPointage('Z', T0)
    expect(rejouer([[5000, T0], [5000, T0 + 10 * CONFIRMATION_DEPART_MS]], ailleurs).decisions).toEqual([])
  })

  it('pendant un pointage en cours, un autre chantier proche ne déclenche pas d’arrivée', () => {
    const resultat = evaluerDetection(surPlace, lire(150, T0), [CHANTIER_A, CHANTIER_B], T0, { confirmationArriveeMs: 0 })
    expect(resultat.decision).toEqual({ type: 'aucune' })
  })
})

describe('départ après une coupure du suivi (téléphone en veille, page rouverte)', () => {
  it('trou de plus de deux minutes : le départ est daté de la dernière présence connue, sans attendre', () => {
    const vuSurPlace = etatPourPointage('A', T0)
    const reveil = T0 + 3 * 3_600_000
    const resultat = evaluerDetection(vuSurPlace, lire(5000, reveil), [CHANTIER_A], reveil)
    expect(resultat.decision).toEqual({ type: 'depart', chantierId: 'A', distanceM: 5000, depuis: T0 })
  })

  it('suivi sans trou : le départ est daté de la première lecture dehors', () => {
    const vuSurPlace = etatPourPointage('A', T0)
    const resultat = evaluerDetection(vuSurPlace, lire(600, T0 + 30_000), [CHANTIER_A], T0 + 30_000)
    expect(resultat.etat.horsZoneDepuis).toBe(T0 + 30_000)
    expect(resultat.decision).toEqual({ type: 'aucune' })
  })

  it('aucune présence connue sur place (pointage repris sur ce téléphone) : pas de départ automatique, signalé', () => {
    const sansTrace = etatPourPointage('A')
    const { decisions, etat } = rejouer([[600, T0], [600, T0 + 10 * CONFIRMATION_DEPART_MS]], sansTrace)
    expect(decisions).toEqual([])
    expect(etat.sortieSansTrace).toBe(true)
    // De retour sur place, la présence redevient connue et le signal tombe.
    const retour = evaluerDetection(etat, lire(20, T0 + 11 * CONFIRMATION_DEPART_MS), [CHANTIER_A], T0 + 11 * CONFIRMATION_DEPART_MS)
    expect(retour.etat).toMatchObject({ sortieSansTrace: false, derniereDansZone: T0 + 11 * CONFIRMATION_DEPART_MS })
  })

  it('suivi continu sans nouvelle position : la présence se prolonge jusqu’à maintenant (téléphone immobile sur place)', () => {
    const vuSurPlace = etatPourPointage('A', T0)
    const dixMinutesPlusTard = T0 + 10 * 60_000
    const continu = evaluerDetection(vuSurPlace, lire(20, T0), [CHANTIER_A], dixMinutesPlusTard, { suiviContinu: true })
    expect(continu.etat.derniereDansZone).toBe(dixMinutesPlusTard)
    // Sans continuité (veille), la vieille position ne prouve plus rien : rien ne change.
    const coupe = evaluerDetection(vuSurPlace, lire(20, T0), [CHANTIER_A], dixMinutesPlusTard)
    expect(coupe.etat).toBe(vuSurPlace)
  })

  it('une arrivée exige une position récente, même en suivi continu', () => {
    const resultat = evaluerDetection(ETAT_DETECTION_INITIAL, lire(10, T0), [CHANTIER_A], T0 + AGE_MAX_LECTURE_MS + 1, {
      confirmationArriveeMs: 0, suiviContinu: true,
    })
    expect(resultat.decision).toEqual({ type: 'aucune' })
  })

  it('etatPourPointage : sans chantier actif, aucune présence gardée', () => {
    expect(etatPourPointage(null, T0)).toEqual(ETAT_DETECTION_INITIAL)
    expect(etatPourPointage('A', T0)).toEqual({ ...ETAT_DETECTION_INITIAL, chantierActifId: 'A', derniereDansZone: T0 })
  })
})

describe('dernière présence connue', () => {
  it('ne recule jamais : une vieille position relue après une coupure ne raccourcit pas la présence', () => {
    const vuJusqua = etatPourPointage('A', T0 + 30_000)
    const resultat = evaluerDetection(vuJusqua, lire(20, T0), [CHANTIER_A], T0 + 60_000)
    expect(resultat.etat.derniereDansZone).toBe(T0 + 30_000)
  })
})
