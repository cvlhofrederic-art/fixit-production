import './fuseau-paris'
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TresorerieModule } from '@/components/administrateur-judiciaire/modules/finances/TresorerieModule'
import {
  aideSoldeBanque,
  saisieDuSolde,
  soldeSaisiVersCentimes,
} from '@/components/administrateur-judiciaire/modules/finances/tresorerie/arretes-vue'
import { ToastContext, type ToastApi } from '@/components/administrateur-judiciaire/ui/toast'
import { enregistrerCompteBancaire } from '@/lib/administrateur-judiciaire/db/comptes-bancaires'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { listerArretes } from '@/lib/administrateur-judiciaire/db/rapprochements'
import { importerReleveSurCompte } from '@/lib/administrateur-judiciaire/db/releves-bancaires'
import { listerRelevesImportes } from '@/lib/administrateur-judiciaire/db/releves-importes'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { ajDb } from '@/lib/administrateur-judiciaire/db/schema'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import { lireReleve } from '@/lib/administrateur-judiciaire/domain/import/lecture-releve'
import { AUJOURDHUI_ISO, CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Écran « Banque et recouvrement », relevés importés gardés (décision du 26/11/2026 du référent métier, PR 799) :
 * - point 10 B : un relevé CFONB 120 ou camt.053 déjà importé sur le compte est reconnu à l'import suivant ; ses
 *   mouvements ne sont pas repris, un bandeau le dit (sur le modèle de « Import bloqué »), les autres relevés du
 *   fichier restent importables ;
 * - point 3 C : « Nouvel arrêté » propose comme solde banque le solde de clôture du dernier relevé importé du compte à
 *   la date de l'arrêté, avec sa source ; la saisie à la main reste possible.
 * Base de démonstration (Le Clos des Vignes, C2 ; date figée au 04/06/2026), fichiers fictifs.
 */

const dossier = join(__dirname, 'fixtures', 'releves')
const CFONB = readFileSync(join(dossier, 'releve-nominal.cfonb120.txt'), 'latin1').replaceAll('\r\n', '\n')
const CAMT = readFileSync(join(dossier, 'releve-nominal.camt053.xml'), 'utf8')
/** Relevés 1 et 3 du fichier CFONB : ceux du seul compte 12345 00010 00012345678 (4 mouvements, puis 1). */
const CFONB_UN_COMPTE = CFONB.split('\n')
  .filter((ligne) => !ligne.includes('00087654321'))
  .join('\n')
/** Relevé 1 du fichier camt.053 seul : le même relevé que le relevé 1 du fichier CFONB. */
const CAMT_UN_RELEVE = CAMT.slice(0, CAMT.lastIndexOf('<Stmt>')) + CAMT.slice(CAMT.lastIndexOf('</Stmt>') + '</Stmt>'.length)
/** Le même relevé daté avant le jour de la démonstration : du 30/04/2026 au 05/05/2026, solde de clôture 472,94 €. */
const CAMT_MAI = CAMT_UN_RELEVE.replaceAll('2026-10-', '2026-05-').replaceAll('2026-09-30', '2026-04-30')
const IBAN_FIXTURE = 'FR76 1234 5000 1000 0123 4567 849'
const IBAN_AUTRE = 'FR76 3000 6000 0112 3456 7890 189'

const patienter = () =>
  act(async () => {
    await new Promise((resoudre) => setTimeout(resoudre, 30))
  })

let banqueId: string

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

/** Importe un relevé structuré hors de l'écran, en entier, comme le ferait « Importer N lignes ». */
async function importerHorsEcran(texte: string, compteId = banqueId) {
  const releves = lireReleve(texte).releves.map((releve) => ({ releve, repris: releve.mouvements }))
  await importerReleveSurCompte(
    'C2',
    compteId,
    releves.flatMap((releve) => releve.repris),
    releves,
  )
}

const panneauImport = () => screen.getByRole('heading', { level: 3, name: 'Importer un relevé' }).closest('.panel') as HTMLElement
const dansImport = () => within(panneauImport())
const boutonImporter = () => dansImport().getByRole('button', { name: /^Importer \d+ ligne/ }) as HTMLButtonElement
const alertes = () => Array.from(panneauImport().querySelectorAll('.alert')) as HTMLElement[]
const titresAlertes = () => alertes().map((alerte) => alerte.querySelector('b')?.textContent ?? '')
const alerte = (titre: string) => alertes().find((candidate) => candidate.querySelector('b')?.textContent === titre)
const relevesLus = () => within(dansImport().getByRole('table', { name: 'Relevés lus' })).getAllByRole('row').slice(1)
const lignesDuCompte = async () => (await ajDb.ecritures.toArray()).filter((ecriture) => ecriture.compte === `512-${banqueId}`)

function analyser(texte: string) {
  fireEvent.change(dansImport().getByLabelText('Relevé bancaire'), { target: { value: texte } })
  fireEvent.click(dansImport().getByRole('button', { name: /Analyser/ }))
}

async function importerALEcran() {
  const avant = pushCourant.mock.calls.length
  await act(async () => {
    fireEvent.click(boutonImporter())
  })
  await waitFor(() => expect(pushCourant.mock.calls.length).toBeGreaterThan(avant))
  await patienter()
}

describe('Relevé déjà importé sur le compte (point 10 B)', () => {
  it('importé à l’écran, puis analysé de nouveau : reconnu, bandeau « déjà importés », rien à importer, rien compté deux fois', async () => {
    await rendre()
    analyser(CFONB_UN_COMPTE)
    expect(titresAlertes()).toEqual([])
    expect(boutonImporter()).toHaveTextContent('Importer 5 lignes')
    await importerALEcran()
    expect(pushCourant.mock.calls.at(-1)?.[0]).toMatchObject({ kind: 'success', title: 'Relevé importé' })
    expect(await lignesDuCompte()).toHaveLength(5)
    expect(await listerRelevesImportes('C2')).toHaveLength(2)

    // Second import du même fichier, sans recharger l'écran.
    analyser(CFONB_UN_COMPTE)
    expect(titresAlertes()).toEqual(['2 relevés déjà importés'])
    const bandeau = alerte('2 relevés déjà importés') as HTMLElement
    expect(bandeau).toHaveClass('rust')
    expect(bandeau.textContent).toContain(
      'Relevé 1 (RIB 12345 00010 00012345678 clé 49, du 30/09/2026 au 05/10/2026) : déjà importé sur ce compte le 04/06/2026, ses 4 mouvements ne sont pas repris.',
    )
    expect(bandeau.textContent).toContain(
      'Relevé 2 (RIB 12345 00010 00012345678 clé 49, du 05/10/2026 au 06/10/2026) : déjà importé sur ce compte le 04/06/2026, son mouvement n’est pas repris.',
    )
    expect(bandeau.textContent).toContain('Rien à importer : tous les relevés de ce fichier sont déjà enregistrés sur ce compte.')
    expect(relevesLus().map((ligne) => within(ligne).getAllByRole('cell').at(-1)?.textContent)).toEqual(['Déjà importé', 'Déjà importé'])
    expect(boutonImporter()).toHaveTextContent('Importer 0 ligne')
    expect(boutonImporter()).toBeDisabled()
    expect(panneauImport().querySelector('.sr-only[aria-live="polite"]')?.textContent).toBe(
      'Relevé analysé (CFONB 120) : 0 ligne retenue. 2 relevés déjà importés sur ce compte : leurs mouvements ne sont pas repris.',
    )
    expect(await lignesDuCompte()).toHaveLength(5)
  })

  it('fichier qui porte un relevé déjà importé et un relevé nouveau : seul le nouveau est importé, puis gardé à son tour', async () => {
    // Relevé 1 importé en camt.053 ; le fichier CFONB le porte de nouveau, suivi d'un relevé nouveau.
    await importerHorsEcran(CAMT_UN_RELEVE)
    await rendre()
    analyser(CFONB_UN_COMPTE)
    expect(titresAlertes()).toEqual(['Relevé déjà importé'])
    const bandeau = alerte('Relevé déjà importé') as HTMLElement
    expect(bandeau.textContent).toContain('déjà importé sur ce compte le 04/06/2026, ses 4 mouvements ne sont pas repris.')
    expect(bandeau.textContent).not.toContain('Rien à importer')
    expect(relevesLus().map((ligne) => within(ligne).getAllByRole('cell').at(-1)?.textContent)).toEqual(['Déjà importé', 'Contrôlé'])
    expect(boutonImporter()).toHaveTextContent('Importer 1 ligne')
    expect(boutonImporter()).toBeEnabled()
    await importerALEcran()
    expect(await lignesDuCompte()).toHaveLength(5)
    expect((await listerRelevesImportes('C2')).map((garde) => [garde.format, garde.dateCloture, garde.soldeClotureMineur])).toEqual([
      ['camt053', '2026-10-05', 47_294],
      ['cfonb120', '2026-10-06', -12_706],
    ])
    // Solde du compte : celui de clôture du dernier relevé, moins l'ancien solde du premier (aucune écriture d'ouverture).
    const panneauComptes = screen.getByRole('heading', { level: 3, name: 'Comptes bancaires du mandat' }).closest('.panel') as HTMLElement
    expect(within(panneauComptes).getAllByRole('row')[1].textContent).toContain(formatEurosCentimes(-1377.06))
  })

  it('relevé déjà importé suivi d’un relevé nouveau sans mouvement : le bandeau ne dit pas que tout est déjà enregistré', async () => {
    const lignes = CFONB_UN_COMPTE.split('\n'),
      releve1 = lignes.slice(0, lignes.findIndex((ligne) => ligne.startsWith('07')) + 1),
      // Relevé suivant du même compte, du 05/10 au 06/10/2026, sans aucun mouvement : même solde (472,94) aux deux bouts.
      sansMouvement = [lignes[releve1.length], lignes[releve1.length].replace(/^01/, '07').replace('051026', '061026')]
    await importerHorsEcran(releve1.join('\n'))
    await rendre()
    analyser([...releve1, ...sansMouvement].join('\n'))
    expect(titresAlertes()).toEqual(['Relevé déjà importé'])
    expect(relevesLus().map((ligne) => within(ligne).getAllByRole('cell').at(-1)?.textContent)).toEqual(['Déjà importé', 'Contrôlé'])
    expect(alerte('Relevé déjà importé')?.textContent).not.toContain('Rien à importer')
    // Aucune ligne à écrire : le bouton reste inactif, comme avant (le relevé sans mouvement n'est donc pas gardé).
    expect(boutonImporter()).toHaveTextContent('Importer 0 ligne')
    expect(boutonImporter()).toBeDisabled()
  })

  it('analyse faite avant qu’un autre import ne garde le relevé : refus à l’écriture, toast « Import impossible », rien n’est écrit', async () => {
    await rendre()
    analyser(CAMT_UN_RELEVE)
    expect(boutonImporter()).toBeEnabled()
    await importerHorsEcran(CAMT_UN_RELEVE)
    await importerALEcran()
    expect(pushCourant.mock.calls.at(-1)?.[0]).toMatchObject({
      kind: 'warn',
      title: 'Import impossible',
      desc: expect.stringContaining('déjà importé sur ce compte. Analyser le fichier à nouveau.'),
    })
    expect(await lignesDuCompte()).toHaveLength(4)
    expect(await listerRelevesImportes('C2')).toHaveLength(1)
  })

  it('compte qui porte des lignes sans relevé gardé (CSV, import antérieur) : limite dite ; compte sans ligne : aucun bandeau', async () => {
    await importerReleveSurCompte('C2', banqueId, [{ date: '2026-05-10', libelle: 'VIR CHARGES', montant: 450 }])
    await rendre()
    analyser(CAMT_UN_RELEVE)
    expect(titresAlertes()).toEqual(['Lignes enregistrées sans relevé gardé'])
    expect(alerte('Lignes enregistrées sans relevé gardé')?.textContent).toContain(
      'Des lignes de ce compte viennent d’un CSV ou d’un import fait avant que les relevés soient gardés : un relevé qui les contient n’est pas reconnu. ' +
        'Vérifier la période avant d’importer : un relevé importé deux fois compterait deux fois dans le solde du compte.',
    )
    expect(boutonImporter()).toBeEnabled()
    // CSV : pas de relevé, pas de limite à dire (son dédoublonnage par date, montant et libellé est inchangé).
    analyser('Date;Libellé;Montant\n10/05/2026;VIR CHARGES;450,00\n05/10/2026;VIR SEPA;350,00')
    expect(titresAlertes()).toEqual(['1 doublon déjà importé, écarté'])
    expect(boutonImporter()).toHaveTextContent('Importer 1 ligne')
  })
})

describe('« Nouvel arrêté » : solde banque repris du dernier relevé importé (point 3 C)', () => {
  const panneau = () => screen.getByRole('heading', { level: 3, name: /^Rapprochement/ }).closest('.panel') as HTMLElement
  const dialogue = () => within(screen.getByRole('dialog'))
  const champSolde = () => dialogue().getByLabelText('Solde banque') as HTMLInputElement
  const champDate = () => dialogue().getByLabelText('Date de l’arrêté') as HTMLInputElement
  const aide = () => champSolde().closest('.field')?.querySelector('.field-hint')?.textContent ?? ''
  const ouvrir = () => fireEvent.click(within(panneau()).getByRole('button', { name: /Nouvel arrêté/ }))
  const AIDE_SANS_RELEVE = 'Solde du relevé de la banque à cette date ; négatif : découvert.'

  it('aucun relevé importé sur le compte : champ vide, comme avant', async () => {
    await importerReleveSurCompte('C2', banqueId, [{ date: '2026-05-10', libelle: 'VIR CHARGES', montant: 450 }])
    await rendre()
    ouvrir()
    expect(champSolde().value).toBe('')
    expect(aide()).toBe(AIDE_SANS_RELEVE)
  })

  it('relevé clos avant la date proposée : solde de clôture pré-rempli, source dite avec la réserve ; date du relevé : sans réserve', async () => {
    await importerHorsEcran(CAMT_MAI)
    await rendre()
    ouvrir()
    expect(champDate().value).toBe(AUJOURDHUI_ISO)
    expect(champSolde().value).toBe('472,94')
    expect(aide()).toBe(
      'Solde de clôture du relevé du 05/05/2026, antérieur à la date de l’arrêté : à vérifier. Modifiable ; négatif : découvert.',
    )
    fireEvent.change(champDate(), { target: { value: '2026-05-05' } })
    expect(champSolde().value).toBe('472,94')
    expect(aide()).toBe('Solde de clôture du relevé du 05/05/2026, modifiable ; négatif : découvert.')
    // Avant la clôture du relevé : plus rien à proposer.
    fireEvent.change(champDate(), { target: { value: '2026-05-04' } })
    expect(champSolde().value).toBe('')
    expect(aide()).toBe(AIDE_SANS_RELEVE)
  })

  it('solde proposé enregistré tel quel : arrêté ouvert au solde de clôture du relevé', async () => {
    await importerHorsEcran(CAMT_MAI)
    await rendre()
    ouvrir()
    fireEvent.change(champDate(), { target: { value: '2026-05-05' } })
    const avant = pushCourant.mock.calls.length
    await act(async () => {
      fireEvent.click(dialogue().getByRole('button', { name: /Enregistrer/ }))
    })
    await waitFor(() => expect(pushCourant.mock.calls.length).toBeGreaterThan(avant))
    expect(pushCourant.mock.calls.at(-1)?.[0]).toMatchObject({ kind: 'success', title: 'Arrêté ouvert' })
    const { arretes } = await listerArretes(banqueId)
    expect(arretes.map((arrete) => [arrete.dateArrete, arrete.soldeBanqueCentimes])).toEqual([['2026-05-05', 47_294]])
  })

  it('saisie à la main : elle remplace le solde proposé, reste quand la date change, et c’est elle qui est enregistrée', async () => {
    await importerHorsEcran(CAMT_MAI)
    await rendre()
    ouvrir()
    fireEvent.change(champSolde(), { target: { value: '500' } })
    expect(aide()).toBe(AIDE_SANS_RELEVE)
    fireEvent.change(champDate(), { target: { value: '2026-05-05' } })
    expect(champSolde().value).toBe('500')
    expect(aide()).toBe(AIDE_SANS_RELEVE)
    const avant = pushCourant.mock.calls.length
    await act(async () => {
      fireEvent.click(dialogue().getByRole('button', { name: /Enregistrer/ }))
    })
    await waitFor(() => expect(pushCourant.mock.calls.length).toBeGreaterThan(avant))
    expect((await listerArretes(banqueId)).arretes.map((arrete) => arrete.soldeBanqueCentimes)).toEqual([50_000])
  })

  it('champ vidé à la main : il reste vide (le solde proposé ne revient pas de lui-même)', async () => {
    await importerHorsEcran(CAMT_MAI)
    await rendre()
    ouvrir()
    fireEvent.change(champSolde(), { target: { value: '' } })
    expect(champSolde().value).toBe('')
    expect(aide()).toBe(AIDE_SANS_RELEVE)
  })

  it('relevé importé à l’écran, puis « Nouvel arrêté » sans recharger : son solde est proposé', async () => {
    await rendre()
    analyser(CAMT_MAI)
    await importerALEcran()
    ouvrir()
    expect(champSolde().value).toBe('472,94')
  })

  it('autre compte de la copropriété, sans relevé : rien n’est proposé pour lui', async () => {
    await enregistrerCompteBancaire('C2', { nature: 'courant', libelle: 'Second compte', iban: IBAN_AUTRE, bic: null, etablissement: null })
    await importerHorsEcran(CAMT_MAI)
    await rendre()
    fireEvent.change(within(panneau()).getByLabelText('Compte rapproché'), { target: { value: (await ajDb.banques.toArray()).find((banque) => banque.id !== banqueId)?.id } })
    await patienter()
    ouvrir()
    expect(champSolde().value).toBe('')
    expect(aide()).toBe(AIDE_SANS_RELEVE)
  })
})

describe('solde proposé : texte du champ et aide (fonctions pures)', () => {
  it('centimes → saisie relue par le contrôle du formulaire, au centime près, découvert compris', () => {
    expect(saisieDuSolde(47_294)).toBe('472,94')
    expect(saisieDuSolde(-12_706)).toBe('-127,06')
    expect(saisieDuSolde(0)).toBe('0,00')
    expect(saisieDuSolde(-5)).toBe('-0,05')
    expect(saisieDuSolde(123_456_789)).toBe('1234567,89')
    for (const centimes of [47_294, -12_706, 0, -5, 5, 100, 123_456_789, -99]) expect(soldeSaisiVersCentimes(saisieDuSolde(centimes))).toBe(centimes)
  })

  it('aide : source « relevé du JJ/MM/AAAA », réserve quand le relevé est clos avant la date de l’arrêté', () => {
    expect(aideSoldeBanque(null)).toBe('Solde du relevé de la banque à cette date ; négatif : découvert.')
    expect(aideSoldeBanque({ centimes: 1, dateReleve: '2026-05-05', anterieur: false })).toBe(
      'Solde de clôture du relevé du 05/05/2026, modifiable ; négatif : découvert.',
    )
    expect(aideSoldeBanque({ centimes: 1, dateReleve: '2026-05-05', anterieur: true })).toBe(
      'Solde de clôture du relevé du 05/05/2026, antérieur à la date de l’arrêté : à vérifier. Modifiable ; négatif : découvert.',
    )
  })
})
