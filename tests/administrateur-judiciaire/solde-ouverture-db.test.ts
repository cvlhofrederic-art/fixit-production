import './fuseau-paris'
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { cloturerCompteBancaire, enregistrerCompteBancaire, type SaisieCompteBancaire } from '@/lib/administrateur-judiciaire/db/comptes-bancaires'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import {
  abandonnerArreteCompte,
  cloturerArreteCompte,
  decloturerArreteCompte,
  listerArretes,
  ouvrirArreteCompte,
} from '@/lib/administrateur-judiciaire/db/rapprochements'
import { importerReleveSurCompte } from '@/lib/administrateur-judiciaire/db/releves-bancaires'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { ajDb } from '@/lib/administrateur-judiciaire/db/schema'
import { COMPTE_BANCAIRE_DEMO, ajouterCompteBancaireDemo, initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'

/**
 * Solde d'ouverture d'un compte bancaire dans la base locale (PR 799, point 2, choix A validé par le référent métier,
 * décision du 26/11/2026) : deux champs non indexés de la table « banques » (aucune nouvelle version de la base), écrits
 * par enregistrerCompteBancaire. Aucune écriture n'est passée au journal de banque : le solde d'ouverture est pris en
 * compte par les calculs du sous-compte 512 du compte (solde par compte, solde compta des arrêtés à l'ouverture, au
 * recalcul et à la clôture). Sa modification est refusée tant qu'un arrêté clôturé couvre sa date.
 * Base de démonstration (jour figé au 04/06/2026).
 */

// IBAN de test publié (exemple déjà utilisé par les tests D-BANQUE) : clé valide, aucun compte réel.
const IBAN_A = 'FR76 3000 6000 0112 3456 7890 189'

const saisie = (surcharge: Partial<SaisieCompteBancaire> = {}): SaisieCompteBancaire => ({
  nature: 'courant',
  libelle: 'Compte principal',
  iban: IBAN_A,
  bic: null,
  etablissement: null,
  ...surcharge,
})
const ouverture = (montant: string, au: string) => ({ soldeOuverture: { montant, au } })

const RELEVE = [
  { date: '2026-04-20', libelle: 'VIR AVRIL', montant: 200 },
  { date: '2026-05-10', libelle: 'VIR CHARGES', montant: 450 },
  { date: '2026-05-20', libelle: 'PRLV EAU', montant: -120.5 },
  { date: '2026-06-02', libelle: 'VIR JUIN', montant: 99 },
]

beforeEach(async () => {
  localStorage.removeItem(CLE_STOCKAGE_MODE)
  await viderBaseLocale()
  await initialiserBaseDemo()
  useDonneesStore.setState({ loaded: false, loading: false })
  await useDonneesStore.getState().loadAll()
})

describe('solde d’ouverture enregistré sur le compte', () => {
  it('création avec solde d’ouverture : deux champs de la ligne « banques », aucune écriture au journal de banque', async () => {
    const cree = await enregistrerCompteBancaire('C2', saisie(ouverture('1 000,00', '2026-05-01')))
    expect(await ajDb.banques.get(cree.id)).toMatchObject({ soldeOuvertureCentimes: 100_000, soldeOuvertureAu: '2026-05-01', actif: true })
    expect(await ajDb.ecritures.count()).toBe(0)
    expect(await ajDb.journaux.count()).toBe(0)
    const journal = await ajDb.activityLog.where('entite').equals('banques').toArray()
    expect(journal.map((entree) => entree.action)).toEqual(['create'])
  })

  it('création sans solde d’ouverture (absent ou vide) : la ligne ne porte pas ces champs', async () => {
    const sans = await enregistrerCompteBancaire('C2', saisie())
    const vide = await enregistrerCompteBancaire('C2', saisie({ soldeOuverture: { montant: '', au: '' } }))
    for (const compte of [sans, vide]) {
      const ligne = await ajDb.banques.get(compte.id)
      expect(ligne).not.toHaveProperty('soldeOuvertureCentimes')
      expect(ligne).not.toHaveProperty('soldeOuvertureAu')
    }
  })

  it('modification : saisi, modifié, puis retiré (champs à null) ; une saisie qui n’en parle pas le laisse en place', async () => {
    const { id } = await enregistrerCompteBancaire('C2', saisie())
    await enregistrerCompteBancaire('C2', saisie(ouverture('-250,10', '2026-01-01')), { id })
    expect(await ajDb.banques.get(id)).toMatchObject({ soldeOuvertureCentimes: -25_010, soldeOuvertureAu: '2026-01-01' })
    await enregistrerCompteBancaire('C2', saisie({ libelle: 'Compte de gestion' }), { id })
    expect(await ajDb.banques.get(id)).toMatchObject({ libelle: 'Compte de gestion', soldeOuvertureCentimes: -25_010, soldeOuvertureAu: '2026-01-01' })
    await enregistrerCompteBancaire('C2', saisie(ouverture('300', '2026-02-01')), { id })
    expect(await ajDb.banques.get(id)).toMatchObject({ soldeOuvertureCentimes: 30_000, soldeOuvertureAu: '2026-02-01' })
    await enregistrerCompteBancaire('C2', saisie({ soldeOuverture: null }), { id })
    expect(await ajDb.banques.get(id)).toMatchObject({ soldeOuvertureCentimes: null, soldeOuvertureAu: null })
  })

  it('saisie refusée par le domaine (date future, montant sans date, montant illisible) : rien n’est écrit', async () => {
    await expect(enregistrerCompteBancaire('C2', saisie(ouverture('100', '2026-06-05')))).rejects.toThrow(/après aujourd'hui/)
    await expect(enregistrerCompteBancaire('C2', saisie(ouverture('100', '2026-06-05')), { aujourdhui: '2026-06-05' })).resolves.toBeTruthy()
    await expect(enregistrerCompteBancaire('C2', saisie(ouverture('100', '')))).rejects.toThrow(/date à saisir/)
    await expect(enregistrerCompteBancaire('C2', saisie(ouverture('cent', '2026-05-01')))).rejects.toThrow(/Solde d’ouverture illisible/)
    expect(await ajDb.banques.count()).toBe(1)
    const { id } = (await ajDb.banques.toArray())[0]
    await expect(enregistrerCompteBancaire('C2', saisie({ libelle: 'Autre', ...ouverture('', '2026-05-01') }), { id })).rejects.toThrow(/montant à saisir/)
    expect(await ajDb.banques.get(id)).toMatchObject({ libelle: 'Compte principal', soldeOuvertureCentimes: 10_000 })
  })

  it('compte fictif de la démonstration : sans solde d’ouverture', async () => {
    await ajouterCompteBancaireDemo()
    const demo = await ajDb.banques.get(COMPTE_BANCAIRE_DEMO.id)
    expect(demo).toBeDefined()
    expect(demo).not.toHaveProperty('soldeOuvertureCentimes')
    expect(demo).not.toHaveProperty('soldeOuvertureAu')
  })
})

describe('solde compta des arrêtés avec le solde d’ouverture', () => {
  it('ouverture d’un arrêté : solde d’ouverture plus les lignes à partir de sa date, jusqu’à la date de l’arrêté', async () => {
    const { id } = await enregistrerCompteBancaire('C2', saisie(ouverture('1 000,00', '2026-05-01')))
    await importerReleveSurCompte('C2', id, RELEVE)
    // 1 000,00 + 450,00 − 120,50 ; les 200,00 du 20/04 sont déjà dans le solde d'ouverture, les 99,00 du 02/06 après l'arrêté.
    const arrete = await ouvrirArreteCompte(id, { dateArrete: '2026-05-31', soldeBanqueCentimes: 132_950 })
    expect(arrete.soldeComptaCentimes).toBe(132_950)
  })

  it('compte sans ligne importée : le solde compta est le solde d’ouverture', async () => {
    const { id } = await enregistrerCompteBancaire('C2', saisie(ouverture('-80', '2026-05-01')))
    expect((await ouvrirArreteCompte(id, { dateArrete: '2026-05-31', soldeBanqueCentimes: -8_000 })).soldeComptaCentimes).toBe(-8_000)
  })

  it('arrêté daté avant le solde d’ouverture : lignes importées seulement, comme avant', async () => {
    const { id } = await enregistrerCompteBancaire('C2', saisie(ouverture('1 000,00', '2026-05-01')))
    await importerReleveSurCompte('C2', id, RELEVE)
    expect((await ouvrirArreteCompte(id, { dateArrete: '2026-04-30', soldeBanqueCentimes: 0 })).soldeComptaCentimes).toBe(20_000)
  })

  it('l’arrêté qui ne pouvait pas se clôturer faute de solde d’ouverture se clôture une fois celui-ci saisi ; solde figé', async () => {
    const { id } = await enregistrerCompteBancaire('C2', saisie())
    await importerReleveSurCompte('C2', id, RELEVE.slice(1))
    // Le relevé de la banque dit 1 329,50 € au 31/05 : le compte existait avant le premier relevé importé.
    const arrete = await ouvrirArreteCompte(id, { dateArrete: '2026-05-31', soldeBanqueCentimes: 132_950 })
    expect(arrete.soldeComptaCentimes).toBe(32_950)
    await expect(cloturerArreteCompte(arrete.id)).rejects.toThrow('Clôture refusée : arrêté non équilibré (écart 1 000,00 €).')

    await enregistrerCompteBancaire('C2', saisie(ouverture('1 000,00', '2026-05-01')), { id })
    const cloture = await cloturerArreteCompte(arrete.id)
    expect(cloture).toMatchObject({ statut: 'Clôturé', soldeComptaCentimes: 132_950 })
    expect(await ajDb.rapprochements.get(arrete.id)).toMatchObject({ statut: 'Clôturé', soldeComptaCentimes: 132_950 })
  })
})

describe('modification du solde d’ouverture et arrêtés clôturés', () => {
  async function compteAvecArreteCloture() {
    const { id } = await enregistrerCompteBancaire('C2', saisie(ouverture('1 000,00', '2026-05-01')))
    await importerReleveSurCompte('C2', id, RELEVE)
    const arrete = await ouvrirArreteCompte(id, { dateArrete: '2026-05-31', soldeBanqueCentimes: 132_950 })
    await cloturerArreteCompte(arrete.id)
    return { id, arreteId: arrete.id }
  }
  const REFUS = 'Solde d’ouverture non modifié : l’arrêté clôturé du 31/05/2026 couvre sa date. Déclôturer d’abord cet arrêté.'

  it('arrêté clôturé qui couvre la date : modification, déplacement de la date et suppression refusés, rien n’est écrit', async () => {
    const { id } = await compteAvecArreteCloture()
    await expect(enregistrerCompteBancaire('C2', saisie({ libelle: 'Autre', ...ouverture('900', '2026-05-01') }), { id })).rejects.toThrow(REFUS)
    await expect(enregistrerCompteBancaire('C2', saisie(ouverture('1 000,00', '2026-06-01')), { id })).rejects.toThrow(REFUS)
    await expect(enregistrerCompteBancaire('C2', saisie({ soldeOuverture: null }), { id })).rejects.toThrow(REFUS)
    expect(await ajDb.banques.get(id)).toMatchObject({ libelle: 'Compte principal', soldeOuvertureCentimes: 100_000, soldeOuvertureAu: '2026-05-01' })
    const journal = await ajDb.activityLog.where('entite').equals('banques').toArray()
    expect(journal.map((entree) => entree.action)).toEqual(['create'])
  })

  it('les autres champs du compte se modifient sous un arrêté clôturé, solde d’ouverture inchangé', async () => {
    const { id } = await compteAvecArreteCloture()
    await enregistrerCompteBancaire('C2', saisie({ libelle: 'Compte de gestion', ...ouverture('1000', '2026-05-01') }), { id })
    await enregistrerCompteBancaire('C2', saisie({ etablissement: 'Banque d’exemple' }), { id })
    expect(await ajDb.banques.get(id)).toMatchObject({ libelle: 'Compte principal', etablissement: 'Banque d’exemple', soldeOuvertureCentimes: 100_000 })
  })

  it('après déclôture : le solde d’ouverture se modifie, et l’arrêté de nouveau en cours se recalcule avec lui', async () => {
    const { id, arreteId } = await compteAvecArreteCloture()
    await decloturerArreteCompte(arreteId)
    await enregistrerCompteBancaire('C2', saisie(ouverture('900', '2026-05-01')), { id })
    await expect(cloturerArreteCompte(arreteId)).rejects.toThrow('Clôture refusée : arrêté non équilibré (écart 100,00 €).')
    await enregistrerCompteBancaire('C2', saisie(ouverture('1 000,00', '2026-05-01')), { id })
    expect((await cloturerArreteCompte(arreteId)).soldeComptaCentimes).toBe(132_950)
  })

  it('arrêté clôturé antérieur à la date, arrêté en cours ou abandonné : aucun refus', async () => {
    const { id } = await enregistrerCompteBancaire('C2', saisie())
    await importerReleveSurCompte('C2', id, RELEVE)
    const avril = await ouvrirArreteCompte(id, { dateArrete: '2026-04-30', soldeBanqueCentimes: 20_000 })
    await cloturerArreteCompte(avril.id)
    const abandonne = await ouvrirArreteCompte(id, { dateArrete: '2026-05-15', soldeBanqueCentimes: 1 })
    await abandonnerArreteCompte(abandonne.id)
    await ouvrirArreteCompte(id, { dateArrete: '2026-05-31', soldeBanqueCentimes: 132_950 })
    await enregistrerCompteBancaire('C2', saisie(ouverture('1 000,00', '2026-05-01')), { id })
    expect(await ajDb.banques.get(id)).toMatchObject({ soldeOuvertureCentimes: 100_000, soldeOuvertureAu: '2026-05-01' })
    // L'arrêté clôturé d'avril garde son solde figé ; celui de mai, en cours, se clôture avec le solde d'ouverture.
    const { arretes } = await listerArretes(id)
    expect(arretes.map((arrete) => [arrete.dateArrete, arrete.statut, arrete.soldeComptaCentimes])).toEqual([
      ['2026-04-30', 'Clôturé', 20_000],
      ['2026-05-31', 'En cours', 52_950],
    ])
    expect((await cloturerArreteCompte(arretes[1].id)).soldeComptaCentimes).toBe(132_950)
  })

  it('arrêté illisible sur le compte (il pourrait cacher un arrêté clôturé) : modification refusée', async () => {
    const { id } = await enregistrerCompteBancaire('C2', saisie())
    await ajDb.rapprochements.add({
      id: 'arrete-externe',
      createdAt: '2026-11-01T08:00:00.000Z',
      updatedAt: '2026-11-01T08:00:00.000Z',
      createdBy: null,
      updatedBy: null,
      bancaireId: id,
      statut: 'Clôturé',
    })
    await expect(enregistrerCompteBancaire('C2', saisie(ouverture('100', '2026-05-01')), { id })).rejects.toThrow(/1 arrêté illisible sur ce compte/)
    expect(await ajDb.banques.get(id)).not.toHaveProperty('soldeOuvertureCentimes')
  })

  it('compte clôturé : son solde d’ouverture ne se modifie plus', async () => {
    const { id } = await enregistrerCompteBancaire('C2', saisie(ouverture('1 000,00', '2026-05-01')))
    await cloturerCompteBancaire(id)
    await expect(enregistrerCompteBancaire('C2', saisie(ouverture('5', '2026-05-01')), { id })).rejects.toThrow(
      'Compte bancaire clôturé : son solde d’ouverture ne se modifie plus.',
    )
    await expect(enregistrerCompteBancaire('C2', saisie({ soldeOuverture: null }), { id })).rejects.toThrow(/Compte bancaire clôturé/)
    expect(await ajDb.banques.get(id)).toMatchObject({ actif: false, soldeOuvertureCentimes: 100_000, soldeOuvertureAu: '2026-05-01' })
  })
})
