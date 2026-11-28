import './fuseau-paris'
import 'fake-indexeddb/auto'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { enregistrerCompteBancaire } from '@/lib/administrateur-judiciaire/db/comptes-bancaires'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { ouvrirArreteCompte } from '@/lib/administrateur-judiciaire/db/rapprochements'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { useArretesRapprochement } from '@/lib/administrateur-judiciaire/db/use-arretes'
import { CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'

/**
 * Lecture des arrêtés d'un compte (PR 867, relecture) : le journal d'activité ne sert qu'au texte de la confirmation
 * d'abandon. S'il est illisible, les arrêtés déjà lus restent affichés, la confirmation garde son texte habituel et
 * l'échec est signalé une fois par `signalerErreur`.
 */
const { journalIllisible } = vi.hoisted(() => ({ journalIllisible: { actif: false } }))

vi.mock('@/lib/administrateur-judiciaire/db/rapprochements', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/administrateur-judiciaire/db/rapprochements')>()
  return {
    ...original,
    arreteDejaCloture: (...args: Parameters<typeof original.arreteDejaCloture>) =>
      journalIllisible.actif ? Promise.reject(new Error('Journal illisible (test).')) : original.arreteDejaCloture(...args),
  }
})

// IBAN de test publié, aucun compte réel.
const IBAN_A = 'FR76 3000 6000 0112 3456 7890 189'

let banqueId: string

beforeEach(async () => {
  journalIllisible.actif = false
  localStorage.removeItem(CLE_STOCKAGE_MODE)
  await viderBaseLocale()
  await initialiserBaseDemo()
  useDonneesStore.setState({ loaded: false, loading: false })
  await useDonneesStore.getState().loadAll()
  banqueId = (await enregistrerCompteBancaire('C2', { nature: 'courant', libelle: 'Compte principal', iban: IBAN_A, bic: null, etablissement: null })).id
  await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 40_000 })
})

describe('useArretesRapprochement, journal d’activité illisible', () => {
  it('garde les arrêtés lus, la confirmation habituelle, et signale l’échec une fois', async () => {
    journalIllisible.actif = true
    const signaler = vi.fn<(message: string) => void>()
    const { result } = renderHook(() => useArretesRapprochement(banqueId, signaler))
    await waitFor(() => expect(signaler).toHaveBeenCalledTimes(1))
    expect(signaler).toHaveBeenCalledWith('Journal illisible (test).')
    expect(result.current.erreur).toBeNull()
    expect(result.current.chargement).toBe(false)
    expect(result.current.arretes.map((arrete) => arrete.statut)).toEqual(['En cours'])
    expect(result.current.enCoursDejaCloture).toBe(false)
  })
})
