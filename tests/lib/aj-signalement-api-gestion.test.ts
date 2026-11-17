// tests/lib/aj-signalement-api-gestion.test.ts
//
// Clients des routes du super admin (cabinets, gestionnaires, journal, attributions) et de la page publique de
// confirmation d'adresse : aucune fonction ne lève ; adresses et corps envoyés ; codes 409 / 410 lus depuis `error`
// (et leurs compléments : doublon, id de la fiche existante) ; réponses anciennes complétées (normaliserCoproprieteQr).

import { describe, expect, it, vi } from 'vitest'
import {
  attribuerCoproprietesGestionnaireQr, attribuerGestionnairesCoproprieteQr, chargerCabinetsQr, chargerFicheGestionnaireQr,
  chargerGestionnairesQr, chargerJournalQr, chargerSignalementsCoproprieteQr, chargerTableauQr, codeDepuisReponseQr, confirmerAdresseQr,
  contesterAdresseQr, creerCabinetQr, creerCoproprieteQr, creerGestionnaireQr, departGestionnaireQr, exporterGestionnaireQr,
  lireLienConfirmationQr, modifierCabinetQr, modifierGestionnaireQr, normaliserCoproprieteQr, rattacherCoproprietesQr,
  renvoyerConfirmationQr, supprimerCoproprieteQr,
} from '@/lib/aj-signalement/api'
import { gestionCoproprieteQrVide } from '@/lib/aj-signalement/types'

const G1 = '11111111-1111-4111-8111-111111111111'
const C1 = 'c0000000-0000-4000-8000-000000000001'
const K1 = 'a0000000-0000-4000-8000-0000000000a1'

type Appel = { url: string; init?: RequestInit }

function simuler(corps: unknown, status = 200, entetes: Record<string, string> = {}) {
  const appels: Appel[] = []
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    appels.push({ url, init })
    if (status === 204) return new Response(null, { status })
    return new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json', ...entetes } })
  }) as unknown as typeof fetch
  return { appels, fetchImpl, corps: (i = 0) => JSON.parse(String(appels[i].init?.body)) as unknown }
}

const coproBrute = { id: C1, nom: 'Résidence Exemple', adresse: '', jeton: '0'.repeat(32), emailsDestinataires: [], actif: true, creeLe: '2026-11-01T00:00:00Z', nbSignalements: 0, nbEnAttente: 0, derniereAdresseProposee: null }

describe('codeDepuisReponseQr : codes métier', () => {
  it.each([
    'doublon', 'hors_domaine', 'existe_deja', 'identifiant_pris', 'identifiant_fige', 'domaine_pris', 'sans_cabinet', 'cabinet_fige',
    'a_reverifier', 'deja_confirmee', 'adresse_contestee', 'adresse_reservee', 'domaines_a_renseigner', 'fiche_active', 'fiche_effacee',
    'signalements_presents', 'conflit_statut',
  ])('409 « %s » → %s', (code) => {
    expect(codeDepuisReponseQr(409, { error: code })).toBe(code)
  })

  it('410 → expire ; 409 inconnu → invalide ; un code métier hors 409 / 410 n’est pas cru', () => {
    expect(codeDepuisReponseQr(410, { error: 'expire' })).toBe('expire')
    expect(codeDepuisReponseQr(410, null)).toBe('expire')
    expect(codeDepuisReponseQr(409, { error: 'adresse_connue' })).toBe('invalide')
    expect(codeDepuisReponseQr(400, { error: 'doublon' })).toBe('invalide')
    expect(codeDepuisReponseQr(500, { error: 'doublon' })).toBe('serveur')
  })
})

describe('copropriétés', () => {
  it('normaliserCoproprieteQr : une réponse sans champs de gestion reçoit leurs valeurs par défaut ; les autres sont gardés', () => {
    expect(normaliserCoproprieteQr(coproBrute)).toEqual({ ...coproBrute, ...gestionCoproprieteQrVide() })
    const complete = normaliserCoproprieteQr({ ...coproBrute, cabinet: { id: K1, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple' }, ouverts: 3, gestionnaires: [{ id: G1, nom: null }], attribueeATous: 'oui' })
    expect(complete.cabinet?.identifiant).toBe('cabinet-exemple')
    expect(complete.ouverts).toBe(3)
    expect(complete.gestionnaires).toEqual([{ id: G1, nom: null }])
    expect(complete.attribueeATous).toBe(false)
  })

  it('chargerTableauQr : filtre facultatif par gestionnaire (page de suivi) ; copropriétés complétées', async () => {
    const s = simuler({ tableau: { coproprietes: [coproBrute], signalements: [] } })
    const r = await chargerTableauQr(null, s.fetchImpl, { gestionnaire: G1 })
    expect(s.appels[0].url).toBe(`/api/aj-signalement/tableau?gestionnaire=${G1}`)
    expect(r.ok && r.tableau.coproprietes[0].attente48h).toBe(0)
  })

  it('création refusée pour doublon : le doublon est rendu à l’écran', async () => {
    const doublon = { certitude: 'certain', critere: 'nom_code_postal', copropriete: { id: C1, nom: 'Résidence Exemple', ville: 'Exempleville' } }
    const s = simuler({ error: 'doublon', doublon }, 409)
    expect(await creerCoproprieteQr({ nom: 'Résidence Exemple', adresse: '', emailsDestinataires: [] }, null, s.fetchImpl))
      .toEqual({ ok: false, code: 'doublon', doublon })
  })

  it('suppression : DELETE avec le nom saisi ; 204 → ok', async () => {
    const s = simuler(null, 204)
    expect(await supprimerCoproprieteQr(C1, 'Résidence Exemple', s.fetchImpl)).toEqual({ ok: true })
    expect(s.appels[0]).toMatchObject({ url: `/api/aj-signalement/coproprietes/${C1}`, init: { method: 'DELETE' } })
    expect(s.corps()).toEqual({ nomConfirmation: 'Résidence Exemple' })
  })

  it('attributions d’une copropriété : PUT /coproprietes/[id]/gestionnaires', async () => {
    const s = simuler({ gestionnaires: [{ id: G1, nom: 'Marie Exemple' }], attribueeATous: true, adressesRetirees: 1 })
    const r = await attribuerGestionnairesCoproprieteQr(C1, { gestionnaireIds: [G1], attribueeATous: true }, s.fetchImpl)
    expect(r).toEqual({ ok: true, gestionnaires: [{ id: G1, nom: 'Marie Exemple' }], attribueeATous: true, adressesRetirees: 1 })
    expect(s.appels[0]).toMatchObject({ url: `/api/aj-signalement/coproprietes/${C1}/gestionnaires`, init: { method: 'PUT' } })
    expect(s.corps()).toEqual({ gestionnaireIds: [G1], attribueeATous: true })
  })

  it('signalements d’une copropriété : curseur passé tel quel (« + » encodé), page suivante rendue', async () => {
    const suite = { avant: '2026-11-10T12:00:00.123456+00:00', avantId: '5f2c9a1e-1111-4222-8333-444444444444' }
    const s = simuler({ signalements: [], suite })
    const r = await chargerSignalementsCoproprieteQr(C1, { statut: 'tous', ...suite }, s.fetchImpl)
    expect(s.appels[0].url).toBe(`/api/aj-signalement/coproprietes/${C1}/signalements?statut=tous&avant=2026-11-10T12%3A00%3A00.123456%2B00%3A00&avantId=${suite.avantId}`)
    expect(r).toEqual({ ok: true, signalements: [], suite })
  })
})

describe('gestionnaires', () => {
  it('liste : filtre d’état', async () => {
    const s = simuler({ gestionnaires: [] })
    expect(await chargerGestionnairesQr({ etat: 'tous' }, s.fetchImpl)).toEqual({ ok: true, gestionnaires: [] })
    expect(s.appels[0].url).toBe('/api/aj-signalement/gestionnaires?etat=tous')
  })

  it('création : corps strict ; adresse déjà en table → existe_deja avec l’id de la fiche', async () => {
    const s = simuler({ error: 'existe_deja', id: G1 }, 409)
    const saisie = { nom: 'Marie Exemple', email: 'marie.exemple@exemple.test', cabinetId: K1, coproprieteIds: [C1], forcerDomaine: false }
    expect(await creerGestionnaireQr(saisie, s.fetchImpl)).toEqual({ ok: false, code: 'existe_deja', id: G1 })
    expect(s.corps()).toEqual(saisie)
  })

  it('création réussie : la fiche, l’état de l’e-mail et le nombre de copropriétés où l’adresse est déjà saisie', async () => {
    const s = simuler({ gestionnaire: { id: G1, nom: 'Marie Exemple' }, emailEnvoye: false, coproprietesAvecAdresseSaisie: 2 }, 201)
    const r = await creerGestionnaireQr({ nom: 'Marie Exemple', email: 'marie.exemple@exemple.test', cabinetId: K1, coproprieteIds: [], forcerDomaine: true }, s.fetchImpl)
    expect(r).toMatchObject({ ok: true, emailEnvoye: false, coproprietesAvecAdresseSaisie: 2 })
  })

  it('fiche, modification, renvoi, attributions, départ : adresses et méthodes', async () => {
    const s = simuler({ gestionnaire: { id: G1 }, envois: [], attributions: [], creations: [], journal: [] })
    expect((await chargerFicheGestionnaireQr(G1, s.fetchImpl)).ok).toBe(true)
    await modifierGestionnaireQr(G1, { nom: 'Marie Exemple' }, s.fetchImpl)
    await renvoyerConfirmationQr(G1, s.fetchImpl)
    await attribuerCoproprietesGestionnaireQr(G1, [C1], s.fetchImpl)
    await departGestionnaireQr(G1, [{ coproprieteId: C1, versGestionnaireId: null }], s.fetchImpl)
    expect(s.appels.map((a) => `${a.init?.method} ${a.url}`)).toEqual([
      `GET /api/aj-signalement/gestionnaires/${G1}`,
      `PATCH /api/aj-signalement/gestionnaires/${G1}`,
      `POST /api/aj-signalement/gestionnaires/${G1}/confirmation`,
      `PUT /api/aj-signalement/gestionnaires/${G1}/coproprietes`,
      `POST /api/aj-signalement/gestionnaires/${G1}/depart`,
    ])
    expect(s.corps(1)).toEqual({ nom: 'Marie Exemple' })
    expect(s.corps(3)).toEqual({ coproprieteIds: [C1] })
    expect(s.corps(4)).toEqual({ successions: [{ coproprieteId: C1, versGestionnaireId: null }] })
  })

  it('export RGPD : le fichier JSON tel que le serveur le donne, avec son nom', async () => {
    const s = simuler({ exporteLe: '2026-11-11T00:00:00Z' }, 200, { 'content-disposition': `attachment; filename="gestionnaire-${G1}.json"` })
    const r = await exporterGestionnaireQr(G1, s.fetchImpl)
    expect(r.ok && r.nomFichier).toBe(`gestionnaire-${G1}.json`)
    expect(r.ok && (await r.fichier.text())).toContain('exporteLe')
  })
})

describe('cabinets et journal', () => {
  it('liste, création, modification, rattachement', async () => {
    const s = simuler({ cabinets: [], cabinet: { id: K1 }, fichesHorsDomaines: [{ id: G1, nom: 'Marie Exemple' }], rattachees: 2 })
    expect(await chargerCabinetsQr(s.fetchImpl)).toEqual({ ok: true, cabinets: [] })
    await creerCabinetQr({ nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple', langue: 'fr', domaines: ['exemple.test'] }, s.fetchImpl)
    const m = await modifierCabinetQr(K1, { domaines: ['exemple.test'] }, s.fetchImpl)
    expect(m).toMatchObject({ ok: true, fichesHorsDomaines: [{ id: G1, nom: 'Marie Exemple' }] })
    expect(await rattacherCoproprietesQr(K1, [C1], s.fetchImpl)).toEqual({ ok: true, rattachees: 2 })
    expect(s.appels.map((a) => `${a.init?.method} ${a.url}`)).toEqual([
      'GET /api/aj-signalement/cabinets',
      'POST /api/aj-signalement/cabinets',
      `PATCH /api/aj-signalement/cabinets/${K1}`,
      `POST /api/aj-signalement/cabinets/${K1}/rattachement`,
    ])
    expect(s.corps(1)).toEqual({ nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple', langue: 'fr', domaines: ['exemple.test'] })
    expect(s.corps(3)).toEqual({ coproprieteIds: [C1] })
  })

  it('identifiant figé : code rendu', async () => {
    expect(await modifierCabinetQr(K1, { identifiant: 'autre-exemple' }, simuler({ error: 'identifiant_fige' }, 409).fetchImpl))
      .toEqual({ ok: false, code: 'identifiant_fige' })
  })

  it('journal : filtres et curseur en paramètres, champs vides omis', async () => {
    const s = simuler({ evenements: [], suite: null })
    await chargerJournalQr({ action: 'cabinet.cree', copropriete: '', gestionnaire: G1, avant: '2026-11-10T12:00:00+00:00', avantId: '42' }, s.fetchImpl)
    expect(s.appels[0].url).toBe(`/api/aj-signalement/journal?action=cabinet.cree&gestionnaire=${G1}&avant=2026-11-10T12%3A00%3A00%2B00%3A00&avantId=42`)
  })
})

describe('confirmation d’adresse (page publique)', () => {
  it('lecture, confirmation, refus : { token, cabinet } dans le corps, jamais dans l’adresse', async () => {
    const s = simuler({ nomCourt: 'Marie M.', cabinet: 'Cabinet Exemple', email: 'ma***@exemple.test', confirmee: true, contestee: true })
    const token = `${'a'.repeat(48)}.${'b'.repeat(64)}`
    expect(await lireLienConfirmationQr(token, 'cabinet-exemple', s.fetchImpl)).toEqual({ ok: true, nomCourt: 'Marie M.', cabinet: 'Cabinet Exemple', email: 'ma***@exemple.test' })
    expect(await confirmerAdresseQr(token, 'cabinet-exemple', s.fetchImpl)).toEqual({ ok: true })
    expect(await contesterAdresseQr(token, 'cabinet-exemple', s.fetchImpl)).toEqual({ ok: true })
    expect(s.appels.map((a) => a.url)).toEqual([
      '/api/aj-signalement/confirmation/lecture', '/api/aj-signalement/confirmation', '/api/aj-signalement/confirmation/refus',
    ])
    expect(s.appels.every((a) => !a.url.includes(token))).toBe(true)
    expect(s.corps(2)).toEqual({ token, cabinet: 'cabinet-exemple' })
  })

  it('réseau coupé : aucun lancer, code reseau', async () => {
    const fetchImpl = vi.fn(async () => { throw new TypeError('Failed to fetch') }) as unknown as typeof fetch
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await lireLienConfirmationQr('x', 'cabinet-exemple', fetchImpl)).toEqual({ ok: false, code: 'reseau' })
  })
})

describe('accès des gestionnaires (PR 2, lot 3)', () => {
  const TOKEN = `${'a'.repeat(48)}.${'b'.repeat(64)}`

  it('codes 409 propres à l’accès lus tels quels : deja_ouvert, compte_autre_espace', () => {
    expect(codeDepuisReponseQr(409, { error: 'deja_ouvert' })).toBe('deja_ouvert')
    expect(codeDepuisReponseQr(409, { error: 'compte_autre_espace' })).toBe('compte_autre_espace')
  })

  it('lecture du lien : POST /invitation/lecture { token, cabinet } (le jeton dans le CORPS, jamais dans l’adresse)', async () => {
    const { lireLienAccesQr } = await import('@/lib/aj-signalement/api')
    const s = simuler({ nomCourt: 'Marie E.', cabinet: 'Cabinet Exemple', email: 'ma***@exemple.test' })
    expect(await lireLienAccesQr(TOKEN, 'cabinet-exemple', s.fetchImpl)).toEqual({ ok: true, nomCourt: 'Marie E.', cabinet: 'Cabinet Exemple', email: 'ma***@exemple.test' })
    expect(s.appels[0].url).toBe('/api/aj-signalement/invitation/lecture')
    expect(s.appels[0].init?.method).toBe('POST')
    expect(s.corps()).toEqual({ token: TOKEN, cabinet: 'cabinet-exemple' })
  })

  it('acceptation : corps complet (case cochée) ; 200 ouvert, 207 liaison incomplète (succès partiel), 409 / 410 en codes', async () => {
    const { accepterAccesQr } = await import('@/lib/aj-signalement/api')
    const ok = simuler({ acces: 'ouvert' })
    expect(await accepterAccesQr(TOKEN, 'cabinet-exemple', 'Bonjour2026', ok.fetchImpl)).toEqual({ ok: true, liaisonIncomplete: false, compteExistant: false })
    expect(ok.appels[0].url).toBe('/api/aj-signalement/invitation')
    expect(ok.corps()).toEqual({ token: TOKEN, cabinet: 'cabinet-exemple', password: 'Bonjour2026', politiqueLue: true })
    expect(await accepterAccesQr(TOKEN, 'cabinet-exemple', 'Bonjour2026', simuler({ error: 'liaison_incomplete' }, 207).fetchImpl))
      .toEqual({ ok: true, liaisonIncomplete: true, compteExistant: false })
    // Relecture 5 du lot 6 : compte existant rattaché, mot de passe inchangé.
    expect(await accepterAccesQr(TOKEN, 'cabinet-exemple', 'Bonjour2026', simuler({ acces: 'ouvert', compte: 'existant' }).fetchImpl))
      .toEqual({ ok: true, liaisonIncomplete: false, compteExistant: true })
    expect(await accepterAccesQr(TOKEN, 'cabinet-exemple', 'Bonjour2026', simuler({ error: 'invalide' }, 422).fetchImpl)).toEqual({ ok: false, code: 'invalide' })
    expect(await accepterAccesQr(TOKEN, 'cabinet-exemple', 'Bonjour2026', simuler({ error: 'compte_autre_espace' }, 409).fetchImpl))
      .toEqual({ ok: false, code: 'compte_autre_espace' })
    expect(await accepterAccesQr(TOKEN, 'cabinet-exemple', 'Bonjour2026', simuler({ error: 'expire' }, 410).fetchImpl)).toEqual({ ok: false, code: 'expire' })
    expect(await accepterAccesQr(TOKEN, 'cabinet-exemple', 'x', simuler({ error: 'invalide' }, 400).fetchImpl)).toEqual({ ok: false, code: 'invalide' })
  })

  it('« Ce n’est pas moi » : POST /invitation/refus { token, cabinet }', async () => {
    const { contesterAccesQr } = await import('@/lib/aj-signalement/api')
    const s = simuler({ contestee: true })
    expect(await contesterAccesQr(TOKEN, 'cabinet-exemple', s.fetchImpl)).toEqual({ ok: true })
    expect(s.appels[0].url).toBe('/api/aj-signalement/invitation/refus')
    expect(s.corps()).toEqual({ token: TOKEN, cabinet: 'cabinet-exemple' })
  })

  it('super admin : ouvrir l’accès d’une fiche (POST …/gestionnaires/<id>/acces), puis de plusieurs (POST …/gestionnaires/acces)', async () => {
    const { ouvrirAccesGestionnaireQr, ouvrirAccesGroupeQr } = await import('@/lib/aj-signalement/api')
    const un = simuler({ emailEnvoye: true })
    expect(await ouvrirAccesGestionnaireQr(G1, un.fetchImpl)).toEqual({ ok: true, emailEnvoye: true })
    expect(un.appels[0].url).toBe(`/api/aj-signalement/gestionnaires/${G1}/acces`)
    expect(un.appels[0].init?.method).toBe('POST')
    expect(await ouvrirAccesGestionnaireQr(G1, simuler({ error: 'deja_ouvert' }, 409).fetchImpl)).toEqual({ ok: false, code: 'deja_ouvert' })
    const groupe = simuler({ envoyes: 1, echecs: [{ id: K1, code: 'adresse_contestee' }, { id: 5, code: 'x' }] })
    expect(await ouvrirAccesGroupeQr([G1, K1], groupe.fetchImpl)).toEqual({ ok: true, envoyes: 1, echecs: [{ id: K1, code: 'adresse_contestee' }] })
    expect(groupe.appels[0].url).toBe('/api/aj-signalement/gestionnaires/acces')
    expect(groupe.corps()).toEqual({ gestionnaireIds: [G1, K1] })
  })

  it('réseau coupé : aucune exception, code reseau', async () => {
    const { lireLienAccesQr } = await import('@/lib/aj-signalement/api')
    const fetchImpl = vi.fn(async () => { throw new TypeError('Failed to fetch') }) as unknown as typeof fetch
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(await lireLienAccesQr(TOKEN, 'cabinet-exemple', fetchImpl)).toEqual({ ok: false, code: 'reseau' })
  })
})

// ── PR 2, lot 5 : appels de l'espace d'un cabinet (gestionnaire connecté) ─────────────────────────────────────────────
// GET /moi (profil et cabinet de la session) ; création et modification d'une copropriété avec les schémas stricts du
// gestionnaire (operationId, champs obligatoires ; jamais cabinet, gestionnaires, « à tous », forçage) ; statut avec le
// statut affiché (statutAttendu) ; refus 403 lus depuis le corps (acces_retire, lecture_seule) ; doublon d'un
// gestionnaire : la copropriété existante n'est jointe que si elle est dans sa portée (sinon certitude et critère seuls).
describe('espace d’un cabinet (PR 2, lot 5)', () => {
  it('403 avec un code de refus connu : acces_retire, lecture_seule ; autre 403 : interdit', () => {
    expect(codeDepuisReponseQr(403, { error: 'acces_retire' })).toBe('acces_retire')
    expect(codeDepuisReponseQr(403, { error: 'lecture_seule' })).toBe('lecture_seule')
    expect(codeDepuisReponseQr(403, { error: 'interdit' })).toBe('interdit')
    expect(codeDepuisReponseQr(403, { error: 'autre_chose' })).toBe('interdit')
    // Un code de refus n'est lu que d'un 403.
    expect(codeDepuisReponseQr(409, { error: 'acces_retire' })).toBe('invalide')
  })

  it('GET /moi : gestionnaire (nom, cabinet, domaines triés tels quels) ; super admin ; 403 acces_retire ; réponse mal formée → serveur', async () => {
    const { chargerMoiQr } = await import('@/lib/aj-signalement/api')
    const g = simuler({ profil: 'gestionnaire', nom: 'Marie Exemple', cabinet: { identifiant: 'cabinet-exemple', nom: 'Cabinet Exemple', domaines: ['exemple.test', 3] } })
    expect(await chargerMoiQr(g.fetchImpl)).toEqual({
      ok: true, moi: { profil: 'gestionnaire', nom: 'Marie Exemple', cabinet: { identifiant: 'cabinet-exemple', nom: 'Cabinet Exemple', domaines: ['exemple.test'] } },
    })
    expect(g.appels[0].url).toBe('/api/aj-signalement/moi')
    expect(g.appels[0].init?.method).toBe('GET')
    expect(await chargerMoiQr(simuler({ profil: 'super_admin' }).fetchImpl)).toEqual({ ok: true, moi: { profil: 'super_admin' } })
    expect(await chargerMoiQr(simuler({ error: 'acces_retire' }, 403).fetchImpl)).toEqual({ ok: false, code: 'acces_retire' })
    expect(await chargerMoiQr(simuler({ error: 'base_absente' }, 503).fetchImpl)).toEqual({ ok: false, code: 'base_absente' })
    expect(await chargerMoiQr(simuler({ profil: 'gestionnaire' }).fetchImpl)).toEqual({ ok: false, code: 'serveur' })
  })

  it('création par un gestionnaire : POST /coproprietes avec le corps du schéma gestionnaire, tel quel', async () => {
    const { creerCoproprieteGestionnaireQr } = await import('@/lib/aj-signalement/api')
    const s = simuler({ copropriete: { ...coproBrute, modifiable: true, creeeParVous: true, adressesMasquees: 0 } }, 201)
    const saisie = {
      operationId: 'f0000000-0000-4000-8000-000000000001', nom: 'Résidence Neuve', adresse: '8 avenue Neuve', codePostal: '13002', ville: 'Marseille',
      emailsDestinataires: ['conseil@exemple.test'],
    }
    const r = await creerCoproprieteGestionnaireQr(saisie, s.fetchImpl)
    expect(r.ok && r.copropriete).toMatchObject({ id: C1, modifiable: true, creeeParVous: true, adressesMasquees: 0 })
    expect(s.appels[0].url).toBe('/api/aj-signalement/coproprietes')
    expect(s.appels[0].init?.method).toBe('POST')
    expect(s.corps()).toEqual(saisie)
  })

  it('doublon refusé à un gestionnaire : hors portée, certitude et critère seuls ; dans sa portée, la copropriété', async () => {
    const { creerCoproprieteGestionnaireQr } = await import('@/lib/aj-signalement/api')
    const saisie = { operationId: 'f0000000-0000-4000-8000-000000000001', nom: 'X', adresse: 'Y', codePostal: '13002', ville: 'Z' }
    expect(await creerCoproprieteGestionnaireQr(saisie, simuler({ error: 'doublon', doublon: { certitude: 'certain', critere: 'nom_code_postal' } }, 409).fetchImpl))
      .toEqual({ ok: false, code: 'doublon', doublonCabinet: { certitude: 'certain', critere: 'nom_code_postal' } })
    const dansPortee = { certitude: 'probable', critere: 'nom', copropriete: { id: C1, nom: 'Résidence Une', ville: 'Marseille' } }
    const r = await creerCoproprieteGestionnaireQr(saisie, simuler({ error: 'doublon', doublon: dansPortee }, 409).fetchImpl)
    expect(r).toEqual({ ok: false, code: 'doublon', doublonCabinet: dansPortee })
    // Forme inconnue : aucun complément.
    expect(await creerCoproprieteGestionnaireQr(saisie, simuler({ error: 'doublon', doublon: { certitude: 'peut-etre' } }, 409).fetchImpl))
      .toEqual({ ok: false, code: 'doublon' })
  })

  it('modification par un gestionnaire : PATCH /coproprietes/<id> avec les seuls champs changés ; 403 lecture_seule', async () => {
    const { modifierCoproprieteGestionnaireQr } = await import('@/lib/aj-signalement/api')
    const s = simuler({ copropriete: coproBrute })
    expect((await modifierCoproprieteGestionnaireQr(C1, { ville: 'Aubagne' }, s.fetchImpl)).ok).toBe(true)
    expect(s.appels[0].url).toBe(`/api/aj-signalement/coproprietes/${C1}`)
    expect(s.appels[0].init?.method).toBe('PATCH')
    expect(s.corps()).toEqual({ ville: 'Aubagne' })
    expect(await modifierCoproprieteGestionnaireQr(C1, { ville: 'Aubagne' }, simuler({ error: 'lecture_seule' }, 403).fetchImpl))
      .toEqual({ ok: false, code: 'lecture_seule' })
  })

  it('statut : le statut affiché part avec la demande (statutAttendu) ; sans lui, le corps d’avant', async () => {
    const { changerStatutSignalementQr } = await import('@/lib/aj-signalement/api')
    const avec = simuler({ signalement: { statut: 'acceptee', misAJourLe: '2026-11-10T10:00:00Z' } })
    expect(await changerStatutSignalementQr('s1', 'acceptee', null, avec.fetchImpl, 'en_attente')).toEqual({ ok: true, statut: 'acceptee', misAJourLe: '2026-11-10T10:00:00Z' })
    expect(avec.corps()).toEqual({ statut: 'acceptee', statutAttendu: 'en_attente' })
    const sans = simuler({ signalement: { statut: 'acceptee', misAJourLe: '' } })
    await changerStatutSignalementQr('s1', 'acceptee', null, sans.fetchImpl)
    expect(sans.corps()).toEqual({ statut: 'acceptee' })
    expect(await changerStatutSignalementQr('s1', 'acceptee', null, simuler({ error: 'conflit_statut' }, 409).fetchImpl, 'en_attente'))
      .toEqual({ ok: false, code: 'conflit_statut' })
  })
})
