'use client'

/**
 * Programme l'alerte météo de la veille sur le téléphone (appli Vitfix Pro seulement, 26/11/2026) : au chargement des
 * chantiers, puis chaque fois que l'appli revient au premier plan (au plus une fois par heure), avec la liste des
 * chantiers RELUE à ce moment-là. La page d'une appli reste souvent ouverte en arrière-plan plusieurs jours : une case
 * cochée ou décochée entre-temps, un chantier terminé ou un salarié affecté ailleurs doivent compter. Une liste qui n'a
 * pas pu être lue ne programme ni n'annule rien. N'affiche rien, pas même un message d'échec. Hors de l'appli
 * (navigateur), ne charge rien.
 */

import { useEffect, useRef } from 'react'
import { useBTPData } from '@/lib/hooks/use-btp-data'
import { estAppMobile } from '@/lib/app-mobile'
import { programmerAlertesMeteo, type ChantierPourAlerte } from '@/lib/btp/alerte-meteo-telephone'
import { annulerNotification, notificationEnAttente, programmerNotification } from '@/lib/notifications'

/** Écart minimal entre deux relectures (retours au premier plan rapprochés : WhatsApp, appareil photo…). */
export const INTERVALLE_RELECTURE_MS = 60 * 60 * 1000

const OUTILS = { programmer: programmerNotification, annuler: annulerNotification, enAttente: notificationEnAttente }

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

function programmer(chantiers: readonly ChantierPourAlerte[], isPt: boolean): void {
  programmerAlertesMeteo(chantiers, isPt, OUTILS).catch((err: unknown) => {
    console.warn('[alerte-meteo] programmation impossible :', err instanceof Error ? err.message : err)
  })
}

function AlertesDeLAppli({ artisanId, userId, isPt }: { artisanId: string; userId: string; isPt: boolean }) {
  const { items: chantiers, loading, error, refresh } = useBTPData<ChantierPourAlerte>({
    table: 'chantiers', artisanId, userId, autoImport: false, annoncerEchecs: false,
  })
  /** Heure du dernier passage ; 0 tant qu'aucune liste n'a été lue (le premier retour au premier plan relit alors). */
  const derniere = useRef(0)
  // Liste lue par le hook et son échec éventuel, pour le premier passage (mis à jour avant l'effet qui suit, déclaré après).
  const lecture = useRef<{ chantiers: readonly ChantierPourAlerte[]; error: string | null }>({ chantiers: [], error: null })
  useEffect(() => { lecture.current = { chantiers, error } }, [chantiers, error])

  useEffect(() => {
    if (loading) return
    let actif = true
    // Premier passage : la liste que le hook vient de lire, sans la relire.
    if (derniere.current === 0 && lecture.current.error === null) {
      derniere.current = Date.now()
      programmer(lecture.current.chantiers, isPt)
    }
    const auRetour = () => {
      if (document.visibilityState !== 'visible') return
      const maintenant = Date.now()
      if (maintenant - derniere.current < INTERVALLE_RELECTURE_MS) return
      derniere.current = maintenant
      void refresh().then(lignes => {
        if (actif && lignes !== null) programmer(lignes as ChantierPourAlerte[], isPt)
      })
    }
    document.addEventListener('visibilitychange', auRetour)
    let retirerEcouteurAppli: (() => void) | null = null
    void ecouterRetourDansLAppli(auRetour).then(retirer => {
      if (actif) retirerEcouteurAppli = retirer
      else retirer?.()
    })
    return () => {
      actif = false
      document.removeEventListener('visibilitychange', auRetour)
      retirerEcouteurAppli?.()
    }
  }, [loading, isPt, refresh])

  return null
}

export default function AlertesMeteoTelephone(props: { artisanId: string; userId: string; isPt: boolean }) {
  if (!estAppMobile() || !props.artisanId) return null
  return <AlertesDeLAppli {...props} />
}
