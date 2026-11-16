// Catalogue de prestations BTP (lib/btp/catalogue-prestations.ts) : lecture du navigateur et du serveur, report
// des identifiants de services sans écraser un catalogue restauré, reprise d'un service déjà publié.
// Constats stockage-local-miroir-5 et -10 de l'audit du 11/11/2026.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const jeton = vi.hoisted(() => ({ valeur: 'jeton-test' as string | null }))
vi.mock('@/lib/auth/jeton-acces', () => ({ jetonAcces: async () => jeton.valeur }))

import {
  appliquerLiensServices, cleCatalogueBTP, cleCatalogueBTPAncienne, lireCatalogueAuServeur, lireCatalogueBTPNavigateur,
  lireCatalogueLocal, prendreServicePublie, rangerServicesParNom, reporterLiensServices,
} from '@/lib/btp/catalogue-prestations'

const FICHE = 'fiche-btp-lib'
const CLE = cleCatalogueBTP(FICHE)
const prest = (id: number, name: string, supabase_id?: string) => ({ id, name, type: 'prest', ...(supabase_id ? { supabase_id } : {}) })

function serveur(statut: number, corps: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(corps), { status: statut })))
}

beforeEach(() => {
  localStorage.clear()
  jeton.valeur = 'jeton-test'
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('clés du catalogue', () => {
  it('module : v5 ; ancienne copie : v4', () => {
    expect(CLE).toBe('fixit_prestations_btp_v5_fiche-btp-lib')
    expect(cleCatalogueBTPAncienne(FICHE)).toBe('fixit_prestations_btp_v4_fiche-btp-lib')
  })
})

describe('lireCatalogueLocal', () => {
  it('présent, absent, ou illisible (pas une liste, JSON invalide)', () => {
    expect(lireCatalogueLocal(CLE)).toEqual({ etat: 'absent' })
    localStorage.setItem(CLE, '[]')
    expect(lireCatalogueLocal(CLE)).toEqual({ etat: 'present', catalogue: [] })
    localStorage.setItem(CLE, '{"a":1}')
    expect(lireCatalogueLocal(CLE)).toEqual({ etat: 'illisible' })
    localStorage.setItem(CLE, '[{')
    expect(lireCatalogueLocal(CLE)).toEqual({ etat: 'illisible' })
  })
})

describe('lireCatalogueBTPNavigateur (formulaire)', () => {
  const parDefaut = () => [prest(1, 'Par défaut')]

  it('le module d\'abord, puis l\'ancienne copie, puis le jeu par défaut ; rien n\'est écrit', () => {
    expect(lireCatalogueBTPNavigateur(FICHE, parDefaut)).toEqual(parDefaut())
    localStorage.setItem(cleCatalogueBTPAncienne(FICHE), JSON.stringify([prest(2, 'Ancienne')]))
    expect(lireCatalogueBTPNavigateur(FICHE, parDefaut)).toEqual([prest(2, 'Ancienne')])
    localStorage.setItem(CLE, JSON.stringify([prest(3, 'Module')]))
    expect(lireCatalogueBTPNavigateur(FICHE, parDefaut)).toEqual([prest(3, 'Module')])
    expect(localStorage).toHaveLength(2)
  })

  it('sans fiche, ou valeur du module illisible : aucun catalogue', () => {
    expect(lireCatalogueBTPNavigateur(undefined, parDefaut)).toEqual([])
    localStorage.setItem(CLE, 'pas du JSON')
    localStorage.setItem(cleCatalogueBTPAncienne(FICHE), JSON.stringify([prest(2, 'Ancienne')]))
    expect(lireCatalogueBTPNavigateur(FICHE, parDefaut)).toEqual([])
  })

  it('un élément qui n\'est pas un objet est écarté', () => {
    localStorage.setItem(CLE, JSON.stringify([null, 'texte', prest(4, 'Gardée')]))
    expect(lireCatalogueBTPNavigateur(FICHE, parDefaut)).toEqual([prest(4, 'Gardée')])
  })
})

describe('lireCatalogueAuServeur', () => {
  it('présent : la valeur enregistrée (liste, ou texte JSON d\'une liste)', async () => {
    serveur(200, { entries: { [CLE]: [prest(1, 'Dalle')] } })
    expect(await lireCatalogueAuServeur(CLE)).toEqual({ etat: 'present', catalogue: [prest(1, 'Dalle')] })
    serveur(200, { entries: { [CLE]: JSON.stringify([prest(1, 'Dalle')]) } })
    expect(await lireCatalogueAuServeur(CLE)).toEqual({ etat: 'present', catalogue: [prest(1, 'Dalle')] })
  })

  it('absent seulement quand le serveur a répondu sans cette clé', async () => {
    serveur(200, { entries: { fixit_autre_cle: 1 } })
    expect(await lireCatalogueAuServeur(CLE)).toEqual({ etat: 'absent' })
  })

  it('inconnu : pas de session, erreur, réponse inattendue, réponse tronquée au plafond de la route', async () => {
    jeton.valeur = null
    serveur(200, { entries: {} })
    expect(await lireCatalogueAuServeur(CLE)).toEqual({ etat: 'inconnu' })
    jeton.valeur = 'jeton-test'
    serveur(401, { error: 'Non authentifié' })
    expect(await lireCatalogueAuServeur(CLE)).toEqual({ etat: 'inconnu' })
    serveur(500, { error: 'Erreur lors du chargement' })
    expect(await lireCatalogueAuServeur(CLE)).toEqual({ etat: 'inconnu' })
    serveur(200, { rien: true })
    expect(await lireCatalogueAuServeur(CLE)).toEqual({ etat: 'inconnu' })
    serveur(200, { entries: { [CLE]: { pas: 'une liste' } } })
    expect(await lireCatalogueAuServeur(CLE)).toEqual({ etat: 'inconnu' })
    const pleines = Object.fromEntries(Array.from({ length: 2000 }, (_, i) => [`fixit_cle_${i}`, i]))
    serveur(200, { entries: pleines })
    expect(await lireCatalogueAuServeur(CLE)).toEqual({ etat: 'inconnu' })
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    expect(await lireCatalogueAuServeur(CLE)).toEqual({ etat: 'inconnu' })
  })

  it('envoie le jeton de la session', async () => {
    serveur(200, { entries: {} })
    await lireCatalogueAuServeur(CLE)
    const [url, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/user-storage')
    expect(options.headers).toEqual({ Authorization: 'Bearer jeton-test' })
  })
})

describe('report des identifiants de services', () => {
  it('même identifiant, même nom, même type, et seulement là où aucun identifiant n\'est noté', () => {
    const catalogue = [prest(1, 'Dalle'), prest(2, 'Enduit', 'svc-2'), { id: 3, name: 'Dalle', type: 'mat' }]
    const liens = [
      { id: 1, name: 'Dalle', type: 'prest', supabase_id: 'svc-1' },
      { id: 2, name: 'Enduit', type: 'prest', supabase_id: 'svc-autre' },
      { id: 3, name: 'Dalle', type: 'prest', supabase_id: 'svc-3' },
    ]
    expect(appliquerLiensServices(catalogue, liens)).toEqual([prest(1, 'Dalle', 'svc-1'), prest(2, 'Enduit', 'svc-2'), { id: 3, name: 'Dalle', type: 'mat' }])
    expect(appliquerLiensServices(catalogue, [{ id: 1, name: 'Autre nom', type: 'prest', supabase_id: 'svc-1' }])).toBe(catalogue)
  })

  it('relit le catalogue enregistré au moment d\'écrire', () => {
    localStorage.setItem(CLE, JSON.stringify([prest(1, 'Dalle'), prest(2, 'Ajoutée ailleurs', 'svc-9')]))
    reporterLiensServices(CLE, [{ id: 1, name: 'Dalle', type: 'prest', supabase_id: 'svc-1' }], () => [prest(1, 'Dalle')])
    expect(JSON.parse(localStorage.getItem(CLE)!)).toEqual([prest(1, 'Dalle', 'svc-1'), prest(2, 'Ajoutée ailleurs', 'svc-9')])
  })

  it('clé absente : le catalogue affiché est écrit avec ses identifiants ; illisible ou sans correspondance : rien', () => {
    reporterLiensServices(CLE, [{ id: 1, name: 'Dalle', type: 'prest', supabase_id: 'svc-1' }], () => [prest(1, 'Dalle')])
    expect(JSON.parse(localStorage.getItem(CLE)!)).toEqual([prest(1, 'Dalle', 'svc-1')])
    localStorage.setItem(CLE, 'illisible')
    reporterLiensServices(CLE, [{ id: 1, name: 'Dalle', type: 'prest', supabase_id: 'svc-1' }], () => [prest(1, 'Dalle')])
    expect(localStorage.getItem(CLE)).toBe('illisible')
    localStorage.removeItem(CLE)
    reporterLiensServices(CLE, [{ id: 1, name: 'Renommée', type: 'prest', supabase_id: 'svc-1' }], () => [prest(1, 'Dalle')])
    expect(localStorage.getItem(CLE)).toBeNull()
  })
})

describe('reprise d\'un service déjà publié', () => {
  it('par nom, jamais un service déjà relié à un autre élément, chacun une seule fois', () => {
    const parNom = rangerServicesParNom([{ id: 'a', name: 'Dalle' }, { id: 'b', name: 'Dalle' }, { id: 'c', name: 'Enduit' }, { id: 7, name: 'Invalide' }])
    const pris = new Set(['a'])
    expect(prendreServicePublie(parNom, 'Dalle', pris)).toBe('b')
    expect(prendreServicePublie(parNom, 'Dalle', pris)).toBeNull()
    expect(prendreServicePublie(parNom, 'Enduit', pris)).toBe('c')
    expect(prendreServicePublie(parNom, 'Invalide', pris)).toBeNull()
  })
})
