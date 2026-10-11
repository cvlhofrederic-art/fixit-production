import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import type { ReactElement } from 'react'
import ModAtasIA from '@/components/syndic-dashboard/v54/modules/ModAtasIA'
import ModOrcIA from '@/components/syndic-dashboard/v54/modules/ModOrcIA'
import ModAnaliseOrc from '@/components/syndic-dashboard/v54/modules/ModAnaliseOrc'
import ModAcessibilidade from '@/components/syndic-dashboard/v54/modules/ModAcessibilidade'
import ModSegEdificio from '@/components/syndic-dashboard/v54/modules/ModSegEdificio'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'

/**
 * Résultats IA des modules v54 rendus en Markdown (MarkdownIA) au lieu du texte
 * brut en pre-wrap : titres, gras et listes interprétés, aucun « ** » ni « ## »
 * visible. Le cadre du résultat garde ses styles (seul le pre-wrap est retiré).
 */

afterEach(() => { cleanup(); vi.restoreAllMocks() })

const MARKDOWN = '## Síntese\n**Fundo de reserva** reforçado\n- ponto um\n- ponto dois'

const authed: SyndicData = { authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], token: 'tok' }

function monter(el: ReactElement) {
  render(<ToastProvider><SyndicDataContext.Provider value={authed}>{el}</SyndicDataContext.Provider></ToastProvider>)
}

function repondre(corps: Record<string, unknown>) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(corps), { status: 200 }))
}

/** Le bloc résultat contient le Markdown rendu, sans marqueurs visibles. */
async function verifierMarkdown() {
  const gras = await screen.findByText('Fundo de reserva')
  expect(gras.tagName).toBe('STRONG')
  const bloc = gras.closest('p')?.parentElement as HTMLElement
  expect(bloc.textContent).toContain('Síntese')
  expect(bloc.textContent).not.toMatch(/[*#]/)
  expect([...bloc.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['ponto um', 'ponto dois'])
  expect(bloc.style.whiteSpace).toBe('')
}

describe('Modules IA v54 — résultat rendu en Markdown', () => {
  it('ModAtasIA (Alfredo)', async () => {
    repondre({ content: MARKDOWN })
    monter(<ModAtasIA />)
    fireEvent.click(screen.getByRole('button', { name: /Começar do zero/ }))
    fireEvent.change(screen.getByPlaceholderText(/Aprovação das contas/), { target: { value: '1. Contas 2025' } })
    fireEvent.click(screen.getByRole('button', { name: /Gerar ata com IA/ }))
    await verifierMarkdown()
  })

  it('ModOrcIA (Léa)', async () => {
    repondre({ response: MARKDOWN })
    monter(<ModOrcIA />)
    fireEvent.click(screen.getByRole('button', { name: /Gerar Orçamento 2027/ }))
    await verifierMarkdown()
  })

  it('ModAnaliseOrc (Léa)', async () => {
    repondre({ response: MARKDOWN })
    monter(<ModAnaliseOrc />)
    fireEvent.click(screen.getByRole('tab', { name: /Inserir o texto/ }))
    fireEvent.change(screen.getByPlaceholderText(/Cole aqui o texto/), { target: { value: 'Orçamento limpeza 2026: 4800€ + IVA' } })
    fireEvent.click(screen.getByRole('button', { name: /Analisar o documento/ }))
    await verifierMarkdown()
  })

  it('ModAcessibilidade (diagnostic Alfredo)', async () => {
    repondre({ analise: MARKDOWN })
    monter(<ModAcessibilidade />)
    fireEvent.click(screen.getByRole('button', { name: /Análise IA Alfredo/ }))
    fireEvent.change(screen.getByPlaceholderText('Nome do edifício'), { target: { value: 'Edifício Aurora' } })
    fireEvent.click(screen.getByRole('button', { name: /^Analisar$/ }))
    await verifierMarkdown()
  })

  it('ModSegEdificio (plano de emergência Alfredo)', async () => {
    repondre({ plano: MARKDOWN })
    monter(<ModSegEdificio />)
    fireEvent.click(screen.getByRole('button', { name: /Gerar plano emergência/ }))
    fireEvent.change(screen.getByPlaceholderText('Nome do edifício'), { target: { value: 'Edifício Aurora' } })
    fireEvent.click(screen.getByRole('button', { name: /^Gerar plano$/ }))
    await verifierMarkdown()
  })
})
