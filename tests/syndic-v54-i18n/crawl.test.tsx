/**
 * Relevé des textes du harnais i18n syndic v54 (crawl.tsx) : l'instantané PT doit
 * voir un libellé qui se multiplie, se déplace ou disparaît après un clic, ainsi que
 * l'état des contrôles (option choisie d'une liste, case cochée, état ARIA).
 * Composants minimes : le dashboard n'est pas monté.
 */
import { cleanup, render } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { collectTexts, crawl, textesDistincts, type CrawlResult } from './crawl'
import { residusPortugais } from './residus-pt'

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

const dom = (html: string): void => {
  document.body.innerHTML = html
}
const compte = (xs: readonly string[], s: string): number => xs.filter((x) => x === s).length

/** Annuaire de démonstration : neuf cartes, la pastille « Certificado » sur certaines. */
const NOMS = ['Silva', 'Santos', 'Costa', 'Ferreira', 'Pereira', 'Oliveira', 'Rodrigues', 'Martins', 'Sousa']
const annuaire = (certifies: readonly string[]): string =>
  NOMS.map((n) => `<article><h3>${n}</h3>${certifies.includes(n) ? '<span>Certificado</span>' : ''}</article>`).join('')

describe('collectTexts — relevé dans l’ordre du document, doublons compris', () => {
  it('voit une pastille qui se multiplie (2 cartes puis 7)', () => {
    dom(annuaire(['Santos', 'Costa']))
    const deux = collectTexts()
    dom(annuaire(NOMS.filter((n) => n !== 'Santos' && n !== 'Costa')))
    const sept = collectTexts()
    expect(sept).not.toEqual(deux)
    expect(compte(deux, 'Certificado')).toBe(2)
    expect(compte(sept, 'Certificado')).toBe(7)
  })

  it('voit une pastille qui change de carte', () => {
    dom('<article><h3>Silva</h3><span>Certificado</span></article><article><h3>Santos</h3></article>')
    const avant = collectTexts()
    dom('<article><h3>Silva</h3></article><article><h3>Santos</h3><span>Certificado</span></article>')
    const apres = collectTexts()
    expect(apres).not.toEqual(avant)
    expect(avant).toEqual(['Silva', 'Certificado', 'Santos'])
    expect(apres).toEqual(['Silva', 'Santos', 'Certificado'])
  })

  it('suit l’ordre du document : attributs d’un élément, puis ses textes', () => {
    dom('<button aria-label="Fechar">x</button><p>Texto</p>')
    expect(collectTexts()).toEqual(['@aria-label=Fechar', 'x', 'Texto'])
  })

  it('garde les filtres : script, style, noscript, champs cachés et cases ignorés, racine exclue', () => {
    dom(
      '<div id="racine" aria-label="Racine">' +
        '<script>var a = 1</script><style>.a{color:red}</style><noscript>Sem JS</noscript>' +
        '<input type="hidden" value="cache"><input type="checkbox" value="case"><input type="radio" value="bouton">' +
        '<input type="file"><input type="text" value="Texte saisi"><textarea>Nota</textarea>' +
        '</div>',
    )
    const r = collectTexts(document.getElementById('racine') as HTMLElement)
    for (const absent of ['@aria-label=Racine', 'var a = 1', '.a{color:red}', 'Sem JS', '@value=cache', '@value=case', '@value=bouton']) {
      expect(r).not.toContain(absent)
    }
    expect(r).toContain('@value=Texte saisi')
    expect(r).toContain('@value=Nota')
  })

  it('relève l’option choisie d’une liste déroulante', () => {
    render(
      <select value="outro" onChange={() => {}}>
        <option value="manutencao">Manutenção</option>
        <option value="outro">Outro</option>
      </select>,
    )
    const r = collectTexts()
    expect(r).toContain('@selected=Outro')
    expect(r).not.toContain('@selected=Manutenção')
  })

  it('relève l’état coché des cases et boutons radio, codé en chiffres', () => {
    render(
      <form>
        <input type="checkbox" checked onChange={() => {}} />
        <input type="checkbox" checked={false} onChange={() => {}} />
        <input type="radio" name="r" checked onChange={() => {}} />
      </form>,
    )
    expect(collectTexts()).toEqual(['@checked=1', '@checked=0', '@checked=1'])
  })

  it('relève les états ARIA, codés en chiffres', () => {
    dom(
      '<button aria-expanded="true">Groupe</button>' +
        '<a href="#" aria-current="page">Painel</a>' +
        '<a href="#" aria-current="false">Ordens</a>' +
        '<div role="tab" aria-selected="false">Aba</div>' +
        '<div role="checkbox" aria-checked="mixed">Todos</div>' +
        '<button aria-pressed="true">Filtro</button>',
    )
    expect(collectTexts()).toEqual([
      '@aria-expanded=1', 'Groupe',
      '@aria-current=1', 'Painel',
      '@aria-current=0', 'Ordens',
      '@aria-selected=0', 'Aba',
      '@aria-checked=2', 'Todos',
      '@aria-pressed=1', 'Filtro',
    ])
  })
})

function Liste() {
  const [n, setN] = useState(1)
  const [filtre, setFiltre] = useState(false)
  return (
    <div>
      <button onClick={() => setN(2)}>Ajouter</button>
      <button onClick={() => setFiltre(true)}>Filtrer</button>
      {Array.from({ length: n }, (_, i) => <span key={i}>Certificado</span>)}
      {!filtre && <p>Ligne filtrée</p>}
    </div>
  )
}

function AvecDialogue() {
  const [open, setOpen] = useState(false)
  const [n, setN] = useState(1)
  return (
    <div>
      <button onClick={() => setOpen(true)}>Ouvrir</button>
      {open && (
        <div role="dialog" aria-label="Fiche">
          <button onClick={() => setN(2)}>Dupliquer</button>
          <button onClick={() => setOpen(false)}>Fermer</button>
          {Array.from({ length: n }, (_, i) => <span key={i}>Certificado</span>)}
        </div>
      )}
    </div>
  )
}

function Preselection() {
  const [cat, setCat] = useState('manutencao')
  return (
    <div>
      <button onClick={() => setCat('outro')}>Aviso Urgente</button>
      <select value={cat} onChange={(e) => setCat(e.target.value)}>
        <option value="manutencao">Manutenção</option>
        <option value="outro">Outro</option>
      </select>
    </div>
  )
}

/** Formulaire ouvert par « Aviso Urgente » avec une catégorie présélectionnée (absente de la liste → 1re option). */
function QuadroAvisos({ categorie }: { categorie: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button onClick={() => setOpen(true)}>Aviso Urgente</button>
      {open && (
        <select value={categorie} onChange={() => {}}>
          <option value="manutencao">Manutenção</option>
          <option value="assembleia">Assembleia</option>
          <option value="outro">Outro</option>
        </select>
      )}
    </div>
  )
}

describe('crawl — ce qui apparaît et disparaît à chaque clic', () => {
  it('signale un libellé déjà présent qui se multiplie, et un libellé masqué par un filtre', async () => {
    const r = await crawl({ mount: () => <Liste /> })
    expect(r.initial).toEqual(['Ajouter', 'Filtrer', 'Certificado', 'Ligne filtrée'])
    expect(r.clicks).toEqual([
      { path: '0:Ajouter', added: ['Certificado'], removed: [] },
      { path: '1:Filtrer', added: [], removed: ['Ligne filtrée'] },
    ])
  })

  it('fait de même dans la boîte de dialogue ouverte (profondeur 2)', async () => {
    const r = await crawl({ mount: () => <AvecDialogue />, dialogs: true })
    const dialogue = ['@aria-label=Fiche', 'Dupliquer', 'Fermer', 'Certificado']
    expect(r.clicks).toEqual([
      { path: '0:Ouvrir', added: dialogue, removed: [] },
      { path: '0:Ouvrir > 0:Dupliquer', added: ['Certificado'], removed: [] },
      { path: '0:Ouvrir > 1:Fermer', added: [], removed: dialogue },
    ])
  })

  it('signale le changement d’option choisie après un clic', async () => {
    const r = await crawl({ mount: () => <Preselection /> })
    expect(r.clicks[0]).toEqual({ path: '0:Aviso Urgente', added: ['@selected=Outro'], removed: ['@selected=Manutenção'] })
  })

  it('distingue deux présélections du même formulaire (cas « Aviso Urgente » du quadro de avisos)', async () => {
    const avant = await crawl({ mount: () => <QuadroAvisos categorie="urgente" /> })
    const apres = await crawl({ mount: () => <QuadroAvisos categorie="outro" /> })
    expect(apres).not.toEqual(avant)
    expect(avant.clicks[0].added).toContain('@selected=Manutenção')
    expect(apres.clicks[0].added).toContain('@selected=Outro')
  })
})

describe('textesDistincts — lecture du relevé par la suite FR', () => {
  it('rend chaque chaîne de l’état initial et des apparitions une seule fois, sans les disparitions', () => {
    const r: CrawlResult = {
      initial: ['Certificado', 'Silva', 'Certificado'],
      clicks: [
        { path: '0:Filtrar', added: ['Certificado', 'Santos'], removed: ['Silva'] },
        { path: '1:Limpar', added: [], removed: ['Certificado'] },
      ],
    }
    expect(textesDistincts([r])).toEqual(['Certificado', 'Silva', 'Santos'])
  })

  it('les états codés en chiffres ne sont jamais signalés comme portugais, même identiques au relevé PT', () => {
    const etats = ['@checked=1', '@checked=0', '@aria-selected=1', '@aria-expanded=0', '@aria-current=1']
    expect(residusPortugais(etats, new Set(etats))).toEqual([])
  })

  it('l’option choisie est contrôlée comme un texte (portugais détecté, une seule fois)', () => {
    expect(residusPortugais(['Manutenção', '@selected=Manutenção', 'Manutenção', 'Maintenance'])).toEqual([
      '@selected=Manutenção',
      'Manutenção',
    ])
  })
})
