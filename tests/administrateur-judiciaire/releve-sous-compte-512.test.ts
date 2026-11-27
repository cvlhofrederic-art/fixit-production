import './fuseau-paris'
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { cloturerCompteBancaire, enregistrerCompteBancaire } from '@/lib/administrateur-judiciaire/db/comptes-bancaires'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { importerReleveSurCompte } from '@/lib/administrateur-judiciaire/db/releves-bancaires'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { ajDb, type Ecriture } from '@/lib/administrateur-judiciaire/db/schema'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import {
  COMPTE_BANQUE_NON_RATTACHE,
  banqueDuCompte,
  compteBanque,
  estCompteBanque,
  soldeCompteCentimes,
} from '@/lib/administrateur-judiciaire/db/sous-comptes-banque'
import { CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'

/**
 * Sous-compte 512 de chaque compte bancaire (choix du compte à l'import du relevé, question 6 validée le 20/11/2026) :
 * les lignes d'un relevé importé sur un compte vont au sous-compte « 512-<id du compte> », ce qui donne le solde par
 * compte. Le store garde son import au « 512 » seul (oracle de la base locale inchangé).
 */

// IBAN de test publiés (exemples déjà utilisés par les tests D-BANQUE) : clés valides, aucun compte réel.
const IBAN_A = 'FR76 3000 6000 0112 3456 7890 189'
const IBAN_B = 'FR14 2004 1010 0505 0001 3M02 606'

const etat = () => useDonneesStore.getState()

const ecriture = (compte: string, montant: number, sens: 'debit' | 'credit', date: Date): Pick<Ecriture, 'compte' | 'montant' | 'sens' | 'date'> => ({
  compte,
  montant,
  sens,
  date,
})

describe('sous-comptes 512 des comptes bancaires', () => {
  it('« 512-<id> » pour un compte, « 512 » seul pour une ligne non rattachée', () => {
    expect(compteBanque('B1')).toBe('512-B1')
    expect(COMPTE_BANQUE_NON_RATTACHE).toBe('512')
    expect(estCompteBanque('512')).toBe(true)
    expect(estCompteBanque('512-B1')).toBe(true)
    expect(estCompteBanque('512-')).toBe(false)
    expect(estCompteBanque('5120')).toBe(false)
    expect(estCompteBanque('471')).toBe(false)
    expect(estCompteBanque('450-P2')).toBe(false)
    expect(banqueDuCompte('512-B1')).toBe('B1')
    expect(banqueDuCompte('512')).toBeNull()
    expect(banqueDuCompte('471')).toBeNull()
  })

  it('solde : débit − crédit en centimes entiers ; null sans aucune écriture du compte ; borné à une date incluse', () => {
    const ecritures = [
      ecriture('512-B1', 350, 'debit', new Date(2026, 9, 1)),
      ecriture('512-B1', 1234.56, 'credit', new Date(2026, 9, 2)),
      ecriture('512-B1', 0.1, 'debit', new Date(2026, 9, 3)),
      ecriture('512-B1', 0.2, 'debit', new Date(2026, 9, 3)),
      ecriture('512-B2', 999, 'debit', new Date(2026, 9, 1)),
      ecriture('471', 1234.56, 'debit', new Date(2026, 9, 2)),
    ]
    expect(soldeCompteCentimes(ecritures, '512-B1')).toBe(35_000 - 123_456 + 10 + 20)
    expect(soldeCompteCentimes(ecritures, '512-B1', '2026-10-02')).toBe(35_000 - 123_456)
    expect(soldeCompteCentimes(ecritures, '512-B1', '2026-09-30')).toBe(0)
    expect(soldeCompteCentimes(ecritures, '512-B3')).toBeNull()
  })
})

describe('import d’un relevé sur le compte bancaire choisi', () => {
  beforeEach(async () => {
    localStorage.removeItem(CLE_STOCKAGE_MODE)
    await viderBaseLocale()
    await initialiserBaseDemo()
    useDonneesStore.setState({ loaded: false, loading: false })
    await etat().loadAll()
  })

  const lignes = [
    { date: '2026-06-04', libelle: 'VIR ENCAISSEMENT A', montant: 100 },
    { date: '2026-06-05', libelle: 'PRLV FOURNISSEUR', montant: -40.5 },
  ]

  it('lignes au sous-compte « 512-<id> » (sorties : 471 à ventiler), dans le journal de la copropriété, base et état à jour', async () => {
    const compte = await enregistrerCompteBancaire('C2', { nature: 'courant', libelle: '', iban: IBAN_A, bic: null, etablissement: null })
    const creees = await importerReleveSurCompte('C2', compte.id, lignes)
    expect(creees.map((e) => [e.compte, e.sens, e.montant])).toEqual([
      [`512-${compte.id}`, 'debit', 100],
      [`512-${compte.id}`, 'credit', 40.5],
    ])
    const enBase = await ajDb.ecritures.toArray()
    expect(enBase.map((e) => e.compte).sort((a, b) => a.localeCompare(b))).toEqual(['471', `512-${compte.id}`, `512-${compte.id}`])
    const journal = etat().journaux.find((candidat) => candidat.coproprieteId === 'C2')
    expect(journal).toBeDefined()
    expect(new Set(enBase.map((e) => e.journalId))).toEqual(new Set([journal?.id]))
    expect(etat().ecritures).toHaveLength(3)
    expect(soldeCompteCentimes(etat().ecritures, compteBanque(compte.id))).toBe(5_950)
  })

  it('compte d’une autre copropriété, clôturé ou introuvable : refusé, rien n’est écrit', async () => {
    const autre = await enregistrerCompteBancaire('C1', { nature: 'courant', libelle: '', iban: IBAN_A, bic: null, etablissement: null })
    await expect(importerReleveSurCompte('C2', autre.id, lignes)).rejects.toThrow(/Compte bancaire introuvable pour cette copropriété/)
    await expect(importerReleveSurCompte('C2', 'inconnu', lignes)).rejects.toThrow(/Compte bancaire introuvable pour cette copropriété/)
    const ferme = await enregistrerCompteBancaire('C2', { nature: 'courant', libelle: 'Ancien', iban: IBAN_B, bic: null, etablissement: null })
    await cloturerCompteBancaire(ferme.id)
    await expect(importerReleveSurCompte('C2', ferme.id, lignes)).rejects.toThrow(/Compte bancaire clôturé/)
    expect(await ajDb.ecritures.count()).toBe(0)
    expect(etat().ecritures).toHaveLength(0)
  })

  it('un encaissement du sous-compte s’impute au copropriétaire : contrepartie 450, solde mis à jour', async () => {
    const compte = await enregistrerCompteBancaire('C2', { nature: 'courant', libelle: '', iban: IBAN_A, bic: null, etablissement: null })
    const [encaissement] = await importerReleveSurCompte('C2', compte.id, lignes)
    const soldeAvant = etat().coproprietaires.find((personne) => personne.id === 'P2')?.solde as number
    await etat().imputerEncaissement(encaissement.id, 'P2', '2026-06-04')
    const contrepartie = etat().ecritures.filter((e) => e.compte === '450-P2')
    expect(contrepartie).toHaveLength(1)
    expect(contrepartie[0].libelle.endsWith(`relevé ${encaissement.id}`)).toBe(true)
    expect(etat().coproprietaires.find((personne) => personne.id === 'P2')?.solde).toBe(soldeAvant + 100)
  })

  it('import du store sans compte : « 512 » seul, comme avant (non-régression) ; compte qui n’est pas un 512 refusé', async () => {
    const creees = await etat().importerReleve('C2', lignes)
    expect(creees.map((e) => e.compte)).toEqual(['512', '512'])
    await expect(etat().importerReleve('C2', lignes, '471')).rejects.toThrow(/sous-compte 512 attendu/)
    expect(await ajDb.ecritures.count()).toBe(3)
  })
})
