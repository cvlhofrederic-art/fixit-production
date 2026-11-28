import './fuseau-paris'
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TresorerieModule } from '@/components/administrateur-judiciaire/modules/finances/TresorerieModule'
import { ToastContext, type ToastApi } from '@/components/administrateur-judiciaire/ui/toast'
import { enregistrerCompteBancaire } from '@/lib/administrateur-judiciaire/db/comptes-bancaires'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { cloturerArreteCompte, decloturerArreteCompte, ouvrirArreteCompte } from '@/lib/administrateur-judiciaire/db/rapprochements'
import { importerReleveSurCompte } from '@/lib/administrateur-judiciaire/db/releves-bancaires'
import { listerRelevesImportes } from '@/lib/administrateur-judiciaire/db/releves-importes'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { ajDb } from '@/lib/administrateur-judiciaire/db/schema'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { compteBanque, soldeCompteCentimes } from '@/lib/administrateur-judiciaire/db/sous-comptes-banque'
import { lireReleve } from '@/lib/administrateur-judiciaire/domain/import/lecture-releve'
import type { ReleveRepris } from '@/lib/administrateur-judiciaire/domain/import/releves-importes'
import type { ArreteRapprochement } from '@/lib/administrateur-judiciaire/domain/rapprochement-bancaire'
import { CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Relevés importés gardés (décision du 26/11/2026, PR 799, points 10 B et 11 B) ET période arrêtée protégée (décision
 * du 26/11/2026, rb-04 A), ensemble : les deux règles tiennent dans la même transaction d'écriture et sur le même écran.
 * - Un relevé CFONB 120 ou camt.053 dont une ligne tombe dans la période arrêtée est refusé en entier : aucune ligne, et
 *   aucun relevé gardé (sinon il serait dit « déjà importé » après la déclôture, sans ses lignes).
 * - Un fichier qui porte un relevé déjà importé et un relevé nouveau dans la période arrêtée : les deux bandeaux, le
 *   bouton inactif ; après la déclôture, le relevé nouveau s'importe et est gardé à son tour.
 * - Un relevé nouveau sans ligne à écrire n'entre dans le solde d'aucune période : il s'enregistre, arrêté clôturé ou non.
 * Base de démonstration (Le Clos des Vignes, C2), fichiers fictifs.
 */

const dossier = join(__dirname, 'fixtures', 'releves')
const CFONB = readFileSync(join(dossier, 'releve-nominal.cfonb120.txt'), 'latin1').replaceAll('\r\n', '\n')
/** Relevés du seul compte 12345 00010 00012345678 : du 30/09 au 05/10/2026 (4 mouvements), puis du 05/10 au 06/10/2026 (1). */
const CFONB_UN_COMPTE = CFONB.split('\n')
  .filter((ligne) => !ligne.includes('00087654321'))
  .join('\n')
const LIGNES_CFONB = CFONB_UN_COMPTE.split('\n')
const RELEVE_1 = LIGNES_CFONB.slice(0, LIGNES_CFONB.findIndex((ligne) => ligne.startsWith('07')) + 1)
/** Relevé suivant du même compte, du 05/10 au 06/10/2026, sans aucun mouvement : même solde aux deux bouts. */
const RELEVE_SANS_MOUVEMENT = [LIGNES_CFONB[RELEVE_1.length], LIGNES_CFONB[RELEVE_1.length].replace(/^01/, '07').replace('051026', '061026')]
// Jour de l'application après les mouvements d'octobre des fixtures : la règle commune de date d'arrêté (décision du
// 26/11/2026, rb-16 A) refuse un arrêté daté après ce jour, et la démonstration est figée au 04/06/2026.
vi.mock('@/lib/administrateur-judiciaire/mode', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/administrateur-judiciaire/mode')>()),
  AUJOURDHUI_ISO: '2026-10-10',
}))
// IBAN des fixtures : exemple déjà utilisé par lecture-releve.test.ts, aucun compte réel.
const IBAN_FIXTURE = 'FR76 1234 5000 1000 0123 4567 849'

const QUOI_FAIRE = 'Aucune ligne du relevé n’est importée : déclôturer d’abord cet arrêté, puis importer le relevé en entier.'

const entiers = (texte: string): ReleveRepris[] => lireReleve(texte).releves.map((releve) => ({ releve, repris: releve.mouvements }))
const lignesDe = (releves: readonly ReleveRepris[]) => releves.flatMap((releve) => releve.repris)
/** Importe le relevé en entier : les lignes écrites sont les mouvements mêmes des relevés à garder. */
function importerEnEntier(texte: string) {
  const releves = entiers(texte)
  return importerReleveSurCompte('C2', banqueId, lignesDe(releves), releves)
}
const lignesDuCompte = async () => (await ajDb.ecritures.toArray()).filter((ecriture) => ecriture.compte === compteBanque(banqueId))
const relevesTraces = () => ajDb.activityLog.where('entite').equals('relevesImportes').count()

let banqueId: string

/** Arrêté clôturé à cette date sur le compte, à l'équilibre : solde banque égal au solde compta du moment. */
async function cloturerAu(dateArrete: string): Promise<ArreteRapprochement> {
  const soldeBanqueCentimes = soldeCompteCentimes(await ajDb.ecritures.toArray(), compteBanque(banqueId), dateArrete) ?? 0
  const ouvert = await ouvrirArreteCompte(banqueId, { dateArrete, soldeBanqueCentimes })
  return cloturerArreteCompte(ouvert.id)
}

beforeEach(async () => {
  localStorage.removeItem(CLE_STOCKAGE_MODE)
  await viderBaseLocale()
  await initialiserBaseDemo()
  useDonneesStore.setState({ loaded: false, loading: false })
  await useDonneesStore.getState().loadAll()
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
  banqueId = (await enregistrerCompteBancaire('C2', { nature: 'courant', libelle: 'Compte principal', iban: IBAN_FIXTURE, bic: null, etablissement: null })).id
})

afterEach(() => cleanup())

describe('base locale : relevé structuré dans une période arrêtée', () => {
  it('une ligne datée au plus tard de l’arrêté clôturé : relevé refusé en entier, aucune ligne et aucun relevé gardé', async () => {
    await cloturerAu('2026-10-02')
    await expect(importerEnEntier(CFONB_UN_COMPTE)).rejects.toThrow(
      `Import refusé : 2 lignes sont datées au plus tard du 02/10/2026, date du dernier arrêté clôturé de ce compte. ${QUOI_FAIRE}`,
    )
    expect(await lignesDuCompte()).toHaveLength(0)
    expect(await listerRelevesImportes('C2')).toEqual([])
    expect(await relevesTraces()).toBe(0)
  })

  it('après la déclôture : le même relevé s’importe en entier et il est gardé (il n’avait pas été gardé par le refus)', async () => {
    const cloture = await cloturerAu('2026-10-02')
    await expect(importerEnEntier(CFONB_UN_COMPTE)).rejects.toThrow(/^Import refusé/)
    await decloturerArreteCompte(cloture.id)
    await importerEnEntier(CFONB_UN_COMPTE)
    expect(await lignesDuCompte()).toHaveLength(5)
    expect((await listerRelevesImportes('C2')).map((garde) => [garde.dateCloture, garde.nombreMouvementsRepris])).toEqual([
      ['2026-10-05', 4],
      ['2026-10-06', 1],
    ])
  })

  it('relevé déjà gardé, puis période arrêtée : le second import reste refusé, rien n’est écrit en double', async () => {
    await importerEnEntier(CFONB_UN_COMPTE)
    await cloturerAu('2026-10-06')
    await expect(importerEnEntier(CFONB_UN_COMPTE)).rejects.toThrow(/^Import refusé : 5 lignes sont datées au plus tard du 06\/10\/2026/)
    expect(await lignesDuCompte()).toHaveLength(5)
    expect(await listerRelevesImportes('C2')).toHaveLength(2)
  })

  it('arrêté illisible sur le compte : un relevé sans ligne à écrire n’est pas gardé non plus', async () => {
    await ajDb.rapprochements.add({
      id: 'arrete-externe',
      createdAt: '2026-11-01T08:00:00.000Z',
      updatedAt: '2026-11-01T08:00:00.000Z',
      createdBy: null,
      updatedBy: null,
      bancaireId: banqueId,
      dateArrete: '2026-05-31',
      soldeBanqueCentimes: 0,
      soldeComptaCentimes: 12.5,
      statut: 'Clôturé',
      elements: [],
    })
    await expect(importerEnEntier(RELEVE_SANS_MOUVEMENT.join('\n'))).rejects.toThrow(/^1 arrêté illisible sur ce compte/)
    expect(await listerRelevesImportes('C2')).toEqual([])
  })

  it('relevé sans ligne à écrire, arrêté clôturé sur le compte : gardé, aucune écriture n’entre dans la période', async () => {
    await importerEnEntier(RELEVE_1.join('\n'))
    await cloturerAu('2026-10-06')
    await importerEnEntier(RELEVE_SANS_MOUVEMENT.join('\n'))
    expect(await lignesDuCompte()).toHaveLength(4)
    expect((await listerRelevesImportes('C2')).map((garde) => [garde.dateCloture, garde.nombreMouvements])).toEqual([
      ['2026-10-05', 4],
      ['2026-10-06', 0],
    ])
  })
})

describe('écran : relevé déjà importé et période arrêtée, ensemble', () => {
  const patienter = () =>
    act(async () => {
      await new Promise((resoudre) => setTimeout(resoudre, 30))
    })

  let pushCourant: ReturnType<typeof vi.fn<ToastApi['push']>>

  async function rendre() {
    pushCourant = vi.fn<ToastApi['push']>(() => undefined)
    await act(async () => {
      render(
        <ToastContext.Provider value={{ push: pushCourant, dismiss: vi.fn() }}>
          <TresorerieModule />
        </ToastContext.Provider>,
      )
    })
    await patienter()
    await waitFor(() => expect(screen.queryByText('Chargement…')).toBeNull())
  }

  const panneauImport = () => screen.getByRole('heading', { level: 3, name: 'Importer un relevé' }).closest('.panel') as HTMLElement
  const dansImport = () => within(panneauImport())
  const panneauRapprochement = () => screen.getByRole('heading', { level: 3, name: /^Rapprochement/ }).closest('.panel') as HTMLElement
  const boutonImporter = () => dansImport().getByRole('button', { name: /^Importer \d+ ligne/ }) as HTMLButtonElement
  const alertes = () => Array.from(panneauImport().querySelectorAll('.alert')) as HTMLElement[]
  const titresAlertes = () => alertes().map((alerte) => alerte.querySelector('b')?.textContent ?? '')
  const alerte = (titre: string) => alertes().find((candidate) => candidate.querySelector('b')?.textContent === titre)
  const etatsRelevesLus = () =>
    within(dansImport().getByRole('table', { name: 'Relevés lus' }))
      .getAllByRole('row')
      .slice(1)
      .map((ligne) => within(ligne).getAllByRole('cell').at(-1)?.textContent)
  const annonce = () => panneauImport().querySelector('.sr-only[aria-live="polite"]')?.textContent
  const dernierToast = () => pushCourant.mock.calls.at(-1)?.[0]

  function analyser(texte: string) {
    fireEvent.change(dansImport().getByLabelText('Relevé bancaire'), { target: { value: texte } })
    fireEvent.click(dansImport().getByRole('button', { name: /Analyser/ }))
  }

  /** Clique et attend le toast qui confirme ou refuse l'écriture, puis la relecture. */
  async function cliquerEtAttendre(bouton: HTMLElement) {
    const avant = pushCourant.mock.calls.length
    await act(async () => {
      fireEvent.click(bouton)
    })
    await waitFor(() => expect(pushCourant.mock.calls.length).toBeGreaterThan(avant))
    await patienter()
  }

  it('fichier d’un relevé déjà importé et d’un relevé nouveau dans la période arrêtée : les deux bandeaux, bouton inactif ; après la déclôture, le nouveau s’importe et il est gardé', async () => {
    await importerEnEntier(RELEVE_1.join('\n'))
    await cloturerAu('2026-10-06')
    await rendre()
    analyser(CFONB_UN_COMPTE)
    const motif = `1 ligne est datée au plus tard du 06/10/2026, date du dernier arrêté clôturé de ce compte. ${QUOI_FAIRE}`
    expect([...titresAlertes()].sort((a, b) => a.localeCompare(b))).toEqual(['Import bloqué', 'Relevé déjà importé'])
    expect(alerte('Relevé déjà importé')?.textContent).toContain(
      'Relevé 1 (RIB 12345 00010 00012345678 clé 49, du 30/09/2026 au 05/10/2026) : déjà importé sur ce compte le 10/10/2026, ses 4 mouvements ne sont pas repris.',
    )
    expect(alerte('Import bloqué')?.querySelector('p')?.textContent).toBe(motif)
    expect(etatsRelevesLus()).toEqual(['Déjà importé', 'Contrôlé'])
    expect(boutonImporter()).toHaveTextContent('Importer 1 ligne')
    expect(boutonImporter()).toBeDisabled()
    expect(annonce()).toBe(
      `Relevé analysé (CFONB 120) : 1 ligne retenue. Relevé déjà importé : ses mouvements ne sont pas repris. Import bloqué : ${motif}`,
    )

    await cliquerEtAttendre(within(panneauRapprochement()).getByRole('button', { name: 'Déclôturer l’arrêté du 06/10/2026' }))
    expect(dernierToast()).toMatchObject({ kind: 'success', title: 'Arrêté déclôturé' })
    await waitFor(() => expect(alerte('Import bloqué')).toBeUndefined())
    expect(titresAlertes()).toEqual(['Relevé déjà importé'])
    expect(boutonImporter()).toBeEnabled()

    await cliquerEtAttendre(boutonImporter())
    expect(dernierToast()).toMatchObject({ kind: 'success', title: 'Relevé importé' })
    expect(await lignesDuCompte()).toHaveLength(5)
    expect((await listerRelevesImportes('C2')).map((garde) => garde.dateCloture)).toEqual(['2026-10-05', '2026-10-06'])
  })

  it('arrêté clôturé ailleurs après l’analyse d’un relevé structuré : la base refuse, aucun relevé gardé ; analysé de nouveau, il n’est pas dit « déjà importé »', async () => {
    await rendre()
    analyser(CFONB_UN_COMPTE)
    expect(titresAlertes()).toEqual([])
    expect(boutonImporter()).toBeEnabled()
    // Écriture hors de l'écran : il ne relit pas les arrêtés.
    await cloturerAu('2026-10-02')
    await cliquerEtAttendre(boutonImporter())
    expect(dernierToast()).toMatchObject({
      kind: 'warn',
      title: 'Import impossible',
      desc: `Import refusé : 2 lignes sont datées au plus tard du 02/10/2026, date du dernier arrêté clôturé de ce compte. ${QUOI_FAIRE}`,
    })
    expect(await lignesDuCompte()).toHaveLength(0)
    expect(await listerRelevesImportes('C2')).toEqual([])
    // Le refus fait relire les arrêtés : le blocage est montré, et rien d'autre.
    await waitFor(() => expect(alerte('Import bloqué')).toBeDefined())
    analyser(CFONB_UN_COMPTE)
    expect(titresAlertes()).toEqual(['Import bloqué'])
    expect(etatsRelevesLus()).toEqual(['Contrôlé', 'Contrôlé'])
    expect(boutonImporter()).toHaveTextContent('Importer 5 lignes')
    expect(boutonImporter()).toBeDisabled()
  })

  it('relevé nouveau sans ligne à écrire, arrêté clôturé sur le compte : aucun blocage, « Enregistrer le relevé » reste actif', async () => {
    await importerEnEntier(RELEVE_1.join('\n'))
    await cloturerAu('2026-10-06')
    await rendre()
    analyser([...RELEVE_1, ...RELEVE_SANS_MOUVEMENT].join('\n'))
    expect(titresAlertes()).toEqual(['Relevé déjà importé'])
    const bouton = dansImport().getByRole('button', { name: 'Enregistrer le relevé' })
    expect(bouton).toBeEnabled()
    await cliquerEtAttendre(bouton)
    expect(dernierToast()).toMatchObject({ kind: 'success', title: 'Relevé enregistré' })
    expect(await lignesDuCompte()).toHaveLength(4)
    expect(await listerRelevesImportes('C2')).toHaveLength(2)
  })
})
