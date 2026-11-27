import './fuseau-paris'
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { enregistrerCompteBancaire } from '@/lib/administrateur-judiciaire/db/comptes-bancaires'
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
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { compteBanque } from '@/lib/administrateur-judiciaire/db/sous-comptes-banque'
import {
  dateDerniereCloture,
  lignesEnPeriodeArretee,
  motifPeriodeArretee,
  refuserImportEnPeriodeArretee,
} from '@/lib/administrateur-judiciaire/domain/periode-arretee'
import type { ArreteRapprochement } from '@/lib/administrateur-judiciaire/domain/rapprochement-bancaire'
import { CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'

/**
 * Période déjà arrêtée protégée (décision du 26/11/2026 du référent métier, PR 799, rb-04 A) : un relevé dont une ligne
 * retenue est datée au plus tard du dernier arrêté CLÔTURÉ du compte n'est pas importé, il changerait après coup le
 * solde de cette période. Le relevé est refusé en entier (un import partiel, puis un second import après la déclôture,
 * créerait des doublons : les relevés importés ne sont pas mémorisés). Un arrêté en cours ou abandonné ne protège rien ;
 * un arrêté déclôturé redevient en cours. La règle est dans le domaine, et dans la transaction d'écriture de la base
 * locale : un appel qui contourne l'écran est refusé lui aussi.
 */

// IBAN de test publiés (exemples déjà utilisés par les tests D-BANQUE) : clés valides, aucun compte réel.
const IBAN_A = 'FR76 3000 6000 0112 3456 7890 189'
const IBAN_B = 'FR14 2004 1010 0505 0001 3M02 606'

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

/** Constat quand seul le dernier arrêté clôturé (31/05/2026) contient une ligne. */
const SEUL_CONCERNE = { lignes: 1, dateArrete: '2026-05-31', arreteEnCours: null, arretesConcernes: 1, plusAncienArrete: '2026-05-31' }

// Plusieurs arrêtés clôturés concernés (retour de relecture) : déclôturer le dernier ne suffit pas, et le motif le dit.
const PLUSIEURS_QUOI_FAIRE =
  'Aucune ligne du relevé n’est importée, et déclôturer le dernier arrêté ne suffit pas. Pour importer le relevé en entier : '
const PLUSIEURS_UN_PAR_UN =
  'déclôturer ces arrêtés un par un, du plus récent au plus ancien, en abandonnant chaque arrêté déclôturé avant de déclôturer le ' +
  'précédent. Un abandon est définitif : l’arrêté abandonné est à refaire.'

describe('domaine : lignes datées dans une période arrêtée', () => {
  it('date du dernier arrêté clôturé du compte ; null sans arrêté clôturé', () => {
    const arretes = [
      arrete({ id: 'A1', dateArrete: '2026-04-30' }),
      arrete({ id: 'A2', dateArrete: '2026-05-31' }),
      arrete({ id: 'A3', dateArrete: '2026-06-30', statut: 'En cours' }),
      arrete({ id: 'A4', banqueId: 'B2', dateArrete: '2026-07-31' }),
    ]
    expect(dateDerniereCloture(arretes, 'B1')).toBe('2026-05-31')
    expect(dateDerniereCloture(arretes, 'B2')).toBe('2026-07-31')
    expect(dateDerniereCloture(arretes, 'B3')).toBeNull()
    expect(dateDerniereCloture([arrete({ statut: 'En cours' })], 'B1')).toBeNull()
    expect(dateDerniereCloture([], 'B1')).toBeNull()
  })

  it('compte les lignes datées au plus tard de l’arrêté clôturé, ce jour compris ; null si aucune', () => {
    const arretes = [arrete()]
    expect(lignesEnPeriodeArretee(arretes, 'B1', ['2026-05-30', '2026-05-31', '2026-06-01'])).toEqual({
      lignes: 2,
      dateArrete: '2026-05-31',
      arreteEnCours: null,
      arretesConcernes: 1,
      plusAncienArrete: '2026-05-31',
    })
    expect(lignesEnPeriodeArretee(arretes, 'B1', ['2026-06-01', '2026-06-02'])).toBeNull()
    expect(lignesEnPeriodeArretee(arretes, 'B1', [])).toBeNull()
  })

  it('un arrêté en cours ne protège rien ; l’arrêté d’un autre compte non plus', () => {
    expect(lignesEnPeriodeArretee([arrete({ statut: 'En cours' })], 'B1', ['2026-05-10'])).toBeNull()
    expect(lignesEnPeriodeArretee([arrete({ banqueId: 'B2' })], 'B1', ['2026-05-10'])).toBeNull()
  })

  it('arrêté en cours après l’arrêté clôturé : sa date est rendue (il empêche la déclôture)', () => {
    const arretes = [arrete(), arrete({ id: 'A2', dateArrete: '2026-06-10', statut: 'En cours' })]
    expect(lignesEnPeriodeArretee(arretes, 'B1', ['2026-05-10', '2026-06-05'])).toEqual({
      lignes: 1,
      dateArrete: '2026-05-31',
      arreteEnCours: '2026-06-10',
      arretesConcernes: 1,
      plusAncienArrete: '2026-05-31',
    })
  })

  it('date qui n’est pas une date (écriture sans date lisible) : comptée, comme dans le solde de toute période', () => {
    expect(lignesEnPeriodeArretee([arrete()], 'B1', [''])?.lignes).toBe(1)
  })

  it('plusieurs arrêtés clôturés : ceux dont la période contient une ligne sont comptés, le plus ancien est rendu', () => {
    const arretes = [
      arrete({ id: 'A0', dateArrete: '2026-03-31' }),
      arrete({ id: 'A1', dateArrete: '2026-04-30' }),
      arrete({ id: 'A2', dateArrete: '2026-05-31' }),
      arrete({ id: 'A9', banqueId: 'B2', dateArrete: '2026-04-25' }),
    ]
    // Ligne du 20/04 : elle entre dans le solde figé au 30/04 et dans celui au 31/05, pas dans celui au 31/03.
    expect(lignesEnPeriodeArretee(arretes, 'B1', ['2026-04-20', '2026-05-20', '2026-06-02'])).toEqual({
      lignes: 2,
      dateArrete: '2026-05-31',
      arreteEnCours: null,
      arretesConcernes: 2,
      plusAncienArrete: '2026-04-30',
    })
    // Le jour même d'un arrêté plus ancien : dans sa période.
    expect(lignesEnPeriodeArretee(arretes, 'B1', ['2026-03-31'])).toMatchObject({ lignes: 1, arretesConcernes: 3, plusAncienArrete: '2026-03-31' })
    // Lignes postérieures à l'avant-dernier arrêté : seul le dernier est concerné.
    expect(lignesEnPeriodeArretee(arretes, 'B1', ['2026-05-01', '2026-05-20'])).toMatchObject({
      lignes: 2,
      arretesConcernes: 1,
      plusAncienArrete: '2026-05-31',
    })
    // Date qui n'en est pas une : l'écriture entre dans le solde de toute période, tous les arrêtés clôturés sont concernés.
    expect(lignesEnPeriodeArretee(arretes, 'B1', [''])).toMatchObject({ lignes: 1, arretesConcernes: 3, plusAncienArrete: '2026-03-31' })
  })

  it('motif, plusieurs arrêtés clôturés concernés : déclôturer le dernier ne suffit pas, et l’abandon qu’il faudrait est dit définitif', () => {
    expect(
      motifPeriodeArretee({ lignes: 2, dateArrete: '2026-05-31', arreteEnCours: null, arretesConcernes: 2, plusAncienArrete: '2026-04-30' }),
    ).toBe(
      '2 lignes sont datées au plus tard du 31/05/2026, date du dernier arrêté clôturé de ce compte, et 2 arrêtés clôturés sont ' +
        `concernés, jusqu’à celui du 30/04/2026. ${PLUSIEURS_QUOI_FAIRE}${PLUSIEURS_UN_PAR_UN}`,
    )
    expect(
      motifPeriodeArretee({ lignes: 1, dateArrete: '2026-05-31', arreteEnCours: '2026-06-10', arretesConcernes: 3, plusAncienArrete: '2026-03-31' }),
    ).toBe(
      '1 ligne est datée au plus tard du 31/05/2026, date du dernier arrêté clôturé de ce compte, et 3 arrêtés clôturés sont ' +
        `concernés, jusqu’à celui du 31/03/2026. ${PLUSIEURS_QUOI_FAIRE}abandonner d’abord l’arrêté en cours du 10/06/2026, puis ${PLUSIEURS_UN_PAR_UN}`,
    )
  })

  it('motif : nombre de lignes, date de l’arrêté, relevé refusé en entier, quoi faire', () => {
    expect(motifPeriodeArretee({ ...SEUL_CONCERNE, lignes: 1 })).toBe(
      '1 ligne est datée au plus tard du 31/05/2026, date du dernier arrêté clôturé de ce compte. Aucune ligne du relevé ' +
        'n’est importée : déclôturer d’abord cet arrêté, puis importer le relevé en entier.',
    )
    expect(motifPeriodeArretee({ ...SEUL_CONCERNE, lignes: 3 })).toBe(
      '3 lignes sont datées au plus tard du 31/05/2026, date du dernier arrêté clôturé de ce compte. Aucune ligne du relevé ' +
        'n’est importée : déclôturer d’abord cet arrêté, puis importer le relevé en entier.',
    )
  })

  it('motif avec un arrêté en cours : l’abandonner d’abord, la déclôture étant refusée tant qu’il existe', () => {
    expect(motifPeriodeArretee({ ...SEUL_CONCERNE, lignes: 2, arreteEnCours: '2026-06-10' })).toBe(
      '2 lignes sont datées au plus tard du 31/05/2026, date du dernier arrêté clôturé de ce compte. Aucune ligne du relevé ' +
        'n’est importée : abandonner d’abord l’arrêté en cours du 10/06/2026, déclôturer celui du 31/05/2026, puis importer ' +
        'le relevé en entier.',
    )
  })

  it('refus : erreur « Import refusé » avec le motif ; rien sans ligne concernée', () => {
    expect(() => refuserImportEnPeriodeArretee([arrete()], 'B1', ['2026-05-31', '2026-06-01'])).toThrow(
      'Import refusé : 1 ligne est datée au plus tard du 31/05/2026, date du dernier arrêté clôturé de ce compte. Aucune ' +
        'ligne du relevé n’est importée : déclôturer d’abord cet arrêté, puis importer le relevé en entier.',
    )
    expect(() => refuserImportEnPeriodeArretee([arrete()], 'B1', ['2026-06-01'])).not.toThrow()
    expect(() => refuserImportEnPeriodeArretee([], 'B1', ['2026-05-31'])).not.toThrow()
  })
})

describe('base locale : import refusé dans une période arrêtée', () => {
  let banqueId: string

  const ecrituresDuCompte = async (id: string = banqueId) => (await ajDb.ecritures.toArray()).filter((ecriture) => ecriture.compte === compteBanque(id))

  /** Arrêté clôturé au 31/05/2026 sur le compte, à l'équilibre (450,00 € importés le 10/05). */
  async function cloturerMai(): Promise<ArreteRapprochement> {
    await importerReleveSurCompte('C2', banqueId, [{ date: '2026-05-10', libelle: 'VIR CHARGES', montant: 450 }])
    const ouvert = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 45_000 })
    return cloturerArreteCompte(ouvert.id)
  }

  beforeEach(async () => {
    localStorage.removeItem(CLE_STOCKAGE_MODE)
    await viderBaseLocale()
    await initialiserBaseDemo()
    useDonneesStore.setState({ loaded: false, loading: false })
    await useDonneesStore.getState().loadAll()
    banqueId = (await enregistrerCompteBancaire('C2', { nature: 'courant', libelle: '', iban: IBAN_A, bic: null, etablissement: null })).id
  })

  it('ligne datée au plus tard de l’arrêté clôturé : relevé refusé en entier, aucune écriture, solde de la période inchangé', async () => {
    const cloture = await cloturerMai()
    const avant = await ajDb.ecritures.count()
    const etatAvant = useDonneesStore.getState().ecritures.length
    await expect(
      importerReleveSurCompte('C2', banqueId, [
        { date: '2026-05-31', libelle: 'FRAIS TENUE', montant: -12 },
        { date: '2026-06-02', libelle: 'VIR JUIN', montant: 99 },
      ]),
    ).rejects.toThrow(
      'Import refusé : 1 ligne est datée au plus tard du 31/05/2026, date du dernier arrêté clôturé de ce compte. Aucune ' +
        'ligne du relevé n’est importée : déclôturer d’abord cet arrêté, puis importer le relevé en entier.',
    )
    // Ni la ligne de mai, ni celle de juin, ni la contrepartie 471 de la sortie.
    expect(await ajDb.ecritures.count()).toBe(avant)
    expect(useDonneesStore.getState().ecritures).toHaveLength(etatAvant)
    expect((await listerArretes(banqueId)).arretes).toEqual([cloture])
  })

  it('lignes toutes postérieures à l’arrêté clôturé : importées', async () => {
    await cloturerMai()
    await importerReleveSurCompte('C2', banqueId, [{ date: '2026-06-01', libelle: 'VIR JUIN', montant: 99 }])
    expect((await ecrituresDuCompte()).map((ecriture) => ecriture.libelle).sort()).toEqual(['VIR CHARGES', 'VIR JUIN'])
  })

  it('appel direct du store sur le sous-compte, sans passer par l’écran ni par importerReleveSurCompte : refusé aussi', async () => {
    await cloturerMai()
    const avant = await ajDb.ecritures.count()
    await expect(
      useDonneesStore.getState().importerReleve('C2', [{ date: '2026-05-15', libelle: 'VIR TARDIF', montant: 80 }], compteBanque(banqueId)),
    ).rejects.toThrow(/^Import refusé : 1 ligne est datée au plus tard du 31\/05\/2026/)
    expect(await ajDb.ecritures.count()).toBe(avant)
  })

  it('date écrite sans zéros (« 2026-5-9 ») par un appel direct : c’est la date de l’écriture qui est contrôlée', async () => {
    await cloturerMai()
    await expect(
      useDonneesStore.getState().importerReleve('C2', [{ date: '2026-5-9', libelle: 'VIR TARDIF', montant: 80 }], compteBanque(banqueId)),
    ).rejects.toThrow(/^Import refusé : 1 ligne est datée au plus tard du 31\/05\/2026/)
    expect(await ecrituresDuCompte()).toHaveLength(1)
  })

  it('arrêté en cours : ne protège rien, le relevé s’importe et entre dans le solde recalculé', async () => {
    await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 45_000 })
    await importerReleveSurCompte('C2', banqueId, [{ date: '2026-05-10', libelle: 'VIR CHARGES', montant: 450 }])
    expect(await ecrituresDuCompte()).toHaveLength(1)
  })

  it('arrêté abandonné : ne protège rien', async () => {
    const ouvert = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 0 })
    await abandonnerArreteCompte(ouvert.id)
    await importerReleveSurCompte('C2', banqueId, [{ date: '2026-05-10', libelle: 'VIR CHARGES', montant: 450 }])
    expect(await ecrituresDuCompte()).toHaveLength(1)
  })

  it('arrêté déclôturé : redevenu en cours, le relevé s’importe ; la nouvelle clôture se fait sur le solde recalculé', async () => {
    const cloture = await cloturerMai()
    const lignes = [{ date: '2026-05-20', libelle: 'PRLV EAU', montant: -120.5 }]
    await expect(importerReleveSurCompte('C2', banqueId, lignes)).rejects.toThrow(/déclôturer d’abord cet arrêté/)
    await decloturerArreteCompte(cloture.id)
    await importerReleveSurCompte('C2', banqueId, lignes)
    expect(await ecrituresDuCompte()).toHaveLength(2)
    // 450,00 − 120,50 = 329,50 € : l'arrêté, au solde banque de 450,00 €, n'est plus à l'équilibre.
    await expect(cloturerArreteCompte(cloture.id)).rejects.toThrow(/arrêté non équilibré/)
  })

  it('arrêté en cours après l’arrêté clôturé : seul le clôturé protège ; le refus dit d’abandonner l’arrêté en cours', async () => {
    await cloturerMai()
    // Arrêté en cours daté au plus tard du jour de la démonstration (04/06/2026) : la règle commune de date d'arrêté
    // (décision du 26/11/2026, rb-16 A) refuse un arrêté daté après le jour de l'application.
    await ouvrirArreteCompte(banqueId, { dateArrete: '2026-06-03', soldeBanqueCentimes: 45_000 })
    await importerReleveSurCompte('C2', banqueId, [{ date: '2026-06-02', libelle: 'VIR JUIN', montant: 99 }])
    await expect(importerReleveSurCompte('C2', banqueId, [{ date: '2026-05-20', libelle: 'PRLV EAU', montant: -120.5 }])).rejects.toThrow(
      'abandonner d’abord l’arrêté en cours du 03/06/2026, déclôturer celui du 31/05/2026, puis importer le relevé en entier.',
    )
    expect((await ecrituresDuCompte()).map((ecriture) => ecriture.libelle).sort()).toEqual(['VIR CHARGES', 'VIR JUIN'])
  })

  it('deux arrêtés clôturés, lignes dans les deux périodes : le refus ne dit pas de déclôturer le dernier, qui ne suffirait pas', async () => {
    // Retour de relecture : suivre « déclôturer d'abord cet arrêté » menait à devoir abandonner l'arrêté déclôturé.
    for (const dateArrete of ['2026-04-30', '2026-05-31']) {
      const ouvert = await ouvrirArreteCompte(banqueId, { dateArrete, soldeBanqueCentimes: 0 })
      await cloturerArreteCompte(ouvert.id)
    }
    const lignes = [
      { date: '2026-04-20', libelle: 'VIR AVRIL', montant: 80 },
      { date: '2026-05-20', libelle: 'VIR MAI', montant: 90 },
    ]
    await expect(importerReleveSurCompte('C2', banqueId, lignes)).rejects.toThrow(
      'Import refusé : 2 lignes sont datées au plus tard du 31/05/2026, date du dernier arrêté clôturé de ce compte, et 2 arrêtés ' +
        `clôturés sont concernés, jusqu’à celui du 30/04/2026. ${PLUSIEURS_QUOI_FAIRE}${PLUSIEURS_UN_PAR_UN}`,
    )
    // Lignes de mai seulement : un seul arrêté concerné, le message d'origine, que la déclôture suffit à lever.
    const mai = lignes.slice(1)
    await expect(importerReleveSurCompte('C2', banqueId, mai)).rejects.toThrow(/Aucune ligne du relevé n’est importée : déclôturer d’abord cet arrêté/)
    const dernier = (await listerArretes(banqueId)).arretes[1]
    await decloturerArreteCompte(dernier.id)
    await importerReleveSurCompte('C2', banqueId, mai)
    expect((await ecrituresDuCompte()).map((ecriture) => ecriture.libelle)).toEqual(['VIR MAI'])
  })

  it('arrêté illisible sur le compte (écrit hors de l’écran) : import refusé tant qu’il reste, comme les autres écritures', async () => {
    // Clôturé mais mal formé (solde qui n'est pas en centimes entiers) : sa période ne peut pas être lue, donc pas protégée.
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
    expect((await listerArretes(banqueId)).illisibles).toBe(1)
    const lignes = [{ date: '2026-05-10', libelle: 'VIR CHARGES', montant: 450 }]
    const refus = /^1 arrêté illisible sur ce compte \(écrit hors de l’écran\) : à reprendre dans la base locale d’abord\.$/
    await expect(importerReleveSurCompte('C2', banqueId, lignes)).rejects.toThrow(refus)
    await expect(useDonneesStore.getState().importerReleve('C2', lignes, compteBanque(banqueId))).rejects.toThrow(refus)
    expect(await ecrituresDuCompte()).toHaveLength(0)
    // La ligne reprise dans la base locale : l'import repasse.
    await ajDb.rapprochements.delete('arrete-externe')
    await importerReleveSurCompte('C2', banqueId, lignes)
    expect(await ecrituresDuCompte()).toHaveLength(1)
  })

  it('l’arrêté clôturé d’un compte ne protège pas un autre compte, ni les lignes non rattachées (« 512 » seul)', async () => {
    await cloturerMai()
    const autre = await enregistrerCompteBancaire('C2', { nature: 'fonds_travaux', libelle: '', iban: IBAN_B, bic: null, etablissement: null })
    await importerReleveSurCompte('C2', autre.id, [{ date: '2026-05-12', libelle: 'COTISATION FONDS', montant: 300 }])
    await useDonneesStore.getState().importerReleve('C2', [{ date: '2026-05-11', libelle: 'VIR ANCIEN', montant: 1000 }])
    expect(await ecrituresDuCompte(autre.id)).toHaveLength(1)
    expect((await ajDb.ecritures.toArray()).filter((ecriture) => ecriture.compte === '512')).toHaveLength(1)
  })

  it('copropriété sans journal : le refus n’en ouvre pas', async () => {
    const copro = await useDonneesStore.getState().createCopropriete({ nom: 'Résidence des Tilleuls', adresse: '1 rue des Tilleuls', nbLots: 4, fondement: 'art. 29-1', rg: '' })
    const compte = await enregistrerCompteBancaire(copro.id, { nature: 'courant', libelle: '', iban: IBAN_B, bic: null, etablissement: null })
    const ouvert = await ouvrirArreteCompte(compte.id, { dateArrete: '2026-05-31', soldeBanqueCentimes: 0 })
    await cloturerArreteCompte(ouvert.id)
    await expect(importerReleveSurCompte(copro.id, compte.id, [{ date: '2026-05-10', libelle: 'VIR CHARGES', montant: 450 }])).rejects.toThrow(
      /^Import refusé/,
    )
    expect((await ajDb.journaux.toArray()).filter((journal) => journal.coproprieteId === copro.id)).toHaveLength(0)
  })

  it('copropriété sans journal, appel direct du store : le refus n’en laisse pas non plus, ni en base ni dans l’état', async () => {
    const copro = await useDonneesStore.getState().createCopropriete({ nom: 'Résidence des Tilleuls', adresse: '1 rue des Tilleuls', nbLots: 4, fondement: 'art. 29-1', rg: '' })
    const compte = await enregistrerCompteBancaire(copro.id, { nature: 'courant', libelle: '', iban: IBAN_B, bic: null, etablissement: null })
    const ouvert = await ouvrirArreteCompte(compte.id, { dateArrete: '2026-05-31', soldeBanqueCentimes: 0 })
    await cloturerArreteCompte(ouvert.id)
    const duCopro = (journal: { coproprieteId: string }) => journal.coproprieteId === copro.id
    // Sans le pré-contrôle de importerReleveSurCompte : appel direct, ou arrêté clôturé entre-temps dans un autre onglet.
    await expect(
      useDonneesStore.getState().importerReleve(copro.id, [{ date: '2026-05-10', libelle: 'VIR CHARGES', montant: 450 }], compteBanque(compte.id)),
    ).rejects.toThrow(/^Import refusé/)
    expect((await ajDb.journaux.toArray()).filter(duCopro)).toHaveLength(0)
    expect(useDonneesStore.getState().journaux.filter(duCopro)).toHaveLength(0)
    // Import accepté : le journal est ouvert avec les écritures, en base et dans l'état.
    const [ecriture] = await useDonneesStore
      .getState()
      .importerReleve(copro.id, [{ date: '2026-06-02', libelle: 'VIR JUIN', montant: 99 }], compteBanque(compte.id))
    const journaux = (await ajDb.journaux.toArray()).filter(duCopro)
    expect(journaux).toHaveLength(1)
    expect(ecriture.journalId).toBe(journaux[0].id)
    expect(useDonneesStore.getState().journaux.filter(duCopro)).toEqual(journaux)
  })
})
