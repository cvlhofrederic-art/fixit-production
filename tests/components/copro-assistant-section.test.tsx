// tests/components/copro-assistant-section.test.tsx
//
// Assistant Fixy de l'espace Copropriétaire (CoproAssistantSection) :
// - réponses de l'assistant rendues en Markdown (MarkdownIA), bulle inchangée ;
// - indicateur de saisie gardé jusqu'au premier mot (Claude peut mettre
//   quelques secondes) : jamais de bulle vide ;
// - seuls les 20 derniers messages partent, sans prompt système, avec la langue ;
// - réponse JSON {reply} (pas de clé IA côté serveur) affichée telle quelle.
// fetch et Supabase sont simulés.

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

const h = vi.hoisted(() => ({ locale: 'fr' as string }))

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'jeton-test' } } })) } },
}))
vi.mock('@/lib/i18n/context', () => ({ useLocale: () => h.locale }))

import CoproAssistantSection from '@/components/coproprietaire-dashboard/pages/CoproAssistantSection'

const t: Record<string, string> = {
  assistantTitre: 'Fixy — Assistant IA',
  assistantDesc: 'Je connais toute votre copropriété.',
  nouvelleConversation: 'Nouvelle conversation',
  bonjourPrenom: 'Bonjour',
  assistantIntro: 'Je suis Fixy, votre assistant personnel pour la copropriété',
  assistantIntro2: '.',
  'questionsFréquentes': 'Questions fréquentes',
  assistantQ1: 'Combien je dois payer ce mois ?',
  assistantQ2: 'Quelle est la prochaine assemblée générale ?',
  assistantQ3: 'Quels documents puis-je télécharger ?',
  assistantQ4: 'Quel est mon solde actuel ?',
  assistantQ5: 'Comment voter pour une résolution ?',
  assistantQ6: 'Y a-t-il des travaux prévus ?',
  assistantQ7: 'Quand est la prochaine coupure d\'eau ?',
  assistantQ8: 'C\'est quoi les tantièmes ?',
  suggestionQ1: 'Mes paiements en attente',
  suggestionQ2: 'Prochaine AG',
  suggestionQ3: 'Mes documents',
  suggestionQ4: 'Mon solde',
  placeholderInput: 'Posez votre question…',
  assistantPied: 'Fixy peut répondre à toutes vos questions sur votre copropriété',
}

const profile = {
  id: 'copro-demo-1', nom: 'Xavier', prenom: 'Géraldine', email: 'geraldine.xavier@email.com',
  telephone: '06 12 34 56 78', immeuble: 'Résidence Le Prado', batiment: 'D', etage: '4',
  numLot: '12', tantiemes: 450, quotePart: 4.5,
}

const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>()

function reponseJson(corps: unknown, status = 200): Response {
  return new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } })
}

/** Flux SSE piloté par le test, comme celui de lib/claude.ts. */
function fluxControle() {
  const enc = new TextEncoder()
  let c!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({ start(controleur) { c = controleur } })
  return {
    reponse: new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
    texte: (texte: string) => c.enqueue(enc.encode(`data: ${JSON.stringify({ text: texte })}\n\n`)),
    fin: () => { c.enqueue(enc.encode('data: [DONE]\n\n')); c.close() },
    erreur: (e: unknown) => c.error(e),
  }
}

function afficher(props: Partial<{ buildCoproSystemPrompt: () => string }> = {}) {
  return render(<CoproAssistantSection t={t} profile={profile} {...props} />)
}

function poser(question: string) {
  const champ = screen.getByPlaceholderText('Posez votre question…') as HTMLInputElement
  fireEvent.change(champ, { target: { value: question } })
  fireEvent.submit(champ.closest('form') as HTMLFormElement)
}

const indicateurSaisie = (c: HTMLElement) => c.querySelectorAll('.animate-bounce').length > 0
const bullesAssistant = (c: HTMLElement) =>
  [...c.querySelectorAll<HTMLElement>('[class*="max-w-[75%]"]')].filter(b => b.className.includes('bg-white'))
const bullesUtilisateur = (c: HTMLElement) =>
  [...c.querySelectorAll<HTMLElement>('[class*="max-w-[75%]"]')].filter(b => b.className.includes('bg-[#0D1B2E]'))
const corpsEnvoye = (appel: number) => JSON.parse(String(fetchMock.mock.calls[appel][1].body))

beforeAll(() => {
  // jsdom n'implémente pas le défilement.
  Element.prototype.scrollIntoView = vi.fn()
})

beforeEach(() => {
  h.locale = 'fr'
  fetchMock.mockReset()
  globalThis.fetch = fetchMock as unknown as typeof fetch
})

describe('CoproAssistantSection — affichage des réponses', () => {
  it('garde l’indicateur de saisie jusqu’au premier mot, puis rend le Markdown dans la même bulle', async () => {
    const flux = fluxControle()
    fetchMock.mockResolvedValueOnce(flux.reponse)
    const { container } = afficher()

    poser('Mon **solde** ?')
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    // Claude réfléchit : pas de bulle vide, l'indicateur reste affiché.
    await act(async () => { await new Promise(r => setTimeout(r, 20)) })
    expect(indicateurSaisie(container)).toBe(true)
    expect(bullesAssistant(container)).toHaveLength(0)

    act(() => {
      flux.texte('Votre **solde** est de 2 537,50 € :\n')
      flux.texte('- Charges T4 2026\n- Fonds de travaux')
    })
    await waitFor(() => expect(container.querySelectorAll('li')).toHaveLength(2))
    expect(indicateurSaisie(container)).toBe(false)
    const bulles = bullesAssistant(container)
    expect(bulles).toHaveLength(1)
    expect(bulles[0].querySelector('strong')?.textContent).toBe('solde')
    expect(bulles[0].textContent).not.toContain('**')
    // Bulle et couleurs inchangées.
    expect(bulles[0].className).toContain('bg-white border border-[#E4DDD0] text-[#0D1B2E] rounded-tl-sm')
    // Le message de l'utilisateur reste du texte brut.
    expect(bullesUtilisateur(container)[0].textContent).toBe('Mon **solde** ?')

    // Pendant l'écriture de la réponse, la question suivante ne part pas.
    poser('Et la prochaine AG ?')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Réponse terminée : la question restée dans le champ peut partir.
    act(() => flux.fin())
    await act(async () => { await new Promise(r => setTimeout(r, 20)) })
    expect((screen.getByPlaceholderText('Posez votre question…') as HTMLInputElement).value).toBe('Et la prochaine AG ?')
    fetchMock.mockResolvedValueOnce(reponseJson({ reply: 'Le **19 novembre 2026** à 18h00.' }))
    fireEvent.submit(container.querySelector('form') as HTMLFormElement)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(bullesAssistant(container)).toHaveLength(2))
    expect(bullesAssistant(container)[1].querySelector('strong')?.textContent).toBe('19 novembre 2026')
  })

  it('réponse JSON {reply} (pas de clé IA côté serveur) : affichée, sans bulle vide', async () => {
    fetchMock.mockResolvedValueOnce(reponseJson({ reply: '⚠️ Service IA temporairement indisponible. Veuillez réessayer plus tard.' }))
    const { container } = afficher()
    poser('Quel est mon solde actuel ?')
    expect(await screen.findByText('⚠️ Service IA temporairement indisponible. Veuillez réessayer plus tard.')).toBeInTheDocument()
    expect(bullesAssistant(container)).toHaveLength(1)
    expect(indicateurSaisie(container)).toBe(false)
  })

  it('erreur serveur avec {reply} : le message du serveur est affiché', async () => {
    fetchMock.mockResolvedValueOnce(reponseJson({ reply: 'Je rencontre un problème technique. Réessayez dans quelques instants.' }, 500))
    afficher()
    poser('Quel est mon solde actuel ?')
    expect(await screen.findByText('Je rencontre un problème technique. Réessayez dans quelques instants.')).toBeInTheDocument()
  })

  it('flux terminé sans aucun texte : message d’excuse au lieu d’une bulle vide', async () => {
    const flux = fluxControle()
    fetchMock.mockResolvedValueOnce(flux.reponse)
    const { container } = afficher()
    poser('Quel est mon solde actuel ?')
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    act(() => flux.fin())
    expect(await screen.findByText('Désolée, je n\'ai pas pu répondre pour le moment.')).toBeInTheDocument()
    expect(bullesAssistant(container)).toHaveLength(1)
  })

  it('panne réseau : message d’erreur, en portugais si l’espace est en pt', async () => {
    const avertissement = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    h.locale = 'pt'
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    afficher()
    poser('Qual é o meu saldo atual?')
    expect(await screen.findByText('Ocorreu um erro. Tente novamente.')).toBeInTheDocument()
    expect(corpsEnvoye(0).locale).toBe('pt')
    avertissement.mockRestore()
  })

  it('« Nouvelle conversation » pendant une réponse : requête annulée, aucun message d’erreur', async () => {
    const flux = fluxControle()
    fetchMock.mockImplementationOnce(async (_url, init) => {
      init.signal?.addEventListener('abort', () => flux.erreur(new DOMException('Aborted', 'AbortError')))
      return flux.reponse
    })
    const { container } = afficher()
    poser('Quel est mon solde actuel ?')
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    act(() => flux.texte('Votre solde est'))
    await waitFor(() => expect(bullesAssistant(container)).toHaveLength(1))

    fireEvent.click(screen.getByText('Nouvelle conversation'))
    expect(fetchMock.mock.calls[0][1].signal?.aborted).toBe(true)
    expect(await screen.findByText('Bonjour Géraldine !')).toBeInTheDocument()
    await act(async () => { await new Promise(r => setTimeout(r, 20)) })
    expect(screen.queryByText('Une erreur est survenue. Veuillez réessayer.')).toBeNull()
    expect(bullesAssistant(container)).toHaveLength(0)
  })
})

describe('CoproAssistantSection — requête envoyée', () => {
  it('n’envoie que les 20 derniers messages, sans prompt système, avec la langue et le jeton', async () => {
    const { container } = afficher({ buildCoproSystemPrompt: () => 'PROMPT CONSTRUIT DANS LE NAVIGATEUR' })
    for (let i = 1; i <= 13; i++) {
      fetchMock.mockResolvedValueOnce(reponseJson({ reply: `Réponse ${i}` }))
      poser(`Question ${i}`)
      expect(await screen.findByText(`Réponse ${i}`)).toBeInTheDocument()
    }
    // 13 questions + 13 réponses à l'écran ; la 13e requête portait 25 messages.
    expect(bullesAssistant(container)).toHaveLength(13)
    const corps = corpsEnvoye(12)
    expect(corps.messages).toHaveLength(20)
    expect(corps.messages[0]).toEqual({ role: 'assistant', content: 'Réponse 3' })
    expect(corps.messages[19]).toEqual({ role: 'user', content: 'Question 13' })
    expect(corps.stream).toBe(true)
    expect(corps.locale).toBe('fr')
    expect(corps).not.toHaveProperty('systemPrompt')
    expect(String(fetchMock.mock.calls[12][1].body)).not.toContain('PROMPT CONSTRUIT DANS LE NAVIGATEUR')
    expect(fetchMock.mock.calls[12][0]).toBe('/api/copro-ai')
    expect((fetchMock.mock.calls[12][1].headers as Record<string, string>).Authorization).toBe('Bearer jeton-test')
    // Les premiers échanges partaient en entier.
    expect(corpsEnvoye(0).messages).toEqual([{ role: 'user', content: 'Question 1' }])
  })

  it('borne chaque message à 10 000 caractères (limite du schéma serveur)', async () => {
    fetchMock.mockResolvedValueOnce(reponseJson({ reply: 'Bien reçu.' }))
    afficher()
    poser('a'.repeat(12_000))
    expect(await screen.findByText('Bien reçu.')).toBeInTheDocument()
    expect(corpsEnvoye(0).messages[0].content).toHaveLength(10_000)
  })
})
