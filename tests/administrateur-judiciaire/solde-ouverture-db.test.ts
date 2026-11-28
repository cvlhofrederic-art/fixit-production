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
 * Réponses du référent métier du 28/11/2026 (PR 848) : solde de FIN de journée (point 2, choix B : seules les lignes
 * datées après son jour s'y ajoutent) ; solde d'ouverture daté après un arrêté du compte refusé (point 4, choix A) ;
 * arrêté daté avant le solde d'ouverture refusé, « solde inconnu avant le JJ/MM/AAAA » (point 5, choix A).
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
  it('ouverture d’un arrêté : solde d’ouverture plus les lignes datées après son jour, jusqu’à la date de l’arrêté', async () => {
    const { id } = await enregistrerCompteBancaire('C2', saisie(ouverture('1 000,00', '2026-05-01')))
    await importerReleveSurCompte('C2', id, RELEVE)
    // 1 000,00 + 450,00 − 120,50 ; les 200,00 du 20/04 sont déjà dans le solde d'ouverture, les 99,00 du 02/06 après l'arrêté.
    const arrete = await ouvrirArreteCompte(id, { dateArrete: '2026-05-31', soldeBanqueCentimes: 132_950 })
    expect(arrete.soldeComptaCentimes).toBe(132_950)
  })

  it('solde d’ouverture daté du jour d’une ligne (fin de journée, point 2) : cette ligne y est déjà, elle n’est pas comptée deux fois', async () => {
    // Ancien solde du relevé recopié tel quel : 1 650,00 € au 10/05/2026, virement de 450,00 € de ce jour compris.
    const { id } = await enregistrerCompteBancaire('C2', saisie(ouverture('1 650,00', '2026-05-10')))
    await importerReleveSurCompte('C2', id, RELEVE)
    // 1 650,00 − 120,50.
    const arrete = await ouvrirArreteCompte(id, { dateArrete: '2026-05-31', soldeBanqueCentimes: 152_950 })
    expect(arrete.soldeComptaCentimes).toBe(152_950)
    expect((await cloturerArreteCompte(arrete.id)).statut).toBe('Clôturé')
  })

  it('compte sans ligne importée : le solde compta est le solde d’ouverture', async () => {
    const { id } = await enregistrerCompteBancaire('C2', saisie(ouverture('-80', '2026-05-01')))
    expect((await ouvrirArreteCompte(id, { dateArrete: '2026-05-31', soldeBanqueCentimes: -8_000 })).soldeComptaCentimes).toBe(-8_000)
  })

  it('arrêté daté avant le solde d’ouverture (point 5) : refusé, « solde inconnu avant le JJ/MM/AAAA », rien n’est écrit', async () => {
    const { id } = await enregistrerCompteBancaire('C2', saisie(ouverture('1 000,00', '2026-05-01')))
    await importerReleveSurCompte('C2', id, RELEVE)
    await expect(ouvrirArreteCompte(id, { dateArrete: '2026-04-30', soldeBanqueCentimes: 20_000 })).rejects.toThrow(
      'Arrêté daté du 30/04/2026 : solde inconnu avant le 01/05/2026, date du solde d’ouverture du compte.',
    )
    expect(await ajDb.rapprochements.count()).toBe(0)
  })

  it('arrêté du jour même du solde d’ouverture : admis, son solde compta est ce solde (les lignes de ce jour y sont déjà)', async () => {
    const { id } = await enregistrerCompteBancaire('C2', saisie(ouverture('1 650,00', '2026-05-10')))
    await importerReleveSurCompte('C2', id, RELEVE)
    const arrete = await ouvrirArreteCompte(id, { dateArrete: '2026-05-10', soldeBanqueCentimes: 165_000 })
    expect(arrete.soldeComptaCentimes).toBe(165_000)
    expect((await cloturerArreteCompte(arrete.id)).soldeComptaCentimes).toBe(165_000)
  })

  it('les autres refus d’une ouverture gardent leur message : la date vient en dernier hors de l’écran', async () => {
    const { id } = await enregistrerCompteBancaire('C2', saisie(ouverture('1 000,00', '2026-05-01')))
    await ouvrirArreteCompte(id, { dateArrete: '2026-05-31', soldeBanqueCentimes: 0 })
    await expect(ouvrirArreteCompte(id, { dateArrete: '2026-04-30', soldeBanqueCentimes: 0 })).rejects.toThrow(
      'Un arrêté est déjà en cours sur ce compte : le clôturer d’abord.',
    )
  })

  it('arrêté en cours daté avant un solde d’ouverture écrit hors de l’écran : clôture refusée, l’arrêté reste en cours', async () => {
    const { id } = await enregistrerCompteBancaire('C2', saisie())
    await importerReleveSurCompte('C2', id, RELEVE)
    const arrete = await ouvrirArreteCompte(id, { dateArrete: '2026-04-30', soldeBanqueCentimes: 20_000 })
    // L'écran refuse ce solde d'ouverture (daté après un arrêté du compte, point 4) : écrit ici directement dans la base.
    await ajDb.banques.update(id, { soldeOuvertureCentimes: 100_000, soldeOuvertureAu: '2026-05-01' })
    await expect(cloturerArreteCompte(arrete.id)).rejects.toThrow(
      'Arrêté daté du 30/04/2026 : solde inconnu avant le 01/05/2026, date du solde d’ouverture du compte.',
    )
    expect(await ajDb.rapprochements.get(arrete.id)).toMatchObject({ statut: 'En cours' })
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
  const REGLE_PREMIER_ARRETE = 'Un solde d’ouverture se date avant le premier arrêté du compte, ou le même jour.'

  it('arrêté clôturé qui couvre la date : modification, déplacement de la date et suppression refusés, rien n’est écrit', async () => {
    const { id } = await compteAvecArreteCloture()
    await expect(enregistrerCompteBancaire('C2', saisie({ libelle: 'Autre', ...ouverture('900', '2026-05-01') }), { id })).rejects.toThrow(REFUS)
    await expect(enregistrerCompteBancaire('C2', saisie(ouverture('1 000,00', '2026-05-15')), { id })).rejects.toThrow(REFUS)
    // Date déplacée après l'arrêté : déclôturer ne suffirait pas, la date elle-même est refusée (point 4).
    await expect(enregistrerCompteBancaire('C2', saisie(ouverture('1 000,00', '2026-06-01')), { id })).rejects.toThrow(
      `Solde d’ouverture refusé : daté du 01/06/2026, après le premier arrêté du compte (31/05/2026, clôturé). ${REGLE_PREMIER_ARRETE} Le dater au plus tard du 31/05/2026, après avoir déclôturé cet arrêté.`,
    )
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

  /**
   * Point 4, choix A (réponse du référent métier du 28/11/2026) : « Le refuser : un solde d'ouverture se date avant le
   * premier arrêté du compte. » Le relevé de mai n'a jamais été importé : la banque donne 200,00 € au 30/04, puis
   * 529,50 € au 01/06. Un solde d'ouverture au 01/06, postérieur à l'arrêté clôturé du 30/04, ferait sauter le solde du
   * compte après une période rapprochée, sans écriture ni ligne de relevé : il est refusé.
   */
  it('solde d’ouverture daté après un arrêté clôturé du compte : refusé, rien n’est écrit', async () => {
    const { id } = await enregistrerCompteBancaire('C2', saisie())
    await importerReleveSurCompte('C2', id, [RELEVE[0], RELEVE[3]])
    const avril = await ouvrirArreteCompte(id, { dateArrete: '2026-04-30', soldeBanqueCentimes: 20_000 })
    await cloturerArreteCompte(avril.id)
    await ouvrirArreteCompte(id, { dateArrete: '2026-06-03', soldeBanqueCentimes: 62_850 })
    await expect(enregistrerCompteBancaire('C2', saisie({ libelle: 'Autre', ...ouverture('529,50', '2026-06-01') }), { id })).rejects.toThrow(
      `Solde d’ouverture refusé : daté du 01/06/2026, après le premier arrêté du compte (30/04/2026, clôturé). ${REGLE_PREMIER_ARRETE} Le dater au plus tard du 30/04/2026, après avoir déclôturé cet arrêté.`,
    )
    const ligne = await ajDb.banques.get(id)
    expect(ligne).toMatchObject({ libelle: 'Compte principal' })
    expect(ligne).not.toHaveProperty('soldeOuvertureCentimes')
    const { arretes } = await listerArretes(id)
    expect(arretes.map((arrete) => [arrete.dateArrete, arrete.statut, arrete.soldeComptaCentimes])).toEqual([
      ['2026-04-30', 'Clôturé', 20_000],
      ['2026-06-03', 'En cours', 29_900],
    ])
  })

  it('solde d’ouverture daté après un arrêté en cours : refusé aussi ; le même jour : admis, et l’arrêté se recalcule avec lui', async () => {
    const { id } = await enregistrerCompteBancaire('C2', saisie())
    await importerReleveSurCompte('C2', id, RELEVE)
    // La banque donne 1 529,50 € au 31/05 : le compte existait avant le premier relevé importé.
    const mai = await ouvrirArreteCompte(id, { dateArrete: '2026-05-31', soldeBanqueCentimes: 152_950 })
    await expect(enregistrerCompteBancaire('C2', saisie(ouverture('1 529,50', '2026-06-01')), { id })).rejects.toThrow(
      `Solde d’ouverture refusé : daté du 01/06/2026, après le premier arrêté du compte (31/05/2026, en cours). ${REGLE_PREMIER_ARRETE} Le dater au plus tard du 31/05/2026, ou abandonner d’abord cet arrêté en cours.`,
    )
    expect(await ajDb.banques.get(id)).not.toHaveProperty('soldeOuvertureCentimes')
    await enregistrerCompteBancaire('C2', saisie(ouverture('1 529,50', '2026-05-31')), { id })
    expect((await cloturerArreteCompte(mai.id)).soldeComptaCentimes).toBe(152_950)
  })

  it('arrêté abandonné : il ne compte pas, un solde d’ouverture daté après lui est admis', async () => {
    const { id } = await enregistrerCompteBancaire('C2', saisie())
    const abandonne = await ouvrirArreteCompte(id, { dateArrete: '2026-05-15', soldeBanqueCentimes: 1 })
    await abandonnerArreteCompte(abandonne.id)
    await enregistrerCompteBancaire('C2', saisie(ouverture('529,50', '2026-06-01')), { id })
    expect(await ajDb.banques.get(id)).toMatchObject({ soldeOuvertureCentimes: 52_950, soldeOuvertureAu: '2026-06-01' })
  })

  it('arrêté en cours après l’arrêté clôturé qui couvre la date : le refus dit d’abandonner d’abord, et ce chemin marche', async () => {
    const { id } = await enregistrerCompteBancaire('C2', saisie(ouverture('1 000,00', '2026-05-01')))
    await importerReleveSurCompte('C2', id, RELEVE)
    // 1 000,00 + 450,00 au 15/05 ; 1 329,50 au 31/05.
    const quinze = await ouvrirArreteCompte(id, { dateArrete: '2026-05-15', soldeBanqueCentimes: 145_000 })
    await cloturerArreteCompte(quinze.id)
    const mai = await ouvrirArreteCompte(id, { dateArrete: '2026-05-31', soldeBanqueCentimes: 132_950 })
    await expect(enregistrerCompteBancaire('C2', saisie(ouverture('900', '2026-05-01')), { id })).rejects.toThrow(
      'Solde d’ouverture non modifié : l’arrêté clôturé du 15/05/2026 couvre sa date. Déclôturer d’abord cet arrêté (après avoir abandonné l’arrêté en cours du 31/05/2026).',
    )
    // Sans l'abandon, la déclôture est refusée elle aussi : le message doit donc l'annoncer.
    await expect(decloturerArreteCompte(quinze.id)).rejects.toThrow('Déclôture refusée : un arrêté est en cours sur ce compte.')
    await abandonnerArreteCompte(mai.id)
    await decloturerArreteCompte(quinze.id)
    await enregistrerCompteBancaire('C2', saisie(ouverture('900', '2026-05-01')), { id })
    expect(await ajDb.banques.get(id)).toMatchObject({ soldeOuvertureCentimes: 90_000, soldeOuvertureAu: '2026-05-01' })
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

  it('arrêté illisible sur le compte, solde d’ouverture renvoyé inchangé (le formulaire l’envoie toujours) : les autres champs se modifient', async () => {
    const { id } = await enregistrerCompteBancaire('C2', saisie(ouverture('1 000,00', '2026-05-01')))
    await ajDb.rapprochements.add({
      id: 'arrete-externe',
      createdAt: '2026-11-01T08:00:00.000Z',
      updatedAt: '2026-11-01T08:00:00.000Z',
      createdBy: null,
      updatedBy: null,
      bancaireId: id,
      statut: 'Clôturé',
    })
    await enregistrerCompteBancaire('C2', saisie({ libelle: 'Compte de gestion', ...ouverture('1000', '2026-05-01') }), { id })
    expect(await ajDb.banques.get(id)).toMatchObject({ libelle: 'Compte de gestion', soldeOuvertureCentimes: 100_000, soldeOuvertureAu: '2026-05-01' })
    // Le solde d'ouverture, lui, reste refusé tant que l'arrêté illisible est là.
    await expect(enregistrerCompteBancaire('C2', saisie({ libelle: 'Autre', ...ouverture('900', '2026-05-01') }), { id })).rejects.toThrow(/1 arrêté illisible sur ce compte/)
    expect(await ajDb.banques.get(id)).toMatchObject({ libelle: 'Compte de gestion', soldeOuvertureCentimes: 100_000 })
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
