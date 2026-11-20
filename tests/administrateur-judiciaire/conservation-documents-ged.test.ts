import { describe, expect, it } from 'vitest'
import {
  CONSERVATION_PIECES_JUSTIFICATIVES,
  MODELES_PIECES_JUSTIFICATIVES,
  creerRegleConservation,
  dureeConservationDuTexte,
  echeanceConservation,
  verifierReglesConservation,
} from '@/lib/administrateur-judiciaire/domain/conservation-documents-ged'
import type { DocumentGed } from '@/lib/administrateur-judiciaire/domain/pieces-obligatoires-ged'
import { TYPES_GENERIQUES_DOCUMENT } from '@/lib/administrateur-judiciaire/domain/referentiel-types-document'
import { codeTypeDocument, codeTypesAConfirmer, creerReferenceTypeDocument, memeLibelle } from '@/lib/administrateur-judiciaire/domain/typologie-documents'
import { enTeteDuModule } from './en-tete-module'

/**
 * Durées de conservation de la GED (point 64 du bilan 2). Seule durée trouvée dans les textes relus : 10 ans pour les
 * pièces justificatives comptables (D. 2005-240 art. 6), point de départ non fixé. Aucune durée par défaut : réglage du
 * cabinet (comme D-BANQUE).
 */

const doc = (categorie: string, type: string, date = '2026-03-31'): DocumentGed => ({
  id: 'd1',
  entiteType: 'copropriete',
  entiteId: 'c1',
  type: codeTypeDocument(creerReferenceTypeDocument(categorie, type), 'copropriete'),
  date,
})

const FACTURE = doc('Fournisseur', 'Facture/avoir fournisseur')
const PV = doc('Base', "Procès-verbal d'assemblée")
const CARNET = doc('Base', "Carnet d'entretien")

describe('durée fixée par le texte', () => {
  it('pièces justificatives comptables : 10 ans, point de départ non fixé, sous réserve', () => {
    expect(CONSERVATION_PIECES_JUSTIFICATIVES).toEqual({
      dureeMois: 120,
      fondement: 'D. 2005-240 art. 6, al. 1',
      reserve: 'sauf dispositions expresses contraires',
      pointDepart: null,
    })
  })

  it('types GED retenus comme pièces justificatives : tous dans le référentiel, types génériques compris', () => {
    for (const modele of MODELES_PIECES_JUSTIFICATIVES)
      if (modele.categorie) expect(creerReferenceTypeDocument(modele.categorie, modele.type).controle).toBe('referentiel')
      else expect(TYPES_GENERIQUES_DOCUMENT.some((t) => memeLibelle(t, modele.type)), modele.type).toBe(true)
  })

  it('facture : durée du texte ; PV, carnet : aucune durée dans les textes relus', () => {
    expect(dureeConservationDuTexte({ categorie: 'Fournisseur', type: 'Facture/avoir fournisseur' })).toBe(CONSERVATION_PIECES_JUSTIFICATIVES)
    expect(dureeConservationDuTexte({ categorie: 'Base', type: 'Relevé bancaire' })).toBe(CONSERVATION_PIECES_JUSTIFICATIVES)
    expect(dureeConservationDuTexte({ categorie: 'Base', type: "Procès-verbal d'assemblée" })).toBeNull()
    expect(dureeConservationDuTexte({ categorie: 'Base', type: "Carnet d'entretien" })).toBeNull()
  })

  it('J67, R118 : types qui fondent une écriture par nature ajoutés ; devis, contrats et courriers non', () => {
    const ajoutes = [
      ['Copropriétaire', 'Appel de fonds'],
      ['Copropriétaire', 'Répartition de charges'],
      ['Copropriétaire', 'Relevé individuel eau froide'],
      ['Interne', 'Rejet de virement'],
      ['Interne', 'Notes internes (modification comptable, créance irrécouvrable, jugement, remboursement copropriétaire)'],
      ['Base', 'Bulletin de salaire'],
      ['Base', 'Bordereau URSSAF'],
      ['Base', 'Bordereau retraite'],
      ['Base', 'Bordereau prévoyance'],
      ['Base', 'Bordereau mutuelle'],
      ['Base', 'Bordereau DGFIP'],
      ["Gardien/Employé d'immeuble", 'Salaire et charges sociales'],
      ["Gardien/Employé d'immeuble", 'Déclaration DSN'],
      ['Tribunal', 'Ordonnance de taxe'],
    ] as const
    for (const [categorie, type] of ajoutes) expect(dureeConservationDuTexte({ categorie, type }), type).toBe(CONSERVATION_PIECES_JUSTIFICATIVES)
    expect(MODELES_PIECES_JUSTIFICATIVES).toHaveLength(7 + ajoutes.length)
    for (const ref of [
      { categorie: 'Fournisseur', type: 'Devis fournisseur' },
      { categorie: 'Fournisseur', type: 'Contrat, avenant entreprise' },
      { categorie: 'Copropriétaire', type: 'Courrier copropriétaire' },
    ] as const)
      expect(dureeConservationDuTexte(ref)).toBeNull()
  })

  it('J67, R118 : tout document rattaché à un traitement comme sa pièce est une pièce justificative, quel que soit son type', () => {
    expect(dureeConservationDuTexte({ categorie: 'Base', type: "Procès-verbal d'assemblée" }, { rattacheAUnTraitement: true })).toBe(CONSERVATION_PIECES_JUSTIFICATIVES)
    expect(echeanceConservation(PV, [], { rattacheAUnTraitement: true })).toEqual({ statut: 'non_reglee', texte: CONSERVATION_PIECES_JUSTIFICATIVES })
    expect(echeanceConservation({ ...PV, type: 'Pièce libre' }, [], { rattacheAUnTraitement: true })).toEqual({
      statut: 'non_classe',
      texte: CONSERVATION_PIECES_JUSTIFICATIVES,
    })
    const devis = { categorie: 'Fournisseur', type: 'Devis fournisseur' } as const
    expect(echeanceConservation({ ...PV, type: codeTypesAConfirmer([devis], 'copropriete') }, [], { rattacheAUnTraitement: true })).toEqual({
      statut: 'a_confirmer',
      candidats: [{ ref: devis, texte: CONSERVATION_PIECES_JUSTIFICATIVES }],
    })
  })

  it('en-tête : la question « quels types sont des pièces justificatives » est tranchée (J67, R118) ; les autres restent ouvertes', () => {
    const { texte } = enTeteDuModule('conservation-documents-ged')
    expect(texte).not.toContain('« Quels types GED sont des pièces justificatives comptables au sens du D. 2005-240 art. 6 ? »')
    expect(texte).toMatch(/Décision J67, R118 de Hugo .* : tout document lié à une écriture comptable \(un traitement\) comme sa pièce/)
    expect(texte).toMatch(/🔴 Non établi.*court-il, pour le cabinet.*durée interne pour les autres archives/)
  })
})

describe('règles du cabinet', () => {
  it('saisie contrôlée : libellés canoniques, cible et durée obligatoires', () => {
    expect(creerRegleConservation({ categorie: 'base', type: 'proces-verbal d’assemblee', dureeMois: 360, pointDepart: 'date_document' })).toEqual({
      cible: { categorie: 'Base', type: "Procès-verbal d'assemblée" },
      dureeMois: 360,
      pointDepart: 'date_document',
      fondement: null,
    })
    expect(creerRegleConservation({ categorie: 'Tribunal', dureeMois: 120, pointDepart: 'fin_mandat', fondement: 'Réglage du cabinet' }).cible).toEqual({
      categorie: 'Tribunal',
      type: null,
    })
    expect(creerRegleConservation({ type: ' Facture/avoir fournisseur ', dureeMois: 120, pointDepart: 'cloture_exercice' }).cible).toEqual({
      categorie: null,
      type: 'Facture/avoir fournisseur',
    })
    expect(() => creerRegleConservation({ dureeMois: 12, pointDepart: 'date_document' })).toThrow(/catégorie ou un type/)
    expect(() => creerRegleConservation({ categorie: 'Base', dureeMois: 0, pointDepart: 'date_document' })).toThrow(/durée/i)
    expect(() => creerRegleConservation({ categorie: 'Base', dureeMois: 1.5, pointDepart: 'date_document' })).toThrow(/durée/i)
    expect(() => creerRegleConservation({ categorie: 'Notaire', dureeMois: 12, pointDepart: 'date_document' })).toThrow(/catégorie/i)
  })

  it('règle visant un type seul : libellé canonique (générique ou type propre relevé), sinon la catégorie est exigée', () => {
    expect(creerRegleConservation({ type: '  facture/AVOIR fournisseur ', dureeMois: 120, pointDepart: 'date_document' }).cible).toEqual({
      categorie: null,
      type: 'Facture/avoir fournisseur',
    })
    expect(creerRegleConservation({ type: 'releve bancaire', dureeMois: 120, pointDepart: 'date_document' }).cible).toEqual({
      categorie: null,
      type: 'Relevé bancaire',
    })
    expect(() => creerRegleConservation({ type: 'Factrue fournisseur', dureeMois: 120, pointDepart: 'date_document' })).toThrow(/catégorie/)
    expect(creerRegleConservation({ categorie: 'Fournisseur', type: 'Factrue fournisseur', dureeMois: 120, pointDepart: 'date_document' }).cible).toEqual({
      categorie: 'Fournisseur',
      type: 'Factrue fournisseur',
    })
  })

  it('jeu de règles : deux règles de même cible refusées', () => {
    const a = creerRegleConservation({ categorie: 'Base', dureeMois: 36, pointDepart: 'date_document' })
    const b = creerRegleConservation({ categorie: 'base', dureeMois: 120, pointDepart: 'date_document' })
    const c = creerRegleConservation({ type: 'Relevé bancaire', dureeMois: 24, pointDepart: 'date_document' })
    const d = creerRegleConservation({ type: 'releve bancaire', dureeMois: 120, pointDepart: 'date_document' })
    expect(() => verifierReglesConservation([a, c])).not.toThrow()
    expect(() => verifierReglesConservation([a, b])).toThrow(/même cible/)
    expect(() => verifierReglesConservation([c, d])).toThrow(/même cible/)
  })
})

describe('échéance de conservation', () => {
  const parType = creerRegleConservation({ type: 'Facture/avoir fournisseur', dureeMois: 120, pointDepart: 'date_document' })
  const base = creerRegleConservation({ categorie: 'Base', dureeMois: 60, pointDepart: 'date_document' })
  const pv = creerRegleConservation({ categorie: 'Base', type: "Procès-verbal d'assemblée", dureeMois: 360, pointDepart: 'date_document' })

  it('sans règle du cabinet : non réglée, même quand le texte fixe une durée (point de départ 🔴)', () => {
    expect(echeanceConservation(FACTURE, [])).toEqual({ statut: 'non_reglee', texte: CONSERVATION_PIECES_JUSTIFICATIVES })
    expect(echeanceConservation(PV, [parType])).toEqual({ statut: 'non_reglee', texte: null })
  })

  it('réglée par type, à partir de la date du document', () => {
    expect(echeanceConservation(FACTURE, [base, parType])).toEqual({
      statut: 'reglee',
      dateFin: '2036-03-31',
      regle: parType,
      texte: CONSERVATION_PIECES_JUSTIFICATIVES,
      inferieureAuTexte: false,
    })
  })

  it('la règle par type l’emporte sur la règle par catégorie', () => {
    expect(echeanceConservation(PV, [base, pv])).toMatchObject({ statut: 'reglee', regle: pv, dateFin: '2056-03-31' })
    expect(echeanceConservation(CARNET, [base, pv])).toMatchObject({ statut: 'reglee', regle: base, dateFin: '2031-03-31' })
  })

  it('deux règles de même précision et d’effets différents : conflit signalé, quel que soit l’ordre', () => {
    const releve = doc('Base', 'Relevé bancaire', '2024-05-15')
    const courte = creerRegleConservation({ categorie: 'Base', dureeMois: 36, pointDepart: 'date_document' })
    const longue = creerRegleConservation({ categorie: 'base', dureeMois: 120, pointDepart: 'date_document' })
    for (const regles of [[courte, longue], [longue, courte]]) {
      const echeance = echeanceConservation(releve, regles)
      expect(echeance.statut).toBe('regles_en_conflit')
      if (echeance.statut === 'regles_en_conflit') expect(echeance.regles.map((r) => r.dureeMois).sort((x, y) => x - y)).toEqual([36, 120])
    }
    const parType = [
      creerRegleConservation({ type: 'Relevé bancaire', dureeMois: 24, pointDepart: 'date_document' }),
      creerRegleConservation({ type: 'releve bancaire', dureeMois: 120, pointDepart: 'date_document' }),
    ]
    expect(echeanceConservation(releve, parType)).toMatchObject({ statut: 'regles_en_conflit', texte: CONSERVATION_PIECES_JUSTIFICATIVES })
    expect(echeanceConservation(releve, [...parType].reverse())).toMatchObject({ statut: 'regles_en_conflit' })
    const memeEffet = creerRegleConservation({ categorie: 'Base', dureeMois: 36, pointDepart: 'date_document', fondement: 'Réglage' })
    expect(echeanceConservation(releve, [courte, memeEffet])).toMatchObject({ statut: 'reglee', dateFin: '2027-05-15' })
  })

  it('durée du cabinet plus courte que le texte : signalée', () => {
    const courte = creerRegleConservation({ type: 'Facture/avoir fournisseur', dureeMois: 60, pointDepart: 'date_document' })
    expect(echeanceConservation(FACTURE, [courte])).toMatchObject({ statut: 'reglee', inferieureAuTexte: true })
  })

  it('fin de mandat et clôture d’exercice : date fournie par l’appelant, sinon point de départ absent', () => {
    const finMandat = creerRegleConservation({ categorie: 'Base', dureeMois: 120, pointDepart: 'fin_mandat' })
    expect(echeanceConservation(PV, [finMandat])).toEqual({ statut: 'point_depart_absent', regle: finMandat, texte: null })
    expect(echeanceConservation(PV, [finMandat], { finMandat: '2027-02-28' })).toMatchObject({ statut: 'reglee', dateFin: '2037-02-28' })
    const cloture = creerRegleConservation({ type: 'Facture/avoir fournisseur', dureeMois: 120, pointDepart: 'cloture_exercice' })
    expect(echeanceConservation(FACTURE, [cloture], { clotureExercice: '2026-12-31' })).toMatchObject({ dateFin: '2036-12-31' })
  })

  it('document sans type GED (libellé libre, journal de reprise) : non classé', () => {
    expect(echeanceConservation({ ...FACTURE, type: 'Facture' }, [parType])).toEqual({ statut: 'non_classe', texte: null })
    expect(echeanceConservation({ ...FACTURE, entiteType: 'reprise', type: 'archives' }, [parType])).toEqual({ statut: 'non_classe', texte: null })
  })

  it('document « à confirmer » (suggestion d’après le texte) : à confirmer, distinct de non classé ; durée du texte de chaque candidat rappelée, aucune règle appliquée', () => {
    const facture = { categorie: 'Fournisseur', type: 'Facture/avoir fournisseur' } as const
    const devis = { categorie: 'Fournisseur', type: 'Devis fournisseur' } as const
    const aConfirmer = { ...FACTURE, type: codeTypesAConfirmer([facture, devis], 'copropriete') }
    expect(echeanceConservation(aConfirmer, [parType])).toEqual({
      statut: 'a_confirmer',
      candidats: [
        { ref: facture, texte: CONSERVATION_PIECES_JUSTIFICATIVES },
        { ref: devis, texte: null },
      ],
    })
  })

  it('dates invalides : erreur explicite', () => {
    expect(() => echeanceConservation({ ...FACTURE, date: '31/03/2026' }, [parType])).toThrow(/31\/03\/2026/)
    expect(() => echeanceConservation(PV, [], { finMandat: '2027-13-01' })).toThrow(/2027-13-01/)
  })
})
