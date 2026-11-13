// tests/lib/aj-signalement-diffusion-envoi.test.ts
//
// AJ Signalement, PR 3, lot 5 — envoi d'une diffusion par lots (cahier § 5.5, envoyerDiffusionQr) : 100 destinataires par
// lot, 5 lots au plus par appel, 1 s entre deux lots ; clé d'idempotence « aj-diffusion-<diffusion>-<lot> » ; un lot
// interrompu repris à l'identique (même clé, même contenu) ; issue de chaque lot inscrite par la base
// (signalements_qr_diffusion_resultats) : acceptés, refusés à l'unité, limite et quota du service (remis en attente),
// contenu refusé au rejeu (incertain) ; réseau et rejeu concurrent : aucune écriture.
// Les règles SQL (réservation, revérification, oppositions) sont exécutées sur un vrai PostgreSQL ailleurs
// (tests/migrations/signalements_qr_diffusion.execution.test.ts) ; ici, une base de lots simulée rend ce que la fonction
// signalements_qr_diffusion_lot rendrait, pour éprouver l'orchestration. Aucune donnée réelle : adresses en exemple.test.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/aj-signalement-base')).baseQr.client }))
vi.mock('@/lib/logger', async () => (await import('../helpers/aj-signalement-routes')).mockLogger())

const { simulQr, reinitialiserSimulQr } = await import('../helpers/aj-signalement-routes')
const { envoyerDiffusionQr, PAUSE_LOTS_DIFFUSION_MS, TAILLE_LOT_DIFFUSION_QR, LOTS_PAR_APPEL_DIFFUSION_QR } = await import('@/lib/aj-signalement/diffusion-envoi')
const { signerLiensDiffusionQr } = await import('@/lib/aj-signalement/diffusion-lien')
type DiffusionFigeeQr = import('@/lib/aj-signalement/email').DiffusionFigeeQr
type EmailPayload = import('@/lib/email').EmailPayload
type ResultatLotEmailDetaille = import('@/lib/email').ResultatLotEmailDetaille
type OptionsLotEmailDetaille = import('@/lib/email').OptionsLotEmailDetaille

const ENV = { AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION: 'cle-de-test-des-liens-de-diffusion-0123456789' }
const DIFFUSION_ID = 'df000000-0000-4000-8000-000000000001'

const DIFFUSION: DiffusionFigeeQr = {
  id: DIFFUSION_ID,
  langue: 'fr',
  modele: 'coupure_eau',
  cabinetNom: 'Cabinet Exemple',
  cabinetIdentifiant: 'cabinet-exemple',
  coproprieteNom: 'Résidence Exemple',
  contactEmail: 'contact@cabinet-exemple.test',
  politiqueUrl: 'https://cabinet-exemple.test/confidentialite',
  expediteur: '"Cabinet Exemple" <diffusion@exemple.test>',
  objet: 'Coupure d’eau demain',
  texte: 'L’eau sera coupée demain de 9 h à 10 h.',
  portee: 'copropriete',
  libellePerimetre: 'Toute la copropriété',
  creeLe: '2026-11-12T08:00:00.000000+00:00',
  nbDestinataires: 250,
  acteurProfil: 'super_admin',
  instructionReference: 'Courriel du cabinet du 12/11/2026',
  instructionRecueLe: '2026-11-12',
}

// ── Base de lots simulée (ce que rendraient signalements_qr_diffusion_lot et _resultats) ──

type Etat = 'en_attente' | 'en_cours' | 'envoye' | 'refuse' | 'annule' | 'incertain'
interface LigneSim { id: string; email: string; etat: Etat; lot: number | null; code: string | null }

const idDe = (i: number) => `de000000-0000-4000-8000-${String(i).padStart(12, '0')}`

function creerBaseLots(n: number) {
  const lignes: LigneSim[] = Array.from({ length: n }, (_, i) => ({
    id: idDe(i + 1), email: `declarant${i + 1}@exemple.test`, etat: 'en_attente', lot: null, code: null,
  }))
  const etat = {
    lignes,
    dernierLot: 0,
    /** Lot interrompu : rendu à l'appel suivant (lignes en cours d'un échec réseau), comme après 10 minutes. */
    interrompu: false,
    /** Copropriété désactivée (ou cabinet suspendu) : le lot suivant annule tout et ne rend rien. */
    inactive: false,
    erreurLot: null as { code: string; message: string } | null,
    appels: [] as Array<{ nom: string; args: Record<string, unknown> }>,
  }
  const reste = () => lignes.filter((l) => l.etat === 'en_attente' || l.etat === 'en_cours').length
  const rendre = (choisies: LigneSim[], reprise: boolean) =>
    choisies.map((l) => ({ destinataire_id: l.id, email: l.email, lot: l.lot, reprise }))

  async function rpc(nom: string, args: Record<string, unknown>) {
    etat.appels.push({ nom, args })
    if (nom === 'signalements_qr_diffusion_lot') {
      if (etat.erreurLot) return { data: null, error: etat.erreurLot }
      if (etat.inactive) {
        for (const l of lignes) if (l.etat === 'en_attente' || l.etat === 'en_cours') Object.assign(l, { etat: 'annule', code: 'diffusion_inactive' })
        return { data: [], error: null }
      }
      const enCours = lignes.filter((l) => l.etat === 'en_cours')
      if (etat.interrompu && enCours.length > 0) {
        etat.interrompu = false
        const opposees = enCours.filter((l) => l.code === 'opposition_survenue')
        if (opposees.length === 0) return { data: rendre(enCours, true), error: null }
        for (const l of opposees) Object.assign(l, { etat: 'annule', code: 'opposition' })
        etat.dernierLot += 1
        const autres = enCours.filter((l) => l.etat === 'en_cours')
        for (const l of autres) l.lot = etat.dernierLot
        return { data: rendre(autres, false), error: null }
      }
      if (enCours.length > 0) return { data: [], error: null }
      const choisies = lignes.filter((l) => l.etat === 'en_attente').slice(0, Number(args.p_taille))
      if (choisies.length === 0) return { data: [], error: null }
      etat.dernierLot += 1
      for (const l of choisies) Object.assign(l, { etat: 'en_cours', lot: etat.dernierLot, code: null })
      return { data: rendre(choisies, false), error: null }
    }
    if (nom === 'signalements_qr_diffusion_resultats') {
      const duLot = (ids: unknown) => lignes.filter((l) => l.lot === args.p_lot && l.etat === 'en_cours' && (ids as string[]).includes(l.id))
      const envoyes = duLot(args.p_envoyes)
      for (const l of envoyes) Object.assign(l, { etat: 'envoye', code: null })
      const refuses = duLot(args.p_refuses)
      for (const l of refuses) Object.assign(l, { etat: 'refuse', code: 'adresse_refusee' })
      const nonPartis = duLot(args.p_non_partis)
      for (const l of nonPartis) {
        Object.assign(l, args.p_code === 'issue_inconnue'
          ? { etat: 'incertain', code: args.p_code }
          : { etat: 'en_attente', code: args.p_code, lot: null })
      }
      return { data: { envoyes: envoyes.length, refuses: refuses.length, nonPartis: nonPartis.length, reste: reste() }, error: null }
    }
    return { data: null, error: { code: 'PGRST202', message: 'inconnue' } }
  }
  const appelsDe = (nom: string) => etat.appels.filter((a) => a.nom === nom)
  return { etat, rpc, appelsDe, reste }
}

interface AppelLot { messages: EmailPayload[]; options: OptionsLotEmailDetaille }

function creerService(resultats: Array<(messages: readonly EmailPayload[]) => ResultatLotEmailDetaille> = []) {
  const appels: AppelLot[] = []
  const envoyerLot = vi.fn(async (messages: readonly EmailPayload[], options: OptionsLotEmailDetaille): Promise<ResultatLotEmailDetaille> => {
    appels.push({ messages: [...messages], options })
    const suivant = resultats.shift()
    return suivant ? suivant(messages) : { ok: true, acceptes: messages.map((_, i) => i), refuses: [] }
  })
  return { appels, envoyerLot }
}

const attendre = vi.fn(async () => undefined)

function dependances(base: ReturnType<typeof creerBaseLots>, service: ReturnType<typeof creerService>) {
  return {
    rpc: base.rpc,
    envoyerLot: service.envoyerLot,
    signer: (id: string) => signerLiensDiffusionQr(id, ENV),
    cleConfiguree: () => true,
    attendre,
  }
}

const echec = (code: Extract<ResultatLotEmailDetaille, { ok: false }>['code'], motif = 'motif') =>
  (): ResultatLotEmailDetaille => ({ ok: false, code, statutHttp: null, motif })

beforeEach(() => {
  reinitialiserSimulQr()
  attendre.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('lots de 100, 5 lots au plus par appel, 1 s entre deux lots', () => {
  it('constantes du cahier § 5.5', () => {
    expect(TAILLE_LOT_DIFFUSION_QR).toBe(100)
    expect(LOTS_PAR_APPEL_DIFFUSION_QR).toBe(5)
    expect(PAUSE_LOTS_DIFFUSION_MS).toBe(1000)
  })

  it('250 destinataires : 3 lots de 100, 100 et 50, clés aj-diffusion-<id>-1..3, mode permissive, délai 15 s, un seul `to`', async () => {
    const base = creerBaseLots(250)
    const service = creerService()
    const bilan = await envoyerDiffusionQr(DIFFUSION, { dependances: dependances(base, service) })
    expect(service.appels.map((a) => a.messages.length)).toEqual([100, 100, 50])
    expect(service.appels.map((a) => a.options)).toEqual([1, 2, 3].map((n) => ({
      idempotencyKey: `aj-diffusion-${DIFFUSION_ID}-${n}`, validation: 'permissive', delaiMs: 15_000,
    })))
    for (const m of service.appels.flatMap((a) => a.messages)) {
      expect(typeof m.to).toBe('string')
      expect(m).not.toHaveProperty('cc')
      expect(m).not.toHaveProperty('bcc')
    }
    expect(new Set(service.appels.flatMap((a) => a.messages.map((m) => m.to))).size).toBe(250)
    expect(base.appelsDe('signalements_qr_diffusion_lot').every((a) => a.args.p_taille === 100 && a.args.p_diffusion === DIFFUSION_ID)).toBe(true)
    expect(bilan).toEqual({ lots: 3, envoyes: 250, refuses: 0, reste: 0, arret: null })
    expect(base.etat.lignes.every((l) => l.etat === 'envoye')).toBe(true)
    // Pause entre deux lots seulement (ni avant le premier, ni après le dernier).
    expect(attendre.mock.calls).toEqual([[1000], [1000]])
  })

  it('700 destinataires : 5 lots (500) au premier appel, reste 200 ; le second appel finit', async () => {
    const base = creerBaseLots(700)
    const service = creerService()
    const premier = await envoyerDiffusionQr(DIFFUSION, { dependances: dependances(base, service) })
    expect(premier).toEqual({ lots: 5, envoyes: 500, refuses: 0, reste: 200, arret: null })
    expect(base.appelsDe('signalements_qr_diffusion_lot')).toHaveLength(5)
    const second = await envoyerDiffusionQr(DIFFUSION, { dependances: dependances(base, service) })
    expect(second).toEqual({ lots: 2, envoyes: 200, refuses: 0, reste: 0, arret: null })
    expect(service.appels.map((a) => a.options.idempotencyKey.split('-').at(-1))).toEqual(['1', '2', '3', '4', '5', '6', '7'])
  })

  it('lotsMax borne le nombre de lots (filet de reprise, reprise) sans dépasser 5', async () => {
    const base = creerBaseLots(250)
    const service = creerService()
    expect((await envoyerDiffusionQr(DIFFUSION, { lotsMax: 1, dependances: dependances(base, service) })).lots).toBe(1)
    expect((await envoyerDiffusionQr(DIFFUSION, { lotsMax: 50, dependances: dependances(creerBaseLots(900), service) })).lots).toBe(5)
  })

  it('minuteur simulé : le deuxième lot ne part qu’une seconde après le premier', async () => {
    // Seul setTimeout est simulé : la signature des liens (Web Crypto) se résout par la boucle d'événements réelle.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    // Tours de la boucle réelle jusqu'à la condition (5 s au plus : la signature passe par le pool de fils de Node).
    const tours = async (condition: () => boolean, delaiMs = 5000) => {
      const fin = Date.now() + delaiMs
      while (!condition() && Date.now() < fin) await new Promise<void>((r) => { setImmediate(r) })
    }
    const base = creerBaseLots(150)
    const service = creerService()
    const { attendre: _a, ...sansAttente } = dependances(base, service)
    const envoi = envoyerDiffusionQr(DIFFUSION, { dependances: sansAttente })
    await tours(() => service.appels.length === 1 && base.appelsDe('signalements_qr_diffusion_resultats').length === 1)
    expect(service.appels).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(999)
    await tours(() => service.appels.length > 1, 300)
    expect(service.appels).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    await tours(() => service.appels.length > 1)
    expect(service.appels).toHaveLength(2)
    expect(await envoi).toMatchObject({ lots: 2, envoyes: 150, reste: 0 })
  })
})

describe('issue d’un lot (cahier § 5.5, § 9)', () => {
  it('refus à l’unité (mode permissive) → refuse ; les autres envoyés', async () => {
    const base = creerBaseLots(3)
    const service = creerService([() => ({ ok: true, acceptes: [0, 2], refuses: [1] })])
    const bilan = await envoyerDiffusionQr(DIFFUSION, { dependances: dependances(base, service) })
    expect(bilan).toEqual({ lots: 1, envoyes: 2, refuses: 1, reste: 0, arret: null })
    expect(base.etat.lignes.map((l) => l.etat)).toEqual(['envoye', 'refuse', 'envoye'])
    expect(base.appelsDe('signalements_qr_diffusion_resultats')[0].args).toEqual({
      p_diffusion: DIFFUSION_ID, p_lot: 1, p_envoyes: [idDe(1), idDe(3)], p_refuses: [idDe(2)], p_non_partis: [], p_code: null,
    })
  })

  it('réseau (dont délai dépassé) → aucune écriture : les lignes restent en cours ; arrêt', async () => {
    const base = creerBaseLots(150)
    const service = creerService([echec('reseau', 'delai_depasse')])
    const bilan = await envoyerDiffusionQr(DIFFUSION, { dependances: dependances(base, service) })
    expect(bilan).toEqual({ lots: 1, envoyes: 0, refuses: 0, reste: null, arret: 'reseau' })
    expect(base.appelsDe('signalements_qr_diffusion_resultats')).toEqual([])
    expect(base.etat.lignes.filter((l) => l.etat === 'en_cours')).toHaveLength(100)
    expect(service.appels).toHaveLength(1)
  })

  it('lot interrompu repris SANS opposition : même clé, même contenu (HTML, texte, en-têtes)', async () => {
    const base = creerBaseLots(2)
    const service = creerService([echec('reseau')])
    await envoyerDiffusionQr(DIFFUSION, { dependances: dependances(base, service) })
    base.etat.interrompu = true
    const bilan = await envoyerDiffusionQr(DIFFUSION, { dependances: dependances(base, service) })
    expect(service.appels).toHaveLength(2)
    expect(service.appels[1].options.idempotencyKey).toBe(service.appels[0].options.idempotencyKey)
    expect(service.appels[1].messages).toEqual(service.appels[0].messages)
    expect(bilan).toMatchObject({ envoyes: 2, reste: 0, arret: null })
  })

  it('lot interrompu repris AVEC une opposition survenue : nouvelle clé, ligne opposée absente', async () => {
    const base = creerBaseLots(3)
    const service = creerService([echec('reseau')])
    await envoyerDiffusionQr(DIFFUSION, { dependances: dependances(base, service) })
    base.etat.lignes[1].code = 'opposition_survenue'
    base.etat.interrompu = true
    await envoyerDiffusionQr(DIFFUSION, { dependances: dependances(base, service) })
    expect(service.appels[1].options.idempotencyKey).toBe(`aj-diffusion-${DIFFUSION_ID}-2`)
    expect(service.appels[1].messages.map((m) => m.to)).toEqual(['declarant1@exemple.test', 'declarant3@exemple.test'])
  })

  it('limite de débit du service → lignes remises en attente (limite_service), arrêt de la boucle, avertissement', async () => {
    const base = creerBaseLots(250)
    const service = creerService([(m) => ({ ok: true, acceptes: m.map((_, i) => i), refuses: [] }), echec('limite', 'rate_limit_exceeded')])
    const bilan = await envoyerDiffusionQr(DIFFUSION, { dependances: dependances(base, service) })
    expect(bilan).toEqual({ lots: 2, envoyes: 100, refuses: 0, reste: 150, arret: 'limite_service' })
    const dernier = base.appelsDe('signalements_qr_diffusion_resultats').at(-1)
    expect(dernier?.args).toMatchObject({ p_lot: 2, p_envoyes: [], p_code: 'limite_service' })
    expect((dernier?.args.p_non_partis as string[]).length).toBe(100)
    expect(base.appelsDe('signalements_qr_diffusion_lot')).toHaveLength(2)
    expect(simulQr.logger.warn).toHaveBeenCalled()
  })

  it('quota du service → quota_service, arrêt, erreur journalisée avec un message distinct de la limite', async () => {
    const base = creerBaseLots(10)
    const service = creerService([echec('quota', 'daily_quota_exceeded')])
    const bilan = await envoyerDiffusionQr(DIFFUSION, { dependances: dependances(base, service) })
    expect(bilan).toMatchObject({ envoyes: 0, reste: 10, arret: 'quota_service' })
    expect(base.etat.lignes.every((l) => l.etat === 'en_attente' && l.code === 'quota_service')).toBe(true)
    expect(simulQr.logger.error).toHaveBeenCalledTimes(1)
    expect(String(simulQr.logger.error.mock.calls[0][0])).toMatch(/quota/)
  })

  it('rejeu concurrent (la même clé est en cours ailleurs) → aucune écriture, arrêt', async () => {
    const base = creerBaseLots(10)
    const service = creerService([echec('rejeu_concurrent', 'concurrent_idempotent_requests')])
    const bilan = await envoyerDiffusionQr(DIFFUSION, { dependances: dependances(base, service) })
    expect(bilan).toMatchObject({ envoyes: 0, arret: 'rejeu_concurrent' })
    expect(base.appelsDe('signalements_qr_diffusion_resultats')).toEqual([])
  })

  it('contenu refusé au rejeu (invalid_idempotent_request) → incertain (issue_inconnue), jamais renvoyé ; erreur journalisée', async () => {
    const base = creerBaseLots(4)
    const service = creerService([echec('rejeu_refuse', 'invalid_idempotent_request')])
    const bilan = await envoyerDiffusionQr(DIFFUSION, { dependances: dependances(base, service) })
    expect(bilan).toMatchObject({ arret: 'issue_inconnue', reste: 0 })
    expect(base.etat.lignes.every((l) => l.etat === 'incertain' && l.code === 'issue_inconnue')).toBe(true)
    expect(simulQr.logger.error).toHaveBeenCalled()
  })

  it('opposition entre deux lots (lignes annulées par la base) : aucun message à cette adresse', async () => {
    const base = creerBaseLots(150)
    const service = creerService()
    let premier = true
    service.envoyerLot.mockImplementation(async (messages: readonly EmailPayload[], options: OptionsLotEmailDetaille) => {
      service.appels.push({ messages: [...messages], options })
      if (premier) {
        premier = false
        Object.assign(base.etat.lignes[120], { etat: 'annule', code: 'opposition' })
      }
      return { ok: true, acceptes: messages.map((_, i) => i), refuses: [] }
    })
    const bilan = await envoyerDiffusionQr(DIFFUSION, { dependances: dependances(base, service) })
    expect(bilan).toMatchObject({ envoyes: 149, reste: 0 })
    expect(service.appels.flatMap((a) => a.messages.map((m) => m.to))).not.toContain('declarant121@exemple.test')
  })

  it('copropriété désactivée (ou cabinet suspendu) entre deux lots : la base ne rend plus rien, plus aucun envoi', async () => {
    const base = creerBaseLots(250)
    const service = creerService()
    service.envoyerLot.mockImplementation(async (messages: readonly EmailPayload[], options: OptionsLotEmailDetaille) => {
      service.appels.push({ messages: [...messages], options })
      base.etat.inactive = true
      return { ok: true, acceptes: messages.map((_, i) => i), refuses: [] }
    })
    const bilan = await envoyerDiffusionQr(DIFFUSION, { dependances: dependances(base, service) })
    expect(service.appels).toHaveLength(1)
    expect(bilan).toMatchObject({ lots: 1, envoyes: 100, reste: null, arret: null })
    expect(base.etat.lignes.filter((l) => l.code === 'diffusion_inactive')).toHaveLength(150)
  })

  it('adresse relue hors forme (séparateur, chevron) : refusée sans être envoyée, les autres partent', async () => {
    const base = creerBaseLots(3)
    base.etat.lignes[1].email = 'declarant2@exemple.test, autre@exemple.test'
    const service = creerService()
    const bilan = await envoyerDiffusionQr(DIFFUSION, { dependances: dependances(base, service) })
    expect(service.appels[0].messages.map((m) => m.to)).toEqual(['declarant1@exemple.test', 'declarant3@exemple.test'])
    expect(bilan).toMatchObject({ envoyes: 2, refuses: 1, reste: 0 })
    expect(base.etat.lignes[1]).toMatchObject({ etat: 'refuse', code: 'adresse_refusee' })
  })

  it('valeur figée hors forme (contact du cabinet) : rien ne part, lignes incertaines, erreur journalisée sans valeur', async () => {
    const base = creerBaseLots(3)
    const service = creerService()
    const bilan = await envoyerDiffusionQr({ ...DIFFUSION, contactEmail: 'pas une adresse' }, { dependances: dependances(base, service) })
    expect(service.appels).toEqual([])
    expect(bilan).toMatchObject({ envoyes: 0, arret: 'issue_inconnue' })
    expect(base.etat.lignes.every((l) => l.etat === 'incertain')).toBe(true)
    expect(JSON.stringify(simulQr.logger.error.mock.calls)).toMatch(/contact/)
  })

  it('clé de signature absente : aucun lot réservé, arrêt configuration_incomplete', async () => {
    const base = creerBaseLots(3)
    const service = creerService()
    const bilan = await envoyerDiffusionQr(DIFFUSION, { dependances: { ...dependances(base, service), cleConfiguree: () => false } })
    expect(bilan).toEqual({ lots: 0, envoyes: 0, refuses: 0, reste: null, arret: 'configuration_incomplete' })
    expect(base.etat.appels).toEqual([])
  })

  it('erreur de la base sur le lot : arrêt (base), erreur journalisée avec son seul code', async () => {
    const base = creerBaseLots(3)
    base.etat.erreurLot = { code: 'XX000', message: 'détail interne declarant1@exemple.test' }
    const service = creerService()
    const bilan = await envoyerDiffusionQr(DIFFUSION, { dependances: dependances(base, service) })
    expect(bilan).toMatchObject({ lots: 0, arret: 'base' })
    expect(JSON.stringify(simulQr.logger.error.mock.calls)).toContain('XX000')
  })
})

describe('journal serveur : jamais une adresse', () => {
  it('aucun « @ » dans ce que l’envoi journalise, quelle que soit l’issue', async () => {
    for (const issue of [echec('reseau'), echec('limite'), echec('quota'), echec('rejeu_refuse'), echec('refus', 'cle_api_absente')]) {
      await envoyerDiffusionQr(DIFFUSION, { dependances: dependances(creerBaseLots(3), creerService([issue])) })
    }
    await envoyerDiffusionQr({ ...DIFFUSION, contactEmail: 'pas une adresse' }, { dependances: dependances(creerBaseLots(1), creerService()) })
    const journal = JSON.stringify([simulQr.logger.error.mock.calls, simulQr.logger.warn.mock.calls, simulQr.logger.info.mock.calls])
    expect(journal.length).toBeGreaterThan(10)
    expect(journal).not.toContain('@')
  })
})
