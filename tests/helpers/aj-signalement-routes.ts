// tests/helpers/aj-signalement-routes.ts — simulations communes aux tests des routes AJ Signalement.
//
// Session (jeton Bearer ou cookies), super admin (rôle ET e-mail de la liste, comme isSuperAdmin), limiteur (clés
// gardées, refus par préfixe), e-mails (sendBatchEmails et sendEmail gardés, échecs programmables), journal muet
// observable. Aucune donnée réelle : comptes et adresses en @exemple.test.
// Usage (fabriques vi.mock asynchrones, même instance que le fichier de test) :
//   vi.mock('@/lib/auth-helpers', async () => (await import('../helpers/aj-signalement-routes')).mockAuth())
//   vi.mock('@/lib/rate-limit', async () => (await import('../helpers/aj-signalement-routes')).mockLimites())
//   vi.mock('@/lib/email', async () => (await import('../helpers/aj-signalement-routes')).mockEmail())
//   vi.mock('@/lib/logger', async () => (await import('../helpers/aj-signalement-routes')).mockLogger())

import { vi } from 'vitest'
import { NextRequest } from 'next/server'

export interface UtilisateurSimule {
  id: string
  email?: string
  app_metadata: Record<string, unknown>
}

export const EMAIL_ADMIN_QR = 'admin@exemple.test'
export const ADMIN_QR: UtilisateurSimule = { id: '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4', email: EMAIL_ADMIN_QR, app_metadata: { role: 'super_admin' } }

export interface MessageSimule { to: string | string[]; subject: string; html: string; replyTo?: string; tags?: Array<{ name: string; value: string }> }

export const simulQr = {
  user: null as UtilisateurSimule | null,
  cleCookie: null as UtilisateurSimule | null,
  limites: [] as string[],
  refuser: [] as string[],
  lots: [] as MessageSimule[][],
  emailsSimples: [] as MessageSimule[],
  /** Résultat de chaque appel de sendBatchEmails (dans l'ordre) ; vide : tout est accepté. */
  resultatsLots: [] as Array<{ sent: number; failed: number; errors: string[] }>,
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}

export function reinitialiserSimulQr(): void {
  simulQr.user = ADMIN_QR
  simulQr.cleCookie = null
  simulQr.limites = []
  simulQr.refuser = []
  simulQr.lots = []
  simulQr.emailsSimples = []
  simulQr.resultatsLots = []
  for (const f of Object.values(simulQr.logger)) f.mockClear()
}

/** isSuperAdmin : rôle super_admin ET e-mail de la liste (ici, la seule adresse EMAIL_ADMIN_QR). */
export const mockAuth = () => ({
  getAuthUser: vi.fn(async () => simulQr.user),
  isSuperAdmin: vi.fn((u: UtilisateurSimule) => u?.app_metadata?.role === 'super_admin' && u.email === EMAIL_ADMIN_QR),
})

export const mockCookies = () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser: async () => ({ data: { user: simulQr.cleCookie } }) } })),
})

export const mockLimites = () => ({
  checkRateLimit: vi.fn(async (cle: string) => {
    simulQr.limites.push(cle)
    return !simulQr.refuser.some((p) => cle.startsWith(p))
  }),
  getClientIP: vi.fn(() => '203.0.113.7'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'trop_de_demandes' }, { status: 429 })),
})

export const mockEmail = () => ({
  sendEmail: vi.fn(async (m: MessageSimule) => { simulQr.emailsSimples.push(m); return { success: true, id: 'mail-simple' } }),
  sendBatchEmails: vi.fn(async (messages: MessageSimule[]) => {
    simulQr.lots.push(messages)
    return simulQr.resultatsLots.shift() ?? { sent: messages.length, failed: 0, errors: [] }
  }),
})

export const mockLogger = () => ({ logger: simulQr.logger })

/** Tous les messages passés à sendBatchEmails, à plat. */
export const messagesEnvoyesQr = (): MessageSimule[] => simulQr.lots.flat()

type Init = ConstructorParameters<typeof NextRequest>[1]

export function requeteQr(chemin: string, methode = 'GET', corps?: unknown): NextRequest {
  const init: Init = { method: methode }
  if (corps !== undefined) {
    init.headers = { 'content-type': 'application/json' }
    init.body = JSON.stringify(corps)
  }
  return new NextRequest(`https://vitfix.io${chemin}`, init)
}

export const contexteQr = (id: string) => ({ params: Promise.resolve({ id }) })

/** Tout ce que la route a écrit au journal serveur, en texte (pour vérifier qu'aucune donnée personnelle n'y passe). */
export const texteJournalServeurQr = (): string =>
  JSON.stringify([simulQr.logger.error.mock.calls, simulQr.logger.warn.mock.calls, simulQr.logger.info.mock.calls])
