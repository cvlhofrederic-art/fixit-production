// tests/api/aj-signalement-replis-journalises.test.ts
//
// Replis d'une migration absente : chacun journalisé UNE FOIS par isolat (Worker) et par opération, sans donnée
// personnelle ni valeur saisie (règle de CLAUDE.md : jamais de repli muet ; la production n'est pas noyée pour autant).
//   - cabinet de la copropriété (journal d'un changement de statut), colonne cabinet_id absente : cabinet null ;
//   - création de copropriété dont le corps porte des champs du 11/11/2026 : 503 base_absente ;
//   - modification de copropriété d'un champ du 11/11/2026 : 503 base_absente ;
//   - signalements d'une copropriété, colonnes du 06/11/2026 absentes : relecture complète.
// Données fictives (@exemple.test, @externe.test, « Résidence Exemple »).

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/aj-signalement-base')).baseQr.client }))
vi.mock('@/lib/supabase-server-component', async () => (await import('../helpers/aj-signalement-routes')).mockCookies())
vi.mock('@/lib/auth-helpers', async () => (await import('../helpers/aj-signalement-routes')).mockAuth())
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/aj-signalement-routes')).mockLimites())
vi.mock('@/lib/email', async () => (await import('../helpers/aj-signalement-routes')).mockEmail())
vi.mock('@/lib/logger', async () => (await import('../helpers/aj-signalement-routes')).mockLogger())

const { baseQr, simulerProductionAvant1111Qr } = await import('../helpers/aj-signalement-base')
const { contexteQr, reinitialiserSimulQr, requeteQr, simulQr, texteJournalServeurQr } = await import('../helpers/aj-signalement-routes')
const { PATCH: PATCH_STATUT } = await import('@/app/api/aj-signalement/signalements/[id]/route')
const { POST: CREER } = await import('@/app/api/aj-signalement/coproprietes/route')
const { PATCH: MODIFIER } = await import('@/app/api/aj-signalement/coproprietes/[id]/route')
const { GET: PAGE } = await import('@/app/api/aj-signalement/coproprietes/[id]/signalements/route')
const { reinitialiserReplisQr, MIGRATION_GESTIONNAIRES_QR, MIGRATION_CONFIRMATION_QR, MIGRATION_GEOLOC_QUALITE_QR } = await import('@/lib/aj-signalement/serveur')

const CAB = 'ca000000-0000-4000-8000-000000000001'
const COPRO = 'c0000000-0000-4000-8000-000000000001'
const S = '5f2c9a1e-1111-4222-8333-444444444444'
const COLONNES_0611 = ['confirmation_envoyee_le', 'confirmation_erreur', 'qualite_declarant', 'adresse_proposee', 'signalement_lie_id']

beforeEach(() => {
  reinitialiserSimulQr()
  reinitialiserReplisQr()
  baseQr.reinitialiser()
  const t = baseQr.etat.tables
  t.signalements_qr_cabinets = [{ id: CAB, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple', langue: 'fr' }]
  t.signalements_qr_coproprietes = [{
    id: COPRO, nom: 'Résidence Exemple', adresse: '1 rue Exemple', jeton: '0123456789abcdef0123456789abcdef', emails_destinataires: ['cs@externe.test'],
    actif: true, created_at: '2026-11-10T09:00:00+00:00', cabinet_id: CAB, code_postal: '13001', ville: 'Marseille', immatriculation: null,
    reference_cabinet: null, batiments: [], attribuee_a_tous: false, cree_par_gestionnaire_id: null, cle_nom: 'exemple',
  }]
  t.signalements_qr = [{
    id: S, copropriete_id: COPRO, prenom: 'Prénom', nom: 'Déclarant', telephone: '0600000000', email: 'declarant@exemple.test', batiment: 'A',
    etage: '1', num_lot: '7', est_partie_commune: false, zone_signalee: '', type_intervention: 'Plomberie', description: 'Fuite d’eau au plafond',
    priorite: 'normale', statut: 'en_attente', langue: 'fr', email_envoye_le: null, email_erreur: null, confirmation_envoyee_le: null,
    confirmation_erreur: null, qualite_declarant: 'locataire', adresse_proposee: null, signalement_lie_id: null,
    created_at: '2026-11-10T09:00:00+00:00', updated_at: '2026-11-10T09:00:00+00:00',
  }]
  t.signalements_qr_journal = []
})

/** Avertissements du journal serveur dont le texte contient ce motif. */
const avertissements = (motif: string) => simulQr.logger.warn.mock.calls.filter((c) => String(c[0]).includes(motif))
const changerStatut = (statut: string) => PATCH_STATUT(requeteQr(`/api/aj-signalement/signalements/${S}`, 'PATCH', { statut }), contexteQr(S))
const creer = (corps: unknown) => CREER(requeteQr('/api/aj-signalement/coproprietes', 'POST', corps))
const modifier = (corps: unknown) => MODIFIER(requeteQr(`/api/aj-signalement/coproprietes/${COPRO}`, 'PATCH', corps), contexteQr(COPRO))
const page = () => PAGE(requeteQr(`/api/aj-signalement/coproprietes/${COPRO}/signalements?statut=tous`), contexteQr(COPRO))

describe('replis journalisés une fois par isolat et par opération', () => {
  it('changement de statut, colonne cabinet_id absente : journal écrit sans cabinet ; repli « cabinet de la copropriété » journalisé une fois', async () => {
    baseQr.etat.colonnesAbsentes = { signalements_qr_coproprietes: ['cabinet_id'] }
    expect((await changerStatut('en_cours')).status).toBe(200)
    expect((await changerStatut('acceptee')).status).toBe(200)
    expect(baseQr.table('signalements_qr_journal').map((j) => j.cabinet_id)).toEqual([null, null])
    const replis = avertissements('repli (cabinet de la copropriété)')
    expect(replis).toHaveLength(1)
    expect(replis[0]).toEqual(['[AJ SIGNALEMENT] migration du 11/11/2026 absente : repli (cabinet de la copropriété)', { migration: MIGRATION_GESTIONNAIRES_QR, code: '42703' }])
    expect(simulQr.logger.error).not.toHaveBeenCalled()

    // Nouvel isolat : journalisé de nouveau, une fois.
    reinitialiserReplisQr()
    expect((await changerStatut('en_cours')).status).toBe(200)
    expect(avertissements('repli (cabinet de la copropriété)')).toHaveLength(2)
  })

  it('création, corps avec des champs du 11/11 (code postal, ville) : 503 base_absente ; refus journalisé une fois, sans nom, adresse ni valeur', async () => {
    simulerProductionAvant1111Qr(baseQr)
    const premiere = await creer({ nom: 'Villa Exemple', adresse: '2 rue Exemple', codePostal: '13002', emailsDestinataires: ['cs@externe.test'] })
    expect(premiere.status).toBe(503)
    expect(await premiere.json()).toEqual({ error: 'base_absente' })
    expect((await creer({ nom: 'Villa Autre Exemple', ville: 'Aubagne' })).status).toBe(503)
    expect(baseQr.ecrituresDe('signalements_qr_coproprietes', 'insert')).toEqual([])
    const refus = avertissements('repli (création de copropriété refusée, 503)')
    expect(refus).toHaveLength(1)
    expect(refus[0][1]).toEqual({ migration: MIGRATION_GESTIONNAIRES_QR, code: 'PGRST202' })
    expect(simulQr.logger.error).not.toHaveBeenCalled()
    expect(texteJournalServeurQr()).not.toMatch(/Villa|rue Exemple|@externe|13002|Aubagne/)
  })

  it('modification d’un champ du 11/11 (code postal) : 503 base_absente ; refus journalisé une fois, sans valeur', async () => {
    simulerProductionAvant1111Qr(baseQr)
    const premiere = await modifier({ codePostal: '13002' })
    expect(premiere.status).toBe(503)
    expect(await premiere.json()).toEqual({ error: 'base_absente' })
    expect((await modifier({ ville: 'Aubagne' })).status).toBe(503)
    expect(baseQr.ecrituresDe('signalements_qr_coproprietes', 'update')).toEqual([])
    const refus = avertissements('repli (modification de copropriété refusée, 503)')
    expect(refus).toHaveLength(1)
    expect(refus[0][1]).toEqual({ migration: MIGRATION_GESTIONNAIRES_QR, code: 'PGRST204' })
    expect(simulQr.logger.error).not.toHaveBeenCalled()
    expect(texteJournalServeurQr()).not.toMatch(/13002|Aubagne|Résidence|rue Exemple|@externe/)
    // Le corps actuel de l'écran (colonnes d'origine) passe toujours, par son propre repli.
    expect((await modifier({ nom: 'Résidence Exemple Bis' })).status).toBe(200)
  })

  it('signalements d’une copropriété, colonnes du 06/11 absentes : relecture complète, 200 ; repli journalisé une fois, sans donnée de déclarant', async () => {
    baseQr.etat.colonnesAbsentes = { signalements_qr: [...COLONNES_0611] }
    for (const c of COLONNES_0611) delete baseQr.etat.tables.signalements_qr[0][c]
    const premiere = await page()
    expect(premiere.status).toBe(200)
    expect((await premiere.json()).signalements.map((s: { id: string }) => s.id)).toEqual([S])
    expect((await page()).status).toBe(200)
    const replis = avertissements('repli sans les colonnes du 06/11/2026 (signalements d’une copropriété)')
    expect(replis).toHaveLength(1)
    expect(replis[0][1]).toEqual({
      migration: `${MIGRATION_CONFIRMATION_QR} puis ${MIGRATION_GEOLOC_QUALITE_QR}`, code: '42703', message: expect.stringContaining('does not exist'),
    })
    expect(simulQr.logger.error).not.toHaveBeenCalled()
    expect(texteJournalServeurQr()).not.toMatch(/Prénom|Déclarant|declarant@|0600000000|Fuite/)
  })
})
