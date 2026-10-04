import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FixyOrdonnance } from '@/components/administrateur-judiciaire/modules/agents-ia/fixy/FixyOrdonnance'
import { useDicteeVocale } from '@/components/administrateur-judiciaire/modules/agents-ia/fixy/useDicteeVocale'
import type { Fixy } from '@/components/administrateur-judiciaire/modules/agents-ia/fixy/useFixy'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { ajDb } from '@/lib/administrateur-judiciaire/db/schema'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import {
  formaterDatesCoproVue,
  fusionnerCoproMandat,
  type CoproprieteVue,
} from '@/lib/administrateur-judiciaire/domain/coproprietes'
import { analyserTexteOrdonnance } from '@/lib/administrateur-judiciaire/domain/fixy/lecture-ordonnance'
import { CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'

/**
 * Régressions des défauts hérités de la maquette dans les écrans de Fixy :
 * 15) FixyOrdonnance : une ordonnance datée de 9999 créait un mandat échu en l'an 10000, date qui faisait ensuite
 *     lever le formatage des dates sur tous les écrans (application inutilisable, même après rechargement) ;
 * 16) FixyOrdonnance : un double clic sur « Créer le mandat avec cette source » créait deux copropriétés, deux
 *     mandats et deux documents source sous le même code ;
 * 17) useDicteeVocale : la fin d'une dictée arrêtée remettait `ecoute` à false pendant la dictée suivante, et rien
 *     n'était arrêté au démontage.
 */

const etat = () => useDonneesStore.getState()

/** Base vidée, mode démo, jeu de démonstration inséré, store rechargé. */
async function reinitialiser(): Promise<void> {
  localStorage.removeItem(CLE_STOCKAGE_MODE)
  await viderBaseLocale()
  await initialiserBaseDemo()
  useDonneesStore.setState({ loading: false })
  await etat().loadAll()
}

/** Laisse s'écouler un délai réel (fake-indexeddb planifie ses requêtes hors des microtâches). */
const patienter = (ms: number) => new Promise((resoudre) => setTimeout(resoudre, ms))

/** Texte de l'ordonnance d'exemple de l'écran, avec une autre date (JJ/MM/AAAA) et une autre durée. */
const ordonnance = (date: string, dureeMois = 12) =>
  `TRIBUNAL JUDICIAIRE DE NANTERRE. Ordonnance sur requête rendue le ${date}, RG : 26/01234. Vu l'article 46 du décret du 17 mars 1967 ; Nous désignons le Cabinet Delaunay en qualité de syndic judiciaire de la copropriété Résidence du Parc, sise 14 avenue des Tilleuls, 92100 Boulogne-Billancourt, 36 lots, pour une durée de ${dureeMois} mois. Motif : carence de l'assemblée générale dans la désignation d'un syndic.`

/** Fixy réduit à ce que lit FixyOrdonnance ; la création passe par la base locale réelle, sauf remplacement. */
function fixyDeTest(createCopropriete: Fixy['p']['createCopropriete'] = (saisie) => etat().createCopropriete(saisie)) {
  const push = vi.fn<Fixy['push']>()
  const fixy = {
    p: { createCopropriete },
    push,
    lireOrdonnance: analyserTexteOrdonnance,
    executer: vi.fn(),
  } as unknown as Fixy
  return { fixy, push }
}

/** Saisit le texte, lance la lecture et renvoie le bouton de création. */
function lireOrdonnance(texte: string): HTMLButtonElement {
  fireEvent.change(screen.getByLabelText("Texte de l'ordonnance"), { target: { value: texte } })
  fireEvent.click(screen.getByRole('button', { name: "Lire l'ordonnance" }))
  return screen.getByRole('button', { name: 'Créer le mandat avec cette source' }) as HTMLButtonElement
}

/** Enregistrements « Résidence du Parc » en base (copropriétés, mandats, documents source). */
async function enregistrementsResidenceDuParc() {
  const copros = (await ajDb.coproprietes.toArray()).filter((copro) => copro.nom === 'Résidence du Parc'),
    ids = new Set(copros.map((copro) => copro.id)),
    mandats = (await ajDb.mandats.toArray()).filter((mandat) => ids.has(mandat.coproprieteId)),
    idsMandats = new Set(mandats.map((mandat) => mandat.id)),
    documents = (await ajDb.documents.toArray()).filter((document) => idsMandats.has(document.entiteId))
  return { copros: copros.length, mandats: mandats.length, documents: documents.length }
}

/** Vues copropriété formatées comme dans useCoproprietesAffichees (lève si une date n'est pas affichable). */
function formaterToutesLesCopros() {
  const mandatsParCopro = new Map(etat().mandats.map((mandat) => [mandat.coproprieteId, mandat]))
  return etat()
    .coproprietes.map((copro) => fusionnerCoproMandat(copro, mandatsParCopro.get(copro.id)))
    .map(formaterDatesCoproVue)
}

describe('FixyOrdonnance — ordonnance datée de 9999 (constat 15)', () => {
  beforeEach(async () => {
    await reinitialiser()
  })

  it("refuse l'ordonnance dont l'échéance tomberait en l'an 10000, sans rien écrire en base", async () => {
    const { fixy, push } = fixyDeTest(),
      avant = await ajDb.coproprietes.count()
    render(<FixyOrdonnance fixy={fixy} />)
    const bouton = lireOrdonnance(ordonnance('12/03/9999'))
    // La lecture reste complète et le bouton actif, comme dans la maquette.
    expect(screen.queryByText('12/03/9999')).not.toBeNull()
    expect(bouton.disabled).toBe(false)
    fireEvent.click(bouton)
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1))
    // Chemin d'erreur existant : toast « Création impossible » avec le message du domaine.
    expect(push).toHaveBeenCalledWith({
      kind: 'warn',
      title: 'Création impossible',
      desc: 'Date ISO invalide : « 10000-03-12 »',
    })
    await patienter(50)
    expect(await ajDb.coproprietes.count()).toBe(avant)
    expect(await enregistrementsResidenceDuParc()).toEqual({ copros: 0, mandats: 0, documents: 0 })
    // Le bouton reste affiché (aucun mandat créé) et les écrans formatent toujours les dates, y compris après rechargement.
    expect(screen.getByRole('button', { name: 'Créer le mandat avec cette source' })).toBe(bouton)
    expect(() => formaterToutesLesCopros()).not.toThrow()
    await etat().loadAll()
    expect(() => formaterToutesLesCopros()).not.toThrow()
  })

  it("refuse aussi une date de 9999 que la durée fait passer en l'an 10000 (31/12/9999, 1 mois)", async () => {
    const { fixy, push } = fixyDeTest()
    render(<FixyOrdonnance fixy={fixy} />)
    fireEvent.click(lireOrdonnance(ordonnance('31/12/9999', 1)))
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1))
    expect(push).toHaveBeenCalledWith({
      kind: 'warn',
      title: 'Création impossible',
      desc: 'Date ISO invalide : « 10000-01-31 »',
    })
    expect(await enregistrementsResidenceDuParc()).toEqual({ copros: 0, mandats: 0, documents: 0 })
  })

  it("accepte, comme la maquette, une ordonnance de 9999 dont l'échéance reste en 9999", async () => {
    const { fixy, push } = fixyDeTest()
    render(<FixyOrdonnance fixy={fixy} />)
    fireEvent.click(lireOrdonnance(ordonnance('12/01/9999', 11)))
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1))
    expect(push).toHaveBeenCalledWith({
      kind: 'success',
      title: 'Mandat créé',
      desc: 'Résidence du Parc · RP · source conservée.',
    })
    expect(await enregistrementsResidenceDuParc()).toEqual({ copros: 1, mandats: 1, documents: 1 })
    const vue = formaterToutesLesCopros().find((copro) => copro.nom === 'Résidence du Parc')
    expect(vue?.ordonnance).toBe('12/01/9999')
    expect(vue?.echeance).toBe('12/12/9999')
  })

  it("crée toujours le mandat de l'ordonnance d'exemple (parcours normal inchangé)", async () => {
    const { fixy, push } = fixyDeTest()
    render(<FixyOrdonnance fixy={fixy} />)
    fireEvent.click(screen.getByRole('button', { name: 'Exemple' }))
    fireEvent.click(screen.getByRole('button', { name: "Lire l'ordonnance" }))
    fireEvent.click(screen.getByRole('button', { name: 'Créer le mandat avec cette source' }))
    await screen.findByText('Mandat créé : Résidence du Parc (RP)')
    expect(push).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith({
      kind: 'success',
      title: 'Mandat créé',
      desc: 'Résidence du Parc · RP · source conservée.',
    })
    const vue = formaterToutesLesCopros().find((copro) => copro.nom === 'Résidence du Parc')
    expect(vue?.ordonnance).toBe('12/03/2026')
    expect(vue?.echeance).toBe('12/03/2027')
  })
})

describe('FixyOrdonnance — double clic sur « Créer le mandat avec cette source » (constat 16)', () => {
  beforeEach(async () => {
    await reinitialiser()
  })

  it('ne crée qu’une copropriété, un mandat et une source, sans désactiver le bouton pendant la création', async () => {
    const { fixy, push } = fixyDeTest()
    render(<FixyOrdonnance fixy={fixy} />)
    const bouton = lireOrdonnance(ordonnance('12/03/2026'))
    fireEvent.click(bouton)
    // Création en cours : le bouton est toujours là, inchangé (pas d'attribut disabled ajouté).
    expect(screen.getByRole('button', { name: 'Créer le mandat avec cette source' })).toBe(bouton)
    expect(bouton.disabled).toBe(false)
    expect(bouton.hasAttribute('disabled')).toBe(false)
    fireEvent.click(bouton)
    await screen.findByText('Mandat créé : Résidence du Parc (RP)')
    // Laisse le temps à une éventuelle seconde création de se terminer.
    await patienter(200)
    expect(await enregistrementsResidenceDuParc()).toEqual({ copros: 1, mandats: 1, documents: 1 })
    expect(etat().coproprietes.filter((copro) => copro.code === 'RP')).toHaveLength(1)
    expect(push).toHaveBeenCalledTimes(1)
  })

  it('libère le verrou après un échec : un nouveau clic relance la création', async () => {
    let appels = 0
    const creer = vi.fn<Fixy['p']['createCopropriete']>(async (saisie) => {
      appels += 1
      if (appels === 1) throw new Error('Base indisponible')
      return etat().createCopropriete(saisie)
    })
    const { fixy, push } = fixyDeTest(creer)
    render(<FixyOrdonnance fixy={fixy} />)
    const bouton = lireOrdonnance(ordonnance('12/03/2026'))
    fireEvent.click(bouton)
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith({ kind: 'warn', title: 'Création impossible', desc: 'Base indisponible' }),
    )
    fireEvent.click(bouton)
    await screen.findByText('Mandat créé : Résidence du Parc (RP)')
    expect(creer).toHaveBeenCalledTimes(2)
    expect(await enregistrementsResidenceDuParc()).toEqual({ copros: 1, mandats: 1, documents: 1 })
  })

  it('verrou limité à la création en cours : un second clic pendant un appel en attente est ignoré', async () => {
    let terminer: (vue: CoproprieteVue) => void = () => undefined
    const creer = vi.fn<Fixy['p']['createCopropriete']>(
      () =>
        new Promise<CoproprieteVue>((resoudre) => {
          terminer = resoudre
        }),
    )
    const { fixy, push } = fixyDeTest(creer)
    render(<FixyOrdonnance fixy={fixy} />)
    const bouton = lireOrdonnance(ordonnance('12/03/2026'))
    fireEvent.click(bouton)
    fireEvent.click(bouton)
    fireEvent.click(bouton)
    expect(creer).toHaveBeenCalledTimes(1)
    const vue = { nom: 'Résidence du Parc', code: 'RP' } as CoproprieteVue
    await act(async () => {
      terminer(vue)
    })
    expect(push).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Mandat créé : Résidence du Parc (RP)')).not.toBeNull()
  })
})

/** Reconnaissance vocale simulée : chaque instance créée est conservée pour déclencher ses événements. */
interface ResultatSimule {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}

class FausseReconnaissance {
  static instances: FausseReconnaissance[] = []
  lang = ''
  interimResults = true
  maxAlternatives = 0
  onresult: ((evenement: ResultatSimule) => void) | null = null
  onend: (() => void) | null = null
  onerror: (() => void) | null = null
  start = vi.fn()
  stop = vi.fn()
  constructor() {
    FausseReconnaissance.instances.push(this)
  }
}

const fenetreDictee = window as unknown as { SpeechRecognition?: unknown }
const resultat = (...transcriptions: string[]): ResultatSimule => ({
  results: transcriptions.map((transcript) => [{ transcript }]),
})

describe('useDicteeVocale — dictée remplacée et démontage (constat 17)', () => {
  beforeEach(() => {
    FausseReconnaissance.instances = []
    fenetreDictee.SpeechRecognition = FausseReconnaissance
  })

  afterEach(() => {
    delete fenetreDictee.SpeechRecognition
  })

  it("la fin tardive d'une dictée arrêtée ne remet pas `ecoute` à false pendant la dictée suivante", () => {
    const onTexte = vi.fn()
    const { result } = renderHook(() => useDicteeVocale(onTexte))
    act(() => result.current.basculer())
    const [premiere] = FausseReconnaissance.instances
    expect(result.current.ecoute).toBe(true)
    // Arrêter, puis Dicter aussitôt.
    act(() => result.current.basculer())
    expect(premiere.stop).toHaveBeenCalledTimes(1)
    expect(result.current.ecoute).toBe(false)
    act(() => result.current.basculer())
    const seconde = FausseReconnaissance.instances[1]
    expect(seconde.start).toHaveBeenCalledTimes(1)
    expect(result.current.ecoute).toBe(true)
    // La première dictée se termine après coup (onerror puis onend) : la seconde écoute toujours.
    act(() => premiere.onerror?.())
    act(() => premiere.onend?.())
    expect(result.current.ecoute).toBe(true)
    // Un clic arrête la seconde dictée au lieu d'en créer une troisième.
    act(() => result.current.basculer())
    expect(seconde.stop).toHaveBeenCalledTimes(1)
    expect(FausseReconnaissance.instances).toHaveLength(2)
    expect(result.current.ecoute).toBe(false)
  })

  it('arrête la dictée en cours et détache ses gestionnaires au démontage', () => {
    const onTexte = vi.fn()
    const { result, unmount } = renderHook(() => useDicteeVocale(onTexte))
    act(() => result.current.basculer())
    const [instance] = FausseReconnaissance.instances
    unmount()
    expect(instance.stop).toHaveBeenCalledTimes(1)
    expect(instance.onresult).toBeNull()
    expect(instance.onend).toBeNull()
    expect(instance.onerror).toBeNull()
    expect(onTexte).not.toHaveBeenCalled()
  })

  it('démontage sans erreur si stop() lève sur une dictée déjà terminée', () => {
    const { result, unmount } = renderHook(() => useDicteeVocale(vi.fn()))
    act(() => result.current.basculer())
    const [instance] = FausseReconnaissance.instances
    act(() => instance.onend?.())
    expect(result.current.ecoute).toBe(false)
    instance.stop.mockImplementation(() => {
      throw new Error('InvalidStateError')
    })
    expect(() => unmount()).not.toThrow()
    expect(instance.stop).toHaveBeenCalledTimes(1)
  })

  it('parcours normaux inchangés : résultats, fin, erreur, résultat final après Arrêter', () => {
    const onTexte = vi.fn()
    const { result, unmount } = renderHook(() => useDicteeVocale(onTexte))
    expect(result.current.disponible).toBe(true)
    act(() => result.current.basculer())
    const [premiere] = FausseReconnaissance.instances
    expect(premiere.lang).toBe('fr-FR')
    expect(premiere.interimResults).toBe(false)
    expect(premiere.maxAlternatives).toBe(1)
    act(() => premiere.onresult?.(resultat('solde de', 'Garnier')))
    expect(onTexte).toHaveBeenLastCalledWith('solde de Garnier')
    act(() => premiere.onend?.())
    expect(result.current.ecoute).toBe(false)
    // Erreur de la dictée en cours.
    act(() => result.current.basculer())
    const seconde = FausseReconnaissance.instances[1]
    expect(result.current.ecoute).toBe(true)
    act(() => seconde.onerror?.())
    expect(result.current.ecoute).toBe(false)
    // Arrêter : le résultat final qui arrive après stop() est toujours transmis.
    act(() => result.current.basculer())
    const troisieme = FausseReconnaissance.instances[2]
    act(() => result.current.basculer())
    expect(troisieme.stop).toHaveBeenCalledTimes(1)
    act(() => troisieme.onresult?.(resultat('échéances de Villa Montaigne')))
    act(() => troisieme.onend?.())
    expect(onTexte).toHaveBeenLastCalledWith('échéances de Villa Montaigne')
    expect(result.current.ecoute).toBe(false)
    unmount()
  })

  it('sans API de reconnaissance : indisponible, basculer sans effet, démontage sans erreur', () => {
    delete fenetreDictee.SpeechRecognition
    const { result, unmount } = renderHook(() => useDicteeVocale(vi.fn()))
    expect(result.current.disponible).toBe(false)
    act(() => result.current.basculer())
    expect(result.current.ecoute).toBe(false)
    expect(FausseReconnaissance.instances).toHaveLength(0)
    expect(() => unmount()).not.toThrow()
  })
})
