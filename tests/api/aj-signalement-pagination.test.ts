// tests/api/aj-signalement-pagination.test.ts
//
// Pages de signalements d'une copropriété (P1-R2, GET /coproprietes/[id]/signalements) et du journal (P1-R18,
// GET /journal) : curseur (created_at, id) au format PostgREST « …123456+00:00 », passé TEL QUEL (jamais par
// new Date(), qui tronque aux millisecondes et ferait sauter les lignes créées dans la même milliseconde) ; le
// client le code par URLSearchParams (« + » → « %2B »). Journal : purge 12 mois au plus une fois par jour, noms
// joints pour l'affichage, super admin seul.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/aj-signalement-base')).baseQr.client }))
vi.mock('@/lib/supabase-server-component', async () => (await import('../helpers/aj-signalement-routes')).mockCookies())
vi.mock('@/lib/auth-helpers', async () => (await import('../helpers/aj-signalement-routes')).mockAuth())
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/aj-signalement-routes')).mockLimites())
vi.mock('@/lib/email', async () => (await import('../helpers/aj-signalement-routes')).mockEmail())
vi.mock('@/lib/logger', async () => (await import('../helpers/aj-signalement-routes')).mockLogger())

const { baseQr } = await import('../helpers/aj-signalement-base')
const { ADMIN_QR, contexteQr, reinitialiserSimulQr, requeteQr, simulQr } = await import('../helpers/aj-signalement-routes')
const { GET: PAGE } = await import('@/app/api/aj-signalement/coproprietes/[id]/signalements/route')
const { GET: JOURNAL } = await import('@/app/api/aj-signalement/journal/route')

const COPRO = 'c0000000-0000-4000-8000-000000000001'
const AUTRE = 'c0000000-0000-4000-8000-000000000002'
const G = 'a0000000-0000-4000-8000-000000000001'
const MEME_INSTANT = '2026-11-10T12:00:00.123456+00:00'

const signalement = (id: string, created_at: string, sur: Record<string, unknown> = {}) => ({
  id, copropriete_id: COPRO, prenom: 'Prénom', nom: 'Nom', telephone: '0600000000', email: 'declarant@exemple.test', batiment: 'A', etage: '1',
  num_lot: '1', est_partie_commune: false, zone_signalee: '', type_intervention: 'Plomberie', description: 'Fuite d’eau au plafond',
  priorite: 'normale', statut: 'en_attente', langue: 'fr', email_envoye_le: null, email_erreur: null, confirmation_envoyee_le: null,
  confirmation_erreur: null, qualite_declarant: 'locataire', adresse_proposee: null, signalement_lie_id: null, created_at, updated_at: created_at,
  ...sur,
})

const id = (n: number) => `5f000000-0000-4000-8000-${String(n).padStart(12, '0')}`

beforeEach(() => {
  reinitialiserSimulQr()
  baseQr.reinitialiser()
  baseQr.etat.tables.signalements_qr_coproprietes = [
    { id: COPRO, nom: 'Résidence Exemple', cabinet_id: null },
    { id: AUTRE, nom: 'Autre Exemple', cabinet_id: null },
  ]
  baseQr.etat.tables.signalements_qr = [
    signalement(id(5), '2026-11-10T12:00:01.000000+00:00'),
    // Trois lignes dans la même milliseconde (microsecondes égales) : seul l'id les départage.
    signalement(id(4), MEME_INSTANT),
    signalement(id(3), MEME_INSTANT),
    signalement(id(2), MEME_INSTANT, { statut: 'terminee' }),
    signalement(id(1), '2026-11-10T11:00:00.000000+00:00', { priorite: 'urgente' }),
    signalement(id(9), '2026-11-10T13:00:00.000000+00:00', { copropriete_id: AUTRE }),
  ]
})

const page = (query: string) => PAGE(requeteQr(`/api/aj-signalement/coproprietes/${COPRO}/signalements?${query}`), contexteQr(COPRO))

describe('GET coproprietes/[id]/signalements (P1-R2)', () => {
  it('statut=tous, limite 2 : du plus récent au plus ancien, suite = created_at BRUT et id de la dernière ligne', async () => {
    const res = await page('statut=tous&limite=2')
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    const corps = await res.json()
    expect(corps.signalements.map((s: { id: string }) => s.id)).toEqual([id(5), id(4)])
    expect(corps.suite).toEqual({ avant: MEME_INSTANT, avantId: id(4) })
    expect(corps.signalements[1].creeLe).toBe(MEME_INSTANT)
  })

  it('page 2 depuis un curseur « +00:00 » codé par URLSearchParams : commence juste après, sans sauter les lignes du même instant', async () => {
    const parametres = new URLSearchParams({ statut: 'tous', limite: '2', avant: MEME_INSTANT, avantId: id(4) })
    expect(parametres.toString()).toContain('%2B00%3A00')
    const res = await page(parametres.toString())
    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps.signalements.map((s: { id: string }) => s.id)).toEqual([id(3), id(2)])
    const fin = await (await page(new URLSearchParams({ statut: 'tous', limite: '2', avant: corps.suite.avant, avantId: corps.suite.avantId }).toString())).json()
    expect(fin.signalements.map((s: { id: string }) => s.id)).toEqual([id(1)])
    expect(fin.suite).toBeNull()
  })

  it('« + » laissé brut (lu comme une espace) : 400 ; paramètre inconnu : 400', async () => {
    expect((await page(`avant=2026-11-10T12:00:00.123456+00:00&avantId=${id(4)}`)).status).toBe(400)
    expect((await page('page=2')).status).toBe(400)
  })

  it('filtres : ouverts par défaut (terminée exclue), clos, priorité ; seulement cette copropriété', async () => {
    const ouverts = await (await page('')).json()
    expect(ouverts.signalements.map((s: { id: string }) => s.id)).toEqual([id(5), id(4), id(3), id(1)])
    const clos = await (await page('statut=clos')).json()
    expect(clos.signalements.map((s: { id: string }) => s.id)).toEqual([id(2)])
    const urgents = await (await page('statut=tous&priorite=urgente')).json()
    expect(urgents.signalements.map((s: { id: string }) => s.id)).toEqual([id(1)])
  })

  it('copropriété inconnue : 404 ; limite > 100 : 400 ; sans être super admin : 403', async () => {
    const inconnue = 'c0000000-0000-4000-8000-00000000dead'
    expect((await PAGE(requeteQr(`/api/aj-signalement/coproprietes/${inconnue}/signalements`), contexteQr(inconnue))).status).toBe(404)
    expect((await page('limite=101')).status).toBe(400)
    simulQr.user = { ...ADMIN_QR, app_metadata: { role: 'syndic' } }
    expect((await page('')).status).toBe(403)
  })
})

describe('GET journal (P1-R18)', () => {
  const ligneJournal = (n: number, created_at: string, sur: Record<string, unknown> = {}) => ({
    id: n, cabinet_id: null, acteur_id: ADMIN_QR.id, acteur_profil: 'super_admin', acteur_gestionnaire_id: null, action: 'copropriete.modifiee',
    copropriete_id: COPRO, gestionnaire_id: null, signalement_id: null, operation_id: null, champs: ['nom'], details: {}, created_at, ...sur,
  })

  beforeEach(() => {
    baseQr.etat.tables.signalements_qr_gestionnaires = [{ id: G, nom: 'Marie Exemple', cabinet_id: null }]
    baseQr.etat.tables.signalements_qr_journal = [
      ligneJournal(3, MEME_INSTANT),
      ligneJournal(2, MEME_INSTANT, { action: 'gestionnaire.adresse_confirmee', acteur_profil: 'gestionnaire', acteur_id: null, acteur_gestionnaire_id: G, gestionnaire_id: G, copropriete_id: null, champs: [] }),
      ligneJournal(1, '2026-11-09T08:00:00.000000+00:00'),
    ]
    baseQr.etat.fonctions.signalements_qr_purger_journal = () => ({ data: 0 })
  })

  it('du plus récent au plus ancien ; noms joints ; champs et détails sans valeur ; id BIGINT rendu en chaîne', async () => {
    const res = await JOURNAL(requeteQr('/api/aj-signalement/journal?limite=2'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    const corps = await res.json()
    expect(corps.evenements).toEqual([
      {
        id: '3', creeLe: MEME_INSTANT, cabinetId: null, action: 'copropriete.modifiee', acteur: { profil: 'super_admin', nom: null },
        coproprieteId: COPRO, coproprieteNom: 'Résidence Exemple', gestionnaireId: null, gestionnaireNom: null, signalementId: null,
        operationId: null, champs: ['nom'], details: {},
      },
      expect.objectContaining({ id: '2', acteur: { profil: 'gestionnaire', nom: 'Marie Exemple' }, gestionnaireNom: 'Marie Exemple' }),
    ])
    expect(corps.suite).toEqual({ avant: MEME_INSTANT, avantId: '2' })
  })

  it('page suivante : curseur brut, sans sauter la ligne du même instant', async () => {
    const parametres = new URLSearchParams({ limite: '1', avant: MEME_INSTANT, avantId: '3' })
    const corps = await (await JOURNAL(requeteQr(`/api/aj-signalement/journal?${parametres.toString()}`))).json()
    expect(corps.evenements.map((e: { id: string }) => e.id)).toEqual(['2'])
  })

  it('filtres action, copropriété, gestionnaire ; action hors de la liste fermée : 400', async () => {
    const parAction = await (await JOURNAL(requeteQr('/api/aj-signalement/journal?action=gestionnaire.adresse_confirmee'))).json()
    expect(parAction.evenements.map((e: { id: string }) => e.id)).toEqual(['2'])
    const parGestionnaire = await (await JOURNAL(requeteQr(`/api/aj-signalement/journal?gestionnaire=${G}`))).json()
    expect(parGestionnaire.evenements.map((e: { id: string }) => e.id)).toEqual(['2'])
    expect((await JOURNAL(requeteQr('/api/aj-signalement/journal?action=tout'))).status).toBe(400)
  })

  it('purge : lancée au plus une fois par jour (clé qr_purge_journal) ; son échec ne bloque pas la lecture', async () => {
    await JOURNAL(requeteQr('/api/aj-signalement/journal'))
    expect(simulQr.limites).toContain('qr_purge_journal')
    expect(baseQr.etat.appelsRpc.map((a) => a.nom)).toEqual(['signalements_qr_purger_journal'])
    simulQr.refuser = ['qr_purge_journal']
    await JOURNAL(requeteQr('/api/aj-signalement/journal'))
    expect(baseQr.etat.appelsRpc).toHaveLength(1)
    simulQr.refuser = []
    baseQr.etat.fonctions.signalements_qr_purger_journal = () => ({ error: { code: 'XX000', message: 'panne' } })
    expect((await JOURNAL(requeteQr('/api/aj-signalement/journal'))).status).toBe(200)
  })

  it('table absente : 503 base_absente', async () => {
    baseQr.etat.tablesAbsentes = ['signalements_qr_journal']
    expect((await JOURNAL(requeteQr('/api/aj-signalement/journal'))).status).toBe(503)
  })
})
