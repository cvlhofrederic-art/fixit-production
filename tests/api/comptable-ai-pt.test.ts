// @vitest-environment node
// tests/api/comptable-ai-pt.test.ts — valeurs fiscales portugaises de Léa (app/api/comptable-ai/route.ts).
//
// Vérifiées le 17/11/2026 sur les textes officiels (Portal das Finanças, diplômes publiés par l'AT, gov.pt), voir
// lib/fiscalite-pt.ts. Le prompt envoyé à l'IA et les réponses de secours ne portent plus les valeurs périmées
// (IAS de 2024 donné pour 2025, mínimo de existência de 2024, retenção na fonte à 25 % « regra geral », dispense sous
// 12 500 €, barème de l'IRS « 2025 » faux, IRS Jovem en « art.º 2.º-B », PEC encore dû) et suivent l'année en cours.
// Seuls `fetch` (Groq) et la base sont simulés ; la base absente fait échouer l'enrichissement, sans effet sur le prompt.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { installerFetchIA, poserCles, reponseOpenAI, retirerWorkersAI, versGroq } from '../helpers/faux-fournisseurs-ia'

vi.mock('@/lib/env', async () => (await import('../helpers/faux-fournisseurs-ia')).envAvecWorkersAI())
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())
vi.mock('@/lib/auth-helpers', async (orig) => ({
  ...(await orig<typeof import('@/lib/auth-helpers')>()),
  getAuthUser: vi.fn(async () => ({ id: 'u-pro', app_metadata: { role: 'artisan' } })),
}))
vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: { from: () => { throw new Error('base absente du test') } },
}))

const { POST: comptableAi } = await import('@/app/api/comptable-ai/route')

const requete = (corps: unknown) =>
  new NextRequest('http://localhost/api/comptable-ai', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer jeton' },
    body: JSON.stringify(corps),
  })

/** Espaces insécables (milliers en pt-PT) ramenées à des espaces, pour comparer le texte. */
const lisible = (texte: string) => texte.replace(/[  ]/g, ' ')

/** Prompt envoyé à Groq pour cette demande (tous les messages, dont le message système). */
async function promptEnvoye(corps: Record<string, unknown>): Promise<string> {
  const appels = installerFetchIA(() => reponseOpenAI('Resposta de teste.'))
  const reponse = await comptableAi(requete(corps))
  expect(reponse.status).toBe(200)
  const messages = (versGroq(appels)[0]?.corps.messages ?? []) as Array<{ content: string }>
  expect(messages.length).toBeGreaterThan(0)
  return lisible(messages.map(m => m.content).join('\n'))
}

/** Réponse de secours (aucune IA configurée) pour une question en portugais. */
async function reponseDeSecours(message: string): Promise<string> {
  remettreCles()
  retirerWorkersAI()
  remettreCles = poserCles({ groq: false, claude: false })
  const corps = (await (await comptableAi(requete({ message, locale: 'pt', financialContext: { annualCAHT: 20_000, totalExpenses: 2_000 } }))).json()) as { response: string; fallback?: boolean }
  expect(corps.fallback).toBe(true)
  return lisible(corps.response)
}

const INDEPENDENTE_PT = { annualCAHT: 20_000, annualCA: 24_600, totalExpenses: 2_000, quarterData: [5_000, 5_000, 5_000, 5_000] }

/** Valeurs périmées qui ne doivent plus revenir dans les textes portugais de Léa. */
const PERIMEES = ['509,26', '24 444', '28 009', '11 480', '12 500', '(~25%)', 'regra geral', 'art.º 2.º-B', 'escalões 2025', 'Até 8 059', 'pagamento especial por conta (PEC)']

let remettreCles: () => void

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-17T12:00:00Z'))
  remettreCles = poserCles()
})

afterEach(() => {
  remettreCles()
  retirerWorkersAI()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('Léa en portugais (locale pt) : prompt de l’IA', () => {
  it('valeurs vérifiées le 17/11/2026, aucune valeur périmée', async () => {
    const prompt = await promptEnvoye({ message: 'Quanto IRS vou pagar?', locale: 'pt', financialContext: INDEPENDENTE_PT })

    expect(prompt).toContain('IAS 2026: **537,13 €/mês**')
    expect(prompt).toContain('Contribuição mínima: **20 €/mês**')
    expect(prompt).toContain('inferior a 4 × IAS** (2 148,52 €/mês em 2026)')
    expect(prompt).toContain('taxas gerais 2026 (art.º 68.º CIRS, sobre o rendimento coletável)')
    expect(prompt).toContain('Até 8 342 €: **12,2%** | Mais de 8 342 € até 12 587 €: **15,2%**')
    expect(prompt).toContain('Mais de 86 634 €: **48%**.')
    expect(prompt).toContain('**23%** nas atividades profissionais da tabela do art.º 151.º; **11,5%** nas outras prestações de serviços')
    expect(prompt).toContain('se previr faturar menos de **15 000 €** no ano')
    expect(prompt).toContain('**Mínimo de existência 2026 (art.º 70.º CIRS):** valor de referência de **12 880 €**')
    expect(prompt).toContain('**IRS Jovem (art.º 12.º-B CIRS, redação do OE 2025):**')
    expect(prompt).toContain('**75%** do 2.º ao 4.º, **50%** do 5.º ao 7.º e **25%** do 8.º ao 10.º ano')
    expect(prompt).toContain('**55 × IAS** (29 542,15 € em 2026)')
    expect(prompt).toContain('IRS retido na fonte (~23%)')
    expect(prompt).toContain('REFERENCIAL TÉCNICO CONSTRUÇÃO PT 2026')
    for (const perimee of PERIMEES) expect(prompt).not.toContain(perimee)
  })

  it('l’année suivante : titres de l’année, chaque valeur annuelle garde l’année dont elle vient', async () => {
    vi.setSystemTime(new Date('2027-03-02T12:00:00Z'))
    const prompt = await promptEnvoye({ message: 'Olá', locale: 'pt', financialContext: INDEPENDENTE_PT })

    expect(prompt).toContain('REFERENCIAL TÉCNICO CONSTRUÇÃO PT 2027')
    expect(prompt).toContain('legislação portuguesa 2027')
    expect(prompt).toContain('IAS 2026: **537,13 €/mês**')
    expect(prompt).toContain('**Mínimo de existência 2026 (art.º 70.º CIRS):**')
    expect(prompt).toContain('taxas gerais 2026 (art.º 68.º CIRS')
    expect(prompt).not.toContain('PT 2026')
  })
})

describe('Léa, professionnel portugais sur l’interface française (pays PT)', () => {
  it('société : titre du référentiel de l’année, PEC supprimé depuis 2022', async () => {
    const prompt = await promptEnvoye({
      message: 'Bonjour', locale: 'fr',
      financialContext: { country: 'PT', orgRole: 'pro_societe', legalForm: 'Sociedade por Quotas (Lda)', annualCAHT: 120_000, totalExpenses: 40_000 },
    })

    expect(prompt).toContain('REFERENCIAL FISCAL EMPRESA BTP 2026 (PT)')
    expect(prompt).toContain('pagamentos por conta (le pagamento especial por conta, PEC, est supprimé depuis 2022')
    expect(prompt).toContain('coef 0,75 (activités de la tabela do art.º 151.º), 0,35 (autres prestações de serviços) ou 0,15 (vendas)')
    expect(prompt).not.toContain('derrama + pagamento especial por conta (PEC)')
  })

  it('indépendant : retenção na fonte à 23 % et dispense sous 15 000 €', async () => {
    const prompt = await promptEnvoye({ message: 'Bonjour', locale: 'fr', financialContext: { country: 'PT', orgRole: 'artisan', ...INDEPENDENTE_PT } })

    expect(prompt).toContain('REFERENCIAL TÉCNICO CONSTRUÇÃO PT 2026 (Independente)')
    expect(prompt).toContain('IRS retido na fonte (~23%)')
    expect(prompt).toContain('**Retenção na fonte (cat. B, art.º 101.º CIRS):** 23% (atividades da tabela do art.º 151.º) ou 11,5% (outras prestações de serviços)')
    expect(prompt).toContain('Dispensa (art.º 101.º-B) se previr faturar menos de 15 000 € no ano')
    expect(prompt).toContain('0,75 (atividades da tabela do art.º 151.º), 0,35 (outras prestações de serviços), 0,15 (vendas de mercadorias e produtos)')
    for (const perimee of PERIMEES) expect(prompt).not.toContain(perimee)
  })
})

describe('Léa en portugais : réponses de secours (IA indisponible)', () => {
  it('IRS : retenção à 23 %, dispense sous 15 000 €, barème de 2026', async () => {
    const reponse = await reponseDeSecours('Qual é a retenção de IRS?')

    expect(reponse).toContain('IRS — Trabalhadores Independentes (Portugal 2026)')
    expect(reponse).toContain('Retenção na fonte (art.º 101.º CIRS): **23%** nas atividades da tabela do art.º 151.º (11,5% nas outras prestações de serviços)')
    expect(reponse).toContain('IRS estimado retido (23%)')
    expect(reponse).toContain('se previr faturar menos de 15 000 € no ano')
    expect(reponse).toContain('**Taxas gerais do IRS 2026 (art.º 68.º CIRS, sobre o rendimento coletável):**\n- Até 8 342 €: 12,2%\n')
    expect(reponse).toContain('- Mais de 86 634 €: 48%')
    expect(reponse).toContain('0,35 nas outras prestações de serviços e 0,15 nas vendas de mercadorias e produtos')
    for (const perimee of PERIMEES) expect(reponse).not.toContain(perimee)
    expect(reponse).not.toContain('**25%**')
  })

  it('résultat net : IRS estimé à 23 % ; titres de l’année', async () => {
    expect(await reponseDeSecours('Qual é o meu resultado líquido?')).toContain('IRS retido (est. 23%)')
    expect(await reponseDeSecours('Segurança Social')).toContain('Contribuições Segurança Social 2026 (Portugal)')
    expect(await reponseDeSecours('Olá')).toContain('Léa — Contabilista IA BTP Portugal 2026')
  })
})
