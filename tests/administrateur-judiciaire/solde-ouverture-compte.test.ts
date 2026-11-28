import './fuseau-paris'
import { describe, expect, it } from 'vitest'
import { analyserReleve } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/analyse-releve'
import { vueComptesBancaires } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/comptes-bancaires-vue'
import type { Banque, Ecriture } from '@/lib/administrateur-judiciaire/db/schema'
import { lignesAvantOuverture, soldeCompteBancaireCentimes } from '@/lib/administrateur-judiciaire/db/sous-comptes-banque'
import { avecSoldeComptaCourant } from '@/lib/administrateur-judiciaire/db/rapprochements'
import type { ArreteRapprochement } from '@/lib/administrateur-judiciaire/domain/rapprochement-bancaire'
import {
  lireSaisieSoldeOuverture,
  memeSoldeOuverture,
  refusArreteAvantOuverture,
  soldeOuvertureEnregistre,
  soldeOuvertureIllisible,
  verifierChangementSoldeOuverture,
} from '@/lib/administrateur-judiciaire/domain/solde-ouverture-compte'

/**
 * Solde d'ouverture d'un compte bancaire (PR 799, point 2, choix A validé par le référent métier, décision du
 * 26/11/2026) : montant signé et date, saisis sur le compte. Règles pures : saisie, lecture d'une ligne de la base,
 * changement refusé quand un arrêté clôturé couvre la date.
 * Réponses du référent métier du 28/11/2026 (PR 848) :
 * - point 2, choix B : le solde vaut à la FIN du jour indiqué, ses mouvements compris (montant et date se recopient tels
 *   quels depuis le relevé). Seules les lignes datées APRÈS ce jour s'y ajoutent ;
 * - point 3, choix A : les lignes datées de ce jour ou d'avant restent importées, hors du solde, et sont signalées ;
 * - point 4, choix A : un solde d'ouverture daté après un arrêté du compte est refusé ;
 * - point 5, choix A : un arrêté daté avant le solde d'ouverture est refusé (« solde inconnu avant le JJ/MM/AAAA ») ;
 * - point 8, choix A : un solde d'ouverture enregistré sans date ou mal formé est reconnu, pour être signalé.
 */

const AUJOURDHUI = '2026-06-04'

const ecriture = (compte: string, montant: number, sens: 'debit' | 'credit', date: Date): Pick<Ecriture, 'compte' | 'montant' | 'sens' | 'date'> => ({
  compte,
  montant,
  sens,
  date,
})

describe('saisie du solde d’ouverture (lireSaisieSoldeOuverture)', () => {
  it('montant et date vides, absents ou faits d’espaces : aucun solde d’ouverture (le compte part de zéro)', () => {
    expect(lireSaisieSoldeOuverture({ montant: '', au: '' }, AUJOURDHUI)).toBeNull()
    expect(lireSaisieSoldeOuverture({ montant: '  ', au: null }, AUJOURDHUI)).toBeNull()
    expect(lireSaisieSoldeOuverture(null, AUJOURDHUI)).toBeNull()
  })

  it('montant en euros lu en centimes entiers signés ; négatif : découvert ; zéro admis', () => {
    expect(lireSaisieSoldeOuverture({ montant: '1 234,56', au: '2026-05-01' }, AUJOURDHUI)).toEqual({ centimes: 123_456, au: '2026-05-01' })
    expect(lireSaisieSoldeOuverture({ montant: '-35,5', au: '2026-01-01' }, AUJOURDHUI)).toEqual({ centimes: -3_550, au: '2026-01-01' })
    expect(lireSaisieSoldeOuverture({ montant: '0', au: '2026-06-04' }, AUJOURDHUI)).toEqual({ centimes: 0, au: '2026-06-04' })
  })

  it('montant sans date, ou date sans montant : refusé', () => {
    expect(() => lireSaisieSoldeOuverture({ montant: '100', au: '' }, AUJOURDHUI)).toThrow('Solde d’ouverture : date à saisir (champ « au »), ou vider le montant.')
    expect(() => lireSaisieSoldeOuverture({ montant: '', au: '2026-05-01' }, AUJOURDHUI)).toThrow('Solde d’ouverture : montant à saisir, ou vider la date.')
  })

  it('montant illisible ou à plus de deux décimales : refusé', () => {
    for (const montant of ['abc', '12,345', '1,2,3'])
      expect(() => lireSaisieSoldeOuverture({ montant, au: '2026-05-01' }, AUJOURDHUI)).toThrow(
        'Solde d’ouverture illisible : montant en euros attendu (ex. 1 234,56 ; négatif pour un découvert).',
      )
  })

  it('date invalide, future ou d’une année improbable : refusée', () => {
    expect(() => lireSaisieSoldeOuverture({ montant: '100', au: '2026-02-30' }, AUJOURDHUI)).toThrow('Date du solde d’ouverture invalide : JJ/MM/AAAA attendu.')
    expect(() => lireSaisieSoldeOuverture({ montant: '100', au: '2026-06-05' }, AUJOURDHUI)).toThrow("Solde d’ouverture daté du 05/06/2026, après aujourd'hui.")
    expect(() => lireSaisieSoldeOuverture({ montant: '100', au: '0026-05-01' }, AUJOURDHUI)).toThrow(/année improbable/)
  })
})

describe('solde d’ouverture lu sur une ligne de la base (soldeOuvertureEnregistre)', () => {
  it('centimes entiers et date valide : lu ; champs absents, à null ou sans cette forme : aucun', () => {
    expect(soldeOuvertureEnregistre({ soldeOuvertureCentimes: 100_000, soldeOuvertureAu: '2026-05-01' })).toEqual({ centimes: 100_000, au: '2026-05-01' })
    expect(soldeOuvertureEnregistre({})).toBeNull()
    expect(soldeOuvertureEnregistre({ soldeOuvertureCentimes: null, soldeOuvertureAu: null })).toBeNull()
    expect(soldeOuvertureEnregistre({ soldeOuvertureCentimes: 12.5, soldeOuvertureAu: '2026-05-01' })).toBeNull()
    expect(soldeOuvertureEnregistre({ soldeOuvertureCentimes: 100, soldeOuvertureAu: '01/05/2026' })).toBeNull()
    expect(soldeOuvertureEnregistre({ soldeOuvertureCentimes: 100 })).toBeNull()
  })

  it('memeSoldeOuverture : même montant et même date, ou aucun des deux côtés', () => {
    expect(memeSoldeOuverture(null, null)).toBe(true)
    expect(memeSoldeOuverture({ centimes: 1, au: '2026-05-01' }, { centimes: 1, au: '2026-05-01' })).toBe(true)
    expect(memeSoldeOuverture({ centimes: 1, au: '2026-05-01' }, { centimes: 2, au: '2026-05-01' })).toBe(false)
    expect(memeSoldeOuverture({ centimes: 1, au: '2026-05-01' }, { centimes: 1, au: '2026-05-02' })).toBe(false)
    expect(memeSoldeOuverture({ centimes: 0, au: '2026-05-01' }, null)).toBe(false)
  })

  it('solde d’ouverture illisible (point 8) : un champ présent sans former un solde d’ouverture ; absents ou à null : aucun, rien à signaler', () => {
    expect(soldeOuvertureIllisible({})).toBe(false)
    expect(soldeOuvertureIllisible({ soldeOuvertureCentimes: null, soldeOuvertureAu: null })).toBe(false)
    expect(soldeOuvertureIllisible({ soldeOuvertureCentimes: 100_000, soldeOuvertureAu: '2026-05-01' })).toBe(false)
    // Sans date, ou date sans montant.
    expect(soldeOuvertureIllisible({ soldeOuvertureCentimes: 100_000 })).toBe(true)
    expect(soldeOuvertureIllisible({ soldeOuvertureCentimes: 100_000, soldeOuvertureAu: null })).toBe(true)
    expect(soldeOuvertureIllisible({ soldeOuvertureAu: '2026-05-01' })).toBe(true)
    // Mal formé : centimes non entiers, montant en texte, date au format français, date vide.
    expect(soldeOuvertureIllisible({ soldeOuvertureCentimes: 12.5, soldeOuvertureAu: '2026-05-01' })).toBe(true)
    expect(soldeOuvertureIllisible({ soldeOuvertureCentimes: '1000', soldeOuvertureAu: '2026-05-01' })).toBe(true)
    expect(soldeOuvertureIllisible({ soldeOuvertureCentimes: 100, soldeOuvertureAu: '01/05/2026' })).toBe(true)
    expect(soldeOuvertureIllisible({ soldeOuvertureCentimes: 100, soldeOuvertureAu: '' })).toBe(true)
  })
})

describe('solde d’un compte bancaire avec son solde d’ouverture (soldeCompteBancaireCentimes)', () => {
  const ecritures = [
    ecriture('512-B1', 200, 'debit', new Date(2026, 3, 20)),
    ecriture('512-B1', 450, 'debit', new Date(2026, 4, 1)),
    ecriture('512-B1', 120.5, 'credit', new Date(2026, 4, 20)),
    ecriture('512-B1', 99, 'debit', new Date(2026, 5, 2)),
    ecriture('512-B2', 999, 'debit', new Date(2026, 4, 2)),
    ecriture('512', 77, 'debit', new Date(2026, 4, 2)),
    ecriture('471', 120.5, 'debit', new Date(2026, 4, 20)),
  ]
  const ouverture = { centimes: 100_000, au: '2026-05-01' }

  it('sans solde d’ouverture : somme des lignes du sous-compte, comme avant ; null sans aucune ligne', () => {
    expect(soldeCompteBancaireCentimes(ecritures, 'B1', null)).toBe(62_850)
    expect(soldeCompteBancaireCentimes(ecritures, 'B1', null, '2026-05-31')).toBe(52_950)
    expect(soldeCompteBancaireCentimes(ecritures, 'B3', null)).toBeNull()
  })

  it('avec solde d’ouverture (fin de journée) : ce solde plus les lignes datées APRÈS son jour ; celles de son jour ou d’avant n’y entrent pas', () => {
    // 1 000,00 − 120,50 + 99,00 ; les 200,00 du 20/04 et les 450,00 du 01/05 (le jour même : le solde vaut à la fin du jour) sont déjà dans le solde d'ouverture.
    expect(soldeCompteBancaireCentimes(ecritures, 'B1', ouverture)).toBe(97_850)
    expect(soldeCompteBancaireCentimes(ecritures, 'B1', ouverture, '2026-05-31')).toBe(87_950)
    // Le jour même : le solde d'ouverture, tel quel.
    expect(soldeCompteBancaireCentimes(ecritures, 'B1', ouverture, '2026-05-01')).toBe(100_000)
    // Le lendemain d'une ligne : elle s'ajoute.
    expect(soldeCompteBancaireCentimes(ecritures, 'B1', { centimes: 100_000, au: '2026-04-30' }, '2026-05-01')).toBe(145_000)
  })

  it('à une date antérieure au solde d’ouverture : celui-ci n’entre pas encore dans le solde (lignes importées seulement)', () => {
    expect(soldeCompteBancaireCentimes(ecritures, 'B1', ouverture, '2026-04-30')).toBe(20_000)
    expect(soldeCompteBancaireCentimes(ecritures, 'B3', ouverture, '2026-04-30')).toBeNull()
  })

  it('compte sans aucune ligne : le solde est le solde d’ouverture, jamais « inconnu » ; découvert et zéro compris', () => {
    expect(soldeCompteBancaireCentimes(ecritures, 'B3', ouverture)).toBe(100_000)
    expect(soldeCompteBancaireCentimes([], 'B3', { centimes: -2_500, au: '2026-05-01' })).toBe(-2_500)
    expect(soldeCompteBancaireCentimes([], 'B3', { centimes: 0, au: '2026-05-01' })).toBe(0)
  })

  it('lignes datées du jour du solde d’ouverture ou d’avant : comptées pour l’avertissement (jour même compris, autres comptes exclus)', () => {
    expect(lignesAvantOuverture(ecritures, 'B1', ouverture)).toBe(2)
    expect(lignesAvantOuverture(ecritures, 'B1', { centimes: 0, au: '2026-04-30' })).toBe(1)
    expect(lignesAvantOuverture(ecritures, 'B1', { centimes: 0, au: '2026-04-19' })).toBe(0)
    expect(lignesAvantOuverture(ecritures, 'B1', { centimes: 0, au: '2026-06-03' })).toBe(4)
    expect(lignesAvantOuverture(ecritures, 'B1', null)).toBe(0)
    expect(lignesAvantOuverture(ecritures, 'B3', ouverture)).toBe(0)
  })

  it('arrêté en cours : solde compta de l’instant avec le solde d’ouverture du compte ; arrêté clôturé : figé', () => {
    const arrete: ArreteRapprochement = {
      id: 'A1',
      banqueId: 'B1',
      dateArrete: '2026-05-31',
      soldeBanqueCentimes: 87_950,
      soldeComptaCentimes: 0,
      statut: 'En cours',
      elements: [],
    }
    expect(avecSoldeComptaCourant(arrete, ecritures, ouverture).soldeComptaCentimes).toBe(87_950)
    expect(avecSoldeComptaCourant(arrete, ecritures).soldeComptaCentimes).toBe(52_950)
    expect(avecSoldeComptaCourant({ ...arrete, statut: 'Clôturé' }, ecritures, ouverture).soldeComptaCentimes).toBe(0)
    // Arrêté du jour même du solde d'ouverture : son solde compta est ce solde, les lignes de ce jour y sont déjà.
    expect(avecSoldeComptaCourant({ ...arrete, dateArrete: '2026-05-01' }, ecritures, ouverture).soldeComptaCentimes).toBe(100_000)
  })
})

describe('arrêté daté avant le solde d’ouverture (refusArreteAvantOuverture, point 5)', () => {
  const ouverture = { centimes: 100_000, au: '2026-05-01' }

  it('arrêté daté avant le jour du solde d’ouverture : refusé, « solde inconnu avant le JJ/MM/AAAA »', () => {
    expect(refusArreteAvantOuverture('2026-04-30', ouverture)).toBe(
      'Arrêté daté du 30/04/2026 : solde inconnu avant le 01/05/2026, date du solde d’ouverture du compte.',
    )
    expect(refusArreteAvantOuverture('2025-12-31', ouverture)).toContain('solde inconnu avant le 01/05/2026')
  })

  it('arrêté du jour même (solde de fin de journée) ou d’après, compte sans solde d’ouverture : aucun refus', () => {
    expect(refusArreteAvantOuverture('2026-05-01', ouverture)).toBeNull()
    expect(refusArreteAvantOuverture('2026-05-31', ouverture)).toBeNull()
    expect(refusArreteAvantOuverture('2026-04-30', null)).toBeNull()
  })
})

describe('changement du solde d’ouverture (verifierChangementSoldeOuverture)', () => {
  const avant = { centimes: 100_000, au: '2026-05-01' }
  const arrete = (dateArrete: string, statut: 'En cours' | 'Clôturé') => ({ dateArrete, statut })

  it('aucun changement : jamais refusé, même sur un compte clôturé ou sous un arrêté clôturé', () => {
    expect(() =>
      verifierChangementSoldeOuverture({ avant, apres: { ...avant }, compteActif: false, arretes: [arrete('2026-05-31', 'Clôturé')] }),
    ).not.toThrow()
    expect(() => verifierChangementSoldeOuverture({ avant: null, apres: null, compteActif: false, arretes: [arrete('2026-05-31', 'Clôturé')] })).not.toThrow()
  })

  it('compte clôturé : saisie, modification et suppression refusées', () => {
    for (const [a, b] of [
      [null, avant],
      [avant, { centimes: 1, au: '2026-05-01' }],
      [avant, null],
    ] as const)
      expect(() => verifierChangementSoldeOuverture({ avant: a, apres: b, compteActif: false, arretes: [] })).toThrow(
        'Compte bancaire clôturé : son solde d’ouverture ne se modifie plus.',
      )
  })

  it('arrêté clôturé daté du jour du solde d’ouverture ou d’après : modification et suppression refusées, déclôturer d’abord', () => {
    const arretes = [arrete('2026-05-31', 'Clôturé')]
    const refus = 'Solde d’ouverture non modifié : l’arrêté clôturé du 31/05/2026 couvre sa date. Déclôturer d’abord cet arrêté.'
    expect(() => verifierChangementSoldeOuverture({ avant, apres: { centimes: 1, au: '2026-05-01' }, compteActif: true, arretes })).toThrow(refus)
    expect(() => verifierChangementSoldeOuverture({ avant, apres: null, compteActif: true, arretes })).toThrow(refus)
    // Première saisie sous un arrêté déjà clôturé : son solde compta figé ne la contient pas.
    expect(() => verifierChangementSoldeOuverture({ avant: null, apres: avant, compteActif: true, arretes })).toThrow(refus)
    // Arrêté daté du jour même du solde d'ouverture : couvert (son solde compta figé est ce solde, ou a été calculé sans lui).
    expect(() => verifierChangementSoldeOuverture({ avant: null, apres: avant, compteActif: true, arretes: [arrete('2026-05-01', 'Clôturé')] })).toThrow(
      /arrêté clôturé du 01\/05\/2026/,
    )
  })

  it('date déplacée : l’ancienne date et la nouvelle comptent toutes deux', () => {
    const arretes = [arrete('2026-05-31', 'Clôturé')]
    // Ancienne date couverte, nouvelle date avancée, toujours couverte : le solde figé contenait l'ancien solde d'ouverture.
    expect(() => verifierChangementSoldeOuverture({ avant, apres: { centimes: 100_000, au: '2026-05-15' }, compteActif: true, arretes })).toThrow(
      /Déclôturer d’abord/,
    )
    // Ancienne date postérieure à l'arrêté (enregistrée avant la règle du point 4), nouvelle date couverte.
    expect(() =>
      verifierChangementSoldeOuverture({ avant: { centimes: 100_000, au: '2026-06-01' }, apres: avant, compteActif: true, arretes }),
    ).toThrow(/Déclôturer d’abord/)
  })

  describe('solde d’ouverture daté après un arrêté du compte (point 4) : refusé', () => {
    const REGLE = 'Un solde d’ouverture se date avant le premier arrêté du compte, ou le même jour.'
    const juin = { centimes: 52_950, au: '2026-06-01' }
    /** Refus attendu, message ENTIER (toThrow avec un texte n'en vérifierait qu'une partie) : la règle, puis la marche à suivre. */
    const refusEntier = (arreteNomme: string, marche: string) =>
      new Error(`Solde d’ouverture refusé : daté du 01/06/2026, après le premier arrêté du compte (${arreteNomme}). ${REGLE} ${marche}`)

    it('après un arrêté clôturé : première saisie et déplacement de la date refusés, avec la date de cet arrêté et la marche à suivre', () => {
      const arretes = [arrete('2026-04-30', 'Clôturé')]
      const refus = refusEntier('30/04/2026, clôturé', 'Le dater au plus tard du 30/04/2026, après avoir déclôturé cet arrêté.')
      expect(() => verifierChangementSoldeOuverture({ avant: null, apres: juin, compteActif: true, arretes })).toThrow(refus)
      expect(() => verifierChangementSoldeOuverture({ avant: { centimes: 20_000, au: '2026-04-01' }, apres: juin, compteActif: true, arretes })).toThrow(refus)
    })

    it('ce refus passe avant « Déclôturer d’abord » : déclôturer ne suffirait pas, la date elle-même est refusée', () => {
      // Ancienne date couverte par l'arrêté clôturé du 31/05, nouvelle date postérieure à cet arrêté.
      expect(() =>
        verifierChangementSoldeOuverture({ avant, apres: { centimes: 100_000, au: '2026-06-01' }, compteActif: true, arretes: [arrete('2026-05-31', 'Clôturé')] }),
      ).toThrow(refusEntier('31/05/2026, clôturé', 'Le dater au plus tard du 31/05/2026, après avoir déclôturé cet arrêté.'))
    })

    it('après un arrêté en cours : refusé aussi (il serait daté avant le solde d’ouverture, ce que le point 5 refuse) ; l’abandonner est une issue', () => {
      // Premier arrêté en cours : c'est le seul arrêté du compte. Le clôturer ne changerait rien ; l'abandonner, si.
      expect(() => verifierChangementSoldeOuverture({ avant: null, apres: juin, compteActif: true, arretes: [arrete('2026-05-31', 'En cours')] })).toThrow(
        refusEntier('31/05/2026, en cours', 'Le dater au plus tard du 31/05/2026, ou abandonner d’abord cet arrêté en cours.'),
      )
    })

    it('plusieurs arrêtés : le refus nomme le premier arrêté du compte ; tous les arrêtés clôturés couvriraient la nouvelle date', () => {
      const arretes = [arrete('2026-05-31', 'En cours'), arrete('2026-04-30', 'Clôturé'), arrete('2026-03-31', 'Clôturé')]
      // L'arrêté en cours n'est pas le premier : l'abandonner ne suffirait pas, le refus ne le propose pas.
      expect(() => verifierChangementSoldeOuverture({ avant: null, apres: juin, compteActif: true, arretes })).toThrow(
        refusEntier('31/03/2026, clôturé', 'Le dater au plus tard du 31/03/2026, après avoir déclôturé les arrêtés clôturés du compte.'),
      )
    })

    it('la marche à suivre du refus mène au but : daté au plus tard du premier arrêté, le solde d’ouverture passe, ou reçoit « Déclôturer d’abord »', () => {
      const mars = { centimes: 52_950, au: '2026-03-31' }
      // Premier arrêté en cours : la date conseillée est admise ; l'arrêté abandonné (hors des arrêtés qui comptent), toute date l'est.
      expect(() => verifierChangementSoldeOuverture({ avant: null, apres: { ...juin, au: '2026-05-31' }, compteActif: true, arretes: [arrete('2026-05-31', 'En cours')] })).not.toThrow()
      expect(() => verifierChangementSoldeOuverture({ avant: null, apres: juin, compteActif: true, arretes: [] })).not.toThrow()
      // Premier arrêté clôturé : à la date conseillée, le refus voisin demande la déclôture, que le message annonçait.
      expect(() => verifierChangementSoldeOuverture({ avant: null, apres: mars, compteActif: true, arretes: [arrete('2026-03-31', 'Clôturé')] })).toThrow(/Déclôturer d’abord cet arrêté/)
      expect(() => verifierChangementSoldeOuverture({ avant: null, apres: mars, compteActif: true, arretes: [arrete('2026-03-31', 'En cours')] })).not.toThrow()
    })

    it('le jour même du premier arrêté : pas « après » (solde de fin de journée) ; en cours, il se recalcule ; clôturé, il couvre la date', () => {
      const jourMeme = { centimes: 52_950, au: '2026-05-31' }
      expect(() => verifierChangementSoldeOuverture({ avant: null, apres: jourMeme, compteActif: true, arretes: [arrete('2026-05-31', 'En cours')] })).not.toThrow()
      expect(() => verifierChangementSoldeOuverture({ avant: null, apres: jourMeme, compteActif: true, arretes: [arrete('2026-05-31', 'Clôturé')] })).toThrow(
        'Solde d’ouverture non modifié : l’arrêté clôturé du 31/05/2026 couvre sa date. Déclôturer d’abord cet arrêté.',
      )
    })

    it('solde d’ouverture déjà daté après un arrêté (enregistré avant cette règle) : inchangé ou retiré, admis ; autre montant à la même date, refusé', () => {
      const arretes = [arrete('2026-04-30', 'Clôturé')]
      expect(() => verifierChangementSoldeOuverture({ avant: juin, apres: { ...juin }, compteActif: true, arretes })).not.toThrow()
      expect(() => verifierChangementSoldeOuverture({ avant: juin, apres: null, compteActif: true, arretes })).not.toThrow()
      expect(() => verifierChangementSoldeOuverture({ avant: juin, apres: { centimes: 1, au: '2026-06-01' }, compteActif: true, arretes })).toThrow(/Solde d’ouverture refusé/)
    })
  })

  it('plusieurs arrêtés clôturés couvrent la date : le message les compte et nomme le dernier, seul à pouvoir être déclôturé', () => {
    const arretes = [arrete('2026-05-10', 'Clôturé'), arrete('2026-05-31', 'Clôturé'), arrete('2026-04-30', 'Clôturé')]
    expect(() => verifierChangementSoldeOuverture({ avant, apres: null, compteActif: true, arretes })).toThrow(
      'Solde d’ouverture non modifié : 2 arrêtés clôturés couvrent sa date. Les déclôturer d’abord, en commençant par celui du 31/05/2026.',
    )
  })

  it('arrêté en cours sur le compte : le refus dit de l’abandonner avant de déclôturer (la déclôture est refusée tant qu’il existe)', () => {
    const enCours = arrete('2026-06-30', 'En cours')
    expect(() =>
      verifierChangementSoldeOuverture({ avant, apres: null, compteActif: true, arretes: [arrete('2026-05-31', 'Clôturé'), enCours] }),
    ).toThrow(
      'Solde d’ouverture non modifié : l’arrêté clôturé du 31/05/2026 couvre sa date. Déclôturer d’abord cet arrêté (après avoir abandonné l’arrêté en cours du 30/06/2026).',
    )
    const plusieurs = [arrete('2026-05-10', 'Clôturé'), enCours, arrete('2026-05-31', 'Clôturé')]
    expect(() => verifierChangementSoldeOuverture({ avant, apres: null, compteActif: true, arretes: plusieurs })).toThrow(
      'Solde d’ouverture non modifié : 2 arrêtés clôturés couvrent sa date. Les déclôturer d’abord, en commençant par celui du 31/05/2026 (après avoir abandonné l’arrêté en cours du 30/06/2026).',
    )
  })

  it('arrêté en cours daté du jour du solde d’ouverture ou d’après, sans arrêté clôturé : aucun refus (l’arrêté en cours se recalcule)', () => {
    const arretes = [arrete('2026-05-31', 'En cours')]
    expect(() => verifierChangementSoldeOuverture({ avant, apres: null, compteActif: true, arretes })).not.toThrow()
    expect(() => verifierChangementSoldeOuverture({ avant: null, apres: avant, compteActif: true, arretes })).not.toThrow()
    expect(() => verifierChangementSoldeOuverture({ avant, apres: { centimes: 1, au: '2026-05-01' }, compteActif: true, arretes })).not.toThrow()
  })
})

describe('vue « Comptes bancaires du mandat » avec un solde d’ouverture', () => {
  const compte = (surcharge: Partial<Banque>): Banque => ({
    id: 'B1',
    createdAt: '2026-05-01T08:00:00.000Z',
    updatedAt: '2026-05-01T08:00:00.000Z',
    createdBy: null,
    updatedBy: null,
    coproprieteId: 'C1',
    nature: 'courant',
    libelle: 'Compte principal',
    iban: null,
    actif: true,
    ...surcharge,
  })
  const ecritures = [ecriture('512-B1', 200, 'debit', new Date(2026, 3, 20)), ecriture('512-B1', 450, 'debit', new Date(2026, 4, 10))]
  const vue = (comptes: Banque[]) =>
    vueComptesBancaires({ comptes, ecritures, reglagesCabinet: null, choixMandat: null, fondement: 'art. 46 — carence', aujourdhui: AUJOURDHUI })

  it('solde affiché : solde d’ouverture plus les lignes datées après son jour ; lignes de ce jour ou d’avant comptées à part', () => {
    const [affiche] = vue([compte({ soldeOuvertureCentimes: 100_000, soldeOuvertureAu: '2026-05-01' })]).comptes
    expect(affiche).toMatchObject({ soldeCentimes: 145_000, soldeOuverture: { centimes: 100_000, au: '2026-05-01' }, lignesAvantOuverture: 1 })
    // Solde d'ouverture daté du jour d'une ligne (10/05) : elle y est déjà, le solde affiché est le solde d'ouverture.
    const [jourMeme] = vue([compte({ soldeOuvertureCentimes: 100_000, soldeOuvertureAu: '2026-05-10' })]).comptes
    expect(jourMeme).toMatchObject({ soldeCentimes: 100_000, lignesAvantOuverture: 2, soldeOuvertureIllisible: false })
  })

  it('sans solde d’ouverture : solde des lignes importées, comme avant ; aucune ligne : solde inconnu', () => {
    expect(vue([compte({})]).comptes[0]).toMatchObject({ soldeCentimes: 65_000, soldeOuverture: null, lignesAvantOuverture: 0, soldeOuvertureIllisible: false })
    expect(vue([compte({ id: 'B2' })]).comptes[0].soldeCentimes).toBeNull()
  })

  it('solde d’ouverture enregistré sans date ou mal formé (point 8) : hors du solde, comme avant, mais marqué pour être signalé', () => {
    for (const illisible of [{ soldeOuvertureCentimes: 100_000 }, { soldeOuvertureCentimes: 100_000, soldeOuvertureAu: '01/05/2026' }, { soldeOuvertureAu: '2026-05-01' }])
      expect(vue([compte(illisible)]).comptes[0]).toMatchObject({ soldeCentimes: 65_000, soldeOuverture: null, lignesAvantOuverture: 0, soldeOuvertureIllisible: true })
  })

  it('compte clôturé : son solde d’ouverture reste dans son solde', () => {
    expect(vue([compte({ actif: false, soldeOuvertureCentimes: 100_000, soldeOuvertureAu: '2026-05-01' })]).comptes[0].soldeCentimes).toBe(145_000)
  })

  it('comptes repris : seuls ceux sans solde d’ouverture gardent un solde inconnu ; le contrôle « à solder » reste neutralisé, et la vue compte ceux qu’il ne lit pas', () => {
    const repris = (id: string, surcharge: Partial<Banque> = {}) => compte({ id, nature: 'repris_ancien_gestionnaire', ...surcharge })
    const ouvert = { soldeOuvertureCentimes: 100_000, soldeOuvertureAu: '2026-05-01' }
    const rendue = vueComptesBancaires({
      comptes: [repris('B1', ouvert), repris('B2'), repris('B3', { actif: false }), repris('B4', { actif: false, ...ouvert }), compte({ id: 'B5', ...ouvert })],
      ecritures,
      reglagesCabinet: { modeParDefaut: 'compte_separe_syndicat' },
      choixMandat: null,
      fondement: 'art. 46 — carence',
      aujourdhui: AUJOURDHUI,
    })
    expect(rendue.reprisSansSoldeConnu).toBe(1)
    // Non réactivé par cette PR : le compte repris au solde d'ouverture saisi (1 450,00 €) ne déclenche pas le rappel.
    expect(rendue.controle?.anomalies.map((anomalie) => anomalie.code)).not.toContain('compte_repris_a_solder')
    // Tant que ce rappel n'est pas lancé, l'écran doit le dire aussi pour le compte repris actif au solde pourtant connu
    // (relecture du 27/11/2026) : ni le compte repris clôturé, ni le compte courant.
    expect(rendue.reprisAvecSoldeOuverture).toBe(1)
  })
})

describe('analyse d’un relevé : lignes datées du jour du solde d’ouverture du compte choisi, ou d’avant (point 3)', () => {
  const CSV = ['Date;Libellé;Montant', '28/04/2026;VIR AVRIL;200,00', '30/04/2026;PRLV AVRIL;-50,00', '01/05/2026;VIR MAI;450,00'].join('\n')
  const analyser = (soldeOuverture: { centimes: number; au: string } | null) =>
    analyserReleve({ texte: CSV, compte: { id: 'B1', iban: null, soldeOuverture }, lignesBanque: [], personnes: [] })

  it('avertissement, sans rien écarter : ces lignes n’entreront pas dans le solde du compte ; le jour même compte', () => {
    const analyse = analyser({ centimes: 100_000, au: '2026-04-30' })
    expect(analyse.retenues).toHaveLength(3)
    expect(analyse.avertissements).toEqual([
      '2 lignes datées au plus tard du 30/04/2026, date du solde d’ouverture du compte : tenues pour déjà comprises dans ce solde, elles n’entreront pas dans le solde du compte.',
    ])
    expect(analyser({ centimes: 100_000, au: '2026-05-01' }).avertissements).toEqual([
      '3 lignes datées au plus tard du 01/05/2026, date du solde d’ouverture du compte : tenues pour déjà comprises dans ce solde, elles n’entreront pas dans le solde du compte.',
    ])
    expect(analyser({ centimes: 100_000, au: '2026-04-28' }).avertissements).toEqual([
      '1 ligne datée au plus tard du 28/04/2026, date du solde d’ouverture du compte : tenue pour déjà comprise dans ce solde, elle n’entrera pas dans le solde du compte.',
    ])
  })

  it('toutes les lignes après la date, ou compte sans solde d’ouverture : aucun avertissement', () => {
    expect(analyser({ centimes: 100_000, au: '2026-04-27' }).avertissements).toEqual([])
    expect(analyser(null).avertissements).toEqual([])
    expect(analyserReleve({ texte: CSV, compte: { id: 'B1', iban: null }, lignesBanque: [], personnes: [] }).avertissements).toEqual([])
  })
})
