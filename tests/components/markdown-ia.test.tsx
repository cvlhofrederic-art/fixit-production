import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'

import MarkdownIA, { decouperBlocs } from '@/components/common/MarkdownIA'

describe('MarkdownIA — rendu des réponses des agents', () => {
  it('gras, italique, code et paragraphes', () => {
    const { container } = render(<MarkdownIA texte={'Il reste **3 impayés** sur *Le Méridien*.\nVoir `art. 19-2`.\n\nSecond paragraphe.'} />)
    expect(container.querySelector('strong')?.textContent).toBe('3 impayés')
    expect(container.querySelector('em')?.textContent).toBe('Le Méridien')
    expect(container.querySelector('code')?.textContent).toBe('art. 19-2')
    expect(container.querySelectorAll('p')).toHaveLength(2)
    expect(container.textContent).not.toContain('**')
  })

  it('titres, listes à puces et numérotées', () => {
    const { container } = render(<MarkdownIA texte={'### Étapes\n1. Relance amiable\n2. Mise en demeure\n\n- Lot 12\n* Lot 14'} />)
    expect(container.querySelector('[role="heading"]')?.textContent).toBe('Étapes')
    expect(container.querySelectorAll('ol li')).toHaveLength(2)
    expect(container.querySelectorAll('ul li')).toHaveLength(2)
    expect(container.textContent).not.toContain('###')
    // Puces et numéros explicites : la preflight de Tailwind 4 met list-style: none sur ul / ol.
    expect((container.querySelector('ol') as HTMLElement).style.listStyleType).toBe('decimal')
    expect((container.querySelector('ul') as HTMLElement).style.listStyleType).toBe('disc')
  })

  it('tableau simple', () => {
    const { container } = render(<MarkdownIA texte={'| Lot | Solde |\n|---|---:|\n| 12 | -1 840 € |\n| 14 | -620 € |'} />)
    expect([...container.querySelectorAll('th')].map(t => t.textContent)).toEqual(['Lot', 'Solde'])
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2)
  })

  it('n’interprète jamais de HTML venant du modèle', () => {
    const { container } = render(<MarkdownIA texte={'<img src=x onerror="alert(1)"> **ok** <script>alert(2)</script>'} />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('script')).toBeNull()
    expect(container.textContent).toContain('<img src=x')
  })

  it('liens affichés en texte (libellé et adresse), jamais en lien cliquable', () => {
    const { container } = render(<MarkdownIA texte={'[Légifrance](https://www.legifrance.gouv.fr) et [x](javascript:alert(1))'} />)
    // Aucune adresse venant du modèle dans un attribut href (alerte CodeQL « DOM text reinterpreted as HTML »).
    expect(container.querySelectorAll('a')).toHaveLength(0)
    expect(container.textContent).toContain('Légifrance (https://www.legifrance.gouv.fr)')
    // Schéma autre que http(s) : laissé tel quel, en texte.
    expect(container.textContent).toContain('[x](javascript:alert(1))')
  })

  it('texte sans Markdown : rendu à l’identique avec ses retours à la ligne', () => {
    expect(decouperBlocs('Bonjour\nMadame')).toEqual([{ type: 'p', lignes: ['Bonjour', 'Madame'] }])
  })
})
