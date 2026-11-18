import { describe, expect, it } from 'vitest'
import {
  CODES_PIECES_ART_11,
  PIECES_ART_11,
  controlerPiecesConvocation,
  type QuestionConvocation,
} from '@/lib/administrateur-judiciaire/domain/pieces-convocation-ag'
import { enTeteDuModule } from './en-tete-module'

/**
 * Pièces de la convocation (J67, R25) : D. 1967 art. 11, version du 25/12/2025 (I : 14 pièces pour la validité de la
 * décision ; II : 10 pièces pour l'information des copropriétaires) ; art. 9 : formulaire de vote joint à la convocation.
 */

const comptes: QuestionConvocation = {
  id: 'q-1',
  libelle: "Approbation des comptes de l'exercice",
  piecesAttendues: ['I-1', 'II-5'],
  piecesJointes: ['I-1', 'II-5'],
}

describe('référentiel des pièces de l’art. 11', () => {
  it('14 pièces pour la validité de la décision (I), 10 pour l’information (II), dans l’ordre du texte', () => {
    const parPartie = (partie: string) => CODES_PIECES_ART_11.filter((code) => PIECES_ART_11[code].partie === partie)
    expect(parPartie('validite')).toEqual(Array.from({ length: 14 }, (_, i) => `I-${i + 1}`))
    expect(parPartie('information')).toEqual(Array.from({ length: 10 }, (_, i) => `II-${i + 1}`))
    expect(PIECES_ART_11['I-1']).toMatchObject({ numero: 'I, 1°', cas: "lorsque l'assemblée est appelée à approuver les comptes" })
    expect(PIECES_ART_11['I-7'].cas).toMatch(/14-1, 18-1 A, 24, II, 25, 25-2-1, 26, 30, 35, 37 et 39/)
    expect(PIECES_ART_11['I-9'].piece).toMatch(/administrateur provisoire/)
    expect(PIECES_ART_11['II-3']).toMatchObject({ numero: 'II, 3°', cas: 'lorsque sa consultation est obligatoire' })
    expect(PIECES_ART_11['II-1'].cas).toBeNull()
  })
})

describe('contrôle des pièces de la convocation', () => {
  it('tout est joint, formulaire compris : rien à signaler', () => {
    expect(controlerPiecesConvocation({ questions: [comptes], formulaireVoteJoint: true })).toEqual([])
  })

  it('pièce du I manquante : alerte forte (la décision risque l’annulation) ; du II : simple avertissement', () => {
    const budget: QuestionConvocation = { id: 'q-2', libelle: 'Budget prévisionnel', piecesAttendues: ['I-2', 'II-1'], piecesJointes: [] }
    const anomalies = controlerPiecesConvocation({ questions: [comptes, budget], formulaireVoteJoint: true })
    expect(anomalies).toEqual([
      {
        code: 'piece_validite_manquante',
        gravite: 'alerte_forte',
        questionId: 'q-2',
        message:
          "Question « Budget prévisionnel » : pièce manquante (projet du budget, avec le comparatif du dernier budget prévisionnel voté) ; elle se notifie au plus tard avec l'ordre du jour pour la validité de la décision : la décision risque l'annulation.",
        fondement: 'D. 1967 art. 11, I, 2°',
      },
      {
        code: 'piece_information_manquante',
        gravite: 'avertissement',
        questionId: 'q-2',
        message:
          "Question « Budget prévisionnel » : pièce manquante (annexes au budget prévisionnel) ; elle se notifie au plus tard avec l'ordre du jour pour l'information des copropriétaires.",
        fondement: 'D. 1967 art. 11, II, 1°',
      },
    ])
  })

  it('formulaire de vote par correspondance absent : signalé (D. 1967 art. 9)', () => {
    expect(controlerPiecesConvocation({ questions: [comptes], formulaireVoteJoint: false })).toEqual([
      {
        code: 'formulaire_vote_absent',
        gravite: 'avertissement',
        questionId: null,
        message:
          'Formulaire de vote par correspondance non joint : il est joint à la convocation ; il doit être reçu au plus tard trois jours francs avant la réunion.',
        fondement: 'D. 1967 art. 9 et 9 bis',
      },
    ])
  })

  it('refuse un code inconnu, une question sans identifiant ou sans libellé, un identifiant en double', () => {
    const avec = (question: Partial<QuestionConvocation>) => () =>
      controlerPiecesConvocation({ questions: [{ ...comptes, ...question }], formulaireVoteJoint: true })
    expect(avec({ piecesAttendues: ['I-15' as never] })).toThrow(/pièce « I-15 » inconnue/)
    expect(avec({ piecesJointes: ['III-1' as never] })).toThrow(/pièce « III-1 » inconnue/)
    expect(avec({ id: ' ' })).toThrow(/identifiant/)
    expect(avec({ libelle: '' })).toThrow(/libellé/)
    expect(() => controlerPiecesConvocation({ questions: [comptes, comptes], formulaireVoteJoint: true })).toThrow(/« q-1 » en double/)
  })

  it('en-tête : art. 11 et 9 cités, J67, R25 ; rubriques du formulaire 🔴 (à lire par Hugo) ; écran et enregistrement hors du module', () => {
    const { texte } = enTeteDuModule('pieces-convocation-ag')
    expect(texte).toContain('J67, R25')
    expect(texte).toMatch(/D\. 1967 art\. 11, version du 25\/12\/2025/)
    expect(texte).toMatch(/🔴 Rubriques du formulaire/)
    expect(texte).toMatch(/écran : Frédéric/)
    expect(texte).toMatch(/enregistrement des pièces jointes : à brancher/)
  })
})
