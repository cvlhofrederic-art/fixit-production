import './fuseau-paris'
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { arreteCourant, controlerSaisieArrete, soldeSaisiVersCentimes } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/arretes-vue'
import { cloturerCompteBancaire, enregistrerCompteBancaire } from '@/lib/administrateur-judiciaire/db/comptes-bancaires'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import {
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
 * (rapprochement-bancaire.ts : ouvrirArrete, etatArrete, cloturerArrete, decloturerArrete). Le solde compta est celui du
 * sous-compte 512 du compte à la date de l'arrêté.
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
    expect(await listerArretes(banqueId)).toEqual({ arretes: [arrete], illisibles: 0 })
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
    expect(await listerArretes(banqueId)).toEqual({ arretes: [], illisibles: 1 })
    await expect(ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 0 })).rejects.toThrow(
      /1 arrêté illisible sur ce compte/,
    )
  })
})

describe('clôture et déclôture', () => {
  it('clôture refusée hors équilibre (écart dit par le domaine) ; acceptée à l’équilibre', async () => {
    await importerReleveSurCompte('C2', banqueId, [{ date: '2026-05-10', libelle: 'VIR CHARGES', montant: 450 }])
    const desequilibre = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 40_000 })
    await expect(cloturerArreteCompte(desequilibre.id)).rejects.toThrow('Clôture refusée : arrêté non équilibré (écart -5000 centimes).')
    expect((await ajDb.rapprochements.get(desequilibre.id))?.statut).toBe('En cours')
    await ajDb.rapprochements.delete(desequilibre.id)
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
