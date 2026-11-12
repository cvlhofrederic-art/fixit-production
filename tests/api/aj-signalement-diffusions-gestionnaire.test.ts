// tests/api/aj-signalement-diffusions-gestionnaire.test.ts
//
// AJ Signalement, PR 3, partie GESTIONNAIRE (décision H11 de Hugo du 11/11/2026 ; cahier § 4.3, § 10.2 ; modèle des
// droits et des routes isolées de la PR 2, SPEC PR 2 § 2.4) — isolation et élévation sur les routes de diffusion :
//   D-R1 valeurs · D-R2 aperçu · D-R3 envoi · D-R4 reprise · D-R5 historique · D-R6 détail · D-R7 opposition écrite ;
//   D-R8 (réglages et activation d'un cabinet) et D-C1 (filet de reprise) restent fermés au gestionnaire.
// Règles prouvées :
//   - un gestionnaire ne diffuse que sur une copropriété de SON cabinet qui lui est attribuée NOMMÉMENT, jamais sur une
//     copropriété « attribuée à tous » (même attribuée aussi nommément : la copropriété de test ne diffuse que par le
//     super admin) ; fiche active, reliée au compte, non bloquée, relue à chaque appel ;
//   - hors portée (collègue, autre cabinet, sans cabinet, inconnue) → 404 introuvable AVANT toute lecture de la
//     copropriété, de ses signalements ou de ses diffusions et sans aucun appel SQL ; « à tous » → 403 lecture_seule ;
//     pour la reprise et le détail, par la copropriété de LA DIFFUSION ;
//   - aucune instruction écrite exigée d'un gestionnaire (c'est le cabinet qui diffuse) ; s'il en envoie une : 400 ;
//     auteur, fiche et cabinet passés à la base viennent de la session (fiche relue), jamais du corps ; la base revérifie
//     H11 (42501 → 403 interdit, rien ne part) ;
//   - historique et détail minimisés : auteur « vous » / « collegue » / « cabinet », jamais un nom ni un identifiant,
//     instruction écrite du super admin non rendue.
// Les fonctions SQL sont simulées au plus près de leur corps pour ce que la route en voit (H11 compris) ; leurs règles
// sont exécutées sur un vrai PostgreSQL dans tests/migrations/signalements_qr_diffusion.execution.test.ts.
// Données fictives (tests/helpers/aj-signalement-acces.ts) : aucune donnée réelle.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/aj-signalement-base')).baseQr.client }))
vi.mock('@/lib/supabase-server-component', async () => (await import('../helpers/aj-signalement-routes')).mockCookies())
vi.mock('@/lib/auth-helpers', async () => (await import('../helpers/aj-signalement-routes')).mockAuth())
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/aj-signalement-routes')).mockLimites())
vi.mock('@/lib/email', async () => (await import('../helpers/aj-signalement-routes')).mockEmail())
vi.mock('@/lib/logger', async () => (await import('../helpers/aj-signalement-routes')).mockLogger())

const { baseQr } = await import('../helpers/aj-signalement-base')
const { ADMIN_QR, contexteQr, copiesCabinetQr, reinitialiserSimulQr, requeteQr, simulQr, texteJournalServeurQr } = await import('../helpers/aj-signalement-routes')
const A = await import('../helpers/aj-signalement-acces')
const { GET: VALEURS } = await import('@/app/api/aj-signalement/coproprietes/[id]/diffusions/valeurs/route')
const { POST: APERCU } = await import('@/app/api/aj-signalement/coproprietes/[id]/diffusions/apercu/route')
const { POST: DIFFUSER, GET: HISTORIQUE } = await import('@/app/api/aj-signalement/coproprietes/[id]/diffusions/route')
const { GET: DETAIL } = await import('@/app/api/aj-signalement/diffusions/[id]/route')
const { POST: REPRENDRE } = await import('@/app/api/aj-signalement/diffusions/[id]/reprendre/route')
const { POST: OPPOSER } = await import('@/app/api/aj-signalement/coproprietes/[id]/signalements/[sid]/opposition/route')
const { GET: LIRE_CABINET, PATCH: MODIFIER_CABINET } = await import('@/app/api/aj-signalement/cabinets/[id]/route')
const { POST: FILET } = await import('@/app/api/cron/aj-diffusion-reprise/route')
const { PROFILS_DIFFUSION_QR } = await import('@/lib/aj-signalement/serveur-diffusion')
const { reinitialiserReplisQr } = await import('@/lib/aj-signalement/serveur')
type Ligne = import('../helpers/aj-signalement-base').Ligne

const CLE = 'cle-de-test-des-liens-de-diffusion-0123456789'
const OPERATION = '0e000000-0000-4000-8000-000000000001'
const INCONNUE = 'c0000000-0000-4000-8000-0000000000ff'
const D_C1_ADMIN = 'df000000-0000-4000-8000-000000000001'
const D_C1_COLLEGUE = 'df000000-0000-4000-8000-000000000002'
const D_C1_VOUS = 'df000000-0000-4000-8000-000000000003'
const D_C2 = 'df000000-0000-4000-8000-000000000004'
const D_TOUS = 'df000000-0000-4000-8000-000000000005'
const D_C3 = 'df000000-0000-4000-8000-000000000006'
const D_INCONNUE = 'df000000-0000-4000-8000-0000000000ff'
/** Instruction écrite saisie par le super admin : texte libre qui nomme une personne (jamais rendu à un gestionnaire). */
const INSTRUCTION_NOMMANTE = 'Courriel de Paul Collègue du 12/11/2026 10:02'

const ilYa = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

/** Réglages de diffusion d'un cabinet activé. */
const reglages = (identifiant: string): Ligne => ({
  diffusion_contact_email: `contact@${identifiant}.test`, diffusion_politique_url: `https://${identifiant}.test/confidentialite`,
  diffusion_politique_verifiee_le: '2026-11-01T09:00:00+00:00', diffusion_contrat_reference: 'Contrat exemple v1',
  diffusion_contrat_signe_le: '2026-11-01', diffusion_telephones: ['0612345678'], diffusion_activee_le: '2026-11-02T09:00:00+00:00',
})

/** Une diffusion existante (colonnes lues par les routes). */
const diffusion = (id: string, coproprieteId: string, cabinetId: string, auteur: { profil: 'super_admin' | 'gestionnaire'; compte: string; fiche: string | null }, minutes: number): Ligne => ({
  id, copropriete_id: coproprieteId, cabinet_id: cabinetId, operation_id: id.replace('df', '0e'), acteur_profil: auteur.profil,
  acteur_id: auteur.compte, acteur_gestionnaire_id: auteur.fiche,
  instruction_reference: auteur.profil === 'super_admin' ? INSTRUCTION_NOMMANTE : null,
  instruction_recue_le: auteur.profil === 'super_admin' ? '2026-11-12' : null,
  modele: 'coupure_eau', langue: 'fr', fige_cabinet_nom: 'Cabinet Exemple', fige_cabinet_identifiant: 'cabinet-exemple',
  fige_copropriete_nom: 'Résidence', fige_contact_email: 'contact@cabinet-exemple.test', fige_politique_url: 'https://cabinet-exemple.test/confidentialite',
  fige_expediteur: '"Cabinet Exemple" <diffusion@exemple.test>', objet: 'Coupure d’eau demain matin',
  texte: 'L’eau sera coupée demain de 9 h à 10 h pour une réparation.', portee: 'copropriete', libelle_perimetre: 'Toute la copropriété',
  nb_destinataires: 2, nb_exclus_opposition: 0, copie_cabinet_le: null, created_at: ilYa(minutes),
})

interface DestSim { id: string; diffusion: string; email: string; etat: string; lot: number | null }
let destinataires: DestSim[] = []
let dernierLot = 0
const idDestinataire = (i: number) => `de000000-0000-4000-8000-${String(i).padStart(12, '0')}`
const ajouterDestinataires = (diffusionId: string, n: number) => {
  for (let i = 1; i <= n; i++) destinataires.push({ id: idDestinataire(destinataires.length + 1), diffusion: diffusionId, email: `declarant${i}@exemple.test`, etat: 'en_attente', lot: null })
}

/**
 * Règle H11 de la base (signalements_qr_diffusion_gestionnaire_autorise, 20261113) : fiche active, reliée à CE compte,
 * non bloquée, du cabinet de la copropriété, attribution NOMMÉE, copropriété non « attribuée à tous ».
 */
function autoriseParLaBase(a: Record<string, unknown>): boolean {
  const g = baseQr.table('signalements_qr_gestionnaires').find((f) => f.id === a.p_gestionnaire)
  const c = baseQr.table('signalements_qr_coproprietes').find((x) => x.id === a.p_copropriete)
  return !!g && !!c && g.actif === true && g.user_id === a.p_acteur && !g.connexion_bloquee_le && c.cabinet_id === g.cabinet_id
    && c.attribuee_a_tous !== true
    && baseQr.table('signalements_qr_attributions').some((x) => x.gestionnaire_id === g.id && x.copropriete_id === c.id)
}
const REFUS_H11 = { error: { code: '42501', message: 'interdit' } }

function poserFonctions(): void {
  const f = baseQr.etat.fonctions
  f.signalements_qr_diffusion_raison_inactive = (a) => {
    const c = baseQr.table('signalements_qr_coproprietes').find((x) => x.id === a.p_copropriete)
    if (!c) return { data: 'introuvable' }
    if (c.actif === false) return { data: 'copropriete_inactive' }
    const k = baseQr.table('signalements_qr_cabinets').find((x) => x.id === c.cabinet_id)
    if (!k) return { data: 'sans_cabinet' }
    return { data: k.diffusion_activee_le ? null : 'diffusion_non_activee' }
  }
  f.signalements_qr_diffusion_valeurs = () => ({ data: [{ batiment: 'A', etage: '1', nb_adresses: 2 }] })
  f.signalements_qr_diffusions_mois = () => ({ data: [{ nb: 1, dernier_le: '2026-11-08T10:00:00+00:00' }] })
  f.signalements_qr_diffusion_apercu = (a) => {
    const raison = (f.signalements_qr_diffusion_raison_inactive(a).data as string | null) ?? null
    return { data: [{ nb_destinataires: 2, nb_exclus_opposition: 0, possible: raison === null, raison, instant: '2026-11-12T10:00:00.123456+00:00' }] }
  }
  f.signalements_qr_diffusion_creer = (a) => {
    if (a.p_profil === 'gestionnaire' && !autoriseParLaBase(a)) return REFUS_H11
    const c = baseQr.table('signalements_qr_coproprietes').find((x) => x.id === a.p_copropriete) as Ligne
    const id = `df000000-0000-4000-8000-${String(baseQr.table('signalements_qr_diffusions').length + 100).padStart(12, '0')}`
    baseQr.table('signalements_qr_diffusions').push({
      ...diffusion(id, String(a.p_copropriete), String(c.cabinet_id), { profil: a.p_profil as 'gestionnaire', compte: String(a.p_acteur), fiche: (a.p_gestionnaire as string | null) ?? null }, 0),
      operation_id: a.p_operation, instruction_reference: a.p_instruction_reference, instruction_recue_le: a.p_instruction_recue_le,
      objet: a.p_objet, texte: a.p_texte, fige_expediteur: a.p_expediteur, libelle_perimetre: a.p_libelle,
    })
    ajouterDestinataires(id, 2)
    return { data: [{ diffusion_id: id, nb_destinataires: 2, rejeu: false }] }
  }
  f.signalements_qr_diffusion_lot = (a) => {
    const choisies = destinataires.filter((x) => x.diffusion === a.p_diffusion && x.etat === 'en_attente').slice(0, Number(a.p_taille))
    if (choisies.length === 0) return { data: [] }
    dernierLot += 1
    for (const l of choisies) Object.assign(l, { etat: 'en_cours', lot: dernierLot })
    return { data: choisies.map((l) => ({ destinataire_id: l.id, email: l.email, lot: l.lot, reprise: false })) }
  }
  f.signalements_qr_diffusion_resultats = (a) => {
    for (const l of destinataires) if (l.lot === a.p_lot && (a.p_envoyes as string[]).includes(l.id)) l.etat = 'envoye'
    const reste = destinataires.filter((l) => l.diffusion === a.p_diffusion && (l.etat === 'en_attente' || l.etat === 'en_cours')).length
    return { data: { envoyes: (a.p_envoyes as string[]).length, refuses: 0, nonPartis: 0, reste } }
  }
  f.signalements_qr_diffusion_nombres = (a) => {
    const de = destinataires.filter((l) => l.diffusion === a.p_diffusion)
    const n = (etats: string[]) => de.filter((l) => etats.includes(l.etat)).length
    return { data: [{ nb_envoyes: n(['envoye']), nb_refuses: 0, nb_attente: n(['en_attente', 'en_cours']), nb_annules: 0, nb_incertains: 0, nb_opposes: 0, nb_perimes: 0 }] }
  }
  f.signalements_qr_diffusions_liste = (a) => ({
    data: baseQr.table('signalements_qr_diffusions').filter((d) => d.copropriete_id === a.p_copropriete).map((d) => ({
      id: d.id, cree_le: d.created_at, acteur_profil: d.acteur_profil, acteur_id: d.acteur_id, acteur_gestionnaire_id: d.acteur_gestionnaire_id,
      modele: d.modele, objet: d.objet, portee: d.portee, libelle_perimetre: d.libelle_perimetre, nb_destinataires: d.nb_destinataires,
      nb_exclus_opposition: 0, nb_envoyes: 2, nb_refuses: 0, nb_attente: 0, nb_annules: 0, nb_incertains: 0,
    })),
  })
  f.signalements_qr_diffusion_purger = () => ({ data: [{ diffusions: 0, oppositions: 0, perimees: 0 }] })
  f.signalements_qr_diffusion_opposer_signalement = (a) => {
    if (a.p_profil === 'gestionnaire' && !autoriseParLaBase(a)) return REFUS_H11
    return { data: baseQr.table('signalements_qr').some((s) => s.id === a.p_signalement && s.copropriete_id === a.p_copropriete) }
  }
  f.signalements_qr_diffusions_a_reprendre = () => ({ data: [] })
}

beforeEach(() => {
  reinitialiserSimulQr()
  reinitialiserReplisQr()
  baseQr.reinitialiser()
  A.poserJeuAccesQr()
  A.connecterQr(A.COMPTE_G1)
  destinataires = []
  dernierLot = 0
  process.env.AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION = CLE
  process.env.RESEND_API_KEY = 're_test'
  process.env.INTERNAL_API_SECRET = 'secret-interne-de-test'
  const t = baseQr.etat.tables
  t.signalements_qr_cabinets = t.signalements_qr_cabinets.map((k) => ({ ...k, ...reglages(String(k.identifiant)) }))
  t.signalements_qr_coproprietes = t.signalements_qr_coproprietes.map((c) => ({ ...c, diffusion_fin_gestion_le: null }))
  const SA = { profil: 'super_admin' as const, compte: ADMIN_QR.id, fiche: null }
  t.signalements_qr_diffusions = [
    diffusion(D_C1_ADMIN, A.C1, A.CAB, SA, 30),
    diffusion(D_C1_COLLEGUE, A.C1, A.CAB, { profil: 'gestionnaire', compte: A.U2, fiche: A.G2 }, 20),
    diffusion(D_C1_VOUS, A.C1, A.CAB, { profil: 'gestionnaire', compte: A.U1, fiche: A.G1 }, 10),
    diffusion(D_C2, A.C2, A.CAB, { profil: 'gestionnaire', compte: A.U2, fiche: A.G2 }, 10),
    diffusion(D_TOUS, A.C_TOUS, A.CAB, SA, 10),
    diffusion(D_C3, A.C3, A.CAB_AUTRE, { profil: 'gestionnaire', compte: A.U3, fiche: A.G3 }, 10),
  ]
  for (const d of [D_C1_VOUS, D_C2, D_TOUS, D_C3]) ajouterDestinataires(d, 2)
  poserFonctions()
})

afterEach(() => {
  delete process.env.AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION
  delete process.env.INTERNAL_API_SECRET
})

// ── Appels ──

const DIFFUSION_GESTIONNAIRE = {
  operationId: OPERATION,
  modele: 'coupure_eau',
  objet: 'Coupure d’eau demain matin',
  texte: 'L’eau sera coupée demain de 9 h à 10 h pour une réparation. Astreinte : 06 12 34 56 78.',
  perimetre: { portee: 'copropriete' },
  perimetreJusquAu: new Date(Date.now() - 60_000).toISOString(),
  nbDestinatairesAttendu: 2,
}

const valeurs = (copro: string) => VALEURS(requeteQr(`/api/aj-signalement/coproprietes/${copro}/diffusions/valeurs`), contexteQr(copro))
const apercu = (copro: string, corps: unknown = { perimetre: { portee: 'copropriete' } }) =>
  APERCU(requeteQr(`/api/aj-signalement/coproprietes/${copro}/diffusions/apercu`, 'POST', corps), contexteQr(copro))
const diffuser = (copro: string, corps: unknown = DIFFUSION_GESTIONNAIRE) =>
  DIFFUSER(requeteQr(`/api/aj-signalement/coproprietes/${copro}/diffusions`, 'POST', corps), contexteQr(copro))
const historique = (copro: string) => HISTORIQUE(requeteQr(`/api/aj-signalement/coproprietes/${copro}/diffusions`), contexteQr(copro))
const detail = (id: string) => DETAIL(requeteQr(`/api/aj-signalement/diffusions/${id}`), contexteQr(id))
const reprendre = (id: string, corps?: unknown) => REPRENDRE(requeteQr(`/api/aj-signalement/diffusions/${id}/reprendre`, 'POST', corps), contexteQr(id))
const opposer = (copro: string, sid: string, corps: unknown = { demandeRecueLe: '2026-11-10' }) => OPPOSER(
  requeteQr(`/api/aj-signalement/coproprietes/${copro}/signalements/${sid}/opposition`, 'POST', corps), { params: Promise.resolve({ id: copro, sid }) })

/** Les cinq routes d'une copropriété (le signalement de D-R7 est pris dans la copropriété visée). */
const routesCopropriete = (copro: string, sid: string): Array<[string, () => Promise<Response>]> => [
  ['D-R1', () => valeurs(copro)], ['D-R2', () => apercu(copro)], ['D-R3', () => diffuser(copro)],
  ['D-R5', () => historique(copro)], ['D-R7', () => opposer(copro, sid)],
]
/** Les deux routes d'une diffusion. */
const routesDiffusion = (id: string): Array<[string, () => Promise<Response>]> => [['D-R4', () => reprendre(id)], ['D-R6', () => detail(id)]]

const rpcAppelees = () => baseQr.etat.appelsRpc.map((a) => a.nom)
const tablesLues = () => baseQr.etat.lectures.map((l) => l.table)
/** Tables qu'aucune réponse hors portée ne doit avoir lues (la copropriété elle-même n'est lue que par ses colonnes de droits). */
const TABLES_DU_CONTENU = ['signalements_qr', 'signalements_qr_cabinets', 'signalements_qr_diffusion_destinataires']
const ecrituresJournal = () => baseQr.ecrituresDe('signalements_qr_journal', 'insert')

/** Rien d'un collègue, d'un autre cabinet ni d'une instruction écrite dans une réponse de G1. */
function sansDonneeDautrui(texte: string): void {
  for (const interdit of [A.G2, A.U2, A.EMAIL_G2, 'Paul', A.G3, A.U3, A.EMAIL_G3, 'Luc', A.CAB_AUTRE, ADMIN_QR.id, A.U1, A.G1]) {
    expect(texte, interdit).not.toContain(interdit)
  }
}

describe('profils des routes de diffusion', () => {
  it('PROFILS_DIFFUSION_QR : super admin et gestionnaire (D-R1 à D-R7) ; D-R8 et D-C1 ne le lisent pas', () => {
    expect([...PROFILS_DIFFUSION_QR].sort()).toEqual(['gestionnaire', 'super_admin'])
  })
})

describe('gestionnaire sur une copropriété attribuée nommément (G1, C1)', () => {
  it('D-R1 valeurs : 200, diffusion possible ; limites par IP puis par COMPTE', async () => {
    const res = await valeurs(A.C1)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ possible: true, raison: null, langue: 'fr', ceMois: { nb: 1 } })
    expect(simulQr.limites).toEqual(expect.arrayContaining([`qr_diffusion_valeurs_${A.U1}`]))
  })

  it('D-R2 aperçu : 200, nombre exact ; la fiche est relue à l’appel', async () => {
    const res = await apercu(A.C1)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ nbDestinataires: 2, possible: true })
    expect(baseQr.etat.lectures.some((l) => l.table === 'signalements_qr_gestionnaires' && l.filtres.includes(`user_id=eq.${A.U1}`))).toBe(true)
  })

  it('D-R3 envoi : 201 SANS instruction écrite ; auteur, profil et fiche de la SESSION passés à la base ; copie au cabinet', async () => {
    const res = await diffuser(A.C1)
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ nbDestinataires: 2, envoyes: 2, reste: 0, rejeu: false })
    const creation = baseQr.etat.appelsRpc.find((a) => a.nom === 'signalements_qr_diffusion_creer')
    expect(creation?.args).toMatchObject({
      p_copropriete: A.C1, p_acteur: A.U1, p_profil: 'gestionnaire', p_gestionnaire: A.G1, p_instruction_reference: null, p_instruction_recue_le: null,
    })
    // Copie au contact du cabinet : « par un gestionnaire », jamais son nom ni son adresse, aucune instruction écrite.
    const copies = copiesCabinetQr().flatMap((c) => c.messages)
    expect(copies.map((m) => m.to)).toEqual(['contact@cabinet-exemple.test'])
    expect(copies).toHaveLength(1)
    expect(copies[0].html).toContain('par un gestionnaire')
    expect(JSON.stringify(copies)).not.toMatch(/Marie|marie\.exemple|instruction/i)
  })

  it('D-R3 : une instruction écrite envoyée par un gestionnaire → 400, rien n’est créé', async () => {
    const res = await diffuser(A.C1, { ...DIFFUSION_GESTIONNAIRE, instruction: { reference: 'Courriel du cabinet du 12/11/2026', recueLe: '2026-11-12' } })
    expect(res.status).toBe(400)
    expect(rpcAppelees()).not.toContain('signalements_qr_diffusion_creer')
  })

  it('D-R5 historique : auteur « vous » / « collegue » / « cabinet », jamais un nom ni un identifiant', async () => {
    const res = await historique(A.C1)
    expect(res.status).toBe(200)
    const corps = await res.json()
    const auteurs = Object.fromEntries(corps.diffusions.map((d: { id: string; auteur: string }) => [d.id, d.auteur]))
    expect(auteurs).toEqual({ [D_C1_ADMIN]: 'cabinet', [D_C1_COLLEGUE]: 'collegue', [D_C1_VOUS]: 'vous' })
    sansDonneeDautrui(JSON.stringify(corps))
  })

  it('D-R6 détail : diffusion du super admin → auteur « cabinet », instruction écrite NON rendue ; d’un collègue → « collegue »', async () => {
    const admin = await detail(D_C1_ADMIN)
    expect(admin.status).toBe(200)
    const corps = await admin.json()
    expect(corps.diffusion).toMatchObject({ id: D_C1_ADMIN, auteur: 'cabinet', instruction: null, texte: expect.stringContaining('L’eau sera coupée') })
    sansDonneeDautrui(JSON.stringify(corps))
    expect((await (await detail(D_C1_COLLEGUE)).json()).diffusion.auteur).toBe('collegue')
  })

  it('D-R4 reprise : 200 ; journal diffusion.reprise à SON nom (profil, fiche, cabinet de la fiche)', async () => {
    const res = await reprendre(D_C1_VOUS)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ envoyes: 2, reste: 0 })
    expect(ecrituresJournal().map((e) => e.valeurs)).toEqual([expect.objectContaining({
      action: 'diffusion.reprise', acteur_profil: 'gestionnaire', acteur_id: A.U1, acteur_gestionnaire_id: A.G1, cabinet_id: A.CAB, copropriete_id: A.C1,
    })])
  })

  it('D-R4 : la diffusion d’un collègue sur SA copropriété peut être reprise (le cabinet diffuse)', async () => {
    ajouterDestinataires(D_C1_COLLEGUE, 1)
    expect((await reprendre(D_C1_COLLEGUE)).status).toBe(200)
  })

  it('D-R7 opposition écrite : 200 ; la base reçoit le profil et la fiche de la session', async () => {
    const res = await opposer(A.C1, A.S1)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ enregistree: true })
    expect(baseQr.etat.appelsRpc.find((a) => a.nom === 'signalements_qr_diffusion_opposer_signalement')?.args).toMatchObject({
      p_signalement: A.S1, p_copropriete: A.C1, p_acteur: A.U1, p_profil: 'gestionnaire', p_gestionnaire: A.G1,
    })
  })

  it('aucune donnée d’un collègue ni d’un autre cabinet dans le journal serveur', async () => {
    await diffuser(A.C1)
    await historique(A.C1)
    await detail(D_C1_ADMIN)
    expect(texteJournalServeurQr()).not.toMatch(/Paul|Marie|@exemple\.test/)
  })
})

describe('isolation : copropriété hors de la portée nommée → 404, sans aucune lecture ni appel SQL', () => {
  const CAS: Array<[string, string, string]> = [
    ['copropriété d’un collègue (même cabinet)', A.C2, A.S2],
    ['copropriété d’un autre cabinet', A.C3, A.S3],
    ['« à tous » d’un autre cabinet', A.C_TOUS_AUTRE, A.S_TOUS_AUTRE],
    ['copropriété sans cabinet', A.C_SANS, A.S_SANS],
    ['copropriété inconnue', INCONNUE, A.S1],
  ]

  it.each(CAS)('%s : D-R1, D-R2, D-R3, D-R5, D-R7 → 404 introuvable', async (_cas, copro, sid) => {
    for (const [nom, appel] of routesCopropriete(copro, sid)) {
      baseQr.etat.lectures = []
      baseQr.etat.appelsRpc = []
      const res = await appel()
      expect(res.status, nom).toBe(404)
      expect(await res.json(), nom).toEqual({ error: 'introuvable' })
      expect(baseQr.etat.appelsRpc, nom).toEqual([])
      expect(tablesLues().filter((t) => TABLES_DU_CONTENU.includes(t)), nom).toEqual([])
      // La copropriété n'est lue que par ses colonnes de droits, filtrée par le cabinet de la fiche.
      const lecturesCopro = baseQr.etat.lectures.filter((l) => l.table === 'signalements_qr_coproprietes')
      for (const l of lecturesCopro) {
        expect(l.colonnes, nom).toBe('id, cabinet_id, attribuee_a_tous')
        expect(l.filtres, nom).toContain(`cabinet_id=eq.${A.CAB}`)
      }
    }
    expect(baseQr.etat.ecritures).toEqual([])
    expect(detailEnvoye()).toBe(false)
  })

  it.each([
    ['diffusion d’un collègue', D_C2],
    ['diffusion d’un autre cabinet', D_C3],
    ['diffusion inconnue (ou purgée)', D_INCONNUE],
  ])('%s : D-R4 et D-R6 → 404 introuvable, ni nombres ni envoi', async (_cas, id) => {
    for (const [nom, appel] of routesDiffusion(id)) {
      baseQr.etat.appelsRpc = []
      const res = await appel()
      expect(res.status, nom).toBe(404)
      expect(await res.json(), nom).toEqual({ error: 'introuvable' })
      expect(baseQr.etat.appelsRpc, nom).toEqual([])
    }
    expect(ecrituresJournal()).toEqual([])
    expect(detailEnvoye()).toBe(false)
  })

  it('G3 (autre cabinet) sur la copropriété de G1 : 404 partout', async () => {
    A.connecterQr(A.COMPTE_G3)
    for (const [nom, appel] of [...routesCopropriete(A.C1, A.S1), ...routesDiffusion(D_C1_VOUS)]) expect((await appel()).status, nom).toBe(404)
    expect(baseQr.etat.appelsRpc).toEqual([])
  })

  it('G2 sur la copropriété de G1 : 404 ; sur la sienne : 200 (même cabinet, portées distinctes)', async () => {
    A.connecterQr(A.COMPTE_G2)
    expect((await valeurs(A.C1)).status).toBe(404)
    expect((await valeurs(A.C2)).status).toBe(200)
    expect((await detail(D_C2)).status).toBe(200)
  })

  it('attribution retirée entre deux appels : la requête suivante répond 404 (portée relue à chaque appel)', async () => {
    expect((await valeurs(A.C1)).status).toBe(200)
    baseQr.etat.tables.signalements_qr_attributions = baseQr.table('signalements_qr_attributions').filter((x) => x.gestionnaire_id !== A.G1)
    expect((await valeurs(A.C1)).status).toBe(404)
    expect((await diffuser(A.C1)).status).toBe(404)
  })
})

describe('« attribuée à tous » → 403 lecture_seule (la copropriété de test ne diffuse que par le super admin)', () => {
  it('D-R1, D-R2, D-R3, D-R5, D-R7 sur la « à tous » de son cabinet : 403 lecture_seule, aucun appel SQL', async () => {
    for (const [nom, appel] of routesCopropriete(A.C_TOUS, A.S_TOUS)) {
      const res = await appel()
      expect(res.status, nom).toBe(403)
      expect(await res.json(), nom).toEqual({ error: 'lecture_seule' })
    }
    expect(baseQr.etat.appelsRpc).toEqual([])
    expect(baseQr.etat.ecritures).toEqual([])
  })

  it('même si elle lui est AUSSI attribuée nommément : 403 lecture_seule (H11)', async () => {
    baseQr.table('signalements_qr_attributions').push({ copropriete_id: A.C_TOUS, gestionnaire_id: A.G1, origine: 'super_admin', created_at: '2026-11-05T09:00:00+00:00' })
    for (const [nom, appel] of routesCopropriete(A.C_TOUS, A.S_TOUS)) expect((await appel()).status, nom).toBe(403)
    expect(baseQr.etat.appelsRpc).toEqual([])
  })

  it('D-R4 et D-R6 sur une diffusion de la « à tous » : 403 lecture_seule, rien n’est relu ni envoyé', async () => {
    for (const [nom, appel] of routesDiffusion(D_TOUS)) {
      const res = await appel()
      expect(res.status, nom).toBe(403)
      expect(await res.json(), nom).toEqual({ error: 'lecture_seule' })
    }
    expect(baseQr.etat.appelsRpc).toEqual([])
    expect(detailEnvoye()).toBe(false)
  })

  it('le super admin, lui, diffuse sur la copropriété de test (avec l’instruction écrite)', async () => {
    simulQr.user = ADMIN_QR
    expect((await valeurs(A.C_TOUS)).status).toBe(200)
    const res = await diffuser(A.C_TOUS, { ...DIFFUSION_GESTIONNAIRE, instruction: { reference: 'Courriel du cabinet du 12/11/2026', recueLe: '2026-11-12' } })
    expect(res.status).toBe(201)
  })
})

describe('fiche et compte relus à chaque appel', () => {
  it.each([
    ['fiche partie (départ : désactivée)', (f: Ligne) => { f.actif = false }],
    ['connexion bloquée', (f: Ligne) => { f.connexion_bloquee_le = '2026-11-11T09:00:00+00:00' }],
    ['compte non relié à la fiche', (f: Ligne) => { f.user_id = null }],
    ['fiche pseudonymisée', (f: Ligne) => { f.actif = false; f.pseudonymise_le = '2026-11-11T09:00:00+00:00' }],
  ])('%s : 403 acces_retire sur D-R1 à D-R7, aucun appel SQL', async (_cas, modifier) => {
    modifier(A.ficheSimuleeQr(A.G1))
    for (const [nom, appel] of [...routesCopropriete(A.C1, A.S1), ...routesDiffusion(D_C1_VOUS)]) {
      const res = await appel()
      expect(res.status, nom).toBe(403)
      expect(await res.json(), nom).toEqual({ error: 'acces_retire' })
    }
    expect(baseQr.etat.appelsRpc).toEqual([])
    expect(baseQr.etat.ecritures).toEqual([])
  })

  it('rôle seulement dans user_metadata : 403 interdit, aucune lecture de fiche', async () => {
    simulQr.user = { id: A.U1, email: A.EMAIL_G1, app_metadata: {} }
    expect((await valeurs(A.C1)).status).toBe(403)
    expect(baseQr.etat.lectures.filter((l) => l.table === 'signalements_qr_gestionnaires')).toEqual([])
  })
})

describe('élévation de droits', () => {
  it('D-R8 (lecture et réglages du cabinet, activation) : 403 interdit, même pour SON cabinet, sans lire sa fiche', async () => {
    for (const res of [
      await LIRE_CABINET(requeteQr(`/api/aj-signalement/cabinets/${A.CAB}`), contexteQr(A.CAB)),
      await MODIFIER_CABINET(requeteQr(`/api/aj-signalement/cabinets/${A.CAB}`, 'PATCH', { diffusionActivee: true }), contexteQr(A.CAB)),
      await MODIFIER_CABINET(requeteQr(`/api/aj-signalement/cabinets/${A.CAB}`, 'PATCH', { telephonesAutorises: ['0611111111'] }), contexteQr(A.CAB)),
    ]) {
      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({ error: 'interdit' })
    }
    expect(baseQr.etat.lectures.filter((l) => l.table === 'signalements_qr_gestionnaires')).toEqual([])
    expect(baseQr.etat.appelsRpc).toEqual([])
  })

  it('D-C1 (filet de reprise) : une session de gestionnaire n’ouvre rien ; sans secret ou avec un faux → 401, rien n’est repris', async () => {
    simulQr.cleCookie = A.COMPTE_G1
    const sansSecret = await FILET(requeteQr('/api/cron/aj-diffusion-reprise', 'POST'))
    expect(sansSecret.status).toBe(401)
    const requete = new (await import('next/server')).NextRequest('https://vitfix.io/api/cron/aj-diffusion-reprise', {
      method: 'POST', headers: { 'x-cron-secret': 'pas-le-secret', authorization: 'Bearer jeton-de-gestionnaire' },
    }) as NextRequest
    expect((await FILET(requete)).status).toBe(401)
    expect(baseQr.etat.appelsRpc).toEqual([])
    expect(detailEnvoye()).toBe(false)
  })

  it.each([
    ['profil forcé', { p_profil: 'super_admin' }],
    ['auteur forcé', { acteurId: A.U2 }],
    ['fiche forcée', { gestionnaireId: A.G2 }],
    ['cabinet forcé', { cabinetId: A.CAB_AUTRE }],
    ['copropriété forcée', { coproprieteId: A.C2 }],
    ['forçage d’opposition', { forcer: true }],
  ])('D-R3, %s dans le corps : 400 (schéma strict), rien n’est créé', async (_cas, intrus) => {
    expect((await diffuser(A.C1, { ...DIFFUSION_GESTIONNAIRE, ...intrus })).status).toBe(400)
    expect(rpcAppelees()).not.toContain('signalements_qr_diffusion_creer')
  })

  it('D-R7, fiche ou copropriété dans le corps : 400, aucune opposition', async () => {
    for (const intrus of [{ gestionnaireId: A.G2 }, { coproprieteId: A.C2 }, { p_profil: 'super_admin' }]) {
      expect((await opposer(A.C1, A.S1, { demandeRecueLe: '2026-11-10', ...intrus })).status).toBe(400)
    }
    expect(rpcAppelees()).not.toContain('signalements_qr_diffusion_opposer_signalement')
  })

  it('identifiants d’une autre copropriété dans les paramètres : signalement d’une copropriété voisine → 404, rien n’est créé ni opposé', async () => {
    const autreSignalement = { perimetre: { portee: 'signalement', signalementId: A.S2 } }
    expect((await apercu(A.C1, autreSignalement)).status).toBe(404)
    expect((await diffuser(A.C1, { ...DIFFUSION_GESTIONNAIRE, ...autreSignalement })).status).toBe(404)
    expect((await diffuser(A.C1, { ...DIFFUSION_GESTIONNAIRE, perimetre: { portee: 'signalement', signalementId: A.S3 } })).status).toBe(404)
    expect((await opposer(A.C1, A.S2)).status).toBe(404)
    expect((await opposer(A.C1, A.S_TOUS)).status).toBe(404)
    expect(rpcAppelees().filter((n) => n === 'signalements_qr_diffusion_creer' || n === 'signalements_qr_diffusion_opposer_signalement')).toEqual([])
  })

  it('signalement de SA copropriété sous le chemin d’une copropriété hors portée : 404 avant toute lecture du signalement', async () => {
    expect((await opposer(A.C2, A.S1)).status).toBe(404)
    expect(tablesLues()).not.toContain('signalements_qr')
    expect(baseQr.etat.appelsRpc).toEqual([])
  })

  it('la base revérifie H11 (attribution retirée entre le contrôle et l’écriture) : 42501 → 403 interdit, rien ne part', async () => {
    baseQr.etat.fonctions.signalements_qr_diffusion_creer = () => REFUS_H11
    baseQr.etat.fonctions.signalements_qr_diffusion_opposer_signalement = () => REFUS_H11
    const envoi = await diffuser(A.C1)
    expect(envoi.status).toBe(403)
    expect(await envoi.json()).toEqual({ error: 'interdit' })
    expect((await opposer(A.C1, A.S1)).status).toBe(403)
    expect(simulQr.emailsSimples).toEqual([])
    expect(detailEnvoye()).toBe(false)
  })
})

/** Un e-mail de diffusion est-il parti (lot détaillé) ? */
function detailEnvoye(): boolean {
  return destinataires.some((l) => l.etat === 'envoye' || l.etat === 'en_cours')
}
