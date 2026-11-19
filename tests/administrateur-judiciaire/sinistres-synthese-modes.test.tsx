import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ComponentType } from 'react'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

/**
 * Synthèse de la fiche sinistre : même affichage en démonstration et en données réelles. Le mode est lu au chargement
 * des modules : il est posé dans le stockage, puis les modules sont rechargés (comme sinistres-ecran-reel). La même
 * fiche fictive (TL.00009 du jeu de démonstration, déclarée dans le repère) est ouverte par « Détails » dans les deux
 * modes ; la synthèse doit être identique. Seul l'enregistrement diffère (simulé en démonstration), hors synthèse.
 */

vi.mock('next/dynamic', () => ({
  default: () =>
    function EcranFactice() {
      return null
    },
}))

const CLE_STOCKAGE_MODE = 'vitfix.aj.mode'
const NUMERO = 'TL.00009'

afterEach(() => cleanup())

afterAll(() => {
  localStorage.removeItem(CLE_STOCKAGE_MODE)
})

/** Modules rechargés dans le mode demandé. */
async function chargerModules(mode: 'demo' | 'reel') {
  if (mode === 'reel') localStorage.setItem(CLE_STOCKAGE_MODE, 'reel')
  else localStorage.removeItem(CLE_STOCKAGE_MODE)
  vi.resetModules()
  const { MODE_ACTIF } = await import('@/lib/administrateur-judiciaire/mode')
  expect(MODE_ACTIF).toBe(mode)
  const { SinistresModule } = await import('@/components/administrateur-judiciaire/modules/technique/SinistresModule')
  return {
    SinistresModule: SinistresModule as ComponentType,
    ...(await import('@/components/administrateur-judiciaire/ui/toast')),
    ...(await import('@/lib/administrateur-judiciaire/db/donnees-store')),
    ...(await import('@/lib/administrateur-judiciaire/db/reset')),
    ...(await import('@/lib/administrateur-judiciaire/db/seed-demo')),
    ...(await import('@/lib/administrateur-judiciaire/db/schema')),
    ...(await import('@/components/administrateur-judiciaire/data/sinistres')),
  }
}

type Modules = Awaited<ReturnType<typeof chargerModules>>

/** Base du mode : jeu de démonstration, ou base vide avec une copropriété fictive et la même fiche, écrite telle quelle. */
async function preparerBase(mode: 'demo' | 'reel', modules: Modules) {
  const { viderBaseLocale, useDonneesStore, initialiserBaseDemo, ajDb, DEMO_SINISTRES } = modules
  await viderBaseLocale()
  useDonneesStore.setState({ loaded: false, loading: false, erreur: null, coproprietes: [], mandats: [], sinistres: [] })
  if (mode === 'demo') {
    await initialiserBaseDemo()
    await useDonneesStore.getState().loadAll()
    return
  }
  await useDonneesStore.getState().loadAll()
  const copro = await useDonneesStore.getState().createCopropriete({
    nom: 'Résidence des Acacias',
    adresse: '1 rue de l’Exemple, 75000 Paris',
    nbLots: 10,
    rg: '26/00001',
    fondement: 'art. 46 — carence',
  })
  const demo = DEMO_SINISTRES.find((sinistre) => sinistre.numero === NUMERO)
  await ajDb.sinistres.add({
    ...demo,
    id: 'sin-fictif',
    coproprieteId: copro.id,
    mandatId: null,
    createdAt: '2026-11-01T08:00:00.000Z',
    updatedAt: '2026-11-01T08:00:00.000Z',
    createdBy: null,
    updatedBy: null,
  } as never)
  useDonneesStore.setState({ loaded: false })
  await useDonneesStore.getState().loadAll()
}

/** Texte de la synthèse de la fiche NUMERO, ouverte par « Détails ». */
async function syntheseDuMode(mode: 'demo' | 'reel'): Promise<string> {
  const modules = await chargerModules(mode)
  await preparerBase(mode, modules)
  const { SinistresModule, ToastContext } = modules
  await act(async () => {
    render(
      <ToastContext.Provider value={{ push: vi.fn(() => undefined), dismiss: vi.fn() }}>
        <SinistresModule />
      </ToastContext.Provider>,
    )
  })
  const ligne = screen
    .queryAllByRole('row')
    .slice(1)
    .find((candidate) => candidate.textContent?.includes(NUMERO))
  expect(ligne).toBeDefined()
  fireEvent.click(within(ligne as HTMLElement).getByRole('button', { name: 'Détails' }))
  const texte = within(screen.getByRole('dialog')).getByRole('region', { name: 'Synthèse' }).textContent ?? ''
  cleanup()
  return texte
}

describe('Synthèse — démonstration et données réelles', () => {
  it('même fiche, même synthèse dans les deux modes', async () => {
    const demo = await syntheseDuMode('demo')
    const reel = await syntheseDuMode('reel')
    expect(demo).toContain('Déclaration du 14/04/2026, dans le repère indicatif')
    expect(demo).toContain('Phase Gestéam : Mission d\'expertise · Statut : En cours')
    expect(reel).toBe(demo)
  })
})
