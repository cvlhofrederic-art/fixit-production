// POST /api/doc-number — numéro tiré avec la session de la société BTP (constat base-de-donnees-10 de l'audit des
// fondations BTP du 11/11/2026).
//
// La route appelait next_doc_number avec la clé de service. Dans la fonction, auth.uid() est alors vide et le
// passe-droit du service repose sur un ancien réglage du jeton (request.jwt.claim.role) que PostgREST ne pose plus :
// refus 42501, réponse 500, à chaque appel. Le navigateur se rabattait sur l'appel direct de la fonction, puis, côté
// BTP jusqu'au correctif du formulaire, sur un compteur local. Désormais, pour une société BTP, la route appelle la
// fonction avec la session de l'utilisateur (son jeton) : la fonction le reconnaît comme titulaire de la série.
// Artisan : appel d'origine inchangé.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const simu = vi.hoisted(() => ({
  utilisateur: null as null | { id: string; app_metadata: Record<string, unknown> },
  rpcService: vi.fn(),
  rpcSession: vi.fn(),
  creerClient: vi.fn(),
}))

// Simulation PARTIELLE du module, héritée du vrai : depuis le 25/11/2026 les routes des documents résolvent
// aussi le périmètre de la société (lib/btp/perimetre-compte), qui importe getUserRole, isProGerant,
// societeDunAutreCompte et resolveCompanyId du même fichier. Les omettre les ferait disparaître du module simulé.
// Pour un compte artisan comme pour un gérant, lirePerimetreBtp sort sans toucher la base.
vi.mock('@/lib/auth-helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-helpers')>()),
  getAuthUser: async () => simu.utilisateur,
}))
vi.mock('@/lib/supabase-server-component', () => ({ createServerSupabaseClient: vi.fn() }))
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { rpc: simu.rpcService } }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => {
    simu.creerClient(...args)
    return { rpc: simu.rpcSession }
  },
}))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())

const COMPTE = '00000000-0000-4000-8000-0000000000d1'

async function numeroter(corps: Record<string, unknown>) {
  const { POST } = await import('@/app/api/doc-number/route')
  const res = await POST(new Request('http://localhost:3000/api/doc-number', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer jeton-de-session' },
    body: JSON.stringify(corps),
  }) as never)
  return { status: res.status, corps: await res.json() as Record<string, unknown> }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://exemple.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'cle-publique-de-test'
  // Clé de service : refusée par la fonction (auth.uid() vide), comme décrit par l'audit.
  simu.rpcService.mockResolvedValue({ data: null, error: { code: '42501', message: 'unauthorized' } })
  simu.rpcSession.mockResolvedValue({ data: 'DEV-2026-038', error: null })
  simu.utilisateur = { id: COMPTE, app_metadata: { role: 'pro_societe' } }
})

describe('/api/doc-number — société BTP', () => {
  it('le numéro est tiré avec la session de l\'utilisateur, pas avec la clé de service', async () => {
    const { status, corps } = await numeroter({ docType: 'devis', year: 2026 })
    expect(status).toBe(200)
    expect(corps).toEqual({ number: 'DEV-2026-038' })
    expect(simu.rpcSession).toHaveBeenCalledWith('next_doc_number', { p_artisan_user_id: COMPTE, p_doc_type: 'devis', p_year: 2026 })
    expect(simu.rpcService).not.toHaveBeenCalled()
    const [, , options] = simu.creerClient.mock.calls[0] as [string, string, { global: { headers: Record<string, string> } }]
    expect(options.global.headers.Authorization).toBe('Bearer jeton-de-session')
  })

  it('refus de la fonction : 500, comme avant (le navigateur passe alors par l\'appel direct)', async () => {
    simu.rpcSession.mockResolvedValue({ data: null, error: { code: '42501', message: 'unauthorized' } })
    const { status, corps } = await numeroter({ docType: 'facture', year: 2026 })
    expect(status).toBe(500)
    expect(corps).toEqual({ error: 'Erreur de génération du numéro' })
  })
})

describe('/api/doc-number — artisan (inchangé)', () => {
  it('appel d\'origine avec la clé de service', async () => {
    simu.utilisateur = { id: COMPTE, app_metadata: { role: 'artisan' } }
    simu.rpcService.mockResolvedValue({ data: 'FACT-2026-015', error: null })
    const { status, corps } = await numeroter({ docType: 'facture', year: 2026 })
    expect(status).toBe(200)
    expect(corps).toEqual({ number: 'FACT-2026-015' })
    expect(simu.rpcService).toHaveBeenCalledWith('next_doc_number', { p_artisan_user_id: COMPTE, p_doc_type: 'facture', p_year: 2026 })
    expect(simu.creerClient).not.toHaveBeenCalled()
  })
})
