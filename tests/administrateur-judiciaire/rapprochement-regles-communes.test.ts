import './fuseau-paris'
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { controlerSaisieArrete } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/arretes-vue'
import { enregistrerCompteBancaire } from '@/lib/administrateur-judiciaire/db/comptes-bancaires'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import {
  abandonnerArreteCompte,
  cloturerArreteCompte,
  decloturerArreteCompte,
  ouvrirArreteCompte,
} from '@/lib/administrateur-judiciaire/db/rapprochements'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { ajDb } from '@/lib/administrateur-judiciaire/db/schema'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import {
  ouvrirArrete,
  refusArretesIllisibles,
  refusDateArrete,
  type ArreteRapprochement,
} from '@/lib/administrateur-judiciaire/domain/rapprochement-bancaire'
import { AUJOURDHUI_ISO, CLE_STOCKAGE_MODE, DATE_DEMO_ISO } from '@/lib/administrateur-judiciaire/mode'

/**
 * Décision du 26/11/2026 (PR 799, rb-16 A) : deux règles jusqu'ici propres à l'écran « Banque et recouvrement » passent
 * dans les règles communes du module (domain/rapprochement-bancaire.ts), appliquées à toute écriture des arrêtés
 * (db/rapprochements.ts), quel que soit l'écran qui l'appelle :
 * - une date d'arrêté future (ou d'une année improbable) est refusée : un arrêté constate un solde passé ;
 * - une ligne de la base sans la forme d'un arrêté (écrite hors de l'écran) bloque toute écriture sur les arrêtés du
 *   compte : elle pourrait cacher un arrêté en cours ou plus récent.
 * L'écran garde son contrôle avant l'écriture, sur la même règle et le même message.
 */

// IBAN de test publié (exemple déjà utilisé par les tests D-BANQUE) : clé valide, aucun compte réel.
const IBAN_A = 'FR76 3000 6000 0112 3456 7890 189'

const saisie = (dateArrete: string) => ({ id: 'a-1', banqueId: 'b-courant', dateArrete, soldeBanqueCentimes: 0, soldeComptaCentimes: 0 })

const cloture = (id: string, dateArrete: string): ArreteRapprochement => ({
  id,
  banqueId: 'b-courant',
  dateArrete,
  soldeBanqueCentimes: 0,
  soldeComptaCentimes: 0,
  statut: 'Clôturé',
  elements: [],
})

describe('règle commune : date d’arrêté ni future ni improbable (rb-16 A)', () => {
  it('refusDateArrete : null jusqu’à aujourd’hui compris ; sinon le message de l’écran', () => {
    expect(refusDateArrete('2026-11-27', '2026-11-27')).toBeNull()
    expect(refusDateArrete('2026-10-31', '2026-11-27')).toBeNull()
    expect(refusDateArrete('2026-11-28', '2026-11-27')).toBe("Arrêté daté du 28/11/2026, après aujourd'hui.")
    expect(refusDateArrete('1826-10-31', '2026-11-27')).toBe('Arrêté daté du 31/10/1826 : année improbable (faute de frappe ?).')
  })

  it('refusDateArrete : date ou jour invalides refusés (jamais une réponse « plausible » par défaut)', () => {
    expect(() => refusDateArrete('31/10/2026', '2026-11-27')).toThrow(/Date invalide/)
    expect(() => refusDateArrete('2026-10-31', '')).toThrow(/Date du jour invalide/)
  })

  it('ouvrirArrete refuse une date future ou improbable, accepte aujourd’hui', () => {
    expect(() => ouvrirArrete([], saisie('2026-11-28'), '2026-11-27')).toThrow("Arrêté daté du 28/11/2026, après aujourd'hui.")
    expect(() => ouvrirArrete([], saisie('2062-10-31'), '2026-11-27')).toThrow("Arrêté daté du 31/10/2062, après aujourd'hui.")
    expect(() => ouvrirArrete([], saisie('1826-10-31'), '2026-11-27')).toThrow(/année improbable/)
    expect(ouvrirArrete([cloture('a-0', '2026-10-31')], saisie('2026-11-27'), '2026-11-27')).toMatchObject({ statut: 'En cours', dateArrete: '2026-11-27' })
  })

  it('ouvrirArrete : les autres règles gardent leur message (date mal écrite, solde, arrêté en cours, date non postérieure)', () => {
    expect(() => ouvrirArrete([], saisie('31/10/2026'), '2026-11-27')).toThrow("Date d'arrêté invalide (31/10/2026) : AAAA-MM-JJ attendu.")
    expect(() => ouvrirArrete([], { ...saisie('2026-11-28'), soldeBanqueCentimes: 12.5 }, '2026-11-27')).toThrow(/solde banque invalide/)
    expect(() => ouvrirArrete([{ ...cloture('a-0', '2026-10-31'), statut: 'En cours' }], saisie('2026-11-28'), '2026-11-27')).toThrow(
      'Un arrêté est déjà en cours sur ce compte',
    )
    expect(() => ouvrirArrete([cloture('a-0', '2026-10-31')], saisie('2026-10-31'), '2026-11-27')).toThrow(
      "Date d'arrêté non postérieure au dernier arrêté du compte (2026-10-31).",
    )
  })

  it('ouvrirArrete : un jour de référence invalide est refusé d’emblée, avant les autres règles', () => {
    const enCours = { ...cloture('a-0', '2026-10-31'), statut: 'En cours' as const }
    expect(() => ouvrirArrete([enCours], saisie('2026-11-20'), '')).toThrow(/Date du jour invalide/)
    expect(() => ouvrirArrete([enCours], saisie('2026-11-20'), '27/11/2026')).toThrow(/Date du jour invalide/)
  })

  it('l’écran contrôle sa saisie sur la même règle et le même message', () => {
    expect(controlerSaisieArrete({ date: '2026-11-28', soldeBanque: '1' }, '2026-11-27')).toEqual({ erreur: refusDateArrete('2026-11-28', '2026-11-27') })
    expect(controlerSaisieArrete({ date: '1826-10-31', soldeBanque: '1' }, '2026-11-27')).toEqual({ erreur: refusDateArrete('1826-10-31', '2026-11-27') })
  })
})

describe('règle commune : arrêté illisible sur le compte (rb-16 A)', () => {
  it('refusArretesIllisibles : null sans ligne illisible ; sinon le refus, au singulier ou au pluriel', () => {
    expect(refusArretesIllisibles(0)).toBeNull()
    expect(refusArretesIllisibles(1)).toBe('1 arrêté illisible sur ce compte (écrit hors de l’écran) : à reprendre dans la base locale d’abord.')
    expect(refusArretesIllisibles(3)).toBe('3 arrêtés illisibles sur ce compte (écrits hors de l’écran) : à reprendre dans la base locale d’abord.')
  })

  it('refusArretesIllisibles : un nombre qui n’en est pas un est refusé', () => {
    expect(() => refusArretesIllisibles(-1)).toThrow(/illisibles invalide/)
    expect(() => refusArretesIllisibles(1.5)).toThrow(/illisibles invalide/)
    expect(() => refusArretesIllisibles(Number.NaN)).toThrow(/illisibles invalide/)
  })
})

describe('écriture des arrêtés : les deux règles s’appliquent quel que soit l’écran (rb-16 A)', () => {
  let banqueId: string

  beforeEach(async () => {
    localStorage.removeItem(CLE_STOCKAGE_MODE)
    await viderBaseLocale()
    await initialiserBaseDemo()
    useDonneesStore.setState({ loaded: false, loading: false })
    await useDonneesStore.getState().loadAll()
    banqueId = (await enregistrerCompteBancaire('C2', { nature: 'courant', libelle: '', iban: IBAN_A, bic: null, etablissement: null })).id
  })

  it('ouvrirArreteCompte refuse une date après le jour de l’application (date figée en démonstration) ; rien n’est écrit', async () => {
    expect(AUJOURDHUI_ISO).toBe(DATE_DEMO_ISO)
    await expect(ouvrirArreteCompte(banqueId, { dateArrete: '2026-06-05', soldeBanqueCentimes: 0 })).rejects.toThrow(
      "Arrêté daté du 05/06/2026, après aujourd'hui.",
    )
    expect(await ajDb.rapprochements.count()).toBe(0)
    const arrete = await ouvrirArreteCompte(banqueId, { dateArrete: DATE_DEMO_ISO, soldeBanqueCentimes: 0 })
    expect(arrete).toMatchObject({ dateArrete: DATE_DEMO_ISO, statut: 'En cours' })
  })

  it('ouvrirArreteCompte : le jour de référence n’est pas un paramètre ; une option en trop ne l’assouplit pas', async () => {
    // Un appelant qui passerait un jour (option retirée, voir db/rapprochements.ts) n'assouplit pas la règle.
    const optionsEnTrop = { aujourdhui: '2099-12-31' } as unknown as Parameters<typeof ouvrirArreteCompte>[2]
    await expect(ouvrirArreteCompte(banqueId, { dateArrete: '2030-01-31', soldeBanqueCentimes: 0 }, optionsEnTrop)).rejects.toThrow(
      "Arrêté daté du 31/01/2030, après aujourd'hui.",
    )
    expect(await ajDb.rapprochements.count()).toBe(0)
  })

  it('arrêté illisible sur le compte : ouverture, clôture, déclôture et abandon refusés avec le message du domaine ; rien n’est écrit', async () => {
    const enCours = await ouvrirArreteCompte(banqueId, { dateArrete: '2026-05-31', soldeBanqueCentimes: 0 })
    await ajDb.rapprochements.add({
      id: 'arrete-externe',
      createdAt: '2026-11-01T08:00:00.000Z',
      updatedAt: '2026-11-01T08:00:00.000Z',
      createdBy: null,
      updatedBy: null,
      bancaireId: banqueId,
      statut: 'En cours',
    })
    const refus = refusArretesIllisibles(1) ?? ''
    const avant = await ajDb.activityLog.count()
    await expect(ouvrirArreteCompte(banqueId, { dateArrete: '2026-06-01', soldeBanqueCentimes: 0 })).rejects.toThrow(refus)
    await expect(cloturerArreteCompte(enCours.id)).rejects.toThrow(refus)
    await expect(abandonnerArreteCompte(enCours.id)).rejects.toThrow(refus)
    await expect(decloturerArreteCompte(enCours.id)).rejects.toThrow(refus)
    expect((await ajDb.rapprochements.get(enCours.id))?.statut).toBe('En cours')
    expect(await ajDb.rapprochements.count()).toBe(2)
    expect(await ajDb.activityLog.count()).toBe(avant)
  })
})
