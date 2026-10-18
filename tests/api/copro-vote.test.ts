// tests/api/copro-vote.test.ts
//
// POST /api/coproprietaire/assemblees/vote — vote par correspondance du copropriétaire connecté :
//   - propriétaire seulement (403 locataire), corps validé (400), résolution de SON cabinet et assemblée
//     de SON immeuble (sinon 404), assemblée « convoquée » (sinon 409 vote_ferme), avant la date limite
//     de trois jours (sinon 409 vote_clos) ;
//   - un seul vote par copropriétaire et par résolution, toutes ses fiches de l'immeuble confondues :
//     tantièmes = somme arrondie de ses lots de l'immeuble, coproprio_id = la fiche affichée ;
//     un vote existant est remplacé (update), un doublon à l'insertion (23505) est repris par un update ;
//   - les compteurs de syndic_resolutions ne sont jamais touchés.
// L'horloge est figée (vi.setSystemTime) ; la route est testée par son POST exporté.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

type Ligne = Record<string, unknown>

const h = vi.hoisted(() => {
  type LigneH = Record<string, unknown>
  type FiltreH = { op: string; colonne: string; valeur: unknown }
  type Requete = { table: string; filtres: FiltreH[]; insertion: LigneH | null; maj: LigneH | null; suppression: boolean }

  const etat = {
    user: null as null | LigneH,
    tables: {} as Record<string, LigneH[]>,
    erreurs: {} as Record<string, { code: string; message: string }>,
    erreurInsertion: null as null | { code: string; message: string },
    erreurMaj: null as null | { code: string; message: string },
    requetes: [] as Requete[],
  }

  const motifVersRegex = (motif: string): RegExp => {
    let source = ''
    for (let i = 0; i < motif.length; i++) {
      const c = motif[i]
      if (c === '\\' && i + 1 < motif.length) { source += motif[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); continue }
      if (c === '%' || c === '*') source += '.*'
      else if (c === '_') source += '.'
      else source += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }
    return new RegExp(`^${source}$`, 'i')
  }

  const passe = (ligne: LigneH, f: FiltreH): boolean => {
    const v = ligne[f.colonne]
    switch (f.op) {
      case 'eq': return v === f.valeur
      case 'in': return Array.isArray(f.valeur) && f.valeur.includes(v)
      case 'ilike': return typeof v === 'string' && motifVersRegex(String(f.valeur)).test(v)
      default: return true
    }
  }

  const from = (table: string) => {
    const requete: Requete = { table, filtres: [], insertion: null, maj: null, suppression: false }
    etat.requetes.push(requete)
    let unique = false
    let limite: number | null = null
    const resultat = () => {
      const erreur = etat.erreurs[table]
      if (erreur) return { data: null, error: erreur }
      if (requete.insertion) return { data: null, error: etat.erreurInsertion }
      if (requete.maj) return { data: null, error: etat.erreurMaj }
      if (requete.suppression) return { data: null, error: null }
      let data = (etat.tables[table] ?? []).filter(l => requete.filtres.every(f => passe(l, f)))
      if (limite !== null) data = data.slice(0, limite)
      return unique ? { data: data[0] ?? null, error: null } : { data, error: null }
    }
    const q: Record<string, unknown> = {}
    q.select = () => q
    for (const op of ['eq', 'in', 'ilike']) {
      q[op] = (colonne: string, valeur: unknown) => { requete.filtres.push({ op, colonne, valeur }); return q }
    }
    q.limit = (n: number) => { limite = n; return q }
    q.order = () => q
    q.delete = () => { requete.suppression = true; return q }
    q.maybeSingle = () => { unique = true; return q }
    q.insert = (ligne: LigneH) => { requete.insertion = ligne; return q }
    q.update = (valeurs: LigneH) => { requete.maj = valeurs; return q }
    q.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resultat()).then(ok, ko)
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

const { POST } = await import('@/app/api/coproprietaire/assemblees/vote/route')

// ── Jeu de données ───────────────────────────────────────────────────────────

const CABINET = '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4'
const AUTRE_CABINET = '11111111-2222-4333-8444-555555555555'
const ID_FICHE_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
const ID_FICHE_2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
const ID_FICHE_AILLEURS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'
const AG_ID = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'
const RES_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'
const VOTE_ID = 'ffffffff-ffff-4fff-8fff-fffffffffff1'

// Séance le 20 novembre à 18 h (UTC), loin des changements d'heure : date limite le 17 novembre à 18 h.
const DATE_AG = '2026-11-20T18:00:00Z'
const AVANT_LIMITE = new Date('2026-11-10T10:00:00Z')
const J_MOINS_2 = new Date('2026-11-18T10:00:00Z')

function fiche(surcharge: Ligne = {}): Ligne {
  return {
    id: ID_FICHE_1, cabinet_id: CABINET, immeuble: 'Résidence Le Prado', batiment: 'D', etage: 4, numero_porte: '12',
    nom_proprietaire: 'Xavier', prenom_proprietaire: 'Géraldine', email_proprietaire: 'Geraldine.Xavier@Email.com',
    tel_proprietaire: null, nom_locataire: 'Durand', prenom_locataire: 'Paul', email_locataire: 'paul.durand@exemple.fr',
    tel_locataire: null, est_occupe: true, tantieme: 450, solde: 0, acces_portail: true, acces_portail_locataire: true,
    ...surcharge,
  }
}

const utilisateur = (role: string, email = 'Geraldine.Xavier@Email.com'): Ligne =>
  ({ id: 'u-copro', email, email_confirmed_at: '2026-01-01T00:00:00Z', app_metadata: { role } })

function voter(corps: unknown, url = 'https://vitfix.io/api/coproprietaire/assemblees/vote') {
  return POST(new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer jeton-test' },
    body: typeof corps === 'string' ? corps : JSON.stringify(corps),
  }))
}

const requetesSur = (table: string) => h.etat.requetes.filter(r => r.table === table)
const insertions = () => h.etat.requetes.filter(r => r.insertion).map(r => ({ table: r.table, ligne: r.insertion as Ligne }))
const majs = () => h.etat.requetes.filter(r => r.maj).map(r => ({ table: r.table, valeurs: r.maj as Ligne, filtres: r.filtres.map(f => [f.op, f.colonne, f.valeur]) }))
const ecrituresSur = (table: string) => [...insertions(), ...majs()].filter(e => e.table === table)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(AVANT_LIMITE)
  h.etat.user = utilisateur('coproprio')
  h.etat.tables = {
    syndic_coproprios: [
      // Les lots sont triés par immeuble / bâtiment / étage : celui-ci reste la fiche affichée par défaut.
      fiche(),
      // Second lot dans le même immeuble (trié après) : ses tantièmes s'ajoutent (299.6 → total 749.6, arrondi 750).
      fiche({ id: ID_FICHE_2, batiment: 'E', etage: 6, numero_porte: '21', tantieme: '299.6' }),
      // Lot dans un autre immeuble (trié après) : hors du vote.
      fiche({ id: ID_FICHE_AILLEURS, immeuble: 'Résidence Zola', tantieme: 1000 }),
    ],
    syndic_resolutions: [{ id: RES_ID, cabinet_id: CABINET, assemblee_id: AG_ID, titre: 'Ravalement', vote_pour: 0, vote_contre: 0, vote_abstention: 0 }],
    syndic_assemblees: [{ id: AG_ID, cabinet_id: CABINET, immeuble: 'Résidence Le Prado', date_ag: DATE_AG, statut: 'convoquée' }],
    syndic_votes_correspondance: [],
  }
  h.etat.erreurs = {}
  h.etat.erreurInsertion = null
  h.etat.erreurMaj = null
  h.etat.requetes = []
  h.loggerError.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('POST /api/coproprietaire/assemblees/vote — refus', () => {
  it('sans utilisateur → 401 ; rien n’est écrit', async () => {
    h.etat.user = null
    const res = await voter({ resolutionId: RES_ID, vote: 'pour' })
    expect(res.status).toBe(401)
    expect(insertions()).toHaveLength(0)
  })

  it('locataire → 403 role_interdit, aucune lecture de la résolution', async () => {
    h.etat.user = utilisateur('locataire', 'paul.durand@exemple.fr')
    const res = await voter({ resolutionId: RES_ID, vote: 'pour' })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'role_interdit' })
    expect(requetesSur('syndic_resolutions')).toHaveLength(0)
    expect(insertions()).toHaveLength(0)
  })

  it.each([
    ['vote inconnu', { resolutionId: RES_ID, vote: 'oui' }],
    ['résolution mal formée', { resolutionId: 'res-1', vote: 'pour' }],
    ['vote absent', { resolutionId: RES_ID }],
    ['JSON invalide', '{pas du json'],
  ])('corps invalide (%s) → 400, rien n’est lu ni écrit', async (_cas, corps) => {
    const res = await voter(corps)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Données invalides' })
    expect(requetesSur('syndic_resolutions')).toHaveLength(0)
    expect(insertions()).toHaveLength(0)
  })

  it('résolution inconnue → 404 ; la lecture est filtrée sur mon cabinet', async () => {
    h.etat.tables.syndic_resolutions = []
    const res = await voter({ resolutionId: RES_ID, vote: 'pour' })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not_found' })
    const filtres = requetesSur('syndic_resolutions')[0].filtres.map(f => [f.op, f.colonne, f.valeur])
    expect(filtres).toEqual([['eq', 'id', RES_ID], ['eq', 'cabinet_id', CABINET]])
    expect(requetesSur('syndic_assemblees')).toHaveLength(0)
  })

  it('résolution d’un autre cabinet → 404', async () => {
    h.etat.tables.syndic_resolutions[0].cabinet_id = AUTRE_CABINET
    expect((await voter({ resolutionId: RES_ID, vote: 'pour' })).status).toBe(404)
  })

  it('assemblée d’un autre immeuble → 404 ; rien n’est écrit', async () => {
    h.etat.tables.syndic_assemblees[0].immeuble = 'Résidence Bellecour'
    const res = await voter({ resolutionId: RES_ID, vote: 'pour' })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not_found' })
    expect(insertions()).toHaveLength(0)
  })

  it.each(['clôturée', 'cloturee', 'en_cours', 'annulée', 'brouillon'])('assemblée au statut %s → 409 vote_ferme', async statut => {
    h.etat.tables.syndic_assemblees[0].statut = statut
    const res = await voter({ resolutionId: RES_ID, vote: 'pour' })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'vote_ferme' })
    expect(requetesSur('syndic_votes_correspondance')).toHaveLength(0)
  })

  it('à J-2 de la séance → 409 vote_clos ; rien n’est écrit', async () => {
    vi.setSystemTime(J_MOINS_2)
    const res = await voter({ resolutionId: RES_ID, vote: 'pour' })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'vote_clos' })
    expect(requetesSur('syndic_votes_correspondance')).toHaveLength(0)
  })

  it('assemblée sans date → 409 vote_clos', async () => {
    h.etat.tables.syndic_assemblees[0].date_ag = null
    expect(await (await voter({ resolutionId: RES_ID, vote: 'pour' })).json()).toEqual({ error: 'vote_clos' })
  })

  it('erreur d’écriture autre qu’un doublon → 500 sans détail, journalisée', async () => {
    h.etat.erreurInsertion = { code: '42501', message: 'permission denied' }
    const res = await voter({ resolutionId: RES_ID, vote: 'pour' })
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Une erreur interne est survenue' })
    expect(h.loggerError).toHaveBeenCalledWith('[COPRO VOTE] enregistrement', expect.objectContaining({ code: '42501' }))
    expect(majs()).toHaveLength(0)
  })
})

describe('POST /api/coproprietaire/assemblees/vote — enregistrement', () => {
  it('premier vote : insertion avec la fiche affichée, mon nom, les tantièmes de tous mes lots de l’immeuble, la date du jour', async () => {
    const res = await voter({ resolutionId: RES_ID, vote: 'pour' })
    expect(res.status).toBe(200)

    // Le vote existant est cherché sur toutes mes fiches de l'immeuble (pas celle de l'autre immeuble).
    const lecture = requetesSur('syndic_votes_correspondance')[0].filtres.map(f => [f.op, f.colonne, f.valeur])
    expect(lecture).toContainEqual(['eq', 'resolution_id', RES_ID])
    expect(lecture).toContainEqual(['eq', 'cabinet_id', CABINET])
    expect(lecture).toContainEqual(['in', 'coproprio_id', [ID_FICHE_1, ID_FICHE_2]])

    expect(insertions()).toEqual([{
      table: 'syndic_votes_correspondance',
      ligne: {
        resolution_id: RES_ID, cabinet_id: CABINET, coproprio_id: ID_FICHE_1, 'copropriétaire': 'Géraldine Xavier',
        tantiemes: 750, vote: 'pour', date_reception: '2026-11-10',
        // Provenance du portail (migration 20261017), horodatée.
        source: 'portail', horodatage: AVANT_LIMITE.toISOString(),
      },
    }])
    expect(majs()).toHaveLength(0)
    expect(await res.json()).toEqual({ vote: { resolutionId: RES_ID, vote: 'pour', enregistreLe: AVANT_LIMITE.toISOString(), modifie: false } })
  })

  it('vote existant (sur l’une de mes fiches) : mis à jour, pas de nouvelle ligne', async () => {
    h.etat.tables.syndic_votes_correspondance = [{ id: VOTE_ID, cabinet_id: CABINET, resolution_id: RES_ID, coproprio_id: ID_FICHE_2, vote: 'pour' }]
    const res = await voter({ resolutionId: RES_ID, vote: 'contre' })
    expect(res.status).toBe(200)
    expect(insertions()).toHaveLength(0)
    expect(majs()).toEqual([{
      table: 'syndic_votes_correspondance',
      valeurs: { vote: 'contre', date_reception: '2026-11-10', tantiemes: 750, 'copropriétaire': 'Géraldine Xavier', coproprio_id: ID_FICHE_1, source: 'portail', horodatage: AVANT_LIMITE.toISOString() },
      filtres: [['eq', 'id', VOTE_ID], ['eq', 'cabinet_id', CABINET]],
    }])
    expect(await res.json()).toMatchObject({ vote: { vote: 'contre', modifie: true } })
  })

  it('doublon à l’insertion (23505, double clic) : repris par une mise à jour, 200', async () => {
    h.etat.erreurInsertion = { code: '23505', message: 'duplicate key value violates unique constraint' }
    const res = await voter({ resolutionId: RES_ID, vote: 'abstention' })
    expect(res.status).toBe(200)
    expect(insertions()).toHaveLength(1)
    expect(majs()).toEqual([{
      table: 'syndic_votes_correspondance',
      valeurs: expect.objectContaining({ vote: 'abstention', coproprio_id: ID_FICHE_1 }),
      filtres: [['eq', 'resolution_id', RES_ID], ['eq', 'cabinet_id', CABINET], ['in', 'coproprio_id', [ID_FICHE_1, ID_FICHE_2]]],
    }])
    expect(await res.json()).toMatchObject({ vote: { vote: 'abstention', modifie: true } })
    expect(h.loggerError).not.toHaveBeenCalled()
  })

  it('doublon puis reprise en échec → 500, journalisé', async () => {
    h.etat.erreurInsertion = { code: '23505', message: 'duplicate' }
    h.etat.erreurMaj = { code: '42501', message: 'permission denied' }
    const res = await voter({ resolutionId: RES_ID, vote: 'pour' })
    expect(res.status).toBe(500)
    expect(h.loggerError).toHaveBeenCalledWith('[COPRO VOTE] reprise après doublon', expect.objectContaining({ code: '42501' }))
  })

  it('un seul lot dans l’immeuble : tantièmes du lot, lecture sur cette seule fiche', async () => {
    h.etat.tables.syndic_coproprios = [fiche({ tantieme: '450.4' })]
    await voter({ resolutionId: RES_ID, vote: 'pour' })
    expect(insertions()[0].ligne).toMatchObject({ tantiemes: 450, coproprio_id: ID_FICHE_1 })
    const lecture = requetesSur('syndic_votes_correspondance')[0].filtres.map(f => [f.op, f.colonne, f.valeur])
    expect(lecture).toContainEqual(['in', 'coproprio_id', [ID_FICHE_1]])
  })

  it('?lot= : la fiche affichée est celle du lot choisi, les tantièmes restent ceux de tous mes lots de l’immeuble', async () => {
    await voter({ resolutionId: RES_ID, vote: 'pour' }, `https://vitfix.io/api/coproprietaire/assemblees/vote?lot=${ID_FICHE_2}`)
    expect(insertions()[0].ligne).toMatchObject({ coproprio_id: ID_FICHE_2, tantiemes: 750 })
  })

  it('?lot= sur mon lot d’un autre immeuble : l’assemblée n’est plus la sienne → 404', async () => {
    const res = await voter({ resolutionId: RES_ID, vote: 'pour' }, `https://vitfix.io/api/coproprietaire/assemblees/vote?lot=${ID_FICHE_AILLEURS}`)
    expect(res.status).toBe(404)
    expect(insertions()).toHaveLength(0)
  })

  it('juste avant la date limite : encore ouvert', async () => {
    vi.setSystemTime(new Date('2026-11-17T17:59:59Z'))
    expect((await voter({ resolutionId: RES_ID, vote: 'pour' })).status).toBe(200)
  })

  it('jamais d’écriture sur syndic_resolutions (compteurs consolidés par le syndic en séance)', async () => {
    await voter({ resolutionId: RES_ID, vote: 'pour' })
    h.etat.tables.syndic_votes_correspondance = [{ id: VOTE_ID, cabinet_id: CABINET, resolution_id: RES_ID, coproprio_id: ID_FICHE_1, vote: 'pour' }]
    await voter({ resolutionId: RES_ID, vote: 'contre' })
    h.etat.erreurInsertion = { code: '23505', message: 'duplicate' }
    h.etat.tables.syndic_votes_correspondance = []
    await voter({ resolutionId: RES_ID, vote: 'abstention' })
    expect(ecrituresSur('syndic_resolutions')).toHaveLength(0)
    expect(ecrituresSur('syndic_assemblees')).toHaveLength(0)
    expect(ecrituresSur('syndic_votes_correspondance').length).toBeGreaterThanOrEqual(3)
  })
})
