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
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { ajDb } from '@/lib/administrateur-judiciaire/db/schema'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import { CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Écran « Banque et recouvrement », import des relevés CFONB 120 et camt.053 (mémo de branchement du 20/11/2026) :
 * format détecté, relevés lus avec leurs soldes, import au sous-compte 512 du compte choisi, fichier avec une erreur
 * bloqué (relevés lus et erreurs montrés en entier), limite des empreintes dite, fichier lu en UTF-8 ou Windows-1252,
 * fichier trop gros refusé avant lecture. Base de démonstration (Le Clos des Vignes, C2).
 */

const dossier = join(__dirname, 'fixtures', 'releves')
const CFONB = readFileSync(join(dossier, 'releve-nominal.cfonb120.txt'), 'latin1').replaceAll('\r\n', '\n')
const CAMT = readFileSync(join(dossier, 'releve-nominal.camt053.xml'), 'utf8')
const CFONB_UN_COMPTE = CFONB.split('\n')
  .filter((ligne) => !ligne.includes('00087654321'))
  .join('\n')
const CAMT_UN_RELEVE = CAMT.slice(0, CAMT.lastIndexOf('<Stmt>')) + CAMT.slice(CAMT.lastIndexOf('</Stmt>') + '</Stmt>'.length)
// IBAN des fixtures (compte des relevés 1 et 3) : exemple déjà utilisé par lecture-releve.test.ts.
const IBAN_FIXTURE = 'FR76 1234 5000 1000 0123 4567 849'

const etat = () => useDonneesStore.getState()

const patienter = () =>
  act(async () => {
    await new Promise((resoudre) => setTimeout(resoudre, 30))
  })

beforeEach(async () => {
  localStorage.removeItem(CLE_STOCKAGE_MODE)
  await viderBaseLocale()
  await initialiserBaseDemo()
  useDonneesStore.setState({ loaded: false, loading: false })
  await etat().loadAll()
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
})

afterEach(() => cleanup())

const ajouterCompte = (iban: string | null) =>
  enregistrerCompteBancaire('C2', { nature: 'courant', libelle: 'Compte principal', iban, bic: null, etablissement: null })

async function rendre() {
  const push = vi.fn<ToastApi['push']>(() => undefined)
  await act(async () => {
    render(
      <ToastContext.Provider value={{ push, dismiss: vi.fn() }}>
        <TresorerieModule />
      </ToastContext.Provider>,
    )
  })
  await patienter()
  await waitFor(() => expect(screen.queryByText('Chargement…')).toBeNull())
  return { push }
}

const panneauImport = () => screen.getByRole('heading', { level: 3, name: 'Importer un relevé' }).closest('.panel') as HTMLElement
const dansImport = () => within(panneauImport())
const boutonImporter = () => dansImport().getByRole('button', { name: /^Importer \d+ ligne/ }) as HTMLButtonElement
const titresAlertes = () => Array.from(panneauImport().querySelectorAll('.alert b')).map((b) => b.textContent ?? '')

function analyser(texte: string) {
  fireEvent.change(dansImport().getByLabelText('Relevé bancaire'), { target: { value: texte } })
  fireEvent.click(dansImport().getByRole('button', { name: /Analyser/ }))
}

describe('Import des relevés CFONB 120 et camt.053', () => {
  it('CFONB 120 : format et relevés lus, limite dite ; mouvements importés au sous-compte du compte choisi', async () => {
    const compte = await ajouterCompte(IBAN_FIXTURE)
    const { push } = await rendre()
    analyser(CFONB_UN_COMPTE)
    expect(panneauImport().textContent).toContain('Format lu : CFONB 120')
    const releves = within(dansImport().getByRole('table', { name: 'Relevés lus' })).getAllByRole('row').slice(1)
    expect(releves).toHaveLength(2)
    expect(releves[0].textContent).toContain('Relevé 1 (RIB 12345 00010 00012345678 clé 49, du 30/09/2026 au 05/10/2026)')
    expect(releves[0].textContent).toContain('1 250,00 €')
    expect(releves[0].textContent).toContain('472,94 €')
    // rb-c08 A (décision du 26/11/2026) : le symbole de l'euro, comme partout dans le module.
    expect(releves[0].textContent).not.toContain('EUR')
    expect(titresAlertes()).toContain('Relevé déjà importé lors d’un import précédent : non reconnu')
    expect(boutonImporter()).toHaveTextContent('Importer 5 lignes')
    expect(boutonImporter()).toBeEnabled()
    await act(async () => {
      fireEvent.click(boutonImporter())
    })
    await waitFor(() => expect(push.mock.calls.at(-1)?.[0]).toMatchObject({ kind: 'success', title: 'Relevé importé' }))
    await patienter()
    expect((await ajDb.ecritures.toArray()).filter((ecriture) => ecriture.compte === `512-${compte.id}`)).toHaveLength(5)
    const panneauComptes = screen.getByRole('heading', { level: 3, name: 'Comptes bancaires du mandat' }).closest('.panel') as HTMLElement
    expect(within(panneauComptes).getAllByRole('row')[1].textContent).toContain(formatEurosCentimes(-1377.06))
  })

  it('fichier avec une erreur (relevé d’un autre compte) : import bloqué, relevés lus et erreur montrés en entier', async () => {
    await ajouterCompte(IBAN_FIXTURE)
    await rendre()
    analyser(CFONB)
    expect(titresAlertes()).toContain('Import bloqué')
    expect(panneauImport().textContent).toContain(
      'Relevé 2 (RIB 12345 00010 00087654321 clé 21, du 30/09/2026 au 05/10/2026) refusé : compte absent des comptes attendus.',
    )
    expect(panneauImport().textContent).toContain('Import bloqué : le fichier contient une erreur.')
    expect(within(dansImport().getByRole('table', { name: 'Relevés lus' })).getAllByRole('row').slice(1)).toHaveLength(2)
    expect(boutonImporter()).toBeDisabled()
  })

  it('résultat de l’analyse annoncé (zone aria-live présente avant l’analyse) : lignes retenues, blocage', async () => {
    await ajouterCompte(IBAN_FIXTURE)
    await rendre()
    const annonce = () => panneauImport().querySelector('.sr-only[aria-live="polite"]')
    expect(annonce()).not.toBeNull()
    expect(annonce()?.textContent).toBe('')
    analyser('Date;Libellé;Montant\n05/10/2026;VIR SEPA;350,00')
    expect(annonce()?.textContent).toBe('Relevé analysé (CSV) : 1 ligne retenue.')
    analyser(CFONB)
    expect(annonce()?.textContent).toBe(
      'Relevé analysé (CFONB 120) : 5 lignes retenues. Import bloqué : le fichier contient une erreur. Un relevé manquant ' +
        'fausserait le solde du compte et le rapprochement : corriger le fichier, puis l’analyser à nouveau.',
    )
  })

  it('IBAN du compte modifié après l’analyse : l’analyse faite pour l’ancien IBAN est abandonnée, jamais importée', async () => {
    await ajouterCompte(IBAN_FIXTURE)
    const { push } = await rendre()
    analyser(CAMT_UN_RELEVE)
    expect(boutonImporter()).toBeEnabled()
    const panneauComptes = screen.getByRole('heading', { level: 3, name: 'Comptes bancaires du mandat' }).closest('.panel') as HTMLElement
    fireEvent.click(within(within(panneauComptes).getAllByRole('row')[1]).getByRole('button', { name: /^Modifier/ }))
    const boite = within(screen.getByRole('dialog'))
    fireEvent.change(boite.getByLabelText('IBAN'), { target: { value: 'FR76 3000 6000 0112 3456 7890 189' } })
    const avant = push.mock.calls.length
    await act(async () => {
      fireEvent.click(boite.getByRole('button', { name: 'Enregistrer' }))
    })
    await waitFor(() => expect(push.mock.calls.length).toBeGreaterThan(avant))
    await patienter()
    expect(push.mock.calls.at(-1)?.[0]).toMatchObject({ kind: 'success', title: 'Compte modifié' })
    expect(dansImport().queryByRole('button', { name: /^Importer \d+ ligne/ })).toBeNull()
    fireEvent.click(dansImport().getByRole('button', { name: /Analyser/ }))
    expect(panneauImport().textContent).toContain('refusé : compte absent des comptes attendus.')
    expect(boutonImporter()).toBeDisabled()
  })

  it('compte choisi sans IBAN : relevé structuré bloqué, motif affiché', async () => {
    await ajouterCompte(null)
    await rendre()
    analyser(CAMT_UN_RELEVE)
    expect(panneauImport().textContent).toContain('Import bloqué : compte choisi sans IBAN')
    expect(boutonImporter()).toBeDisabled()
  })

  it('fichier camt.053 choisi : extensions acceptées, lu en UTF-8 puis analysé', async () => {
    await ajouterCompte(IBAN_FIXTURE)
    await rendre()
    const fichier = dansImport().getByLabelText('Fichier de relevé') as HTMLInputElement
    expect(fichier.accept.split(',')).toEqual(expect.arrayContaining(['.csv', '.txt', '.xml', '.053', '.cfonb']))
    await act(async () => {
      fireEvent.change(fichier, { target: { files: [new File([CAMT_UN_RELEVE], 'releve.xml', { type: 'application/xml' })] } })
    })
    await waitFor(() => expect((dansImport().getByLabelText('Relevé bancaire') as HTMLTextAreaElement).value).toContain('camt.053.001.02'))
    fireEvent.click(dansImport().getByRole('button', { name: /Analyser/ }))
    expect(panneauImport().textContent).toContain('Format lu : camt.053 (ISO 20022)')
    expect(boutonImporter()).toHaveTextContent('Importer 4 lignes')
  })

  it('fichier CFONB en Latin-1 : relu en Windows-1252, accents gardés', async () => {
    await ajouterCompte(IBAN_FIXTURE)
    await rendre()
    // Un octet par caractère (Latin-1), 120 caractères gardés : « É » remplace une espace de fin de zone.
    const latin1 = CFONB_UN_COMPTE.replace('REGULARISATION DES CHARGES ', 'RÉGULARISATION DES CHARGES')
    const octets = Uint8Array.from(Array.from(latin1, (caractere) => caractere.charCodeAt(0)))
    await act(async () => {
      fireEvent.change(dansImport().getByLabelText('Fichier de relevé'), { target: { files: [new File([octets], 'releve.cfonb')] } })
    })
    await waitFor(() => expect((dansImport().getByLabelText('Relevé bancaire') as HTMLTextAreaElement).value).toContain('RÉGULARISATION'))
  })

  it('fichier de plus de 10 Mo : refusé avant lecture par un toast, rien n’est lu', async () => {
    await ajouterCompte(IBAN_FIXTURE)
    const { push } = await rendre()
    const gros = new File(['x'], 'releve.xml')
    Object.defineProperty(gros, 'size', { value: 10 * 1024 * 1024 + 1 })
    await act(async () => {
      fireEvent.change(dansImport().getByLabelText('Fichier de relevé'), { target: { files: [gros] } })
    })
    expect(push).toHaveBeenCalledWith({
      kind: 'warn',
      title: 'Fichier non lu',
      desc: 'Fichier de 10,0 Mo : au-delà de 10 Mo, le relevé n’est pas lu (seuil provisoire).',
    })
    expect((dansImport().getByLabelText('Relevé bancaire') as HTMLTextAreaElement).value).toBe('')
  })

  it('CSV : comportement inchangé (format dit, aucune limite d’empreintes, aucun relevé listé)', async () => {
    await ajouterCompte(IBAN_FIXTURE)
    await rendre()
    analyser('Date;Libellé;Montant\n05/10/2026;VIR SEPA;350,00')
    expect(panneauImport().textContent).toContain('Format lu : CSV')
    expect(dansImport().queryByRole('table', { name: 'Relevés lus' })).toBeNull()
    expect(titresAlertes()).not.toContain('Relevé déjà importé lors d’un import précédent : non reconnu')
    expect(boutonImporter()).toBeEnabled()
  })
})

describe('Import des relevés : petits défauts de texte (rb-c08 A, décision du 26/11/2026)', () => {
  it('le bandeau « Import bloqué » ne répète pas son titre au début du texte', async () => {
    await ajouterCompte(IBAN_FIXTURE)
    await rendre()
    analyser(CFONB)
    const bandeau = Array.from(panneauImport().querySelectorAll('.alert')).find((alerte) => alerte.querySelector('b')?.textContent === 'Import bloqué')
    expect(bandeau).toBeDefined()
    const texte = bandeau?.querySelector('p')?.textContent ?? ''
    expect(texte).toMatch(/^Le fichier contient une erreur\./)
    expect(texte).not.toMatch(/^Import bloqué/)
    // Le motif d'un compte sans IBAN : même règle.
    cleanup()
    await ajDb.banques.clear()
    await ajouterCompte(null)
    await rendre()
    analyser(CAMT_UN_RELEVE)
    const sansIban = Array.from(panneauImport().querySelectorAll('.alert')).find((alerte) => alerte.querySelector('b')?.textContent === 'Import bloqué')
    expect(sansIban?.querySelector('p')?.textContent).toMatch(/^Compte choisi sans IBAN/)
  })

  it('camt.053 : l’IBAN du relevé est groupé par quatre, dans « Relevés lus » comme dans les erreurs', async () => {
    await ajouterCompte(IBAN_FIXTURE)
    await rendre()
    analyser(CAMT_UN_RELEVE)
    const releves = within(dansImport().getByRole('table', { name: 'Relevés lus' })).getAllByRole('row').slice(1)
    expect(releves[0].textContent).toContain('Relevé 1 (IBAN FR76 1234 5000 1000 0123 4567 849, du 30/09/2026 au 05/10/2026)')
    expect(releves[0].textContent).not.toContain('FR7612345000100001234567849')
    // Relevé d'un autre compte : l'erreur montre le même IBAN groupé.
    cleanup()
    await ajDb.banques.clear()
    await ajouterCompte('FR76 3000 6000 0112 3456 7890 189')
    await rendre()
    analyser(CAMT_UN_RELEVE)
    const bandeaux = Array.from(panneauImport().querySelectorAll('.alert'))
      .map((alerte) => alerte.textContent)
      .join(' ')
    expect(bandeaux).toContain('Relevé 1 (IBAN FR76 1234 5000 1000 0123 4567 849, du 30/09/2026 au 05/10/2026) refusé')
    expect(bandeaux).not.toContain('FR7612345000100001234567849')
  })

  it('rb-c06 A : « Importer N lignes » et sa phrase sont dans un bloc qui passe en colonne sur téléphone', async () => {
    await ajouterCompte(IBAN_FIXTURE)
    await rendre()
    analyser(CFONB_UN_COMPTE)
    const bloc = boutonImporter().parentElement as HTMLElement
    expect(bloc).toHaveClass('vfx-import-actions')
    expect(bloc.querySelector('span')?.textContent).toContain('Les encaissements rapprochés mettent le solde du copropriétaire à jour')
  })

  it('rb-19 A : la colonne de l’imputation proposée et le chapeau parlent d’imputation, plus de rapprochement', async () => {
    await ajouterCompte(IBAN_FIXTURE)
    await rendre()
    analyser('Date;Libellé;Montant\n05/10/2026;VIR SEPA;350,00')
    const entetes = within(dansImport().getByRole('table')).getAllByRole('columnheader').map((entete) => entete.textContent)
    expect(entetes).toEqual(['Date', 'Libellé', 'Montant', 'Copropriétaire', 'Imputation proposée'])
    expect(document.querySelector('.page-head .lede')?.textContent).toContain('imputation des encaissements aux copropriétaires')
    expect(document.body.textContent).not.toContain('rapprochement des encaissements')
  })
})
