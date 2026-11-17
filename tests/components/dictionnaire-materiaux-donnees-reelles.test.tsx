// Écran du Dictionnaire matériaux avec les VRAIES données du Portugal (713 matériaux, 123 fiches) : l'écran s'ouvre
// vite, l'exemple du propriétaire (« Infiltração fachada ») sort sa fiche et sa liste, chaque matériau affiché a ses
// liens vers les magasins qui le vendent, et les silicones se parcourent par catégories. Les autres tests de l'écran
// tournent sur un petit dictionnaire d'essai ; celui-ci attrape ce qui ne se voit qu'à l'échelle réelle.

import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { dictionnairePour, type Dictionnaire } from '@/lib/dictionnaire-materiaux'

/** Un nom du catalogue cherché tel quel dans un intitulé (« (2P+T) », « n.º 1 » : les caractères spéciaux comptent). */
const echapper = (texte: string) => texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

vi.mock('@/lib/i18n/context', () => ({ useLocale: () => 'pt' }))
vi.mock('@/lib/fetch-authentifie', () => ({ fetchAuthentifie: vi.fn() }))
vi.mock('@/lib/images/redimensionner-image', () => ({ redimensionnerImage: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const { default: DictionnaireMateriauxSection } = await import('@/components/dashboard/DictionnaireMateriauxSection')
const dico = dictionnairePour('PT') as Dictionnaire

const chercher = (texte: string) =>
  fireEvent.change(screen.getByRole('searchbox', { name: 'Pesquisar uma situação ou um material' }), { target: { value: texte } })

describe('Dictionnaire matériaux — écran avec les données réelles du Portugal', () => {
  it('s’ouvre vite, avec tous les domaines et toutes les familles', () => {
    const debut = performance.now()
    render(<DictionnaireMateriauxSection />)
    const duree = performance.now() - debut
    for (const d of dico.domaines) {
      const n = dico.situations.filter((s) => s.domaine === d.id).length
      expect(screen.getByRole('button', { name: new RegExp(`${echapper(d.nom)}.*${n} situaç`) }), d.id).toBeInTheDocument()
    }
    for (const f of dico.familles) {
      const n = dico.materiaux.filter((m) => m.famille === f.id).length
      expect(screen.getByRole('button', { name: new RegExp(`${echapper(f.nom)}.*${n} materia`) }), f.id).toBeInTheDocument()
    }
    // Rendu initial dans jsdom (plus lent qu'un navigateur) : seuil large, il attrape un rendu qui déraperait.
    expect(duree).toBeLessThan(5000)
  })

  it('sort la fiche « Infiltração em fachada » pour « infiltracao fachada », avec ses matériaux et leurs magasins', () => {
    render(<DictionnaireMateriauxSection />)
    chercher('infiltracao fachada')
    fireEvent.click(screen.getAllByRole('button', { name: /^Infiltração em fachada/ })[0])
    const fiche = screen.getByRole('dialog', { name: 'Infiltração em fachada' })
    const attendue = dico.situations.find((s) => s.id === 'infiltracao-fachada')!
    const ids = attendue.etapes.flatMap((e) => e.materiaux.map((l) => l.id))
    for (const id of ids) {
      const m = dico.materiaux.find((x) => x.id === id)!
      expect(within(fiche).getByRole('button', { name: m.nom }), id).toBeInTheDocument()
      // Un lien par magasin qui vend ce matériau, vers la page de recherche du magasin.
      for (const e of dico.enseignes.filter((x) => m.enseignes.includes(x.id))) {
        const lien = within(fiche).getByRole('link', { name: `Ver na ${e.nom}: ${m.nom}` })
        expect(lien.getAttribute('href'), `${id} ${e.id}`).toMatch(e.id === 'maxmat' ? /^https:\/\/www\.maxmat\.pt\/pt\/\?term=/ : /^https:\/\/www\.leroymerlin\.pt\/search\?q=/)
      }
    }
    for (const point of attendue.attention) expect(within(fiche).getByText(point)).toBeInTheDocument()
  })

  it('range les silicones par catégories, chacune avec ses produits', () => {
    render(<DictionnaireMateriauxSection />)
    const famille = dico.familles.find((f) => f.id === 'silicones-mastiques')!
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^.?\\s*${echapper(famille.nom)}`) }))
    for (const sf of famille.sousFamilles) {
      expect(screen.getByText(sf.nom), sf.id).toBeInTheDocument()
    }
    const premier = dico.materiaux.find((m) => m.famille === famille.id)!
    expect(screen.getAllByRole('button', { name: new RegExp(`^${echapper(premier.nom)}`) }).length).toBeGreaterThan(0)
  })

  it('montre douze situations d’un matériau courant, puis toutes sur demande', () => {
    render(<DictionnaireMateriauxSection />)
    const oculos = dico.materiaux.find((m) => m.id === 'oculos-protecao')!
    const nombre = dico.situations.filter((s) => s.etapes.some((e) => e.materiaux.some((l) => l.id === oculos.id))).length
    expect(nombre).toBeGreaterThan(12)
    chercher(oculos.nom)
    fireEvent.click(screen.getAllByRole('button', { name: new RegExp(`^${echapper(oculos.nom)}`) })[0])
    const fiche = screen.getByRole('dialog', { name: oculos.nom })
    fireEvent.click(within(fiche).getByRole('button', { name: `Ver as ${nombre} situações` }))
    expect(within(fiche).getAllByRole('button').filter((b) => b.classList.contains('dico-chip'))).toHaveLength(nombre)
  })
})
