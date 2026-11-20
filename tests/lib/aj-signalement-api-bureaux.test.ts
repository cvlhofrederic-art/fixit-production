// tests/lib/aj-signalement-api-bureaux.test.ts
//
// Bureaux des cabinets clients (PR 2 : écrans du super admin) — clients des routes livrées par la PR 1 :
//   - routes nouvelles : GET et POST /cabinets/[id]/bureaux, PATCH /bureaux/[id] (une seule action : { nom } ou
//     { fermer }) ; chaque bureau reçu est gardé seulement s'il a la forme attendue ;
//   - codes rendus tels quels (CODES_METIER_QR) : 409 nom_pris, plafond_bureaux, bureau_utilise, bureau_requis,
//     bureau_ferme (a_reverifier existait déjà) ; 503 base_absente (migration 20261119 non appliquée) ;
//   - routes modifiées : bureauId de la création d'une fiche et d'une copropriété, { bureauId } seul (PATCH d'une fiche),
//     bureauId ou null (PATCH d'une copropriété), filtres ?bureau= de la liste des fiches et du tableau ; 207
//     bureau_non_pose à la création d'une copropriété (créée, mais sans son bureau) ;
//   - tant qu'aucun bureau n'existe, rien ne change : aucune clé « bureau » ajoutée aux fiches ni aux copropriétés, aucun
//     paramètre ni champ envoyé en plus.
// Données fictives : « Cabinet Exemple », bureaux « Nord » et « Sud », adresses @exemple.test.

import { describe, expect, it, vi } from 'vitest'
import {
  CODES_METIER_QR, chargerBureauxCabinetQr, chargerFicheGestionnaireQr, chargerGestionnairesQr, chargerTableauQr, codeDepuisReponseQr,
  creerBureauQr, creerCoproprieteQr, creerGestionnaireQr, modifierBureauQr, modifierCoproprieteQr, modifierGestionnaireQr,
  normaliserCoproprieteQr,
} from '@/lib/aj-signalement/api'
import { FILTRE_SANS_BUREAU_QR } from '@/lib/aj-signalement/bureaux'

const K1 = 'a0000000-0000-4000-8000-0000000000a1'
const B1 = 'b0000000-0000-4000-8000-0000000000b1'
const B2 = 'b0000000-0000-4000-8000-0000000000b2'
const G1 = '11111111-1111-4111-8111-111111111111'
const C1 = 'c0000000-0000-4000-8000-000000000001'

type Appel = { url: string; init?: RequestInit }

function simuler(corps: unknown, status = 200) {
  const appels: Appel[] = []
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    appels.push({ url, init })
    return new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } })
  }) as unknown as typeof fetch
  return { appels, fetchImpl, corps: (i = 0) => JSON.parse(String(appels[i].init?.body)) as unknown }
}

const nord = {
  id: B1, nom: 'Nord', ferme: false, cabinetId: K1, fermeLe: null, creeLe: '2026-11-19T08:00:00+00:00', nbGestionnaires: 2, nbCoproprietes: 3,
}
const sud = { ...nord, id: B2, nom: 'Sud', ferme: true, fermeLe: '2026-11-19T09:00:00+00:00', nbGestionnaires: 0, nbCoproprietes: 0 }
const coproBrute = {
  id: C1, nom: 'Résidence Exemple', adresse: '', jeton: '0'.repeat(32), emailsDestinataires: [], actif: true, creeLe: '2026-11-01T00:00:00Z',
  nbSignalements: 0, nbEnAttente: 0, derniereAdresseProposee: null,
}

describe('codes des bureaux', () => {
  it.each(['nom_pris', 'plafond_bureaux', 'bureau_utilise', 'bureau_requis', 'bureau_ferme', 'a_reverifier'])('409 « %s » → rendu tel quel', (code) => {
    expect(CODES_METIER_QR).toContain(code)
    expect(codeDepuisReponseQr(409, { error: code })).toBe(code)
  })

  it('503 base_absente (migration 20261119 non appliquée) → base_absente ; bureau_non_pose n’est pas un échec (207)', () => {
    expect(codeDepuisReponseQr(503, { error: 'base_absente' })).toBe('base_absente')
    expect(CODES_METIER_QR).not.toContain('bureau_non_pose')
  })
})

describe('bureaux d’un cabinet (routes nouvelles)', () => {
  it('liste : GET /cabinets/[id]/bureaux, dans l’ordre du serveur ; un bureau mal formé est écarté, les compteurs manquants valent 0', async () => {
    const s = simuler({ bureaux: [nord, { id: 42, nom: 'Mal formé' }, { id: B2, nom: 'Sud', ferme: true }] })
    const r = await chargerBureauxCabinetQr(K1, s.fetchImpl)
    expect(s.appels[0]).toMatchObject({ url: `/api/aj-signalement/cabinets/${K1}/bureaux`, init: { method: 'GET' } })
    expect(r).toEqual({
      ok: true,
      bureaux: [nord, { id: B2, nom: 'Sud', ferme: true, cabinetId: '', fermeLe: null, creeLe: '', nbGestionnaires: 0, nbCoproprietes: 0 }],
    })
  })

  it('liste sans la migration : 503 base_absente', async () => {
    expect(await chargerBureauxCabinetQr(K1, simuler({ error: 'base_absente' }, 503).fetchImpl)).toEqual({ ok: false, code: 'base_absente' })
  })

  it('création : POST { nom } seul ; 201 → le bureau relu', async () => {
    const s = simuler({ bureau: nord }, 201)
    expect(await creerBureauQr(K1, 'Nord', s.fetchImpl)).toEqual({ ok: true, bureau: nord, modifie: true })
    expect(s.appels[0]).toMatchObject({ url: `/api/aj-signalement/cabinets/${K1}/bureaux`, init: { method: 'POST' } })
    expect(s.corps()).toEqual({ nom: 'Nord' })
  })

  it.each(['nom_pris', 'plafond_bureaux'])('création refusée (409 %s) : le code', async (code) => {
    expect(await creerBureauQr(K1, 'Nord', simuler({ error: code }, 409).fetchImpl)).toEqual({ ok: false, code })
  })

  it('création : réponse sans bureau lisible → serveur', async () => {
    expect(await creerBureauQr(K1, 'Nord', simuler({ bureau: { nom: 'Nord' } }, 201).fetchImpl)).toEqual({ ok: false, code: 'serveur' })
  })

  it('modification : PATCH /bureaux/[id], une seule action ({ nom }, { fermer: true }, { fermer: false }) ; modifie tel que rendu', async () => {
    const s = simuler({ bureau: sud, modifie: false })
    expect(await modifierBureauQr(B2, { nom: 'Sud' }, s.fetchImpl)).toEqual({ ok: true, bureau: sud, modifie: false })
    await modifierBureauQr(B2, { fermer: true }, s.fetchImpl)
    await modifierBureauQr(B2, { fermer: false }, s.fetchImpl)
    expect(s.appels.map((a) => `${a.init?.method} ${a.url}`)).toEqual(Array(3).fill(`PATCH /api/aj-signalement/bureaux/${B2}`))
    expect([s.corps(0), s.corps(1), s.corps(2)]).toEqual([{ nom: 'Sud' }, { fermer: true }, { fermer: false }])
  })

  it.each(['bureau_utilise', 'nom_pris', 'a_reverifier'])('modification refusée (409 %s) : le code', async (code) => {
    expect(await modifierBureauQr(B1, { fermer: true }, simuler({ error: code }, 409).fetchImpl)).toEqual({ ok: false, code })
  })
})

describe('fiches gestionnaires (routes modifiées)', () => {
  it('liste : filtre ?bureau=<id> ou ?bureau=aucun (« bureau à compléter ») ; sans filtre, l’adresse d’avant', async () => {
    const s = simuler({ gestionnaires: [] })
    await chargerGestionnairesQr({ etat: 'tous', cabinet: K1, bureau: B1 }, s.fetchImpl)
    await chargerGestionnairesQr({ etat: 'tous', bureau: FILTRE_SANS_BUREAU_QR }, s.fetchImpl)
    await chargerGestionnairesQr({ etat: 'tous' }, s.fetchImpl)
    expect(s.appels.map((a) => a.url)).toEqual([
      `/api/aj-signalement/gestionnaires?etat=tous&cabinet=${K1}&bureau=${B1}`,
      '/api/aj-signalement/gestionnaires?etat=tous&bureau=aucun',
      '/api/aj-signalement/gestionnaires?etat=tous',
    ])
  })

  it('liste : le bureau d’une fiche est gardé s’il a la forme attendue ; sans bureau, aucune clé ajoutée', async () => {
    const avec = { id: G1, nom: 'Marie Exemple', bureau: { id: B1, nom: 'Nord', ferme: false } }
    const sans = { id: G1, nom: 'Paul Exemple' }
    const malForme = { id: G1, nom: 'Léa Exemple', bureau: { nom: 'Nord' } }
    const r = await chargerGestionnairesQr({ etat: 'tous' }, simuler({ gestionnaires: [avec, sans, malForme] }).fetchImpl)
    expect(r.ok && r.gestionnaires).toEqual([avec, sans, { id: G1, nom: 'Léa Exemple' }])
    expect(r.ok && 'bureau' in r.gestionnaires[1]).toBe(false)
    expect(r.ok && 'bureau' in r.gestionnaires[2]).toBe(false)
  })

  it('page profil : la fiche porte son bureau', async () => {
    const s = simuler({ gestionnaire: { id: G1, nom: 'Marie Exemple', bureau: { id: B2, nom: 'Sud', ferme: true } }, envois: [], attributions: [], creations: [], journal: [] })
    const r = await chargerFicheGestionnaireQr(G1, s.fetchImpl)
    expect(r.ok && r.fiche.gestionnaire.bureau).toEqual({ id: B2, nom: 'Sud', ferme: true })
  })

  it('création : bureauId envoyé quand il est choisi ; absent sinon (corps d’avant) ; 409 bureau_requis / bureau_ferme rendus', async () => {
    const saisie = { nom: 'Marie Exemple', email: 'marie.exemple@exemple.test', cabinetId: K1, coproprieteIds: [], forcerDomaine: false }
    const s = simuler({ error: 'bureau_requis' }, 409)
    expect(await creerGestionnaireQr(saisie, s.fetchImpl)).toEqual({ ok: false, code: 'bureau_requis' })
    expect(s.corps()).toEqual(saisie)
    const t = simuler({ error: 'bureau_ferme' }, 409)
    expect(await creerGestionnaireQr({ ...saisie, bureauId: B2 }, t.fetchImpl)).toEqual({ ok: false, code: 'bureau_ferme' })
    expect(t.corps()).toEqual({ ...saisie, bureauId: B2 })
  })

  it('création réussie : la fiche rendue porte son bureau', async () => {
    const s = simuler({ gestionnaire: { id: G1, nom: 'Marie Exemple', bureau: { id: B1, nom: 'Nord', ferme: false } }, emailEnvoye: true }, 201)
    const r = await creerGestionnaireQr({ nom: 'Marie Exemple', email: 'marie.exemple@exemple.test', cabinetId: K1, coproprieteIds: [], forcerDomaine: false, bureauId: B1 }, s.fetchImpl)
    expect(r.ok && r.gestionnaire.bureau).toEqual({ id: B1, nom: 'Nord', ferme: false })
  })

  it('changement de bureau : PATCH { bureauId } seul ; réactivation refusée dans un bureau fermé → bureau_ferme', async () => {
    const s = simuler({ gestionnaire: { id: G1, nom: 'Marie Exemple', bureau: { id: B1, nom: 'Nord', ferme: false } } })
    const r = await modifierGestionnaireQr(G1, { bureauId: B1 }, s.fetchImpl)
    expect(s.appels[0]).toMatchObject({ url: `/api/aj-signalement/gestionnaires/${G1}`, init: { method: 'PATCH' } })
    expect(s.corps()).toEqual({ bureauId: B1 })
    expect(r.ok && r.gestionnaire?.bureau).toEqual({ id: B1, nom: 'Nord', ferme: false })
    expect(await modifierGestionnaireQr(G1, { actif: true }, simuler({ error: 'bureau_ferme' }, 409).fetchImpl)).toEqual({ ok: false, code: 'bureau_ferme' })
  })
})

describe('copropriétés et tableau (routes modifiées)', () => {
  it('normaliserCoproprieteQr : bureau gardé s’il a la forme attendue ; mal formé ou absent → aucune clé', () => {
    expect(normaliserCoproprieteQr({ ...coproBrute, bureau: { id: B1, nom: 'Nord', ferme: false } }).bureau).toEqual({ id: B1, nom: 'Nord', ferme: false })
    expect('bureau' in normaliserCoproprieteQr({ ...coproBrute, bureau: { id: B1 } })).toBe(false)
    expect('bureau' in normaliserCoproprieteQr({ ...coproBrute, bureau: null })).toBe(false)
    expect('bureau' in normaliserCoproprieteQr(coproBrute)).toBe(false)
  })

  it('tableau : filtre ?bureau=<id> ; les copropriétés portent leur bureau', async () => {
    const s = simuler({ tableau: { coproprietes: [{ ...coproBrute, bureau: { id: B1, nom: 'Nord', ferme: false } }], signalements: [] } })
    const r = await chargerTableauQr(null, s.fetchImpl, { cabinet: K1, bureau: B1 })
    expect(s.appels[0].url).toBe(`/api/aj-signalement/tableau?cabinet=${K1}&bureau=${B1}`)
    expect(r.ok && r.tableau.coproprietes[0].bureau).toEqual({ id: B1, nom: 'Nord', ferme: false })
  })

  it('création : bureauId envoyé ; 201 → bureauNonPose faux ; 207 bureau_non_pose → la copropriété ET bureauNonPose vrai', async () => {
    const saisie = { nom: 'Résidence Exemple', adresse: '', emailsDestinataires: [], cabinetId: K1, bureauId: B1 }
    const s = simuler({ copropriete: { ...coproBrute, bureau: { id: B1, nom: 'Nord', ferme: false } } }, 201)
    const r = await creerCoproprieteQr(saisie, null, s.fetchImpl)
    expect(s.corps()).toEqual(saisie)
    expect(r.ok && r.bureauNonPose).toBe(false)
    const t = simuler({ copropriete: coproBrute, error: 'bureau_non_pose' }, 207)
    const r2 = await creerCoproprieteQr(saisie, null, t.fetchImpl)
    expect(r2.ok && r2.copropriete.id).toBe(C1)
    expect(r2.ok && r2.bureauNonPose).toBe(true)
  })

  it('création sans bureau : corps d’avant (aucune clé bureauId)', async () => {
    const s = simuler({ copropriete: coproBrute }, 201)
    await creerCoproprieteQr({ nom: 'Résidence Exemple', adresse: '', emailsDestinataires: [] }, null, s.fetchImpl)
    expect(s.corps()).toEqual({ nom: 'Résidence Exemple', adresse: '', emailsDestinataires: [] })
  })

  it('modification : bureauId (changer) ou null (retirer) ; 409 bureau_ferme rendu', async () => {
    const s = simuler({ copropriete: coproBrute })
    await modifierCoproprieteQr(C1, { bureauId: B2 }, null, s.fetchImpl)
    await modifierCoproprieteQr(C1, { bureauId: null }, null, s.fetchImpl)
    expect([s.corps(0), s.corps(1)]).toEqual([{ bureauId: B2 }, { bureauId: null }])
    expect(await modifierCoproprieteQr(C1, { actif: true }, null, simuler({ error: 'bureau_ferme' }, 409).fetchImpl)).toEqual({ ok: false, code: 'bureau_ferme' })
  })
})
