// Fixy (components/chat/AiChatBot.tsx) — devis dicté quand l'IA ne répond pas (lecture locale du message), constat du
// 20/11/2026 : sur /pt, la ligne préparée partait à 20 % et le montant dicté (TTC) était divisé par 1,2. Elle part
// désormais au taux normal portugais (23 %, montant ÷ 1,23) ; en France, 20 % et ÷ 1,2 comme avant.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

const langue = vi.hoisted(() => ({ locale: 'pt' as 'fr' | 'pt' }))
vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({ t: (cle: string) => cle, locale: langue.locale }),
  useLocale: () => langue.locale,
}))
vi.mock('sonner', async () => (await import('../helpers/mocks-formulaires-devis')).notifications())
// L'IA ne répond pas (« success: false ») : Fixy lit le message lui-même. Aucun client enregistré.
vi.mock('@/lib/fetch-authentifie', () => ({
  fetchAuthentifie: vi.fn(async (url: string) => new Response(
    JSON.stringify(url.startsWith('/api/fixy-ai') ? { success: false } : { clients: [] }), { status: 200 },
  )),
}))

import AiChatBot from '@/components/chat/AiChatBot'
import type { Artisan } from '@/lib/types'

const TEXTES = {
  pt: { bouton: 'Fixy, o seu assistente', champ: 'Mensagem para o assistente IA', oui: 'sim' },
  fr: { bouton: 'Fixy — votre assistant', champ: "Message pour l'assistant IA", oui: 'oui' },
}

/** Dicte un devis à Fixy, confirme, et rend les données transmises au formulaire. */
async function dicterDevis(message: string): Promise<{ lines?: Array<Record<string, unknown>> }> {
  const onCreateDevis = vi.fn()
  const textes = TEXTES[langue.locale]
  render(
    <AiChatBot
      artisan={{ id: 'art-fixy-iva', company_name: 'Canalizações Exemplo' } as unknown as Artisan}
      bookings={[]} services={[]} availability={[]} dayServices={{}} absences={[]}
      onCreateRdv={vi.fn()} onCreateDevis={onCreateDevis} onNavigate={vi.fn()}
    />,
  )
  fireEvent.keyDown(await screen.findByTitle(textes.bouton), { key: 'Enter' })
  const envoyer = (texte: string) => {
    const champ = screen.getByLabelText(textes.champ)
    fireEvent.change(champ, { target: { value: texte } })
    fireEvent.submit(champ.closest('form')!)
  }
  envoyer(message)
  await waitFor(() => expect(screen.getByLabelText(textes.champ)).not.toBeDisabled())
  await waitFor(() => expect(document.body.textContent).toMatch(/\((sim\/não|oui\/non)\)/))
  envoyer(textes.oui)
  await waitFor(() => expect(onCreateDevis).toHaveBeenCalledTimes(1))
  return onCreateDevis.mock.calls[0][0]
}

beforeEach(() => {
  localStorage.clear()
  langue.locale = 'pt'
  // jsdom n'a pas scrollIntoView (défilement du fil de messages)
  Element.prototype.scrollIntoView = vi.fn()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Fixy : devis dicté, taux de la ligne préparée', () => {
  it('sur /pt : 23 %, montant dicté c/ IVA ÷ 1,23', async () => {
    const devis = await dicterDevis('Faz um orçamento para o Silva de 123 euros')
    expect(devis.lines).toHaveLength(1)
    expect(devis.lines![0]).toMatchObject({ tvaRate: 23, priceHT: 100, totalHT: 100 })
  })

  it('en France : 20 %, montant TTC ÷ 1,2 (inchangé)', async () => {
    langue.locale = 'fr'
    const devis = await dicterDevis('Fais un devis pour Dupont de 120 euros')
    expect(devis.lines).toHaveLength(1)
    expect(devis.lines![0]).toMatchObject({ tvaRate: 20, priceHT: 100, totalHT: 100 })
  })
})
