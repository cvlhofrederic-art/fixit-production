import './fuseau-paris'
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  analyserReleve,
  avecPeriodeArretee,
  BLOCAGE_ERREUR_FICHIER,
} from '@/components/administrateur-judiciaire/modules/finances/tresorerie/analyse-releve'
import { TresorerieModule } from '@/components/administrateur-judiciaire/modules/finances/TresorerieModule'
import { ToastContext, type ToastApi } from '@/components/administrateur-judiciaire/ui/toast'
import { enregistrerCompteBancaire } from '@/lib/administrateur-judiciaire/db/comptes-bancaires'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { cloturerArreteCompte, ouvrirArreteCompte } from '@/lib/administrateur-judiciaire/db/rapprochements'
import { importerReleveSurCompte } from '@/lib/administrateur-judiciaire/db/releves-bancaires'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { ajDb } from '@/lib/administrateur-judiciaire/db/schema'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import type { ArreteRapprochement } from '@/lib/administrateur-judiciaire/domain/rapprochement-bancaire'
import { CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Écran « Banque et recouvrement », période déjà arrêtée protégée (décision du 26/11/2026 du référent métier, PR 799,
 * rb-04 A) : après l'analyse, un relevé dont une ligne retenue est datée au plus tard du dernier arrêté clôturé du
 * compte est bloqué, dans le bandeau « Import bloqué » des autres motifs, avec ce qu'il faut faire ; le bouton d'import
 * est inactif. Les trois formats (CSV, CFONB 120, camt.053). Le blocage suit les arrêtés du compte : il apparaît à la
 * clôture et disparaît à la déclôture, sans nouvelle analyse. Un arrêté clôturé ailleurs (autre onglet) après la
 * lecture de l'écran : la base refuse l'import. Base de démonstration (Le Clos des Vignes, C2).
 */

const dossier = join(__dirname, 'fixtures', 'releves')
const CFONB = readFileSync(join(dossier, 'releve-nominal.cfonb120.txt'), 'latin1').replaceAll('\r\n', '\n')
const CAMT = readFileSync(join(dossier, 'releve-nominal.camt053.xml'), 'utf8')
// Mouvements du compte des fixtures : 01, 02, 03, 05 et 06/10/2026 (CFONB) ; 01, 02, 03 et 05/10/2026 (camt.053).
const CFONB_UN_COMPTE = CFONB.split('\n')
  .filter((ligne) => !ligne.includes('00087654321'))
  .join('\n')
const CAMT_UN_RELEVE = CAMT.slice(0, CAMT.lastIndexOf('<Stmt>')) + CAMT.slice(CAMT.lastIndexOf('</Stmt>') + '</Stmt>'.length)
// IBAN des fixtures : exemple déjà utilisé par lecture-releve.test.ts, aucun compte réel.
const IBAN_FIXTURE = 'FR76 1234 5000 1000 0123 4567 849'

const CSV_MAI_JUIN = 'Date;Libellé;Montant\n20/05/2026;PRLV EAU;-120,50\n31/05/2026;FRAIS TENUE;-12,00\n02/06/2026;VIR JUIN;99,00'

const QUOI_FAIRE = 'Aucune ligne du relevé n’est importée : déclôturer d’abord cet arrêté, puis importer le relevé en entier.'

const patienter = () =>
  act(async () => {
    await new Promise((resoudre) => setTimeout(resoudre, 30))
  })

let banqueId: string
let pushCourant: ReturnType<typeof vi.fn<ToastApi['push']>>

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
const bandeauBloque = () =>
  Array.from(panneauImport().querySelectorAll('.alert')).find((alerte) => alerte.querySelector('b')?.textContent === 'Import bloqué') ?? null
const dernierToast = () => pushCourant.mock.calls.at(-1)?.[0]
const ecrituresDuCompte = async () => (await ajDb.ecritures.toArray()).filter((ecriture) => ecriture.compte === `512-${banqueId}`)

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

/** Arrêté clôturé à cette date sur le compte (sans écriture antérieure : soldes à 0, à l'équilibre). */
async function cloturerAu(dateArrete: string): Promise<ArreteRapprochement> {
  const ouvert = await ouvrirArreteCompte(banqueId, { dateArrete, soldeBanqueCentimes: 0 })
  return cloturerArreteCompte(ouvert.id)
}

const arrete = (surcharge: Partial<ArreteRapprochement> = {}): ArreteRapprochement => ({
  id: 'A1',
  banqueId: 'B1',
  dateArrete: '2026-05-31',
  soldeBanqueCentimes: 0,
  soldeComptaCentimes: 0,
  statut: 'Clôturé',
  elements: [],
  ...surcharge,
})

describe('analyse : blocage de la période arrêtée', () => {
  const analyse = (texte: string, compte: { id: string; iban: string | null } | null = { id: 'B1', iban: IBAN_FIXTURE }) =>
    analyserReleve({ texte, compte, lignesBanque: [], personnes: [] })

  it('ligne retenue datée au plus tard de l’arrêté clôturé du compte : blocage, avec ce qu’il faut faire', () => {
    const resultat = avecPeriodeArretee(analyse(CSV_MAI_JUIN), [arrete()])
    expect(resultat.blocage).toBe(
      `Import bloqué : 2 lignes sont datées au plus tard du 31/05/2026, date du dernier arrêté clôturé de ce compte. ${QUOI_FAIRE}`,
    )
    expect(resultat.retenues).toHaveLength(3)
  })

  it('aucune ligne dans la période, arrêté en cours, arrêté d’un autre compte, aucun compte choisi : analyse inchangée', () => {
    const base = analyse(CSV_MAI_JUIN)
    expect(avecPeriodeArretee(base, [arrete({ dateArrete: '2026-05-19' })])).toBe(base)
    expect(avecPeriodeArretee(base, [arrete({ statut: 'En cours' })])).toBe(base)
    expect(avecPeriodeArretee(base, [arrete({ banqueId: 'B2' })])).toBe(base)
    expect(avecPeriodeArretee(base, [])).toBe(base)
    const sansCompte = analyse(CSV_MAI_JUIN, null)
    expect(avecPeriodeArretee(sansCompte, [arrete()])).toBe(sansCompte)
  })

  it('une ligne écartée comme doublon n’est pas comptée : seules les lignes retenues le sont', () => {
    const base = analyserReleve({
      texte: CSV_MAI_JUIN,
      compte: { id: 'B1', iban: IBAN_FIXTURE },
      lignesBanque: [{ compte: '512-B1', date: new Date(2026, 4, 20), libelle: 'PRLV EAU', montant: 120.5, sens: 'credit' }],
      personnes: [],
    })
    expect(base.doublons).toHaveLength(1)
    expect(avecPeriodeArretee(base, [arrete()]).blocage).toMatch(/^Import bloqué : 1 ligne est datée au plus tard du 31\/05\/2026/)
  })

  it('fichier déjà bloqué (erreur de lecture) : ce motif reste, avec ses erreurs', () => {
    const base = analyse(CFONB)
    expect(base.blocage).toBe(BLOCAGE_ERREUR_FICHIER)
    expect(avecPeriodeArretee(base, [arrete({ dateArrete: '2026-10-02' })])).toBe(base)
  })

  it('CFONB 120 et camt.053 : mêmes lignes retenues, même règle', () => {
    const cloture = [arrete({ dateArrete: '2026-10-02' })]
    expect(avecPeriodeArretee(analyse(CFONB_UN_COMPTE), cloture).blocage).toMatch(/^Import bloqué : 2 lignes sont datées au plus tard du 02\/10\/2026/)
    expect(avecPeriodeArretee(analyse(CAMT_UN_RELEVE), cloture).blocage).toMatch(/^Import bloqué : 2 lignes sont datées au plus tard du 02\/10\/2026/)
  })
})

describe('écran : import bloqué dans une période arrêtée', () => {
  it('CSV : bandeau « Import bloqué » avec le nombre de lignes, la date de l’arrêté et quoi faire ; bouton inactif ; annoncé', async () => {
    await cloturerAu('2026-05-31')
    await rendre()
    analyser(CSV_MAI_JUIN)
    expect(bandeauBloque()?.querySelector('p')?.textContent).toBe(
      `2 lignes sont datées au plus tard du 31/05/2026, date du dernier arrêté clôturé de ce compte. ${QUOI_FAIRE}`,
    )
    expect(boutonImporter()).toHaveTextContent('Importer 3 lignes')
    expect(boutonImporter()).toBeDisabled()
    expect(panneauImport().querySelector('.sr-only[aria-live="polite"]')?.textContent).toBe(
      'Relevé analysé (CSV) : 3 lignes retenues. Import bloqué : 2 lignes sont datées au plus tard du 31/05/2026, date du dernier ' +
        `arrêté clôturé de ce compte. ${QUOI_FAIRE}`,
    )
  })

  it('CSV sans ligne dans la période : ni bandeau, ni blocage', async () => {
    await cloturerAu('2026-05-19')
    await rendre()
    analyser(CSV_MAI_JUIN)
    expect(bandeauBloque()).toBeNull()
    expect(boutonImporter()).toBeEnabled()
  })

  it('CFONB 120 : bloqué de la même façon, relevés lus toujours montrés', async () => {
    await cloturerAu('2026-10-02')
    await rendre()
    analyser(CFONB_UN_COMPTE)
    expect(panneauImport().textContent).toContain('Format lu : CFONB 120')
    expect(bandeauBloque()?.querySelector('p')?.textContent).toBe(
      `2 lignes sont datées au plus tard du 02/10/2026, date du dernier arrêté clôturé de ce compte. ${QUOI_FAIRE}`,
    )
    expect(within(dansImport().getByRole('table', { name: 'Relevés lus' })).getAllByRole('row').slice(1)).toHaveLength(2)
    expect(boutonImporter()).toHaveTextContent('Importer 5 lignes')
    expect(boutonImporter()).toBeDisabled()
  })

  it('camt.053 : bloqué de la même façon', async () => {
    await cloturerAu('2026-10-02')
    await rendre()
    analyser(CAMT_UN_RELEVE)
    expect(panneauImport().textContent).toContain('Format lu : camt.053 (ISO 20022)')
    expect(bandeauBloque()?.querySelector('p')?.textContent).toBe(
      `2 lignes sont datées au plus tard du 02/10/2026, date du dernier arrêté clôturé de ce compte. ${QUOI_FAIRE}`,
    )
    expect(boutonImporter()).toHaveTextContent('Importer 4 lignes')
    expect(boutonImporter()).toBeDisabled()
  })

  it('le blocage suit les arrêtés du compte : il apparaît à la clôture, disparaît à la déclôture, puis le relevé s’importe en entier', async () => {
    await importerReleveSurCompte('C2', banqueId, [{ date: '2026-05-10', libelle: 'VIR CHARGES', montant: 450 }])
    await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 45_000 })
    await rendre()
    analyser(CSV_MAI_JUIN)
    // Arrêté en cours : il ne protège rien.
    expect(bandeauBloque()).toBeNull()
    expect(boutonImporter()).toBeEnabled()

    await cliquerEtAttendre(within(panneauRapprochement()).getByRole('button', { name: 'Clôturer l’arrêté du 31/05/2026' }))
    expect(dernierToast()).toMatchObject({ kind: 'success', title: 'Arrêté clôturé' })
    await waitFor(() => expect(bandeauBloque()).not.toBeNull())
    expect(bandeauBloque()?.textContent).toContain('2 lignes sont datées au plus tard du 31/05/2026')
    expect(boutonImporter()).toBeDisabled()

    await cliquerEtAttendre(within(panneauRapprochement()).getByRole('button', { name: 'Déclôturer l’arrêté du 31/05/2026' }))
    expect(dernierToast()).toMatchObject({ kind: 'success', title: 'Arrêté déclôturé' })
    await waitFor(() => expect(bandeauBloque()).toBeNull())
    expect(boutonImporter()).toBeEnabled()

    await cliquerEtAttendre(boutonImporter())
    expect(dernierToast()).toMatchObject({ kind: 'success', title: 'Relevé importé' })
    expect((await ecrituresDuCompte()).map((ecriture) => ecriture.libelle).sort()).toEqual(['FRAIS TENUE', 'PRLV EAU', 'VIR CHARGES', 'VIR JUIN'])
  })

  it('arrêté clôturé ailleurs après la lecture de l’écran (autre onglet) : la base refuse l’import, rien n’est écrit', async () => {
    await importerReleveSurCompte('C2', banqueId, [{ date: '2026-05-10', libelle: 'VIR CHARGES', montant: 450 }])
    const ouvert = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 45_000 })
    await rendre()
    analyser(CSV_MAI_JUIN)
    expect(boutonImporter()).toBeEnabled()
    // Écriture hors de l'écran : il ne relit pas les arrêtés.
    await cloturerArreteCompte(ouvert.id)
    await cliquerEtAttendre(boutonImporter())
    expect(dernierToast()).toMatchObject({
      kind: 'warn',
      title: 'Import impossible',
      desc: `Import refusé : 2 lignes sont datées au plus tard du 31/05/2026, date du dernier arrêté clôturé de ce compte. ${QUOI_FAIRE}`,
    })
    expect(await ecrituresDuCompte()).toHaveLength(1)
    // Le refus fait relire les arrêtés : le blocage est maintenant montré.
    await waitFor(() => expect(bandeauBloque()).not.toBeNull())
    expect(boutonImporter()).toBeDisabled()
  })

  it('arrêté en cours après l’arrêté clôturé : le bandeau dit d’abandonner d’abord l’arrêté en cours', async () => {
    await cloturerAu('2026-05-31')
    await ouvrirArreteCompte(banqueId, { dateArrete: '2026-06-03', soldeBanqueCentimes: 0 })
    await rendre()
    analyser(CSV_MAI_JUIN)
    expect(bandeauBloque()?.querySelector('p')?.textContent).toBe(
      '2 lignes sont datées au plus tard du 31/05/2026, date du dernier arrêté clôturé de ce compte. Aucune ligne du relevé n’est ' +
        'importée : abandonner d’abord l’arrêté en cours du 03/06/2026, déclôturer celui du 31/05/2026, puis importer le relevé en entier.',
    )
    expect(boutonImporter()).toBeDisabled()
  })
})
