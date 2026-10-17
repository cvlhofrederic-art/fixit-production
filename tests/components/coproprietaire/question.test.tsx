// tests/components/coproprietaire/question.test.tsx
//
// Écran « Poser une question » (EcranQuestion, Fixy) :
// - accord explicite à la première ouverture, mémorisé (CLES_PREFERENCES.accordAssistant) ;
// - démonstration (jeton null) : bulle d'introduction et réponses locales, sans réseau ;
// - connecté : POST /api/copro-ai avec le jeton, flux SSE assemblé dans une seule bulle,
//   repli JSON { reply }, erreur → bulle grise persistante + « Réessayer » ;
// - « Nouvelle conversation » ; fonction pure reponseDemo (jamais un montant absent de l'espace).

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import EcranQuestion, { reponseDemo } from '@/components/coproprietaire-dashboard/ecrans/EcranQuestion'
import { CLES_PREFERENCES, type PropsEcran } from '@/components/coproprietaire-dashboard/contrat'
import { espaceDemo, IBAN_DEMO } from '@/lib/coproprietaire/demo'
import { dateLongue, euros, remplir, textesCopro } from '@/lib/coproprietaire/textes'
import type { EspaceCopro } from '@/lib/coproprietaire/types'

const t = textesCopro('fr')
const QUESTIONS = t.question.questions
const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>()

function afficher(props: Partial<PropsEcran> = {}) {
  const base: PropsEcran = {
    espace: espaceDemo(),
    t,
    langue: 'fr',
    jeton: null,
    allerA: vi.fn(),
    rafraichir: vi.fn(async () => undefined),
    miseAJourLe: new Date('2026-10-17T09:00:00+02:00'),
  }
  return render(<EcranQuestion {...base} {...props} />)
}

const bulles = (c: HTMLElement, de: 'moi' | 'fixy' | 'erreur') => [...c.querySelectorAll<HTMLElement>(`[data-bulle="${de}"]`)]
const champ = () => screen.getByPlaceholderText(t.question.placeholder) as HTMLInputElement
const bouton = (nom: string) => screen.getByRole('button', { name: nom })
const corpsEnvoye = (appel: number) => JSON.parse(String(fetchMock.mock.calls[appel][1].body))
const enTetes = (appel: number) => fetchMock.mock.calls[appel][1].headers as Record<string, string>

function poser(question: string) {
  fireEvent.change(champ(), { target: { value: question } })
  fireEvent.submit(champ().closest('form') as HTMLFormElement)
}

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

const attendre = (ms = 20) => act(async () => { await new Promise(r => setTimeout(r, ms)) })

beforeAll(() => {
  // jsdom n'implémente pas le défilement.
  Element.prototype.scrollIntoView = vi.fn()
})

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(CLES_PREFERENCES.accordAssistant, '1')
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('EcranQuestion — accord à la première ouverture', () => {
  it('demande l’accord, bloque le champ et les questions, puis le mémorise', () => {
    localStorage.clear()
    afficher()
    expect(screen.getByText(t.question.titre)).toBeInTheDocument()
    expect(screen.getByText(t.question.intro)).toBeInTheDocument()
    expect(screen.getByText(/jamais votre IBAN, votre téléphone ni votre e-mail/)).toBeInTheDocument()
    expect(champ()).toBeDisabled()
    expect(bouton(t.question.envoyer)).toBeDisabled()
    for (const q of QUESTIONS) expect(bouton(q)).toBeDisabled()

    fireEvent.click(bouton('J’ai compris'))
    expect(screen.queryByText(/jamais votre IBAN/)).toBeNull()
    expect(champ()).toBeEnabled()
    for (const q of QUESTIONS) expect(bouton(q)).toBeEnabled()
    expect(localStorage.getItem(CLES_PREFERENCES.accordAssistant)).toBe('1')
  })

  it('ne redemande pas l’accord quand il a déjà été donné', () => {
    afficher()
    expect(screen.queryByText(/jamais votre IBAN/)).toBeNull()
    expect(champ()).toBeEnabled()
  })
})

describe('EcranQuestion — démonstration (jeton null)', () => {
  it('ouvre sur la bulle de démonstration et répond localement aux quatre questions, sans réseau', async () => {
    const { container } = afficher()
    expect(screen.getByText(t.question.demo)).toBeInTheDocument()
    expect(bulles(container, 'fixy')).toHaveLength(1)

    fireEvent.click(bouton(QUESTIONS[0]))
    await waitFor(() => expect(bulles(container, 'fixy')).toHaveLength(2))
    expect(bulles(container, 'moi')[0].textContent).toContain(QUESTIONS[0])
    const charges = bulles(container, 'fixy')[1]
    expect(charges.textContent).toContain(euros(855))
    expect(charges.textContent).toContain(dateLongue('2026-10-15'))
    expect(charges.querySelector('strong')?.textContent).toBe(euros(855))
    expect(charges.textContent).not.toContain('**')

    fireEvent.click(bouton(QUESTIONS[2]))
    await waitFor(() => expect(bulles(container, 'fixy')).toHaveLength(3))
    expect(bulles(container, 'fixy')[2].textContent).toContain('19 novembre 2026')
    expect(bulles(container, 'fixy')[2].textContent).toContain('Salle polyvalente')

    fireEvent.click(bouton(QUESTIONS[3]))
    await waitFor(() => expect(bulles(container, 'fixy')).toHaveLength(4))
    const syndic = bulles(container, 'fixy')[3].textContent
    expect(syndic).toContain('Cabinet Dupont')
    expect(syndic).toContain('04 91 00 00 00')
    expect(syndic).toContain('contact@cabinet-dupont.fr')

    poser(QUESTIONS[1])
    await waitFor(() => expect(bulles(container, 'fixy')).toHaveLength(5))
    expect(bulles(container, 'fixy')[4].textContent).toContain('Ascenseur')
    expect(bulles(container, 'fixy')[4].textContent).toContain(t.demandes.statuts.en_attente)

    expect(bulles(container, 'moi')).toHaveLength(4)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(champ().value).toBe('')
  })

  it('« Nouvelle conversation » efface les bulles et le champ', async () => {
    const { container } = afficher()
    poser('Bonjour')
    await waitFor(() => expect(bulles(container, 'moi')).toHaveLength(1))
    fireEvent.change(champ(), { target: { value: 'brouillon' } })

    fireEvent.click(bouton(t.question.nouvelleConversation))
    expect(bulles(container, 'moi')).toHaveLength(0)
    expect(bulles(container, 'fixy')).toHaveLength(1)
    expect(screen.getByText(t.question.demo)).toBeInTheDocument()
    expect(champ().value).toBe('')
  })
})

describe('EcranQuestion — connecté (jeton)', () => {
  it('envoie la question avec le jeton et assemble le flux SSE dans une seule bulle', async () => {
    const flux = fluxControle()
    fetchMock.mockResolvedValueOnce(flux.reponse)
    const { container } = afficher({ jeton: 'jeton-test' })
    expect(screen.queryByText(t.question.demo)).toBeNull()

    fireEvent.click(bouton(QUESTIONS[0]))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0][0]).toBe('/api/copro-ai')
    expect(fetchMock.mock.calls[0][1].method).toBe('POST')
    expect(enTetes(0).Authorization).toBe('Bearer jeton-test')
    const corps = corpsEnvoye(0)
    expect(corps).toEqual({ messages: [{ role: 'user', content: QUESTIONS[0] }], stream: true, locale: 'fr' })

    // Avant le premier mot : indicateur de saisie, pas de bulle vide, champ bloqué.
    await attendre()
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(bulles(container, 'fixy')).toHaveLength(0)
    expect(champ()).toBeDisabled()

    act(() => {
      flux.texte('Vous devez **855 €** ')
      flux.texte('avant le 15 octobre 2026.')
    })
    await waitFor(() => expect(bulles(container, 'fixy')).toHaveLength(1))
    await waitFor(() => expect(bulles(container, 'fixy')[0].textContent).toContain('Vous devez 855 € avant le 15 octobre 2026.'))
    expect(bulles(container, 'fixy')[0].querySelector('strong')?.textContent).toBe('855 €')
    expect(screen.queryByRole('status')).toBeNull()

    // Pendant l'écriture, la question suivante ne part pas.
    poser('Et la prochaine assemblée ?')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    act(() => flux.fin())
    await attendre()
    expect(bulles(container, 'fixy')).toHaveLength(1)
    expect(bulles(container, 'erreur')).toHaveLength(0)
    expect(champ()).toBeEnabled()
    expect(champ().value).toBe('Et la prochaine assemblée ?')
  })

  it('réponse JSON { reply } sans flux : une bulle rendue en Markdown', async () => {
    fetchMock.mockResolvedValueOnce(reponseJson({ reply: 'Bonjour **Géraldine**, votre solde est à jour.' }))
    const { container } = afficher({ jeton: 'jeton-test' })
    poser('Bonjour')
    await waitFor(() => expect(bulles(container, 'fixy')).toHaveLength(1))
    expect(bulles(container, 'fixy')[0].querySelector('strong')?.textContent).toBe('Géraldine')
    expect(bulles(container, 'fixy')[0].textContent).toContain('Bonjour Géraldine, votre solde est à jour.')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('flux terminé sans aucun texte : message d’excuse, pas de bulle vide', async () => {
    const flux = fluxControle()
    fetchMock.mockResolvedValueOnce(flux.reponse)
    const { container } = afficher({ jeton: 'jeton-test' })
    poser('Bonjour')
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    act(() => flux.fin())
    expect(await screen.findByText(t.question.pasDeReponse)).toBeInTheDocument()
    expect(bulles(container, 'fixy')).toHaveLength(1)
  })

  it('panne réseau : bulle grise persistante et « Réessayer » renvoie la même question', async () => {
    const avertissement = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const { container } = afficher({ jeton: 'jeton-test' })
    poser('Quel est mon solde ?')

    const erreur = await screen.findByRole('alert')
    expect(erreur.textContent).toContain(t.question.erreur)
    expect(bulles(container, 'erreur')).toHaveLength(1)
    await attendre(50)
    expect(bulles(container, 'erreur')).toHaveLength(1)
    expect(champ()).toBeEnabled()

    fetchMock.mockResolvedValueOnce(reponseJson({ reply: 'Votre solde est à jour.' }))
    fireEvent.click(bouton(t.commun.reessayer))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(corpsEnvoye(1).messages).toEqual([{ role: 'user', content: 'Quel est mon solde ?' }])
    expect(enTetes(1).Authorization).toBe('Bearer jeton-test')
    await waitFor(() => expect(bulles(container, 'erreur')).toHaveLength(0))
    expect(bulles(container, 'moi')).toHaveLength(1)
    expect(bulles(container, 'fixy')[0].textContent).toContain('Votre solde est à jour.')
    avertissement.mockRestore()
  })

  it('réponse HTTP en erreur : bulle d’erreur avec « Réessayer »', async () => {
    const avertissement = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    fetchMock.mockResolvedValueOnce(reponseJson({ reply: 'Service indisponible' }, 503))
    afficher({ jeton: 'jeton-test' })
    poser('Bonjour')
    const erreur = await screen.findByRole('alert')
    expect(erreur.textContent).toContain(t.question.erreur)
    expect(bouton(t.commun.reessayer)).toBeEnabled()
    avertissement.mockRestore()
  })

  it('« Nouvelle conversation » pendant la réponse : requête annulée, aucune bulle d’erreur', async () => {
    const flux = fluxControle()
    fetchMock.mockImplementationOnce(async (_url, init) => {
      init.signal?.addEventListener('abort', () => flux.erreur(new DOMException('Aborted', 'AbortError')))
      return flux.reponse
    })
    const { container } = afficher({ jeton: 'jeton-test' })
    poser('Bonjour')
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    act(() => flux.texte('Votre solde est'))
    await waitFor(() => expect(bulles(container, 'fixy')).toHaveLength(1))

    fireEvent.click(bouton(t.question.nouvelleConversation))
    expect(fetchMock.mock.calls[0][1].signal?.aborted).toBe(true)
    await attendre()
    expect(bulles(container, 'fixy')).toHaveLength(0)
    expect(bulles(container, 'moi')).toHaveLength(0)
    expect(bulles(container, 'erreur')).toHaveLength(0)
    expect(champ()).toBeEnabled()
  })
})

describe('reponseDemo — réponses locales à partir de l’espace', () => {
  const espace = espaceDemo()

  it('combien je dois : prochain appel non soldé, montant et échéance de l’espace', () => {
    const r = reponseDemo(QUESTIONS[0], espace, t, 'fr')
    expect(r).toContain(euros(855))
    expect(r).toContain(dateLongue('2026-10-15'))
    expect(r).toContain('PAY-2026-004-LOT12')
    expect(r).toContain(t.menu.charges)
    expect(r).not.toContain(IBAN_DEMO)
    // Jamais le libellé brut de l'exercice.
    expect(r).not.toContain('2026-T4')
  })

  it('échéance à venir : « à régler avant le » ; échéance passée : retard de paiement', () => {
    const avant: EspaceCopro = { ...espace, chargeLe: '2026-10-01T09:00:00+02:00' }
    expect(reponseDemo('Combien je dois ?', avant, t, 'fr'))
      .toContain(remplir(t.charges.aReglerAvant, { montant: `**${euros(855)}**`, date: dateLongue('2026-10-15') }))
    expect(reponseDemo('Combien je dois ?', espace, t, 'fr'))
      .toContain(remplir(t.charges.retard, { montant: `**${euros(855)}**`, date: dateLongue('2026-10-15') }))
  })

  it('ma demande : dernière demande, date d’envoi et statut en mots', () => {
    const r = reponseDemo(QUESTIONS[1], espace, t, 'fr')
    expect(r).toContain('Ascenseur')
    expect(r).toContain(dateLongue('2026-09-29T08:45:00+02:00'))
    expect(r).toContain(t.demandes.statuts.en_attente)
    expect(r).toContain(t.menu.demandes)
  })

  it('assemblée : prochaine AG convoquée, date, lieu et résolutions en attente', () => {
    const r = reponseDemo(QUESTIONS[2], espace, t, 'fr')
    expect(r).toContain('19 novembre 2026')
    expect(r).toContain('Salle polyvalente, 182 avenue du Prado, 13008 Marseille')
    expect(r).toContain(remplir(t.assemblees.resolutionsAttendent, { n: 3, total: 3 }))
    expect(r).toContain(t.menu.assemblees)
  })

  it('syndic : nom, gestionnaire, téléphone, e-mail, adresse', () => {
    const r = reponseDemo(QUESTIONS[3], espace, t, 'fr')
    expect(r).toContain('Cabinet Dupont')
    expect(r).toContain('Hugo Carvalho')
    expect(r).toContain('04 91 00 00 00')
    expect(r).toContain('contact@cabinet-dupont.fr')
    expect(r).toContain('45 avenue du Prado, 13008 Marseille')
  })

  it('autre question : orientation vers les écrans, sans montant', () => {
    const r = reponseDemo('Quelle heure est-il ?', espace, t, 'fr')
    expect(r).toContain(t.menu.charges)
    expect(r).toContain(t.menu.documents)
    expect(r).not.toContain('€')
  })

  it('jamais un montant absent de l’espace', () => {
    const sansAppel: EspaceCopro = { ...espace, finances: { ...espace.finances, appels: [] } }
    expect(reponseDemo('Combien je dois ?', sansAppel, t, 'fr')).toBe(t.charges.aucunAppel)
    expect(reponseDemo('Combien je dois ?', sansAppel, t, 'fr')).not.toContain('€')

    const soldes: EspaceCopro = {
      ...espace,
      finances: { ...espace.finances, appels: espace.finances.appels.map(a => ({ ...a, statut: 'solde' as const, resteAPayer: 0 })) },
    }
    expect(reponseDemo('Combien je dois ?', soldes, t, 'fr')).toContain(t.charges.aJour)
    expect(reponseDemo('Combien je dois ?', soldes, t, 'fr')).not.toContain('€')

    const locataire: EspaceCopro = { ...espace, profil: { ...espace.profil, role: 'locataire' } }
    expect(reponseDemo('Combien je dois ?', locataire, t, 'fr')).not.toContain('€')
    expect(reponseDemo(QUESTIONS[2], locataire, t, 'fr')).not.toContain('19 novembre')

    const sansSyndic: EspaceCopro = { ...espace, syndic: { ...espace.syndic, nom: '' } }
    expect(reponseDemo(QUESTIONS[3], sansSyndic, t, 'fr')).toBe(t.informations.syndicInconnu)

    const sansAg: EspaceCopro = { ...espace, assemblees: espace.assemblees.filter(a => a.statut !== 'convoquee') }
    expect(reponseDemo(QUESTIONS[2], sansAg, t, 'fr')).toBe(t.assemblees.aucune)

    const sansDemande: EspaceCopro = { ...espace, interventions: { ...espace.interventions, mesDemandes: [] } }
    expect(reponseDemo(QUESTIONS[1], sansDemande, t, 'fr')).toContain(t.demandes.aucuneDemande)
  })

  it('répond en portugais avec les textes PT', () => {
    const tp = textesCopro('pt')
    expect(reponseDemo(tp.question.questions[0], espace, tp, 'pt')).toContain(euros(855, 'pt'))
    expect(reponseDemo(tp.question.questions[1], espace, tp, 'pt')).toContain(tp.demandes.statuts.en_attente)
    expect(reponseDemo(tp.question.questions[2], espace, tp, 'pt')).toContain('19')
    expect(reponseDemo(tp.question.questions[3], espace, tp, 'pt')).toContain('contact@cabinet-dupont.fr')
    expect(reponseDemo('Que horas são?', espace, tp, 'pt')).toContain(tp.menu.charges)
  })
})
