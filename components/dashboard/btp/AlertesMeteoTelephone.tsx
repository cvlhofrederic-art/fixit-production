'use client'

/**
 * Programme l'alerte météo de la veille sur le téléphone (appli Vitfix Pro seulement, 26/11/2026) : au chargement des
 * chantiers, chaque fois que l'appli revient au premier plan (au plus une fois par heure) et aussitôt après un
 * chantier enregistré dans l'appli (case cochée ou décochée, statut…), avec la liste des chantiers RELUE à ce
 * moment-là. La page d'une appli reste souvent ouverte en arrière-plan plusieurs jours : une case changée ailleurs, un
 * chantier terminé ou un salarié affecté ailleurs doivent compter. Une liste qui n'a pas pu être lue ne programme ni
 * n'annule rien, et la relecture est retentée au retour suivant. Les passages se suivent, jamais deux à la fois.
 * N'affiche rien, pas même un message d'échec. Hors de l'appli (navigateur), ne charge rien.
 */

import { useEffect, useRef } from 'react'
import { EVENEMENT_CHANTIERS_ECRITS, useBTPData } from '@/lib/hooks/use-btp-data'
import { estAppMobile } from '@/lib/app-mobile'
import { generationAlertes, programmerAlertesMeteo, type ChantierPourAlerte } from '@/lib/btp/alerte-meteo-telephone'
import {
  annulerNotification, autorisationNotifications, notificationEnAttente, programmerNotification,
} from '@/lib/notifications'

/** Écart minimal entre deux relectures au retour au premier plan (retours rapprochés : WhatsApp, appareil photo…). */
export const INTERVALLE_RELECTURE_MS = 60 * 60 * 1000

const OUTILS = {
  programmer: programmerNotification,
  annuler: annulerNotification,
  enAttente: notificationEnAttente,
  autorisation: autorisationNotifications,
}

interface PluginApp {
  addListener(evenement: 'resume', ecouteur: () => void): Promise<{ remove: () => Promise<void> }>
}

/** Retour au premier plan signalé par l'appli (@capacitor/app) ; module absent du binaire : visibilitychange seul. */
async function ecouterRetourDansLAppli(rappel: () => void): Promise<(() => void) | null> {
  try {
    const { App } = (await import('@capacitor/app')) as unknown as { App: PluginApp }
    const abonnement = await App.addListener('resume', rappel)
    return () => { void abonnement.remove() }
  } catch (err) {
    console.warn('[alerte-meteo] retour au premier plan de l’appli non suivi :', err instanceof Error ? err.message : err)
    return null
  }
}

const signaler = (err: unknown) => {
  console.warn('[alerte-meteo] programmation impossible :', err instanceof Error ? err.message : err)
}

function AlertesDeLAppli({ artisanId, userId, isPt }: { artisanId: string; userId: string; isPt: boolean }) {
  const { items: chantiers, loading, error, refresh } = useBTPData<ChantierPourAlerte>({
    table: 'chantiers', artisanId, userId, autoImport: false, annoncerEchecs: false,
  })
  /** Heure du dernier passage ; 0 tant qu'aucune liste n'a été lue (le retour au premier plan suivant relit alors). */
  const derniere = useRef(0)
  /** Passage en cours : le suivant attend sa fin (un passage lent ne reprogramme pas ce qu'un autre vient d'annuler). */
  const file = useRef<Promise<unknown>>(Promise.resolve())
  // Liste lue par le hook et son échec éventuel, pour le premier passage (mis à jour avant l'effet qui suit, déclaré après).
  const lecture = useRef<{ chantiers: readonly ChantierPourAlerte[]; error: string | null }>({ chantiers: [], error: null })
  useEffect(() => { lecture.current = { chantiers, error } }, [chantiers, error])

  useEffect(() => {
    if (loading) return
    let actif = true
    // La génération est relevée au déclenchement : un passage déclenché avant une déconnexion ne programme rien, même
    // s'il ne démarre qu'après (file d'attente, relecture encore en vol).
    const programmer = (liste: readonly ChantierPourAlerte[], generation = generationAlertes()) => {
      file.current = file.current
        .then(() => programmerAlertesMeteo(liste, isPt, OUTILS, undefined, undefined, generation))
        .catch(signaler)
    }
    const relire = () => {
      derniere.current = Date.now()
      const generation = generationAlertes()
      void refresh().then(lignes => {
        if (!actif || generationAlertes() !== generation) return
        if (lignes === null) { derniere.current = 0; return } // lecture en échec : retentée au retour suivant
        programmer(lignes as ChantierPourAlerte[], generation)
      })
    }
    // Premier passage : la liste que le hook vient de lire, sans la relire.
    if (derniere.current === 0 && lecture.current.error === null) {
      derniere.current = Date.now()
      programmer(lecture.current.chantiers)
    }
    const auRetour = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - derniere.current < INTERVALLE_RELECTURE_MS) return
      relire()
    }
    document.addEventListener('visibilitychange', auRetour)
    window.addEventListener(EVENEMENT_CHANTIERS_ECRITS, relire)
    let retirerEcouteurAppli: (() => void) | null = null
    void ecouterRetourDansLAppli(auRetour).then(retirer => {
      if (actif) retirerEcouteurAppli = retirer
      else retirer?.()
    })
    return () => {
      actif = false
      document.removeEventListener('visibilitychange', auRetour)
      window.removeEventListener(EVENEMENT_CHANTIERS_ECRITS, relire)
      retirerEcouteurAppli?.()
    }
  }, [loading, isPt, refresh])

  return null
}

export default function AlertesMeteoTelephone(props: { artisanId: string; userId: string; isPt: boolean }) {
  if (!estAppMobile() || !props.artisanId) return null
  return <AlertesDeLAppli {...props} />
}
