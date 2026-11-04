import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { CHAMP_COPROPRIETE } from '@/components/administrateur-judiciaire/data/elements-communs'
import {
  MENTION_TOUS_MANDATS,
  avecChampCopro,
  champCoproprieteChoisie,
  optionsAvecNom,
  sousTitreFige,
  titreListeVide,
  useCoproChoisie,
  useNomCoproSuivi,
} from '@/components/administrateur-judiciaire/ui/copro-choisie'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Copropriété choisie dans le sélecteur du haut de page, telle que la lisent les écrans filtrés par copropriété : un
 * seul hook (code et nom, null sans choix ; code d'un nom), un seul préremplissage du champ « Copropriété » (nom
 * ajouté aux options s'il y manque : copropriété de la base absente de la liste de démonstration) et un seul
 * sélecteur local relié à la sélection (Budget, Rapport mensuel, Rédaction de PV, Messages, agents IA).
 */

beforeAll(async () => {
  localStorage.removeItem(CLE_STOCKAGE_MODE)
  await viderBaseLocale()
  await initialiserBaseDemo()
  useDonneesStore.setState({ loading: false })
  await useDonneesStore.getState().loadAll()
})

beforeEach(() => {
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
})

afterEach(() => {
  cleanup()
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
})

const choisir = (code: string | null) => act(() => useSelectionDossier.getState().choisirCopro(code))

describe('optionsAvecNom', () => {
  const OPTIONS = ['Le Clos des Vignes', 'Villa Montaigne'] as const

  it('les options telles quelles quand le nom y figure ou manque (null, vide)', () => {
    expect(optionsAvecNom(OPTIONS, 'Villa Montaigne')).toBe(OPTIONS)
    expect(optionsAvecNom(OPTIONS, null)).toBe(OPTIONS)
    expect(optionsAvecNom(OPTIONS, '')).toBe(OPTIONS)
  })

  it('un nom absent (copropriété de la base) est ajouté en tête, sans modifier la liste d’origine', () => {
    expect(optionsAvecNom(OPTIONS, 'Résidence Soleil')).toEqual(['Résidence Soleil', ...OPTIONS])
    expect(OPTIONS).toEqual(['Le Clos des Vignes', 'Villa Montaigne'])
  })
})

describe('champCoproprieteChoisie — seul préremplissage du champ « Copropriété »', () => {
  it('sans copropriété choisie (null, undefined ou vide) : le champ, tel quel', () => {
    expect(champCoproprieteChoisie(null)).toBe(CHAMP_COPROPRIETE)
    expect(champCoproprieteChoisie('')).toBe(CHAMP_COPROPRIETE)
    const champ = { label: 'Copropriété', type: 'select', options: ['A'] }
    expect(champCoproprieteChoisie(undefined, champ)).toBe(champ)
  })

  it('copie préremplie avec le nom choisi ; la constante partagée reste intacte', () => {
    const champ = champCoproprieteChoisie('Le Clos des Vignes')
    expect(champ).not.toBe(CHAMP_COPROPRIETE)
    expect(champ.value).toBe('Le Clos des Vignes')
    expect(champ.options).toEqual(CHAMP_COPROPRIETE.options)
    expect(champ.label).toBe('Copropriété')
    expect(CHAMP_COPROPRIETE.value).toBeUndefined()
  })

  it('copropriété de la base absente des options : son nom est ajouté en tête, la valeur a donc son option', () => {
    const champ = champCoproprieteChoisie('Résidence Soleil')
    expect(champ.value).toBe('Résidence Soleil')
    expect(champ.options).toEqual(['Résidence Soleil', ...(CHAMP_COPROPRIETE.options ?? [])])
  })

  it('accepte un champ de FormModal (liste de choix propre à l’écran), sans le modifier', () => {
    const origine = { label: 'Copropriété', type: 'select', options: ['A', 'B'] }
    expect(champCoproprieteChoisie('Villa Montaigne', origine)).toEqual({
      label: 'Copropriété',
      type: 'select',
      options: ['Villa Montaigne', 'A', 'B'],
      value: 'Villa Montaigne',
    })
    expect(origine).toEqual({ label: 'Copropriété', type: 'select', options: ['A', 'B'] })
  })
})

describe('avecChampCopro', () => {
  const CHAMPS = [{ label: 'Objet' }] as const

  it('sans copropriété choisie : les champs tels quels', () => {
    expect(avecChampCopro(CHAMPS, null)).toBe(CHAMPS)
  })

  it('copropriété choisie : le champ « Copropriété » prérempli en tête, son nom parmi les options', () => {
    const champs = avecChampCopro(CHAMPS, 'Résidence Soleil')
    expect(champs).toHaveLength(2)
    expect(champs[0]).toMatchObject({ label: 'Copropriété', value: 'Résidence Soleil' })
    expect(champs[0].options).toContain('Résidence Soleil')
    expect(champs[1]).toBe(CHAMPS[0])
  })
})

describe('sousTitreFige — indicateur figé de la démonstration', () => {
  it('sans copropriété choisie : le sous-titre tel quel', () => {
    expect(sousTitreFige(null, 'délai moyen 3,1 j')).toBe('délai moyen 3,1 j')
    expect(sousTitreFige(null)).toBeUndefined()
  })

  it('copropriété choisie : « Tous les mandats » en tête (ou la mention donnée)', () => {
    expect(sousTitreFige('VM', 'délai moyen 3,1 j')).toBe('Tous les mandats · délai moyen 3,1 j')
    expect(sousTitreFige('VM')).toBe(MENTION_TOUS_MANDATS)
    expect(sousTitreFige('VM', undefined, 'Diagnostic de démonstration')).toBe('Diagnostic de démonstration')
  })
})

describe('titreListeVide', () => {
  it('nomme la copropriété choisie ; « cette copropriété » sans nom', () => {
    expect(titreListeVide('Aucun sondage', 'Villa Montaigne')).toBe('Aucun sondage pour Villa Montaigne')
    expect(titreListeVide('Aucune doléance', null)).toBe('Aucune doléance pour cette copropriété')
  })
})

describe('useCoproChoisie — seul hook « copropriété choisie »', () => {
  it('code et nom null sans choix, puis suit chaque choix sans remontage', () => {
    const { result } = renderHook(() => useCoproChoisie())
    expect(result.current).toMatchObject({ code: null, nom: null })
    choisir('TL')
    expect(result.current).toMatchObject({ code: 'TL', nom: 'Copropriété Les Tilleuls' })
    choisir('LM')
    expect(result.current).toMatchObject({ code: 'LM', nom: 'Résidence Le Méridien' })
  })

  it('codeDeNom : nom long ou court, libellé composé ; null pour un nom inconnu', () => {
    const { result } = renderHook(() => useCoproChoisie())
    expect(result.current.codeDeNom('Les Tilleuls')).toBe('TL')
    expect(result.current.codeDeNom('Le Méridien · lot 12')).toBe('LM')
    expect(result.current.codeDeNom('SCI Belvédère')).toBeNull()
  })
})

describe('useNomCoproSuivi — sélecteur local relié au sélecteur du haut de page', () => {
  it('sans choix global : état local, sans rien écrire dans la sélection', () => {
    const { result } = renderHook(() => useNomCoproSuivi('Résidence Le Méridien'))
    expect(result.current[0]).toBe('Résidence Le Méridien')
    act(() => result.current[1]('Villa Montaigne'))
    expect(result.current[0]).toBe('Villa Montaigne')
    expect(useSelectionDossier.getState().code).toBeNull()
  })

  it('suit le choix global, et le changer choisit la copropriété partout', () => {
    useSelectionDossier.setState({ code: 'TL' })
    const { result } = renderHook(() => useNomCoproSuivi('Résidence Le Méridien'))
    expect(result.current[0]).toBe('Copropriété Les Tilleuls')
    act(() => result.current[1]('Le Clos des Vignes'))
    expect(useSelectionDossier.getState().code).toBe('CV')
    expect(result.current[0]).toBe('Le Clos des Vignes')
    choisir('VM')
    expect(result.current[0]).toBe('Villa Montaigne')
  })

  it('copropriété créée dans la base et choisie : son nom, pas la première copropriété de démonstration', async () => {
    let code = ''
    await act(async () => {
      const copro = await useDonneesStore.getState().createCopropriete({
        nom: 'Résidence Soleil',
        adresse: '1 rue du Soleil',
        nbLots: 10,
        rg: '26/01111',
        fondement: 'sj',
      })
      code = copro.code
    })
    useSelectionDossier.setState({ code })
    const { result } = renderHook(() => useNomCoproSuivi('Résidence Le Méridien'))
    expect(result.current[0]).toBe('Résidence Soleil')
  })
})
