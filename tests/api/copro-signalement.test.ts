// tests/api/copro-signalement.test.ts
//
// POST /api/coproprietaire/signalement — rattachement du signalement au bon cabinet.
// Avec un jeton Bearer valide, le cabinet vient du compte connecté :
//   - syndic / super admin → resolveCabinetId (son propre id) ;
//   - super admin dans la vue copropriétaire (rôle d'emprunt, _original_role) → son propre id ;
//   - copropriétaire / locataire → cabinet de sa fiche syndic_coproprios (même e-mail, casse ignorée).
// Sinon (appel public, QR code, portail) : cabinetId transmis, puis nom de l'immeuble — comme avant.
// Les erreurs d'écriture sont journalisées (logger.error) au lieu d'un 500 muet.
// isSyndicRole / resolveCabinetId / getUserRole sont les vrais ; seuls le jeton et Supabase sont simulés.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => {
  const etat = {
    user: null as null | Record<string, unknown>,
    coproprios: [] as Array<Record<string, unknown>>,
    erreurCoproprios: null as null | Record<string, unknown>,
    immeubles: [] as Array<Record<string, unknown>>,
    signalements: [] as Array<Record<string, unknown>>,
    erreurLecture: null as null | Record<string, unknown>,
    erreurInsertion: null as null | Record<string, unknown>,
    insertions: [] as Array<Record<string, unknown>>,
    requetes: [] as Array<{ table: string; filtres: Array<[string, string, unknown]> }>,
  }
  const resultat = (table: string) => {
    if (table === 'syndic_coproprios') return { data: etat.erreurCoproprios ? null : etat.coproprios, error: etat.erreurCoproprios }
    if (table === 'syndic_immeubles') return { data: etat.immeubles, error: null }
    return { data: etat.erreurLecture ? null : etat.signalements, error: etat.erreurLecture }
  }
  const from = (table: string) => {
    const requete = { table, filtres: [] as Array<[string, string, unknown]> }
    etat.requetes.push(requete)
    let insertion: Record<string, unknown> | null = null
    const q: Record<string, unknown> = {}
    for (const m of ['select', 'limit', 'order', 'is']) q[m] = () => q
    q.ilike = (col: string, val: unknown) => { requete.filtres.push(['ilike', col, val]); return q }
    q.eq = (col: string, val: unknown) => { requete.filtres.push(['eq', col, val]); return q }
    q.insert = (ligne: Record<string, unknown>) => { insertion = ligne; etat.insertions.push(ligne); return q }
    q.maybeSingle = async () => ({ data: etat.coproprios[0] ?? null, error: null })
    q.single = async () => (etat.erreurInsertion
      ? { data: null, error: etat.erreurInsertion }
      : { data: { id: 'sig-1', ...insertion }, error: null })
    q.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resultat(table)).then(ok, ko)
    return q
  }
  return { etat, from, loggerError: vi.fn() }
})

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: h.loggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => true),
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
}))
vi.mock('@/lib/auth-helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-helpers')>()),
  getAuthUser: vi.fn(async () => h.etat.user),
}))
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: (table: string) => h.from(table) } }))

const { POST, GET } = await import('@/app/api/coproprietaire/signalement/route')

const ID_FREDERIC = '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4'
const CABINET_TRANSMIS = '11111111-2222-4333-8444-555555555555'

const CORPS = {
  description: 'Fuite d’eau au plafond de la salle de bain',
  demandeurNom: 'Géraldine Xavier',
  demandeurEmail: 'Geraldine.Xavier@Email.com',
  immeuble: 'Résidence Le Prado',
  typeIntervention: 'Plomberie (fuite, colonne, robinetterie)',
  priorite: 'urgente',
  demandeurRole: 'coproprio',
}

function poster(corps: Record<string, unknown>, jeton = true) {
  return POST(new NextRequest('https://vitfix.io/api/coproprietaire/signalement', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(jeton ? { Authorization: 'Bearer jeton-test' } : {}) },
    body: JSON.stringify(corps),
  }))
}

const insere = () => h.etat.insertions[h.etat.insertions.length - 1]
const requetesSur = (table: string) => h.etat.requetes.filter(r => r.table === table)

beforeEach(() => {
  Object.assign(h.etat, {
    user: null, coproprios: [], erreurCoproprios: null, immeubles: [], signalements: [],
    erreurLecture: null, erreurInsertion: null, insertions: [], requetes: [],
  })
  h.loggerError.mockClear()
})

describe('POST /api/coproprietaire/signalement — cabinet du compte connecté', () => {
  it('super admin (Syndic v54 ou espace copro en direct) : cabinet = son id, même si un autre cabinet est transmis', async () => {
    h.etat.user = { id: ID_FREDERIC, email: 'frederic@exemple.fr', app_metadata: { role: 'super_admin' } }
    const res = await poster({ ...CORPS, cabinetId: CABINET_TRANSMIS })
    expect(res.status).toBe(200)
    expect(insere().cabinet_id).toBe(ID_FREDERIC)
    expect(requetesSur('syndic_immeubles')).toHaveLength(0)
  })

  it('super admin sur une fiche de son cabinet (lot transmis, vue copropriétaire) : identité de la fiche, provenance « portail »', async () => {
    const LOT = '077e370e-b5c1-4bce-9e8f-dc82040f6234'
    h.etat.user = { id: ID_FREDERIC, email: 'frederic@exemple.fr', app_metadata: { role: 'coproprio', _original_role: 'super_admin', _admin_override: true } }
    h.etat.coproprios = [{ id: LOT, cabinet_id: ID_FREDERIC, immeuble: 'Résidence Le Prado', batiment: 'D', etage: 4, numero_porte: '12', nom_proprietaire: 'Xavier', prenom_proprietaire: 'Géraldine', email_proprietaire: 'geraldine.xavier@email.com', tel_proprietaire: '+33 6 12 34 56 78', acces_portail: true }]
    const res = await poster({ ...CORPS, lot: LOT, demandeurNom: 'Quelqu’un d’autre', demandeurEmail: 'autre@exemple.fr' })
    expect(res.status).toBe(200)
    expect(insere()).toMatchObject({ cabinet_id: ID_FREDERIC, demandeur_nom: 'Géraldine Xavier', demandeur_email: 'geraldine.xavier@email.com', demandeur_role: 'coproprio', batiment: 'D', etage: '4', num_lot: '12', origine: 'portail' })
    expect(requetesSur('syndic_coproprios')[0].filtres).toContainEqual(['eq', 'id', LOT])
    expect(requetesSur('syndic_coproprios')[0].filtres).toContainEqual(['eq', 'cabinet_id', ID_FREDERIC])
  })

  it('syndic : cabinet = son id (resolveCabinetId)', async () => {
    h.etat.user = { id: 'id-syndic', email: 'syndic@exemple.fr', app_metadata: { role: 'syndic' } }
    await poster(CORPS)
    expect(insere().cabinet_id).toBe('id-syndic')
  })

  it('super admin en vue copropriétaire (rôle emprunté « coproprio ») : cabinet = son propre id, sans recherche par e-mail', async () => {
    h.etat.user = {
      id: ID_FREDERIC, email: 'frederic@exemple.fr',
      app_metadata: { role: 'coproprio', _original_role: 'super_admin', _admin_override: true },
    }
    const res = await poster(CORPS)
    expect(res.status).toBe(200)
    expect(insere().cabinet_id).toBe(ID_FREDERIC)
    expect(requetesSur('syndic_coproprios')).toHaveLength(0)
  })

  it('copropriétaire : cabinet de sa fiche syndic_coproprios, e-mail comparé sans tenir compte de la casse', async () => {
    h.etat.user = { id: 'id-copro', email: 'Sophie.Martin@Example.fr', app_metadata: { role: 'coproprio' } }
    h.etat.coproprios = [
      // Ligne renvoyée par un motif trop large : écartée, l'égalité exacte est vérifiée côté serveur.
      { cabinet_id: 'cab-intrus', email_proprietaire: 'sophie.martinez@example.fr', immeuble: 'Autre' },
      { cabinet_id: 'cab-prado', email_proprietaire: 'sophie.martin@example.fr', immeuble: 'Résidence Le Prado' },
    ]
    await poster({ ...CORPS, cabinetId: CABINET_TRANSMIS })
    expect(insere().cabinet_id).toBe('cab-prado')
    expect(requetesSur('syndic_coproprios')[0].filtres).toContainEqual(['ilike', 'email_proprietaire', 'sophie.martin@example.fr'])
  })

  it('copropriétaire : les jokers de LIKE de son e-mail sont neutralisés', async () => {
    h.etat.user = { id: 'id-copro', email: 'jean_dupont@exemple.fr', app_metadata: { role: 'coproprio' } }
    h.etat.coproprios = [{ cabinet_id: 'cab-1', email_proprietaire: 'jean_dupont@exemple.fr', immeuble: 'Résidence Le Prado' }]
    await poster(CORPS)
    expect(requetesSur('syndic_coproprios')[0].filtres).toContainEqual(['ilike', 'email_proprietaire', 'jean\\_dupont@exemple.fr'])
    expect(insere().cabinet_id).toBe('cab-1')
  })

  it('copropriétaire présent dans deux cabinets : celui de l’immeuble signalé', async () => {
    h.etat.user = { id: 'id-copro', email: 'claire.dubois@example.fr', app_metadata: { role: 'locataire' } }
    h.etat.coproprios = [
      { cabinet_id: 'cab-lyon', email_proprietaire: 'claire.dubois@example.fr', immeuble: 'Résidence Bellecour' },
      { cabinet_id: 'cab-marseille', email_proprietaire: 'claire.dubois@example.fr', immeuble: 'Résidence Le Prado' },
    ]
    await poster(CORPS)
    expect(insere().cabinet_id).toBe('cab-marseille')
  })

  it('copropriétaire sans fiche : retour au comportement public (cabinet transmis)', async () => {
    h.etat.user = { id: 'id-copro', email: 'inconnu@example.fr', app_metadata: { role: 'coproprio' } }
    await poster({ ...CORPS, cabinetId: CABINET_TRANSMIS })
    expect(insere().cabinet_id).toBe(CABINET_TRANSMIS)
  })

  it('copropriétaire, recherche en erreur : journalisée, puis repli sur le nom de l’immeuble', async () => {
    h.etat.user = { id: 'id-copro', email: 'sophie.martin@example.fr', app_metadata: { role: 'coproprio' } }
    h.etat.erreurCoproprios = { code: '42P01', message: 'relation introuvable' }
    h.etat.immeubles = [{ cabinet_id: 'cab-immeuble' }]
    await poster(CORPS)
    expect(h.loggerError).toHaveBeenCalledWith(expect.stringContaining('[COPRO SIGNALEMENT]'), expect.objectContaining({ code: '42P01' }))
    expect(insere().cabinet_id).toBe('cab-immeuble')
  })

  it('autre rôle (artisan) sans emprunt : comportement public inchangé', async () => {
    h.etat.user = { id: 'id-artisan', email: 'artisan@example.fr', app_metadata: { role: 'artisan' } }
    await poster({ ...CORPS, cabinetId: CABINET_TRANSMIS })
    expect(insere().cabinet_id).toBe(CABINET_TRANSMIS)
    expect(requetesSur('syndic_coproprios')).toHaveLength(0)
  })
})

describe('POST /api/coproprietaire/signalement — appel public (sans jeton)', () => {
  it('cabinet transmis par l’appelant', async () => {
    const res = await poster({ ...CORPS, cabinetId: CABINET_TRANSMIS }, false)
    expect(res.status).toBe(200)
    expect(insere().cabinet_id).toBe(CABINET_TRANSMIS)
  })

  it('sinon, cabinet retrouvé par le nom de l’immeuble', async () => {
    h.etat.immeubles = [{ cabinet_id: 'cab-immeuble' }]
    await poster(CORPS, false)
    expect(requetesSur('syndic_immeubles')[0].filtres).toContainEqual(['ilike', 'nom', 'Résidence Le Prado'])
    expect(insere().cabinet_id).toBe('cab-immeuble')
  })

  it('champs enregistrés : e-mail en minuscules (le suivi cherche l’e-mail exact), priorité, statut en attente', async () => {
    const res = await poster(CORPS, false)
    const ligne = insere()
    expect(ligne).toMatchObject({
      demandeur_email: 'geraldine.xavier@email.com',
      demandeur_nom: 'Géraldine Xavier',
      demandeur_role: 'coproprio',
      immeuble_nom: 'Résidence Le Prado',
      priorite: 'urgente',
      statut: 'en_attente',
      type_intervention: 'Plomberie (fuite, colonne, robinetterie)',
    })
    expect((await res.json()).signalement.id).toBe('sig-1')
  })

  it('description trop courte : 400, rien n’est écrit', async () => {
    const res = await poster({ ...CORPS, description: 'Fuite' }, false)
    expect(res.status).toBe(400)
    expect(h.etat.insertions).toHaveLength(0)
  })
})

describe('POST /api/coproprietaire/signalement — erreur d’écriture', () => {
  it('insertion refusée : 500 sans détail pour le client, erreur journalisée avec le cabinet', async () => {
    h.etat.user = { id: ID_FREDERIC, email: 'frederic@exemple.fr', app_metadata: { role: 'super_admin' } }
    h.etat.erreurInsertion = { code: '23503', message: 'violates foreign key constraint "fk_syndic_signalements_cabinet"', details: 'Key is not present' }
    const res = await poster(CORPS)
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Une erreur interne est survenue' })
    expect(h.loggerError).toHaveBeenCalledWith(
      expect.stringContaining('insertion'),
      expect.objectContaining({ code: '23503', cabinetId: ID_FREDERIC, authentifie: true }),
    )
  })
})

describe('GET /api/coproprietaire/signalement — suivi par e-mail', () => {
  const lire = (url: string) => GET(new NextRequest(url))

  it('recherche exacte sur l’e-mail en minuscules, statut et dates seulement', async () => {
    h.etat.signalements = [{ id: 'sig-1', statut: 'acceptee', artisan_assigne: 'Plomberie du Vieux-Port', created_at: '2026-10-12T09:00:00Z' }]
    const res = await lire('https://vitfix.io/api/coproprietaire/signalement?email=Geraldine.Xavier%40Email.com')
    expect(res.status).toBe(200)
    expect(requetesSur('syndic_signalements')[0].filtres).toContainEqual(['eq', 'demandeur_email', 'geraldine.xavier@email.com'])
    const { signalements } = await res.json()
    expect(signalements[0]).toEqual({ id: 'sig-1', typeIntervention: '', statut: 'acceptee', createdAt: '2026-10-12T09:00:00Z', updatedAt: undefined })
    // Suivi public réduit : ni prestataire, ni description, ni lot.
    expect(signalements[0]).not.toHaveProperty('artisanAssigne')
  })

  it('lecture en erreur : 500 et erreur journalisée', async () => {
    h.etat.erreurLecture = { code: '57014', message: 'timeout' }
    const res = await lire('https://vitfix.io/api/coproprietaire/signalement?email=a%40b.fr')
    expect(res.status).toBe(500)
    expect(h.loggerError).toHaveBeenCalledWith(expect.stringContaining('suivi'), expect.objectContaining({ code: '57014' }))
  })
})
