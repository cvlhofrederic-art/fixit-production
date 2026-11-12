// tests/api/aj-signalement-tableau-gestion.test.ts
//
// GET /api/aj-signalement/tableau (P1-R1), étendu SANS rupture : enveloppe { tableau: { coproprietes, signalements } }
// conservée (lue telle quelle par chargerTableauQr), champs seulement ajoutés à chaque copropriété (cabinet,
// gestionnaires, « à tous », auteur, compteurs, adresses de gestionnaires restées dans les saisies) ;
//   ?cabinet=<id>       : les copropriétés de ce cabinet ;
//   ?gestionnaire=<id>  : LA PAGE DE SUIVI de ce gestionnaire vue par le super admin (sa portée : attributions ∪
//                         « à tous » de SON cabinet ; fiche désactivée → rien), 100 signalements au plus.
// Compteurs par la fonction signalements_qr_compteurs (simulée), sinon calculés sur les signalements lus.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/aj-signalement-base')).baseQr.client }))
vi.mock('@/lib/supabase-server-component', async () => (await import('../helpers/aj-signalement-routes')).mockCookies())
vi.mock('@/lib/auth-helpers', async () => (await import('../helpers/aj-signalement-routes')).mockAuth())
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/aj-signalement-routes')).mockLimites())
vi.mock('@/lib/email', async () => (await import('../helpers/aj-signalement-routes')).mockEmail())
vi.mock('@/lib/logger', async () => (await import('../helpers/aj-signalement-routes')).mockLogger())

const { baseQr, simulerProductionAvant1111Qr } = await import('../helpers/aj-signalement-base')
const { ADMIN_QR, reinitialiserSimulQr, requeteQr, simulQr } = await import('../helpers/aj-signalement-routes')
const { GET } = await import('@/app/api/aj-signalement/tableau/route')
const { chargerTableauQr } = await import('@/lib/aj-signalement/api')
const { reinitialiserReplisQr } = await import('@/lib/aj-signalement/serveur')

const CAB = 'ca000000-0000-4000-8000-000000000001'
const CAB_AUTRE = 'ca000000-0000-4000-8000-000000000002'
const C_ATTRIBUEE = 'c0000000-0000-4000-8000-00000000000a'
const C_TOUS = 'c0000000-0000-4000-8000-00000000000b'
const C_AUTRE_CAB = 'c0000000-0000-4000-8000-00000000000c'
const C_TOUS_AUTRE_CAB = 'c0000000-0000-4000-8000-00000000000d'
const C_SANS = 'c0000000-0000-4000-8000-00000000000e'
const G = 'a0000000-0000-4000-8000-000000000001'
const G_AUTRE = 'a0000000-0000-4000-8000-000000000002'

const copro = (id: string, nom: string, sur: Record<string, unknown>) => ({
  id, nom, adresse: '1 rue Exemple', jeton: id.replace(/-/g, '').padEnd(32, '0').slice(0, 32), emails_destinataires: [], actif: true,
  created_at: '2026-11-01T09:00:00+00:00', cabinet_id: CAB, code_postal: '13001', ville: 'Marseille', immatriculation: null,
  reference_cabinet: null, batiments: [], attribuee_a_tous: false, cree_par_gestionnaire_id: null, ...sur,
})
const signalement = (n: number, coproprieteId: string) => ({
  id: `5f000000-0000-4000-8000-${String(n).padStart(12, '0')}`, copropriete_id: coproprieteId, prenom: 'Prénom', nom: 'Nom', telephone: '0600000000',
  email: 'declarant@exemple.test', batiment: 'A', etage: '1', num_lot: '1', est_partie_commune: false, zone_signalee: '', type_intervention: 'Plomberie',
  description: 'Fuite d’eau au plafond', priorite: 'normale', statut: 'en_attente', langue: 'fr', email_envoye_le: null, email_erreur: null,
  confirmation_envoyee_le: null, confirmation_erreur: null, qualite_declarant: 'locataire', adresse_proposee: null, signalement_lie_id: null,
  created_at: `2026-11-10T09:${String(n).padStart(2, '0')}:00+00:00`, updated_at: null,
})

beforeEach(() => {
  reinitialiserSimulQr()
  reinitialiserReplisQr()
  baseQr.reinitialiser()
  const t = baseQr.etat.tables
  t.signalements_qr_cabinets = [
    { id: CAB, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple', langue: 'fr' },
    { id: CAB_AUTRE, nom: 'Autre Cabinet', identifiant: 'autre-cabinet', langue: 'fr' },
  ]
  t.signalements_qr_coproprietes = [
    copro(C_ATTRIBUEE, 'Résidence Attribuée', { emails_destinataires: ['marie.exemple@exemple.test', 'cs@externe.test'], cree_par_gestionnaire_id: G }),
    copro(C_TOUS, 'Résidence Test', { attribuee_a_tous: true }),
    copro(C_AUTRE_CAB, 'Résidence Ailleurs', { cabinet_id: CAB_AUTRE }),
    copro(C_TOUS_AUTRE_CAB, 'Résidence Test Ailleurs', { cabinet_id: CAB_AUTRE, attribuee_a_tous: true }),
    copro(C_SANS, 'Parc Exemple', { cabinet_id: null }),
  ]
  t.signalements_qr_gestionnaires = [
    { id: G, cabinet_id: CAB, nom: 'Marie Exemple', email: 'marie.exemple@exemple.test', actif: true },
    { id: G_AUTRE, cabinet_id: CAB_AUTRE, nom: 'Paul Ailleurs', email: 'paul@autre-exemple.test', actif: true },
  ]
  t.signalements_qr_attributions = [
    { copropriete_id: C_ATTRIBUEE, gestionnaire_id: G },
    // Attribution incohérente (autre cabinet) : la portée l'ignore.
    { copropriete_id: C_AUTRE_CAB, gestionnaire_id: G },
  ]
  t.signalements_qr = [signalement(1, C_ATTRIBUEE), signalement(2, C_TOUS), signalement(3, C_AUTRE_CAB), signalement(4, C_TOUS_AUTRE_CAB), signalement(5, C_SANS)]
  baseQr.etat.fonctions.signalements_qr_compteurs = (a) => ({
    data: (a.p_ids as string[]).map((id) => ({ copropriete_id: id, total: 7, en_attente: 3, ouverts: 4, urgents_ouverts: 2, attente_48h: 1, dernier: '2026-11-10T09:05:00+00:00' })),
  })
})

const lire = async (query = '') => {
  const res = await GET(requeteQr(`/api/aj-signalement/tableau${query}`))
  return { res, corps: await res.json() }
}

describe('sans paramètre : contrat conservé, champs ajoutés', () => {
  it('chaque copropriété porte cabinet, gestionnaires, « à tous », auteur, compteurs et adresses de gestionnaires saisies', async () => {
    const { res, corps } = await lire()
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    expect(Object.keys(corps)).toEqual(['tableau'])
    const attribuee = corps.tableau.coproprietes.find((c: { id: string }) => c.id === C_ATTRIBUEE)
    expect(attribuee).toEqual({
      id: C_ATTRIBUEE, nom: 'Résidence Attribuée', adresse: '1 rue Exemple', jeton: expect.any(String),
      emailsDestinataires: ['marie.exemple@exemple.test', 'cs@externe.test'], actif: true, creeLe: '2026-11-01T09:00:00+00:00',
      nbSignalements: 7, nbEnAttente: 3, derniereAdresseProposee: null,
      cabinet: { id: CAB, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple' }, codePostal: '13001', ville: 'Marseille',
      immatriculation: null, referenceCabinet: null, batiments: [], attribueeATous: false,
      gestionnaires: [{ id: G, nom: 'Marie Exemple' }], creePar: { gestionnaireId: G, nom: 'Marie Exemple' },
      ouverts: 4, urgentsOuverts: 2, attente48h: 1, dernier: '2026-11-10T09:05:00+00:00', adressesDeGestionnaires: 1,
    })
    expect(corps.tableau.coproprietes.find((c: { id: string }) => c.id === C_SANS)).toMatchObject({ cabinet: null, gestionnaires: [], creePar: 'administrateur' })
    expect(corps.tableau.signalements).toHaveLength(5)
  })

  it('chargerTableauQr accepte la réponse réelle de la route', async () => {
    const fetchImpl = vi.fn(async () => GET(requeteQr('/api/aj-signalement/tableau')))
    const r = await chargerTableauQr(null, fetchImpl as unknown as typeof fetch)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.tableau.coproprietes).toHaveLength(5)
  })

  it('?cabinet= : les copropriétés de ce cabinet et leurs signalements seulement', async () => {
    const { corps } = await lire(`?cabinet=${CAB_AUTRE}`)
    expect(corps.tableau.coproprietes.map((c: { id: string }) => c.id)).toEqual([C_AUTRE_CAB, C_TOUS_AUTRE_CAB])
    expect(corps.tableau.signalements.map((s: { coproprieteId: string }) => s.coproprieteId).sort()).toEqual([C_AUTRE_CAB, C_TOUS_AUTRE_CAB].sort())
  })

  it('compteurs indisponibles (fonction absente) : calculés sur les signalements lus', async () => {
    delete baseQr.etat.fonctions.signalements_qr_compteurs
    const { corps } = await lire()
    expect(corps.tableau.coproprietes.find((c: { id: string }) => c.id === C_ATTRIBUEE)).toMatchObject({ nbSignalements: 1, nbEnAttente: 1, ouverts: 1 })
  })

  it('migration du 11/11 absente (tables 42P01, colonnes 42703) : forme actuelle + valeurs par défaut, 200', async () => {
    baseQr.etat.tablesAbsentes = ['signalements_qr_cabinets', 'signalements_qr_gestionnaires', 'signalements_qr_attributions']
    baseQr.etat.colonnesAbsentes = { signalements_qr_coproprietes: ['cabinet_id', 'code_postal', 'ville', 'immatriculation', 'reference_cabinet', 'batiments', 'attribuee_a_tous', 'cree_par_gestionnaire_id'] }
    delete baseQr.etat.fonctions.signalements_qr_compteurs
    const { res, corps } = await lire()
    expect(res.status).toBe(200)
    expect(corps.tableau.coproprietes[0]).toMatchObject({ cabinet: null, gestionnaires: [], attribueeATous: false, codePostal: '', adressesDeGestionnaires: 0 })
  })

  it.each(['42P01', 'PGRST205'] as const)(
    'production avant la migration du 11/11 (tables %s, colonnes 42703, fonctions PGRST202) : 200, forme actuelle et valeurs par défaut',
    async (code) => {
      simulerProductionAvant1111Qr(baseQr, code)
      const { res, corps } = await lire()
      expect(res.status).toBe(200)
      expect(corps.tableau.coproprietes).toHaveLength(5)
      expect(corps.tableau.coproprietes[0]).toMatchObject({ cabinet: null, gestionnaires: [], attribueeATous: false, codePostal: '', creePar: 'administrateur', adressesDeGestionnaires: 0 })
      expect(corps.tableau.signalements).toHaveLength(5)
      // Les fiches des adresses saisies sont lues dans la table absente : la branche « table absente » est bien prise.
      expect(baseQr.etat.tablesAbsentesLues).toContain('signalements_qr_gestionnaires')
      expect(simulQr.logger.error).not.toHaveBeenCalled()
    },
  )

  it('paramètre inconnu : 400 ; identifiant mal formé : 400', async () => {
    expect((await lire('?vue=1')).res.status).toBe(400)
    expect((await lire('?gestionnaire=pas-un-uuid')).res.status).toBe(400)
  })

  it('relecture 11 : plus de 1 000 fiches et attributions dans d’autres cabinets (plafond PostgREST) : rien ne manque, lectures filtrées', async () => {
    const t = baseQr.etat.tables
    const autres = Array.from({ length: 1200 }, (_, i) => `a1000000-0000-4000-8000-${String(i).padStart(12, '0')}`)
    // Les lignes utiles en DERNIER : une lecture de toute la table, coupée à 1 000 lignes, les perdrait.
    t.signalements_qr_gestionnaires = [
      ...autres.map((id, i) => ({ id, cabinet_id: CAB_AUTRE, nom: `Fiche ${i}`, email: `fiche${i}@autre-exemple.test`, actif: true })),
      ...t.signalements_qr_gestionnaires,
    ]
    t.signalements_qr_attributions = [...autres.map((id) => ({ copropriete_id: C_AUTRE_CAB, gestionnaire_id: id })), ...t.signalements_qr_attributions]
    baseQr.etat.maxLignes = 1000
    const { res, corps } = await lire(`?cabinet=${CAB}`)
    expect(res.status).toBe(200)
    expect(corps.tableau.coproprietes.find((c: { id: string }) => c.id === C_ATTRIBUEE)).toMatchObject({
      gestionnaires: [{ id: G, nom: 'Marie Exemple' }], creePar: { gestionnaireId: G, nom: 'Marie Exemple' }, adressesDeGestionnaires: 1,
    })
    // Aucune lecture « tout » : attributions par copropriété lue, fiches par identifiant ou par adresse saisie.
    const lectures = baseQr.etat.lectures.filter((l) => ['signalements_qr_gestionnaires', 'signalements_qr_attributions'].includes(l.table))
    expect(lectures.length).toBeGreaterThan(0)
    for (const l of lectures) expect(l.filtres.some((f) => /^(copropriete_id|id|email)=in\./.test(f))).toBe(true)
  })

  it('relecture 11 : lireParValeursQr lit page par page (2 500 lignes sous un plafond de 1 000) et découpe les valeurs en lots', async () => {
    const { lireParValeursQr, lotsPourFiltreQr } = await import('@/lib/aj-signalement/serveur')
    baseQr.etat.tables.signalements_qr_attributions = Array.from({ length: 2500 }, (_, i) => ({
      copropriete_id: C_ATTRIBUEE, gestionnaire_id: `a1000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    }))
    baseQr.etat.maxLignes = 1000
    type Requete = {
      select: (c: string) => Requete; in: (c: string, v: string[]) => Requete; order: (c: string, o: { ascending: boolean }) => Requete
      range: (de: number, a: number) => PromiseLike<{ data: unknown; error: null }>
    }
    const attributions = () => baseQr.client.from('signalements_qr_attributions') as unknown as Requete
    const r = await lireParValeursQr<{ gestionnaire_id: string }>([C_ATTRIBUEE], (lot) => attributions()
      .select('copropriete_id, gestionnaire_id').in('copropriete_id', lot).order('gestionnaire_id', { ascending: true }))
    expect(r.ok && r.valeur.length).toBe(2500)
    expect(r.ok && new Set(r.valeur.map((l) => l.gestionnaire_id)).size).toBe(2500)
    expect(await lireParValeursQr([], () => { throw new Error('aucune requête attendue') })).toEqual({ ok: true, valeur: [] })
    const lots = lotsPourFiltreQr(Array.from({ length: 450 }, (_, i) => `v${i}`), 6000, 200)
    expect(lots.map((l) => l.length)).toEqual([200, 200, 50])
    expect(lotsPourFiltreQr(['a', 'a', 'b'])).toEqual([['a', 'b']])
  })
})

describe('?gestionnaire= : page de suivi d’un gestionnaire vue par le super admin', () => {
  it('portée = attribuées ∪ « à tous » de SON cabinet ; jamais l’autre cabinet ni les copropriétés sans cabinet', async () => {
    const { res, corps } = await lire(`?gestionnaire=${G}`)
    expect(res.status).toBe(200)
    expect(corps.tableau.coproprietes.map((c: { id: string }) => c.id).sort()).toEqual([C_ATTRIBUEE, C_TOUS].sort())
    expect(corps.tableau.signalements.map((s: { coproprieteId: string }) => s.coproprieteId).sort()).toEqual([C_ATTRIBUEE, C_TOUS].sort())
    expect(corps.tableau.gestionnaire).toEqual({ id: G, nom: 'Marie Exemple', actif: true, cabinet: { id: CAB, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple' } })
  })

  it('100 signalements au plus', async () => {
    baseQr.etat.tables.signalements_qr = Array.from({ length: 130 }, (_, i) => signalement(i + 10, C_ATTRIBUEE))
    const { corps } = await lire(`?gestionnaire=${G}`)
    expect(corps.tableau.signalements).toHaveLength(100)
  })

  it('fiche désactivée : aucune copropriété ; fiche inconnue : 404', async () => {
    Object.assign(baseQr.table('signalements_qr_gestionnaires')[0], { actif: false })
    const { corps } = await lire(`?gestionnaire=${G}`)
    expect(corps.tableau.coproprietes).toEqual([])
    expect(corps.tableau.signalements).toEqual([])
    expect((await lire('?gestionnaire=a0000000-0000-4000-8000-00000000dead')).res.status).toBe(404)
  })

  it('« vue en tant que » refusée : la page de suivi est celle que le super admin consulte, pas une session empruntée', async () => {
    simulQr.user = { ...ADMIN_QR, app_metadata: { role: 'artisan', _original_role: 'super_admin' } }
    expect((await lire(`?gestionnaire=${G}`)).res.status).toBe(403)
  })
})
