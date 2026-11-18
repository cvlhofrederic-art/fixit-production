import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CODES_PIECES_VIGILANCE,
  ENTREE_EN_VIGUEUR_MAX_L8222_1_1,
  REGLAGE_SOUS_TRAITANTS_PAR_DEFAUT,
  SEUIL_VIGILANCE_HT_CENTIMES,
  VALIDITE_VIGILANCE_MOIS,
  controlerAvantOrdreService,
  controlerAvantReglement,
  controlerSousTraitantsAcceptes,
  verificationsSousTraitantsDues,
  type AnomalieEntreprise,
  type PiecesEntreprise,
  type SousTraitantAccepte,
} from '@/lib/administrateur-judiciaire/domain/vigilance-entreprises'

/**
 * Contrôle des entreprises avant un ordre de service et avant un règlement (point 37 du bilan 2 ; Gestéam : fiche
 * entreprise, RC décennale et RC du … au, police, compagnie, bouton « Contrôle déclaratif » — tranches 34, 37, 43 § 24).
 * - Vigilance (C. trav. L. 8222-1, R. 8222-1, D. 8222-5) : à partir de 5 000 € HT, attestation de vigilance de moins de
 *   six mois, authentifiée, et pièce d'immatriculation si elle est obligatoire, à la conclusion puis tous les six mois.
 * - Décennale (C. ass. L. 241-1, L. 243-2) : attestation dont la période couvre l'ouverture du chantier (premier ordre de
 *   service) ; son expiration ensuite ne fait pas perdre la garantie du chantier.
 * - Avant un règlement, aucun texte n'impose de vérifier : VitFix alerte, sans bloquer.
 */

const pieces = (surcharge: Partial<PiecesEntreprise> = {}): PiecesEntreprise => ({
  prestataireId: 'f-1',
  etablieEnFrance: true,
  attestationUrssafLe: '2026-09-01',
  attestationUrssafVerifiee: true,
  immatriculation: { nature: 'kbis', le: '2026-09-01' },
  listeSalariesEtrangersLe: '2026-09-01',
  decennale: { du: '2026-01-01', au: '2026-12-31', police: 'P-123', compagnie: 'Assureur', activites: ['Ravalement', 'Étanchéité'] },
  ...surcharge,
})

const operation = { date: '2026-10-29', montantHtCentimes: 1_200_000, decennaleObligatoire: true, activite: 'Ravalement' }
const reglement = { date: '2026-10-29', montantHtCentimes: 1_200_000 }
const codes = (anomalies: AnomalieEntreprise[]) => anomalies.map((a) => a.code)

describe('constantes', () => {
  it('seuil de 5 000 € HT et validité de six mois', () => {
    expect(SEUIL_VIGILANCE_HT_CENTIMES).toBe(500_000)
    expect(VALIDITE_VIGILANCE_MOIS).toBe(6)
  })
})

describe('avant un ordre de service — vigilance', () => {
  it('dossier complet et à jour : rien à signaler', () => {
    expect(controlerAvantOrdreService(pieces(), operation)).toEqual([])
  })

  it('attestation de vigilance absente ou de six mois et plus : bloquant, avec son fondement', () => {
    expect(controlerAvantOrdreService(pieces({ attestationUrssafLe: null }), operation)).toMatchObject([
      { code: 'vigilance_urssaf_absente', gravite: 'bloquant', fondement: 'C. trav. art. L. 8222-1, R. 8222-1, D. 8222-5' },
    ])
    expect(controlerAvantOrdreService(pieces({ attestationUrssafLe: '2026-04-29' }), operation)).toMatchObject([
      { code: 'vigilance_urssaf_perimee', gravite: 'bloquant' },
    ])
    expect(controlerAvantOrdreService(pieces({ attestationUrssafLe: '2026-04-30' }), operation)).toEqual([])
  })

  it('authenticité non vérifiée : bloquant avant de commander (D. 8222-5, 1°)', () => {
    expect(controlerAvantOrdreService(pieces({ attestationUrssafVerifiee: false }), operation)).toMatchObject([
      { code: 'vigilance_urssaf_non_verifiee', gravite: 'bloquant', fondement: 'C. trav. art. D. 8222-5, 1° ; CSS art. D. 243-15' },
    ])
  })

  it('pièce d’immatriculation absente ou à renouveler : bloquant ; non exigée si l’immatriculation n’est pas obligatoire', () => {
    expect(controlerAvantOrdreService(pieces({ immatriculation: null }), operation)).toMatchObject([{ code: 'immatriculation_absente', gravite: 'bloquant' }])
    expect(controlerAvantOrdreService(pieces({ immatriculation: { nature: 'extrait_rne', le: '2026-01-15' } }), operation)).toMatchObject([
      { code: 'immatriculation_a_renouveler', gravite: 'bloquant' },
    ])
    expect(controlerAvantOrdreService(pieces({ immatriculation: null, immatriculationObligatoire: false }), operation)).toEqual([])
  })

  it('liste des salariés étrangers absente ou ancienne : alerte, avec la périodicité de D. 8254-4', () => {
    expect(controlerAvantOrdreService(pieces({ listeSalariesEtrangersLe: null }), operation)).toMatchObject([
      { code: 'liste_salaries_etrangers_absente', gravite: 'alerte', fondement: 'C. trav. art. L. 8254-1, D. 8254-1, D. 8254-2, D. 8254-4' },
    ])
    const ancienne = controlerAvantOrdreService(pieces({ listeSalariesEtrangersLe: '2026-01-01' }), operation)
    expect(ancienne).toMatchObject([{ code: 'liste_salaries_etrangers_a_renouveler', gravite: 'alerte' }])
    expect(ancienne[0].message).toMatch(/à renouveler/)
  })

  it('entreprise établie à l’étranger : pièces de l’art. D. 8222-7, en français ; absentes ou à renouveler : bloquant', () => {
    const etrangere = pieces({ etablieEnFrance: false, attestationUrssafLe: null, immatriculation: null, piecesEtrangerLe: '2026-09-01' })
    expect(controlerAvantOrdreService(etrangere, operation)).toEqual([])
    expect(controlerAvantOrdreService({ ...etrangere, piecesEtrangerLe: null }, operation)).toMatchObject([
      { code: 'pieces_etranger_absentes', gravite: 'bloquant', fondement: 'C. trav. art. L. 8222-4, D. 8222-7, D. 8222-8' },
    ])
    expect(controlerAvantOrdreService({ ...etrangere, piecesEtrangerLe: '2026-01-01' }, operation)).toMatchObject([
      { code: 'pieces_etranger_a_renouveler', gravite: 'bloquant' },
    ])
  })

  it('sous le seuil de 5 000 € HT : pas de contrôle de vigilance', () => {
    expect(
      controlerAvantOrdreService(pieces({ attestationUrssafLe: null, immatriculation: null, listeSalariesEtrangersLe: null }), {
        ...operation,
        montantHtCentimes: SEUIL_VIGILANCE_HT_CENTIMES - 1,
      }),
    ).toEqual([])
    expect(codes(controlerAvantOrdreService(pieces({ attestationUrssafLe: null }), { ...operation, montantHtCentimes: SEUIL_VIGILANCE_HT_CENTIMES }))).toEqual([
      'vigilance_urssaf_absente',
    ])
  })

  it('pièce datée après le contrôle : alerte de saisie ET pièce comptée absente, donc l’ordre reste bloqué', () => {
    expect(controlerAvantOrdreService(pieces({ attestationUrssafLe: '2026-11-15' }), operation)).toMatchObject([
      { code: 'piece_datee_apres_controle', gravite: 'alerte', fondement: null },
      { code: 'vigilance_urssaf_absente', gravite: 'bloquant' },
    ])
    expect(codes(controlerAvantOrdreService(pieces({ immatriculation: { nature: 'kbis', le: '2026-12-01' } }), operation))).toEqual([
      'piece_datee_apres_controle',
      'immatriculation_absente',
    ])
  })
})

describe('avant un ordre de service — assurance décennale', () => {
  it('absente, période incomplète ou ne couvrant pas l’ouverture du chantier : bloquant', () => {
    expect(controlerAvantOrdreService(pieces({ decennale: null }), operation)).toMatchObject([
      { code: 'decennale_absente', gravite: 'bloquant', fondement: 'C. ass. art. L. 241-1, L. 243-2' },
    ])
    expect(controlerAvantOrdreService(pieces({ decennale: { du: null, au: '2026-12-31' } }), operation)).toMatchObject([
      { code: 'decennale_periode_incomplete', gravite: 'bloquant' },
    ])
    expect(controlerAvantOrdreService(pieces({ decennale: { du: '2025-01-01', au: '2025-12-31' } }), operation)).toMatchObject([
      { code: 'decennale_hors_periode', gravite: 'bloquant' },
    ])
    expect(controlerAvantOrdreService(pieces({ decennale: { du: '2026-11-01', au: '2027-10-31' } }), operation)).toMatchObject([
      { code: 'decennale_hors_periode', gravite: 'bloquant' },
    ])
  })

  it('ordre de service complémentaire : la décennale s’apprécie à l’ouverture du chantier (premier ordre de service)', () => {
    const complementaire = { ...operation, date: '2027-02-15', dateOuvertureChantier: '2026-10-29' }
    expect(controlerAvantOrdreService(pieces(), complementaire)).toEqual([])
  })

  it('activité commandée absente des activités couvertes : alerte à confirmer ; accents, ligatures et apostrophes ignorés', () => {
    expect(controlerAvantOrdreService(pieces(), { ...operation, activite: 'Couverture' })).toMatchObject([
      { code: 'decennale_activite_non_couverte', gravite: 'alerte', aConfirmer: true },
    ])
    expect(controlerAvantOrdreService(pieces(), { ...operation, activite: '  ravalement ' })).toEqual([])
    const ligatures = pieces({ decennale: { du: '2026-01-01', au: '2026-12-31', activites: ['Gros œuvre', 'Pose d’ouvrants'] } })
    expect(controlerAvantOrdreService(ligatures, { ...operation, activite: 'gros oeuvre' })).toEqual([])
    expect(controlerAvantOrdreService(ligatures, { ...operation, activite: "Pose d'ouvrants" })).toEqual([])
  })

  it('travaux non qualifiés : alerte à confirmer ; non soumis à la décennale : rien', () => {
    expect(controlerAvantOrdreService(pieces({ decennale: null }), { ...operation, decennaleObligatoire: null })).toMatchObject([
      { code: 'decennale_a_qualifier', gravite: 'alerte', aConfirmer: true },
    ])
    expect(controlerAvantOrdreService(pieces({ decennale: null }), { ...operation, decennaleObligatoire: false })).toEqual([])
  })

  it('RC professionnelle échue : alerte de gestion, sans fondement légal', () => {
    const [alerte] = controlerAvantOrdreService(pieces({ rcp: { du: '2025-01-01', au: '2025-12-31' } }), operation)
    expect(alerte).toMatchObject({ code: 'rcp_echue', gravite: 'alerte', fondement: null, aConfirmer: false })
    expect(alerte.message).not.toMatch(/\bart\.|article|L\. \d/)
  })
})

describe('avant un règlement — alertes seulement', () => {
  it('pièces de plus de six mois pendant l’exécution : une alerte regroupée, jamais bloquante', () => {
    const anomalies = controlerAvantReglement(
      pieces({ attestationUrssafLe: '2026-03-01', immatriculation: { nature: 'kbis', le: '2026-03-01' } }),
      reglement,
    )
    expect(anomalies).toMatchObject([{ code: 'vigilance_semestrielle_depassee', gravite: 'alerte', fondement: 'C. trav. art. L. 8222-1, R. 8222-1, D. 8222-5' }])
    expect(anomalies[0].message).toMatch(/aucun texte n'impose de suspendre le paiement/)
    expect(anomalies[0].message).not.toMatch(/avant de commander/)
  })

  it('pièce jamais remise : alerte distincte ; entreprise étrangère : fondement de l’art. D. 8222-7', () => {
    expect(controlerAvantReglement(pieces({ attestationUrssafLe: null }), reglement)).toMatchObject([{ code: 'vigilance_jamais_remise', gravite: 'alerte' }])
    expect(
      controlerAvantReglement(pieces({ etablieEnFrance: false, attestationUrssafLe: null, immatriculation: null, piecesEtrangerLe: null }), reglement),
    ).toMatchObject([{ code: 'vigilance_jamais_remise', fondement: 'C. trav. art. L. 8222-4, D. 8222-7, D. 8222-8' }])
  })

  it('liste des salariés étrangers ancienne et pièce datée après le règlement : alertes conservées', () => {
    expect(codes(controlerAvantReglement(pieces({ listeSalariesEtrangersLe: '2026-01-01' }), reglement))).toEqual(['liste_salaries_etrangers_a_renouveler'])
    expect(codes(controlerAvantReglement(pieces({ attestationUrssafLe: '2026-11-15' }), reglement))).toEqual([
      'vigilance_jamais_remise',
      'piece_datee_apres_controle',
    ])
    expect(controlerAvantReglement(pieces({ listeSalariesEtrangersLe: '2026-01-01' }), reglement).every((a) => a.gravite === 'alerte')).toBe(true)
  })

  it('décennale expirée après l’ouverture du chantier : garantie maintenue, rien à signaler ; ouverture non couverte : alerte', () => {
    const avecOuverture = { ...reglement, decennaleObligatoire: true, dateOuvertureChantier: '2026-05-15' }
    expect(controlerAvantReglement(pieces({ decennale: { du: '2026-01-01', au: '2026-06-30' } }), avecOuverture)).toEqual([])
    expect(controlerAvantReglement(pieces({ decennale: { du: '2026-07-01', au: '2027-06-30' } }), avecOuverture)).toMatchObject([
      { code: 'decennale_hors_periode', gravite: 'alerte' },
    ])
  })

  it('travaux soumis à la décennale sans date d’ouverture du chantier : alerte ; non qualifiés : alerte à qualifier ; non précisé : rien', () => {
    expect(controlerAvantReglement(pieces(), { ...reglement, decennaleObligatoire: true })).toMatchObject([
      { code: 'ouverture_chantier_inconnue', gravite: 'alerte' },
    ])
    expect(controlerAvantReglement(pieces(), { ...reglement, decennaleObligatoire: null })).toMatchObject([{ code: 'decennale_a_qualifier' }])
    expect(controlerAvantReglement(pieces(), reglement)).toEqual([])
  })
})

describe('saisie invalide et marqueurs', () => {
  it('refuse une date, un montant, une nature d’immatriculation ou une période inversée', () => {
    expect(() => controlerAvantOrdreService(pieces(), { ...operation, date: '29/10/2026' })).toThrow(/AAAA-MM-JJ/)
    expect(() => controlerAvantOrdreService(pieces(), { ...operation, montantHtCentimes: -1 })).toThrow(/centimes/)
    expect(() => controlerAvantOrdreService(pieces({ attestationUrssafLe: '2026-02-30' }), operation)).toThrow(/URSSAF/)
    // @ts-expect-error — nature hors NATURES_IMMATRICULATION
    expect(() => controlerAvantOrdreService(pieces({ immatriculation: { nature: 'attestation_honneur', le: '2026-09-01' } }), operation)).toThrow(
      /immatriculation/,
    )
    expect(() => controlerAvantOrdreService(pieces({ decennale: { du: '2026-12-31', au: '2026-01-01' } }), operation)).toThrow(/inversée/)
    expect(() => controlerAvantOrdreService(pieces(), { ...operation, dateOuvertureChantier: '2026-13-01' })).toThrow(/chantier/)
  })

  it('l’en-tête date la relecture du texte et garde ses points ouverts', () => {
    const source = readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'vigilance-entreprises.ts'), 'utf8')
    expect(source).toMatch(/Légifrance, décisions lues sur Judilibre, le 29\/10\/2026/)
    expect(source).toMatch(/🔵/)
    expect(source).toMatch(/🔴/)
  })
})

describe('J67 — recommandations validées par Hugo le 17/11/2026 (R75 à R77)', () => {
  it('R75 : sous urgence constatée, la vigilance reste contrôlée mais donne une alerte forte au lieu d’un blocage ; la décennale reste bloquante', () => {
    const urgence = { ...operation, urgenceConstatee: true }
    const sansPieces = controlerAvantOrdreService(pieces({ attestationUrssafLe: null, immatriculation: null }), urgence)
    expect(codes(sansPieces)).toEqual(['vigilance_urssaf_absente', 'immatriculation_absente'])
    expect(sansPieces.every((a) => a.gravite === 'alerte')).toBe(true)
    expect(sansPieces[0].message).toMatch(/alerte forte/)
    expect(sansPieces[0].message).toMatch(/J67, R75/)
    expect(sansPieces[0].fondement).toBe('C. trav. art. L. 8222-1, R. 8222-1, D. 8222-5')
    expect(controlerAvantOrdreService(pieces({ attestationUrssafVerifiee: false }), urgence)).toMatchObject([
      { code: 'vigilance_urssaf_non_verifiee', gravite: 'alerte' },
    ])
    // la décennale n'est pas visée par R75 : elle reste bloquante
    expect(controlerAvantOrdreService(pieces({ decennale: null }), urgence)).toMatchObject([{ code: 'decennale_absente', gravite: 'bloquant' }])
    // sans urgence constatée : inchangé
    expect(controlerAvantOrdreService(pieces({ attestationUrssafLe: null }), operation)).toMatchObject([{ gravite: 'bloquant' }])
    expect([...CODES_PIECES_VIGILANCE]).toEqual(expect.arrayContaining(['vigilance_urssaf_absente', 'vigilance_urssaf_non_verifiee', 'immatriculation_absente']))
  })

  it('R75 (relecture) : montant HT inconnu sous urgence constatée, vigilance contrôlée comme au-delà du seuil, en alerte ; sans urgence, erreur', () => {
    const inconnu = { ...operation, montantHtCentimes: null, urgenceConstatee: true }
    expect(controlerAvantOrdreService(pieces(), inconnu)).toMatchObject([{ code: 'seuil_vigilance_non_apprecie', gravite: 'alerte' }])
    expect(codes(controlerAvantOrdreService(pieces({ attestationUrssafLe: null }), inconnu))).toEqual(['seuil_vigilance_non_apprecie', 'vigilance_urssaf_absente'])
    expect(() => controlerAvantOrdreService(pieces(), { ...inconnu, urgenceConstatee: false })).toThrow(/montant HT de l'opération inconnu/i)
  })

  it('R77 : L. 8222-1-1 pas encore en vigueur ; information « au plus tard le 26/12/2026 » tant que la date n’est pas atteinte', () => {
    expect(ENTREE_EN_VIGUEUR_MAX_L8222_1_1).toBe('2026-12-26')
    const st: SousTraitantAccepte = {
      sousTraitantId: 'st-1',
      marcheId: 'dem-1',
      accepteLe: '2026-11-02',
      montantHtCentimes: 2_000_000,
      finLe: null,
      pieces: [],
    }
    const avant = controlerSousTraitantsAcceptes([st], REGLAGE_SOUS_TRAITANTS_PAR_DEFAUT, '2026-11-17')
    expect(avant).toMatchObject([{ code: 'sous_traitants_obligation_a_venir', gravite: 'alerte', fondement: 'C. trav. art. L. 8222-1-1' }])
    expect(avant[0].message).toMatch(/au plus tard le 26\/12\/2026/)
    // date atteinte, valeurs du décret non saisies : contrôle impossible, alerte à confirmer
    const sansDecret = controlerSousTraitantsAcceptes([st], REGLAGE_SOUS_TRAITANTS_PAR_DEFAUT, '2026-12-26')
    expect(sansDecret).toMatchObject([{ code: 'sous_traitants_valeurs_decret_a_saisir', gravite: 'alerte', aConfirmer: true }])
    // date fixée par le décret au-delà du 26/12/2026 : refusée
    expect(() =>
      controlerSousTraitantsAcceptes([st], { ...REGLAGE_SOUS_TRAITANTS_PAR_DEFAUT, entreeEnVigueurLe: '2027-01-01' }, '2026-11-17'),
    ).toThrow(/26\/12\/2026/)
  })

  it('R77 : activé à la date du décret, avec ses valeurs : pièces des sous-traitants acceptés vérifiées périodiquement, élément « à faire »', () => {
    const reglage = { entreeEnVigueurLe: '2026-12-01', montantMinimalHtCentimes: 500_000, piecesExigees: ['attestation_vigilance'], periodiciteMois: 6 }
    const st: SousTraitantAccepte = {
      sousTraitantId: 'st-1',
      marcheId: 'dem-1',
      accepteLe: '2026-12-02',
      montantHtCentimes: 2_000_000,
      finLe: null,
      pieces: [{ nature: 'attestation_vigilance', le: '2026-12-02' }],
    }
    expect(controlerSousTraitantsAcceptes([st], reglage, '2027-01-15')).toEqual([])
    const perimee = controlerSousTraitantsAcceptes([st], reglage, '2027-06-02')
    expect(perimee).toMatchObject([{ code: 'sous_traitant_piece_a_obtenir', gravite: 'alerte', fondement: 'C. trav. art. L. 8222-1-1' }])
    // sous le montant minimal, ou sous-traité terminé : rien
    expect(controlerSousTraitantsAcceptes([{ ...st, montantHtCentimes: 400_000, pieces: [] }], reglage, '2027-06-02')).toEqual([])
    expect(controlerSousTraitantsAcceptes([{ ...st, finLe: '2027-03-01', pieces: [] }], reglage, '2027-06-02')).toEqual([])
    const [aFaire] = verificationsSousTraitantsDues([st], reglage)
    expect(aFaire).toMatchObject({ sousTraitantId: 'st-1', marcheId: 'dem-1', date: '2027-06-02' })
    expect(aFaire.justification).toMatch(/2 décembre 2026|02\/12\/2026/)
    expect(aFaire.justification).toMatch(/6 mois/)
    // sans les valeurs du décret : aucun élément calculé
    expect(verificationsSousTraitantsDues([st], REGLAGE_SOUS_TRAITANTS_PAR_DEFAUT)).toEqual([])
  })

  it('en-tête : R75, R76 et R77 tranchées (J67) ; restent ouvertes la qualification décennale et l’alerte avant règlement', () => {
    const source = readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'vigilance-entreprises.ts'), 'utf8')
    const enTete = source.slice(0, source.indexOf('*/')).replaceAll(/\r?\n \* */g, ' ')
    const questions = enTete.slice(enTete.indexOf('🔴 Non établi'), enTete.indexOf('Gestéam — fiche entreprise'))
    expect(questions).not.toContain("travaux d'urgence")
    expect(questions).not.toContain('RC professionnelle')
    expect(questions).not.toContain('L. 8222-1-1')
    expect(questions).toContain('qualification des travaux soumis à l\'assurance décennale')
    expect(questions).toContain('avant un règlement')
    for (const attendu of ['J67, R75', 'J67, R76', 'J67, R77', 'L. 8221-2', 'chapitre II', 'loi n° 2026-534', '26/12/2026'])
      expect(enTete).toContain(attendu)
  })
})
