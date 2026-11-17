// @vitest-environment node
// tests/api/cron-referral-emails.test.ts — GET /api/cron/referral (cron quotidien de .github/workflows/crons.yml) :
// e-mails de récompense et de rappel du parrainage.
//
// Défaut corrigé : les deux e-mails relisaient les fiches avec first_name, colonne absente de profiles_artisan en
// production (relevé du 17/11/2026). PostgREST refusait toute la lecture : aucun e-mail ne partait, et le rappel était
// pourtant marqué envoyé, journalisé (rappel_envoye) et compté.
// Faux client (tests/helpers/faux-postgrest.ts) : colonnes de production ; referrals et referral_risk_log réduites aux
// colonnes que la route lit ou écrit, toutes vérifiées en production le 17/11/2026. Horloge figée.

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import type { FauxPostgrest } from '../helpers/faux-postgrest'
import { COLONNES_PROFILES_ARTISAN, creerFauxPostgrest } from '../helpers/faux-postgrest'

const h = vi.hoisted(() => ({
  base: null as FauxPostgrest | null,
  distribuer: vi.fn(),
  recompense: vi.fn(),
  rappel: vi.fn(),
  journal: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/logger', () => ({ logger: h.journal }))
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: (table: string) => h.base?.from(table) } }))
vi.mock('@/lib/referral', () => ({ distributeReferralReward: (id: string) => h.distribuer(id) }))
vi.mock('@/lib/email-referral', () => ({
  sendReferralRewardConfirmed: (p: unknown) => h.recompense(p),
  sendReferralReminderFilleul: (p: unknown) => h.rappel(p),
}))

vi.stubEnv('CRON_SECRET', 'secret-cron')
const { GET } = await import('@/app/api/cron/referral/route')

// Nuit du cron (02:00 UTC) : seule la date est simulée, les promesses et minuteurs restent réels
vi.useFakeTimers({ toFake: ['Date'] })
vi.setSystemTime(new Date('2026-11-17T02:00:00.000Z'))

afterAll(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

const COLONNES_REFERRALS = new Set([
  'id', 'parrain_id', 'filleul_id', 'code', 'statut', 'date_fin_periode_verification', 'en_revue_manuelle', 'risk_score',
  'date_inscription', 'rappel_envoye', 'updated_at',
])
const COLONNES_REFERRAL_RISK_LOG = new Set(['referral_id', 'artisan_id', 'type_evenement'])

const JOUR = 24 * 60 * 60 * 1000
const ilYa = (ms: number) => new Date(Date.now() - ms).toISOString()

async function lancerCron() {
  const res = await GET(new NextRequest('https://vitfix.test/api/cron/referral', {
    headers: { authorization: 'Bearer secret-cron' },
  }))
  return { status: res.status, json: await res.json() as Record<string, unknown> }
}

const base = () => h.base as FauxPostgrest
const parrainage = (id: string) => base().tables.referrals.find((r) => r.id === id) as Record<string, unknown>

beforeEach(() => {
  h.base = creerFauxPostgrest({
    profiles_artisan: COLONNES_PROFILES_ARTISAN,
    referrals: COLONNES_REFERRALS,
    referral_risk_log: COLONNES_REFERRAL_RISK_LOG,
  })
  base().tables.profiles_artisan.push(
    { id: 'parrain-1', email: 'parrain@exemple.fr', company_name: 'Plomberie Parrain', total_parrainages_reussis: 2, referral_code: 'PARRAIN1' },
    { id: 'filleul-1', email: 'filleul@exemple.fr', company_name: 'Électricité Filleul', total_parrainages_reussis: 0, referral_code: 'FILLEUL1' },
    { id: 'filleul-2', email: 'filleul2@exemple.fr', company_name: 'Peinture Filleul', total_parrainages_reussis: 0, referral_code: 'FILLEUL2' },
    { id: 'parrain-sans-adresse', email: null, company_name: 'Maçonnerie Sans Adresse', total_parrainages_reussis: 0, referral_code: 'SANSADR' },
  )
  for (const f of [h.distribuer, h.recompense, h.rappel, ...Object.values(h.journal)]) f.mockReset()
  h.distribuer.mockResolvedValue('distributed')
  h.recompense.mockResolvedValue({ success: true, id: 'courriel-1' })
  h.rappel.mockResolvedValue({ success: true, id: 'courriel-2' })
})

/** Parrainage dont la période de vérification (J+7) est passée : prêt pour la récompense. */
const pretPourRecompense = (champs: Record<string, unknown> = {}) => ({
  id: 'ref-recompense', parrain_id: 'parrain-1', filleul_id: 'filleul-1', code: 'PARRAIN1', statut: 'paiement_valide',
  date_fin_periode_verification: ilYa(JOUR), en_revue_manuelle: false, risk_score: 0, date_inscription: ilYa(10 * JOUR),
  rappel_envoye: false, updated_at: null, ...champs,
})

/** Filleul inscrit il y a sept jours et demi, sans abonnement : son parrain reçoit un rappel. */
const filleulInactif = (champs: Record<string, unknown> = {}) => ({
  id: 'ref-rappel', parrain_id: 'parrain-1', filleul_id: 'filleul-2', code: 'PARRAIN1', statut: 'inscrit',
  date_fin_periode_verification: null, en_revue_manuelle: false, risk_score: 0, date_inscription: ilYa(7.5 * JOUR),
  rappel_envoye: false, updated_at: null, ...champs,
})

describe('Cron du parrainage : e-mails lus avec les colonnes réelles des fiches', () => {
  it('récompense distribuée : l’e-mail part au parrain, aux noms des entreprises', async () => {
    base().tables.referrals.push(pretPourRecompense())

    const { status, json } = await lancerCron()

    expect(status).toBe(200)
    expect(json).toMatchObject({ success: true, distributed: 1 })
    expect(h.recompense).toHaveBeenCalledTimes(1)
    expect(h.recompense).toHaveBeenCalledWith({
      parrainEmail: 'parrain@exemple.fr',
      parrainName: 'Plomberie Parrain',
      filleulName: 'Électricité Filleul',
      totalParrainages: 2,
      referralCode: 'PARRAIN1',
    })
    expect(base().requetes.filter((r) => r.erreur)).toEqual([])
  })

  it('filleul inactif : le rappel part, puis il est marqué envoyé, journalisé et compté', async () => {
    base().tables.referrals.push(filleulInactif())

    const { status, json } = await lancerCron()

    expect(status).toBe(200)
    expect(json).toMatchObject({ success: true, reminders_sent: 1, reminders_failed: 0 })
    expect(h.rappel).toHaveBeenCalledWith({
      parrainEmail: 'parrain@exemple.fr',
      parrainName: 'Plomberie Parrain',
      filleulName: 'Peinture Filleul',
      referralCode: 'PARRAIN1',
    })
    expect(parrainage('ref-rappel').rappel_envoye).toBe(true)
    expect(base().tables.referral_risk_log).toEqual([
      { referral_id: 'ref-rappel', artisan_id: 'parrain-1', type_evenement: 'rappel_envoye' },
    ])
    expect(base().requetes.filter((r) => r.erreur)).toEqual([])
  })

  it('rappel refusé par l’envoi : rien n’est marqué ni journalisé, il est compté en échec', async () => {
    base().tables.referrals.push(filleulInactif())
    h.rappel.mockResolvedValue({ success: false, error: 'Resend indisponible' })

    const { json } = await lancerCron()

    expect(json).toMatchObject({ reminders_sent: 0, reminders_failed: 1 })
    expect(parrainage('ref-rappel').rappel_envoye).toBe(false)
    expect(base().tables.referral_risk_log).toEqual([])
    expect(h.journal.warn).toHaveBeenCalledWith('[cron/referral] e-mail de rappel non envoyé', expect.objectContaining({ parrainId: 'parrain-1' }))
  })

  it('parrain sans adresse : aucun rappel, rien n’est marqué', async () => {
    base().tables.referrals.push(filleulInactif({ parrain_id: 'parrain-sans-adresse' }))

    const { json } = await lancerCron()

    expect(h.rappel).not.toHaveBeenCalled()
    expect(json).toMatchObject({ reminders_sent: 0, reminders_failed: 1 })
    expect(parrainage('ref-rappel').rappel_envoye).toBe(false)
  })

  it('fiche du parrain illisible : erreur journalisée, aucun rappel marqué', async () => {
    base().tables.referrals.push(filleulInactif({ parrain_id: 'parrain-disparu' }))

    const { json } = await lancerCron()

    expect(h.rappel).not.toHaveBeenCalled()
    expect(json).toMatchObject({ reminders_sent: 0, reminders_failed: 1 })
    expect(h.journal.error).toHaveBeenCalledWith('[cron/referral] fiche du parrain illisible', expect.objectContaining({ parrainId: 'parrain-disparu' }))
  })

  it('fiche du filleul absente : l’e-mail part avec un nom générique', async () => {
    base().tables.referrals.push(pretPourRecompense({ filleul_id: 'filleul-disparu' }))

    await lancerCron()

    expect(h.recompense).toHaveBeenCalledWith(expect.objectContaining({ filleulName: 'Un artisan', parrainName: 'Plomberie Parrain' }))
  })

  it('lectures des parrainages en panne : ce n’est pas une liste vide, les erreurs sont journalisées et comptées', async () => {
    base().tables.referrals.push(pretPourRecompense(), filleulInactif())
    base().pannes.select = { code: '57014', message: 'canceling statement due to statement timeout' }

    const { status, json } = await lancerCron()

    expect(status).toBe(200)
    expect(json).toMatchObject({ errors: 2, distributed: 0, reminders_sent: 0 })
    expect(h.journal.error).toHaveBeenCalledWith('[cron/referral] parrainages à récompenser illisibles', expect.any(Object))
    expect(h.journal.error).toHaveBeenCalledWith('[cron/referral] parrainages à relancer illisibles', expect.any(Object))
  })

  it('e-mail de récompense refusé par l’envoi : avertissement journalisé, la récompense reste distribuée', async () => {
    base().tables.referrals.push(pretPourRecompense())
    h.recompense.mockResolvedValue({ success: false, error: 'Resend indisponible' })

    const { json } = await lancerCron()

    expect(json).toMatchObject({ distributed: 1 })
    expect(h.journal.warn).toHaveBeenCalledWith('[cron/referral] e-mail de récompense non envoyé', expect.objectContaining({ parrainId: 'parrain-1' }))
  })

  it('rappel parti mais journalisation refusée : erreur journalisée, le rappel reste marqué et compté', async () => {
    base().tables.referrals.push(filleulInactif())
    base().pannes.insert = { code: '57014', message: 'canceling statement due to statement timeout' }

    const { json } = await lancerCron()

    expect(json).toMatchObject({ reminders_sent: 1, reminders_failed: 0 })
    expect(parrainage('ref-rappel').rappel_envoye).toBe(true)
    expect(h.journal.error).toHaveBeenCalledWith('[cron/referral] rappel envoyé mais non journalisé', expect.objectContaining({ referralId: 'ref-rappel' }))
  })

  it('rappel parti mais marquage refusé : erreur journalisée, le rappel compte comme envoyé', async () => {
    base().tables.referrals.push(filleulInactif())
    base().pannes.update = { code: '57014', message: 'canceling statement due to statement timeout' }

    const { json } = await lancerCron()

    expect(h.rappel).toHaveBeenCalledTimes(1)
    expect(json).toMatchObject({ reminders_sent: 1, reminders_failed: 0 })
    expect(h.journal.error).toHaveBeenCalledWith('[cron/referral] rappel envoyé mais non marqué', expect.objectContaining({ referralId: 'ref-rappel' }))
  })
})
