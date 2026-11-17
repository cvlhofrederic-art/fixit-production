// Fenêtre « Rentabilité du devis » (components/dashboard/btp/RentabiliteDevisModal.tsx), ouverte depuis le formulaire
// de devis BTP : sur /pt, elle était entièrement en français (constat de Frédéric du 17/11/2026).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, act, fireEvent, screen } from '@testing-library/react'
import { TEXTES_DEVIS_BTP_PT } from '@/lib/devis-btp-traduction'

vi.mock('sonner', async () => (await import('../helpers/mocks-formulaires-devis')).notifications())
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'jeton' } } }) } } }))

import RentabiliteDevisModal from '@/components/dashboard/btp/RentabiliteDevisModal'

const LIGNE = { id: 1, description: 'Limpeza de telhado', qty: 10, unit: 'm2', priceHT: 40, tvaRate: 23, totalHT: 400 }
const ANALYSE = {
  lignesAnalysees: [
    { description: 'Limpeza de telhado', qty: 10, unit: 'm2', priceHT: 40, totalHT: 400, matched: true, refPrestation: 'Limpeza', refPrixMoyen: 45, ecartPct: -11, verdict: 'trop_bas' },
    { description: 'Diversos', qty: 1, unit: 'f', priceHT: 100, totalHT: 100, matched: false },
  ],
  totaux: { caHT: 500, coutMOBrut: 200, coutChargesPatronales: 90, coutMOTotal: 290, chargesFixesProrata: 50, coutTotal: 340, beneficeNet: 160, margePct: 32, heuresTotal: 8, coutHoraireMoyen: 25, chargesPatronalesPct: 45, chargesFixesMensuelles: 300 },
  stats: { nbLignes: 2, nbMatched: 1, nbTropBas: 1, nbOk: 0, nbTropHaut: 0, nbNonAnalysees: 1 },
  niveau: 'correct', constat: '',
}

function repondre(url: string): Response {
  if (url.includes('table=settings')) return new Response(JSON.stringify({ data: [{ statut_juridique: 'Sociedade por Quotas (Lda.)' }] }), { status: 200 })
  if (url.includes('table=membres')) return new Response(JSON.stringify({ data: [{ id: 'm1', prenom: 'João', nom: 'Costa', cout_horaire: 12, actif: true }] }), { status: 200 })
  if (url.includes('table=charges_fixes')) return new Response(JSON.stringify({ data: [] }), { status: 200 })
  return new Response(JSON.stringify(ANALYSE), { status: 200 })
}

/** Textes visibles (hors feuille de style). */
const textesVisibles = (racine: HTMLElement) => Array.from(racine.querySelectorAll('*'))
  .filter((el) => el.tagName !== 'STYLE')
  .flatMap((el) => Array.from(el.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => (n.textContent || '').trim()))
  .filter(Boolean)

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubGlobal('fetch', vi.fn(async (url: string) => repondre(url)))
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('fenêtre « Rentabilité du devis » en portugais', () => {
  it('écran et résultat d\'analyse en portugais, aucun texte resté en français', async () => {
    const { container } = render(<RentabiliteDevisModal items={[LIGNE] as never} totalHT={500} totalTTC={615} onClose={vi.fn()} langue="pt" />)
    await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
    expect(screen.getByText('📊 Rentabilidade do orçamento')).toBeInTheDocument()
    expect(screen.getByText('Dias na obra')).toBeInTheDocument()
    await act(async () => { fireEvent.click(screen.getByText('Analisar')) })
    await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
    expect(screen.getByText('Lucro líquido')).toBeInTheDocument()
    expect(screen.getByText('Correto')).toBeInTheDocument()
    expect(screen.getByText('Demasiado baixo')).toBeInTheDocument()
    const francais = new Set(Object.entries(TEXTES_DEVIS_BTP_PT).filter(([fr, pt]) => fr !== pt).map(([fr]) => fr))
    const textes = textesVisibles(container)
    expect(textes.length).toBeGreaterThan(30)
    expect(textes.filter((t) => francais.has(t))).toEqual([])
  })

  // Règle n° 1 : le formulaire artisan ouvre aussi cette fenêtre, sans passer de langue : elle reste en français.
  it('sans langue (formulaire artisan) : en français, comme avant', async () => {
    render(<RentabiliteDevisModal items={[LIGNE] as never} totalHT={500} totalTTC={615} onClose={vi.fn()} />)
    await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
    expect(screen.getByText('📊 Rentabilité du devis')).toBeInTheDocument()
    expect(screen.getByText('Analyser')).toBeInTheDocument()
    expect(screen.queryByText('Analisar')).toBeNull()
  })
})
