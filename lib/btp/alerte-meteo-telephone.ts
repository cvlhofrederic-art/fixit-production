/**
 * Alerte météo sur le téléphone (appli Vitfix Pro, 26/11/2026) : à chaque ouverture de l'appli, pour chaque chantier
 * soumis à l'alerte que le compte voit (le salarié : ses chantiers affectés ; le gérant : tous), la prévision du
 * lendemain est relue et une notification locale est programmée pour 18 h la veille, ou affichée tout de suite si
 * l'appli est ouverte après 18 h. Les salariés ouvrent l'appli chaque jour pour pointer : c'est le moment où l'alerte
 * se programme. Aucune notification « push » n'existe (ni Firebase, ni Apple) : le serveur ne peut rien déclencher
 * sur le téléphone, d'où l'e-mail de secours de la veille (app/api/cron/alerte-meteo).
 *
 * Une notification par chantier et par jour : la même clé remplace la précédente ; si l'alerte du lendemain a disparu,
 * celle programmée est annulée. Ce qui a déjà été montré est retenu sur l'appareil (clé `vitfix_`, hors miroir).
 */

import { alerteDuLendemain, chantierSoumisAlerte, joursDePrevisions, texteAlerteDuLendemain } from '@/lib/btp/alerte-meteo'
import { urlPrevisionsMeteo } from '@/lib/btp/meteo-url'

/** Heure locale de la notification de la veille. */
export const HEURE_ALERTE_VEILLE = 18

export interface ChantierPourAlerte {
  id: string
  titre?: string
  statut?: string
  latitude?: number | null
  longitude?: number | null
  alerteMeteo?: boolean
  alerte_meteo?: boolean
}

export interface OutilsNotification {
  programmer: (p: { cle: string; titre: string; corps: string; a?: Date; extra?: Record<string, unknown> }) => Promise<boolean>
  annuler: (cle: string) => Promise<void>
}

export interface BilanAlertes {
  programmees: number
  affichees: number
  annulees: number
  ignorees: number
}

const PREFIXE_MEMOIRE = 'vitfix_btp_alerte_meteo_'

/** Clé de la notification d'un chantier pour un jour donné (identifiant natif stable). */
export const cleNotificationAlerte = (chantierId: string, date: string) => `alerte-meteo:${chantierId}:${date}`

/** Lit, écrit ou retire dans la mémoire de l'appareil ; indisponible (navigation privée) : signalé, sans effet. */
function memoire<R>(action: (stockage: Storage) => R, parDefaut: R): R {
  try {
    return action(localStorage)
  } catch (err) {
    console.warn('[alerte-meteo] mémoire de l’appareil indisponible :', err instanceof Error ? err.message : err)
    return parDefaut
  }
}

const dejaTraitee = (cle: string) => memoire(s => s.getItem(PREFIXE_MEMOIRE + cle) !== null, false)
const retenir = (cle: string, valeur: 'programmee' | 'affichee') => memoire(s => s.setItem(PREFIXE_MEMOIRE + cle, valeur), undefined)
const oublier = (cle: string) => memoire(s => s.removeItem(PREFIXE_MEMOIRE + cle), undefined)

/** 18 h aujourd'hui, à l'heure du téléphone. */
function heureDeLaVeille(maintenant: Date): Date {
  const a = new Date(maintenant)
  a.setHours(HEURE_ALERTE_VEILLE, 0, 0, 0)
  return a
}

/**
 * Programme les alertes de la veille pour les chantiers soumis à l'alerte. Ne lève jamais : une prévision illisible
 * ou un réseau absent laisse le chantier de côté (il sera revu à la prochaine ouverture).
 */
export async function programmerAlertesMeteo(
  chantiers: readonly ChantierPourAlerte[],
  isPt: boolean,
  outils: OutilsNotification,
  maintenant: Date = new Date(),
  lire: typeof fetch = fetch,
): Promise<BilanAlertes> {
  const bilan: BilanAlertes = { programmees: 0, affichees: 0, annulees: 0, ignorees: 0 }
  const veille = heureDeLaVeille(maintenant)
  for (const chantier of chantiers) {
    if (!chantierSoumisAlerte(chantier)) continue
    const url = urlPrevisionsMeteo(chantier.latitude, chantier.longitude)
    if (!url) { bilan.ignorees++; continue }
    let jours
    try {
      const reponse = await lire(url)
      if (!reponse.ok) { bilan.ignorees++; continue }
      jours = joursDePrevisions(await reponse.json())
    } catch (err) {
      console.warn('[alerte-meteo] prévision illisible :', err instanceof Error ? err.message : err)
      bilan.ignorees++
      continue
    }
    const demain = jours[1]?.date
    if (!demain) { bilan.ignorees++; continue }
    const cle = cleNotificationAlerte(chantier.id, demain)
    const alerte = alerteDuLendemain(jours)
    if (!alerte) {
      // L'alerte de demain a disparu depuis la dernière ouverture : la notification programmée ne doit pas sonner.
      if (dejaTraitee(cle)) {
        await outils.annuler(cle)
        oublier(cle)
        bilan.annulees++
      }
      continue
    }
    const { titre, corps } = texteAlerteDuLendemain(chantier.titre ?? '', alerte.motifs, isPt)
    const extra = { chantierId: chantier.id, date: alerte.date }
    if (maintenant < veille) {
      // Avant 18 h : programmée (ou reprogrammée avec la prévision du moment) pour 18 h.
      if (await outils.programmer({ cle, titre, corps, a: veille, extra })) {
        retenir(cle, 'programmee')
        bilan.programmees++
      }
    } else if (!dejaTraitee(cle)) {
      // Après 18 h, et rien encore pour ce chantier ce jour-là : tout de suite, une seule fois.
      if (await outils.programmer({ cle, titre, corps, extra })) {
        retenir(cle, 'affichee')
        bilan.affichees++
      }
    }
  }
  return bilan
}
