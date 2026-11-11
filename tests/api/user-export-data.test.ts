// tests/api/user-export-data.test.ts
//
// GET /api/user/export-data (RGPD art. 20, libre-service). PR 2, lot 6 (SPEC § 2.10) : pour un gestionnaire AJ
// Signalement (rôle gestionnaire_signalement, ou compte relié à une fiche), l'export ajoute une section aj_signalement :
// sa fiche (nom, e-mail, cabinet, dates), ses attributions (copropriété, origine, date) et les lignes du journal des
// 12 derniers mois où il est l'auteur ou le sujet — sans aucune donnée d'une autre personne (ni identifiant, ni nom,
// ni adresse d'un collègue ou du super admin : l'auteur d'une ligne est « vous », « collegue », « cabinet » ou
// « systeme »). L'export est journalisé (gestionnaire.exporte, acteur : lui-même). Aucun autre compte ne change, et la
// section est simplement omise tant que les migrations 20261111 / 20261112 manquent (repli journalisé une fois).
// Données fictives : @exemple.test.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/aj-signalement-base')).baseQr.client }))
vi.mock('@/lib/supabase-server-component', async () => (await import('../helpers/aj-signalement-routes')).mockCookies())
vi.mock('@/lib/auth-helpers', async () => (await import('../helpers/aj-signalement-routes')).mockAuth())
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/aj-signalement-routes')).mockLimites())
vi.mock('@/lib/email', async () => (await import('../helpers/aj-signalement-routes')).mockEmail())
vi.mock('@/lib/logger', async () => (await import('../helpers/aj-signalement-routes')).mockLogger())

const { baseQr, simulerProductionAvant1111Qr, simulerProductionAvant1112Qr } = await import('../helpers/aj-signalement-base')
const { ADMIN_QR, reinitialiserSimulQr, requeteQr, simulQr } = await import('../helpers/aj-signalement-routes')
const A = await import('../helpers/aj-signalement-acces')
const { GET } = await import('@/app/api/user/export-data/route')
const { reinitialiserReplisQr } = await import('@/lib/aj-signalement/serveur')

const CLIENT = { id: '0c000000-0000-4000-8000-000000000001', email: 'client@exemple.test', app_metadata: { role: 'client' } }
/** Clés de l'export tel qu'il est rendu à tout compte avant la PR 2. */
const CLES_EXPORT = [
  'artisan_photos', 'artisan_profile', 'bookings_as_artisan', 'bookings_as_client', 'client_profile', 'devis', 'exported_at', 'factures',
  'messages', 'pt_fiscal_documents', 'pt_fiscal_series', 'rgpd_article', 'services', 'subscription', 'syndic', 'user',
]
const trie = (v: string[]) => [...v].sort((a, b) => a.localeCompare(b))
const ilYA = (jours: number) => new Date(Date.now() - jours * 24 * 3600 * 1000).toISOString()

const exporter = async () => {
  const res = await GET(requeteQr('/api/user/export-data'))
  return { status: res.status, corps: JSON.parse(await res.text()) as Record<string, unknown> }
}
const avertissementsMigration = () => simulQr.logger.warn.mock.calls.filter((c) => /1[12]\/11\/2026/.test(String(c[0])))

beforeEach(() => {
  reinitialiserSimulQr()
  reinitialiserReplisQr()
  baseQr.reinitialiser()
  A.poserJeuAccesQr()
  baseQr.etat.tables.signalements_qr_journal = [
    // Lui, auteur : changement de statut d'un signalement de sa copropriété.
    { id: 1, cabinet_id: A.CAB, acteur_id: A.U1, acteur_profil: 'gestionnaire', acteur_gestionnaire_id: A.G1, action: 'signalement.statut', copropriete_id: A.C1, gestionnaire_id: null, signalement_id: A.S1, operation_id: null, champs: ['statut'], details: { de: 'en_attente', vers: 'en_cours' }, created_at: ilYA(3) },
    // Lui, sujet : attribution par le super admin.
    { id: 2, cabinet_id: A.CAB, acteur_id: ADMIN_QR.id, acteur_profil: 'super_admin', acteur_gestionnaire_id: null, action: 'attribution.ajoutee', copropriete_id: A.C1, gestionnaire_id: A.G1, signalement_id: null, operation_id: null, champs: [], details: {}, created_at: ilYA(5) },
    // Un collègue l'a cité (sujet) : l'auteur reste anonyme.
    { id: 3, cabinet_id: A.CAB, acteur_id: A.U2, acteur_profil: 'gestionnaire', acteur_gestionnaire_id: A.G2, action: 'attribution.retiree', copropriete_id: A.C2, gestionnaire_id: A.G1, signalement_id: null, operation_id: null, champs: [], details: {}, created_at: ilYA(4) },
    // Un collègue seul : jamais exporté.
    { id: 4, cabinet_id: A.CAB, acteur_id: A.U2, acteur_profil: 'gestionnaire', acteur_gestionnaire_id: A.G2, action: 'copropriete.modifiee', copropriete_id: A.C2, gestionnaire_id: A.G2, signalement_id: null, operation_id: null, champs: ['ville'], details: {}, created_at: ilYA(2) },
    // Plus de 12 mois : hors export.
    { id: 5, cabinet_id: A.CAB, acteur_id: A.U1, acteur_profil: 'gestionnaire', acteur_gestionnaire_id: A.G1, action: 'copropriete.modifiee', copropriete_id: A.C1, gestionnaire_id: null, signalement_id: null, operation_id: null, champs: ['nom'], details: {}, created_at: ilYA(400) },
  ]
})

describe('compte d’un gestionnaire : section aj_signalement', () => {
  beforeEach(() => A.connecterQr(A.COMPTE_G1))

  it('fiche, attributions et journal (12 mois, auteur ou sujet), sans donnée d’une autre personne', async () => {
    const { status, corps } = await exporter()
    expect(status).toBe(200)
    expect(trie(Object.keys(corps))).toEqual(trie([...CLES_EXPORT, 'aj_signalement']))
    const section = corps.aj_signalement as Record<string, unknown>
    expect(section.fiche).toEqual({
      nom: 'Marie Exemple', email: A.EMAIL_G1, cabinet: 'Cabinet Exemple', actif: true, creeLe: '2026-11-05T08:00:00+00:00',
      adresseConfirmeeLe: '2026-11-05T09:00:00+00:00', accesOuvertLe: '2026-11-06T09:00:00+00:00', desactiveLe: null,
      connexionBloqueeLe: null, effacementDemandeLe: null,
    })
    expect(section.attributions).toEqual([{ copropriete: 'Résidence Une', origine: 'super_admin', depuis: '2026-11-05T09:00:00+00:00' }])
    const lignes = section.journal as Array<Record<string, unknown>>
    expect(lignes.map((l) => [l.action, l.auteur, l.copropriete])).toEqual([
      ['attribution.ajoutee', 'cabinet', 'Résidence Une'],
      ['attribution.retiree', 'collegue', 'Résidence Deux'],
      ['signalement.statut', 'vous', 'Résidence Une'],
    ])
    expect(lignes[2]).toEqual({ date: expect.any(String), action: 'signalement.statut', auteur: 'vous', copropriete: 'Résidence Une', champs: ['statut'] })
    const texte = JSON.stringify(section)
    for (const autre of [A.U2, A.G2, A.EMAIL_G2, 'Paul', ADMIN_QR.id, A.G1, A.U1, A.CAB]) expect(texte).not.toContain(autre)
  })

  it('l’export est journalisé (gestionnaire.exporte, acteur : lui-même)', async () => {
    await exporter()
    expect(baseQr.table('signalements_qr_journal').filter((l) => l.action === 'gestionnaire.exporte')).toEqual([expect.objectContaining({
      cabinet_id: A.CAB, acteur_id: A.U1, acteur_profil: 'gestionnaire', acteur_gestionnaire_id: A.G1, gestionnaire_id: A.G1,
    })])
  })

  it('compte relié à une fiche sans le rôle : section aussi', async () => {
    A.connecterQr({ id: A.U2, email: A.EMAIL_G2, app_metadata: { role: 'client' } })
    const { corps } = await exporter()
    expect((corps.aj_signalement as { fiche: { nom: string } }).fiche.nom).toBe('Paul Collègue')
  })

  it.each([
    ['migration 20261112 absente', () => simulerProductionAvant1112Qr()],
    ['migrations 20261111 et 20261112 absentes', () => { simulerProductionAvant1111Qr(); simulerProductionAvant1112Qr() }],
  ])('%s : 200, section omise, repli journalisé une fois', async (_cas, simuler) => {
    simuler()
    for (let i = 0; i < 2; i += 1) {
      const { status, corps } = await exporter()
      expect(status).toBe(200)
      expect(trie(Object.keys(corps))).toEqual(CLES_EXPORT)
    }
    expect(avertissementsMigration()).toHaveLength(1)
    expect(baseQr.etat.ecritures.filter((e) => e.table.startsWith('signalements_qr'))).toEqual([])
  })

  it('lecture en panne : 200, section omise (journal serveur), rien d’autre ne change', async () => {
    baseQr.etat.erreursPonctuelles.signalements_qr_gestionnaires = { code: 'XX000', message: 'panne' }
    const { status, corps } = await exporter()
    expect(status).toBe(200)
    expect(trie(Object.keys(corps))).toEqual(CLES_EXPORT)
    expect(simulQr.logger.warn).toHaveBeenCalled()
  })
})

describe('autres comptes : export inchangé', () => {
  it('compte client : aucune section aj_signalement, aucune ligne de journal AJ', async () => {
    A.connecterQr(CLIENT)
    const { status, corps } = await exporter()
    expect(status).toBe(200)
    expect(trie(Object.keys(corps))).toEqual(CLES_EXPORT)
    expect(baseQr.table('signalements_qr_journal').filter((l) => l.action === 'gestionnaire.exporte')).toEqual([])
  })
})
