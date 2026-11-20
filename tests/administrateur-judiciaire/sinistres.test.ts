import { describe, expect, it } from 'vitest'
import { enTeteDuModule } from './en-tete-module'
import {
  DELAIS_ASSURANCE_SINISTRE,
  NATURES_PARTIE_SINISTRE,
  ROLES_PARTIE_SINISTRE,
  controlerChronologieSinistre,
  creerSinistre,
  erreursSaisieSinistre,
  etapeSuiviSinistre,
  indemnitesSinistre,
  reperesDelaisSinistre,
  statutSinistre,
  type SaisieSinistre,
} from '@/lib/administrateur-judiciaire/domain/sinistres'
import { TYPES_SINISTRE_IMPAYES } from '@/lib/administrateur-judiciaire/domain/contentieux-assurance-impayes'

/**
 * Sinistres (cartographie Gestéam, tranches 20 et 28) : fiche, phase déduite des dates, chronologie, indemnités et
 * repères de délais d'assurance.
 * - Type, phase et statut : référentiels Gestéam existants (TYPE_SINISTRE, PHASE_SINISTRE, STATUT_SINISTRE).
 * - L'étape de suivi se lit sur les dates (déclaration → expertise → rapport → règlement → clôture) ; elle ne remplace
 *   pas la phase Gestéam, saisie.
 * - Échéances du suivi (J67, R49) : déclaration au plus tard dans le délai du contrat, au moins 5 jours ouvrés (2 pour
 *   un vol) depuis la connaissance du sinistre (C. assur. art. L. 113-2) ; prescription au plus tôt deux ans après
 *   l'événement (C. assur. art. L. 114-1), interrompue par les causes de l'art. L. 114-2, durée non modifiable (L. 114-3).
 */

const saisie = (surcharge: Partial<SaisieSinistre> = {}): SaisieSinistre => ({
  coproprieteId: 'copro-1',
  type: 'Dégât des eaux',
  phase: null,
  dateSurvenance: '2026-10-27',
  dateConnaissance: null,
  dateDeclaration: null,
  dateExpertise: null,
  dateRapport: null,
  dateReglement: null,
  dateCloture: null,
  partiesCommunesLesees: true,
  partiesCommunesResponsables: false,
  origine: 'Fuite sur colonne d’eau froide',
  lieu: 'Cage B, 3e étage',
  dommages: 'Plafond du palier',
  assurance: { compagnie: null, courtier: null, contrat: null, numeroSinistre: null },
  indemniteImmediateCentimes: 0,
  indemniteImmediateReglee: false,
  indemniteDiffereeCentimes: 0,
  indemniteDiffereeReglee: false,
  causesSupprimees: false,
  reparationsFaites: false,
  ...surcharge,
})

describe('sinistres — types et création', () => {
  it('accepte une phase Gestéam saisie, refuse une phase inconnue', () => {
    expect(creerSinistre(saisie({ phase: "Mission d'expertise" })).phase).toBe("Mission d'expertise")
    expect(() => creerSinistre(saisie({ phase: 'Expertise' as never }))).toThrow(/phase/i)
  })

  it('crée une fiche : textes nettoyés, connaissance = survenance par défaut', () => {
    const sinistre = creerSinistre(saisie({ origine: '  Fuite  ' }))
    expect(sinistre.origine).toBe('Fuite')
    expect(sinistre.dateConnaissance).toBe('2026-10-27')
  })

  it('refuse un type inconnu, une date invalide, un montant non entier', () => {
    expect(() => creerSinistre(saisie({ type: 'Grêle' as never }))).toThrow(/type/i)
    expect(() => creerSinistre(saisie({ dateSurvenance: '27/10/2026' }))).toThrow(/date/i)
    expect(() => creerSinistre(saisie({ dateExpertise: '2026-13-01' }))).toThrow(/date/i)
    expect(() => creerSinistre(saisie({ indemniteDiffereeCentimes: 10.5 }))).toThrow(/montant/i)
  })
})

describe('sinistres — champs de la fiche Gestéam (optionnels à la saisie)', () => {
  it('une saisie sans les champs Gestéam reste valide : valeurs par défaut sur la fiche', () => {
    expect(creerSinistre(saisie())).toMatchObject({
      numero: null,
      dateOuverture: null,
      mandatId: null,
      bail: null,
      heureExpertise: null,
      dateForclusion: null,
      parties: [],
      carnetEntretien: false,
      publieExtranet: false,
      notes: '',
      responsable: null,
      assistant: null,
      assurance: { compagnieId: null, courtierId: null, numeroCourtier: null, contratId: null },
    })
    expect(erreursSaisieSinistre(saisie())).toEqual([])
  })

  it('accepte et nettoie les champs Gestéam saisis', () => {
    const sinistre = creerSinistre(
      saisie({
        numero: '  CV.00012 ',
        dateOuverture: '2026-10-28',
        mandatId: 'M1',
        bail: '  ',
        heureExpertise: '09:30',
        dateForclusion: '2028-10-27',
        parties: [{ role: 'Lésé', nature: 'Personne', refId: null, libelle: '  Occupant   du lot 12 ' }],
        carnetEntretien: true,
        publieExtranet: true,
        notes: '  Clé chez le gardien.\nRappeler l’expert.  ',
        responsable: { id: 'collab-1', nom: ' Responsable  Démo ' },
        assistant: { id: null, nom: '   ' },
        assurance: { compagnie: 'MMA', courtier: null, contrat: 'POL-1', numeroSinistre: null, numeroCourtier: ' C-77 ', contratId: 'K1' },
      }),
    )
    expect(sinistre).toMatchObject({
      numero: 'CV.00012',
      bail: null,
      heureExpertise: '09:30',
      parties: [{ role: 'Lésé', nature: 'Personne', refId: null, libelle: 'Occupant du lot 12' }],
      notes: 'Clé chez le gardien.\nRappeler l’expert.',
      responsable: { id: 'collab-1', nom: 'Responsable Démo' },
      assistant: null,
      assurance: { compagnie: 'MMA', contrat: 'POL-1', numeroCourtier: 'C-77', contratId: 'K1', compagnieId: null },
    })
  })

  it('refuse une heure, une date d’ouverture ou de forclusion mal formées, une partie inconnue ou sans nom', () => {
    expect(() => creerSinistre(saisie({ heureExpertise: '9h30' }))).toThrow(/heure/i)
    expect(() => creerSinistre(saisie({ heureExpertise: '24:00' }))).toThrow(/heure/i)
    expect(() => creerSinistre(saisie({ dateOuverture: '28/10/2026' }))).toThrow(/date/i)
    expect(() => creerSinistre(saisie({ dateForclusion: '2028-02-30' }))).toThrow(/date/i)
    expect(() =>
      creerSinistre(saisie({ parties: [{ role: 'Victime' as never, nature: 'Personne', refId: null, libelle: 'X' }] })),
    ).toThrow(/rôle/i)
    expect(() =>
      creerSinistre(saisie({ parties: [{ role: 'Lésé', nature: 'Syndic' as never, refId: null, libelle: 'X' }] })),
    ).toThrow(/nature/i)
    expect(() => creerSinistre(saisie({ parties: [{ role: 'Lésé', nature: 'Personne', refId: null, libelle: ' ' }] }))).toThrow(
      /partie/i,
    )
  })

  it('erreursSaisieSinistre liste toutes les erreurs de format, sans lever', () => {
    expect(erreursSaisieSinistre(saisie({ type: 'Grêle' as never, heureExpertise: '9h' }))).toHaveLength(2)
  })

  it('J67, R51 : « transmis à la compagnie le » et « courtier mandaté par l’assureur », champs facultatifs de l’assurance, contrôlés', () => {
    expect(creerSinistre(saisie()).assurance).toMatchObject({ transmisCompagnieLe: null, courtierMandateParAssureur: false })
    const assurance = { compagnie: null, courtier: 'Courtier Démo', contrat: null, numeroSinistre: null }
    expect(
      creerSinistre(saisie({ assurance: { ...assurance, transmisCompagnieLe: '2026-11-03', courtierMandateParAssureur: true } })).assurance,
    ).toMatchObject({ transmisCompagnieLe: '2026-11-03', courtierMandateParAssureur: true })
    expect(() => creerSinistre(saisie({ assurance: { ...assurance, transmisCompagnieLe: '03/11/2026' } }))).toThrow(/transmisCompagnieLe/)
    expect(() => creerSinistre(saisie({ assurance: { ...assurance, courtierMandateParAssureur: 1 as never } }))).toThrow(/mandat du courtier/i)
  })

  it('rôles et natures des parties : grille Gestéam (« Lésé » observé, les autres déduits)', () => {
    expect(ROLES_PARTIE_SINISTRE).toEqual(['Lésé', 'Responsable', 'Autre'])
    expect(NATURES_PARTIE_SINISTRE).toEqual(['Entreprise', 'Immeuble', 'Personne'])
  })
})

describe('sinistres — étape de suivi déduite des dates, statut', () => {
  it.each([
    [{}, 'a_declarer'],
    [{ dateDeclaration: '2026-10-28' }, 'declare'],
    [{ dateDeclaration: '2026-10-28', dateExpertise: '2026-11-10' }, 'expertise'],
    [{ dateDeclaration: '2026-10-28', dateExpertise: '2026-11-10', dateRapport: '2026-11-20' }, 'rapport'],
    [{ dateDeclaration: '2026-10-28', dateRapport: '2026-11-20', dateReglement: '2026-12-01' }, 'regle'],
    [{ dateDeclaration: '2026-10-28', dateCloture: '2026-12-15' }, 'clos'],
  ] as const)('%o → %s', (dates, phase) => {
    expect(etapeSuiviSinistre(creerSinistre(saisie(dates)))).toBe(phase)
  })

  it('statut « Terminé » dès que la clôture est datée, sinon « En cours »', () => {
    expect(statutSinistre(creerSinistre(saisie()))).toBe('En cours')
    expect(statutSinistre(creerSinistre(saisie({ dateCloture: '2026-12-15' })))).toBe('Terminé')
  })

  it('le statut se lit aussi sur une ligne partielle de la base (fiche 360)', () => {
    expect(statutSinistre({ dateCloture: '2026-12-15' })).toBe('Terminé')
    expect(statutSinistre({})).toBe('En cours')
  })
})

describe('sinistres — chronologie', () => {
  it('aucune anomalie pour des dates dans l’ordre', () => {
    expect(
      controlerChronologieSinistre(
        creerSinistre(saisie({ dateDeclaration: '2026-10-28', dateExpertise: '2026-11-10', dateRapport: '2026-11-20', dateCloture: '2026-12-15' })),
      ),
    ).toEqual([])
  })

  it('signale une déclaration avant la survenance et une clôture avant le rapport', () => {
    const anomalies = controlerChronologieSinistre(
      creerSinistre(saisie({ dateDeclaration: '2026-10-20', dateRapport: '2026-12-20', dateCloture: '2026-12-15' })),
    )
    expect(anomalies.map((a) => a.champ)).toEqual(['dateDeclaration', 'dateCloture'])
  })
})

describe('sinistres — indemnités', () => {
  it('total, réglé et reste à recevoir en centimes', () => {
    const sinistre = creerSinistre(
      saisie({ indemniteImmediateCentimes: 120_000, indemniteImmediateReglee: true, indemniteDiffereeCentimes: 45_000 }),
    )
    expect(indemnitesSinistre(sinistre)).toEqual({ totalCentimes: 165_000, regleCentimes: 120_000, resteCentimes: 45_000 })
  })
})

describe('sinistres — repères de délais (indicatifs)', () => {
  it('déclaration : 5 jours ouvrés depuis la connaissance ; prescription : 2 ans depuis l’événement', () => {
    expect(reperesDelaisSinistre(creerSinistre(saisie()))).toMatchObject({
      declarationAuPlusTard: '2026-11-03',
      delaiDeclarationJoursOuvres: 5,
      prescription: '2028-10-27',
      declarationTardive: false,
    })
  })

  it('vol : 2 jours ouvrés', () => {
    expect(reperesDelaisSinistre(creerSinistre(saisie({ type: 'Vol' })))).toMatchObject({
      declarationAuPlusTard: '2026-10-29',
      delaiDeclarationJoursOuvres: 2,
    })
  })

  it('les jours fériés ne comptent pas (11 novembre)', () => {
    expect(reperesDelaisSinistre(creerSinistre(saisie({ dateSurvenance: '2026-11-06' }))).declarationAuPlusTard).toBe('2026-11-16')
  })

  it('le délai du contrat remplace le minimum légal s’il est plus long, jamais s’il est plus court', () => {
    const sinistre = creerSinistre(saisie())
    expect(reperesDelaisSinistre(sinistre, { delaiContratJoursOuvres: 10 }).delaiDeclarationJoursOuvres).toBe(10)
    expect(reperesDelaisSinistre(sinistre, { delaiContratJoursOuvres: 3 }).delaiDeclarationJoursOuvres).toBe(5)
  })

  it('part de la connaissance du sinistre quand elle est postérieure à la survenance', () => {
    expect(
      reperesDelaisSinistre(creerSinistre(saisie({ dateConnaissance: '2026-11-02' }))).declarationAuPlusTard,
    ).toBe('2026-11-09')
  })

  it('signale une déclaration faite après le repère, avec les fondements et l’avertissement', () => {
    const reperes = reperesDelaisSinistre(creerSinistre(saisie({ dateDeclaration: '2026-11-05' })))
    expect(reperes.declarationTardive).toBe(true)
    expect(reperes.fondements).toEqual(['C. assur. art. L. 113-2', 'C. assur. art. L. 114-1'])
    expect(reperes.avertissement).toBe(
      "Déclarer dès la connaissance du sinistre. Déclaration au plus tard à la date retenue : délai du contrat s'il est saisi, sinon minimum légal (C. assur. art. L. 113-2, 4°), que le contrat peut seulement allonger. Prescription au plus tôt 24 mois après l'événement (art. L. 114-1) : une interruption peut la repousser (art. L. 114-2) ; le contrat ne peut pas en changer la durée (art. L. 114-3).",
    )
  })

  it('relecture : chaque date donne sa justification (départ, durée, texte, résultat)', () => {
    expect(reperesDelaisSinistre(creerSinistre(saisie()))).toMatchObject({
      justificationDeclaration:
        'Connaissance du 27/10/2026 + 5 jours ouvrés, comptés du lendemain hors samedis, dimanches et jours fériés (minimum légal, C. assur. L. 113-2, 4°) : au plus tard le 03/11/2026.',
      justificationPrescription: 'Survenance du 27/10/2026 + 24 mois (C. assur. L. 114-1) : au plus tôt le 27/10/2028.',
    })
    const sinistre = creerSinistre(saisie())
    expect(reperesDelaisSinistre(sinistre, { delaiContratJoursOuvres: 10 }).justificationDeclaration).toBe(
      'Connaissance du 27/10/2026 + 10 jours ouvrés, comptés du lendemain hors samedis, dimanches et jours fériés (délai du contrat ; C. assur. L. 113-2, 4°) : au plus tard le 10/11/2026.',
    )
    expect(reperesDelaisSinistre(sinistre, { delaiContratJoursOuvres: 3 }).justificationDeclaration).toContain(
      '(minimum légal, C. assur. L. 113-2, 4°, retenu au lieu des 3 jours ouvrés du contrat)',
    )
  })

  it('relecture : garantie impayés et catastrophe naturelle — le minimum de L. 113-2, 4° n’est pas sûr, raison donnée ; dommages-ouvrage : règle propre (J67, R52)', () => {
    const regimes = (type: SaisieSinistre['type']) => {
      const { declarationAConfirmer, prescriptionAConfirmer } = reperesDelaisSinistre(creerSinistre(saisie({ type })))
      return { declarationAConfirmer, prescriptionAConfirmer }
    }
    for (const type of TYPES_SINISTRE_IMPAYES)
      expect(regimes(type)).toEqual({
        declarationAConfirmer: 'assurance-crédit possible : seule la police fixe alors le délai (C. assur. L. 111-1)',
        prescriptionAConfirmer: "assurance-crédit possible : L. 114-1 ne s'applique alors pas, voir la police (C. assur. L. 111-1)",
      })
    // Empilement sur contentieux-sinistres : la règle propre attendue par la relecture est J67, R52 (aucun minimum, à
    // déclarer dès la connaissance) ; plus de repère à confirmer pour ce type.
    expect(regimes('Dommages Ouvrage')).toEqual({ declarationAConfirmer: null, prescriptionAConfirmer: null })
    expect(reperesDelaisSinistre(creerSinistre(saisie({ type: 'Dommages Ouvrage' }))).justificationDeclaration).toBe(
      "Connaissance du 27/10/2026, sans délai (clauses types, C. assur. annexe II à l'art. A. 243-1 ; J67, R52) : à déclarer dès la connaissance (C. assur. L. 113-2, 4°).",
    )
    expect(reperesDelaisSinistre(creerSinistre(saisie({ type: 'Dommages Ouvrage' })), { delaiContratJoursOuvres: 3 }).justificationDeclaration).toBe(
      'Connaissance du 27/10/2026 + 3 jours ouvrés, comptés du lendemain hors samedis, dimanches et jours fériés (délai du contrat ; C. assur. L. 113-2, 4°) : au plus tard le 30/10/2026.',
    )
    expect(regimes('Catastrophes naturelles')).toEqual({
      declarationAConfirmer: "catastrophe naturelle : délai compté de la publication de l'arrêté (C. assur. L. 125-2)",
      prescriptionAConfirmer: null,
    })
    for (const type of ['Dégât des eaux', 'Vol', 'Vandalisme', 'Tempête, Grêles, Neiges', 'Perte de Loyer'] as const)
      expect(regimes(type)).toEqual({ declarationAConfirmer: null, prescriptionAConfirmer: null })
  })

  it('J67, R49 : délais du code des assurances en paramètres, avec leur article', () => {
    expect(DELAIS_ASSURANCE_SINISTRE).toEqual({ declarationMinimumJoursOuvres: 5, declarationVolJoursOuvres: 2, prescriptionMois: 24 })
  })

  it('J67, R49 : minimum légal ou délai du contrat ; « Vandalisme » et « Bris de glace » signalés (un vol a pu y être rangé)', () => {
    expect(reperesDelaisSinistre(creerSinistre(saisie()))).toMatchObject({ minimumLegalJoursOuvres: 5, delaiDuContrat: false, volPossible: false })
    expect(reperesDelaisSinistre(creerSinistre(saisie({ type: 'Vol' })))).toMatchObject({ minimumLegalJoursOuvres: 2, volPossible: false })
    expect(reperesDelaisSinistre(creerSinistre(saisie()), { delaiContratJoursOuvres: 10 }).delaiDuContrat).toBe(true)
    // Relecture : un délai du contrat saisi égal au minimum légal est le délai du contrat ; plus court, il est sans effet.
    expect(reperesDelaisSinistre(creerSinistre(saisie()), { delaiContratJoursOuvres: 5 }).delaiDuContrat).toBe(true)
    expect(reperesDelaisSinistre(creerSinistre(saisie({ type: 'Vol' })), { delaiContratJoursOuvres: 2 }).delaiDuContrat).toBe(true)
    expect(reperesDelaisSinistre(creerSinistre(saisie()), { delaiContratJoursOuvres: 3 }).delaiDuContrat).toBe(false)
    for (const type of ['Vandalisme', 'Bris de glace'] as const)
      expect(reperesDelaisSinistre(creerSinistre(saisie({ type })))).toMatchObject({ minimumLegalJoursOuvres: 5, volPossible: true })
  })

  it('en-tête : échéances du suivi (J67, R49) ; L. 114-3 relu ; le contrat n’allonge que la déclaration', () => {
    const { texte } = enTeteDuModule('sinistres')
    expect(texte).not.toContain('ces dates ne sont jamais présentées comme des échéances certaines')
    expect(texte).toMatch(/J67, R49/)
    expect(texte).toMatch(/L\. 114-3 relu sur Légifrance le 17\/11\/2026/)
  })

  it('en-tête, puce J67, R50 : le rappel vit dans RAPPEL_DECLARATION_DES_CONNAISSANCE ; l’avertissement du suivi prend le texte de R49', () => {
    const { item } = enTeteDuModule('sinistres')
    const r50 = item('- J67, R50 :')
    expect(r50).not.toContain("Le message rappelle de déclarer dès la connaissance : le repère n'est que le minimum légal du délai prévu au contrat.")
    expect(r50).toMatch(/rappel de R50 : RAPPEL_DECLARATION_DES_CONNAISSANCE \(lu par declaration-sinistre\.ts\)/)
    expect(r50).toMatch(/l'avertissement de reperesDelaisSinistre prend le texte de J67, R49, qui garde ce rappel/)
  })

  it('J67, R50 : l’avertissement rappelle de déclarer dès la connaissance ; le repère est le minimum légal du délai prévu au contrat', () => {
    for (const type of ['Dégât des eaux', 'Vol'] as const) {
      const reperes = reperesDelaisSinistre(creerSinistre(saisie({ type })))
      // Empilement : texte de J67, R49, qui tranche la nature des dates (des échéances, plus des repères indicatifs) et
      // reprend le rappel de R50 (déclarer dès la connaissance ; minimum légal ou délai du contrat).
      expect(reperes.avertissement).toMatch(
        /^Déclarer dès la connaissance du sinistre\. Déclaration au plus tard à la date retenue : délai du contrat s'il est saisi, sinon minimum légal \(C\. assur\. art\. L\. 113-2, 4°\)/,
      )
      expect(reperes.desLaConnaissance).toBe(false)
    }
  })

  it('J67, R52 : dommages-ouvrage, pas de minimum de cinq jours ouvrés : repère au jour de la connaissance, sauf délai du contrat', () => {
    const dommagesOuvrage = creerSinistre(saisie({ type: 'Dommages Ouvrage', dateConnaissance: '2026-11-02', dateDeclaration: '2026-11-04' }))
    const reperes = reperesDelaisSinistre(dommagesOuvrage)
    expect(reperes).toMatchObject({
      delaiDeclarationJoursOuvres: 0,
      declarationAuPlusTard: '2026-11-02',
      desLaConnaissance: true,
      // Aucun délai à dépasser : la déclaration n'est jamais « tardive » au regard du repère.
      declarationTardive: false,
      prescription: '2028-10-27',
    })
    expect(reperes.fondements).toEqual(['C. assur. art. L. 113-2', 'C. assur. annexe II à l’art. A. 243-1', 'C. assur. art. L. 114-1'])
    expect(reperes.avertissement).toMatch(/^Dommages-ouvrage : déclarer dès la connaissance du sinistre \(C\. assur\. art\. L\. 113-2, 4°\) ; aucun délai dans les clauses types/)
    // Même prescription de deux ans que le droit commun (R52) : même phrase que celle de J67, R49.
    const phrasePrescription =
      "Prescription au plus tôt 24 mois après l'événement (art. L. 114-1) : une interruption peut la repousser (art. L. 114-2) ; le contrat ne peut pas en changer la durée (art. L. 114-3)."
    expect(reperes.avertissement.endsWith(` ${phrasePrescription}`)).toBe(true)
    expect(reperesDelaisSinistre(creerSinistre(saisie())).avertissement.endsWith(` ${phrasePrescription}`)).toBe(true)
    expect(reperes.avertissement).not.toContain('Vérifier le contrat et le dossier.')
    // La police fixe un délai : il s'applique, sans plancher de cinq jours.
    expect(reperesDelaisSinistre(dommagesOuvrage, { delaiContratJoursOuvres: 3 })).toMatchObject({
      delaiDeclarationJoursOuvres: 3,
      declarationAuPlusTard: '2026-11-05',
      desLaConnaissance: false,
      declarationTardive: false,
    })
  })
})
