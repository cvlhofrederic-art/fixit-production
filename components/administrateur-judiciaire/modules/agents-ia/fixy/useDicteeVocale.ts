'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Dictée vocale (Web Speech API, reconnaissance en français) pour la zone de demande de Fixy.
 * L'API n'est pas déclarée par lib.dom : ses types minimaux sont décrits ici.
 */

/** Événement « result » de la reconnaissance vocale. */
interface EvenementResultatDictee {
  readonly results: SpeechRecognitionResultList
}

/** Instance de reconnaissance vocale (SpeechRecognition ou webkitSpeechRecognition). */
interface ReconnaissanceVocale {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((evenement: EvenementResultatDictee) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}

type ConstructeurReconnaissanceVocale = new () => ReconnaissanceVocale

type FenetreAvecDictee = Window & {
  SpeechRecognition?: ConstructeurReconnaissanceVocale
  webkitSpeechRecognition?: ConstructeurReconnaissanceVocale
}

export interface DicteeVocale {
  /** L'API de reconnaissance vocale est disponible dans ce navigateur. */
  disponible: boolean
  /** Une dictée est en cours. */
  ecoute: boolean
  /** Démarre la dictée, ou l'arrête si elle est en cours. */
  basculer: () => void
}

/**
 * Dictée vocale : chaque résultat (transcriptions jointes par une espace) est transmis à `onTexte`.
 * La fin ou une erreur de la reconnaissance en cours repasse `ecoute` à false.
 *
 * Deux défauts de la maquette sont corrigés (rendu inchangé) :
 * - la fin ou l'erreur d'une dictée déjà remplacée par une nouvelle (Arrêter puis Dicter aussitôt) ne remet plus
 *   `ecoute` à false pendant que la nouvelle dictée écoute ;
 * - au démontage, la dictée en cours est arrêtée et ses gestionnaires détachés (le micro restait ouvert et le
 *   résultat visait un composant démonté).
 */
export function useDicteeVocale(onTexte: (texte: string) => void): DicteeVocale {
  const fenetre = typeof window !== 'undefined' ? (window as FenetreAvecDictee) : null
  const Reconnaissance = fenetre ? fenetre.SpeechRecognition || fenetre.webkitSpeechRecognition : null
  const [ecoute, setEcoute] = useState(false)
  const reconnaissanceRef = useRef<ReconnaissanceVocale | null>(null)
  useEffect(
    () => () => {
      const reconnaissance = reconnaissanceRef.current
      if (!reconnaissance) return
      reconnaissanceRef.current = null
      reconnaissance.onresult = null
      reconnaissance.onend = null
      reconnaissance.onerror = null
      try {
        reconnaissance.stop()
      } catch {
        // stop() sur une dictée déjà terminée est ignoré par la spécification ; si un navigateur levait quand même,
        // l'erreur ne doit pas remonter du démontage (il n'y a plus rien à arrêter).
      }
    },
    [],
  )
  return {
    disponible: !!Reconnaissance,
    ecoute,
    basculer: () => {
      if (!Reconnaissance) return
      if (ecoute) {
        if (reconnaissanceRef.current) reconnaissanceRef.current.stop()
        setEcoute(false)
        return
      }
      const reconnaissance = new Reconnaissance()
      reconnaissance.lang = 'fr-FR'
      reconnaissance.interimResults = false
      reconnaissance.maxAlternatives = 1
      reconnaissance.onresult = (evenement) => {
        const texte = Array.from(evenement.results)
          .map((resultat) => resultat[0].transcript)
          .join(' ')
        onTexte(texte)
      }
      // Seule la dictée en cours (la dernière démarrée) repasse `ecoute` à false.
      const terminer = () => {
        if (reconnaissanceRef.current === reconnaissance) setEcoute(false)
      }
      reconnaissance.onend = terminer
      reconnaissance.onerror = terminer
      reconnaissanceRef.current = reconnaissance
      setEcoute(true)
      reconnaissance.start()
    },
  }
}
