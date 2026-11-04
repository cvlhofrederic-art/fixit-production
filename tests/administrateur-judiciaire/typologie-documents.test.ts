import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { codeGedDuClassement, confirmerClassement, suggererClassement } from '@/lib/administrateur-judiciaire/domain/classement-pieces-ged'
import { classerDocument } from '@/lib/administrateur-judiciaire/domain/import-documents-mandat'
import { NATURE_VENTE_AMIABLE, piecesMutationSyndic } from '@/lib/administrateur-judiciaire/domain/pieces-mutation-ged'
import { controlerPieces } from '@/lib/administrateur-judiciaire/domain/pieces-obligatoires-ged'
import {
  CATEGORIES_DOCUMENT,
  GROUPES_ASSOCIATION,
  TYPES_DOCUMENT_PAR_CATEGORIE,
  TYPES_GENERIQUES_DOCUMENT,
} from '@/lib/administrateur-judiciaire/domain/referentiel-types-document'
import {
  CODE_A_CONFIRMER_PREFIXE,
  CODE_GED_PREFIXE,
  candidatsDuDocument,
  categorieDuTypeEntreprise,
  codeTypeDocument,
  codeTypesAConfirmer,
  correspondAuModele,
  correspondanceTypeJudiciaire,
  creerReferenceTypeDocument,
  dossierDuLien,
  familleDiagnosticDuType,
  groupeAssociation,
  liensDuTypeDocument,
  lireTypeDocumentLocal,
  referenceDuDocument,
  referencesDuLibelle,
  typesDeLaCategorie,
} from '@/lib/administrateur-judiciaire/domain/typologie-documents'
import { TYPE_DOCUMENT_JUDICIAIRE, TYPE_ENTREPRISE } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * GED, typologie des documents (point 64 du bilan 2). Gestéam : tranche 22 § 6 (42 catégories, 7 types génériques,
 * types propres de Base, Interne et des catégories judiciaires), tranche 43 § 19 (types propres de Copropriétaire,
 * Étude notariale, Mairie, Gardien…), tranche 40 (référentiel « Association », 8 groupes numérotés).
 */

describe('référentiel à deux niveaux (tranche 22 § 6, tranche 43 § 19)', () => {
  it('42 catégories, 7 types génériques, chaque catégorie décrite', () => {
    expect(CATEGORIES_DOCUMENT).toHaveLength(42)
    expect(new Set(CATEGORIES_DOCUMENT).size).toBe(42)
    expect(TYPES_GENERIQUES_DOCUMENT).toHaveLength(7)
    expect(Object.keys(TYPES_DOCUMENT_PAR_CATEGORIE).sort()).toEqual([...CATEGORIES_DOCUMENT].sort())
  })

  it('relevé : 14 catégories relevées, 4 à génériques seuls, 24 non relevées (rien complété de mémoire)', () => {
    const parReleve = (releve: string) => CATEGORIES_DOCUMENT.filter((c) => TYPES_DOCUMENT_PAR_CATEGORIE[c].releve === releve)
    expect(parReleve('complet').length + parReleve('partiel').length).toBe(14)
    expect(parReleve('partiel')).toEqual(['Copropriétaire'])
    expect(parReleve('generiques_seuls').sort()).toEqual(['Mandataire judiciaire', 'Syndicat', 'Tuteur', 'Établissement bancaire'].sort())
    expect(parReleve('non_releve')).toHaveLength(24)
    for (const c of parReleve('non_releve')) expect(TYPES_DOCUMENT_PAR_CATEGORIE[c].typesPropres).toEqual([])
    for (const c of parReleve('generiques_seuls')) expect(TYPES_DOCUMENT_PAR_CATEGORIE[c].typesPropres).toEqual([])
  })

  it('effectifs relevés : Base 147 ± 1, Tribunal 13, Copropriétaire 28 libellés sur 29 annoncés, Étude notariale 8', () => {
    const base = TYPES_DOCUMENT_PAR_CATEGORIE.Base.typesPropres.length
    expect(base).toBeGreaterThanOrEqual(146)
    expect(base).toBeLessThanOrEqual(148)
    expect(TYPES_DOCUMENT_PAR_CATEGORIE.Tribunal.typesPropres).toHaveLength(13)
    expect(TYPES_DOCUMENT_PAR_CATEGORIE['Huissier de justice'].typesPropres).toHaveLength(5)
    expect(TYPES_DOCUMENT_PAR_CATEGORIE["Cabinet d'avocat"].typesPropres).toHaveLength(9)
    expect(TYPES_DOCUMENT_PAR_CATEGORIE.Interne.typesPropres).toHaveLength(14)
    expect(TYPES_DOCUMENT_PAR_CATEGORIE.Copropriétaire.typesPropres).toHaveLength(28)
    expect(TYPES_DOCUMENT_PAR_CATEGORIE.Copropriétaire.typesAnnonces).toBe(29)
    expect(TYPES_DOCUMENT_PAR_CATEGORIE['Étude notariale'].typesPropres).toHaveLength(8)
    expect(TYPES_DOCUMENT_PAR_CATEGORIE.Mairie.typesPropres).toEqual(['Arrêté de péril', 'Injonction de travaux'])
    expect(TYPES_DOCUMENT_PAR_CATEGORIE["Gardien/Employé d'immeuble"].typesPropres).toHaveLength(9)
  })

  it('aucun libellé ne contient le séparateur « | » du code GED, aucun doublon dans une catégorie', () => {
    for (const c of CATEGORIES_DOCUMENT) {
      const types = typesDeLaCategorie(c)
      expect(new Set(types).size).toBe(types.length)
      expect([c, ...types].some((l) => l.includes('|'))).toBe(false)
    }
  })

  it('chaque libellé relevé se retrouve lui-même (aucune collision de la comparaison normalisée)', () => {
    for (const c of CATEGORIES_DOCUMENT)
      for (const type of typesDeLaCategorie(c)) expect(creerReferenceTypeDocument(c, type)).toEqual({ categorie: c, type, controle: 'referentiel' })
  })

  it('typesDeLaCategorie : génériques puis types propres', () => {
    expect(typesDeLaCategorie('Mairie')).toEqual([...TYPES_GENERIQUES_DOCUMENT, 'Arrêté de péril', 'Injonction de travaux'])
    expect(typesDeLaCategorie('Fournisseur')).toEqual([...TYPES_GENERIQUES_DOCUMENT])
  })
})

describe('référence contrôlée { catégorie, type }', () => {
  it('rend le libellé canonique, casse et accents tolérés', () => {
    expect(creerReferenceTypeDocument('etude notariale', 'avis de mutation ART. 20')).toEqual({
      categorie: 'Étude notariale',
      type: 'Avis de mutation art. 20',
      controle: 'referentiel',
    })
    expect(creerReferenceTypeDocument('Tribunal', 'requete au tribunal').type).toBe('Requête au tribunal')
  })

  it('refuse une catégorie inconnue, un type vide, un type absent d’une catégorie relevée', () => {
    expect(() => creerReferenceTypeDocument('Notaire', 'État daté')).toThrow(/catégorie/i)
    expect(() => creerReferenceTypeDocument('Mairie', '  ')).toThrow(/type/i)
    expect(() => creerReferenceTypeDocument('Mairie', 'Permis de construire')).toThrow(/Mairie/)
    expect(() => creerReferenceTypeDocument('Syndicat', 'État daté')).toThrow(/Syndicat/)
  })

  it('catégorie non relevée : type accepté et marqué ; un type générique y reste contrôlé', () => {
    expect(creerReferenceTypeDocument('Géomètre', 'Plan de bornage ')).toEqual({
      categorie: 'Géomètre',
      type: 'Plan de bornage',
      controle: 'categorie_non_relevee',
    })
    expect(creerReferenceTypeDocument('Fournisseur', 'facture/avoir FOURNISSEUR')).toEqual({
      categorie: 'Fournisseur',
      type: 'Facture/avoir fournisseur',
      controle: 'referentiel',
    })
  })

  it('Copropriétaire (29 annoncés, 28 relevés) : un type hors relevé est accepté et marqué', () => {
    expect(creerReferenceTypeDocument('Copropriétaire', 'Mise en demeure').controle).toBe('referentiel')
    expect(creerReferenceTypeDocument('Copropriétaire', 'Type manquant').controle).toBe('type_hors_releve')
  })

  it('modèle de type : catégorie null = toute catégorie (types génériques)', () => {
    const facture = { categorie: 'Fournisseur', type: 'Facture/avoir fournisseur' } as const
    expect(correspondAuModele(facture, { categorie: null, type: 'facture/avoir fournisseur' })).toBe(true)
    expect(correspondAuModele(facture, { categorie: 'Base', type: 'Facture/avoir fournisseur' })).toBe(false)
  })

  it('referencesDuLibelle cherche parmi les types propres de toutes les catégories', () => {
    expect(referencesDuLibelle('Jugement').map((r) => r.categorie).sort()).toEqual(["Cabinet d'avocat", 'Tribunal'])
    expect(referencesDuLibelle('Inexistant')).toEqual([])
  })
})

describe('correspondances avec les référentiels existants', () => {
  it('les 30 types d’entreprise trouvent chacun leur catégorie (casse et élisions différentes)', () => {
    const categories = TYPE_ENTREPRISE.map((t) => categorieDuTypeEntreprise(t))
    expect(new Set(categories).size).toBe(30)
    expect(categorieDuTypeEntreprise('Etude Notariale')).toBe('Étude notariale')
    expect(categorieDuTypeEntreprise('Caisse allocations familiales')).toBe("Caisse d'allocations familiales")
    expect(categorieDuTypeEntreprise('Centre des Impots')).toBe('Centre des impôts')
  })

  it('TYPE_DOCUMENT_JUDICIAIRE (tranche 18) : 19 libellés sur 20 retrouvés ; le PV de l’AJ reste sans catégorie', () => {
    const trouves = TYPE_DOCUMENT_JUDICIAIRE.filter((t) => correspondanceTypeJudiciaire(t) !== null)
    expect(trouves).toHaveLength(19)
    expect(correspondanceTypeJudiciaire("Procès-Verbal de prise de décisions par l'AJ")).toBeNull()
    expect(correspondanceTypeJudiciaire('Requete au Tribunal')).toEqual({ categorie: 'Tribunal', type: 'Requête au tribunal' })
    expect(correspondanceTypeJudiciaire('Commandement de Saisie')).toEqual({ categorie: "Cabinet d'avocat", type: 'Commandement de saisie' })
    expect(correspondanceTypeJudiciaire("Protocole d'accord de recouvrement")?.categorie).toBe('Copropriétaire')
    expect(correspondanceTypeJudiciaire('Ordonnance (autres)')).toEqual({ categorie: 'Base', type: 'Ordonnance (autres)' })
  })

  it('référentiel Association (tranche 40) : 8 groupes numérotés, recherche normalisée', () => {
    expect(GROUPES_ASSOCIATION.map((g) => g.numero)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(groupeAssociation('etat date')).toBe(2)
    expect(groupeAssociation('Amiante partie commune')).toBe(1)
    expect(groupeAssociation('R.C. décennale entreprise')).toBe(4)
    expect(groupeAssociation('Pièce comptable')).toBe(8)
    expect(groupeAssociation('Inconnu')).toBeNull()
  })

  it('familles de diagnostic de la fiche immeuble : correspondances évidentes seulement', () => {
    expect(familleDiagnosticDuType({ categorie: 'Base', type: 'Diagnostic amiante partie commune' })).toBe('amiante_pc')
    expect(familleDiagnosticDuType({ categorie: 'Base', type: 'Diagnostic plomb (CREP)' })).toBe('plomb')
    expect(familleDiagnosticDuType({ categorie: 'Base', type: "Diagnostic plomb dans l'eau" })).toBe('plomb_eau')
    expect(familleDiagnosticDuType({ categorie: 'Base', type: 'Diagnostic technique global' })).toBeNull()
    expect(familleDiagnosticDuType({ categorie: 'Tribunal', type: 'Jugement' })).toBeNull()
  })
})

describe('liens métier (tranche 43 § 19)', () => {
  it('mutation, recouvrement, obligations de l’immeuble, employeur, sinistre', () => {
    expect(liensDuTypeDocument({ categorie: 'Étude notariale', type: 'Certificat article 20-2' })).toEqual(['mutation'])
    expect(liensDuTypeDocument({ categorie: 'Copropriétaire', type: 'État daté' })).toEqual(['mutation'])
    expect(liensDuTypeDocument({ categorie: 'Copropriétaire', type: "Protocole d'apurement signé" })).toEqual(['recouvrement'])
    expect(liensDuTypeDocument({ categorie: 'Mairie', type: 'Arrêté de péril' })).toEqual(['obligation_immeuble'])
    expect(liensDuTypeDocument({ categorie: "Gardien/Employé d'immeuble", type: 'Déclaration DSN' })).toEqual(['employeur'])
    expect(liensDuTypeDocument({ categorie: "Expert d'assurance", type: 'État des pertes' })).toEqual(['sinistre'])
    expect(liensDuTypeDocument({ categorie: 'Base', type: 'Divers' })).toEqual([])
  })

  it('dossier (référentiel DOSSIER) du lien', () => {
    expect(dossierDuLien('mutation')).toBe('Mutation')
    expect(dossierDuLien('recouvrement')).toBe('Contentieux')
    expect(dossierDuLien('sinistre')).toBe('Sinistre')
    expect(dossierDuLien('obligation_immeuble')).toBeNull()
    expect(dossierDuLien('employeur')).toBeNull()
  })
})

describe('code dans DocumentLocal.type (schéma inchangé)', () => {
  const ref = { categorie: 'Étude notariale', type: 'Avis de mutation art. 20' } as const

  it('aller-retour du code GED', () => {
    const code = codeTypeDocument(ref, 'copropriete')
    expect(code).toBe(`${CODE_GED_PREFIXE}Étude notariale|Avis de mutation art. 20`)
    expect(lireTypeDocumentLocal({ entiteType: 'copropriete', type: code })).toEqual({ nature: 'ged', ref })
  })

  it('jamais de code GED sous « reprise » (le journal de reprise compte chaque document)', () => {
    expect(() => codeTypeDocument(ref, 'reprise')).toThrow(/reprise/)
    expect(lireTypeDocumentLocal({ entiteType: 'reprise', type: `${CODE_GED_PREFIXE}Base|Divers` })).toMatchObject({ nature: 'journal_reprise' })
  })

  it('le code est toujours canonique ; un type hors référentiel d’une catégorie relevée est refusé', () => {
    expect(codeTypeDocument({ categorie: 'Mairie', type: 'arrete de PERIL' }, 'copropriete')).toBe(`${CODE_GED_PREFIXE}Mairie|Arrêté de péril`)
    expect(() => codeTypeDocument({ categorie: 'Mairie', type: 'Permis de construire' }, 'copropriete')).toThrow(/Mairie/)
    expect(lireTypeDocumentLocal({ entiteType: 'copropriete', type: `${CODE_GED_PREFIXE}Mairie|Permis de construire` })).toMatchObject({ nature: 'libre' })
    expect(lireTypeDocumentLocal({ entiteType: 'copropriete', type: `${CODE_GED_PREFIXE}Mairie` })).toMatchObject({ nature: 'libre' })
    expect(referenceDuDocument({ entiteType: 'mandat', type: 'ordonnance' })).toEqual({ categorie: 'Tribunal', type: 'Ordonnance de désignation' })
    expect(referenceDuDocument({ entiteType: 'reprise', type: 'carnet' })).toBeNull()
  })

  it('valeurs héritées : ordonnance source d’un mandat, journal de reprise, libellé libre', () => {
    expect(lireTypeDocumentLocal({ entiteType: 'mandat', type: 'ordonnance' })).toEqual({
      nature: 'ordonnance_source_mandat',
      ref: { categorie: 'Tribunal', type: 'Ordonnance de désignation' },
    })
    expect(lireTypeDocumentLocal({ entiteType: 'reprise', type: 'registre_pv' })).toEqual({ nature: 'journal_reprise', cle: 'registre_pv', retrait: false })
    expect(lireTypeDocumentLocal({ entiteType: 'reprise', type: 'retrait:carnet' })).toEqual({ nature: 'journal_reprise', cle: 'carnet', retrait: true })
    expect(lireTypeDocumentLocal({ entiteType: 'copropriete', type: 'Compte rendu' })).toEqual({ nature: 'libre', libelle: 'Compte rendu' })
    expect(lireTypeDocumentLocal({ entiteType: 'copropriete', type: 'ged:Notaire|État daté' })).toEqual({
      nature: 'libre',
      libelle: 'ged:Notaire|État daté',
    })
  })

  it('code « à confirmer » : aller-retour des candidats, sans aucune référence GED', () => {
    const candidats = [
      { categorie: 'Copropriétaire', type: 'État daté' },
      { categorie: 'Étude notariale', type: 'Demande pré-état daté / état daté' },
    ] as const
    const code = codeTypesAConfirmer(candidats, 'mutation')
    expect(code).toBe(`${CODE_A_CONFIRMER_PREFIXE}Copropriétaire|État daté;Étude notariale|Demande pré-état daté / état daté`)
    const document = { entiteType: 'mutation', type: code }
    expect(lireTypeDocumentLocal(document)).toEqual({ nature: 'a_confirmer', candidats })
    expect(candidatsDuDocument(document)).toEqual(candidats)
    expect(referenceDuDocument(document)).toBeNull()
    expect(candidatsDuDocument({ entiteType: 'mutation', type: codeTypeDocument(candidats[0], 'mutation') })).toEqual([])
  })

  it('code « à confirmer » : mêmes refus que le code GED, au moins un candidat ; un candidat illisible rend un libellé libre', () => {
    expect(() => codeTypesAConfirmer([ref], 'reprise')).toThrow(/reprise/)
    expect(() => codeTypesAConfirmer([], 'copropriete')).toThrow(/candidat/)
    expect(() => codeTypesAConfirmer([{ categorie: 'Mairie', type: 'Permis de construire' }], 'copropriete')).toThrow(/Mairie/)
    expect(() => codeTypesAConfirmer([{ categorie: 'Géomètre', type: 'Plan ; annexe' }], 'copropriete')).toThrow(/;/)
    const illisible = `${CODE_A_CONFIRMER_PREFIXE}Base|Divers;Mairie|Permis de construire`
    expect(lireTypeDocumentLocal({ entiteType: 'copropriete', type: illisible })).toEqual({ nature: 'libre', libelle: illisible })
  })
})


const REGLEMENT = `REGLEMENT DE COPROPRIETE ET ETAT DESCRIPTIF DE DIVISION
Résidence Les Platanes
Lot n° 1 : un appartement, et les 125/1000èmes des parties communes générales.`

const CADASTRE = `RELEVE DE PROPRIETE
Commune : 37261 TOURS
Section AB n° 123 — contenance 4 a 50 ca`

const ORDONNANCE = `TRIBUNAL JUDICIAIRE DE TOURS
RG 26/01234
Ordonnance du 2 mars 2026 désignant un administrateur provisoire (art. 29-1) de la copropriété
PAR CES MOTIFS
Désignons Maître Jeanne Dupont en qualité d'administrateur provisoire de la copropriété.`

const candidatsDe = (texte: string) => suggererClassement(texte).candidats.map(({ ref }) => ref)
const SOUS_TYPES_TRIBUNAL = [
  'Ordonnance de désignation',
  'Ordonnance de prolongation de mission',
  'Ordonnance de fin de mission',
  'Ordonnance de taxe',
  "Ordonnance d'expropriation",
]

describe('classement des pièces importées (indépendant de classerDocument, inchangé) : une suggestion', () => {
  it('classerDocument rend toujours ses quatre résultats', () => {
    expect(classerDocument(REGLEMENT).type).toBe('reglement')
    expect(classerDocument(CADASTRE).type).toBe('cadastre')
    expect(classerDocument(ORDONNANCE).type).toBe('ordonnance')
    expect(classerDocument('Bonjour, voici le compte rendu.').type).toBe('inconnu')
  })

  it('les trois pièces du mandat : suggérées en tête, jamais confirmées par le texte', () => {
    expect(suggererClassement(ORDONNANCE)).toMatchObject({ source: 'texte', statut: 'suggestion' })
    expect(candidatsDe(ORDONNANCE)[0]).toEqual({ categorie: 'Tribunal', type: 'Ordonnance de désignation' })
    expect(candidatsDe(REGLEMENT)).toEqual([{ categorie: 'Étude notariale', type: 'Règlement de copropriété (règlement, modificatifs)' }])
    expect(candidatsDe(CADASTRE)).toEqual([{ categorie: 'Base', type: 'Cadastre — relevé de propriété' }])
  })

  it.each([
    ['ÉTAT DATÉ (article 5 du décret du 17 mars 1967) — première partie : sommes dues par le cédant', 'Copropriétaire', 'État daté'],
    ["AVIS DE MUTATION (article 20 de la loi du 10 juillet 1965). Maître X, notaire, vous informe de la vente du lot 12.", 'Étude notariale', 'Avis de mutation art. 20'],
    ['ARRÊTÉ DE MISE EN SÉCURITÉ — Le Maire de Tours, vu le péril constaté…', 'Mairie', 'Arrêté de péril'],
    ['Mairie de Tours\nInjonction de réaliser les travaux de ravalement de la façade', 'Mairie', 'Injonction de travaux'],
    ['MISE EN DEMEURE — charges de copropriété impayées : à défaut de règlement sous huit jours…', 'Copropriétaire', 'Mise en demeure'],
    ["PROCÈS-VERBAL DE L'ASSEMBLÉE GÉNÉRALE du 12 juin. Résolution n° 3 : adoptée à la majorité des voix.", 'Base', "Procès-verbal d'assemblée"],
    ["CONVOCATION à l'assemblée générale. Ordre du jour : 1. Approbation des comptes", 'Base', "Convocation d'assemblée"],
    ['FACTURE n° 2026-14 — Total HT 1 000,00 € — TVA 10 % — Net à payer 1 100,00 €', 'Fournisseur', 'Facture/avoir fournisseur'],
    ['DEVIS n° 88 — Total HT 2 000,00 € — TVA 10 % — Bon pour accord', 'Fournisseur', 'Devis fournisseur'],
  ])('%s : le type en tête de la suggestion', (texte, categorie, type) => {
    expect(suggererClassement(texte)).toMatchObject({ source: 'texte', statut: 'suggestion' })
    expect(candidatsDe(texte)[0]).toEqual({ categorie, type })
  })

  it('moins de deux indices, ou aucun mot clé : non classé', () => {
    expect(suggererClassement('Bonjour, voici le compte rendu de la réunion.')).toEqual({ source: 'texte', statut: 'non_classe', candidats: [] })
    expect(suggererClassement('Montant HT et TVA').statut).toBe('non_classe')
    expect(suggererClassement('Facture').statut).toBe('non_classe')
  })

  it('un procès-verbal qui cite le règlement de copropriété : le procès-verbal d’abord, le règlement ensuite', () => {
    const pv = `PROCÈS-VERBAL DE L'ASSEMBLÉE GÉNÉRALE. Résolution n° 4 : modification du règlement de copropriété,
adoptée à la majorité des voix ; tantièmes des parties communes.`
    expect(candidatsDe(pv)).toEqual([
      { categorie: 'Base', type: "Procès-verbal d'assemblée" },
      { categorie: 'Étude notariale', type: 'Règlement de copropriété (règlement, modificatifs)' },
    ])
  })
})

describe('classement des ordonnances : le cycle judiciaire de la catégorie Tribunal (tranche 22 § 6.2), en sous-types candidats', () => {
  it.each([
    [`TRIBUNAL JUDICIAIRE DE TOURS\nRG 26/01234\nORDONNANCE DE PROLONGATION DE MISSION\nPAR CES MOTIFS\nProrogeons pour douze mois la mission de Maître X, administrateur provisoire.`, 'Ordonnance de prolongation de mission'],
    [`TRIBUNAL JUDICIAIRE DE TOURS\nRG 26/01234\nORDONNANCE DE TAXE\nTaxons les honoraires de Maître Y, administrateur provisoire, à 4 000 € HT.`, 'Ordonnance de taxe'],
    [`TRIBUNAL JUDICIAIRE DE TOURS\nRG 26/01234\nORDONNANCE DE FIN DE MISSION\nPAR CES MOTIFS\nMettons fin à la mission de Maître Y, administrateur provisoire.`, 'Ordonnance de fin de mission'],
    [`TRIBUNAL JUDICIAIRE DE TOURS\nRG 26/00007\nORDONNANCE D'EXPROPRIATION — PAR CES MOTIFS, Prononçons l'expropriation des lots n° 3 et 4.`, "Ordonnance d'expropriation"],
  ])('titre net : le sous-type en tête, puis « Ordonnance (autres) », puis les quatre autres sous-types (%s)', (texte, type) => {
    const candidats = candidatsDe(texte)
    expect(candidats.slice(0, 2)).toEqual([
      { categorie: 'Tribunal', type },
      { categorie: 'Base', type: 'Ordonnance (autres)' },
    ])
    expect(new Set(candidats.slice(2).map((c) => c.type))).toEqual(new Set(SOUS_TYPES_TRIBUNAL.filter((t) => t !== type)))
    expect(candidats).toHaveLength(6)
  })

  it.each([
    [
      `TRIBUNAL JUDICIAIRE DE PARIS\nRG n° 24/01234\nORDONNANCE DE PROLONGATION DE MISSION / Vu l'ordonnance du 3 mars 2024 ayant désigné Maître X en qualité d'administrateur provisoire… Prorogeons la mission…`,
      'Ordonnance de prolongation de mission',
    ],
    ["Ordonnance de prolongation de la mission de l'administrateur provisoire désigné par ordonnance du 2 mars 2025", 'Ordonnance de prolongation de mission'],
    ['ORDONNANCE DE TAXE. Maître Y, désignée administrateur provisoire…', 'Ordonnance de taxe'],
    ['Ordonnance de taxe — tribunal judiciaire de Tours — administrateur provisoire désigné le 2 mars 2025', 'Ordonnance de taxe'],
    ['ORDONNANCE DE FIN DE MISSION. Maître Y, désignée administrateur provisoire par ordonnance du 3 mars 2024…', 'Ordonnance de fin de mission'],
    ["Ordonnance mettant fin à la mission de l'administrateur provisoire — tribunal judiciaire de Tours", 'Ordonnance de fin de mission'],
    ["TRIBUNAL JUDICIAIRE DE TOURS\nJuge de l'expropriation\nORDONNANCE D'EXPROPRIATION — RG 26/00007", "Ordonnance d'expropriation"],
    [
      `TRIBUNAL JUDICIAIRE DE TOURS\nRG 26/01234\nORDONNANCE SUR REQUÊTE. Vu la requête tendant à la désignation d'un administrateur provisoire ; Désignons Maître Jeanne Dupont, administrateur judiciaire, 12 rue de la Paix 37000 Tours, en qualité d'administrateur provisoire pour une durée de douze mois, susceptible de prorogation.`,
      'Ordonnance de désignation',
    ],
    [
      `TRIBUNAL JUDICIAIRE DE TOURS\nRG 26/01234\nORDONNANCE SUR REQUÊTE. Vu l'ordonnance du 3 mars 2024 portant désignation de Maître X en qualité d'administrateur provisoire ; Vu la requête tendant à la prorogation de la mission ; Prorogeons la mission pour douze mois.`,
      'Ordonnance de prolongation de mission',
    ],
    [
      `TRIBUNAL JUDICIAIRE DE TOURS\nRG 26/01234\nORDONNANCE. Vu l'ordonnance du 3 mars 2024 désignant Maître X en qualité d'administrateur provisoire ; Disons que la mission de l'administrateur provisoire prend fin le 30 juin 2026.`,
      'Ordonnance de fin de mission',
    ],
  ])('sans dispositif, ou plusieurs sous-types évoqués : le bon parmi les candidats, avant « Ordonnance (autres) » (%s)', (texte, type) => {
    expect(suggererClassement(texte)).toMatchObject({ source: 'texte', statut: 'suggestion' })
    const types = candidatsDe(texte).map((c) => c.type)
    expect(types).toContain(type)
    expect(types.indexOf(type)).toBeLessThan(types.indexOf('Ordonnance (autres)'))
  })

  it('une ordonnance de référé qui désigne un expert : « Ordonnance (autres) » est candidate', () => {
    const refere = `TRIBUNAL JUDICIAIRE DE PARIS\nRG 26/00042\nORDONNANCE DE RÉFÉRÉ. Désignons M. Z en qualité d'expert judiciaire avec mission de décrire les désordres.`
    expect(candidatsDe(refere)).toContainEqual({ categorie: 'Base', type: 'Ordonnance (autres)' })
  })
})

describe('pièces de l’administrateur provisoire qui citent sa désignation : le vrai type en tête, l’ordonnance citée ensuite', () => {
  const QUALITE = "Maître X, administrateur provisoire désigné par ordonnance du tribunal judiciaire de Tours (RG 26/01234)"
  it.each([
    [`${QUALITE}\nCONVOCATION à l'assemblée générale. Ordre du jour : 1. Approbation des comptes`, 'Base', "Convocation d'assemblée"],
    [
      `Maître X, administrateur provisoire désigné par ordonnance du tribunal judiciaire de Tours\nCONVOCATION à l'assemblée générale. Ordre du jour : 1. Approbation des comptes`,
      'Base',
      "Convocation d'assemblée",
    ],
    [`PROCÈS-VERBAL DE L'ASSEMBLÉE GÉNÉRALE du 12 juin. ${QUALITE}. Résolution n° 3 : adoptée à la majorité des voix.`, 'Base', "Procès-verbal d'assemblée"],
    [`${QUALITE}\nMISE EN DEMEURE — charges de copropriété impayées : à défaut de règlement sous huit jours…`, 'Copropriétaire', 'Mise en demeure'],
    [
      `FACTURE n° 2026-14 — Syndicat des copropriétaires représenté par ${QUALITE} — Total HT 1 000,00 € — TVA 10 % — Net à payer 1 100,00 €`,
      'Fournisseur',
      'Facture/avoir fournisseur',
    ],
  ])('%s', (texte, categorie, type) => {
    const candidats = candidatsDe(texte)
    expect(candidats[0]).toEqual({ categorie, type })
    expect(candidats).toContainEqual({ categorie: 'Tribunal', type: 'Ordonnance de désignation' })
  })
})

describe('types GED en concurrence : tous candidats, dans l’ordre de la pièce, jamais départagés', () => {
  const DEVIS = { categorie: 'Fournisseur', type: 'Devis fournisseur' }
  const FACTURE = { categorie: 'Fournisseur', type: 'Facture/avoir fournisseur' }
  const CONVOCATION = { categorie: 'Base', type: "Convocation d'assemblée" }
  const PV = { categorie: 'Base', type: "Procès-verbal d'assemblée" }

  it.each([
    [
      'devis qui cite la facture à venir',
      `DEVIS n° 2024-118 — Total HT 4 200,00 € / TVA 10 % / Total TTC 4 620,00 € / Acompte de 30 % à la commande, solde à réception de la facture. / Bon pour accord`,
      [DEVIS, FACTURE],
    ],
    ['devis n° 88', 'DEVIS n° 88 — Total HT 2 000,00 € — TVA 10 % — Total TTC 2 200,00 € — Bon pour accord — solde à réception de facture', [DEVIS, FACTURE]],
    ['facture qui cite le devis accepté', 'FACTURE n° 12 — travaux selon devis n° 88 accepté — Total HT 1 000,00 € — TVA 10 % — Net à payer 1 100,00 €', [FACTURE, DEVIS]],
    [
      'convocation dont l’ordre du jour cite le procès-verbal',
      `CONVOCATION à l'assemblée générale du 12 juin. Ordre du jour : 1. Élection des scrutateurs ; 2. Approbation du procès-verbal de la précédente assemblée ; 3. Résolution : approbation des comptes (majorité de l'article 24).`,
      [CONVOCATION, PV],
    ],
    [
      'procès-verbal « sur convocation du syndic »',
      `PROCÈS-VERBAL DE L'ASSEMBLÉE GÉNÉRALE du 12 juin, sur convocation du syndic. Feuille de présence signée. Résolution n° 1 : adoptée.`,
      [PV, CONVOCATION],
    ],
  ])('%s', (_cas, texte, candidats) => {
    expect(suggererClassement(texte)).toMatchObject({ source: 'texte', statut: 'suggestion' })
    expect(candidatsDe(texte)).toEqual(candidats)
  })

  it('demande d’état daté (notaire) : « Étude notariale › Demande pré-état daté / état daté », jamais l’état daté lui-même ; présente une fois confirmée', () => {
    const DEMANDE = { categorie: 'Étude notariale', type: 'Demande pré-état daté / état daté' } as const
    const demande = "DEMANDE D'ÉTAT DATÉ (article 5 du décret du 17 mars 1967). Maître Y, notaire. Vente du lot 12."
    expect(candidatsDe(demande)).toEqual([DEMANDE])
    expect(candidatsDe(`Objet : ${demande}`)).toEqual([DEMANDE])
    expect(candidatsDe('Demande de pré-état daté pour le lot 12, cédant M. X — article 5 du décret du 17 mars 1967')).toEqual([DEMANDE])
    expect(candidatsDe('Pré-état daté — informations financières du cédant (article 5)')).not.toContainEqual({ categorie: 'Copropriétaire', type: 'État daté' })
    expect(candidatsDe('ÉTAT DATÉ établi à la demande de Maître Y, notaire (article 5 du décret du 17 mars 1967) — première partie')).toEqual([
      { categorie: 'Copropriétaire', type: 'État daté' },
    ])
    const mutation = { entiteType: 'mutation', entiteId: 'm1' }
    const suggestion = suggererClassement(demande)
    const suggeree = [{ id: 'd', ...mutation, type: codeGedDuClassement(suggestion, 'mutation') ?? 'demande', date: '2026-02-01' }]
    expect(controlerPieces(suggeree, mutation, piecesMutationSyndic(NATURE_VENTE_AMIABLE))).toMatchObject({
      presentes: [],
      aVerifier: [{ cle: 'demande_etat_date', documentIds: ['d'] }],
    })
    const confirmee = [{ id: 'd', ...mutation, type: codeGedDuClassement(confirmerClassement(suggestion, DEMANDE), 'mutation') ?? 'demande', date: '2026-02-01' }]
    const controle = controlerPieces(confirmee, mutation, piecesMutationSyndic(NATURE_VENTE_AMIABLE))
    expect(controle.presentes.map((p) => p.cle)).toEqual(['demande_etat_date'])
    expect(controle.manquantes.map((p) => p.cle)).toContain('etat_date')
  })

  it.each([
    'MISE EN DEMEURE — à défaut de paiement de notre facture n° 12, sommes dues',
    'Mise en demeure de payer : notre facture n° 2026-118 relative à l’entretien de l’ascenseur reste impayée. À défaut de règlement sous huit jours…',
    'Objet : mise en demeure. Facture impayée de 1 200 € TTC. A défaut de règlement sous 8 jours…',
  ])('mise en demeure d’un fournisseur : aucune référence GED tant que le gestionnaire n’a pas confirmé ; le lien recouvrement vient de sa confirmation (%s)', (texte) => {
    const code = codeGedDuClassement(suggererClassement(texte), 'copropriete')
    expect(code?.startsWith(CODE_A_CONFIRMER_PREFIXE)).toBe(true)
    const document = { entiteType: 'copropriete', type: code ?? '' }
    expect(referenceDuDocument(document)).toBeNull()
    const confirme = confirmerClassement(candidatsDuDocument(document), { categorie: 'Copropriétaire', type: 'Mise en demeure' })
    expect(confirme.horsCandidats).toBe(false)
    expect(liensDuTypeDocument(confirme.ref)).toEqual(['recouvrement'])
  })

  it('en-tête : la proposition VitFix de la tranche 43 § 19 est marquée 🔵, pas 🟢', () => {
    const source = readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'classement-pieces-ged.ts'), 'utf8').replace(
      /\s*\n\s*\*\s*/g,
      ' ',
    )
    expect(source).not.toMatch(/🟢 tranche 43 § 19 : « reprendre ce référentiel/)
    expect(source).toMatch(/🔵[^🟢🔴]*« reprendre ce référentiel \{ roleTiers, type \} pour classer les pièces importées »/u)
  })
})
