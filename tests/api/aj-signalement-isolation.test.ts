// tests/api/aj-signalement-isolation.test.ts
//
// Isolation entre gestionnaires (PR 2, SPEC § 2.4 et § 2.5) sur les lectures, le changement de statut et (lot 2) les
// écritures d'une copropriété :
//   - tableau (P1-R1), signalements d'une copropriété (P1-R2), statut d'un signalement (P1-R7), fiche (P1-R4) et doublon
//     d'une création (P1-R3) ;
//   - G1 et G2 (même cabinet, copropriétés distinctes) + une copropriété « attribuée à tous » + G3 d'un autre cabinet ;
//   - hors portée = 404, jamais 403, et le statut n'est PAS écrit ; « à tous » : lecture et statut pour tous les
//     gestionnaires de SON cabinet, jamais pour ceux d'un autre ;
//   - aucune réponse d'un gestionnaire ne contient l'identifiant, le nom ou l'adresse d'un collègue (adresse restée
//     dans les saisies : adressesMasquees), ni email_erreur, ni l'auteur nominatif d'un statut ;
//   - chaque appel relit la fiche : départ → la requête suivante répond 403 acces_retire.
// Données fictives (tests/helpers/aj-signalement-acces.ts).

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/aj-signalement-base')).baseQr.client }))
vi.mock('@/lib/supabase-server-component', async () => (await import('../helpers/aj-signalement-routes')).mockCookies())
vi.mock('@/lib/auth-helpers', async () => (await import('../helpers/aj-signalement-routes')).mockAuth())
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/aj-signalement-routes')).mockLimites())
vi.mock('@/lib/email', async () => (await import('../helpers/aj-signalement-routes')).mockEmail())
vi.mock('@/lib/logger', async () => (await import('../helpers/aj-signalement-routes')).mockLogger())

const { baseQr } = await import('../helpers/aj-signalement-base')
const { contexteQr, reinitialiserSimulQr, requeteQr, simulQr } = await import('../helpers/aj-signalement-routes')
const A = await import('../helpers/aj-signalement-acces')
const { GET: TABLEAU } = await import('@/app/api/aj-signalement/tableau/route')
const { GET: SIGNALEMENTS_COPRO } = await import('@/app/api/aj-signalement/coproprietes/[id]/signalements/route')
const { PATCH: STATUT } = await import('@/app/api/aj-signalement/signalements/[id]/route')
const { GET: MOI } = await import('@/app/api/aj-signalement/moi/route')
const { POST: CREER } = await import('@/app/api/aj-signalement/coproprietes/route')
const { PATCH: MODIFIER } = await import('@/app/api/aj-signalement/coproprietes/[id]/route')
const { reinitialiserReplisQr } = await import('@/lib/aj-signalement/serveur')

beforeEach(() => {
  reinitialiserSimulQr()
  reinitialiserReplisQr()
  baseQr.reinitialiser()
  A.poserJeuAccesQr()
  A.connecterQr(A.COMPTE_G1)
})

const lireTableau = async () => {
  const res = await TABLEAU(requeteQr('/api/aj-signalement/tableau'))
  return { res, corps: await res.json() }
}
const lireSignalementsCopro = (id: string) => SIGNALEMENTS_COPRO(requeteQr(`/api/aj-signalement/coproprietes/${id}/signalements?statut=tous`), contexteQr(id))
const changerStatut = (id: string, corps: unknown) => STATUT(requeteQr(`/api/aj-signalement/signalements/${id}`, 'PATCH', corps), contexteQr(id))
const ecrituresStatut = () => baseQr.ecrituresDe('signalements_qr', 'update')

/** Rien d'un collègue (G2) ni d'un autre cabinet dans une réponse de G1. */
function sansDonneeDautrui(texte: string): void {
  for (const interdit of [A.G2, A.U2, A.EMAIL_G2, 'Paul', A.G3, A.U3, A.EMAIL_G3, 'Luc Ailleurs', A.CAB_AUTRE, 'Autre Cabinet', A.ERREUR_ENVOI, '9 rue Proposée']) {
    expect(texte, interdit).not.toContain(interdit)
  }
}

describe('tableau (P1-R1) vu par un gestionnaire', () => {
  it('G1 : ses copropriétés (attribuée + « à tous » de son cabinet) et leurs signalements seulement ; jamais en cache', async () => {
    const { res, corps } = await lireTableau()
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    expect(Object.keys(corps)).toEqual(['tableau'])
    expect(corps.tableau.coproprietes.map((c: { id: string }) => c.id)).toEqual([A.C1, A.C_TOUS])
    expect(corps.tableau.signalements.map((s: { id: string }) => s.id).sort()).toEqual([A.S1, A.S_TOUS].sort())
    expect(corps.tableau.gestionnaire).toBeUndefined()
  })

  it('G1 : réponse minimisée (aucun collègue, adresse du collègue masquée, erreurs d’envoi et adresse proposée retirées)', async () => {
    const { corps } = await lireTableau()
    sansDonneeDautrui(JSON.stringify(corps))
    const tous = corps.tableau.coproprietes.find((c: { id: string }) => c.id === A.C_TOUS)
    expect(tous).toMatchObject({
      attribueeATous: true, modifiable: false, gestionnaires: [], emailsDestinataires: ['cs@externe.test'], adressesMasquees: 1,
      adressesDeGestionnaires: 0, creePar: 'administrateur', creeeParVous: false, cabinet: { id: A.CAB, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple' },
    })
    expect(corps.tableau.coproprietes.find((c: { id: string }) => c.id === A.C1)).toMatchObject({ modifiable: true, emailsDestinataires: ['cs-une@externe.test'], adressesMasquees: 0 })
    const s = corps.tableau.signalements.find((x: { id: string }) => x.id === A.S_TOUS)
    expect(s).toMatchObject({ emailErreur: null, confirmationErreur: null, adresseProposee: '', statutModifiePar: 'collegue', emailEnvoyeLe: '2026-11-10T09:30:00+00:00' })
    expect(s).toMatchObject({ prenom: 'Prénom', nom: 'Déclarant', telephone: '0600000000', email: 'declarant@exemple.test' })
  })

  it('G2 : la copropriété de G1 n’apparaît pas ; la sienne oui (créée par lui), la « à tous » aussi', async () => {
    A.connecterQr(A.COMPTE_G2)
    const { corps } = await lireTableau()
    expect(corps.tableau.coproprietes.map((c: { id: string }) => c.id)).toEqual([A.C2, A.C_TOUS])
    expect(corps.tableau.coproprietes[0]).toMatchObject({ creeeParVous: true, modifiable: true })
    // Sa propre adresse, restée dans les saisies, lui reste visible.
    expect(corps.tableau.coproprietes[1].emailsDestinataires).toEqual(['cs@externe.test', A.EMAIL_G2])
    expect(JSON.stringify(corps)).not.toContain(A.G1)
    expect(JSON.stringify(corps)).not.toContain(A.EMAIL_G1)
  })

  it('G3 (autre cabinet) : ni la « à tous » ni aucune copropriété du premier cabinet', async () => {
    A.connecterQr(A.COMPTE_G3)
    const { corps } = await lireTableau()
    expect(corps.tableau.coproprietes.map((c: { id: string }) => c.id)).toEqual([A.C3, A.C_TOUS_AUTRE])
    expect(JSON.stringify(corps)).not.toContain('Cabinet Exemple')
    expect(JSON.stringify(corps)).not.toContain(A.C_TOUS)
  })

  it('copropriété sans cabinet : jamais dans la portée d’un gestionnaire', async () => {
    const { corps } = await lireTableau()
    expect(JSON.stringify(corps)).not.toContain(A.C_SANS)
    expect(JSON.stringify(corps)).not.toContain(A.S_SANS)
  })

  it('départ (fiche désactivée) : la requête suivante répond 403 acces_retire, sans aucune donnée', async () => {
    expect((await lireTableau()).res.status).toBe(200)
    A.ficheSimuleeQr(A.G1).actif = false
    const { res, corps } = await lireTableau()
    expect(res.status).toBe(403)
    expect(corps).toEqual({ error: 'acces_retire' })
  })

  it('limites par IP puis par compte', async () => {
    await lireTableau()
    expect(simulQr.limites).toEqual(['qr_tableau_203.0.113.7', `qr_tableau_${A.U1}`])
  })
})

describe('signalements d’une copropriété (P1-R2) vus par un gestionnaire', () => {
  it.each([
    ['copropriété d’un collègue', A.C2],
    ['copropriété d’un autre cabinet', A.C3],
    ['« à tous » d’un autre cabinet', A.C_TOUS_AUTRE],
    ['copropriété sans cabinet', A.C_SANS],
    ['copropriété inconnue', 'c0000000-0000-4000-8000-0000000000ff'],
  ])('%s : 404, aucun signalement lu', async (_cas, id) => {
    const res = await lireSignalementsCopro(id)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'introuvable' })
    expect(baseQr.etat.lectures.filter((l) => l.table === 'signalements_qr')).toEqual([])
  })

  it('« à tous » de son cabinet : 200, lignes minimisées, jamais en cache', async () => {
    const res = await lireSignalementsCopro(A.C_TOUS)
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    const corps = await res.json()
    expect(corps.signalements.map((s: { id: string }) => s.id)).toEqual([A.S_TOUS])
    expect(corps.signalements[0]).toMatchObject({ emailErreur: null, confirmationErreur: null, adresseProposee: '', statutModifiePar: 'collegue' })
    sansDonneeDautrui(JSON.stringify(corps))
  })

  it('sa copropriété : 200', async () => {
    const res = await lireSignalementsCopro(A.C1)
    expect(res.status).toBe(200)
    expect((await res.json()).signalements.map((s: { id: string }) => s.id)).toEqual([A.S1])
  })
})

describe('statut d’un signalement (P1-R7) changé par un gestionnaire', () => {
  it.each([
    ['signalement d’un collègue', A.S2],
    ['signalement d’un autre cabinet', A.S3],
    ['signalement sans cabinet', A.S_SANS],
  ])('%s : 404 SANS aucune écriture ni journal', async (_cas, id) => {
    const res = await changerStatut(id, { statut: 'en_cours', statutAttendu: 'en_attente' })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'introuvable' })
    expect(ecrituresStatut()).toEqual([])
    expect(baseQr.table('signalements_qr_journal')).toEqual([])
  })

  it('G3 sur la « à tous » du premier cabinet : 404 sans écriture', async () => {
    A.connecterQr(A.COMPTE_G3)
    expect((await changerStatut(A.S_TOUS, { statut: 'terminee', statutAttendu: 'acceptee' })).status).toBe(404)
    expect(ecrituresStatut()).toEqual([])
  })

  it('« à tous » de son cabinet : statut changé, trace gestionnaire, écriture conditionnée, journal acteur gestionnaire', async () => {
    const res = await changerStatut(A.S_TOUS, { statut: 'en_cours', statutAttendu: 'acceptee' })
    expect(res.status).toBe(200)
    const ecriture = ecrituresStatut()[0]
    expect(ecriture.filtres).toEqual([`id=eq.${A.S_TOUS}`, `copropriete_id=eq.${A.C_TOUS}`, 'statut=eq.acceptee'])
    expect(ecriture.valeurs).toEqual({ statut: 'en_cours', statut_modifie_le: expect.any(String), statut_modifie_par: A.U1, statut_modifie_profil: 'gestionnaire' })
    expect(baseQr.table('signalements_qr_journal')).toEqual([expect.objectContaining({
      action: 'signalement.statut', cabinet_id: A.CAB, acteur_id: A.U1, acteur_profil: 'gestionnaire', acteur_gestionnaire_id: A.G1,
      copropriete_id: A.C_TOUS, signalement_id: A.S_TOUS, details: { de: 'acceptee', vers: 'en_cours' },
    })])
    expect((await res.json()).signalement).toMatchObject({ id: A.S_TOUS, statut: 'en_cours' })
  })

  it('après son changement, le tableau lui dit « vous », sans identifiant de compte', async () => {
    await changerStatut(A.S1, { statut: 'acceptee', statutAttendu: 'en_attente' })
    const { corps } = await lireTableau()
    const s = corps.tableau.signalements.find((x: { id: string }) => x.id === A.S1)
    expect(s.statutModifiePar).toBe('vous')
    expect(JSON.stringify(corps)).not.toContain(A.U1)
  })

  it('statut changé entre-temps : 409 conflit_statut, rien au journal', async () => {
    const res = await changerStatut(A.S1, { statut: 'terminee', statutAttendu: 'en_cours' })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'conflit_statut' })
    expect(baseQr.table('signalements_qr_journal')).toEqual([])
  })
})

describe('fiche d’une copropriété (P1-R4) et doublon d’une création (P1-R3) par un gestionnaire', () => {
  const modifierFiche = (id: string) => MODIFIER(requeteQr(`/api/aj-signalement/coproprietes/${id}`, 'PATCH', { nom: 'Prise de contrôle' }), contexteQr(id))

  it.each([
    ['copropriété d’un collègue', A.C2],
    ['copropriété d’un autre cabinet', A.C3],
    ['« à tous » d’un autre cabinet', A.C_TOUS_AUTRE],
    ['copropriété sans cabinet', A.C_SANS],
  ])('PATCH %s : 404, rien écrit', async (_cas, id) => {
    const res = await modifierFiche(id)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'introuvable' })
    expect(baseQr.etat.ecritures).toEqual([])
  })

  it('PATCH « à tous » de son cabinet : 403 lecture_seule (visible, non modifiable)', async () => {
    const res = await modifierFiche(A.C_TOUS)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'lecture_seule' })
    expect(baseQr.etat.ecritures.filter((e) => e.table === 'signalements_qr_coproprietes')).toEqual([])
  })

  it('G3 : PATCH de la « à tous » du premier cabinet → 404 (il ne la voit pas)', async () => {
    A.connecterQr(A.COMPTE_G3)
    expect((await modifierFiche(A.C_TOUS)).status).toBe(404)
  })

  it('doublon d’une copropriété d’un collègue : 409 sans son identifiant, son nom, ni rien de G2', async () => {
    const res = await CREER(requeteQr('/api/aj-signalement/coproprietes', 'POST', {
      operationId: 'f0000000-0000-4000-8000-000000000001', nom: 'Résidence Deux', adresse: '2 rue Exemple', codePostal: '13001', ville: 'Marseille',
    }))
    expect(res.status).toBe(409)
    const texte = JSON.stringify(await res.json())
    sansDonneeDautrui(texte)
    expect(texte).not.toContain(A.C2)
    expect(texte).not.toContain('Deux')
  })
})

describe('GET /api/aj-signalement/moi', () => {
  it('gestionnaire : son nom, son cabinet (identifiant, nom, domaines) ; aucun identifiant ; jamais en cache', async () => {
    const res = await MOI(requeteQr('/api/aj-signalement/moi'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await res.json()).toEqual({
      profil: 'gestionnaire', nom: 'Marie Exemple', cabinet: { identifiant: 'cabinet-exemple', nom: 'Cabinet Exemple', domaines: ['exemple.test'] },
    })
    expect(simulQr.limites).toEqual(['qr_moi_203.0.113.7', `qr_moi_${A.U1}`])
  })

  it('G3 : son cabinet à lui, jamais un autre', async () => {
    A.connecterQr(A.COMPTE_G3)
    const corps = await (await MOI(requeteQr('/api/aj-signalement/moi'))).json()
    expect(corps.cabinet).toEqual({ identifiant: 'autre-cabinet', nom: 'Autre Cabinet', domaines: ['autre-exemple.test'] })
  })

  it('super admin : { profil: super_admin }', async () => {
    reinitialiserSimulQr()
    const res = await MOI(requeteQr('/api/aj-signalement/moi'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ profil: 'super_admin' })
  })

  it('sans session : 401 ; fiche désactivée : 403 acces_retire', async () => {
    simulQr.user = null
    expect((await MOI(requeteQr('/api/aj-signalement/moi'))).status).toBe(401)
    A.connecterQr(A.COMPTE_G1)
    A.ficheSimuleeQr(A.G1).actif = false
    const res = await MOI(requeteQr('/api/aj-signalement/moi'))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'acces_retire' })
  })
})
