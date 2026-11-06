// tests/api/aj-signalement-signalements.test.ts
//
// POST /api/aj-signalement/signalements — dépôt public après scan du QR code :
//   - corps validé (coordonnées obligatoires), jeton inconnu → 404, migration absente → 503 ;
//   - enregistrement dans signalements_qr (e-mail en minuscules, zone seulement pour les parties communes) ;
//   - e-mail aux destinataires de la copropriété, sinon ADMIN_EMAIL, réponse directe au déclarant ;
//   - l'échec de l'e-mail n'annule pas le dépôt (email_erreur conservé) ; limites de débit ;
//   - e-mail de confirmation au seul déclarant, dans la langue de la page, sans adresse de réponse ; son échec
//     ou la limite par adresse (clé hachée) n'annulent pas le dépôt ; un seul update final des quatre états ;
//     les variantes d'une même boîte (« + », points Gmail, googlemail.com) partagent la limite.
// Seuls Supabase, le limiteur (un compteur par clé, remis à zéro avant chaque test), le logger et sendEmail
// sont simulés.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => {
  const etat = {
    copropriete: null as null | Record<string, unknown>,
    erreurLecture: null as null | { code: string; message: string },
    erreurInsertion: null as null | { code: string; message: string },
    insertions: [] as Array<Record<string, unknown>>,
    misesAJour: [] as Array<Record<string, unknown>>,
    limites: [] as string[],
    parametresLimites: [] as Array<[string, number | undefined, number | undefined]>,
    refuser: [] as string[],
    compteurs: new Map<string, number>(),
  }
  const from = (table: string) => {
    const q: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order', 'limit']) q[m] = () => q
    q.insert = (ligne: Record<string, unknown>) => { etat.insertions.push({ table, ...ligne }); return q }
    q.update = (ligne: Record<string, unknown>) => { etat.misesAJour.push({ table, ...ligne }); return q }
    q.maybeSingle = async () => (etat.erreurLecture ? { data: null, error: etat.erreurLecture } : { data: etat.copropriete, error: null })
    q.single = async () => (etat.erreurInsertion
      ? { data: null, error: etat.erreurInsertion }
      : { data: { id: 'b1c2d3e4-0000-4000-8000-000000000000', created_at: '2026-11-04T14:05:00.000Z', updated_at: '2026-11-04T14:05:00.000Z' }, error: null })
    q.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(ok, ko)
    return q
  }
  type ResultatEnvoi = { success: boolean; id?: string; error?: string }
  return { etat, from, sendEmail: vi.fn<(charge: unknown) => Promise<ResultatEnvoi>>(async () => ({ success: true, id: 'mail-1' })), loggerError: vi.fn() }
})

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: h.loggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async (cle: string, limite?: number, fenetre?: number) => {
    h.etat.limites.push(cle)
    h.etat.parametresLimites.push([cle, limite, fenetre])
    if (h.etat.refuser.some((prefixe) => cle.startsWith(prefixe))) return false
    // Comme le vrai limiteur dans sa fenêtre : au plus `limite` passages par clé (20 par défaut).
    const passages = (h.etat.compteurs.get(cle) ?? 0) + 1
    h.etat.compteurs.set(cle, passages)
    return passages <= (limite ?? 20)
  }),
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
}))
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: (table: string) => h.from(table) } }))
vi.mock('@/lib/supabase-server-component', () => ({ createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } })) }))
vi.mock('@/lib/auth-helpers', () => ({ getAuthUser: vi.fn(async () => null) }))
vi.mock('@/lib/email', () => ({ sendEmail: h.sendEmail }))

const { POST } = await import('@/app/api/aj-signalement/signalements/route')

const JETON = '0123456789abcdef0123456789abcdef'
const COPRO = {
  id: 'c0000000-0000-4000-8000-000000000001', nom: 'Parc Belle Ombre', adresse: '12 allée des Pins, 13009 Marseille',
  jeton: JETON, emails_destinataires: ['cabinet@example.com'], actif: true, created_at: '2026-11-04T10:00:00.000Z',
}
const CORPS = {
  jeton: JETON, prenom: 'Marie', nom: 'Durand', telephone: '06 12 34 56 78', email: 'Marie.Durand@Example.com',
  batiment: 'B', etage: '4', numLot: '12', estPartieCommune: false, zoneSignalee: 'Escalier',
  typeIntervention: 'Plomberie (fuite, colonne, robinetterie)', description: 'Fuite sous l’évier de la cuisine', priorite: 'urgente', langue: 'fr',
}

function poster(corps: unknown) {
  return POST(new NextRequest('https://vitfix.io/api/aj-signalement/signalements', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corps),
  }))
}

beforeEach(() => {
  h.etat.copropriete = { ...COPRO }
  h.etat.erreurLecture = null
  h.etat.erreurInsertion = null
  h.etat.insertions = []
  h.etat.misesAJour = []
  h.etat.limites = []
  h.etat.parametresLimites = []
  h.etat.refuser = []
  h.etat.compteurs = new Map()
  h.sendEmail.mockClear()
  h.sendEmail.mockResolvedValue({ success: true, id: 'mail-1' })
  h.loggerError.mockClear()
  vi.unstubAllEnvs()
})

describe('validation et copropriété', () => {
  it('400 sans téléphone (coordonnées obligatoires) ; rien n’est écrit ni envoyé', async () => {
    const { telephone: _t, ...sans } = CORPS
    const res = await poster(sans)
    expect(res.status).toBe(400)
    expect(h.etat.insertions).toHaveLength(0)
    expect(h.sendEmail).not.toHaveBeenCalled()
  })

  it('404 quand le jeton ne désigne aucune copropriété active', async () => {
    h.etat.copropriete = null
    const res = await poster(CORPS)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'introuvable' })
  })

  it('503 base_absente tant que la migration n’est pas appliquée (42P01)', async () => {
    h.etat.erreurLecture = { code: '42P01', message: 'relation "signalements_qr_coproprietes" does not exist' }
    const res = await poster(CORPS)
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'base_absente' })
  })

  it('429 au-delà de 5 dépôts par minute et par adresse IP, et au-delà de 30 par copropriété', async () => {
    h.etat.refuser = ['qr_signalement_post_']
    expect((await poster(CORPS)).status).toBe(429)
    h.etat.refuser = ['qr_signalement_copro_']
    expect((await poster(CORPS)).status).toBe(429)
    expect(h.etat.insertions).toHaveLength(0)
  })
})

describe('dépôt', () => {
  it('enregistre le signalement, envoie l’e-mail aux destinataires de la copropriété et répond le numéro', async () => {
    const res = await poster(CORPS)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      signalement: {
        id: 'b1c2d3e4-0000-4000-8000-000000000000', numero: 'B1C2D3E4', creeLe: '2026-11-04T14:05:00.000Z', emailEnvoye: true, confirmationEnvoyee: true,
      },
    })
    expect(h.etat.insertions).toHaveLength(1)
    expect(h.etat.insertions[0]).toMatchObject({
      table: 'signalements_qr', copropriete_id: COPRO.id, prenom: 'Marie', nom: 'Durand', telephone: '06 12 34 56 78',
      email: 'marie.durand@example.com', batiment: 'B', etage: '4', num_lot: '12', est_partie_commune: false, zone_signalee: '',
      type_intervention: 'Plomberie (fuite, colonne, robinetterie)', priorite: 'urgente', statut: 'en_attente', langue: 'fr',
    })
    // L'e-mail de l'administrateur part d'abord, la confirmation au déclarant ensuite.
    expect(h.sendEmail).toHaveBeenCalledTimes(2)
    const email = h.sendEmail.mock.calls[0][0] as { to: string[]; subject: string; replyTo: string; html: string }
    expect(email.to).toEqual(['cabinet@example.com'])
    expect(email.replyTo).toBe('marie.durand@example.com')
    expect(email.subject).toBe('[AJ Signalement] URGENT — Plomberie (fuite, colonne, robinetterie) — Parc Belle Ombre — lot 12')
    expect(email.html).toContain('12 allée des Pins')
    expect(h.etat.misesAJour).toHaveLength(1)
    expect(h.etat.misesAJour[0]).toMatchObject({ table: 'signalements_qr', email_erreur: null, confirmation_erreur: null })
    expect(h.etat.misesAJour[0].email_envoye_le).toEqual(expect.any(String))
    expect(h.etat.misesAJour[0].confirmation_envoyee_le).toEqual(expect.any(String))
  })

  it('parties communes : la zone est gardée', async () => {
    await poster({ ...CORPS, estPartieCommune: true })
    expect(h.etat.insertions[0]).toMatchObject({ est_partie_commune: true, zone_signalee: 'Escalier' })
  })

  it('sans destinataire sur la copropriété : ADMIN_EMAIL et ADMIN_EMAIL_2 reçoivent l’e-mail', async () => {
    vi.stubEnv('ADMIN_EMAIL', 'Admin@Vitfix.io')
    vi.stubEnv('ADMIN_EMAIL_2', 'second@vitfix.io')
    h.etat.copropriete = { ...COPRO, emails_destinataires: [] }
    await poster(CORPS)
    expect((h.sendEmail.mock.calls[0][0] as { to: string[] }).to).toEqual(['admin@vitfix.io', 'second@vitfix.io'])
  })

  it('aucun destinataire du tout : le dépôt est gardé, l’erreur conservée et journalisée ; seul le déclarant reçoit sa confirmation', async () => {
    vi.stubEnv('ADMIN_EMAIL', '')
    vi.stubEnv('ADMIN_EMAIL_2', '')
    h.etat.copropriete = { ...COPRO, emails_destinataires: [] }
    const res = await poster(CORPS)
    expect(res.status).toBe(200)
    expect((await res.json()).signalement.emailEnvoye).toBe(false)
    expect(h.sendEmail).toHaveBeenCalledTimes(1)
    expect((h.sendEmail.mock.calls[0][0] as { to: string[] }).to).toEqual(['marie.durand@example.com'])
    expect(h.etat.misesAJour[0]).toMatchObject({ email_envoye_le: null, email_erreur: 'aucun destinataire configuré' })
    expect(h.loggerError).toHaveBeenCalled()
  })

  it('e-mail refusé par Resend : 200, emailEnvoye false, erreur conservée', async () => {
    h.sendEmail.mockResolvedValue({ success: false, error: 'RESEND_API_KEY not configured' })
    const res = await poster(CORPS)
    expect(res.status).toBe(200)
    expect((await res.json()).signalement).toMatchObject({ emailEnvoye: false, confirmationEnvoyee: false })
    expect(h.etat.misesAJour[0]).toMatchObject({
      email_envoye_le: null, email_erreur: 'RESEND_API_KEY not configured',
      confirmation_envoyee_le: null, confirmation_erreur: 'RESEND_API_KEY not configured',
    })
  })

  it('insertion refusée : 500 journalisé, aucun e-mail', async () => {
    h.etat.erreurInsertion = { code: '23514', message: 'check violation' }
    const res = await poster(CORPS)
    expect(res.status).toBe(500)
    expect(h.sendEmail).not.toHaveBeenCalled()
    expect(h.loggerError).toHaveBeenCalled()
  })
})

describe('confirmation au déclarant', () => {
  type Charge = { to: string[]; subject: string; html: string; replyTo?: string; tags?: Array<{ name: string; value: string }> }
  const charge = (n: number) => h.sendEmail.mock.calls[n][0] as Charge
  const CLE_MARIE = `qr_confirmation_${createHash('sha256').update('marie.durand@example.com').digest('hex')}`
  const versDeclarant = (c: unknown) => (c as Charge).to.includes('marie.durand@example.com')

  it('part après l’e-mail de l’administrateur, au seul déclarant, sans adresse de réponse, en français', async () => {
    await poster(CORPS)
    expect(charge(0).to).toEqual(['cabinet@example.com'])
    const confirmation = charge(1)
    expect(confirmation.to).toEqual(['marie.durand@example.com'])
    expect(confirmation).not.toHaveProperty('replyTo')
    expect(confirmation.subject).toBe('Votre signalement n° B1C2D3E4 a bien été enregistré — Parc Belle Ombre')
    expect(confirmation.html).toContain('4 novembre 2026 à 15:05 (heure de Paris)')
    expect(confirmation.html).not.toContain('cabinet@example.com')
    expect(confirmation.tags).toEqual([{ name: 'type', value: 'aj-signalement-confirmation' }])
  })

  it('page en portugais : confirmation en portugais', async () => {
    await poster({ ...CORPS, langue: 'pt', typeIntervention: 'Canalização (fuga, coluna, torneiras)' })
    const confirmation = charge(1)
    expect(confirmation.subject).toBe('A sua ocorrência n.º B1C2D3E4 foi registada — Parc Belle Ombre')
    expect(confirmation.html).toContain('<html lang="pt">')
    expect(confirmation.html).toContain('Canalização (fuga, coluna, torneiras)')
  })

  it('le contenu saisi est échappé dans la confirmation', async () => {
    await poster({ ...CORPS, description: 'Fuite <img src=x onerror=alert(1)> sous l’évier' })
    expect(charge(1).html).not.toContain('<img')
    expect(charge(1).html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('confirmation refusée par Resend : 200, dépôt et e-mail de l’administrateur intacts, erreur conservée', async () => {
    h.sendEmail.mockImplementation(async (c: unknown) => (versDeclarant(c)
      ? { success: false, error: 'The marie.durand@example.com address bounced' }
      : { success: true, id: 'mail-admin' }))
    const res = await poster(CORPS)
    expect(res.status).toBe(200)
    expect((await res.json()).signalement).toMatchObject({ emailEnvoye: true, confirmationEnvoyee: false })
    expect(h.etat.insertions).toHaveLength(1)
    expect(h.etat.misesAJour).toHaveLength(1)
    expect(h.etat.misesAJour[0]).toMatchObject({ email_erreur: null, confirmation_envoyee_le: null, confirmation_erreur: 'The marie.durand@example.com address bounced' })
    expect(h.etat.misesAJour[0].email_envoye_le).toEqual(expect.any(String))
    expect(h.loggerError).toHaveBeenCalled()
    // L'adresse citée par Resend est masquée dans ce que la route écrit au logger (la ligne garde l'erreur brute pour
    // le super admin). sendEmail est simulé ici : sa propre console.error (lib/email.ts) n'est pas couverte.
    expect(JSON.stringify(h.loggerError.mock.calls)).not.toContain('marie.durand@example.com')
  })

  it('exception pendant la confirmation : le dépôt reste acquis (200) et l’erreur est conservée', async () => {
    h.sendEmail.mockImplementation(async (c: unknown) => {
      if (versDeclarant(c)) throw new Error('boom')
      return { success: true, id: 'mail-admin' }
    })
    const res = await poster(CORPS)
    expect(res.status).toBe(200)
    expect((await res.json()).signalement).toMatchObject({ emailEnvoye: true, confirmationEnvoyee: false })
    expect(h.etat.misesAJour[0]).toMatchObject({ confirmation_envoyee_le: null, confirmation_erreur: expect.any(String) })
  })

  it('limite par adresse (3 par heure, clé hachée) atteinte : pas de confirmation, dépôt et e-mail admin gardés, raison conservée', async () => {
    h.etat.refuser = ['qr_confirmation_']
    const res = await poster(CORPS)
    expect(res.status).toBe(200)
    expect((await res.json()).signalement).toMatchObject({ emailEnvoye: true, confirmationEnvoyee: false })
    expect(h.sendEmail).toHaveBeenCalledTimes(1)
    expect(charge(0).to).toEqual(['cabinet@example.com'])
    expect(h.etat.parametresLimites).toContainEqual([CLE_MARIE, 3, 3_600_000])
    expect(h.etat.limites.some((cle) => cle.includes('@') || cle.includes('marie'))).toBe(false)
    expect(h.etat.misesAJour[0]).toMatchObject({ confirmation_envoyee_le: null, confirmation_erreur: expect.stringContaining('limite') })
  })

  it('l’adresse saisie en majuscules donne la même clé de limite', async () => {
    await poster({ ...CORPS, email: 'MARIE.DURAND@EXAMPLE.COM' })
    expect(h.etat.limites).toContain(CLE_MARIE)
  })

  it.each([
    ['sous-adresses « + »', ['victime@example.com', 'victime+1@example.com', 'victime+2@example.com', 'victime+3@example.com']],
    ['points et googlemail.com chez Gmail', ['victime@gmail.com', 'v.ictime@gmail.com', 'victime+1@gmail.com', 'vic.time@googlemail.com']],
  ])('variantes d’une même boîte (%s) : le 4e dépôt est enregistré sans confirmation', async (_cas, variantes) => {
    const confirmees: boolean[] = []
    for (const email of variantes) {
      const res = await poster({ ...CORPS, email })
      expect(res.status).toBe(200)
      confirmees.push((await res.json()).signalement.confirmationEnvoyee)
    }
    expect(confirmees).toEqual([true, true, true, false])
    expect(h.etat.insertions).toHaveLength(4)
    // Chaque confirmation part à l'adresse saisie : la forme canonique sert seulement à la clé du limiteur.
    const envoyees = h.sendEmail.mock.calls.map((c) => c[0] as Charge).filter((c) => c.tags?.[0]?.value === 'aj-signalement-confirmation')
    expect(envoyees.map((c) => c.to)).toEqual(variantes.slice(0, 3).map((v) => [v]))
    expect(h.etat.misesAJour[3]).toMatchObject({ confirmation_envoyee_le: null, confirmation_erreur: expect.stringContaining('limite') })
  })
})
