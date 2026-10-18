// tests/lib/coproprietaire-acces.test.ts
//
// lib/coproprietaire/acces.ts — rattachement du compte connecté à sa fiche syndic_coproprios :
//   - coproprio → email_proprietaire seulement, locataire → email_locataire seulement (casse ignorée,
//     jokers LIKE échappés, égalité stricte après lecture), e-mail du compte confirmé, accès activé
//     par le syndic (acces_portail / acces_portail_locataire), choix du lot parmi les lots activés ;
//   - super admin (direct ou en « vue copropriétaire ») : son cabinet seulement, fiche désignée
//     par id ou e-mail (e-mail inconnu → introuvable, jamais une autre personne), sinon première
//     fiche à l'accès activé ;
//   - autres rôles refusés ; erreurs Supabase journalisées et rendues par le code `erreur`.
// Supabase est simulé par un client en mémoire qui applique ilike / eq comme PostgREST.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient, User } from '@supabase/supabase-js'

const h = vi.hoisted(() => ({ loggerError: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: h.loggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))

const { resoudreCoproprietaire, echapperMotifLike, emailNormalise, estSuperAdmin, accesActive, statutHttpAcces } =
  await import('@/lib/coproprietaire/acces')

type Ligne = Record<string, unknown>
type Filtre = { op: 'ilike' | 'eq'; colonne: string; valeur: unknown }

const etat = {
  fiches: [] as Ligne[],
  erreur: null as null | { code: string; message: string },
  requetes: [] as Array<{ table: string; filtres: Filtre[]; limite: number | null }>,
}

/** Motif LIKE de PostgREST → expression régulière (% et * = .*, _ = ., \x = x littéral). */
function motifVersRegex(motif: string): RegExp {
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

function appliquer(lignes: Ligne[], filtres: Filtre[]): Ligne[] {
  return lignes.filter(l => filtres.every(f => {
    const v = l[f.colonne]
    if (f.op === 'eq') return v === f.valeur
    return typeof v === 'string' && motifVersRegex(String(f.valeur)).test(v)
  }))
}

/** Client Supabase simulé : chaîne select/ilike/eq/limit/maybeSingle, résolu à l'await. */
function clientSimule(): SupabaseClient {
  const from = (table: string) => {
    const requete = { table, filtres: [] as Filtre[], limite: null as number | null }
    etat.requetes.push(requete)
    let unique = false
    const resultat = () => {
      if (etat.erreur) return { data: null, error: etat.erreur }
      let data = table === 'syndic_coproprios' ? appliquer(etat.fiches, requete.filtres) : []
      if (requete.limite !== null) data = data.slice(0, requete.limite)
      return unique ? { data: data[0] ?? null, error: null } : { data, error: null }
    }
    const q: Record<string, unknown> = {}
    q.select = () => q
    q.ilike = (colonne: string, valeur: unknown) => { requete.filtres.push({ op: 'ilike', colonne, valeur }); return q }
    q.eq = (colonne: string, valeur: unknown) => { requete.filtres.push({ op: 'eq', colonne, valeur }); return q }
    q.limit = (n: number) => { requete.limite = n; return q }
    q.maybeSingle = () => { unique = true; return q }
    q.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resultat()).then(ok, ko)
    return q
  }
  return { from } as unknown as SupabaseClient
}

const CABINET = '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4'
const AUTRE_CABINET = '11111111-2222-4333-8444-555555555555'
const ID_FICHE_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
const ID_FICHE_2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
const ID_FICHE_3 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'

function fiche(surcharge: Ligne): Ligne {
  return {
    id: ID_FICHE_1, cabinet_id: CABINET, immeuble: 'Résidence Le Prado', batiment: 'D', etage: 4, numero_porte: '12',
    nom_proprietaire: 'Xavier', prenom_proprietaire: 'Géraldine', email_proprietaire: 'Geraldine.Xavier@Email.com',
    tel_proprietaire: '06 12 34 56 78', nom_locataire: null, prenom_locataire: null, email_locataire: null,
    tel_locataire: null, est_occupe: false, tantieme: 450, solde: -855, acces_portail: true, notes: 'note interne',
    ...surcharge,
  }
}

function utilisateur(role: string, email = 'geraldine.xavier@email.com', metadonnees: Ligne = {}, confirme = true): User {
  return {
    id: role === 'super_admin' ? CABINET : 'u-copro',
    email,
    email_confirmed_at: confirme ? '2026-01-01T00:00:00Z' : undefined,
    app_metadata: { role, ...metadonnees },
  } as unknown as User
}

const requetesSur = (table: string) => etat.requetes.filter(r => r.table === table)

beforeEach(() => {
  etat.fiches = []
  etat.erreur = null
  etat.requetes = []
  h.loggerError.mockClear()
})

describe('utilitaires', () => {
  it('échappe les jokers LIKE et normalise les e-mails', () => {
    expect(echapperMotifLike('a_b%c\\d')).toBe('a\\_b\\%c\\\\d')
    expect(emailNormalise('  Geraldine.Xavier@Email.com ')).toBe('geraldine.xavier@email.com')
    expect(emailNormalise(null)).toBe('')
  })

  it('reconnaît le super admin direct et en vue copropriétaire', () => {
    expect(estSuperAdmin(utilisateur('super_admin'))).toBe(true)
    expect(estSuperAdmin(utilisateur('coproprio', 'x@y.fr', { _original_role: 'super_admin' }))).toBe(true)
    expect(estSuperAdmin(utilisateur('coproprio'))).toBe(false)
  })

  it('accès activé : propriétaire sur acces_portail ; locataire sur acces_portail_locataire, ou acces_portail tant que la colonne manque', () => {
    const f = fiche({}) as unknown as Parameters<typeof accesActive>[0]
    expect(accesActive(f, 'proprietaire')).toBe(true)
    expect(accesActive({ ...f, acces_portail: false }, 'proprietaire')).toBe(false)
    expect(accesActive(f, 'locataire')).toBe(true)
    expect(accesActive({ ...f, acces_portail_locataire: null }, 'locataire')).toBe(true)
    expect(accesActive({ ...f, acces_portail_locataire: false }, 'locataire')).toBe(false)
    expect(accesActive({ ...f, acces_portail: false, acces_portail_locataire: true }, 'locataire')).toBe(true)
  })

  it('associe un statut HTTP à chaque code de refus', () => {
    expect(statutHttpAcces('non_authentifie')).toBe(401)
    expect(statutHttpAcces('role_interdit')).toBe(403)
    expect(statutHttpAcces('email_non_confirme')).toBe(403)
    expect(statutHttpAcces('acces_non_active')).toBe(403)
    expect(statutHttpAcces('fiche_introuvable')).toBe(404)
    expect(statutHttpAcces('erreur')).toBe(500)
  })
})

describe('refus', () => {
  it('sans utilisateur → non_authentifie, sans requête', async () => {
    expect(await resoudreCoproprietaire(null, clientSimule())).toEqual({ ok: false, code: 'non_authentifie' })
    expect(etat.requetes).toHaveLength(0)
  })

  it.each(['artisan', 'client', 'syndic', 'syndic_gestionnaire', 'pro_societe', ''])('rôle %s → role_interdit', async role => {
    etat.fiches = [fiche({})]
    expect(await resoudreCoproprietaire(utilisateur(role), clientSimule())).toEqual({ ok: false, code: 'role_interdit' })
    expect(etat.requetes).toHaveLength(0)
  })

  it('compte sans e-mail → fiche_introuvable', async () => {
    expect(await resoudreCoproprietaire(utilisateur('coproprio', ''), clientSimule())).toEqual({ ok: false, code: 'fiche_introuvable' })
  })

  it('e-mail du compte non confirmé → email_non_confirme, sans requête', async () => {
    etat.fiches = [fiche({})]
    expect(await resoudreCoproprietaire(utilisateur('coproprio', 'geraldine.xavier@email.com', {}, false), clientSimule())).toEqual({ ok: false, code: 'email_non_confirme' })
    expect(etat.requetes).toHaveLength(0)
  })

  it('aucune fiche à cet e-mail → fiche_introuvable ; seule la colonne du rôle est cherchée', async () => {
    etat.fiches = [fiche({ email_proprietaire: 'autre@exemple.fr', email_locataire: 'geraldine.xavier@email.com' })]
    expect(await resoudreCoproprietaire(utilisateur('coproprio'), clientSimule())).toEqual({ ok: false, code: 'fiche_introuvable' })
    expect(requetesSur('syndic_coproprios').map(r => r.filtres[0].colonne)).toEqual(['email_proprietaire'])
  })

  it('accès non activé par le syndic → acces_non_active', async () => {
    etat.fiches = [fiche({ acces_portail: false })]
    expect(await resoudreCoproprietaire(utilisateur('coproprio'), clientSimule())).toEqual({ ok: false, code: 'acces_non_active' })
  })

  it('erreur Supabase → erreur, journalisée', async () => {
    etat.erreur = { code: '42P01', message: 'relation does not exist' }
    expect(await resoudreCoproprietaire(utilisateur('coproprio'), clientSimule())).toEqual({ ok: false, code: 'erreur' })
    expect(h.loggerError).toHaveBeenCalledTimes(1)
  })
})

describe('copropriétaire', () => {
  it('fiche trouvée par e-mail, casse ignorée ; cabinet et e-mail de la fiche ; une seule requête', async () => {
    etat.fiches = [fiche({})]
    const r = await resoudreCoproprietaire(utilisateur('coproprio', 'GERALDINE.xavier@email.COM'), clientSimule())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.acces.cabinetId).toBe(CABINET)
    expect(r.acces.fiche.id).toBe(ID_FICHE_1)
    expect(r.acces.role).toBe('proprietaire')
    expect(r.acces.email).toBe('geraldine.xavier@email.com')
    expect(r.acces.superAdmin).toBe(false)
    expect(r.acces.fiches).toHaveLength(1)
    expect(requetesSur('syndic_coproprios')).toHaveLength(1)
  })

  it('les jokers de l’e-mail sont échappés dans le motif ilike', async () => {
    etat.fiches = [fiche({ email_proprietaire: 'jean_pierre@exemple.fr' }), fiche({ id: ID_FICHE_2, email_proprietaire: 'jeanXpierre@exemple.fr' })]
    const r = await resoudreCoproprietaire(utilisateur('coproprio', 'jean_pierre@exemple.fr'), clientSimule())
    expect(r.ok && r.acces.fiche.id).toBe(ID_FICHE_1)
    expect(requetesSur('syndic_coproprios')[0].filtres[0].valeur).toBe('jean\\_pierre@exemple.fr')
  })

  it('une fiche renvoyée par le joker « * » de PostgREST mais d’un autre e-mail est ignorée', async () => {
    etat.fiches = [fiche({ email_proprietaire: 'ab@exemple.fr' })]
    expect(await resoudreCoproprietaire(utilisateur('coproprio', 'a*@exemple.fr'), clientSimule())).toEqual({ ok: false, code: 'fiche_introuvable' })
  })

  it('plusieurs lots : premier lot ACTIVÉ par immeuble / bâtiment / étage ; seuls les lots activés sont listés ; lot choisi par coproprioId', async () => {
    etat.fiches = [
      fiche({ id: ID_FICHE_2, batiment: 'D', etage: 4, numero_porte: '12' }),
      fiche({ id: ID_FICHE_1, batiment: 'A', etage: 10, numero_porte: '3' }),
      fiche({ id: ID_FICHE_3, batiment: 'A', etage: 2, numero_porte: '7', acces_portail: false }),
    ]
    const defaut = await resoudreCoproprietaire(utilisateur('coproprio'), clientSimule())
    expect(defaut.ok).toBe(true)
    if (!defaut.ok) return
    // Étage 2 non activé → étage 10 (tri numérique, pas alphabétique) avant le bâtiment D.
    expect(defaut.acces.fiche.id).toBe(ID_FICHE_1)
    expect(defaut.acces.fiches.map(f => f.id).sort()).toEqual([ID_FICHE_1, ID_FICHE_2])

    const choisi = await resoudreCoproprietaire(utilisateur('coproprio'), clientSimule(), { coproprioId: ID_FICHE_2 })
    expect(choisi.ok && choisi.acces.fiche.id).toBe(ID_FICHE_2)
    // Un lot non activé ne peut pas être choisi.
    const refuse = await resoudreCoproprietaire(utilisateur('coproprio'), clientSimule(), { coproprioId: ID_FICHE_3 })
    expect(refuse.ok && refuse.acces.fiche.id).toBe(ID_FICHE_1)
  })

  it('un coproprioId inconnu retombe sur le premier lot', async () => {
    etat.fiches = [fiche({})]
    const r = await resoudreCoproprietaire(utilisateur('coproprio'), clientSimule(), { coproprioId: ID_FICHE_2 })
    expect(r.ok && r.acces.fiche.id).toBe(ID_FICHE_1)
  })

  it('locataire : fiche trouvée par email_locataire seulement, rôle locataire', async () => {
    etat.fiches = [fiche({ email_proprietaire: 'proprio@exemple.fr', email_locataire: 'Loc@Exemple.fr', est_occupe: true })]
    const r = await resoudreCoproprietaire(utilisateur('locataire', 'loc@exemple.fr'), clientSimule())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.acces.role).toBe('locataire')
    expect(r.acces.email).toBe('loc@exemple.fr')
    expect(requetesSur('syndic_coproprios').map(q => q.filtres[0].colonne)).toEqual(['email_locataire'])
  })

  it('un rôle locataire avec l’e-mail d’un PROPRIÉTAIRE n’obtient rien (jamais promu propriétaire)', async () => {
    etat.fiches = [fiche({})]
    expect(await resoudreCoproprietaire(utilisateur('locataire', 'geraldine.xavier@email.com'), clientSimule())).toEqual({ ok: false, code: 'fiche_introuvable' })
  })

  it('un rôle coproprio dont l’e-mail n’est que locataire n’obtient rien', async () => {
    etat.fiches = [fiche({ email_proprietaire: 'proprio@exemple.fr', email_locataire: 'loc@exemple.fr' })]
    expect(await resoudreCoproprietaire(utilisateur('coproprio', 'loc@exemple.fr'), clientSimule())).toEqual({ ok: false, code: 'fiche_introuvable' })
  })

  it('locataire : accès refusé si acces_portail_locataire est faux, même avec acces_portail vrai', async () => {
    etat.fiches = [fiche({ email_locataire: 'loc@exemple.fr', acces_portail: true, acces_portail_locataire: false })]
    expect(await resoudreCoproprietaire(utilisateur('locataire', 'loc@exemple.fr'), clientSimule())).toEqual({ ok: false, code: 'acces_non_active' })
  })
})

describe('super admin (démo)', () => {
  const superAdmin = utilisateur('super_admin', 'admincvlho@gmail.com')
  const vueCopro = utilisateur('coproprio', 'admincvlho@gmail.com', { _original_role: 'super_admin' })
  vueCopro.id = CABINET

  it('fiche désignée par e-mail dans SON cabinet, accès non soumis à acces_portail ni à la confirmation d’e-mail', async () => {
    etat.fiches = [
      fiche({ acces_portail: false }),
      fiche({ id: ID_FICHE_2, cabinet_id: AUTRE_CABINET }),
    ]
    const r = await resoudreCoproprietaire(vueCopro, clientSimule(), { email: 'Geraldine.Xavier@email.com' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.acces.cabinetId).toBe(CABINET)
    expect(r.acces.fiche.id).toBe(ID_FICHE_1)
    expect(r.acces.superAdmin).toBe(true)
    expect(r.acces.email).toBe('geraldine.xavier@email.com')
    const filtres = requetesSur('syndic_coproprios')[0].filtres
    expect(filtres).toContainEqual({ op: 'eq', colonne: 'cabinet_id', valeur: CABINET })
  })

  it('e-mail désigné connu seulement comme locataire → fiche locataire', async () => {
    etat.fiches = [fiche({ email_proprietaire: 'proprio@exemple.fr', email_locataire: 'loc@exemple.fr' })]
    const r = await resoudreCoproprietaire(superAdmin, clientSimule(), { email: 'loc@exemple.fr' })
    expect(r.ok && r.acces.role).toBe('locataire')
  })

  it('sans option : première fiche du cabinet dont l’accès est activé', async () => {
    etat.fiches = [
      fiche({ id: ID_FICHE_1, batiment: 'A', acces_portail: false }),
      fiche({ id: ID_FICHE_2, batiment: 'B', acces_portail: true, email_proprietaire: 'b@exemple.fr' }),
      fiche({ id: ID_FICHE_3, batiment: 'C', cabinet_id: AUTRE_CABINET }),
    ]
    const r = await resoudreCoproprietaire(superAdmin, clientSimule())
    expect(r.ok && r.acces.fiche.id).toBe(ID_FICHE_2)
    expect(r.ok && r.acces.email).toBe('b@exemple.fr')
  })

  it('e-mail inconnu du cabinet → fiche_introuvable (jamais une autre personne)', async () => {
    etat.fiches = [fiche({ email_proprietaire: 'autre@exemple.fr' })]
    expect(await resoudreCoproprietaire(superAdmin, clientSimule(), { email: 'inconnu@exemple.fr' })).toEqual({ ok: false, code: 'fiche_introuvable' })
  })

  it('fiche désignée par id : seulement dans son cabinet', async () => {
    etat.fiches = [fiche({ id: ID_FICHE_2, cabinet_id: AUTRE_CABINET })]
    expect(await resoudreCoproprietaire(superAdmin, clientSimule(), { coproprioId: ID_FICHE_2 })).toEqual({ ok: false, code: 'fiche_introuvable' })
    const filtres = requetesSur('syndic_coproprios')[0].filtres
    expect(filtres).toContainEqual({ op: 'eq', colonne: 'cabinet_id', valeur: CABINET })

    etat.fiches = [fiche({ id: ID_FICHE_2 })]
    const r = await resoudreCoproprietaire(superAdmin, clientSimule(), { coproprioId: ID_FICHE_2 })
    expect(r.ok && r.acces.fiche.id).toBe(ID_FICHE_2)
  })

  it('un coproprioId mal formé est ignoré (pas de requête par id)', async () => {
    etat.fiches = [fiche({})]
    const r = await resoudreCoproprietaire(superAdmin, clientSimule(), { coproprioId: "x' or 1=1" })
    expect(r.ok && r.acces.fiche.id).toBe(ID_FICHE_1)
    expect(requetesSur('syndic_coproprios')[0].filtres.some(f => f.colonne === 'id')).toBe(false)
  })

  it('cabinet sans fiche → fiche_introuvable', async () => {
    expect(await resoudreCoproprietaire(superAdmin, clientSimule())).toEqual({ ok: false, code: 'fiche_introuvable' })
  })
})
