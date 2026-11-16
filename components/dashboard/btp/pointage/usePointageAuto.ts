'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  etatPourPointage,
  evaluerDetection,
  type ChantierPointable,
  type EtatDetection,
  type LecturePosition,
} from '@/lib/btp/pointage-geo'

// Pointage automatique, page ouverte : le navigateur suit la position (watchPosition), la détection décide de
// l'arrivée et du départ (lib/btp/pointage-geo.ts) et l'écran envoie le pointage au serveur. La position et la
// distance restent dans ce hook : seuls le chantier et l'instant sortent, par les fonctions passées en paramètre.
// Le navigateur arrête la localisation quand la page est fermée ou le téléphone en veille : rien ne tourne alors.
// Pour dater juste un départ après une veille, l'instant de la dernière présence sur le chantier est gardé sur le
// téléphone (localStorage), jamais la position.

export type StatutGps = 'arrete' | 'recherche' | 'actif' | 'refuse' | 'indisponible' | 'non_supporte'

/** Envoi d'un pointage décidé par la détection (`observeA` : entrée ou sortie de la zone) ; true si enregistré. */
export type EnvoiPointage = (chantierId: string, observeA: number) => Promise<boolean>

export interface OptionsPointageAuto {
  /** Faux tant que le compte n'est pas relié à une fiche employé ou qu'aucun chantier n'a de position : rien ne démarre. */
  autorise: boolean
  /** Chantiers affectés à l'employé, avec leur position et leur rayon. */
  chantiers: readonly ChantierPointable[]
  /** Chantier du pointage automatique en cours selon le serveur, null sinon. */
  chantierActifId: string | null
  pointerArrivee: EnvoiPointage
  pointerDepart: EnvoiPointage
}

/** La détection est réévaluée à ce rythme avec la dernière position (téléphone immobile : peu de nouvelles lectures). */
export const BATTEMENT_MS = 5_000
/** Au-delà de cet écart entre deux évaluations, le suivi a été coupé (veille, page en arrière-plan). */
export const COUPURE_MS = 3 * BATTEMENT_MS
/** Après un envoi refusé ou sans réseau, délai avant un nouvel essai. */
export const DELAI_NOUVEL_ESSAI_MS = 15_000
/** Préférence de l'employé sur ce téléphone : relancer le pointage automatique à l'ouverture de la page. */
export const CLE_PREFERENCE_AUTO = 'vitfix_btp_pointage_auto'
/** Dernière présence connue sur le chantier du pointage en cours : { chantierId, instant }. */
export const CLE_DERNIERE_PRESENCE = 'vitfix_btp_pointage_presence'

function lireStockage(cle: string): string | null {
  try {
    return localStorage.getItem(cle)
  } catch {
    // Stockage indisponible (navigation privée) : on fait sans.
    return null
  }
}

function ecrireStockage(cle: string, valeur: string | null): void {
  try {
    if (valeur === null) localStorage.removeItem(cle)
    else localStorage.setItem(cle, valeur)
  } catch {
    // Stockage indisponible : l'information ne vaut que pour cette visite.
  }
}

/** Dernière présence enregistrée sur ce téléphone pour ce chantier, ou null. */
function presenceMemorisee(chantierId: string | null): number | null {
  if (!chantierId) return null
  try {
    const lu = JSON.parse(lireStockage(CLE_DERNIERE_PRESENCE) ?? 'null') as { chantierId?: unknown; instant?: unknown } | null
    return lu?.chantierId === chantierId && typeof lu.instant === 'number' && Number.isFinite(lu.instant) ? lu.instant : null
  } catch {
    // Valeur illisible : aucune présence connue, le départ se terminera à la main.
    return null
  }
}

export function usePointageAuto({ autorise, chantiers, chantierActifId, pointerArrivee, pointerDepart }: OptionsPointageAuto) {
  const [statut, setStatut] = useState<StatutGps>('arrete')
  const [lecture, setLecture] = useState<LecturePosition | null>(null)
  const [etat, setEtat] = useState<EtatDetection>(() => etatPourPointage(chantierActifId, presenceMemorisee(chantierActifId)))
  const [envoiEnCours, setEnvoiEnCours] = useState(false)
  const [maintenant, setMaintenant] = useState(() => Date.now())

  const surveillance = useRef<number | null>(null)
  const etatRef = useRef<EtatDetection>(etat)
  const lectureRef = useRef<LecturePosition | null>(null)
  const chantiersRef = useRef(chantiers)
  const envoisRef = useRef({ pointerArrivee, pointerDepart })
  const envoiRef = useRef(false)
  const prochainEssaiRef = useRef(0)
  const derniereEvaluationRef = useRef<number | null>(null)
  const lectureDepuisRepriseRef = useRef(false)

  useEffect(() => { chantiersRef.current = chantiers }, [chantiers])
  useEffect(() => { envoisRef.current = { pointerArrivee, pointerDepart } }, [pointerArrivee, pointerDepart])

  const changerEtat = useCallback((suivant: EtatDetection) => {
    const precedente = etatRef.current.derniereDansZone
    etatRef.current = suivant
    setEtat(suivant)
    if (suivant.derniereDansZone !== precedente) {
      ecrireStockage(CLE_DERNIERE_PRESENCE, suivant.chantierActifId && suivant.derniereDansZone !== null
        ? JSON.stringify({ chantierId: suivant.chantierActifId, instant: suivant.derniereDansZone })
        : null)
    }
  }, [])

  // Le serveur fait foi : un pointage commencé ou terminé ailleurs remet la détection à zéro.
  useEffect(() => {
    if (etatRef.current.chantierActifId === chantierActifId) return
    changerEtat(etatPourPointage(chantierActifId, presenceMemorisee(chantierActifId)))
  }, [chantierActifId, changerEtat])

  const evaluer = useCallback(async (nouvelleLecture: boolean) => {
    const instant = Date.now()
    setMaintenant(instant)
    const visible = typeof document === 'undefined' || document.visibilityState !== 'hidden'
    const sansCoupure = visible && derniereEvaluationRef.current !== null && instant - derniereEvaluationRef.current <= COUPURE_MS
    if (!sansCoupure) lectureDepuisRepriseRef.current = false
    if (nouvelleLecture) lectureDepuisRepriseRef.current = true
    derniereEvaluationRef.current = instant
    const { etat: suivant, decision } = evaluerDetection(etatRef.current, lectureRef.current, chantiersRef.current, instant, {
      suiviContinu: sansCoupure && lectureDepuisRepriseRef.current,
    })
    changerEtat(suivant)
    if (decision.type === 'aucune' || envoiRef.current || instant < prochainEssaiRef.current) return
    envoiRef.current = true
    setEnvoiEnCours(true)
    try {
      const envoi = decision.type === 'arrivee' ? envoisRef.current.pointerArrivee : envoisRef.current.pointerDepart
      const enregistre = await envoi(decision.chantierId, decision.depuis)
      if (enregistre) {
        changerEtat(decision.type === 'arrivee' ? etatPourPointage(decision.chantierId, instant) : etatPourPointage(null))
        prochainEssaiRef.current = 0
      } else {
        prochainEssaiRef.current = Date.now() + DELAI_NOUVEL_ESSAI_MS
      }
    } finally {
      envoiRef.current = false
      setEnvoiEnCours(false)
    }
  }, [changerEtat])

  const couperSurveillance = useCallback(() => {
    if (surveillance.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(surveillance.current)
    }
    surveillance.current = null
    derniereEvaluationRef.current = null
  }, [])

  /** Plus de suivi : ni candidat ni sortie en attente ; la dernière présence connue est gardée. */
  const oublierSuivi = useCallback(() => {
    lectureRef.current = null
    setLecture(null)
    setStatut('arrete')
    changerEtat({ ...etatRef.current, candidat: null, horsZoneDepuis: null, sortieSansTrace: false })
  }, [changerEtat])

  const demarrer = useCallback(() => {
    if (!autorise) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatut('non_supporte')
      return
    }
    if (surveillance.current !== null) return
    setStatut('recherche')
    ecrireStockage(CLE_PREFERENCE_AUTO, '1')
    surveillance.current = navigator.geolocation.watchPosition(
      position => {
        const precision = position.coords.accuracy
        lectureRef.current = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          precisionM: Number.isFinite(precision) ? precision : null,
          horodatage: Date.now(),
        }
        setLecture(lectureRef.current)
        setStatut('actif')
        void evaluer(true)
      },
      erreurGps => {
        if (erreurGps.code === erreurGps.PERMISSION_DENIED) {
          // Refus de l'employé : on n'insiste pas, et on ne relancera pas tout seul à la prochaine ouverture.
          couperSurveillance()
          ecrireStockage(CLE_PREFERENCE_AUTO, null)
          setStatut('refuse')
          return
        }
        // Position momentanément introuvable : le navigateur continue d'essayer.
        setStatut('indisponible')
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
    )
  }, [autorise, couperSurveillance, evaluer])

  const arreter = useCallback(() => {
    couperSurveillance()
    ecrireStockage(CLE_PREFERENCE_AUTO, null)
    oublierSuivi()
  }, [couperSurveillance, oublierSuivi])

  // Pointage automatique coupé par le gérant, pointage à la main en cours, ou plus aucun chantier localisé : la
  // localisation s'arrête (la préférence de l'employé est gardée pour une reprise quand c'est de nouveau possible).
  useEffect(() => {
    if (autorise || surveillance.current === null) return
    couperSurveillance()
    oublierSuivi()
  }, [autorise, couperSurveillance, oublierSuivi])

  // Battement : réévalue avec la dernière position (confirmations d'arrivée et de départ, nouvel essai d'envoi).
  useEffect(() => {
    if (statut !== 'actif' && statut !== 'indisponible') return
    const minuteur = setInterval(() => { void evaluer(false) }, BATTEMENT_MS)
    return () => clearInterval(minuteur)
  }, [statut, evaluer])

  // Reprise à l'ouverture de la page si l'employé l'avait activé et que la localisation est déjà autorisée
  // (sans autorisation, on ne déclenche pas de demande sans geste de sa part).
  useEffect(() => {
    if (lireStockage(CLE_PREFERENCE_AUTO) !== '1' || typeof navigator === 'undefined' || !navigator.permissions?.query) return
    let annule = false
    navigator.permissions.query({ name: 'geolocation' as PermissionName })
      .then(autorisation => { if (!annule && autorisation.state === 'granted') demarrer() })
      .catch(err => console.warn('[btp/pointage] état de l’autorisation de localisation illisible :', err))
    return () => { annule = true }
  }, [demarrer])

  useEffect(() => couperSurveillance, [couperSurveillance])

  return { statut, lecture, etat, envoiEnCours, maintenant, demarrer, arreter }
}
