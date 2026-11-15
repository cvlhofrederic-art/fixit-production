// @vitest-environment node
// tests/api/bookings-creation-serveur.test.ts
//
// POST /api/bookings — création d'une demande de réservation par un client (parcours critique
// « client → réservation → professionnel »). Le serveur décide seul de ce que l'écran de réservation
// n'a pas à choisir :
//   - le statut : « pending », ou « confirmed » si la prestation de la fiche est en validation automatique ;
//   - la prestation : elle doit être celle du professionnel réservé ;
//   - le prix sans prestation : aucun (l'écran n'en envoie pas pour un motif libre).
// Les deux écrans appelants (fiche du professionnel, page de réservation) envoient toujours « pending »,
// une prestation de la fiche et l'estimation calculée par la page : ces demandes passent comme avant.
// Aucune donnée réelle : comptes, fiches et prestations d'exemple.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { appelsDe, clientMemoire, nouvelleBase, type BaseMemoire } from './syndic-supabase-memoire'

const CLIENT = '11111111-1111-4111-8111-111111111111'
const COMPTE_A = '22222222-2222-4222-8222-222222222222'
const FICHE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const FICHE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const PRESTATION_A = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1'
const PRESTATION_A_AUTO = 'a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2'
const PRESTATION_B_AUTO = 'b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1'
const PRESTATION_INCONNUE = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

const h = vi.hoisted(() => ({
  base: null as unknown as BaseMemoire,
  user: null as null | { id: string; user_metadata: Record<string, unknown> },
  sendEmail: vi.fn(async () => ({ success: true })),
}))

vi.mock('@/lib/auth-helpers', () => ({ getAuthUser: vi.fn(async () => h.user) }))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())
vi.mock('@/lib/email', () => ({
  sendEmail: h.sendEmail,
  templateBookingCreated: vi.fn(() => ({ subject: 'Nouvelle réservation', html: '<p>Nouvelle réservation</p>' })),
}))
vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: (t: string) => clientMemoire(h.base).from(t),
    auth: { admin: { getUserById: vi.fn(async () => ({ data: { user: { email: 'pro@exemple.test' } } })) } },
  },
}))

const { POST } = await import('@/app/api/bookings/route')

/** Ce que la fiche du professionnel envoie (app/fr/artisan/[id]/page.tsx, submitBooking). */
const demandeDeLaFiche = (surcharge: Record<string, unknown> = {}) => ({
  artisan_id: FICHE_A,
  service_id: PRESTATION_A,
  status: 'pending',
  booking_date: '2027-03-15',
  booking_time: '09:00',
  duration_minutes: 120,
  address: '12 rue des Lilas, 13600 La Ciotat',
  notes: 'Estimation: 400–600€. Client: Marie Exemple | Tel: 0600000000 | Email: marie@exemple.test | ',
  price_ht: 400,
  price_ttc: 600,
  ...surcharge,
})

const poster = async (corps: Record<string, unknown>) => {
  const res = await POST(new NextRequest('https://vitfix.io/api/bookings', {
    method: 'POST',
    headers: { Authorization: 'Bearer jeton', 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  }))
  return { status: res.status, json: await res.json() as { data?: Record<string, unknown>; error?: string } }
}

const reservationCreee = () => appelsDe(h.base, 'bookings', 'insert')[0]?.donnees as Record<string, unknown> | undefined

beforeEach(() => {
  h.base = nouvelleBase()
  h.user = { id: CLIENT, user_metadata: { full_name: 'Marie Exemple' } }
  h.sendEmail.mockClear()
  h.base.lignes.profiles_artisan = [
    { id: FICHE_A, user_id: COMPTE_A, company_name: 'Entreprise A', language: 'fr' },
    { id: FICHE_B, user_id: null, company_name: 'Entreprise B', language: 'fr' },
  ]
  h.base.lignes.profiles_client = [{ id: CLIENT }]
  h.base.lignes.services = [
    { id: PRESTATION_A, artisan_id: FICHE_A, name: 'Pose de carrelage', validation_auto: false, delai_minimum_heures: 0 },
    { id: PRESTATION_A_AUTO, artisan_id: FICHE_A, name: 'Dépannage', validation_auto: true, delai_minimum_heures: 0 },
    { id: PRESTATION_B_AUTO, artisan_id: FICHE_B, name: 'Visite express', validation_auto: true, delai_minimum_heures: 0 },
  ]
})

afterEach(() => {
  // Rend l'horloge réelle aux tests qui l'ont figée.
  vi.useRealTimers()
})

describe('POST /api/bookings — ce que le serveur décide seul', () => {
  it.each(['completed', 'confirmed', 'cancelled'])('statut « %s » reçu : la demande est créée « pending », sans date de confirmation', async (statut) => {
    const res = await poster(demandeDeLaFiche({ status: statut }))
    expect(res.status).toBe(200)
    expect(reservationCreee()).toMatchObject({ artisan_id: FICHE_A, client_id: CLIENT, status: 'pending' })
    expect(reservationCreee()).not.toHaveProperty('confirmed_at')
  })

  it('prestation d’un autre professionnel : 400, rien n’est créé, personne n’est prévenu', async () => {
    const res = await poster(demandeDeLaFiche({ service_id: PRESTATION_B_AUTO }))
    expect(res.status).toBe(400)
    expect(res.json.error).toBe('Cette prestation n’est pas proposée par ce professionnel.')
    expect(appelsDe(h.base, 'bookings', 'insert')).toHaveLength(0)
    expect(appelsDe(h.base, 'artisan_notifications')).toHaveLength(0)
    expect(h.sendEmail).not.toHaveBeenCalled()
  })

  it('prestation inconnue : 400, rien n’est créé', async () => {
    const res = await poster(demandeDeLaFiche({ service_id: PRESTATION_INCONNUE }))
    expect(res.status).toBe(400)
    expect(appelsDe(h.base, 'bookings', 'insert')).toHaveLength(0)
  })

  it('lecture de la prestation en erreur : 500 avec un message en français, rien n’est créé (la prestation n’a pas pu être vérifiée)', async () => {
    h.base.erreurs['services.select'] = { message: 'panne' }
    const res = await poster(demandeDeLaFiche())
    expect(res.status).toBe(500)
    // Les deux écrans de réservation affichent ce message tel quel au client.
    expect(res.json.error).toBe('Réservation impossible pour le moment. Réessayez dans quelques instants.')
    expect(appelsDe(h.base, 'bookings', 'insert')).toHaveLength(0)
  })

  it('sans prestation (motif libre) : un prix reçu n’est pas enregistré', async () => {
    const { service_id: _sans, ...sansPrestation } = demandeDeLaFiche({ price_ht: 90000, price_ttc: 90000 })
    const res = await poster(sansPrestation)
    expect(res.status).toBe(200)
    expect(reservationCreee()).toMatchObject({ status: 'pending', price_ht: 0, price_ttc: 0 })
    expect(reservationCreee()).not.toHaveProperty('service_id')
  })
})

describe('POST /api/bookings — parcours de réservation inchangé', () => {
  it('fiche du professionnel : prestation de la fiche, estimation basse et haute, « pending » — enregistrée telle quelle', async () => {
    const res = await poster(demandeDeLaFiche())
    expect(res.status).toBe(200)
    expect(reservationCreee()).toEqual({
      artisan_id: FICHE_A,
      client_id: CLIENT,
      booking_date: '2027-03-15',
      booking_time: '09:00',
      duration_minutes: 120,
      address: '12 rue des Lilas, 13600 La Ciotat',
      notes: 'Estimation: 400–600€. Client: Marie Exemple | Tel: 0600000000 | Email: marie@exemple.test | ',
      price_ht: 400,
      price_ttc: 600,
      status: 'pending',
      service_id: PRESTATION_A,
    })
    // Le professionnel est prévenu comme avant (notification et e-mail).
    const notification = appelsDe(h.base, 'artisan_notifications', 'insert')[0].donnees as Record<string, unknown>
    expect(notification).toMatchObject({ artisan_id: COMPTE_A, type: 'new_booking' })
    expect(String(notification.body)).toContain('Pose de carrelage')
    expect(h.sendEmail).toHaveBeenCalledTimes(1)
  })

  it('identifiant de fiche reçu en majuscules : la prestation de la fiche est reconnue', async () => {
    // La base compare les identifiants sans tenir compte de la casse : le faux Supabase d'ici, non.
    h.base.lignes.profiles_artisan[0].id = FICHE_A.toUpperCase()
    const res = await poster(demandeDeLaFiche({ artisan_id: FICHE_A.toUpperCase() }))
    expect(res.status).toBe(200)
    expect(reservationCreee()).toMatchObject({ status: 'pending', service_id: PRESTATION_A })
  })

  it('prestation de la fiche en validation automatique : « confirmed » avec sa date de confirmation', async () => {
    const res = await poster(demandeDeLaFiche({ service_id: PRESTATION_A_AUTO }))
    expect(res.status).toBe(200)
    expect(reservationCreee()).toMatchObject({ status: 'confirmed', service_id: PRESTATION_A_AUTO, price_ht: 400, price_ttc: 600 })
    expect(typeof reservationCreee()?.confirmed_at).toBe('string')
  })

  it('page de réservation (prix de la prestation, durée de la prestation) : créée « pending »', async () => {
    const res = await poster({
      artisan_id: FICHE_A, service_id: PRESTATION_A, booking_date: '2027-03-15', booking_time: '10:00',
      duration_minutes: 60, address: 'À définir', notes: 'Client: Marie Exemple | Tél: N/C | Email: N/C',
      price_ht: 50, price_ttc: 60, status: 'pending',
    })
    expect(res.status).toBe(200)
    expect(reservationCreee()).toMatchObject({ status: 'pending', service_id: PRESTATION_A, price_ht: 50, price_ttc: 60 })
  })

  it('motif libre sans prestation ni prix : créée « pending »', async () => {
    const { service_id: _sans, ...sansPrestation } = demandeDeLaFiche({ price_ht: 0, price_ttc: 0, notes: 'Motif: fuite sous évier. Client: Marie Exemple | Tel: 0600000000 | Email: - | ' })
    const res = await poster(sansPrestation)
    expect(res.status).toBe(200)
    expect(reservationCreee()).toMatchObject({ artisan_id: FICHE_A, status: 'pending', price_ht: 0, price_ttc: 0 })
    expect(appelsDe(h.base, 'services')).toHaveLength(0)
  })

  it('délai minimum de la prestation toujours appliqué', async () => {
    // Horloge figée et dates fixes : le lendemain 09:00 est à moins de 48 h et le créneau du 15 à plus de 48 h,
    // quel que soit le fuseau de la machine.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2027-03-10T08:00:00Z'))
    h.base.lignes.services[0].delai_minimum_heures = 48

    const tropTot = await poster(demandeDeLaFiche({ booking_date: '2027-03-11' }))
    expect(tropTot.status).toBe(400)
    expect(tropTot.json.error).toContain('délai minimum de 48h')
    expect(appelsDe(h.base, 'bookings', 'insert')).toHaveLength(0)

    const dansLesDelais = await poster(demandeDeLaFiche({ booking_date: '2027-03-15' }))
    expect(dansLesDelais.status).toBe(200)
    expect(reservationCreee()).toMatchObject({ booking_date: '2027-03-15', status: 'pending' })
  })

  it('réglages de la prestation absents de la base (validation automatique, délai minimum) : la demande est créée « pending »', async () => {
    // Le schéma réel peut différer des migrations : une colonne de réglage manquante vaut « non réglé »,
    // elle ne doit pas faire échouer toutes les réservations avec prestation.
    h.base.colonnesAbsentes = { services: ['validation_auto', 'delai_minimum_heures'] }
    h.base.lignes.services = [{ id: PRESTATION_A, artisan_id: FICHE_A, name: 'Pose de carrelage' }]
    const res = await poster(demandeDeLaFiche())
    expect(res.status).toBe(200)
    expect(reservationCreee()).toMatchObject({ artisan_id: FICHE_A, status: 'pending', service_id: PRESTATION_A, price_ht: 400, price_ttc: 600 })
    expect(reservationCreee()).not.toHaveProperty('confirmed_at')
    const notification = appelsDe(h.base, 'artisan_notifications', 'insert')[0].donnees as Record<string, unknown>
    expect(String(notification.body)).toContain('Pose de carrelage')
  })

  it('401 sans session', async () => {
    h.user = null
    expect((await poster(demandeDeLaFiche())).status).toBe(401)
    expect(h.base.appels).toHaveLength(0)
  })
})
