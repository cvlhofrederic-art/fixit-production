import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Fiche360CoproprieteModule } from '@/components/administrateur-judiciaire/modules/pilotage/Fiche360CoproprieteModule'
import { ToastContext } from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { enregistrerSinistre } from '@/lib/administrateur-judiciaire/db/sinistres'
import { ajouterJours } from '@/lib/administrateur-judiciaire/domain/dates'
import { saisieSinistreParDefaut } from '@/lib/administrateur-judiciaire/domain/fiche-sinistre'
import type { SaisieSinistre } from '@/lib/administrateur-judiciaire/domain/sinistres'
import { AUJOURDHUI_ISO, CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Fiche 360 d'une copropriété : panneau « Contrats et sinistres » lu dans la base. Un sinistre écrit par
 * enregistrerSinistre (écran Sinistres, données réelles) s'affiche « type · n° · statut », le statut lu sur « Clos le » ;
 * sans contrat ni sinistre, le panneau renvoie vers l'écran Sinistres.
 */

const survenance = ajouterJours(AUJOURDHUI_ISO, -10)

beforeEach(async () => {
  localStorage.removeItem(CLE_STOCKAGE_MODE)
  await viderBaseLocale()
  useDonneesStore.setState({ loaded: false, loading: false, erreur: null, coproprietes: [], mandats: [], sinistres: [] })
  await useDonneesStore.getState().loadAll()
  await useDonneesStore.getState().createCopropriete({
    nom: 'Résidence des Acacias',
    adresse: '1 rue de l’Exemple, 75000 Paris',
    nbLots: 10,
    rg: '26/00001',
    fondement: 'art. 46 — carence',
  })
  useSelectionDossier.setState({ code: useDonneesStore.getState().coproprietes[0].code, coproprietaireId: null })
})

afterEach(() => {
  cleanup()
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
})

async function rendre() {
  await act(async () => {
    render(
      <ToastContext.Provider value={{ push: vi.fn(() => undefined), dismiss: vi.fn() }}>
        <Fiche360CoproprieteModule />
      </ToastContext.Provider>,
    )
  })
}

const saisie = (surcharge: Partial<SaisieSinistre> = {}) =>
  saisieSinistreParDefaut({
    coproprieteId: useDonneesStore.getState().coproprietes[0].id,
    type: 'Dégât des eaux',
    dateSurvenance: survenance,
    numero: 'RA.00001',
    ...surcharge,
  })

/** Ligne « type · n° · statut » du panneau (élément qui commence par le type en gras). */
const ligneSinistre = (texte: string) =>
  screen.getByText((_, element) => element?.textContent === texte && element.firstElementChild?.tagName === 'B')

describe('fiche 360 — sinistres de la copropriété', () => {
  it('sans contrat ni sinistre : le panneau renvoie vers l’écran Sinistres', async () => {
    await rendre()
    expect(screen.getByText(/Aucun contrat ni sinistre enregistré/)).toBeInTheDocument()
    expect(screen.getByText(/les sinistres se déclarent dans l’écran Sinistres/)).toBeInTheDocument()
  })

  it('sinistre enregistré : « type · n° · statut », « Terminé » dès que « Clos le » est daté', async () => {
    const enregistre = await enregistrerSinistre(saisie(), { aujourdhui: AUJOURDHUI_ISO })
    await rendre()
    expect(ligneSinistre('Dégât des eaux · RA.00001 · En cours')).toBeInTheDocument()
    expect(screen.queryByText(/Aucun contrat ni sinistre enregistré/)).toBeNull()

    await act(async () => {
      await enregistrerSinistre(saisie({ dateCloture: AUJOURDHUI_ISO }), {
        id: enregistre.id,
        aujourdhui: AUJOURDHUI_ISO,
        statutSaisi: 'Terminé',
      })
    })
    expect(ligneSinistre('Dégât des eaux · RA.00001 · Terminé')).toBeInTheDocument()
  })

  it('sinistre sans numéro : « sans numéro »', async () => {
    await enregistrerSinistre(saisie({ numero: null, type: 'Vol' }), { aujourdhui: AUJOURDHUI_ISO })
    await rendre()
    expect(ligneSinistre('Vol · sans numéro · En cours')).toBeInTheDocument()
  })
})
