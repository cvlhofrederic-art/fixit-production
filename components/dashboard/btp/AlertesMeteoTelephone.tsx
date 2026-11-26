'use client'

/**
 * Programme l'alerte météo de la veille sur le téléphone (appli Vitfix Pro seulement, 26/11/2026) : au chargement des
 * chantiers, puis chaque fois que l'appli revient au premier plan (au plus une fois toutes les trois heures). La page
 * d'une appli reste souvent ouverte en arrière-plan plusieurs jours : sans ce retour au premier plan, l'alerte ne
 * serait relue qu'au redémarrage. N'affiche rien. Hors de l'appli (navigateur), ne charge rien.
 */

import { useEffect, useRef } from 'react'
import { useBTPData } from '@/lib/hooks/use-btp-data'
import { estAppMobile } from '@/lib/app-mobile'
import { programmerAlertesMeteo, type ChantierPourAlerte } from '@/lib/btp/alerte-meteo-telephone'
import { annulerNotification, programmerNotification } from '@/lib/notifications'

/** Écart minimal entre deux relectures des prévisions (retours au premier plan rapprochés). */
export const INTERVALLE_RELECTURE_MS = 3 * 60 * 60 * 1000

const OUTILS = { programmer: programmerNotification, annuler: annulerNotification }

function AlertesDeLAppli({ artisanId, userId, isPt }: { artisanId: string; userId: string; isPt: boolean }) {
  const { items: chantiers, loading } = useBTPData<ChantierPourAlerte>({ table: 'chantiers', artisanId, userId })
  const derniere = useRef(0)
  const chantiersRef = useRef<readonly ChantierPourAlerte[]>([])
  chantiersRef.current = chantiers

  useEffect(() => {
    if (loading) return
    const relire = (force: boolean) => {
      const maintenant = Date.now()
      if (!force && maintenant - derniere.current < INTERVALLE_RELECTURE_MS) return
      derniere.current = maintenant
      programmerAlertesMeteo(chantiersRef.current, isPt, OUTILS).catch((err: unknown) => {
        console.warn('[alerte-meteo] programmation impossible :', err instanceof Error ? err.message : err)
      })
    }
    relire(derniere.current === 0)
    const auPremierPlan = () => { if (document.visibilityState === 'visible') relire(false) }
    document.addEventListener('visibilitychange', auPremierPlan)
    return () => document.removeEventListener('visibilitychange', auPremierPlan)
  }, [loading, isPt])

  return null
}

export default function AlertesMeteoTelephone(props: { artisanId: string; userId: string; isPt: boolean }) {
  if (!estAppMobile() || !props.artisanId) return null
  return <AlertesDeLAppli {...props} />
}
