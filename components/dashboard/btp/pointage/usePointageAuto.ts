'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ETAT_DETECTION_INITIAL,
  evaluerDetection,
  type ChantierPointable,
  type EtatDetection,
  type LecturePosition,
} from '@/lib/btp/pointage-geo'

// Pointage automatique, page ouverte : le navigateur suit la position (watchPosition), la détection décide de
// l'arrivée et du départ (lib/btp/pointage-geo.ts) et l'écran envoie le pointage au serveur. La position et la
// distance restent dans ce hook : seuls le chantier et l'instant sortent, par les fonctions passées en paramètre.
// Le navigateur arrête la localisation quand la page est fermée ou le téléphone en veille : rien ne tourne alors.

export type StatutGps = 'arrete' | 'recherche' | 'actif' | 'refuse' | 'indisponible' | 'non_supporte'

/** Envoi d'un pointage décidé par la détection (`observeA` : entrée ou sortie de la zone) ; true si enregistré. */
export type EnvoiPointage = (chantierId: string, observeA: number) => Promise<boolean>

export interface OptionsPointageAuto {
  /** Faux tant que le compte n'est pas relié à une fiche employé ou qu'aucun chantier n'a de position : rien ne démarre. */
  autorise: boolean
  /** Chantiers affectés à l'employé, avec leur position et leur rayon. */
  chantiers: readonly ChantierPointable[]
  /** Chantier du pointage en cours selon le serveur (pointage automatique ou à la main), null sinon. */
  chantierActifId: string | null
  pointerArrivee: EnvoiPointage
  pointerDepart: EnvoiPointage
}

/** La détection est réévaluée à ce rythme avec la dernière position (téléphone immobile : peu de nouvelles lectures). */
export const BATTEMENT_MS = 5_000
/** Après un envoi refusé ou sans réseau, délai avant un nouvel essai. */
export const DELAI_NOUVEL_ESSAI_MS = 15_000
/** Préférence de l'employé sur ce téléphone : relancer le pointage automatique à l'ouverture de la page. */
export const CLE_PREFERENCE_AUTO = 'vitfix_btp_pointage_auto'

function lirePreference(): boolean {
  try {
    return localStorage.getItem(CLE_PREFERENCE_AUTO) === '1'
  } catch {
    // Stockage indisponible (navigation privée) : le pointage automatique se relance à la main.
    return false
  }
}

function ecrirePreference(active: boolean): void {
  try {
    if (active) localStorage.setItem(CLE_PREFERENCE_AUTO, '1')
    else localStorage.removeItem(CLE_PREFERENCE_AUTO)
  } catch {
    // Stockage indisponible : la préférence ne vaut que pour cette visite.
  }
}

export function usePointageAuto({ autorise, chantiers, chantierActifId, pointerArrivee, pointerDepart }: OptionsPointageAuto) {
  const [statut, setStatut] = useState<StatutGps>('arrete')
  const [lecture, setLecture] = useState<LecturePosition | null>(null)
  const [etat, setEtat] = useState<EtatDetection>({ ...ETAT_DETECTION_INITIAL, chantierActifId })
  const [envoiEnCours, setEnvoiEnCours] = useState(false)
  const [maintenant, setMaintenant] = useState(() => Date.now())

  const surveillance = useRef<number | null>(null)
  const etatRef = useRef<EtatDetection>(etat)
  const lectureRef = useRef<LecturePosition | null>(null)
  const chantiersRef = useRef(chantiers)
  const envoisRef = useRef({ pointerArrivee, pointerDepart })
  const envoiRef = useRef(false)
  const prochainEssaiRef = useRef(0)

  useEffect(() => { chantiersRef.current = chantiers }, [chantiers])
  useEffect(() => { envoisRef.current = { pointerArrivee, pointerDepart } }, [pointerArrivee, pointerDepart])

  const changerEtat = useCallback((suivant: EtatDetection) => {
    etatRef.current = suivant
    setEtat(suivant)
  }, [])

  // Le serveur fait foi : un pointage commencé ou terminé à la main remet la détection à zéro.
  useEffect(() => {
    if (etatRef.current.chantierActifId === chantierActifId) return
    changerEtat({ chantierActifId, candidat: null, horsZoneDepuis: null })
  }, [chantierActifId, changerEtat])

  const evaluer = useCallback(async () => {
    const instant = Date.now()
    setMaintenant(instant)
    const { etat: suivant, decision } = evaluerDetection(etatRef.current, lectureRef.current, chantiersRef.current, instant)
    changerEtat(suivant)
    if (decision.type === 'aucune' || envoiRef.current || instant < prochainEssaiRef.current) return
    envoiRef.current = true
    setEnvoiEnCours(true)
    try {
      const envoi = decision.type === 'arrivee' ? envoisRef.current.pointerArrivee : envoisRef.current.pointerDepart
      const enregistre = await envoi(decision.chantierId, decision.depuis)
      if (enregistre) {
        changerEtat({ chantierActifId: decision.type === 'arrivee' ? decision.chantierId : null, candidat: null, horsZoneDepuis: null })
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
  }, [])

  const demarrer = useCallback(() => {
    if (!autorise) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatut('non_supporte')
      return
    }
    if (surveillance.current !== null) return
    setStatut('recherche')
    ecrirePreference(true)
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
        void evaluer()
      },
      erreurGps => {
        if (erreurGps.code === erreurGps.PERMISSION_DENIED) {
          // Refus de l'employé : on n'insiste pas, et on ne relancera pas tout seul à la prochaine ouverture.
          couperSurveillance()
          ecrirePreference(false)
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
    ecrirePreference(false)
    lectureRef.current = null
    setLecture(null)
    setStatut('arrete')
    changerEtat({ chantierActifId: etatRef.current.chantierActifId, candidat: null, horsZoneDepuis: null })
  }, [changerEtat, couperSurveillance])

  // Pointage automatique coupé par le gérant, ou plus aucun chantier localisé : la localisation s'arrête (la
  // préférence de l'employé est gardée pour une reprise quand le pointage automatique revient).
  useEffect(() => {
    if (autorise || surveillance.current === null) return
    couperSurveillance()
    lectureRef.current = null
    setLecture(null)
    setStatut('arrete')
    changerEtat({ chantierActifId: etatRef.current.chantierActifId, candidat: null, horsZoneDepuis: null })
  }, [autorise, changerEtat, couperSurveillance])

  // Battement : réévalue avec la dernière position (confirmations d'arrivée et de départ, nouvel essai d'envoi).
  useEffect(() => {
    if (statut !== 'actif' && statut !== 'indisponible') return
    const minuteur = setInterval(() => { void evaluer() }, BATTEMENT_MS)
    return () => clearInterval(minuteur)
  }, [statut, evaluer])

  // Reprise à l'ouverture de la page si l'employé l'avait activé et que la localisation est déjà autorisée
  // (sans autorisation, on ne déclenche pas de demande sans geste de sa part).
  useEffect(() => {
    if (!lirePreference() || typeof navigator === 'undefined' || !navigator.permissions?.query) return
    let annule = false
    navigator.permissions.query({ name: 'geolocation' as PermissionName })
      .then(autorisation => { if (!annule && autorisation.state === 'granted') demarrer() })
      .catch(err => console.warn('[btp/pointage] état de l’autorisation de localisation illisible :', err))
    return () => { annule = true }
  }, [demarrer])

  useEffect(() => couperSurveillance, [couperSurveillance])

  return { statut, lecture, etat, envoiEnCours, maintenant, demarrer, arreter }
}
