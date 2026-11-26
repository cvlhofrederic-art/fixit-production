/**
 * lib/notifications.ts
 * Helper pour les notifications locales Capacitor (rappels intervention J-1)
 * Fonctionne uniquement sur app native iOS/Android — silencieux sur web (rien n'y est chargé)
 * Tests : tests/lib/notifications.test.ts
 */

import { Capacitor } from '@capacitor/core'

// Type for the Capacitor LocalNotifications plugin (loaded dynamically)
interface LocalNotificationsLike {
  requestPermissions(): Promise<{ display: string }>
  schedule(options: { notifications: Array<Record<string, unknown>> }): Promise<void>
  cancel(options: { notifications: Array<{ id: number }> }): Promise<void>
  getPending(): Promise<{ notifications: Array<{ id: number | string }> }>
}

let chargement: Promise<{ plugin: LocalNotificationsLike }> | null = null

/**
 * Module natif, importé une seule fois et seulement à la demande (import dynamique : pas d'erreur au rendu serveur de
 * Next.js) ; un échec de chargement sera retenté. Toujours rendu dans un objet ordinaire : LocalNotifications est le
 * proxy de registerPlugin (@capacitor/core), qui répond à toute propriété lue, « then » compris. Rendu tel quel par
 * une fonction async ou une promesse, il était pris pour une promesse qui ne se résout jamais : dans l'appli, aucun
 * rappel n'était programmé ni annulé, sans erreur visible pour l'artisan (un rejet non géré dans la console seulement,
 * « LocalNotifications.then() is not implemented ») ; corrigé le 17/11/2026.
 */
function charger(): Promise<{ plugin: LocalNotificationsLike }> {
  chargement ??= import('@capacitor/local-notifications').then(
    m => ({ plugin: m.LocalNotifications as unknown as LocalNotificationsLike }),
    (err: unknown) => {
      chargement = null
      throw err
    },
  )
  return chargement
}

/**
 * Demande la permission d'envoyer des notifications locales
 * @returns true si accordée, false sinon
 */
async function requestNotificationPermission(plugin: LocalNotificationsLike): Promise<boolean> {
  try {
    const { display } = await plugin.requestPermissions()
    return display === 'granted'
  } catch (error) {
    console.warn('[notifications] requestPermissions failed:', error instanceof Error ? error.message : error)
    return false
  }
}

/**
 * Programme un rappel de notification J-1 avant une intervention
 * La notification apparaît exactement 24h avant le début de l'intervention
 */
export async function scheduleInterventionReminder(booking: {
  id: string
  booking_date: string   // format YYYY-MM-DD
  booking_time: string   // format HH:MM ou HH:MM:SS
  address?: string
  serviceName?: string
}): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  const { plugin } = await charger()

  const granted = await requestNotificationPermission(plugin)
  if (!granted) return

  // Construire la date/heure de l'intervention
  const [year, month, day] = booking.booking_date.split('-').map(Number)
  const [hour, minute] = booking.booking_time.split(':').map(Number)
  const interventionAt = new Date(year, month - 1, day, hour, minute, 0)

  // Rappel 24h avant
  const reminderAt = new Date(interventionAt.getTime() - 24 * 60 * 60 * 1000)

  // Ne pas scheduler si la date de rappel est invalide (date ou heure vide ou mal formée : « at » partirait à null et
  // Android afficherait le rappel sur-le-champ) ou déjà passée
  if (Number.isNaN(reminderAt.getTime()) || reminderAt <= new Date()) return

  const notifId = bookingIdToInt(booking.id)
  const time = booking.booking_time.substring(0, 5)
  const serviceName = booking.serviceName || 'Intervention'
  const addressPart = booking.address ? ` — ${booking.address}` : ''

  try {
    await plugin.schedule({
      notifications: [
        {
          id: notifId,
          title: '🔧 Rappel intervention demain',
          body: `${serviceName} demain à ${time}${addressPart}`,
          schedule: { at: reminderAt, allowWhileIdle: true },
          sound: 'default',
          smallIcon: 'ic_stat_icon_config_sample',
          iconColor: '#FFC107',
          actionTypeId: '',
          extra: { bookingId: booking.id },
        },
      ],
    })
  } catch (err) {
    console.warn('Notification schedule failed:', err)
  }
}

/**
 * Annule le rappel d'une intervention (ex: RDV annulé)
 */
export async function cancelInterventionReminder(bookingId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  const { plugin } = await charger()
  try {
    await plugin.cancel({ notifications: [{ id: bookingIdToInt(bookingId) }] })
  } catch (err) {
    console.warn('Notification cancel failed:', err)
  }
}

/**
 * Envoie une notification immédiate (ex: nouveau RDV reçu)
 */
export async function sendImmediateNotification(title: string, body: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  const { plugin } = await charger()

  const granted = await requestNotificationPermission(plugin)
  if (!granted) return

  try {
    const id = Math.floor(Math.random() * 2147483647)
    await plugin.schedule({
      notifications: [
        {
          id,
          title,
          body,
          schedule: { at: new Date(Date.now() + 500) }, // 500ms délai minimum
          sound: 'default',
          smallIcon: 'ic_stat_icon_config_sample',
          iconColor: '#FFC107',
          actionTypeId: '',
        },
      ],
    })
  } catch (err) {
    console.warn('Immediate notification failed:', err)
  }
}

/**
 * Convertit un UUID string en entier 32-bit positif
 * Requis car LocalNotifications.schedule() exige un number (int32) comme id
 */
function bookingIdToInt(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i)
    hash |= 0 // Convertit en int32
  }
  return Math.abs(hash)
}

/** En deçà de cette marge, une heure demandée est traitée comme « tout de suite ». */
const MARGE_IMMEDIATE_MS = 1000

/**
 * Programme (ou reprogramme) une notification désignée par une clé stable : la même clé remplace la notification
 * déjà programmée au lieu d'en ajouter une seconde (même identifiant natif). Heure `a` passée, trop proche ou absente :
 * affichée tout de suite, sans heure (Android l'affiche alors aussitôt ; une heure déjà passée quand le module la
 * traite serait écartée sans erreur). Rend true si la notification est programmée ; false hors de l'appli, sans
 * permission, si le module ne se charge pas ou en cas d'échec : ne lève jamais.
 * Sert à l'alerte météo des chantiers BTP (lib/btp/alerte-meteo-telephone.ts, 26/11/2026).
 */
export async function programmerNotification(params: {
  cle: string
  titre: string
  corps: string
  a?: Date
  extra?: Record<string, unknown>
}): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  try {
    const { plugin } = await charger()
    if (!(await requestNotificationPermission(plugin))) return false
    const plusTard = params.a && !Number.isNaN(params.a.getTime()) && params.a.getTime() > Date.now() + MARGE_IMMEDIATE_MS
    await plugin.schedule({
      notifications: [
        {
          id: bookingIdToInt(params.cle),
          title: params.titre,
          body: params.corps,
          ...(plusTard ? { schedule: { at: params.a, allowWhileIdle: true } } : {}),
          sound: 'default',
          smallIcon: 'ic_stat_icon_config_sample',
          iconColor: '#FFC107',
          actionTypeId: '',
          extra: params.extra ?? {},
        },
      ],
    })
    return true
  } catch (err) {
    console.warn('[notifications] programmation impossible :', err instanceof Error ? err.message : err)
    return false
  }
}

/** Annule la notification programmée sous cette clé (sans effet si aucune ne l'est). Ne lève jamais. */
export async function annulerNotification(cle: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    const { plugin } = await charger()
    await plugin.cancel({ notifications: [{ id: bookingIdToInt(cle) }] })
  } catch (err) {
    console.warn('[notifications] annulation impossible :', err instanceof Error ? err.message : err)
  }
}

/**
 * La notification de cette clé attend-elle encore son heure ? Faux hors de l'appli. En cas d'échec de la lecture :
 * vrai (l'appelant la remontre alors sous le même identifiant, ce qui remplace au pire celle déjà affichée).
 */
export async function notificationEnAttente(cle: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  try {
    const { plugin } = await charger()
    const { notifications } = await plugin.getPending()
    const id = bookingIdToInt(cle)
    return (notifications ?? []).some(n => Number(n.id) === id)
  } catch (err) {
    console.warn('[notifications] lecture des notifications en attente impossible :', err instanceof Error ? err.message : err)
    return true
  }
}
