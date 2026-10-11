// tests/lib/syndic-livraison-mission.test.ts
//
// Livraison d'une mission au compte Vitfix d'un prestataire (partagée par assign-mission et
// demandes/valider) : booking seulement avec une fiche artisan, conversation « pro » trouvée ou créée,
// ordre de mission marqué côté donneur d'ordre avec ses références, notification avec conversation_id,
// non-lu compté quand donneur d'ordre et prestataire sont le même compte (démo).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { appelsDe, clientMemoire, nouvelleBase, type BaseMemoire } from '../api/syndic-supabase-memoire'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))

const { livrerMission, localisationSignalement, prioriteMissionSyndic, estBookingMissionSyndic } = await import('@/lib/syndic/livraison-mission')

const ARTISAN = 'artisan-user'
const CABINET = 'cabinet-user'

let base: BaseMemoire
const sb = () => clientMemoire(base) as unknown as SupabaseClient

const mission = (over: Record<string, unknown> = {}) => ({
  artisanUserId: ARTISAN,
  cabinetId: CABINET,
  contactId: CABINET,
  contactName: 'Cabinet VitFix',
  senderId: CABINET,
  senderName: 'Frédéric',
  titre: 'Plomberie',
  description: "Fuite d'eau",
  adresse: 'Résidence Le Prado, lot 12',
  dateIntervention: '2026-10-13',
  priorite: 'normale',
  urgence: 'normale' as const,
  references: { signalement_id: 'sig-1', syndic_mission_id: 'mis-1' },
  ...over,
})

beforeEach(() => { base = nouvelleBase() })

describe('livrerMission', () => {
  it('sans fiche profiles_artisan : pas de booking, conversation « pro » créée, ordre + notification', async () => {
    base.inserts.conversations = { id: 'conv-neuve' }
    base.inserts.conversation_messages = { id: 'msg-ordre' }
    const r = await livrerMission(sb(), mission())
    expect(r).toEqual({ bookingId: null, conversationId: 'conv-neuve', messageId: 'msg-ordre', ordreEnvoye: true, notificationEnvoyee: true })
    expect(appelsDe(base, 'bookings')).toHaveLength(0)

    expect(appelsDe(base, 'conversations', 'insert')[0].donnees).toEqual({ artisan_id: ARTISAN, contact_id: CABINET, contact_type: 'pro', contact_name: 'Cabinet VitFix' })

    const ordre = appelsDe(base, 'conversation_messages', 'insert')[0].donnees as Record<string, unknown>
    expect(ordre).toMatchObject({
      conversation_id: 'conv-neuve',
      sender_id: CABINET,
      type: 'ordre_mission',
      metadata: { cote: 'donneur_ordre', signalement_id: 'sig-1', syndic_mission_id: 'mis-1' },
    })
    expect(ordre.ordre_mission).toMatchObject({
      titre: 'Plomberie', adresse: 'Résidence Le Prado, lot 12', date_souhaitee: '2026-10-13', statut: 'en_attente',
      urgence: 'normale', mission_id: null, signalement_id: 'sig-1', syndic_mission_id: 'mis-1',
    })

    const notif = appelsDe(base, 'artisan_notifications', 'insert')[0].donnees as Record<string, unknown>
    expect(notif).toMatchObject({ artisan_id: ARTISAN, type: 'new_mission', read: false })
    expect(notif.data_json).toMatchObject({ conversation_id: 'conv-neuve', message_id: 'msg-ordre', contact_type: 'pro', signalement_id: 'sig-1', syndic_mission_id: 'mis-1' })

    expect(appelsDe(base, 'syndic_messages', 'insert')[0].donnees).toMatchObject({ cabinet_id: CABINET, artisan_user_id: ARTISAN, sender_role: 'syndic' })
  })

  it('avec fiche artisan : booking sur son agenda, référencé par l’ordre de mission', async () => {
    base.lignes.profiles_artisan = [{ id: 'profil-1', user_id: ARTISAN }]
    base.inserts.bookings = { id: 'booking-1' }
    base.lignes.conversations = [{ id: 'conv-existante', artisan_id: ARTISAN, contact_id: CABINET, contact_type: 'pro' }]
    const r = await livrerMission(sb(), mission())
    expect(r.bookingId).toBe('booking-1')
    expect(appelsDe(base, 'bookings', 'insert')[0].donnees).toMatchObject({ artisan_id: 'profil-1', client_id: CABINET, booking_date: '2026-10-13' })
    // Conversation existante reprise (pas de doublon).
    expect(appelsDe(base, 'conversations', 'insert')).toHaveLength(0)
    expect(r.conversationId).toBe('conv-existante')
    const ordre = appelsDe(base, 'conversation_messages', 'insert')[0].donnees as { ordre_mission: Record<string, unknown> }
    expect(ordre.ordre_mission.mission_id).toBe('booking-1')
    // Notes reconnues comme mission syndic (pas de rappel e-mail J-1 au « client » = donneur d'ordre).
    const { notes } = appelsDe(base, 'bookings', 'insert')[0].donnees as { notes: string }
    expect(estBookingMissionSyndic(notes)).toBe(true)
  })

  it('estBookingMissionSyndic : notes « [Mission Syndic] … » seulement', () => {
    expect(estBookingMissionSyndic('[Mission Syndic] Plomberie\nFuite')).toBe(true)
    expect(estBookingMissionSyndic('  [Mission Syndic] Plomberie')).toBe(true)
    expect(estBookingMissionSyndic('Client absent le matin')).toBe(false)
    expect(estBookingMissionSyndic(null)).toBe(false)
    expect(estBookingMissionSyndic(undefined)).toBe(false)
  })

  it('même compte des deux côtés : le message est compté non lu pour le prestataire', async () => {
    base.lignes.conversations = [{ id: 'conv-demo', artisan_id: CABINET, contact_id: CABINET, contact_type: 'pro', unread_count: 2 }]
    await livrerMission(sb(), mission({ artisanUserId: CABINET }))
    const majs = appelsDe(base, 'conversations', 'update').map((a) => a.donnees)
    expect(majs).toContainEqual({ unread_count: 3 })
  })

  it('comptes distincts : unread_count laissé au trigger', async () => {
    base.lignes.conversations = [{ id: 'conv-1', artisan_id: ARTISAN, contact_id: CABINET, contact_type: 'pro', unread_count: 0 }]
    await livrerMission(sb(), mission())
    const majs = appelsDe(base, 'conversations', 'update').map((a) => a.donnees as Record<string, unknown>)
    expect(majs.some((d) => 'unread_count' in d)).toBe(false)
  })

  it('échec de la notification : signalé dans le résultat, le reste est livré', async () => {
    base.erreurs['artisan_notifications.insert'] = { message: 'fk violation' }
    const r = await livrerMission(sb(), mission())
    expect(r.ordreEnvoye).toBe(true)
    expect(r.notificationEnvoyee).toBe(false)
  })
})

describe('helpers', () => {
  it('prioriteMissionSyndic : uniquement les valeurs du CHECK syndic_missions', () => {
    expect(prioriteMissionSyndic('urgente')).toBe('urgente')
    expect(prioriteMissionSyndic('planifiee')).toBe('planifiee')
    expect(prioriteMissionSyndic('haute')).toBe('normale')
    expect(prioriteMissionSyndic('basse')).toBe('normale')
    expect(prioriteMissionSyndic(null)).toBe('normale')
  })

  it('localisationSignalement : lot privatif ou parties communes', () => {
    expect(localisationSignalement({ immeuble_nom: 'Le Prado', batiment: 'A', etage: '3', num_lot: '12', est_partie_commune: false, zone_signalee: null }))
      .toBe('Le Prado, bât. A, étage 3, lot 12')
    expect(localisationSignalement({ immeuble_nom: 'Le Prado', batiment: null, etage: null, num_lot: null, est_partie_commune: true, zone_signalee: 'Hall' }))
      .toBe('Le Prado, parties communes : Hall')
  })
})
