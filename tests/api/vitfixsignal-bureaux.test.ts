// tests/api/vitfixsignal-bureaux.test.ts
//
// Bureaux des cabinets clients (PR 1, sans écran ; accord du 17/11/2026 sur les cinq choix de la note des bureaux),
// routes NOUVELLES, super admin seul (choix 3) :
//   GET   /api/vitfixsignal/cabinets/[id]/bureaux   bureaux du cabinet, nombres de gestionnaires actifs et de
//                                                     copropriétés actives rattachés ; jamais en cache
//   POST  /api/vitfixsignal/cabinets/[id]/bureaux   création { nom }
//   PATCH /api/vitfixsignal/bureaux/[id]            une seule action : { nom } (renommer), { fermer: true | false }
// 401 sans session, 403 pour un gestionnaire ou un compte hors de la liste, 400 invalide, 404 introuvable, 409
// (nom_pris, plafond_bureaux, bureau_utilise, a_reverifier), 503 base_absente (migration non appliquée). Aucun détail
// interne au navigateur ; p_acteur = la session, jamais le corps. Fonctions SQL simulées (tests/helpers/
// vitfixsignal-bureaux.ts). Aucune donnée réelle : « Cabinet Exemple », bureaux « Nord » et « Sud ».

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/vitfixsignal-base')).baseQr.client }))
vi.mock('@/lib/supabase-server-component', async () => (await import('../helpers/vitfixsignal-routes')).mockCookies())
vi.mock('@/lib/auth-helpers', async () => (await import('../helpers/vitfixsignal-routes')).mockAuth())
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/vitfixsignal-routes')).mockLimites())
vi.mock('@/lib/email', async () => (await import('../helpers/vitfixsignal-routes')).mockEmail())
vi.mock('@/lib/logger', async () => (await import('../helpers/vitfixsignal-routes')).mockLogger())

const { baseQr } = await import('../helpers/vitfixsignal-base')
const { ADMIN_QR, contexteQr, reinitialiserSimulQr, requeteQr, simulQr, texteJournalServeurQr } = await import('../helpers/vitfixsignal-routes')
const { CAB, CAB_AUTRE, COMPTE_G1, C1, C2, G1, G2, poserJeuAccesQr } = await import('../helpers/vitfixsignal-acces')
const { idBureauSimule, ligneBureauQr, simulerFonctionsBureauxQr, simulerProductionAvantBureauxQr } = await import('../helpers/vitfixsignal-bureaux')
const { reinitialiserReplisQr } = await import('@/lib/vitfixsignal/serveur')
const { GET: LISTE, POST: CREER } = await import('@/app/api/vitfixsignal/cabinets/[id]/bureaux/route')
const { PATCH: MODIFIER } = await import('@/app/api/vitfixsignal/bureaux/[id]/route')

const NORD = 'b0000000-0000-4000-8000-0000000000a1'
const SUD = 'b0000000-0000-4000-8000-0000000000a2'
const AILLEURS = 'b0000000-0000-4000-8000-0000000000a3'
const INCONNU = 'b0000000-0000-4000-8000-0000000000ff'

beforeEach(() => {
  reinitialiserSimulQr()
  reinitialiserReplisQr()
  baseQr.reinitialiser()
  vi.unstubAllEnvs()
  poserJeuAccesQr()
  simulerFonctionsBureauxQr()
  const t = baseQr.etat.tables
  t.signalements_qr_bureaux = [
    ligneBureauQr(SUD, CAB, 'Sud', { created_at: '2026-11-19T09:05:00+00:00' }),
    ligneBureauQr(NORD, CAB, 'Nord'),
    ligneBureauQr(AILLEURS, CAB_AUTRE, 'Nord'),
  ]
  // G1 (actif) et C1 (active) au bureau Nord ; G2 désactivé au bureau Sud ; C2 désactivée au bureau Sud.
  const g = (id: string) => t.signalements_qr_gestionnaires.find((f) => f.id === id) as Record<string, unknown>
  const c = (id: string) => t.signalements_qr_coproprietes.find((x) => x.id === id) as Record<string, unknown>
  Object.assign(g(G1), { bureau_id: NORD })
  Object.assign(g(G2), { bureau_id: SUD, actif: false })
  Object.assign(c(C1), { bureau_id: NORD })
  Object.assign(c(C2), { bureau_id: SUD, actif: false })
})

const lister = (cabinet: string) => LISTE(requeteQr(`/api/vitfixsignal/cabinets/${cabinet}/bureaux`), contexteQr(cabinet))
const creer = (cabinet: string, corps: unknown) => CREER(requeteQr(`/api/vitfixsignal/cabinets/${cabinet}/bureaux`, 'POST', corps), contexteQr(cabinet))
const modifier = (id: string, corps: unknown) => MODIFIER(requeteQr(`/api/vitfixsignal/bureaux/${id}`, 'PATCH', corps), contexteQr(id))

describe('droits (choix 3 : super admin seul)', () => {
  it('401 sans session ; aucune fonction appelée', async () => {
    simulQr.user = null
    expect((await lister(CAB)).status).toBe(401)
    expect((await creer(CAB, { nom: 'Est' })).status).toBe(401)
    expect((await modifier(NORD, { fermer: true })).status).toBe(401)
    expect(baseQr.etat.appelsRpc).toEqual([])
  })

  it('403 pour un gestionnaire connecté (même de ce cabinet), sans rien lire des bureaux ni rien écrire', async () => {
    simulQr.user = COMPTE_G1
    for (const res of [await lister(CAB), await creer(CAB, { nom: 'Est' }), await modifier(NORD, { nom: 'Nord-Est' })]) {
      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({ error: 'interdit' })
    }
    expect(baseQr.etat.appelsRpc).toEqual([])
    expect(baseQr.etat.lectures.some((l) => l.table === 'signalements_qr_bureaux')).toBe(false)
  })

  it('403 pour un compte super_admin hors de la liste d’e-mails, et pour la « vue en tant que »', async () => {
    simulQr.user = { ...ADMIN_QR, email: 'autre@exemple.test' }
    expect((await lister(CAB)).status).toBe(403)
    simulQr.user = { ...ADMIN_QR, app_metadata: { role: 'coproprio', _original_role: 'super_admin' } }
    expect((await creer(CAB, { nom: 'Est' })).status).toBe(403)
    expect(baseQr.etat.appelsRpc).toEqual([])
  })

  it('limites de débit par adresse IP puis par compte', async () => {
    await lister(CAB)
    await creer(CAB, { nom: 'Est' })
    await modifier(NORD, { nom: 'Nord-Est' })
    for (const prefixe of ['qr_bureaux_', 'qr_bureau_post_', 'qr_bureau_patch_']) {
      expect(simulQr.limites.filter((c) => c.startsWith(prefixe))).toHaveLength(2)
      expect(simulQr.limites).toContain(`${prefixe}${ADMIN_QR.id}`)
    }
    simulQr.refuser = [`qr_bureau_post_${ADMIN_QR.id}`]
    expect((await creer(CAB, { nom: 'Ouest' })).status).toBe(429)
  })
})

describe('GET /cabinets/[id]/bureaux', () => {
  it('bureaux du cabinet triés par nom, ouverts et fermés, avec les gestionnaires ACTIFS et copropriétés ACTIVES rattachés ; jamais en cache', async () => {
    Object.assign(baseQr.table('signalements_qr_bureaux').find((b) => b.id === SUD) ?? {}, { ferme_le: '2026-11-19T11:00:00+00:00' })
    const res = await lister(CAB)
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await res.json()).toEqual({
      bureaux: [
        { id: NORD, cabinetId: CAB, nom: 'Nord', ferme: false, fermeLe: null, creeLe: '2026-11-19T09:00:00+00:00', nbGestionnaires: 1, nbCoproprietes: 1 },
        { id: SUD, cabinetId: CAB, nom: 'Sud', ferme: true, fermeLe: '2026-11-19T11:00:00+00:00', creeLe: '2026-11-19T09:05:00+00:00', nbGestionnaires: 0, nbCoproprietes: 0 },
      ],
    })
  })

  it('cabinet sans bureau : liste vide ; cabinet inconnu ou id hors format : 404', async () => {
    baseQr.etat.tables.signalements_qr_bureaux = []
    expect(await (await lister(CAB)).json()).toEqual({ bureaux: [] })
    expect((await lister('ca000000-0000-4000-8000-0000000000ff')).status).toBe(404)
    expect((await lister('pas-un-uuid')).status).toBe(404)
  })

  it('migration absente (PGRST205) : 503 base_absente, journalisé une fois avec son code seul', async () => {
    simulerProductionAvantBureauxQr()
    const res = await lister(CAB)
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'base_absente' })
    await lister(CAB)
    const replis = simulQr.logger.warn.mock.calls.filter((c) => JSON.stringify(c).includes('20261119_signalements_qr_bureaux'))
    expect(replis).toHaveLength(1)
  })

  it('erreur de la base (autre que la structure) : 500 serveur, sans détail', async () => {
    baseQr.etat.erreursPonctuelles.signalements_qr_bureaux = { code: '57014', message: 'canceling statement due to statement timeout' }
    const res = await lister(CAB)
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'serveur' })
  })
})

describe('POST /cabinets/[id]/bureaux', () => {
  it('crée le bureau (nom rogné), p_acteur = la session ; 201 { bureau } ; journal sans le nom', async () => {
    const res = await creer(CAB, { nom: '  Est  ' })
    expect(res.status).toBe(201)
    const appel = baseQr.etat.appelsRpc.find((a) => a.nom === 'signalements_qr_enregistrer_bureau')
    expect(appel?.args).toEqual({ p_cabinet: CAB, p_bureau: null, p_nom: 'Est', p_acteur: ADMIN_QR.id })
    expect(await res.json()).toEqual({
      bureau: { id: idBureauSimule(1), cabinetId: CAB, nom: 'Est', ferme: false, fermeLe: null, creeLe: '2026-11-19T09:00:00+00:00', nbGestionnaires: 0, nbCoproprietes: 0 },
    })
    const journal = baseQr.table('signalements_qr_journal')
    expect(journal).toEqual([expect.objectContaining({ action: 'cabinet.modifie', champs: ['bureaux'], details: { bureau: 'cree', bureauId: idBureauSimule(1) } })])
    expect(JSON.stringify(journal)).not.toContain('Est')
  })

  it('nom déjà pris dans le cabinet (casse et espaces) : 409 nom_pris ; dans un autre cabinet : permis', async () => {
    const res = await creer(CAB, { nom: ' sud ' })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'nom_pris' })
    expect((await creer(CAB_AUTRE, { nom: 'Sud' })).status).toBe(201)
  })

  it('plafond de 100 bureaux : 409 plafond_bureaux', async () => {
    baseQr.etat.tables.signalements_qr_bureaux = Array.from({ length: 100 }, (_, i) =>
      ligneBureauQr(`b1000000-0000-4000-8000-${String(i).padStart(12, '0')}`, CAB, `Bureau ${i}`))
    const res = await creer(CAB, { nom: 'Bureau 100' })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'plafond_bureaux' })
  })

  it.each([
    ['nom vide', { nom: '   ' }],
    ['nom de 81 caractères', { nom: 'x'.repeat(81) }],
    ['caractère de contrôle', { nom: 'Nord\nSud' }],
    ['clé inconnue (auteur dans le corps)', { nom: 'Est', acteur: 'a0000000-0000-4000-8000-00000000dead' }],
    ['adresse de contact (choix 4 : pas en V1)', { nom: 'Est', contactEmail: 'bureau@exemple.test' }],
    ['corps absent', null],
  ])('%s : 400 invalide, aucune fonction appelée', async (_cas, corps) => {
    const res = await creer(CAB, corps)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalide')
    expect(baseQr.etat.appelsRpc).toEqual([])
  })

  it('cabinet inconnu : 404 sans appel ; supprimé entre la lecture et l’écriture (a_reverifier) : 409', async () => {
    expect((await creer('ca000000-0000-4000-8000-0000000000ff', { nom: 'Est' })).status).toBe(404)
    expect(baseQr.etat.appelsRpc).toEqual([])
    baseQr.etat.fonctions.signalements_qr_enregistrer_bureau = () => ({ error: { code: 'P0001', message: 'a_reverifier' } })
    const res = await creer(CAB, { nom: 'Est' })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'a_reverifier' })
  })

  it('migration absente (fonction PGRST202) : 503 base_absente', async () => {
    simulerProductionAvantBureauxQr()
    const res = await creer(CAB, { nom: 'Est' })
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'base_absente' })
  })

  it('erreur inattendue de la base : 500 serveur ; le message n’est jamais rendu ni journalisé', async () => {
    baseQr.etat.fonctions.signalements_qr_enregistrer_bureau = () => ({ error: { code: 'XX000', message: 'détail interne Est' } })
    const res = await creer(CAB, { nom: 'Est' })
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'serveur' })
    expect(texteJournalServeurQr()).not.toContain('détail interne')
  })
})

describe('PATCH /bureaux/[id]', () => {
  it('renommer : { nom } ; 200 { bureau, modifie } ; même nom : modifie faux', async () => {
    const res = await modifier(NORD, { nom: ' Nord-Est ' })
    expect(res.status).toBe(200)
    expect(baseQr.etat.appelsRpc.at(-1)).toEqual({ nom: 'signalements_qr_enregistrer_bureau', args: { p_cabinet: CAB, p_bureau: NORD, p_nom: 'Nord-Est', p_acteur: ADMIN_QR.id } })
    expect(await res.json()).toEqual({
      bureau: { id: NORD, cabinetId: CAB, nom: 'Nord-Est', ferme: false, fermeLe: null, creeLe: '2026-11-19T09:00:00+00:00', nbGestionnaires: 1, nbCoproprietes: 1 },
      modifie: true,
    })
    expect((await (await modifier(NORD, { nom: 'Nord-Est' })).json()).modifie).toBe(false)
  })

  it('renommer vers le nom d’un autre bureau du cabinet : 409 nom_pris', async () => {
    const res = await modifier(NORD, { nom: 'SUD' })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'nom_pris' })
  })

  it('fermer un bureau encore utilisé (gestionnaire actif, copropriété active) : 409 bureau_utilise ; rien n’est fermé', async () => {
    const res = await modifier(NORD, { fermer: true })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'bureau_utilise' })
    expect(baseQr.table('signalements_qr_bureaux').find((b) => b.id === NORD)?.ferme_le).toBeNull()
  })

  it('fermer un bureau dont les rattachements sont inactifs, puis le rouvrir ; p_acteur = la session ; journal', async () => {
    const fermeture = await modifier(SUD, { fermer: true })
    expect(fermeture.status).toBe(200)
    expect(baseQr.etat.appelsRpc.at(-1)).toEqual({ nom: 'signalements_qr_fermer_bureau', args: { p_bureau: SUD, p_fermer: true, p_acteur: ADMIN_QR.id } })
    expect(await fermeture.json()).toMatchObject({ bureau: { id: SUD, ferme: true, fermeLe: '2026-11-19T10:00:00+00:00' }, modifie: true })
    expect(await (await modifier(SUD, { fermer: true })).json()).toMatchObject({ modifie: false })
    expect(await (await modifier(SUD, { fermer: false })).json()).toMatchObject({ bureau: { id: SUD, ferme: false, fermeLe: null }, modifie: true })
    expect(baseQr.table('signalements_qr_journal').map((j) => j.details)).toEqual([
      { bureau: 'ferme', bureauId: SUD }, { bureau: 'rouvert', bureauId: SUD },
    ])
  })

  it.each([
    ['deux actions à la fois', { nom: 'Nord-Est', fermer: true }],
    ['corps vide', {}],
    ['fermer non booléen', { fermer: 'oui' }],
    ['cabinet dans le corps (un bureau ne change pas de cabinet)', { cabinetId: CAB_AUTRE }],
    ['nom trop long', { nom: 'x'.repeat(81) }],
  ])('%s : 400 invalide, aucune fonction appelée', async (_cas, corps) => {
    const res = await modifier(NORD, corps)
    expect(res.status).toBe(400)
    expect(baseQr.etat.appelsRpc).toEqual([])
  })

  it('bureau inconnu ou id hors format : 404, aucune fonction appelée', async () => {
    expect((await modifier(INCONNU, { fermer: true })).status).toBe(404)
    expect((await modifier('pas-un-uuid', { fermer: true })).status).toBe(404)
    expect(baseQr.etat.appelsRpc).toEqual([])
  })

  it('migration absente : 503 base_absente', async () => {
    simulerProductionAvantBureauxQr()
    for (const corps of [{ nom: 'Nord-Est' }, { fermer: true }]) {
      const res = await modifier(NORD, corps)
      expect(res.status).toBe(503)
      expect(await res.json()).toEqual({ error: 'base_absente' })
    }
  })
})
