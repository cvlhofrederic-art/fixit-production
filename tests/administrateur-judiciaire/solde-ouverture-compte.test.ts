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
  soldeOuvertureEnregistre,
  verifierChangementSoldeOuverture,
} from '@/lib/administrateur-judiciaire/domain/solde-ouverture-compte'

/**
 * Solde d'ouverture d'un compte bancaire (PR 799, point 2, choix A validé par le référent métier, décision du
 * 26/11/2026) : montant signé et date, saisis sur le compte. Le solde vaut au DÉBUT du jour indiqué, avant ses
 * mouvements. Il entre dans le solde du sous-compte 512 du compte à partir de cette date ; les lignes de relevé datées
 * avant sont tenues pour déjà comprises dans ce solde. Avant cette date, le solde reste la somme des lignes importées.
 * Règles pures : saisie, lecture d'une ligne de la base, changement refusé quand un arrêté clôturé couvre la date.
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

  it('avec solde d’ouverture : ce solde plus les lignes datées de son jour ou d’après ; les lignes d’avant n’y entrent pas', () => {
    // 1 000,00 + 450,00 (le jour même : le solde vaut au début du jour) − 120,50 + 99,00 ; les 200,00 du 20/04 sont déjà dans le solde d'ouverture.
    expect(soldeCompteBancaireCentimes(ecritures, 'B1', ouverture)).toBe(142_850)
    expect(soldeCompteBancaireCentimes(ecritures, 'B1', ouverture, '2026-05-31')).toBe(132_950)
    expect(soldeCompteBancaireCentimes(ecritures, 'B1', ouverture, '2026-05-01')).toBe(145_000)
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

  it('lignes datées avant le solde d’ouverture : comptées pour l’avertissement (jour même exclu, autres comptes aussi)', () => {
    expect(lignesAvantOuverture(ecritures, 'B1', ouverture)).toBe(1)
    expect(lignesAvantOuverture(ecritures, 'B1', { centimes: 0, au: '2026-06-03' })).toBe(4)
    expect(lignesAvantOuverture(ecritures, 'B1', null)).toBe(0)
    expect(lignesAvantOuverture(ecritures, 'B3', ouverture)).toBe(0)
  })

  it('arrêté en cours : solde compta de l’instant avec le solde d’ouverture du compte ; arrêté clôturé : figé', () => {
    const arrete: ArreteRapprochement = {
      id: 'A1',
      banqueId: 'B1',
      dateArrete: '2026-05-31',
      soldeBanqueCentimes: 132_950,
      soldeComptaCentimes: 0,
      statut: 'En cours',
      elements: [],
    }
    expect(avecSoldeComptaCourant(arrete, ecritures, ouverture).soldeComptaCentimes).toBe(132_950)
    expect(avecSoldeComptaCourant(arrete, ecritures).soldeComptaCentimes).toBe(52_950)
    expect(avecSoldeComptaCourant({ ...arrete, statut: 'Clôturé' }, ecritures, ouverture).soldeComptaCentimes).toBe(0)
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
    // Arrêté daté du jour même du solde d'ouverture : couvert (le solde vaut au début de ce jour).
    expect(() => verifierChangementSoldeOuverture({ avant: null, apres: avant, compteActif: true, arretes: [arrete('2026-05-01', 'Clôturé')] })).toThrow(
      /arrêté clôturé du 01\/05\/2026/,
    )
  })

  it('date déplacée : l’ancienne date et la nouvelle comptent toutes deux', () => {
    const arretes = [arrete('2026-05-31', 'Clôturé')]
    // Ancienne date couverte, nouvelle date postérieure à l'arrêté : le solde figé contenait l'ancien solde d'ouverture.
    expect(() => verifierChangementSoldeOuverture({ avant, apres: { centimes: 100_000, au: '2026-06-01' }, compteActif: true, arretes })).toThrow(
      /Déclôturer d’abord/,
    )
    // Ancienne date postérieure à l'arrêté, nouvelle date couverte.
    expect(() =>
      verifierChangementSoldeOuverture({ avant: { centimes: 100_000, au: '2026-06-01' }, apres: avant, compteActif: true, arretes }),
    ).toThrow(/Déclôturer d’abord/)
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

  it('arrêté clôturé antérieur à la date, arrêté en cours : aucun refus (l’arrêté en cours se recalcule)', () => {
    const arretes = [arrete('2026-04-30', 'Clôturé'), arrete('2026-05-31', 'En cours')]
    expect(() => verifierChangementSoldeOuverture({ avant, apres: null, compteActif: true, arretes })).not.toThrow()
    expect(() => verifierChangementSoldeOuverture({ avant: null, apres: avant, compteActif: true, arretes })).not.toThrow()
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

  it('solde affiché : solde d’ouverture plus les lignes à partir de sa date ; lignes d’avant comptées à part', () => {
    const [affiche] = vue([compte({ soldeOuvertureCentimes: 100_000, soldeOuvertureAu: '2026-05-01' })]).comptes
    expect(affiche).toMatchObject({ soldeCentimes: 145_000, soldeOuverture: { centimes: 100_000, au: '2026-05-01' }, lignesAvantOuverture: 1 })
  })

  it('sans solde d’ouverture : solde des lignes importées, comme avant ; aucune ligne : solde inconnu', () => {
    expect(vue([compte({})]).comptes[0]).toMatchObject({ soldeCentimes: 65_000, soldeOuverture: null, lignesAvantOuverture: 0 })
    expect(vue([compte({ id: 'B2' })]).comptes[0].soldeCentimes).toBeNull()
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

describe('analyse d’un relevé : lignes datées avant le solde d’ouverture du compte choisi', () => {
  const CSV = ['Date;Libellé;Montant', '28/04/2026;VIR AVRIL;200,00', '30/04/2026;PRLV AVRIL;-50,00', '01/05/2026;VIR MAI;450,00'].join('\n')
  const analyser = (soldeOuverture: { centimes: number; au: string } | null) =>
    analyserReleve({ texte: CSV, compte: { id: 'B1', iban: null, soldeOuverture }, lignesBanque: [], personnes: [] })

  it('avertissement, sans rien écarter : ces lignes n’entreront pas dans le solde du compte', () => {
    const analyse = analyser({ centimes: 100_000, au: '2026-05-01' })
    expect(analyse.retenues).toHaveLength(3)
    expect(analyse.avertissements).toEqual([
      '2 lignes datées avant le solde d’ouverture du compte (01/05/2026) : tenues pour déjà comprises dans ce solde, elles n’entreront pas dans le solde du compte.',
    ])
    expect(analyser({ centimes: 100_000, au: '2026-04-30' }).avertissements).toEqual([
      '1 ligne datée avant le solde d’ouverture du compte (30/04/2026) : tenue pour déjà comprise dans ce solde, elle n’entrera pas dans le solde du compte.',
    ])
  })

  it('aucune ligne avant la date, ou compte sans solde d’ouverture : aucun avertissement', () => {
    expect(analyser({ centimes: 100_000, au: '2026-04-28' }).avertissements).toEqual([])
    expect(analyser(null).avertissements).toEqual([])
    expect(analyserReleve({ texte: CSV, compte: { id: 'B1', iban: null }, lignesBanque: [], personnes: [] }).avertissements).toEqual([])
  })
})
