// tests/securite/cron-aj-diffusion.test.ts
//
// AJ Signalement, PR 3, lot 5 bis — filet de reprise de la diffusion (cahier § 5.5, § 2.5, décision F10) :
//   - workflow .github/workflows/aj-diffusion-reprise.yml : toutes les 5 minutes, AUCUNE permission (permissions: {}),
//     secret lu depuis l'environnement du pas, jamais interpolé dans run: (modèle run-automations.yml) ;
//   - route D-C1 POST /api/cron/aj-diffusion-reprise : en-tête x-cron-secret comparé À TEMPS CONSTANT à
//     INTERNAL_API_SECRET (401 au corps neutre sinon, jamais d'égalité vide = vide), limite par adresse IP, diffusions de
//     moins d'une heure seulement (la base les choisit, la route le revérifie), 5 lots au plus par diffusion et 20 par
//     appel, purge de conservation une fois par jour, journal diffusion.reprise (mode filet, nombres seulement).
// L'envoi lui-même (lots, résultats) est éprouvé par tests/lib/aj-signalement-diffusion-envoi.test.ts : il est simulé
// ici. Aucune donnée réelle.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const envoi = vi.hoisted(() => ({
  appels: [] as Array<{ id: string; lotsMax: number | undefined }>,
  lotsParAppel: 5,
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/aj-signalement-base')).baseQr.client }))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/aj-signalement-routes')).mockLimites())
vi.mock('@/lib/email', async () => (await import('../helpers/aj-signalement-routes')).mockEmail())
vi.mock('@/lib/logger', async () => (await import('../helpers/aj-signalement-routes')).mockLogger())
vi.mock('@/lib/aj-signalement/diffusion-envoi', () => ({
  LOTS_PAR_APPEL_DIFFUSION_QR: 5,
  envoyerDiffusionQr: vi.fn(async (d: { id: string }, o: { lotsMax?: number } = {}) => {
    envoi.appels.push({ id: d.id, lotsMax: o.lotsMax })
    const lots = Math.min(o.lotsMax ?? 5, envoi.lotsParAppel)
    return { lots, envoyes: lots * 100, refuses: 0, reste: 0, arret: null }
  }),
}))

const RACINE = process.cwd()
const CHEMIN_WORKFLOW = join(RACINE, '.github/workflows/aj-diffusion-reprise.yml')
const CHEMIN_ROUTE = join(RACINE, 'app/api/cron/aj-diffusion-reprise/route.ts')
const lire = (chemin: string) => (existsSync(chemin) ? readFileSync(chemin, 'utf-8').replace(/\r\n/g, '\n') : '')

/** Blocs `run:` d'un workflow (ligne `run:` et lignes plus indentées qui suivent). */
function blocsRun(yaml: string): string[] {
  const lignes = yaml.split('\n')
  const blocs: string[] = []
  for (let i = 0; i < lignes.length; i++) {
    const m = /^(\s*)(?:- )?run:\s*(.*)$/.exec(lignes[i])
    if (!m) continue
    const indentation = m[1].length
    const bloc = [m[2]]
    for (let j = i + 1; j < lignes.length && (lignes[j].trim() === '' || /^\s*/.exec(lignes[j])![0].length > indentation); j++) bloc.push(lignes[j])
    blocs.push(bloc.join('\n'))
  }
  return blocs
}

describe('workflow aj-diffusion-reprise.yml (modèle run-automations.yml)', () => {
  const yaml = lire(CHEMIN_WORKFLOW)

  it('existe ; toutes les 5 minutes, et à la demande', () => {
    expect(yaml.length).toBeGreaterThan(0)
    expect(yaml).toMatch(/^on:\n\s+schedule:\n\s+- cron: '\*\/5 \* \* \* \*'/m)
    expect(yaml).toMatch(/^\s+workflow_dispatch: \{\}$/m)
    expect(yaml).not.toMatch(/pull_request_target|pull_request:|push:/)
  })

  it('aucune permission : `permissions: {}` au niveau du workflow, aucune autre déclaration', () => {
    expect(yaml).toMatch(/^permissions: \{\}$/m)
    expect([...yaml.matchAll(/permissions:/g)]).toHaveLength(1)
  })

  it('secret lu depuis l’environnement du pas, JAMAIS interpolé dans run:', () => {
    expect(yaml).toMatch(/^\s+env:\n(?:\s+#[^\n]*\n)*\s+INTERNAL_API_SECRET: \$\{\{ secrets\.INTERNAL_API_SECRET \}\}$/m)
    const runs = blocsRun(yaml)
    expect(runs).toHaveLength(1)
    for (const run of runs) {
      expect(run).not.toContain('${{')
      expect(run).not.toMatch(/secrets\./)
    }
    expect([...yaml.matchAll(/\$\{\{ secrets\./g)]).toHaveLength(1)
  })

  it('appelle la route de production en POST avec l’en-tête x-cron-secret, échoue sur une erreur HTTP, sans relance', () => {
    const [run] = blocsRun(yaml)
    expect(run).toMatch(/curl -s -X POST https:\/\/vitfix\.io\/api\/cron\/aj-diffusion-reprise/)
    expect(run).toMatch(/-H "x-cron-secret: \$\{INTERNAL_API_SECRET\}"/)
    expect(run).toMatch(/--fail-with-body/)
    expect(run).toMatch(/--max-time \d+/)
    // Pas de relance HTTP : une reprise réservée puis interrompue est revérifiée par la base au passage suivant.
    expect(run).not.toMatch(/--retry/)
  })

  it('un seul passage à la fois (concurrence), délai du job borné', () => {
    expect(yaml).toMatch(/^concurrency:\n\s+group: aj-diffusion-reprise\n\s+cancel-in-progress: false$/m)
    expect(yaml).toMatch(/timeout-minutes: \d+/)
  })

  it('même forme que run-automations.yml (permissions vides, secret par env)', () => {
    const modele = lire(join(RACINE, '.github/workflows/run-automations.yml'))
    expect(modele).toMatch(/^permissions: \{\}$/m)
    expect(modele).toMatch(/INTERNAL_API_SECRET: \$\{\{ secrets\.INTERNAL_API_SECRET \}\}/)
  })
})

// ── Route D-C1 ──

const { baseQr } = await import('../helpers/aj-signalement-base')
const { reinitialiserSimulQr, simulQr, texteJournalServeurQr } = await import('../helpers/aj-signalement-routes')
const { NextRequest } = await import('next/server')
const routeExiste = existsSync(CHEMIN_ROUTE)
const { POST } = routeExiste ? await import('@/app/api/cron/aj-diffusion-reprise/route') : { POST: null }

const SECRET = 'secret-interne-de-test-0123456789abcdef'
const CLE = 'cle-de-test-des-liens-de-diffusion-0123456789'
const idDiffusion = (i: number) => `df000000-0000-4000-8000-${String(i).padStart(12, '0')}`

const ligneDiffusion = (i: number, creeIlYaMs = 10 * 60_000): Record<string, unknown> => ({
  id: idDiffusion(i), copropriete_id: 'c0000000-0000-4000-8000-000000000001', cabinet_id: 'ca000000-0000-4000-8000-000000000001',
  operation_id: `0e000000-0000-4000-8000-${String(i).padStart(12, '0')}`, acteur_profil: 'super_admin', acteur_id: '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4',
  acteur_gestionnaire_id: null, instruction_reference: 'Courriel du cabinet du 12/11/2026', instruction_recue_le: '2026-11-12',
  modele: 'coupure_eau', langue: 'fr', fige_cabinet_nom: 'Cabinet Exemple', fige_cabinet_identifiant: 'cabinet-exemple',
  fige_copropriete_nom: 'Résidence Exemple', fige_contact_email: 'contact@cabinet-exemple.test',
  fige_politique_url: 'https://cabinet-exemple.test/confidentialite', fige_expediteur: '"Cabinet Exemple" <diffusion@exemple.test>',
  objet: 'Coupure d’eau demain', texte: 'L’eau sera coupée demain de 9 h à 10 h.', portee: 'copropriete',
  libelle_perimetre: 'Toute la copropriété', nb_destinataires: 600, nb_exclus_opposition: 0, copie_cabinet_le: null,
  created_at: new Date(Date.now() - creeIlYaMs).toISOString(),
})

const appeler = (entetes: Record<string, string> = { 'x-cron-secret': SECRET }) =>
  (POST as (r: InstanceType<typeof NextRequest>) => Promise<Response>)(new NextRequest('https://vitfix.io/api/cron/aj-diffusion-reprise', { method: 'POST', headers: entetes }))

beforeEach(() => {
  reinitialiserSimulQr()
  baseQr.reinitialiser()
  envoi.appels = []
  envoi.lotsParAppel = 5
  process.env.INTERNAL_API_SECRET = SECRET
  process.env.AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION = CLE
  baseQr.etat.tables.signalements_qr_diffusions = [ligneDiffusion(1), ligneDiffusion(2)]
  baseQr.etat.fonctions.signalements_qr_diffusions_a_reprendre = (a) => ({
    data: baseQr.table('signalements_qr_diffusions').slice(0, Number(a.p_limite)).map((d) => ({ diffusion_id: d.id })),
  })
  baseQr.etat.fonctions.signalements_qr_diffusion_purger = () => ({ data: [{ diffusions: 0, oppositions: 0, perimees: 0 }] })
})

describe('route D-C1 : secret', () => {
  it('la route existe et n’exporte que POST', async () => {
    expect(routeExiste).toBe(true)
    const exports = await import('@/app/api/cron/aj-diffusion-reprise/route')
    expect(Object.keys(exports).filter((k) => ['GET', 'PUT', 'PATCH', 'DELETE'].includes(k))).toEqual([])
  })

  it.each([
    ['en-tête absent', {}],
    ['secret faux, même longueur', { 'x-cron-secret': SECRET.replace(/.$/, 'x') }],
    ['secret faux, autre longueur', { 'x-cron-secret': 'court' }],
    ['secret vide', { 'x-cron-secret': '' }],
    ['secret dans un autre en-tête', { authorization: `Bearer ${SECRET}` }],
  ])('%s → 401, corps neutre, aucune lecture', async (_cas, entetes) => {
    const res = await appeler(entetes)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'non_autorise' })
    expect(baseQr.etat.appelsRpc).toEqual([])
    expect(envoi.appels).toEqual([])
  })

  it('INTERNAL_API_SECRET absent côté serveur → 401 même avec un en-tête vide (jamais vide = vide)', async () => {
    delete process.env.INTERNAL_API_SECRET
    expect((await appeler({ 'x-cron-secret': '' })).status).toBe(401)
    expect((await appeler({})).status).toBe(401)
    expect(baseQr.etat.appelsRpc).toEqual([])
  })

  it('comparaison à temps constant (empreintes de longueur fixe, timingSafeEqual) ; jamais `===` ni `!==` sur le secret', () => {
    const source = lire(CHEMIN_ROUTE)
    expect(source).toMatch(/timingSafeEqual\(/)
    expect(source).toMatch(/createHash\('sha256'\)/)
    expect(source).not.toMatch(/(===|!==)\s*process\.env\.INTERNAL_API_SECRET|process\.env\.INTERNAL_API_SECRET\s*(===|!==)/)
    expect(source).not.toMatch(/secret\s*(===|!==)|(===|!==)\s*secret\b/)
  })

  it('limite par adresse IP (12 par minute) avant tout contrôle ; refus → 429', async () => {
    simulQr.refuser = ['qr_cron_diffusion_']
    expect((await appeler()).status).toBe(429)
    expect(simulQr.limites).toEqual(['qr_cron_diffusion_203.0.113.7'])
  })
})

describe('route D-C1 : reprise', () => {
  it('diffusions choisies par la base (10 au plus), 5 lots au plus chacune ; 200 { diffusions, lots } ; purge une fois par jour', async () => {
    const res = await appeler()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ diffusions: 2, lots: 10 })
    expect(baseQr.etat.appelsRpc.find((a) => a.nom === 'signalements_qr_diffusions_a_reprendre')?.args).toEqual({ p_limite: 10 })
    expect(envoi.appels).toEqual([{ id: idDiffusion(1), lotsMax: 5 }, { id: idDiffusion(2), lotsMax: 5 }])
    expect(simulQr.limites).toContain('qr_purge_diffusion')
    expect(baseQr.etat.appelsRpc.some((a) => a.nom === 'signalements_qr_diffusion_purger')).toBe(true)
  })

  it('20 lots au plus par appel : la dernière diffusion servie reçoit le reste du budget, les suivantes attendent le passage suivant', async () => {
    baseQr.etat.tables.signalements_qr_diffusions = Array.from({ length: 6 }, (_, i) => ligneDiffusion(i + 1))
    const corps = await (await appeler()).json()
    expect(corps).toEqual({ diffusions: 4, lots: 20 })
    expect(envoi.appels.map((a) => a.lotsMax)).toEqual([5, 5, 5, 5])
    // 3 lots par diffusion : 6 diffusions en prennent 18, la septième ne reçoit que les 2 restants, la huitième attend.
    baseQr.etat.tables.signalements_qr_diffusions = Array.from({ length: 8 }, (_, i) => ligneDiffusion(i + 1))
    envoi.appels = []
    envoi.lotsParAppel = 3
    expect(await (await appeler()).json()).toEqual({ diffusions: 7, lots: 20 })
    expect(envoi.appels.map((a) => a.lotsMax)).toEqual([5, 5, 5, 5, 5, 5, 2])
  })

  it('diffusion de plus d’une heure rendue par la base (défaut) : jamais reprise par le filet ; reprise manuelle confirmée seulement', async () => {
    baseQr.etat.tables.signalements_qr_diffusions = [ligneDiffusion(1, 61 * 60_000), ligneDiffusion(2)]
    const corps = await (await appeler()).json()
    expect(corps).toEqual({ diffusions: 1, lots: 5 })
    expect(envoi.appels.map((a) => a.id)).toEqual([idDiffusion(2)])
    expect(simulQr.logger.warn).toHaveBeenCalled()
  })

  it('journal diffusion.reprise (mode filet, nombre de lots ; profil système) pour chaque diffusion reprise, sans valeur saisie', async () => {
    await appeler()
    const journal = baseQr.ecrituresDe('signalements_qr_journal', 'insert')
    expect(journal.map((e) => e.valeurs)).toEqual([1, 2].map((i) => expect.objectContaining({
      action: 'diffusion.reprise', acteur_profil: 'systeme', acteur_id: null, copropriete_id: 'c0000000-0000-4000-8000-000000000001',
      details: { diffusion: idDiffusion(i), mode: 'filet', lots: 5 },
    })))
    expect(JSON.stringify(journal)).not.toMatch(/@|Coupure|coupée/)
    expect(texteJournalServeurQr()).not.toContain('@')
  })

  it('clé de signature des liens absente → 503 configuration_incomplete, rien n’est repris', async () => {
    delete process.env.AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION
    const res = await appeler()
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'configuration_incomplete' })
    expect(envoi.appels).toEqual([])
  })

  it('migration absente (fonction de reprise inconnue) → 503 base_absente', async () => {
    delete baseQr.etat.fonctions.signalements_qr_diffusions_a_reprendre
    const res = await appeler()
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'base_absente' })
  })
})
