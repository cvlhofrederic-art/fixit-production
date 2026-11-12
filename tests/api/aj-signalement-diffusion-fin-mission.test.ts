// tests/api/aj-signalement-diffusion-fin-mission.test.ts
//
// AJ Signalement, PR 3, lot 8 — RELECTURE de la fin de mission prévue (décision H7 de Hugo du 11/11/2026, cahier § 3.5,
// § 7.4) : la date écrite par la fiche de la copropriété (PATCH /coproprietes/[id], diffusionFinGestionLe, super admin)
// n'était relue par aucune route. D-R1 (GET /coproprietes/[id]/diffusions/valeurs) la rend désormais (finMissionLe) :
// la fiche de la copropriété la lit pour l'afficher, la fenêtre « Diffuser un message » pour la rappeler. Une date, et
// rien d'autre (ni adresse, ni « @ »). Migration 20261113 absente : 503 base_absente, comme avant. Aucune donnée réelle.

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/aj-signalement-base')).baseQr.client }))
vi.mock('@/lib/supabase-server-component', async () => (await import('../helpers/aj-signalement-routes')).mockCookies())
vi.mock('@/lib/auth-helpers', async () => (await import('../helpers/aj-signalement-routes')).mockAuth())
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/aj-signalement-routes')).mockLimites())
vi.mock('@/lib/email', async () => (await import('../helpers/aj-signalement-routes')).mockEmail())
vi.mock('@/lib/logger', async () => (await import('../helpers/aj-signalement-routes')).mockLogger())

const { baseQr } = await import('../helpers/aj-signalement-base')
const { contexteQr, reinitialiserSimulQr, requeteQr } = await import('../helpers/aj-signalement-routes')
const { GET: VALEURS } = await import('@/app/api/aj-signalement/coproprietes/[id]/diffusions/valeurs/route')
const { PATCH: MODIFIER } = await import('@/app/api/aj-signalement/coproprietes/[id]/route')
const { reinitialiserReplisQr } = await import('@/lib/aj-signalement/serveur')

const CAB = 'ca000000-0000-4000-8000-000000000001'
const COPRO = 'c0000000-0000-4000-8000-000000000001'
const JETON = '0123456789abcdef0123456789abcdef'

const valeurs = () => VALEURS(requeteQr(`/api/aj-signalement/coproprietes/${COPRO}/diffusions/valeurs`), contexteQr(COPRO))
const modifier = (corps: unknown) => MODIFIER(requeteQr(`/api/aj-signalement/coproprietes/${COPRO}`, 'PATCH', corps), contexteQr(COPRO))

beforeEach(() => {
  reinitialiserSimulQr()
  reinitialiserReplisQr()
  baseQr.reinitialiser()
  const t = baseQr.etat.tables
  t.signalements_qr_cabinets = [{
    id: CAB, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple', langue: 'fr', diffusion_contact_email: 'contact@cabinet-exemple.test',
    diffusion_politique_url: 'https://cabinet-exemple.test/confidentialite', diffusion_politique_verifiee_le: '2026-11-01T09:00:00+00:00',
    diffusion_contrat_reference: 'Contrat exemple v1', diffusion_contrat_signe_le: '2026-11-01', diffusion_telephones: [],
    diffusion_activee_le: '2026-11-02T09:00:00+00:00',
  }]
  t.signalements_qr_domaines_autorises = [{ cabinet_id: CAB, domaine: 'exemple.test' }]
  t.signalements_qr_coproprietes = [{
    id: COPRO, nom: 'Résidence Exemple', adresse: '1 rue Exemple', jeton: JETON, emails_destinataires: [], actif: true,
    created_at: '2026-11-10T09:00:00+00:00', cabinet_id: CAB, code_postal: '13001', ville: 'Marseille', immatriculation: null,
    reference_cabinet: null, batiments: [], attribuee_a_tous: false, cree_par_gestionnaire_id: null, cle_nom: 'exemple',
    diffusion_fin_gestion_le: null,
  }]
  t.signalements_qr_gestionnaires = []
  t.signalements_qr_attributions = []
  t.signalements_qr = []
  t.signalements_qr_journal = []
  const f = baseQr.etat.fonctions
  f.signalements_qr_diffusion_valeurs = () => ({ data: [{ batiment: 'A', etage: '1', nb_adresses: 2 }] })
  f.signalements_qr_diffusions_mois = () => ({ data: [{ nb: 0, dernier_le: null }] })
  f.signalements_qr_diffusion_raison_inactive = () => ({ data: null })
  f.signalements_qr_diffusion_apercu = () => ({ data: [{ nb_destinataires: 0, nb_exclus_opposition: 0, possible: true, raison: null, instant: '2026-11-12T10:00:00+00:00' }] })
})

describe('D-R1 relit la fin de mission prévue (H7)', () => {
  it('aucune date saisie : finMissionLe null', async () => {
    const res = await valeurs()
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ possible: true, finMissionLe: null })
  })

  it('date écrite par la fiche (PATCH), puis RELUE par D-R1 telle quelle (AAAA-MM-JJ) ; effacée, relue null', async () => {
    expect((await modifier({ diffusionFinGestionLe: '2026-12-31' })).status).toBe(200)
    const corps = await (await valeurs()).json()
    expect(corps.finMissionLe).toBe('2026-12-31')
    expect(JSON.stringify(corps)).not.toContain('@')

    expect((await modifier({ diffusionFinGestionLe: null })).status).toBe(200)
    expect((await (await valeurs()).json()).finMissionLe).toBeNull()
  })

  it('valeur de la base hors forme (horodatage) : seul le jour AAAA-MM-JJ est rendu ; autre chose : null', async () => {
    baseQr.table('signalements_qr_coproprietes')[0].diffusion_fin_gestion_le = '2027-01-15T00:00:00+00:00'
    expect((await (await valeurs()).json()).finMissionLe).toBe('2027-01-15')
    baseQr.table('signalements_qr_coproprietes')[0].diffusion_fin_gestion_le = 'demain'
    expect((await (await valeurs()).json()).finMissionLe).toBeNull()
  })

  it('migration 20261113 absente (colonne de fin de mission inconnue) : 503 base_absente', async () => {
    baseQr.etat.colonnesAbsentes = { signalements_qr_coproprietes: ['diffusion_fin_gestion_le'] }
    const res = await valeurs()
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'base_absente' })
  })
})
