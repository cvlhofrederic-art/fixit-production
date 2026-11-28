import './fuseau-paris'
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { arreteCourant, controlerSaisieArrete, soldeSaisiVersCentimes } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/arretes-vue'
import { cloturerCompteBancaire, enregistrerCompteBancaire } from '@/lib/administrateur-judiciaire/db/comptes-bancaires'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import {
  abandonnerArreteCompte,
  avecSoldeComptaCourant,
  cloturerArreteCompte,
  decloturerArreteCompte,
  listerArretes,
  ouvrirArreteCompte,
} from '@/lib/administrateur-judiciaire/db/rapprochements'
import { importerReleveSurCompte } from '@/lib/administrateur-judiciaire/db/releves-bancaires'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { ajDb } from '@/lib/administrateur-judiciaire/db/schema'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import type { ArreteRapprochement } from '@/lib/administrateur-judiciaire/domain/rapprochement-bancaire'
import { CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'

/**
 * Arrêtés de rapprochement enregistrés (« Nouvel arrêté » de l'écran « Banque et recouvrement ») : table locale
 * existante « rapprochements » (index bancaireId, pas de nouvelle version de la base), règles du domaine
 * (rapprochement-bancaire.ts : ouvrirArrete, etatArrete, cloturerArrete, decloturerArrete, abandonnerArrete). Le solde
 * compta est celui du sous-compte 512 du compte à la date de l'arrêté.
 * Décision du 26/11/2026 :
 * - rb-01 A : un arrêté « En cours » s'abandonne (gardé en base, statut « Abandonné », tracé au journal d'activité) ;
 *   il ne compte plus dans aucune règle, et un nouvel arrêté s'ouvre sur le compte. Jamais un arrêté clôturé.
 * - rb-01 C et rb-03 A : le solde compta n'est plus figé à l'ouverture ; il est recalculé à la clôture (écritures
 *   connues à ce moment, à la date de l'arrêté), puis figé dans l'arrêté clôturé.
 */

// IBAN de test publiés (exemples déjà utilisés par les tests D-BANQUE) : clés valides, aucun compte réel.
const IBAN_A = 'FR76 3000 6000 0112 3456 7890 189'
const IBAN_B = 'FR14 2004 1010 0505 0001 3M02 606'

let banqueId: string

beforeEach(async () => {
  localStorage.removeItem(CLE_STOCKAGE_MODE)
  await viderBaseLocale()
  await initialiserBaseDemo()
  useDonneesStore.setState({ loaded: false, loading: false })
  await useDonneesStore.getState().loadAll()
  banqueId = (await enregistrerCompteBancaire('C2', { nature: 'courant', libelle: '', iban: IBAN_A, bic: null, etablissement: null })).id
})

describe('ouverture d’un arrêté', () => {
  it('écrit l’arrêté « En cours » dans « rapprochements » ; solde compta = sous-compte 512 du compte à la date', async () => {
    await importerReleveSurCompte('C2', banqueId, [
      { date: '2026-05-10', libelle: 'VIR CHARGES', montant: 450 },
      { date: '2026-05-20', libelle: 'PRLV EAU', montant: -120.5 },
      { date: '2026-06-02', libelle: 'VIR APRES ARRETE', montant: 99 },
    ])
    // Ni une ligne non rattachée, ni une ligne d'un autre compte n'entrent dans le solde.
    await useDonneesStore.getState().importerReleve('C2', [{ date: '2026-05-11', libelle: 'VIR ANCIEN', montant: 1000 }])
    const autre = await enregistrerCompteBancaire('C2', { nature: 'fonds_travaux', libelle: '', iban: IBAN_B, bic: null, etablissement: null })
    await importerReleveSurCompte('C2', autre.id, [{ date: '2026-05-12', libelle: 'COTISATION FONDS', montant: 300 }])

    const arrete = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 32_950 })
    expect(arrete).toMatchObject({ banqueId, dateArrete: '2026-05-31', soldeBanqueCentimes: 32_950, soldeComptaCentimes: 32_950, statut: 'En cours', elements: [] })
    const lignes = await ajDb.rapprochements.toArray()
    expect(lignes).toHaveLength(1)
    expect(lignes[0]).toMatchObject({ id: arrete.id, bancaireId: banqueId, dateArrete: '2026-05-31', statut: 'En cours', elements: [] })
    expect(lignes[0]).not.toHaveProperty('banqueId')
    expect(await listerArretes(banqueId)).toEqual({ arretes: [arrete], abandonnes: [], illisibles: 0 })
  })

  it('compte sans ligne importée : solde compta 0', async () => {
    const arrete = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 0 })
    expect(arrete.soldeComptaCentimes).toBe(0)
  })

  it('règles du domaine : un seul arrêté en cours par compte ; date postérieure au dernier ; date et soldes valides — rien n’est écrit', async () => {
    await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 0 })
    await expect(ouvrirArreteCompte(banqueId, { dateArrete: '2026-06-10', soldeBanqueCentimes: 0 })).rejects.toThrow(
      'Un arrêté est déjà en cours sur ce compte',
    )
    const [premier] = (await listerArretes(banqueId)).arretes
    await cloturerArreteCompte(premier.id)
    await expect(ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 0 })).rejects.toThrow(
      "Date d'arrêté non postérieure au dernier arrêté du compte (2026-05-31).",
    )
    await expect(ouvrirArreteCompte(banqueId, { dateArrete: '2026-02-30', soldeBanqueCentimes: 0 })).rejects.toThrow(/Date d'arrêté invalide/)
    await expect(ouvrirArreteCompte(banqueId, { dateArrete: '2026-06-30', soldeBanqueCentimes: 12.5 })).rejects.toThrow(/solde banque invalide/)
    expect(await ajDb.rapprochements.count()).toBe(1)
  })

  it('compte introuvable ou clôturé : refusé', async () => {
    await expect(ouvrirArreteCompte('inconnu', { dateArrete: '2026-05-31', soldeBanqueCentimes: 0 })).rejects.toThrow(/Compte bancaire introuvable/)
    await cloturerCompteBancaire(banqueId)
    await expect(ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 0 })).rejects.toThrow(/Compte bancaire clôturé/)
    expect(await ajDb.rapprochements.count()).toBe(0)
  })

  it('arrêté illisible écrit hors de l’écran : compté, et aucune ouverture tant qu’il reste', async () => {
    await ajDb.rapprochements.add({
      id: 'arrete-externe',
      createdAt: '2026-11-01T08:00:00.000Z',
      updatedAt: '2026-11-01T08:00:00.000Z',
      createdBy: null,
      updatedBy: null,
      bancaireId: banqueId,
      statut: 'En cours',
    })
    expect(await listerArretes(banqueId)).toEqual({ arretes: [], abandonnes: [], illisibles: 1 })
    await expect(ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 0 })).rejects.toThrow(
      /1 arrêté illisible sur ce compte/,
    )
  })
})

describe('compte clôturé : arrêtés en lecture seule (PR de suite de la 799, point 18, décision du 26/11/2026)', () => {
  it('clôture, déclôture et abandon refusés sur un compte clôturé ; lecture et état des arrêtés intacts', async () => {
    const clos = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-04-30', soldeBanqueCentimes: 0 })
    await cloturerArreteCompte(clos.id)
    const enCours = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 0 })
    // Réponse du référent métier du 28/11/2026 (point #857 · 1, choix A) : un compte ne se clôture plus avec un arrêté
    // en cours. Ce cas ne vient donc plus que d'un compte clôturé avant cette règle, écrit ici directement dans la base.
    await expect(cloturerCompteBancaire(banqueId)).rejects.toThrow(/Un arrêté est en cours sur ce compte/)
    await ajDb.banques.update(banqueId, { actif: false })
    const avant = await ajDb.rapprochements.toArray()
    const refus = /Compte bancaire clôturé : aucune écriture d’arrêté/
    await expect(cloturerArreteCompte(enCours.id)).rejects.toThrow(refus)
    await expect(abandonnerArreteCompte(enCours.id)).rejects.toThrow(refus)
    await expect(decloturerArreteCompte(clos.id)).rejects.toThrow(refus)
    await expect(ouvrirArreteCompte(banqueId, { dateArrete: '2026-06-30', soldeBanqueCentimes: 0 })).rejects.toThrow(/Compte bancaire clôturé/)
    expect(await ajDb.rapprochements.toArray()).toEqual(avant)
    const lus = await listerArretes(banqueId)
    expect(lus.arretes.map((arrete) => arrete.statut)).toEqual(['Clôturé', 'En cours'])
  })
})

describe('clôture et déclôture', () => {
  it('clôture refusée hors équilibre (écart dit par le domaine) ; acceptée à l’équilibre', async () => {
    await importerReleveSurCompte('C2', banqueId, [{ date: '2026-05-10', libelle: 'VIR CHARGES', montant: 450 }])
    const desequilibre = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 40_000 })
    await expect(cloturerArreteCompte(desequilibre.id)).rejects.toThrow('Clôture refusée : arrêté non équilibré (écart -50,00\u00a0€).')
    expect((await ajDb.rapprochements.get(desequilibre.id))?.statut).toBe('En cours')
    // Arrêté mal saisi : abandonné (rb-01), sans intervention dans la base, puis un nouveau, juste, à la même date.
    await abandonnerArreteCompte(desequilibre.id)
    const equilibre = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 45_000 })
    expect((await cloturerArreteCompte(equilibre.id)).statut).toBe('Clôturé')
    expect((await ajDb.rapprochements.get(equilibre.id))?.statut).toBe('Clôturé')
  })

  it('déclôture du dernier arrêté clôturé seulement, et jamais pendant un arrêté en cours', async () => {
    const premier = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-04-30', soldeBanqueCentimes: 0 })
    await cloturerArreteCompte(premier.id)
    const second = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 0 })
    await expect(decloturerArreteCompte(premier.id)).rejects.toThrow('Déclôture refusée : un arrêté est en cours sur ce compte.')
    await cloturerArreteCompte(second.id)
    await expect(decloturerArreteCompte(premier.id)).rejects.toThrow(
      'Déclôture refusée : seul le dernier arrêté clôturé du compte peut être déclôturé.',
    )
    expect((await decloturerArreteCompte(second.id)).statut).toBe('En cours')
    expect((await ajDb.rapprochements.get(second.id))?.statut).toBe('En cours')
  })
})

describe('abandon d’un arrêté en cours (rb-01 A, décision du 26/11/2026)', () => {
  it('l’arrêté est gardé, « Abandonné », tracé au journal d’activité ; un nouvel arrêté s’ouvre ensuite sur le compte', async () => {
    await importerReleveSurCompte('C2', banqueId, [{ date: '2026-05-10', libelle: 'VIR CHARGES', montant: 450 }])
    // Faute de frappe dans le solde banque : 4 500,00 € au lieu de 450,00 €.
    const errone = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 450_000 })
    const abandonne = await abandonnerArreteCompte(errone.id, { actor: 'gestionnaire-test' })
    expect(abandonne).toEqual({ ...errone, statut: 'Abandonné' })

    // Jamais effacé : la ligne reste, avec ses montants, sous le statut « Abandonné ».
    const ligne = await ajDb.rapprochements.get(errone.id)
    expect(ligne).toMatchObject({
      bancaireId: banqueId,
      dateArrete: '2026-05-31',
      soldeBanqueCentimes: 450_000,
      soldeComptaCentimes: 45_000,
      statut: 'Abandonné',
      updatedBy: 'gestionnaire-test',
    })
    const journal = (await ajDb.activityLog.where('entiteId').equals(errone.id).toArray()).filter((entree) => entree.action === 'update')
    expect(journal).toHaveLength(1)
    expect(journal[0]).toMatchObject({ entite: 'rapprochements', qui: 'gestionnaire-test', avant: { statut: 'En cours' }, apres: { statut: 'Abandonné' } })

    // Ni arrêté en cours, ni arrêté illisible : il est lu à part.
    expect(await listerArretes(banqueId)).toEqual({ arretes: [], abandonnes: [abandonne], illisibles: 0 })

    // Un nouvel arrêté, juste, à la même date.
    const juste = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 45_000 })
    expect((await cloturerArreteCompte(juste.id)).statut).toBe('Clôturé')
    expect(await listerArretes(banqueId)).toEqual({ arretes: [{ ...juste, statut: 'Clôturé' }], abandonnes: [abandonne], illisibles: 0 })
    expect(await ajDb.rapprochements.count()).toBe(2)
  })

  it('refusé pour un arrêté clôturé, déjà abandonné ou introuvable : rien n’est écrit', async () => {
    const cloture = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-04-30', soldeBanqueCentimes: 0 })
    await cloturerArreteCompte(cloture.id)
    await expect(abandonnerArreteCompte(cloture.id)).rejects.toThrow(
      'Abandon refusé : seul un arrêté en cours peut être abandonné (arrêté « Clôturé »).',
    )
    expect((await ajDb.rapprochements.get(cloture.id))?.statut).toBe('Clôturé')

    const enCours = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 0 })
    await abandonnerArreteCompte(enCours.id)
    const avant = await ajDb.activityLog.count()
    await expect(abandonnerArreteCompte(enCours.id)).rejects.toThrow('Arrêté abandonné : ni clôture, ni déclôture, ni nouvel abandon.')
    await expect(abandonnerArreteCompte('inconnu')).rejects.toThrow('Arrêté introuvable : « inconnu ».')
    expect(await ajDb.activityLog.count()).toBe(avant)
  })

  it('arrêté abandonné absent des contrôles : ni « en cours », ni « dernier arrêté », ni clôture, ni déclôture', async () => {
    const premier = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-04-30', soldeBanqueCentimes: 0 })
    await cloturerArreteCompte(premier.id)
    // Date erronée : arrêté ouvert au 30/06 au lieu du 31/05.
    const errone = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-06-30', soldeBanqueCentimes: 0 })
    await abandonnerArreteCompte(errone.id)

    // Il n'est plus « en cours » : le dernier arrêté clôturé se déclôture, puis se reclôture.
    expect((await decloturerArreteCompte(premier.id)).statut).toBe('En cours')
    await cloturerArreteCompte(premier.id)
    // Il n'est pas « le dernier arrêté du compte » : un arrêté daté avant lui s'ouvre (après le dernier arrêté vivant).
    const juste = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 0 })
    expect(juste.statut).toBe('En cours')
    await expect(ouvrirArreteCompte(banqueId, { dateArrete: '2026-07-31', soldeBanqueCentimes: 0 })).rejects.toThrow(
      'Un arrêté est déjà en cours sur ce compte',
    )

    // Aucune écriture ne le reprend : ni clôture ni déclôture, et il garde son statut.
    await expect(cloturerArreteCompte(errone.id)).rejects.toThrow('Arrêté abandonné : ni clôture, ni déclôture, ni nouvel abandon.')
    await expect(decloturerArreteCompte(errone.id)).rejects.toThrow('Arrêté abandonné : ni clôture, ni déclôture, ni nouvel abandon.')
    expect((await ajDb.rapprochements.get(errone.id))?.statut).toBe('Abandonné')
    const { arretes, abandonnes, illisibles } = await listerArretes(banqueId)
    expect(arretes.map((arrete) => [arrete.dateArrete, arrete.statut])).toEqual([
      ['2026-04-30', 'Clôturé'],
      ['2026-05-31', 'En cours'],
    ])
    expect(abandonnes.map((arrete) => arrete.id)).toEqual([errone.id])
    expect(illisibles).toBe(0)
  })

  it('arrêté illisible sur le compte : abandon refusé, comme les autres écritures', async () => {
    const enCours = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 0 })
    await ajDb.rapprochements.add({
      id: 'arrete-externe',
      createdAt: '2026-11-01T08:00:00.000Z',
      updatedAt: '2026-11-01T08:00:00.000Z',
      createdBy: null,
      updatedBy: null,
      bancaireId: banqueId,
      statut: 'Abandonné',
    })
    // Une ligne « Abandonné » sans la forme d'un arrêté reste illisible.
    expect((await listerArretes(banqueId)).illisibles).toBe(1)
    await expect(abandonnerArreteCompte(enCours.id)).rejects.toThrow(/1 arrêté illisible sur ce compte/)
    expect((await ajDb.rapprochements.get(enCours.id))?.statut).toBe('En cours')
  })
})

describe('solde compta recalculé à la clôture, puis figé (rb-01 C et rb-03 A, décision du 26/11/2026)', () => {
  it('relevé importé après l’ouverture, daté avant l’arrêté : la clôture reste possible, sur le solde recalculé', async () => {
    await importerReleveSurCompte('C2', banqueId, [{ date: '2026-05-10', libelle: 'VIR CHARGES', montant: 450 }])
    // Solde banque du relevé au 31/05 : 329,50 € ; le prélèvement du 20/05 n'est pas encore importé.
    const ouvert = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 32_950 })
    expect(ouvert.soldeComptaCentimes).toBe(45_000)
    await importerReleveSurCompte('C2', banqueId, [
      { date: '2026-05-20', libelle: 'PRLV EAU', montant: -120.5 },
      // Après la date de l'arrêté : hors du solde.
      { date: '2026-06-02', libelle: 'VIR JUIN', montant: 99 },
    ])

    const cloture = await cloturerArreteCompte(ouvert.id)
    expect(cloture).toMatchObject({ statut: 'Clôturé', soldeBanqueCentimes: 32_950, soldeComptaCentimes: 32_950 })
    // Le solde recalculé est enregistré avec la clôture.
    expect(await ajDb.rapprochements.get(ouvert.id)).toMatchObject({ statut: 'Clôturé', soldeComptaCentimes: 32_950 })
  })

  it('l’équilibre se contrôle sur le solde recalculé : un arrêté équilibré à l’ouverture ne se clôture plus si le compte a bougé', async () => {
    await importerReleveSurCompte('C2', banqueId, [{ date: '2026-05-10', libelle: 'VIR CHARGES', montant: 450 }])
    const ouvert = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 45_000 })
    await importerReleveSurCompte('C2', banqueId, [{ date: '2026-05-20', libelle: 'PRLV EAU', montant: -120.5 }])
    await expect(cloturerArreteCompte(ouvert.id)).rejects.toThrow('Clôture refusée : arrêté non équilibré (écart 120,50\u00a0€).')
    // Refus : rien n'est écrit, ni le statut ni le solde.
    expect(await ajDb.rapprochements.get(ouvert.id)).toMatchObject({ statut: 'En cours', soldeComptaCentimes: 45_000 })
  })

  it('solde figé après la clôture : un relevé importé ensuite ne le change plus ; une seconde clôture est refusée', async () => {
    await importerReleveSurCompte('C2', banqueId, [{ date: '2026-05-10', libelle: 'VIR CHARGES', montant: 450 }])
    const ouvert = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 45_000 })
    await cloturerArreteCompte(ouvert.id)
    await importerReleveSurCompte('C2', banqueId, [{ date: '2026-05-25', libelle: 'FRAIS TENUE', montant: -12 }])

    await expect(cloturerArreteCompte(ouvert.id)).rejects.toThrow('Clôture refusée : arrêté déjà clôturé.')
    expect(await ajDb.rapprochements.get(ouvert.id)).toMatchObject({ statut: 'Clôturé', soldeComptaCentimes: 45_000 })
    const [lu] = (await listerArretes(banqueId)).arretes
    expect(lu).toMatchObject({ statut: 'Clôturé', soldeComptaCentimes: 45_000 })

    // Déclôturé, l'arrêté est de nouveau en cours : sa clôture recalcule le solde, avec la ligne arrivée entre-temps.
    await decloturerArreteCompte(ouvert.id)
    await expect(cloturerArreteCompte(ouvert.id)).rejects.toThrow('Clôture refusée : arrêté non équilibré (écart 12,00\u00a0€).')
  })

  it('solde compta d’un arrêté : recalculé tant qu’il est en cours, figé une fois clôturé (lecture de l’écran)', () => {
    const ecritures = [
      { compte: '512-B1', sens: 'debit' as const, montant: 450, date: new Date(2026, 4, 10) },
      { compte: '512-B1', sens: 'credit' as const, montant: 120.5, date: new Date(2026, 4, 20) },
      { compte: '512-B1', sens: 'debit' as const, montant: 99, date: new Date(2026, 5, 2) },
      { compte: '512-B2', sens: 'debit' as const, montant: 1000, date: new Date(2026, 4, 11) },
      { compte: '512', sens: 'debit' as const, montant: 77, date: new Date(2026, 4, 12) },
    ]
    const enCours: ArreteRapprochement = {
      id: 'a',
      banqueId: 'B1',
      dateArrete: '2026-05-31',
      soldeBanqueCentimes: 32_950,
      soldeComptaCentimes: 45_000,
      statut: 'En cours',
      elements: [],
    }
    expect(avecSoldeComptaCourant(enCours, ecritures)).toEqual({ ...enCours, soldeComptaCentimes: 32_950 })
    // Aucune écriture sur le sous-compte : 0, comme à l'ouverture.
    expect(avecSoldeComptaCourant({ ...enCours, banqueId: 'B9' }, ecritures).soldeComptaCentimes).toBe(0)
    const cloture: ArreteRapprochement = { ...enCours, statut: 'Clôturé' }
    expect(avecSoldeComptaCourant(cloture, ecritures)).toBe(cloture)
  })
})

describe('saisie et vue de l’arrêté (écran)', () => {
  it('solde saisi en euros : centimes entiers, négatif admis (découvert) ; vide, illisible ou plus de deux décimales : null', () => {
    expect(soldeSaisiVersCentimes('1 234,56')).toBe(123_456)
    expect(soldeSaisiVersCentimes('-35,5')).toBe(-3_550)
    expect(soldeSaisiVersCentimes('0')).toBe(0)
    expect(soldeSaisiVersCentimes('')).toBeNull()
    expect(soldeSaisiVersCentimes('12,345')).toBeNull()
    expect(soldeSaisiVersCentimes('douze')).toBeNull()
  })

  it('contrôle de la saisie : date valide et non postérieure à aujourd’hui, solde lisible', () => {
    expect(controlerSaisieArrete({ date: '2026-05-31', soldeBanque: '329,50' }, '2026-06-04')).toEqual({
      saisie: { dateArrete: '2026-05-31', soldeBanqueCentimes: 32_950 },
    })
    expect(controlerSaisieArrete({ date: '', soldeBanque: '1' }, '2026-06-04')).toEqual({ erreur: 'Date de l’arrêté à saisir.' })
    expect(controlerSaisieArrete({ date: '2026-06-05', soldeBanque: '1' }, '2026-06-04')).toEqual({
      erreur: "Arrêté daté du 05/06/2026, après aujourd'hui.",
    })
    expect(controlerSaisieArrete({ date: '2026-05-31', soldeBanque: 'abc' }, '2026-06-04')).toEqual({
      erreur: 'Solde banque illisible : montant en euros attendu (ex. 1 234,56 ; négatif pour un découvert).',
    })
  })

  it('arrêté affiché : celui en cours, sinon le dernier par date, sinon aucun', () => {
    const arrete = (id: string, dateArrete: string, statut: ArreteRapprochement['statut']): ArreteRapprochement => ({
      id,
      banqueId: 'B1',
      dateArrete,
      soldeBanqueCentimes: 0,
      soldeComptaCentimes: 0,
      statut,
      elements: [],
    })
    expect(arreteCourant([])).toBeNull()
    expect(arreteCourant([arrete('a', '2026-05-31', 'Clôturé'), arrete('b', '2026-04-30', 'Clôturé')])?.id).toBe('a')
    expect(arreteCourant([arrete('a', '2026-05-31', 'Clôturé'), arrete('b', '2026-06-30', 'En cours')])?.id).toBe('b')
  })
})

describe('message de clôture refusée (écart en euros)', () => {
  it('dit l’écart en euros au format français, non en centimes', async () => {
    await importerReleveSurCompte('C2', banqueId, [{ date: '2026-05-10', libelle: 'VIR CHARGES', montant: 450 }])
    const ouvert = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 45_000 })
    await importerReleveSurCompte('C2', banqueId, [{ date: '2026-05-20', libelle: 'PRLV EAU', montant: -1_345.5 }])
    const erreur = await cloturerArreteCompte(ouvert.id).then(
      () => null,
      (e: unknown) => e as Error,
    )
    expect(erreur?.message).toBe('Clôture refusée : arrêté non équilibré (écart 1\u00a0345,50\u00a0€).')
    expect(erreur?.message).not.toMatch(/centimes/)
  })
})

describe('arrêté clôturé, déclôturé, puis abandonné', () => {
  // comportement soumis au référent métier (question du 26/11/2026) : à adapter selon sa réponse
  it('la période n’est plus arrêtée et l’arrêté abandonné n’apparaît pas dans la liste des arrêtés (comportement actuel)', async () => {
    const arrete = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 0 })
    await cloturerArreteCompte(arrete.id)
    await decloturerArreteCompte(arrete.id)
    await abandonnerArreteCompte(arrete.id)
    expect((await ajDb.rapprochements.get(arrete.id))?.statut).toBe('Abandonné')
    const { arretes, abandonnes } = await listerArretes(banqueId)
    expect(arretes).toEqual([])
    expect(abandonnes.map((a) => a.id)).toEqual([arrete.id])
    expect(arreteCourant(arretes)).toBeNull()
  })
})
