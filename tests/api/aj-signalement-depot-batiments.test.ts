// tests/api/aj-signalement-depot-batiments.test.ts
//
// Bâtiments saisis par le cabinet (demande de Hugo du 17/11/2026 ; constat : Parc Bel Ombre a ses bâtiments — Titan,
// Planier, Cicies, Faraman, commerces — mais un déclarant a pu saisir « A ») :
//   - POST /api/aj-signalement/signalements : copropriété avec au moins un bâtiment → un bâtiment absent de la liste est
//     refusé (400 batiment_inconnu, message dans la langue de la page, ni la liste ni la saisie, rien d'écrit ni envoyé) ;
//     la comparaison ignore la casse et les espaces en trop, et le nom enregistré (puis envoyé par e-mail) est celui
//     saisi par le cabinet ; copropriété sans bâtiment → comportement d'avant (texte libre enregistré tel quel) ;
//     colonne absente (migration du 11/11/2026 non appliquée) → relue sans elle, comportement d'avant, repli journalisé
//     une fois ;
//   - lireCoproprieteEtCabinetParJetonQr (pages publiques) : la ligne lue porte la colonne batiments (lue en même temps que
//     cabinet_id) ; colonne absente → copropriété relue sans elle.
// Base simulée par tests/helpers/aj-signalement-base.ts : projection sur les colonnes nommées (une colonne non lue n'arrive
// pas), 42703 pour une colonne absente. Aucune donnée réelle : adresses en @exemple.test.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/aj-signalement-base')).baseQr.client }))
vi.mock('@/lib/supabase-server-component', async () => (await import('../helpers/aj-signalement-routes')).mockCookies())
vi.mock('@/lib/auth-helpers', async () => (await import('../helpers/aj-signalement-routes')).mockAuth())
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/aj-signalement-routes')).mockLimites())
vi.mock('@/lib/email', async () => (await import('../helpers/aj-signalement-routes')).mockEmail())
vi.mock('@/lib/logger', async () => (await import('../helpers/aj-signalement-routes')).mockLogger())

const { baseQr } = await import('../helpers/aj-signalement-base')
const { messagesEnvoyesQr, reinitialiserSimulQr, requeteQr, simulQr, texteJournalServeurQr } = await import('../helpers/aj-signalement-routes')
const { POST } = await import('@/app/api/aj-signalement/signalements/route')
const { lireCoproprieteEtCabinetParJetonQr, reinitialiserReplisQr } = await import('@/lib/aj-signalement/serveur')
const { TEXTES_SIGNALEMENT_QR } = await import('@/lib/aj-signalement/textes')

const JETON = '0123456789abcdef0123456789abcdef'
const COPRO = 'c0000000-0000-4000-8000-000000000001'
const BATIMENTS = ['Titan', 'Planier', 'Cicies', 'Faraman', 'commerces']
const CORPS = {
  jeton: JETON, prenom: 'Prénom', nom: 'Déclarant', telephone: '06 00 00 00 00', email: 'declarant@exemple.test',
  batiment: 'Titan', etage: '2', numLot: '7', estPartieCommune: false, zoneSignalee: '', typeIntervention: 'Plomberie',
  description: 'Fuite d’eau au plafond de la cuisine', priorite: 'normale', langue: 'fr', qualiteDeclarant: 'locataire',
}

const coproprietes = () => baseQr.table('signalements_qr_coproprietes')
const deposer = (sur: Record<string, unknown> = {}) => POST(requeteQr('/api/aj-signalement/signalements', 'POST', { ...CORPS, ...sur }))
const insertions = () => baseQr.ecrituresDe('signalements_qr', 'insert').map((e) => e.valeurs as Record<string, unknown>)
const avertissementsRepli = () => simulQr.logger.warn.mock.calls.filter((c) => String(c[0]).includes('11/11/2026'))

beforeEach(() => {
  reinitialiserSimulQr()
  simulQr.user = null
  reinitialiserReplisQr()
  baseQr.reinitialiser()
  vi.unstubAllEnvs()
  vi.stubEnv('ADMIN_EMAIL', 'admin@exemple.test')
  vi.stubEnv('ADMIN_EMAIL_2', '')
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://vitfix.io')
  baseQr.etat.tables.signalements_qr_coproprietes = [{
    id: COPRO, nom: 'Parc Bel Ombre', adresse: '1 rue Exemple', jeton: JETON, actif: true, created_at: '2026-11-01T09:00:00+00:00',
    emails_destinataires: ['cs@externe.test'], cabinet_id: null, batiments: [...BATIMENTS],
  }]
  baseQr.etat.tables.signalements_qr = []
  // Destinataires et budget (migration du 11/11/2026) : aucun gestionnaire, budget accordé.
  baseQr.etat.fonctions.signalements_qr_emails_gestionnaires = () => ({ data: [] })
  baseQr.etat.fonctions.signalements_qr_reserver_emails = () => ({ data: { accorde: true, retenus: 0 } })
})

describe('copropriété dont le cabinet a saisi les bâtiments', () => {
  it('bâtiment absent de la liste (« A ») : 400 batiment_inconnu, message en français, rien d’écrit ni d’envoyé', async () => {
    const res = await deposer({ batiment: 'A' })
    expect(res.status).toBe(400)
    const corps = await res.json()
    expect(corps).toEqual({ error: 'batiment_inconnu', message: TEXTES_SIGNALEMENT_QR.fr.erreurs.batiment_inconnu })
    // Aucun détail interne : ni la liste du cabinet, ni la saisie.
    for (const nom of BATIMENTS) expect(JSON.stringify(corps)).not.toContain(nom)
    expect(insertions()).toEqual([])
    expect(messagesEnvoyesQr()).toEqual([])
    expect(simulQr.emailsSimples).toEqual([])
    expect(texteJournalServeurQr()).not.toContain('declarant@exemple.test')
  })

  it('page en portugais : le message en portugais', async () => {
    const res = await deposer({ batiment: 'Bloco A', langue: 'pt' })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'batiment_inconnu', message: TEXTES_SIGNALEMENT_QR.pt.erreurs.batiment_inconnu })
    expect(TEXTES_SIGNALEMENT_QR.pt.erreurs.batiment_inconnu).not.toBe(TEXTES_SIGNALEMENT_QR.fr.erreurs.batiment_inconnu)
    expect(insertions()).toEqual([])
  })

  it.each([
    ['même écriture', 'Planier', 'Planier'],
    ['casse différente', 'PLANIER', 'Planier'],
    ['espaces en trop', '  planier  ', 'Planier'],
    ['nom en minuscules chez le cabinet', 'Commerces', 'commerces'],
  ])('%s : accepté, enregistré sous le nom saisi par le cabinet', async (_cas, saisi, enregistre) => {
    const res = await deposer({ batiment: saisi })
    expect(res.status).toBe(200)
    expect(insertions()).toHaveLength(1)
    expect(insertions()[0]).toMatchObject({ copropriete_id: COPRO, batiment: enregistre })
    // L'e-mail au cabinet et l'accusé au déclarant reprennent le même nom.
    expect(messagesEnvoyesQr()[0].html).toContain(enregistre)
    expect(simulQr.emailsSimples).toHaveLength(1)
    expect(simulQr.emailsSimples[0].html).toContain(`bât. ${enregistre}`)
  })

  // Appel direct de la route (sans le formulaire) : seuls la casse et les espaces sont tolérés.
  it.each([
    ['accent ajouté', 'Ciciès'],
    ['préfixe « Bât. »', 'Bât. Titan'],
    ['deux bâtiments à la fois', 'Titan, Planier'],
    ['caractère invisible', 'Titan​'],
    ['initiale seule', 'T'],
  ])('appel direct, %s : 400 batiment_inconnu, rien d’écrit ni d’envoyé', async (_cas, saisi) => {
    const res = await deposer({ batiment: saisi })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('batiment_inconnu')
    expect(insertions()).toEqual([])
    expect(messagesEnvoyesQr()).toEqual([])
    expect(simulQr.emailsSimples).toEqual([])
  })

  it('espaces en trop à l’intérieur du nom : accepté, enregistré sous le nom du cabinet', async () => {
    coproprietes()[0].batiments = ['Les Pins', 'Titan']
    const res = await deposer({ batiment: '  les   PINS ' })
    expect(res.status).toBe(200)
    expect(insertions()[0]).toMatchObject({ batiment: 'Les Pins' })
  })

  it('la liste est lue en même temps que la copropriété du jeton (une seule lecture)', async () => {
    await deposer()
    const lectures = baseQr.etat.lectures.filter((l) => l.table === 'signalements_qr_coproprietes' && l.filtres.includes(`jeton=eq.${JETON}`))
    expect(lectures).toHaveLength(1)
    expect(lectures[0].colonnes.split(',').map((c) => c.trim())).toContain('batiments')
  })
})

describe('copropriété sans bâtiment saisi : comportement d’avant', () => {
  it.each([
    ['liste vide', []],
    ['colonne vide', null],
  ])('%s : bâtiment libre enregistré tel quel', async (_cas, batiments) => {
    coproprietes()[0].batiments = batiments
    const res = await deposer({ batiment: 'A' })
    expect(res.status).toBe(200)
    expect(insertions()[0]).toMatchObject({ batiment: 'A' })
  })

  it('liste sans aucun nom utilisable (vides, espaces) : traitée comme sans liste', async () => {
    coproprietes()[0].batiments = ['', '   ']
    expect((await deposer({ batiment: 'A' })).status).toBe(200)
    expect(insertions()[0]).toMatchObject({ batiment: 'A' })
  })

  it('colonne absente (migration du 11/11/2026 non appliquée) : relue sans elle, dépôt d’avant, repli journalisé une fois', async () => {
    baseQr.etat.colonnesAbsentes.signalements_qr_coproprietes = ['batiments']
    expect((await deposer({ batiment: 'A' })).status).toBe(200)
    expect((await deposer({ batiment: 'B' })).status).toBe(200)
    expect(insertions().map((l) => l.batiment)).toEqual(['A', 'B'])
    expect(avertissementsRepli()).toHaveLength(1)
    expect(simulQr.logger.error).not.toHaveBeenCalled()
  })

  it('les règles d’avant ne changent pas : jeton inconnu 404, corps invalide 400 invalide', async () => {
    expect((await deposer({ jeton: 'f'.repeat(32) })).status).toBe(404)
    const invalide = await deposer({ batiment: '' })
    expect(invalide.status).toBe(400)
    expect((await invalide.json()).error).toBe('invalide')
  })
})

describe('lecture des pages publiques (lireCoproprieteEtCabinetParJetonQr)', () => {
  it('la ligne lue porte les bâtiments saisis', async () => {
    const lecture = await lireCoproprieteEtCabinetParJetonQr(JETON)
    expect(lecture.ok && lecture.copropriete?.batiments).toEqual(BATIMENTS)
  })

  it('colonne absente : copropriété relue sans elle (aucun bâtiment), page servie', async () => {
    baseQr.etat.colonnesAbsentes.signalements_qr_coproprietes = ['cabinet_id', 'batiments']
    const lecture = await lireCoproprieteEtCabinetParJetonQr(JETON)
    expect(lecture.ok).toBe(true)
    expect(lecture.ok && lecture.copropriete?.nom).toBe('Parc Bel Ombre')
    expect(lecture.ok && lecture.copropriete?.batiments).toBeUndefined()
  })
})
