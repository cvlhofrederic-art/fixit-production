// tests/api/copro-message.test.ts
//
// POST /api/coproprietaire/signalement/message — message du copropriétaire connecté dans le fil de
// l'une de SES demandes : le signalement doit appartenir au cabinet de sa fiche et porter son e-mail
// en demandeur (sinon 404, sans dire s'il existe). Insertion dans syndic_signalement_messages au rôle
// « coproprio », signée « Prénom Nom », puis updated_at du signalement rafraîchi.
// La route est testée par son POST exporté ; Supabase est simulé en mémoire.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

type Ligne = Record<string, unknown>

const h = vi.hoisted(() => {
  type LigneH = Record<string, unknown>
  type FiltreH = { op: string; colonne: string; valeur: unknown }
  type Requete = { table: string; filtres: FiltreH[]; insertion: LigneH | null; maj: LigneH | null }

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
      case 'is': return f.valeur === null ? v === null || v === undefined : v === f.valeur
      case 'ilike': return typeof v === 'string' && motifVersRegex(String(f.valeur)).test(v)
      default: return true
    }
  }

  const from = (table: string) => {
    const requete: Requete = { table, filtres: [], insertion: null, maj: null }
    etat.requetes.push(requete)
    let unique = false
    const resultat = () => {
      const erreur = etat.erreurs[table]
      if (erreur) return { data: null, error: erreur }
      if (requete.insertion) {
        if (etat.erreurInsertion) return { data: null, error: etat.erreurInsertion }
        const ligne = { id: 'msg-nouveau', created_at: '2026-10-17T10:00:00.000Z', ...requete.insertion }
        return { data: unique ? ligne : [ligne], error: null }
      }
      if (requete.maj) return { data: null, error: etat.erreurMaj }
      const data = (etat.tables[table] ?? []).filter(l => requete.filtres.every(f => passe(l, f)))
      return unique ? { data: data[0] ?? null, error: null } : { data, error: null }
    }
    const q: Record<string, unknown> = {}
    q.select = () => q
    for (const op of ['eq', 'ilike', 'is']) {
      q[op] = (colonne: string, valeur: unknown) => { requete.filtres.push({ op, colonne, valeur }); return q }
    }
    q.limit = () => q
    q.maybeSingle = () => { unique = true; return q }
    q.single = () => { unique = true; return q }
    q.insert = (ligne: LigneH) => { requete.insertion = ligne; return q }
    q.update = (valeurs: LigneH) => { requete.maj = valeurs; return q }
    q.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resultat()).then(ok, ko)
    return q
  }

  return { etat, from, loggerError: vi.fn(), loggerWarn: vi.fn() }
})

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: h.loggerError, warn: h.loggerWarn, info: vi.fn(), debug: vi.fn() } }))
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

const { POST } = await import('@/app/api/coproprietaire/signalement/message/route')

// ── Jeu de données ───────────────────────────────────────────────────────────

const CABINET = '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4'
const AUTRE_CABINET = '11111111-2222-4333-8444-555555555555'
const ID_FICHE_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
const SIG_ID = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'
const EMAIL_MOI = 'geraldine.xavier@email.com'

function fiche(surcharge: Ligne = {}): Ligne {
  return {
    id: ID_FICHE_1, cabinet_id: CABINET, immeuble: 'Résidence Le Prado', batiment: 'D', etage: 4, numero_porte: '12',
    nom_proprietaire: 'Xavier', prenom_proprietaire: 'Géraldine', email_proprietaire: 'Geraldine.Xavier@Email.com',
    tel_proprietaire: null, nom_locataire: 'Durand', prenom_locataire: 'Paul', email_locataire: 'paul.durand@exemple.fr',
    tel_locataire: null, est_occupe: true, tantieme: 450, solde: 0, acces_portail: true, acces_portail_locataire: true,
    ...surcharge,
  }
}

function signalement(surcharge: Ligne = {}): Ligne {
  return { id: SIG_ID, cabinet_id: CABINET, demandeur_email: EMAIL_MOI, deleted_at: null, ...surcharge }
}

const utilisateur = (role: string, email = 'Geraldine.Xavier@Email.com'): Ligne =>
  ({ id: 'u-copro', email, email_confirmed_at: '2026-01-01T00:00:00Z', app_metadata: { role } })

function poster(corps: unknown) {
  return POST(new NextRequest('https://vitfix.io/api/coproprietaire/signalement/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer jeton-test' },
    body: typeof corps === 'string' ? corps : JSON.stringify(corps),
  }))
}

const requetesSur = (table: string) => h.etat.requetes.filter(r => r.table === table)
const insertions = () => h.etat.requetes.filter(r => r.insertion).map(r => ({ table: r.table, ligne: r.insertion as Ligne }))
const majs = () => h.etat.requetes.filter(r => r.maj).map(r => ({ table: r.table, valeurs: r.maj as Ligne, filtres: r.filtres.map(f => [f.op, f.colonne, f.valeur]) }))

beforeEach(() => {
  h.etat.user = utilisateur('coproprio')
  h.etat.tables = { syndic_coproprios: [fiche()], syndic_signalements: [signalement()] }
  h.etat.erreurs = {}
  h.etat.erreurInsertion = null
  h.etat.erreurMaj = null
  h.etat.requetes = []
  h.loggerError.mockClear()
  h.loggerWarn.mockClear()
})

describe('POST /api/coproprietaire/signalement/message — refus', () => {
  it('sans utilisateur → 401, rien n’est écrit', async () => {
    h.etat.user = null
    const res = await poster({ signalementId: SIG_ID, texte: 'Bonjour' })
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'non_authentifie' })
    expect(insertions()).toHaveLength(0)
  })

  it('rôle syndic → 403', async () => {
    h.etat.user = utilisateur('syndic', 'syndic@exemple.fr')
    expect((await poster({ signalementId: SIG_ID, texte: 'Bonjour' })).status).toBe(403)
  })

  it.each([
    ['signalementId absent', { texte: 'Bonjour' }],
    ['signalementId mal formé', { signalementId: 'sig-1', texte: 'Bonjour' }],
    ['texte vide', { signalementId: SIG_ID, texte: '   ' }],
    ['texte trop long', { signalementId: SIG_ID, texte: 'x'.repeat(5001) }],
    ['JSON invalide', '{pas du json'],
  ])('corps invalide (%s) → 400, rien n’est lu ni écrit', async (_cas, corps) => {
    const res = await poster(corps)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Données invalides' })
    expect(requetesSur('syndic_signalements')).toHaveLength(0)
    expect(insertions()).toHaveLength(0)
  })

  it('signalement d’un autre e-mail → 404 sans détail ; la lecture est filtrée sur MON e-mail en minuscules', async () => {
    h.etat.tables.syndic_signalements = [signalement({ demandeur_email: 'voisin@exemple.fr' })]
    const res = await poster({ signalementId: SIG_ID, texte: 'Bonjour' })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not_found' })
    const filtres = requetesSur('syndic_signalements')[0].filtres.map(f => [f.op, f.colonne, f.valeur])
    expect(filtres).toContainEqual(['eq', 'id', SIG_ID])
    expect(filtres).toContainEqual(['eq', 'cabinet_id', CABINET])
    expect(filtres).toContainEqual(['eq', 'demandeur_email', EMAIL_MOI])
    expect(filtres).toContainEqual(['is', 'deleted_at', null])
    expect(insertions()).toHaveLength(0)
  })

  it('signalement d’un autre cabinet → 404', async () => {
    h.etat.tables.syndic_signalements = [signalement({ cabinet_id: AUTRE_CABINET })]
    expect((await poster({ signalementId: SIG_ID, texte: 'Bonjour' })).status).toBe(404)
    expect(insertions()).toHaveLength(0)
  })

  it('signalement supprimé → 404', async () => {
    h.etat.tables.syndic_signalements = [signalement({ deleted_at: '2026-10-01T00:00:00Z' })]
    expect((await poster({ signalementId: SIG_ID, texte: 'Bonjour' })).status).toBe(404)
  })

  it('lecture du signalement en erreur → 500, journalisée', async () => {
    h.etat.erreurs.syndic_signalements = { code: '57014', message: 'timeout' }
    const res = await poster({ signalementId: SIG_ID, texte: 'Bonjour' })
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Une erreur interne est survenue' })
    expect(h.loggerError).toHaveBeenCalledWith('[COPRO MESSAGE] lecture du signalement', expect.objectContaining({ code: '57014' }))
  })

  it('insertion refusée → 500 sans détail, journalisée, updated_at non touché', async () => {
    h.etat.erreurInsertion = { code: '23503', message: 'violates foreign key constraint' }
    const res = await poster({ signalementId: SIG_ID, texte: 'Bonjour' })
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Une erreur interne est survenue' })
    expect(h.loggerError).toHaveBeenCalledWith('[COPRO MESSAGE] insertion', expect.objectContaining({ code: '23503' }))
    expect(majs()).toHaveLength(0)
  })
})

describe('POST /api/coproprietaire/signalement/message — envoi', () => {
  it('message inséré au rôle coproprio, signé « Prénom Nom », updated_at rafraîchi, réponse deMoi', async () => {
    const res = await poster({ signalementId: SIG_ID, texte: 'Le plombier est passé, merci.' })
    expect(res.status).toBe(200)

    expect(insertions()).toEqual([{
      table: 'syndic_signalement_messages',
      ligne: { signalement_id: SIG_ID, auteur: 'Géraldine Xavier', role: 'coproprio', texte: 'Le plombier est passé, merci.' },
    }])

    const [maj] = majs()
    expect(maj.table).toBe('syndic_signalements')
    expect(typeof maj.valeurs.updated_at).toBe('string')
    expect(maj.filtres).toEqual([['eq', 'id', SIG_ID], ['eq', 'cabinet_id', CABINET]])

    expect(await res.json()).toEqual({
      message: { id: 'msg-nouveau', auteur: 'Géraldine Xavier', role: 'coproprio', texte: 'Le plombier est passé, merci.', date: '2026-10-17T10:00:00.000Z', deMoi: true },
    })
  })

  it('le texte est débarrassé de ses espaces de bord', async () => {
    await poster({ signalementId: SIG_ID, texte: '   Merci.  \n' })
    expect(insertions()[0].ligne.texte).toBe('Merci.')
  })

  it('locataire : signé du nom du locataire, signalement cherché sur l’e-mail du locataire', async () => {
    h.etat.user = utilisateur('locataire', 'Paul.Durand@Exemple.fr')
    h.etat.tables.syndic_signalements = [signalement({ demandeur_email: 'paul.durand@exemple.fr' })]
    const res = await poster({ signalementId: SIG_ID, texte: 'Bonjour' })
    expect(res.status).toBe(200)
    expect(insertions()[0].ligne).toMatchObject({ auteur: 'Paul Durand', role: 'coproprio' })
    const filtres = requetesSur('syndic_signalements')[0].filtres.map(f => [f.op, f.colonne, f.valeur])
    expect(filtres).toContainEqual(['eq', 'demandeur_email', 'paul.durand@exemple.fr'])
  })

  it('fiche sans nom ni prénom : signé de l’e-mail', async () => {
    h.etat.tables.syndic_coproprios = [fiche({ nom_proprietaire: null, prenom_proprietaire: '' })]
    await poster({ signalementId: SIG_ID, texte: 'Bonjour' })
    expect(insertions()[0].ligne.auteur).toBe(EMAIL_MOI)
  })

  it('mise à jour de updated_at en échec : avertissement seulement, le message est bien envoyé', async () => {
    h.etat.erreurMaj = { code: '42501', message: 'permission denied' }
    const res = await poster({ signalementId: SIG_ID, texte: 'Bonjour' })
    expect(res.status).toBe(200)
    expect(h.loggerWarn).toHaveBeenCalledWith('[COPRO MESSAGE] mise à jour de updated_at', { message: 'permission denied' })
    expect(h.loggerError).not.toHaveBeenCalled()
  })
})
