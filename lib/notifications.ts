/**
 * lib/notifications.ts
 * Helper pour les notifications locales Capacitor (rappels intervention J-1)
 * Fonctionne uniquement sur app native iOS/Android — silencieux sur web
 */

import { Capacitor } from '@capacitor/core'

// Import dynamique pour éviter les erreurs SSR Next.js
// Type for the Capacitor LocalNotifications plugin (loaded dynamically)
interface LocalNotificationsLike {
  requestPermissions(): Promise<{ display: string }>
  schedule(options: { notifications: Array<Record<string, unknown>> }): Promise<void>
  cancel(options: { notifications: Array<{ id: number }> }): Promise<void>
}

let LocalNotificationsPlugin: LocalNotificationsLike | null = null

async function getPlugin() {
  if (!Capacitor.isNativePlatform()) return null
  if (!LocalNotificationsPlugin) {
    const mod = await import('@capacitor/local-notifications')
    LocalNotificationsPlugin = mod.LocalNotifications as unknown as LocalNotificationsLike
  }
  return LocalNotificationsPlugin
}

/**
 * Demande la permission d'envoyer des notifications locales
 * @returns true si accordée, false sinon
 */
async function requestNotificationPermission(): Promise<boolean> {
  const plugin = await getPlugin()
  if (!plugin) return false
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
  const plugin = await getPlugin()
  if (!plugin) return

  const granted = await requestNotificationPermission()
  if (!granted) return

  // Construire la date/heure de l'intervention
  const [year, month, day] = booking.booking_date.split('-').map(Number)
  const [hour, minute] = booking.booking_time.split(':').map(Number)
  const interventionAt = new Date(year, month - 1, day, hour, minute, 0)

  // Rappel 24h avant
  const reminderAt = new Date(interventionAt.getTime() - 24 * 60 * 60 * 1000)

  // Ne pas scheduler si la date de rappel est déjà passée
  if (reminderAt <= new Date()) return

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
  const plugin = await getPlugin()
  if (!plugin) return
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
  const plugin = await getPlugin()
  if (!plugin) return

  const granted = await requestNotificationPermission()
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
