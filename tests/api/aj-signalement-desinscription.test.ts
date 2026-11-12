// tests/api/aj-signalement-desinscription.test.ts
//
// AJ Signalement, PR 3, lot 6 — routes PUBLIQUES de désinscription des messages de diffusion (cahier § 4.1 D-P1 à D-P5b,
// § 8.1, § 8.2, § 9 ; décision H5 de Hugo : lien d'un an, « Recevoir à nouveau » avec le seul lien qui a servi, dans les
// 24 h, un clic honoré après un an) :
//   D-P1  POST /api/aj-signalement/desinscription/lecture        lecture du lien, AUCUN effet
//   D-P2  POST /api/aj-signalement/desinscription                « Ne plus recevoir » (origine page)
//   D-P3  POST /api/aj-signalement/desinscription/reprendre      « Recevoir à nouveau » (jeton de PAGE seulement)
//   D-P4  POST /api/aj-signalement/desinscription/adresse        repli d'un lien expiré : adresse saisie
//   D-P5  POST /api/aj-signalement/desinscription/un-clic/[jeton] en-tête List-Unsubscribe-Post (RFC 8058)
//   D-P5b GET  /api/aj-signalement/desinscription/un-clic/[jeton] adresse un clic ouverte dans un navigateur : 303
// Les fonctions SQL sont simulées, réduites à ce que la route en voit ; leurs règles (opposition idempotente, levée
// bornée, même insertion que l'adresse soit juste ou fausse) sont exécutées sur un vrai PostgreSQL ailleurs
// (tests/migrations/signalements_qr_diffusion.execution.test.ts). Aucune donnée réelle : adresses en exemple.test.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/aj-signalement-base')).baseQr.client }))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/aj-signalement-routes')).mockLimites())
vi.mock('@/lib/logger', async () => (await import('../helpers/aj-signalement-routes')).mockLogger())

const { baseQr } = await import('../helpers/aj-signalement-base')
const { reinitialiserSimulQr, simulQr, texteJournalServeurQr } = await import('../helpers/aj-signalement-routes')
const { POST: LIRE } = await import('@/app/api/aj-signalement/desinscription/lecture/route')
const { POST: OPPOSER } = await import('@/app/api/aj-signalement/desinscription/route')
const { POST: REPRENDRE } = await import('@/app/api/aj-signalement/desinscription/reprendre/route')
const { POST: ADRESSE } = await import('@/app/api/aj-signalement/desinscription/adresse/route')
const { GET: OUVRIR_UN_CLIC, POST: UN_CLIC } = await import('@/app/api/aj-signalement/desinscription/un-clic/[jeton]/route')
const { signerLiensDiffusionQr } = await import('@/lib/aj-signalement/diffusion-lien')
const { reinitialiserReplisQr } = await import('@/lib/aj-signalement/serveur')
const { DUREE_MIN_ADRESSE_DESINSCRIPTION_MS } = await import('@/lib/aj-signalement/serveur-desinscription')
type Ligne = import('../helpers/aj-signalement-base').Ligne

const CLE = 'cle-de-test-des-liens-de-diffusion-0123456789'
const CLE_PRECEDENTE = 'ancienne-cle-de-test-des-liens-de-diffusion-987'
const DEST = 'de000000-0000-4000-8000-000000000001'
const DEST_PURGE = 'de000000-0000-4000-8000-000000000099'
const DIFFUSION = 'df000000-0000-4000-8000-000000000001'
const COPRO = 'c0000000-0000-4000-8000-000000000001'
const EMAIL = 'marie.dupont@exemple.test'
const JOUR = 24 * 60 * 60 * 1000
const ilYa = (ms: number) => new Date(Date.now() - ms).toISOString()
const ENV_CLE = { AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION: CLE }
const ENV_PRECEDENTE = { AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION: CLE_PRECEDENTE }

/** Une date ISO, ou un horodatage PostgreSQL, quelque part dans un texte. */
const UNE_DATE = /\d{4}-\d{2}-\d{2}/

/** Lignes rendues par signalements_qr_diffusion_lien, par destinataire. */
let liens: Record<string, Ligne> = {}
/** Opposition simulée par destinataire (pour lever et la relecture du lien). */
let oppositions: Record<string, { origine: string; levable: boolean }> = {}

const ligneLien = (reglages: Ligne = {}): Ligne => ({
  diffusion_id: DIFFUSION, copropriete_id: COPRO, copropriete_nom: 'Résidence Exemple', cabinet_nom: 'Cabinet Exemple',
  cabinet_identifiant: 'cabinet-exemple', langue: 'fr', politique_url: 'https://cabinet-exemple.test/confidentialite',
  contact_email: 'contact@cabinet-exemple.test', diffusion_cree_le: ilYa(10 * JOUR), email: EMAIL, oppose: false, levable: false,
  ...reglages,
})

function poserBase(): void {
  baseQr.reinitialiser()
  baseQr.table('signalements_qr_cabinets').push(
    {
      id: 'ca000000-0000-4000-8000-000000000001', nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple', langue: 'fr',
      diffusion_contact_email: 'contact@cabinet-exemple.test', diffusion_politique_url: 'https://cabinet-exemple.test/confidentialite',
    },
    {
      id: 'ca000000-0000-4000-8000-000000000002', nom: 'Autre Cabinet', identifiant: 'autre-cabinet', langue: 'pt',
      diffusion_contact_email: 'contact@autre-cabinet.test', diffusion_politique_url: 'https://autre-cabinet.test/privacidade',
    },
  )
  liens = { [DEST]: ligneLien() }
  oppositions = {}
  const f = baseQr.etat.fonctions
  f.signalements_qr_diffusion_lien = (a) => {
    const ligne = liens[String(a.p_destinataire)]
    if (!ligne) return { data: [] }
    const o = oppositions[String(a.p_destinataire)]
    return { data: [{ ...ligne, ...(o ? { oppose: true, levable: o.levable } : {}) }] }
  }
  f.signalements_qr_diffusion_opposer = (a) => {
    const id = String(a.p_destinataire)
    if (!liens[id]) return { data: false }
    if (a.p_email_saisi !== null && a.p_email_saisi !== undefined && String(a.p_email_saisi).trim().toLowerCase() !== EMAIL) return { data: false }
    oppositions[id] ??= { origine: String(a.p_origine), levable: a.p_origine === 'page' || a.p_origine === 'un_clic' }
    return { data: true }
  }
  f.signalements_qr_diffusion_lever = (a) => {
    const id = String(a.p_destinataire)
    const o = oppositions[id]
    if (!o?.levable) return { data: false }
    delete oppositions[id]
    return { data: true }
  }
}

const appelsDe = (nom: string) => baseQr.etat.appelsRpc.filter((a) => a.nom === nom)

function requeteJson(chemin: string, corps: unknown): NextRequest {
  return new NextRequest(`https://vitfix.io${chemin}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corps) })
}

const lire = (jeton: string, identifiant = 'cabinet-exemple') => LIRE(requeteJson('/api/aj-signalement/desinscription/lecture', { jeton, identifiant }))
const opposer = (jeton: string, identifiant = 'cabinet-exemple') => OPPOSER(requeteJson('/api/aj-signalement/desinscription', { jeton, identifiant }))
const reprendre = (jeton: string, identifiant = 'cabinet-exemple') => REPRENDRE(requeteJson('/api/aj-signalement/desinscription/reprendre', { jeton, identifiant }))
const parAdresse = (jeton: string, email: string, identifiant = 'cabinet-exemple') =>
  ADRESSE(requeteJson('/api/aj-signalement/desinscription/adresse', { jeton, identifiant, email }))

const CORPS_UN_CLIC = 'List-Unsubscribe=One-Click'
function requeteUnClic(jeton: string, corps: BodyInit | null = CORPS_UN_CLIC, type: string | null = 'application/x-www-form-urlencoded'): NextRequest {
  const headers: Record<string, string> = type ? { 'content-type': type } : {}
  return new NextRequest(`https://vitfix.io/api/aj-signalement/desinscription/un-clic/${jeton}`, { method: 'POST', headers, body: corps })
}
const unClic = (jeton: string, requete = requeteUnClic(jeton)) => UN_CLIC(requete, { params: Promise.resolve({ jeton }) })
const ouvrirUnClic = (jeton: string) =>
  OUVRIR_UN_CLIC(new NextRequest(`https://vitfix.io/api/aj-signalement/desinscription/un-clic/${jeton}`), { params: Promise.resolve({ jeton }) })

async function jetons(id = DEST, env: Record<string, string> = ENV_CLE): Promise<{ page: string; unClic: string }> {
  const s = await signerLiensDiffusionQr(id, env)
  if (!s.ok) throw new Error(s.code)
  return { page: s.page, unClic: s.unClic }
}

/** Même identifiant, signature changée d'un caractère : « inconnu », jamais le repli. */
const signatureFausse = (jeton: string) => `${jeton.slice(0, -1)}${jeton.endsWith('0') ? '1' : '0'}`

beforeEach(() => {
  reinitialiserSimulQr()
  reinitialiserReplisQr()
  poserBase()
  vi.stubEnv('AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION', CLE)
  vi.stubEnv('AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION_PRECEDENTE', CLE_PRECEDENTE)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

function expectPrivee(reponse: Response): void {
  expect(reponse.headers.get('cache-control')).toBe('private, no-store')
}

// ── D-P1 : lecture ──────────────────────────────────────────────────────────

describe('D-P1 lecture du lien : aucun effet, aucune date, adresse masquée seulement', () => {
  it('jeton de page valable : copropriété, cabinet, adresse masquée, état, politique ; aucune écriture ; jamais en cache', async () => {
    const { page } = await jetons()
    const r = await lire(page)
    expect(r.status).toBe(200)
    expectPrivee(r)
    expect(await r.json()).toEqual({
      etat: 'valide', type: 'page', langue: 'fr', cabinet: 'Cabinet Exemple', copropriete: 'Résidence Exemple',
      emailMasque: 'ma***@exemple.test', oppose: false, levable: false, politiqueUrl: 'https://cabinet-exemple.test/confidentialite',
    })
    // Lecture seule : la fonction du lien, rien d'autre (ni opposition, ni levée, ni écriture).
    expect(baseQr.etat.appelsRpc.map((a) => a.nom)).toEqual(['signalements_qr_diffusion_lien'])
    expect(appelsDe('signalements_qr_diffusion_lien')[0].args).toEqual({ p_destinataire: DEST })
    expect(baseQr.etat.ecritures).toEqual([])
  })

  it('aucune date dans la réponse (un message transféré ne dit pas quand la personne s’est opposée), même opposée', async () => {
    const { page } = await jetons()
    oppositions[DEST] = { origine: 'page', levable: true }
    const texte = await (await lire(page)).text()
    expect(texte).not.toMatch(UNE_DATE)
    expect(texte).not.toMatch(/cree|_le"|date/i)
    expect(JSON.parse(texte)).toMatchObject({ etat: 'valide', oppose: true, levable: true })
  })

  it('jeton un clic (page ouverte depuis l’adresse de l’en-tête) : ni adresse masquée, ni « levable », ni état d’opposition', async () => {
    // Relecture 2 : le jeton un clic se lit dans les journaux du Worker, chez Resend, dans la source d'un message
    // transféré ; il ne sert qu'à s'opposer (§ 8.1) et ne dit donc pas si la personne est déjà opposée (sinon, avec le
    // repli par l'adresse, il confirmerait une adresse devinée). La page affiche toujours le bouton (D-P2 idempotente).
    const { unClic: jeton } = await jetons()
    const attendu = {
      etat: 'valide', type: 'un_clic', langue: 'fr', cabinet: 'Cabinet Exemple', copropriete: 'Résidence Exemple',
      politiqueUrl: 'https://cabinet-exemple.test/confidentialite',
    }
    expect(await (await lire(jeton)).json()).toEqual(attendu)
    oppositions[DEST] = { origine: 'un_clic', levable: true }
    expect(await (await lire(jeton)).json()).toEqual(attendu)
  })

  it('adresse illisible (signalement source supprimé ou adresse changée) : aucune adresse masquée, le reste inchangé', async () => {
    const { page } = await jetons()
    liens[DEST] = ligneLien({ email: null })
    const corps = await (await lire(page)).json()
    expect(corps.etat).toBe('valide')
    expect('emailMasque' in corps).toBe(false)
  })

  it('jamais l’adresse en clair : courte ou longue, elle est masquée', async () => {
    const { page } = await jetons()
    for (const [email, masque] of [['ab@exemple.test', 'a***@exemple.test'], ['a@exemple.test', '***@exemple.test'], ['abcd@exemple.test', 'ab***@exemple.test']]) {
      liens[DEST] = ligneLien({ email })
      const texte = await (await lire(page)).text()
      expect(JSON.parse(texte).emailMasque).toBe(masque)
      expect(texte).not.toContain(email)
    }
  })

  it('cabinet du chemin différent de celui de la diffusion : « inconnu », avec le contact du cabinet du chemin (sa langue)', async () => {
    const { page } = await jetons()
    const r = await lire(page, 'autre-cabinet')
    expect(await r.json()).toEqual({ etat: 'inconnu', langue: 'pt', contactCabinet: 'contact@autre-cabinet.test' })
  })

  it('plus de 365 jours après la diffusion : « expire » (repli par l’adresse) ; ni adresse masquée, ni état d’opposition', async () => {
    const { page } = await jetons()
    liens[DEST] = ligneLien({ diffusion_cree_le: ilYa(366 * JOUR) })
    expect(await (await lire(page)).json()).toEqual({
      etat: 'expire', type: 'page', langue: 'fr', cabinet: 'Cabinet Exemple', copropriete: 'Résidence Exemple',
      politiqueUrl: 'https://cabinet-exemple.test/confidentialite',
    })
  })

  it('jeton signé par la clé précédente (rotation) : « expire »', async () => {
    const { page } = await jetons(DEST, ENV_PRECEDENTE)
    expect((await (await lire(page)).json()).etat).toBe('expire')
  })

  it('signature fausse sur un identifiant existant : « inconnu », sans même lire le lien en base (jamais le repli)', async () => {
    const { page } = await jetons()
    const corps = await (await lire(signatureFausse(page))).json()
    expect(corps).toEqual({ etat: 'inconnu', langue: 'fr', contactCabinet: 'contact@cabinet-exemple.test' })
    expect(appelsDe('signalements_qr_diffusion_lien')).toEqual([])
  })

  it('signature bonne, identifiant absent de la base (diffusion purgée après 3 ans) : « ancien », contact et politique du cabinet du chemin', async () => {
    const { page } = await jetons(DEST_PURGE)
    expect(await (await lire(page)).json()).toEqual({
      etat: 'ancien', langue: 'fr', cabinet: 'Cabinet Exemple', contactCabinet: 'contact@cabinet-exemple.test',
      politiqueUrl: 'https://cabinet-exemple.test/confidentialite',
    })
  })

  it('cabinet du chemin inconnu : « inconnu » sans contact, en français', async () => {
    const { page } = await jetons()
    expect(await (await lire(page, 'cabinet-inconnu')).json()).toEqual({ etat: 'inconnu', langue: 'fr' })
  })

  it('clé de signature absente : « inconnu » avec le contact du cabinet du chemin, aucune lecture du lien', async () => {
    vi.stubEnv('AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION', '')
    const { page } = await jetons()
    expect(await (await lire(page)).json()).toEqual({ etat: 'inconnu', langue: 'fr', contactCabinet: 'contact@cabinet-exemple.test' })
    expect(appelsDe('signalements_qr_diffusion_lien')).toEqual([])
  })

  it('migration 20261113 absente (fonction et colonnes) : « inconnu », journalisé une fois par isolat', async () => {
    const { page } = await jetons()
    delete baseQr.etat.fonctions.signalements_qr_diffusion_lien
    baseQr.etat.colonnesAbsentes.signalements_qr_cabinets = ['diffusion_contact_email', 'diffusion_politique_url']
    for (let i = 0; i < 2; i++) expect(await (await lire(page)).json()).toEqual({ etat: 'inconnu', langue: 'fr' })
    expect(simulQr.logger.warn.mock.calls.filter(([m]) => String(m).includes('13/11/2026')).length).toBeGreaterThanOrEqual(1)
    expect(simulQr.logger.warn.mock.calls.filter(([m]) => String(m).includes('lecture d’un lien de désinscription'))).toHaveLength(1)
  })

  it('erreur de la base : 500 « serveur », journalisée par son code seul (ni jeton, ni adresse)', async () => {
    const { page } = await jetons()
    baseQr.etat.fonctions.signalements_qr_diffusion_lien = () => ({ error: { code: '57014', message: `annulé ${EMAIL}` } })
    const r = await lire(page)
    expect(r.status).toBe(500)
    expectPrivee(r)
    expect(await r.json()).toEqual({ error: 'serveur' })
    expect(simulQr.logger.error).toHaveBeenCalled()
    const journal = texteJournalServeurQr()
    expect(journal).not.toContain(page)
    expect(journal).not.toContain(page.slice(33))
    expect(journal).not.toContain(EMAIL)
  })

  it.each([
    [{ jeton: 'pas-un-jeton', identifiant: 'cabinet-exemple' }],
    [{ jeton: `${'a'.repeat(32)}.${'b'.repeat(64)}`, identifiant: 'Cabinet Exemple!' }],
    [{ jeton: `${'a'.repeat(32)}.${'b'.repeat(64)}`, identifiant: 'cabinet-exemple', email: EMAIL }],
    [null],
  ])('corps refusé (%j) : 400, aucune lecture', async (corps) => {
    const r = await LIRE(requeteJson('/api/aj-signalement/desinscription/lecture', corps))
    expect(r.status).toBe(400)
    expectPrivee(r)
    expect(baseQr.etat.appelsRpc).toEqual([])
  })

  it('20 lectures par minute et par adresse IP ; au-delà, 429 traduit par la page, jamais en cache', async () => {
    const { page } = await jetons()
    await lire(page)
    expect(simulQr.limites).toEqual(['qr_desinscription_lecture_203.0.113.7'])
    simulQr.refuser = ['qr_desinscription_lecture_']
    const r = await lire(page)
    expect(r.status).toBe(429)
    expectPrivee(r)
    expect(await r.json()).toEqual({ error: 'limite' })
  })
})

// ── D-P2 : opposition par la page ───────────────────────────────────────────

describe('D-P2 « Ne plus recevoir » : lien valable (page ou un clic) → opposition, effet immédiat', () => {
  it('jeton de page : opposition d’origine « page », sans adresse saisie ; « Recevoir à nouveau » proposé (relu en base)', async () => {
    const { page } = await jetons()
    const r = await opposer(page)
    expect(r.status).toBe(200)
    expectPrivee(r)
    expect(await r.json()).toEqual({ oppose: true, levable: true })
    expect(appelsDe('signalements_qr_diffusion_opposer').map((a) => a.args)).toEqual([{ p_destinataire: DEST, p_origine: 'page' }])
  })

  it('idempotente : un second clic répond pareil, sans nouvelle opposition', async () => {
    const { page } = await jetons()
    await opposer(page)
    const r = await opposer(page)
    expect(await r.json()).toEqual({ oppose: true, levable: true })
    expect(Object.keys(oppositions)).toEqual([DEST])
  })

  it('opposition déjà faite par un autre moyen (plainte, demande au cabinet) : enregistrée, jamais levable par ce lien', async () => {
    const { page } = await jetons()
    oppositions[DEST] = { origine: 'plainte', levable: false }
    expect(await (await opposer(page)).json()).toEqual({ oppose: true, levable: false })
  })

  it('jeton un clic ouvert dans le navigateur : opposition (origine page) ; jamais « Recevoir à nouveau »', async () => {
    const { unClic: jeton } = await jetons()
    expect(await (await opposer(jeton)).json()).toEqual({ oppose: true, levable: false })
    expect(appelsDe('signalements_qr_diffusion_opposer').map((a) => a.args)).toEqual([{ p_destinataire: DEST, p_origine: 'page' }])
  })

  it('lien expiré : 410 lien_expire (la page passe au repli par l’adresse), aucune opposition', async () => {
    const { page } = await jetons()
    liens[DEST] = ligneLien({ diffusion_cree_le: ilYa(400 * JOUR) })
    const r = await opposer(page)
    expect(r.status).toBe(410)
    expectPrivee(r)
    expect(await r.json()).toEqual({ error: 'lien_expire' })
    expect(appelsDe('signalements_qr_diffusion_opposer')).toEqual([])
  })

  it.each([
    ['signature fausse', async () => signatureFausse((await jetons()).page), 'cabinet-exemple'],
    ['autre cabinet', async () => (await jetons()).page, 'autre-cabinet'],
    ['diffusion purgée', async () => (await jetons(DEST_PURGE)).page, 'cabinet-exemple'],
  ])('%s : 404 lien_invalide, aucune opposition', async (_cas, jeton, identifiant) => {
    const r = await opposer(await jeton(), identifiant)
    expect(r.status).toBe(404)
    expect(await r.json()).toEqual({ error: 'lien_invalide' })
    expect(appelsDe('signalements_qr_diffusion_opposer')).toEqual([])
  })

  it('limites : 5 par minute et par IP, puis 10 par heure et par lien (clé : identifiant du destinataire, jamais une adresse)', async () => {
    const { page } = await jetons()
    await opposer(page)
    expect(simulQr.limites).toEqual(['qr_desinscription_opposer_ip_203.0.113.7', `qr_desinscription_opposer_${DEST}`])
    simulQr.refuser = [`qr_desinscription_opposer_${DEST}`]
    const r = await opposer(page)
    expect(r.status).toBe(429)
    expect(await r.json()).toEqual({ error: 'limite' })
    for (const cle of simulQr.limites) expect(cle).not.toContain('@')
  })

  it('erreur de la base pendant l’opposition : 500, jamais un faux succès', async () => {
    const { page } = await jetons()
    baseQr.etat.fonctions.signalements_qr_diffusion_opposer = () => ({ error: { code: '57014', message: 'annulé' } })
    const r = await opposer(page)
    expect(r.status).toBe(500)
    expect(await r.json()).toEqual({ error: 'serveur' })
  })
})

// ── D-P3 : « Recevoir à nouveau » ───────────────────────────────────────────

describe('D-P3 « Recevoir à nouveau » : jeton de PAGE, non expiré, le lien qui a servi, dans les 24 h', () => {
  it('lien de la page qui a servi à l’opposition : levée, 200 { oppose: false }', async () => {
    const { page } = await jetons()
    await opposer(page)
    const r = await reprendre(page)
    expect(r.status).toBe(200)
    expectPrivee(r)
    expect(await r.json()).toEqual({ oppose: false })
    expect(appelsDe('signalements_qr_diffusion_lever').map((a) => a.args)).toEqual([{ p_destinataire: DEST }])
  })

  it('jeton un clic : refusé (404 lien_invalide), sans aucune lecture ni levée (il ne sert qu’à s’opposer)', async () => {
    const { unClic: jeton } = await jetons()
    oppositions[DEST] = { origine: 'un_clic', levable: true }
    const r = await reprendre(jeton)
    expect(r.status).toBe(404)
    expect(await r.json()).toEqual({ error: 'lien_invalide' })
    expect(baseQr.etat.appelsRpc).toEqual([])
    expect(oppositions[DEST]).toBeDefined()
  })

  it('lien expiré : 410, aucune levée', async () => {
    const { page } = await jetons()
    oppositions[DEST] = { origine: 'page', levable: true }
    liens[DEST] = ligneLien({ diffusion_cree_le: ilYa(366 * JOUR) })
    expect((await reprendre(page)).status).toBe(410)
    expect(appelsDe('signalements_qr_diffusion_lever')).toEqual([])
  })

  it('autre lien que celui de l’opposition, ou plus de 24 h (la base refuse) : 409 non_levable', async () => {
    const { page } = await jetons()
    oppositions[DEST] = { origine: 'page', levable: false }
    const r = await reprendre(page)
    expect(r.status).toBe(409)
    expect(await r.json()).toEqual({ error: 'non_levable' })
  })

  it('signature fausse ou clé précédente pour une levée : 404 ou 410, jamais de levée', async () => {
    const { page } = await jetons()
    oppositions[DEST] = { origine: 'page', levable: true }
    expect((await reprendre(signatureFausse(page))).status).toBe(404)
    expect((await reprendre((await jetons(DEST, ENV_PRECEDENTE)).page)).status).toBe(410)
    expect(appelsDe('signalements_qr_diffusion_lever')).toEqual([])
  })

  it('limites : 5 par minute et par IP, puis 10 par heure et par lien', async () => {
    const { page } = await jetons()
    oppositions[DEST] = { origine: 'page', levable: true }
    await reprendre(page)
    expect(simulQr.limites).toEqual(['qr_desinscription_reprendre_ip_203.0.113.7', `qr_desinscription_reprendre_${DEST}`])
  })
})

// ── D-P4 : repli par l'adresse ──────────────────────────────────────────────

describe('D-P4 repli d’un lien expiré : même corps, même durée minimale, même travail que l’adresse soit juste ou fausse', () => {
  async function chronometrer(appel: () => Promise<Response>): Promise<{ statut: number; corps: string; duree: number; cache: string | null }> {
    const debut = performance.now()
    const r = await appel()
    const duree = performance.now() - debut
    return { statut: r.status, corps: await r.text(), duree, cache: r.headers.get('cache-control') }
  }

  it('durée minimale de 400 ms', () => {
    expect(DUREE_MIN_ADRESSE_DESINSCRIPTION_MS).toBe(400)
  })

  it('adresse juste, adresse fausse, lien bien signé inconnu, signature fausse : corps et statut identiques, après 400 ms au moins', async () => {
    const { page } = await jetons()
    liens[DEST] = ligneLien({ diffusion_cree_le: ilYa(400 * JOUR) })
    const cas = [
      await chronometrer(() => parAdresse(page, EMAIL)),
      await chronometrer(() => parAdresse(page, 'autre.personne@exemple.test')),
      await chronometrer(async () => parAdresse((await jetons(DEST_PURGE)).page, EMAIL)),
      await chronometrer(() => parAdresse(signatureFausse(page), EMAIL)),
      await chronometrer(async () => parAdresse(page, EMAIL, 'autre-cabinet')),
    ]
    for (const c of cas) {
      expect(c.statut).toBe(200)
      expect(c.corps).toBe('{"ok":true}')
      expect(c.cache).toBe('private, no-store')
      expect(c.duree).toBeGreaterThanOrEqual(DUREE_MIN_ADRESSE_DESINSCRIPTION_MS - 5)
    }
  })

  it('adresse juste ou fausse : la MÊME requête SQL part (opposer, origine lien_expire, adresse saisie) ; la base seule compare', async () => {
    const { page } = await jetons()
    liens[DEST] = ligneLien({ diffusion_cree_le: ilYa(400 * JOUR) })
    await parAdresse(page, EMAIL)
    await parAdresse(page, 'autre.personne@exemple.test')
    expect(appelsDe('signalements_qr_diffusion_opposer').map((a) => a.args)).toEqual([
      { p_destinataire: DEST, p_origine: 'lien_expire', p_email_saisi: EMAIL },
      { p_destinataire: DEST, p_origine: 'lien_expire', p_email_saisi: 'autre.personne@exemple.test' },
    ])
    expect(oppositions[DEST]).toMatchObject({ origine: 'lien_expire', levable: false })
  })

  // Relecture 2 : le repli n'agit que pour un lien EXPIRÉ (la page ne le propose qu'à lui, ou au lien devenu expiré au
  // clic). Sur un lien encore valable, il aurait créé une opposition « lien_expire », jamais levable, et la lecture D-P1
  // suivante aurait dit si l'adresse devinée était la bonne (cahier § 8.2 : « aucun indice sur l'adresse »).
  it('lien encore valable (page ou un clic) : même { ok: true } après la même durée, AUCUNE opposition', async () => {
    const { page, unClic: jeton } = await jetons()
    for (const j of [page, jeton]) {
      for (const email of [EMAIL, 'autre.personne@exemple.test']) {
        const c = await chronometrer(() => parAdresse(j, email))
        expect(c).toMatchObject({ statut: 200, corps: '{"ok":true}', cache: 'private, no-store' })
        expect(c.duree).toBeGreaterThanOrEqual(DUREE_MIN_ADRESSE_DESINSCRIPTION_MS - 5)
      }
    }
    expect(appelsDe('signalements_qr_diffusion_opposer')).toEqual([])
    expect(oppositions).toEqual({})
  })

  it('jeton un clic d’un lien valable (lu dans un journal ou un message transféré) : la lecture D-P1 ne trahit jamais l’adresse devinée', async () => {
    const { unClic: jeton } = await jetons()
    const avant = await (await lire(jeton)).json()
    await parAdresse(jeton, 'jean.martin@exemple.test')
    const apresFausse = await (await lire(jeton)).json()
    await parAdresse(jeton, EMAIL)
    const apresJuste = await (await lire(jeton)).json()
    expect(apresFausse).toEqual(avant)
    expect(apresJuste).toEqual(apresFausse)
    // La personne garde « Recevoir à nouveau » avec SON lien de page : aucune opposition non levable n'est née du repli.
    expect(await (await lire((await jetons()).page)).json()).toMatchObject({ etat: 'valide', type: 'page', oppose: false })
  })

  it('jeton un clic d’un lien EXPIRÉ (ou signé par la clé précédente) : repli accepté (opposition lien_expire)', async () => {
    liens[DEST] = ligneLien({ diffusion_cree_le: ilYa(400 * JOUR) })
    await parAdresse((await jetons()).unClic, EMAIL)
    liens[DEST] = ligneLien()
    await parAdresse((await jetons(DEST, ENV_PRECEDENTE)).page, EMAIL)
    expect(appelsDe('signalements_qr_diffusion_opposer').map((a) => a.args)).toEqual([
      { p_destinataire: DEST, p_origine: 'lien_expire', p_email_saisi: EMAIL },
      { p_destinataire: DEST, p_origine: 'lien_expire', p_email_saisi: EMAIL },
    ])
  })

  it('signature fausse : AUCUN appel SQL ni lecture de table, même 200 après la même durée', async () => {
    const { page } = await jetons()
    const c = await chronometrer(() => parAdresse(signatureFausse(page), EMAIL))
    expect(c.corps).toBe('{"ok":true}')
    expect(baseQr.etat.appelsRpc).toEqual([])
    expect(baseQr.etat.lectures).toEqual([])
  })

  it('limite par IP (5 par 10 minutes) ou par lien (5 par 24 h) atteinte : 429 traduit, jamais un faux 200', async () => {
    const { page } = await jetons()
    await parAdresse(page, EMAIL)
    expect(simulQr.limites).toEqual(['qr_desinscription_adresse_ip_203.0.113.7', `qr_desinscription_adresse_${DEST}`])
    simulQr.refuser = ['qr_desinscription_adresse_ip_']
    const r = await parAdresse(page, EMAIL)
    expect(r.status).toBe(429)
    expect(await r.json()).toEqual({ error: 'limite' })
    simulQr.refuser = [`qr_desinscription_adresse_${DEST}`]
    expect((await parAdresse(page, EMAIL)).status).toBe(429)
  })

  it('l’adresse saisie n’apparaît ni dans une clé de limite ni dans le journal du serveur, même en cas d’erreur', async () => {
    const { page } = await jetons()
    liens[DEST] = ligneLien({ diffusion_cree_le: ilYa(400 * JOUR) })
    baseQr.etat.fonctions.signalements_qr_diffusion_opposer = () => ({ error: { code: '57014', message: 'annulé' } })
    const r = await parAdresse(page, EMAIL)
    expect(r.status).toBe(503)
    for (const cle of simulQr.limites) expect(cle).not.toContain('@')
    expect(texteJournalServeurQr()).not.toContain(EMAIL)
    expect(texteJournalServeurQr()).not.toContain(page)
  })

  it('adresse hors format : 400 (le format ne dit rien de l’adresse du message)', async () => {
    const { page } = await jetons()
    expect((await parAdresse(page, 'pas-une-adresse')).status).toBe(400)
    expect(baseQr.etat.appelsRpc).toEqual([])
  })
})

// ── D-P5 : un clic (RFC 8058) ───────────────────────────────────────────────

describe('D-P5 POST un clic (messagerie) : signature vérifiée d’abord, honoré même expiré, jamais un faux succès', () => {
  it('corps exact « List-Unsubscribe=One-Click » : opposition d’origine un_clic, 200 corps vide, jamais en cache', async () => {
    const { unClic: jeton } = await jetons()
    const r = await unClic(jeton)
    expect(r.status).toBe(200)
    expectPrivee(r)
    expect(await r.text()).toBe('')
    expect(appelsDe('signalements_qr_diffusion_opposer').map((a) => a.args)).toEqual([{ p_destinataire: DEST, p_origine: 'un_clic' }])
    // Aucune lecture du lien : l'opposition suffit (elle relit le destinataire elle-même).
    expect(appelsDe('signalements_qr_diffusion_lien')).toEqual([])
  })

  it('multipart/form-data (forme admise par la RFC 8058) : accepté aussi', async () => {
    const { unClic: jeton } = await jetons()
    const formulaire = new FormData()
    formulaire.set('List-Unsubscribe', 'One-Click')
    const r = await unClic(jeton, new NextRequest(`https://vitfix.io/api/aj-signalement/desinscription/un-clic/${jeton}`, { method: 'POST', body: formulaire }))
    expect(r.status).toBe(200)
    expect(appelsDe('signalements_qr_diffusion_opposer')).toHaveLength(1)
  })

  it.each([
    ['autre valeur', 'List-Unsubscribe=Unsubscribe', 'application/x-www-form-urlencoded'],
    ['paramètre de plus', 'List-Unsubscribe=One-Click&x=1', 'application/x-www-form-urlencoded'],
    ['corps vide', '', 'application/x-www-form-urlencoded'],
    ['JSON', JSON.stringify({ 'List-Unsubscribe': 'One-Click' }), 'application/json'],
    ['texte brut', CORPS_UN_CLIC, 'text/plain'],
    ['sans type', CORPS_UN_CLIC, null],
  ])('corps refusé (%s) : 400 vide, aucune opposition', async (_cas, corps, type) => {
    const { unClic: jeton } = await jetons()
    const r = await unClic(jeton, requeteUnClic(jeton, corps, type))
    expect(r.status).toBe(400)
    expectPrivee(r)
    expect(appelsDe('signalements_qr_diffusion_opposer')).toEqual([])
  })

  it('lien de plus d’un an ou signé par la clé précédente : honoré (H5 : il vient de la messagerie de la personne)', async () => {
    const { unClic: jeton } = await jetons(DEST, ENV_PRECEDENTE)
    liens[DEST] = ligneLien({ diffusion_cree_le: ilYa(800 * JOUR) })
    expect((await unClic(jeton)).status).toBe(200)
    expect(appelsDe('signalements_qr_diffusion_opposer').map((a) => a.args)).toEqual([{ p_destinataire: DEST, p_origine: 'un_clic' }])
  })

  it('jeton de page dans l’en-tête un clic : traité comme une signature fausse (200 vide, aucune opposition)', async () => {
    const { page } = await jetons()
    const r = await unClic(page)
    expect(r.status).toBe(200)
    expect(await r.text()).toBe('')
    expect(baseQr.etat.appelsRpc).toEqual([])
  })

  it('réponse identique (200, corps vide) pour un lien valable, expiré, purgé ou à la signature fausse', async () => {
    const valable = (await jetons()).unClic
    const expire = (await jetons(DEST, ENV_PRECEDENTE)).unClic
    const purge = (await jetons(DEST_PURGE)).unClic
    for (const jeton of [valable, expire, purge, signatureFausse(valable), 'pas-un-jeton']) {
      const r = await unClic(jeton)
      expect(r.status, jeton).toBe(200)
      expect(await r.text()).toBe('')
    }
  })

  it('limite par IP comptée sur les SEULES signatures fausses (300 par minute) : la signature est vérifiée avant', async () => {
    const { unClic: jeton } = await jetons()
    simulQr.refuser = ['qr_desinscription_un_clic_ip_']
    // Signature bonne : jamais limitée par l'IP (une messagerie envoie des milliers d'oppositions depuis une adresse).
    expect((await unClic(jeton)).status).toBe(200)
    expect(simulQr.limites).toEqual([`qr_desinscription_un_clic_${DEST}`])
    // Signature fausse : comptée, et refusée au-delà.
    const r = await unClic(signatureFausse(jeton))
    expect(r.status).toBe(429)
    expect(simulQr.limites).toContain('qr_desinscription_un_clic_ip_203.0.113.7')
  })

  it('300 signatures valables depuis la même adresse IP : toutes enregistrées', async () => {
    const ids = Array.from({ length: 300 }, (_, i) => `de000000-0000-4000-8000-${String(1000 + i).padStart(12, '0')}`)
    for (const id of ids) liens[id] = ligneLien()
    for (const id of ids) expect((await unClic((await jetons(id)).unClic)).status).toBe(200)
    expect(Object.keys(oppositions)).toHaveLength(300)
    expect(simulQr.limites.some((cle) => cle.includes('_ip_'))).toBe(false)
  })

  it('limite par lien (5 par heure) : 429 vide, jamais un faux 200 (la messagerie pourra réessayer)', async () => {
    const { unClic: jeton } = await jetons()
    simulQr.refuser = [`qr_desinscription_un_clic_${DEST}`]
    const r = await unClic(jeton)
    expect(r.status).toBe(429)
    expect(appelsDe('signalements_qr_diffusion_opposer')).toEqual([])
  })

  it('erreur de la base : 503 et logger.error (code seul), jamais un faux succès', async () => {
    const { unClic: jeton } = await jetons()
    baseQr.etat.fonctions.signalements_qr_diffusion_opposer = () => ({ error: { code: '57014', message: 'annulé' } })
    const r = await unClic(jeton)
    expect(r.status).toBe(503)
    expectPrivee(r)
    expect(simulQr.logger.error).toHaveBeenCalled()
    expect(texteJournalServeurQr()).not.toContain(jeton)
    expect(texteJournalServeurQr()).not.toContain(jeton.slice(33))
  })

  it('migration 20261113 absente : réponse habituelle (200 vide : aucune diffusion n’a pu partir), journalisée une fois', async () => {
    const { unClic: jeton } = await jetons()
    delete baseQr.etat.fonctions.signalements_qr_diffusion_opposer
    for (let i = 0; i < 2; i++) expect((await unClic(jeton)).status).toBe(200)
    expect(simulQr.logger.warn.mock.calls.filter(([m]) => String(m).includes('opposition un clic'))).toHaveLength(1)
  })

  it('clé de signature absente : 503 (la messagerie réessaiera), aucune opposition', async () => {
    vi.stubEnv('AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION', '')
    const { unClic: jeton } = await jetons()
    expect((await unClic(jeton)).status).toBe(503)
    expect(baseQr.etat.appelsRpc).toEqual([])
  })
})

// ── D-P5b : adresse un clic ouverte dans un navigateur ──────────────────────

describe('D-P5b GET un clic : aucun effet, 303 vers la page en mode réduit (jeton un clic dans le fragment)', () => {
  it('jeton un clic valable : 303 vers /<identifiant>/desinscription/#<jeton> (identifiant lu en base), aucune opposition', async () => {
    const { unClic: jeton } = await jetons()
    const r = await ouvrirUnClic(jeton)
    expect(r.status).toBe(303)
    expectPrivee(r)
    expect(r.headers.get('location')).toBe(`https://vitfix.io/cabinet-exemple/desinscription/#${jeton}`)
    expect(r.headers.get('referrer-policy')).toBe('no-referrer')
    expect(appelsDe('signalements_qr_diffusion_opposer')).toEqual([])
  })

  it('lien de plus d’un an : même 303 (la page proposera le repli par l’adresse)', async () => {
    const { unClic: jeton } = await jetons(DEST, ENV_PRECEDENTE)
    expect((await ouvrirUnClic(jeton)).status).toBe(303)
  })

  it.each([
    ['jeton de page', async () => (await jetons()).page],
    ['signature fausse', async () => signatureFausse((await jetons()).unClic)],
    ['diffusion purgée', async () => (await jetons(DEST_PURGE)).unClic],
    ['hors format', async () => 'pas-un-jeton'],
  ])('%s : page générique (404, HTML sans script ni lien tiers), aucune opposition', async (_cas, jeton) => {
    const r = await ouvrirUnClic(await jeton())
    expect(r.status).toBe(404)
    expectPrivee(r)
    expect(r.headers.get('content-type')).toContain('text/html')
    expect(r.headers.get('x-robots-tag')).toBe('noindex, nofollow, noarchive')
    const html = await r.text()
    expect(html).not.toMatch(/<script|https?:\/\/|vitfix/i)
    expect(html).toContain('lang="fr"')
    expect(appelsDe('signalements_qr_diffusion_opposer')).toEqual([])
  })

  it('60 ouvertures par minute et par IP', async () => {
    const { unClic: jeton } = await jetons()
    simulQr.refuser = ['qr_desinscription_un_clic_get_']
    const r = await ouvrirUnClic(jeton)
    expect(r.status).toBe(429)
    expect(simulQr.limites).toEqual(['qr_desinscription_un_clic_get_203.0.113.7'])
  })
})
