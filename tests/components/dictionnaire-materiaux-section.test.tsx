// Écran du Dictionnaire matériaux (components/dashboard/DictionnaireMateriauxSection.tsx) : recherche manuelle,
// parcours par catégorie, fiches de situation et de matériau, liens vers les magasins, conversation avec l'IA
// (texte, photos, erreurs). Le dictionnaire d'essai remplace les données réelles ; la route est simulée.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { DICO_ESSAI } from '../dictionnaire-materiaux/dictionnaire-essai'

const JPEG = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...new Array(32).fill(3)]).toString('base64')}`

const h = vi.hoisted(() => ({
  dico: null as unknown,
  langue: 'pt',
  appel: vi.fn(),
  redimensionner: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock('@/lib/i18n/context', () => ({ useLocale: () => h.langue }))
vi.mock('@/lib/fetch-authentifie', () => ({ fetchAuthentifie: h.appel }))
vi.mock('@/lib/images/redimensionner-image', () => ({ redimensionnerImage: h.redimensionner }))
vi.mock('sonner', () => ({ toast: h.toast }))
vi.mock('@/lib/dictionnaire-materiaux', async (orig) => ({
  ...(await orig<typeof import('@/lib/dictionnaire-materiaux')>()),
  dictionnairePour: (pays: string) => (pays === 'PT' ? h.dico : null),
}))

const { default: DictionnaireMateriauxSection } = await import('@/components/dashboard/DictionnaireMateriauxSection')

const ANALYSE = {
  resume: 'Infiltração provável por fissuras no reboco.',
  situations: ['infiltracao-fachada'],
  etapes: [{ titre: 'Reparação', materiaux: [{ id: 'argamassa-reparacao', raison: 'Refazer o reboco solto.' }] }],
  conseils: ['Trabalhar com tempo seco.'],
  attention: ['Fissura larga: pedir avaliação.'],
  questions: ['A parede é rebocada ou em pedra?'],
  horsCatalogue: ['Andaime'],
}

const reponse = (statut: number, corps: unknown) => new Response(JSON.stringify(corps), { status: statut, headers: { 'content-type': 'application/json' } })
const corpsEnvoye = (n = 0) => JSON.parse(String((h.appel.mock.calls[n][1] as RequestInit).body)) as Record<string, unknown>

const chercher = (texte: string) =>
  fireEvent.change(screen.getByRole('searchbox', { name: 'Pesquisar uma situação ou um material' }), { target: { value: texte } })

const passerALIA = () => fireEvent.click(screen.getByRole('button', { name: 'Descrever a situação (IA)' }))
const decrire = (texte: string) => fireEvent.change(screen.getByRole('textbox', { name: 'Descrição da situação' }), { target: { value: texte } })
const analyser = () => fireEvent.click(screen.getByRole('button', { name: 'Analisar' }))

describe('Dictionnaire matériaux — écran', () => {
  beforeEach(() => {
    h.dico = DICO_ESSAI
    h.langue = 'pt'
    h.appel.mockReset()
    // Une réponse neuve à chaque appel : le corps d'une Response ne se lit qu'une fois.
    h.appel.mockImplementation(async () => reponse(200, { analyse: ANALYSE }))
    h.redimensionner.mockReset()
    h.redimensionner.mockResolvedValue({ dataUrl: JPEG, redimensionnee: true })
    Object.values(h.toast).forEach((f) => f.mockClear())
  })

  describe('mode manuel', () => {
    it('s’ouvre sur la recherche, avec les deux parcours et les enseignes du pays', () => {
      render(<DictionnaireMateriauxSection />)
      expect(screen.getByRole('heading', { level: 1, name: 'Dicionário de materiais' })).toBeInTheDocument()
      expect(screen.getByText(/fáceis de encontrar: Leroy Merlin, Maxmat/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Pesquisar' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByText('Situações por tipo de obra')).toBeInTheDocument()
      expect(screen.getByText('Materiais por categoria')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Fachadas e paredes exteriores.*2 situações/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Silicones, mástiques e espumas.*4 materiais/ })).toBeInTheDocument()
      expect(screen.getByText('Disponibilidade nas lojas verificada em 14/11/2026.')).toBeInTheDocument()
    })

    it('trouve la situation par mot-clé sans accents et ouvre sa fiche', () => {
      render(<DictionnaireMateriauxSection />)
      chercher('infiltracao fachada')
      fireEvent.click(screen.getByRole('button', { name: /^Infiltração em fachada/ }))

      const fiche = screen.getByRole('dialog', { name: 'Infiltração em fachada' })
      expect(within(fiche).getByText('A verificar no local')).toBeInTheDocument()
      expect(within(fiche).getByText('Largura das fissuras.')).toBeInTheDocument()
      // Les matériaux, par étapes, dans l'ordre du travail.
      const etapes = within(fiche).getAllByRole('heading', { level: 4 }).map((t) => t.textContent)
      expect(etapes).toEqual(['A verificar no local', 'Reparação2', 'Proteção1', 'Ferramentas1', '⚠️ Atenção'])
      expect(within(fiche).getByRole('button', { name: 'Argamassa de reparação' })).toBeInTheDocument()
      expect(within(fiche).getByText('Refazer o reboco solto.')).toBeInTheDocument()
      expect(within(fiche).getByText('opcional')).toBeInTheDocument()
      expect(within(fiche).getByText('Uma fissura larga ou que volta a abrir pode ser estrutural.')).toBeInTheDocument()
    })

    it('ne propose que les magasins où le matériau a été vérifié, par un lien de recherche', () => {
      render(<DictionnaireMateriauxSection />)
      chercher('infiltração fachada')
      fireEvent.click(screen.getByRole('button', { name: /^Infiltração em fachada/ }))
      const fiche = screen.getByRole('dialog')

      const argamassaLM = within(fiche).getByRole('link', { name: 'Ver na Leroy Merlin: Argamassa de reparação' })
      expect(argamassaLM).toHaveAttribute('href', 'https://lm.example/search?q=argamassa%20repara%C3%A7%C3%A3o')
      expect(argamassaLM).toHaveAttribute('target', '_blank')
      expect(argamassaLM).toHaveAttribute('rel', 'noopener noreferrer')
      // Chez Maxmat, ce matériau se cherche sous un autre terme : le lien part avec le terme propre à l'enseigne.
      expect(within(fiche).getByRole('link', { name: 'Ver na Maxmat: Argamassa de reparação' })).toHaveAttribute(
        'href',
        'https://maxmat.example/pesquisa?term=massa%20de%20repara%C3%A7%C3%A3o',
      )
      // Hidrofugante : vérifié chez Leroy Merlin seulement.
      expect(within(fiche).getByRole('link', { name: 'Ver na Leroy Merlin: Hidrofugante incolor para fachadas' })).toBeInTheDocument()
      expect(within(fiche).queryByRole('link', { name: 'Ver na Maxmat: Hidrofugante incolor para fachadas' })).toBeNull()
    })

    it('montre d’abord douze situations d’un matériau courant, puis toutes sur demande', () => {
      // Seize situations emploient l'espátula de pintor : la fiche d'essai « infiltracao-fachada » et quinze ajoutées ici.
      const ajoutees = Array.from({ length: 15 }, (_, i) => ({
        id: `situacao-ensaio-${i + 1}`,
        domaine: 'fachadas',
        titre: `Situação de ensaio ${i + 1}`,
        motsCles: [`ensaio ${i + 1}`],
        description: 'Situação de ensaio.',
        aVerifier: [],
        etapes: [{ titre: 'Ferramentas', materiaux: [{ id: 'espatula-pintor' }] }],
        attention: [],
      }))
      h.dico = { ...DICO_ESSAI, situations: [...DICO_ESSAI.situations, ...ajoutees] }
      render(<DictionnaireMateriauxSection />)
      chercher('espátula de pintor')
      fireEvent.click(screen.getByRole('button', { name: /^Espátula de pintor/ }))

      const fiche = screen.getByRole('dialog', { name: 'Espátula de pintor' })
      const situationsMontrees = () => within(fiche).getAllByRole('button').filter((b) => b.classList.contains('dico-chip') && !b.classList.contains('dico-chip-plus'))
      expect(situationsMontrees()).toHaveLength(12)
      fireEvent.click(within(fiche).getByRole('button', { name: 'Ver as 16 situações' }))
      expect(situationsMontrees()).toHaveLength(16)
      expect(within(fiche).queryByRole('button', { name: /^Ver as \d+ situações$/ })).toBeNull()
    })

    it('passe de la fiche de situation à celle du matériau, puis revient', () => {
      render(<DictionnaireMateriauxSection />)
      chercher('infiltração fachada')
      fireEvent.click(screen.getByRole('button', { name: /^Infiltração em fachada/ }))
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Mástique de poliuretano para fachadas' }))

      const materiau = screen.getByRole('dialog', { name: 'Mástique de poliuretano para fachadas' })
      expect(within(materiau).getByText(/Silicones, mástiques e espumas › Mástique de poliuretano/)).toBeInTheDocument()
      expect(within(materiau).getByText('Selar fissuras e juntas de dilatação em fachadas.')).toBeInTheDocument()
      expect(within(materiau).getByText('PU de juntas')).toBeInTheDocument()
      expect(within(materiau).getByRole('link', { name: 'Ver na Maxmat: Mástique de poliuretano para fachadas' })).toHaveTextContent('Ver na Maxmat ↗')
      // Situations qui l'emploient.
      expect(within(materiau).getByRole('button', { name: 'Fissuras finas no reboco da fachada' })).toBeInTheDocument()

      fireEvent.click(within(materiau).getByRole('button', { name: /Voltar/ }))
      expect(screen.getByRole('dialog', { name: 'Infiltração em fachada' })).toBeInTheDocument()
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('garde le focus dans la fiche, le place sur chaque nouveau titre et le rend au bouton d’origine', () => {
      render(<DictionnaireMateriauxSection />)
      chercher('infiltração fachada')
      const resultat = screen.getByRole('button', { name: /^Infiltração em fachada/ })
      resultat.focus()
      fireEvent.click(resultat)
      const fiche = screen.getByRole('dialog', { name: 'Infiltração em fachada' })
      expect(document.activeElement).toBe(within(fiche).getByRole('heading', { level: 3, name: 'Infiltração em fachada' }))

      // Tab tourne dans la fenêtre : du dernier élément au premier, et du premier au dernier avec Maj.
      const focalisables = Array.from(fiche.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'))
      const [premier, dernier] = [focalisables[0], focalisables[focalisables.length - 1]]
      dernier.focus()
      fireEvent.keyDown(dernier, { key: 'Tab' })
      expect(document.activeElement).toBe(premier)
      fireEvent.keyDown(premier, { key: 'Tab', shiftKey: true })
      expect(document.activeElement).toBe(dernier)

      // La fiche suivante s'ouvre en haut, le focus sur son titre (le bouton cliqué a disparu avec l'ancienne fiche).
      Object.defineProperty(fiche, 'scrollTop', { value: 480, writable: true, configurable: true })
      fireEvent.click(within(fiche).getByRole('button', { name: 'Mástique de poliuretano para fachadas' }))
      const materiau = screen.getByRole('dialog', { name: 'Mástique de poliuretano para fachadas' })
      expect(materiau.scrollTop).toBe(0)
      expect(document.activeElement).toBe(within(materiau).getByRole('heading', { level: 3, name: 'Mástique de poliuretano para fachadas' }))

      // Fermée, la fenêtre rend le focus au résultat qui l'avait ouverte.
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(document.activeElement).toBe(resultat)
    })

    it('affiche la précaution, le conditionnement et les autres noms d’un matériau', () => {
      render(<DictionnaireMateriauxSection />)
      chercher('silicone sanitario')
      fireEvent.click(screen.getByRole('button', { name: /^Silicone sanitário anti-fungos/ }))
      const fiche = screen.getByRole('dialog', { name: 'Silicone sanitário anti-fungos' })
      expect(within(fiche).getByText('Não é pintável.')).toBeInTheDocument()
      expect(within(fiche).getByText('Cartucho de 280 ml')).toBeInTheDocument()
      expect(within(fiche).getByText('silicone para casa de banho · silicone anti-bolor')).toBeInTheDocument()
      expect(within(fiche).getByText(/Confirme o stock e a referência na loja/)).toBeInTheDocument()
      fireEvent.click(within(fiche).getByRole('button', { name: 'Fechar' }))
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('range les matériaux par sous-familles dans le parcours par catégorie', () => {
      render(<DictionnaireMateriauxSection />)
      const volet = screen.getByRole('button', { name: /Silicones, mástiques e espumas/ })
      expect(volet).toHaveAttribute('aria-expanded', 'false')
      fireEvent.click(volet)
      expect(volet).toHaveAttribute('aria-expanded', 'true')
      for (const sousFamille of ['Silicone sanitário', 'Silicone neutro', 'Mástique acrílico', 'Mástique de poliuretano']) {
        expect(screen.getByText(sousFamille)).toBeInTheDocument()
      }
      expect(screen.getByRole('button', { name: /^Silicone neutro para caixilharia/ })).toBeInTheDocument()
      fireEvent.click(volet)
      expect(screen.queryByRole('button', { name: /^Silicone neutro para caixilharia/ })).toBeNull()
    })

    it('dit quand rien ne correspond, et efface la recherche', () => {
      render(<DictionnaireMateriauxSection />)
      chercher('xyzw')
      expect(screen.getByText('Nada encontrado para «xyzw».', { selector: 'strong' })).toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent('Nada encontrado para «xyzw».')
      fireEvent.click(screen.getByRole('button', { name: 'Limpar a pesquisa' }))
      expect(screen.getByText('Materiais por categoria')).toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent('')
    })

    it('annonce le nombre de résultats dans une zone présente dès l’affichage', () => {
      render(<DictionnaireMateriauxSection />)
      // La zone existe avant la première lettre : une zone créée déjà remplie n'est pas lue.
      const zone = screen.getByRole('status')
      expect(zone).toBeEmptyDOMElement()
      chercher('fachada')
      expect(zone).toHaveTextContent(/^\d+ situaç(ão|ões), \d+ materia(l|is)$/)
      expect(zone).toHaveTextContent('2 situações')
    })

    it('copie la liste des matériaux d’une fiche', async () => {
      const ecrire = vi.fn(async () => undefined)
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: ecrire }, configurable: true })
      render(<DictionnaireMateriauxSection />)
      chercher('junta silicone')
      fireEvent.click(screen.getByRole('button', { name: /^Junta de silicone com bolor no duche/ }))
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Copiar a lista/ }))
      await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith('Lista copiada'))
      expect(ecrire).toHaveBeenCalledWith('Junta de silicone com bolor no duche\n\nVedação :\n- Silicone sanitário anti-fungos — Em suporte limpo e seco.')

      ecrire.mockRejectedValueOnce(new Error('refusé'))
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Copiar a lista/ }))
      await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith('Não foi possível copiar a lista'))
    })
  })

  describe('mode langage naturel', () => {
    it('envoie la description et affiche une réponse faite de matériaux du catalogue', async () => {
      render(<DictionnaireMateriauxSection />)
      passerALIA()
      expect(screen.getByRole('button', { name: 'Analisar' })).toBeDisabled()
      decrire('Fachada com fissuras e manchas no interior.')
      analyser()

      expect(await screen.findByText('Infiltração provável por fissuras no reboco.')).toBeInTheDocument()
      expect(h.appel).toHaveBeenCalledWith('/api/dictionnaire-materiaux/analyse', expect.objectContaining({ method: 'POST' }))
      expect(corpsEnvoye()).toEqual({ pays: 'PT', description: 'Fachada com fissuras e manchas no interior.', photos: [], historique: [] })

      expect(screen.getByText('Fachada com fissuras e manchas no interior.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Argamassa de reparação' })).toBeInTheDocument()
      expect(screen.getByText('Refazer o reboco solto.')).toBeInTheDocument()
      expect(screen.getByText('Trabalhar com tempo seco.')).toBeInTheDocument()
      expect(screen.getByText('Fissura larga: pedir avaliação.')).toBeInTheDocument()
      expect(screen.getByText('A parede é rebocada ou em pedra?')).toBeInTheDocument()
      expect(screen.getByText('Andaime')).toBeInTheDocument()
      // La zone de saisie est vidée pour la suite de la conversation.
      expect(screen.getByRole('textbox', { name: 'Descrição da situação' })).toHaveValue('')

      // La fiche du dictionnaire proposée s'ouvre depuis la réponse.
      fireEvent.click(screen.getByRole('button', { name: 'Infiltração em fachada' }))
      expect(screen.getByRole('dialog', { name: 'Infiltração em fachada' })).toBeInTheDocument()
    })

    it('renvoie les tours précédents au tour suivant, et repart de zéro sur demande', async () => {
      render(<DictionnaireMateriauxSection />)
      passerALIA()
      decrire('Fachada com fissuras.')
      analyser()
      await screen.findByText('Infiltração provável por fissuras no reboco.')

      decrire('É rebocada e pintada.')
      analyser()
      await waitFor(() => expect(h.appel).toHaveBeenCalledTimes(2))
      expect(corpsEnvoye(1)).toEqual({
        pays: 'PT',
        description: 'É rebocada e pintada.',
        photos: [],
        historique: [
          { role: 'user', texte: 'Fachada com fissuras.' },
          {
            role: 'assistant',
            texte: 'Infiltração provável por fissuras no reboco.\nMateriais propostos: Argamassa de reparação.\nPerguntas feitas: A parede é rebocada ou em pedra?',
          },
        ],
      })

      await waitFor(() => expect(screen.getAllByText('Infiltração provável por fissuras no reboco.')).toHaveLength(2))
      fireEvent.click(screen.getByRole('button', { name: 'Nova conversa' }))
      expect(screen.queryByText('Infiltração provável por fissuras no reboco.')).toBeNull()
    })

    it('joint les photos préparées en JPEG, les montre et permet d’en retirer', async () => {
      const { container } = render(<DictionnaireMateriauxSection />)
      passerALIA()
      const champ = container.querySelector('input[type="file"]') as HTMLInputElement
      const fichier = new File([new Uint8Array([1, 2, 3])], 'parede.jpg', { type: 'image/jpeg' })
      fireEvent.change(champ, { target: { files: [fichier, fichier] } })

      expect(await screen.findByRole('img', { name: 'Foto 2' })).toBeInTheDocument()
      expect(h.redimensionner).toHaveBeenCalledWith(fichier, 1568, undefined, { type: 'image/jpeg', qualite: 0.82 })
      expect(screen.getByRole('button', { name: /Juntar fotos \(2\/4\)/ })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Retirar a foto 1' }))
      expect(screen.queryByRole('img', { name: 'Foto 2' })).toBeNull()

      decrire('Mancha no teto da casa de banho.')
      analyser()
      await screen.findByText('Infiltração provável por fissuras no reboco.')
      expect(corpsEnvoye().photos).toEqual([JPEG])
      // La photo reste visible dans la conversation, plus dans la zone de saisie.
      expect(screen.getAllByRole('img', { name: 'Foto 1' })).toHaveLength(1)
      expect(screen.getByRole('button', { name: /Juntar fotos \(0\/4\)/ })).toBeInTheDocument()
    })

    it('attend la fin de la préparation des photos avant de permettre l’envoi', async () => {
      let terminer: (valeur: { dataUrl: string; redimensionnee: boolean }) => void = () => undefined
      h.redimensionner.mockImplementationOnce(() => new Promise((resoudre) => { terminer = resoudre }))
      const { container } = render(<DictionnaireMateriauxSection />)
      passerALIA()
      decrire('Mancha no teto da casa de banho.')
      const champ = container.querySelector('input[type="file"]') as HTMLInputElement
      fireEvent.change(champ, { target: { files: [new File([new Uint8Array([1])], 'teto.jpg', { type: 'image/jpeg' })] } })

      // Pendant la préparation : ni envoi, ni nouvelle sélection, et l'écran le dit.
      expect(await screen.findByRole('button', { name: /A preparar as fotos/ })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Analisar' })).toBeDisabled()
      expect(screen.getByRole('status')).toHaveTextContent('A preparar as fotos…')
      analyser()
      expect(h.appel).not.toHaveBeenCalled()

      // Prête, la photo part avec le message.
      terminer({ dataUrl: JPEG, redimensionnee: true })
      await screen.findByRole('img', { name: 'Foto 1' })
      expect(screen.getByRole('button', { name: 'Analisar' })).toBeEnabled()
      analyser()
      await screen.findByText('Infiltração provável por fissuras no reboco.')
      expect(corpsEnvoye().photos).toEqual([JPEG])
    })

    it('annonce l’analyse puis la réponse, sans retirer le focus du champ', async () => {
      let repondre: (valeur: Response) => void = () => undefined
      h.appel.mockImplementationOnce(() => new Promise<Response>((resoudre) => { repondre = resoudre }))
      render(<DictionnaireMateriauxSection />)
      passerALIA()
      const zone = screen.getByRole('status')
      expect(zone).toBeEmptyDOMElement()
      const champ = screen.getByRole('textbox', { name: 'Descrição da situação' })
      champ.focus()
      decrire('Fachada com fissuras e manchas no interior.')
      fireEvent.keyDown(champ, { key: 'Enter', ctrlKey: true })

      // Pendant l'analyse : le champ reste focalisé, en lecture seule ; le bouton est inactif sans être désactivé.
      expect(zone).toHaveTextContent('A analisar…')
      expect(champ).toHaveAttribute('readonly')
      expect(document.activeElement).toBe(champ)
      expect(champ.closest('.dico-ia')?.querySelector('.dico-conversation')).toHaveAttribute('aria-busy', 'true')
      // La zone d'annonce n'est pas sous la partie « occupée » : un lecteur d'écran pourrait sinon la taire.
      expect(zone.closest('[aria-busy="true"]')).toBeNull()
      const bouton = screen.getByRole('button', { name: 'A analisar…' })
      expect(bouton).toHaveAttribute('aria-disabled', 'true')
      fireEvent.click(bouton)
      expect(h.appel).toHaveBeenCalledTimes(1)

      repondre(reponse(200, { analyse: ANALYSE }))
      await screen.findByText('Infiltração provável por fissuras no reboco.')
      expect(zone).toHaveTextContent('Resposta recebida.')
      expect(champ).not.toHaveAttribute('readonly')
      expect(document.activeElement).toBe(champ)
    })

    it('n’annonce pas de nouveau la réponse précédente une fois une photo préparée', async () => {
      let terminer: (valeur: { dataUrl: string; redimensionnee: boolean }) => void = () => undefined
      const { container } = render(<DictionnaireMateriauxSection />)
      passerALIA()
      const zone = screen.getByRole('status')
      decrire('Fachada com fissuras e manchas no interior.')
      analyser()
      await screen.findByText('Infiltração provável por fissuras no reboco.')
      expect(zone).toHaveTextContent('Resposta recebida.')

      // Une photo pour la question suivante : « A preparar as fotos… », puis plus rien, aucune réponse n'étant arrivée.
      h.redimensionner.mockImplementationOnce(() => new Promise((resoudre) => { terminer = resoudre }))
      const champ = container.querySelector('input[type="file"]') as HTMLInputElement
      fireEvent.change(champ, { target: { files: [new File([new Uint8Array([1])], 'teto.jpg', { type: 'image/jpeg' })] } })
      await waitFor(() => expect(zone).toHaveTextContent('A preparar as fotos…'))
      terminer({ dataUrl: JPEG, redimensionnee: true })
      await screen.findByRole('img', { name: 'Foto 1' })
      expect(zone).toBeEmptyDOMElement()
    })

    it('envoie des photos sans un mot, avec la question qui va de soi', async () => {
      const { container } = render(<DictionnaireMateriauxSection />)
      passerALIA()
      expect(screen.getByRole('button', { name: 'Analisar' })).toBeDisabled()
      const champ = container.querySelector('input[type="file"]') as HTMLInputElement
      fireEvent.change(champ, { target: { files: [new File([new Uint8Array([1])], 'teto.jpg', { type: 'image/jpeg' })] } })
      await screen.findByRole('img', { name: 'Foto 1' })
      expect(screen.getByRole('button', { name: 'Analisar' })).toBeEnabled()
      analyser()
      await screen.findByText('Infiltração provável por fissuras no reboco.')
      expect(corpsEnvoye()).toMatchObject({ description: 'Veja as fotografias em anexo: que materiais devo usar?', photos: [JPEG] })
      expect(screen.getByText('Veja as fotografias em anexo: que materiais devo usar?')).toBeInTheDocument()
    })

    it('n’affiche pas une réponse qui n’a pas la forme d’une analyse', async () => {
      render(<DictionnaireMateriauxSection />)
      passerALIA()
      decrire('Parede húmida.')
      for (const corps of [{ analyse: 'texte' }, { analyse: { resume: 'x' } }, { analyse: { ...ANALYSE, etapes: 'aucune' } }]) {
        h.appel.mockResolvedValueOnce(reponse(200, corps))
        analyser()
        expect(await screen.findByRole('alert')).toHaveTextContent('A IA não conseguiu responder a esta descrição.')
        await waitFor(() => expect(screen.getByRole('button', { name: 'Analisar' })).toBeEnabled())
      }
      expect(screen.queryByText('Resposta do dicionário')).toBeNull()
    })

    it('n’accepte pas plus de quatre photos ni une image illisible', async () => {
      const { container } = render(<DictionnaireMateriauxSection />)
      passerALIA()
      const champ = container.querySelector('input[type="file"]') as HTMLInputElement
      const fichier = new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' })
      fireEvent.change(champ, { target: { files: [fichier, fichier, fichier, fichier, fichier] } })
      await screen.findByRole('img', { name: 'Foto 4' })
      expect(h.toast.info).toHaveBeenCalledWith('No máximo 4 fotos por mensagem.')
      expect(screen.queryByRole('img', { name: 'Foto 5' })).toBeNull()
      expect(screen.getByRole('button', { name: /Juntar fotos \(4\/4\)/ })).toBeDisabled()

      fireEvent.click(screen.getByRole('button', { name: 'Retirar a foto 4' }))
      h.redimensionner.mockResolvedValueOnce({ dataUrl: 'data:image/heic;base64,AAAAAAAAAAAAAAAAAAAAAAAA', redimensionnee: false })
      fireEvent.change(champ, { target: { files: [fichier] } })
      await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith('Não foi possível ler esta imagem. Use uma fotografia JPEG ou PNG.'))
      expect(screen.queryByRole('img', { name: 'Foto 4' })).toBeNull()
    })

    it('explique l’échec sans perdre la description', async () => {
      render(<DictionnaireMateriauxSection />)
      passerALIA()
      const cas: Array<[Response | Error, string]> = [
        [reponse(429, { error: 'rate' }), 'Demasiados pedidos seguidos. Aguarde um minuto.'],
        [reponse(401, { error: 'Unauthorized' }), 'Sessão expirada. Inicie sessão novamente.'],
        [reponse(502, { error: 'ia_indisponible' }), 'A IA está indisponível de momento. Tente novamente dentro de instantes.'],
        [reponse(422, { error: 'photo_illisible' }), 'A IA não conseguiu ler uma das fotos. Tire outra fotografia ou envie só o texto.'],
        [reponse(500, { error: 'code_inconnu' }), 'A análise falhou. Tente novamente.'],
        [reponse(200, { autre: true }), 'A IA não conseguiu responder a esta descrição. Reformule ou acrescente detalhes.'],
        [new Error('réseau coupé'), 'Sem ligação ao servidor. Verifique a rede e tente novamente.'],
      ]
      decrire('Parede húmida junto ao rodapé.')
      for (const [resultat, message] of cas) {
        if (resultat instanceof Error) h.appel.mockRejectedValueOnce(resultat)
        else h.appel.mockResolvedValueOnce(resultat)
        analyser()
        expect(await screen.findByRole('alert')).toHaveTextContent(message)
        expect(screen.getByRole('textbox', { name: 'Descrição da situação' })).toHaveValue('Parede húmida junto ao rodapé.')
        await waitFor(() => expect(screen.getByRole('button', { name: 'Analisar' })).toBeEnabled())
      }
    })

    it('refuse une description d’une ou deux lettres, sans photo, sans appeler la route', () => {
      render(<DictionnaireMateriauxSection />)
      passerALIA()
      decrire('ab')
      analyser()
      expect(screen.getByRole('alert')).toHaveTextContent('Descreva a situação em algumas palavras.')
      expect(h.appel).not.toHaveBeenCalled()
    })

    it('garde la recherche et la conversation quand on change de mode', async () => {
      render(<DictionnaireMateriauxSection />)
      chercher('silicone')
      passerALIA()
      decrire('Fachada com fissuras.')
      analyser()
      await screen.findByText('Infiltração provável por fissuras no reboco.')
      fireEvent.click(screen.getByRole('button', { name: 'Pesquisar' }))
      expect(screen.getByRole('searchbox')).toHaveValue('silicone')
      passerALIA()
      expect(screen.getByText('Infiltração provável por fissuras no reboco.')).toBeInTheDocument()
    })
  })

  it('annonce l’absence de dictionnaire pour un pays qui n’en a pas', () => {
    h.langue = 'fr'
    render(<DictionnaireMateriauxSection />)
    expect(screen.getByRole('heading', { level: 1, name: 'Dictionnaire matériaux' })).toBeInTheDocument()
    expect(screen.getByText('Le dictionnaire des matériaux n’est pas encore disponible pour ce pays.')).toBeInTheDocument()
    expect(screen.queryByRole('searchbox')).toBeNull()
  })
})
