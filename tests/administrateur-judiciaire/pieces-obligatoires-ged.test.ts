import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { composerDateIso } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  DOCUMENTS_EXTRANET,
  DOCUMENTS_OBLIGATOIRES_SYNDICAT,
  MENTIONS_OBLIGATOIRES,
  TYPES_GED_PAR_PIECE_REPRISE,
  alerteFicheSynthetique,
  avertissementExtranet,
  avisAppelDansExtranet,
  controlerPieces,
  documentsExtranetDuPublic,
  documentsObligatoiresSyndicat,
  piecesRepriseCouvertesParGed,
  type DocumentGed,
} from '@/lib/administrateur-judiciaire/domain/pieces-obligatoires-ged'
import {
  AVERTISSEMENT_ART20_DROIT_DEMEMBRE,
  AVERTISSEMENT_ETAT_DATE_USUFRUIT_CONSTITUE,
  NATURE_CESSION_DROIT_REEL_ONEREUSE,
  NATURE_VENTE_AMIABLE,
  inscriptionSyndicatConnue,
  mutationDroitDemembre,
  piecesMutationSyndic,
  piecesRemiseAcquereur,
  type InscriptionSyndicat,
  type NatureMutation,
} from '@/lib/administrateur-judiciaire/domain/pieces-mutation-ged'
import { PIECES_REPRISE, piecesRepriseRecues } from '@/lib/administrateur-judiciaire/domain/reprise'
import { CATEGORIES_DOCUMENT, TYPES_GENERIQUES_DOCUMENT } from '@/lib/administrateur-judiciaire/domain/referentiel-types-document'
import {
  codeTypeDocument,
  codeTypesAConfirmer,
  creerReferenceTypeDocument,
  memeLibelle,
  type ModeleTypeDocument,
} from '@/lib/administrateur-judiciaire/domain/typologie-documents'

/**
 * Pièces attendues d'un dossier, contrôlées sur les documents classés par la GED (point 64 du bilan 2).
 * Droit relu sur Légifrance le 29/10/2026 : D. 1967 art. 4, 5, 5-1, 6, 17, 32, 33, 62-8 ; L. 1965 art. 8-2, 14-3, 18,
 * 20, 41-8, 41-10 ; D. 2019-502 art. 1 à 4 ; CCH art. L. 721-2 et L. 721-3 ; D. 2005-240 art. 6 et 12.
 */

const COPRO = { entiteType: 'copropriete', entiteId: 'c1' }

const doc = (id: string, categorie: string, type: string, date = '2026-03-01', entite = COPRO): DocumentGed => ({
  id,
  entiteType: entite.entiteType,
  entiteId: entite.entiteId,
  type: codeTypeDocument(creerReferenceTypeDocument(categorie, type), entite.entiteType),
  date,
})

/** Source d'un module, lignes de commentaire recollées (« * » de continuation retirés). */
const SOURCE = (fichier: string): string =>
  readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', fichier), 'utf8').replace(/\s*\n\s*\*\s*/g, ' ')

const HABITATION = { destinationTotaleAutreQueHabitation: false, accesEnLigneEcarteParAg: false }

const toutesLesPieces = () => [
  ...DOCUMENTS_OBLIGATOIRES_SYNDICAT,
  ...DOCUMENTS_EXTRANET,
  ...piecesMutationSyndic(NATURE_VENTE_AMIABLE),
  ...piecesRemiseAcquereur({ mode: 'vente_publique', acquereurDejaCoproprietaire: false, lotAnnexe: false, syndicatArt14_3Alinea2: false }),
]

/** Modèle relevé : type générique (catégorie null) ou type de la catégorie, contrôlé « referentiel ». */
function verifierModele(modele: ModeleTypeDocument): void {
  if (modele.categorie === null) {
    expect(TYPES_GENERIQUES_DOCUMENT.some((t) => memeLibelle(t, modele.type)), modele.type).toBe(true)
    return
  }
  expect(CATEGORIES_DOCUMENT).toContain(modele.categorie)
  expect(creerReferenceTypeDocument(modele.categorie, modele.type).controle).toBe('referentiel')
}

describe('cohérence des listes', () => {
  it('chaque modèle de type cité existe dans le référentiel (catégorie et type contrôlés, génériques compris)', () => {
    for (const piece of toutesLesPieces()) for (const modele of piece.modeles) verifierModele(modele)
    for (const modeles of Object.values(TYPES_GED_PAR_PIECE_REPRISE)) for (const modele of modeles ?? []) verifierModele(modele)
  })

  it('clés uniques dans chaque liste', () => {
    for (const liste of [DOCUMENTS_OBLIGATOIRES_SYNDICAT, DOCUMENTS_EXTRANET, piecesMutationSyndic(NATURE_VENTE_AMIABLE)]) {
      const cles = liste.map((p) => p.cle)
      expect(new Set(cles).size).toBe(cles.length)
    }
  })

  it('aucune pièce attendue sans fondement n’est marquée « TEXTE »', () => {
    for (const piece of toutesLesPieces()) if (piece.certitude === 'TEXTE') expect(piece.fondement).toBeTruthy()
  })
})

describe('documents obligatoires du syndicat', () => {
  it('archives (D. 1967 art. 33), registre (art. 17), liste des copropriétaires (art. 32), carnet, fiche synthétique', () => {
    const cles = DOCUMENTS_OBLIGATOIRES_SYNDICAT.map((p) => p.cle)
    for (const cle of ['reglement_copropriete', 'registre_pv', 'registre_decisions_ap', 'liste_coproprietaires', 'carnet_entretien', 'fiche_synthetique', 'pieces_justificatives'])
      expect(cles).toContain(cle)
    const ap = DOCUMENTS_OBLIGATOIRES_SYNDICAT.find((p) => p.cle === 'registre_decisions_ap')
    expect(ap?.fondement).toMatch(/62-8/)
    expect(ap?.modeles).toEqual([])
  })

  it('fiche synthétique : pas pour un immeuble à destination totale autre que d’habitation (L. 1965 art. 8-2)', () => {
    expect(documentsObligatoiresSyndicat({ destinationTotaleAutreQueHabitation: false }).map((p) => p.cle)).toContain('fiche_synthetique')
    expect(documentsObligatoiresSyndicat({ destinationTotaleAutreQueHabitation: true }).map((p) => p.cle)).not.toContain('fiche_synthetique')
  })

  it('contrôle : présentes, manquantes, non contrôlables (aucun type Gestéam)', () => {
    const documents = [
      doc('d1', 'Base', "Procès-verbal d'assemblée", '2025-06-12'),
      doc('d2', 'Base', "Procès-verbal d'assemblée signé", '2026-06-10'),
      doc('d3', 'Base', "Carnet d'entretien"),
      doc('d4', 'Base', 'Carnet d’entretien'.replace('’', "'"), '2026-01-01', { entiteType: 'copropriete', entiteId: 'autre' }),
    ]
    const resultat = controlerPieces(documents, COPRO, documentsObligatoiresSyndicat({ destinationTotaleAutreQueHabitation: false }))
    expect(resultat.presentes).toContainEqual({ cle: 'registre_pv', documentId: 'd2', date: '2026-06-10' })
    expect(resultat.presentes).toContainEqual({ cle: 'carnet_entretien', documentId: 'd3', date: '2026-03-01' })
    expect(resultat.manquantes.map((p) => p.cle)).toContain('fiche_synthetique')
    expect(resultat.nonControlables.map((p) => p.cle)).toEqual(expect.arrayContaining(['liste_coproprietaires', 'registre_decisions_ap']))
    expect(resultat.manquantes.map((p) => p.cle)).not.toContain('liste_coproprietaires')
  })

  it('un document à type libre ou du journal de reprise ne couvre aucune pièce', () => {
    const documents: DocumentGed[] = [
      { id: 'x', entiteType: 'copropriete', entiteId: 'c1', type: "Carnet d'entretien", date: '2026-01-01' },
      { id: 'y', entiteType: 'reprise', entiteId: 'c1', type: 'carnet', date: '2026-01-01' },
    ]
    const resultat = controlerPieces(documents, COPRO, documentsObligatoiresSyndicat({ destinationTotaleAutreQueHabitation: false }))
    expect(resultat.presentes).toEqual([])
  })

  it('date invalide d’un document : erreur explicite', () => {
    const documents = [{ ...doc('d1', 'Base', "Carnet d'entretien"), date: '2026-02-30' }]
    expect(() => controlerPieces(documents, COPRO, DOCUMENTS_OBLIGATOIRES_SYNDICAT)).toThrow(/2026-02-30/)
  })

  it('document « à confirmer » : jamais présent ; la pièce qu’un de ses candidats couvre est « à vérifier », ni manquante ni éventuelle absente', () => {
    const candidats = [
      { categorie: 'Base', type: "Carnet d'entretien" },
      { categorie: 'Base', type: 'Diagnostic termites' },
    ] as const
    const aConfirmer: DocumentGed = { id: 'x', ...COPRO, type: codeTypesAConfirmer(candidats, COPRO.entiteType), date: '2026-03-01' }
    const resultat = controlerPieces([aConfirmer], COPRO, documentsObligatoiresSyndicat({ destinationTotaleAutreQueHabitation: false }))
    expect(resultat.presentes).toEqual([])
    expect(resultat.aVerifier).toEqual([
      { cle: 'carnet_entretien', documentIds: ['x'] },
      { cle: 'diagnostics_techniques', documentIds: ['x'] },
    ])
    expect(resultat.manquantes.map((p) => p.cle)).not.toContain('carnet_entretien')
    expect(resultat.eventuellesAbsentes.map((p) => p.cle)).not.toContain('diagnostics_techniques')
    const avecUnDocumentSur = controlerPieces([aConfirmer, doc('d3', 'Base', "Carnet d'entretien")], COPRO, documentsObligatoiresSyndicat({ destinationTotaleAutreQueHabitation: false }))
    expect(avecUnDocumentSur.presentes).toEqual([{ cle: 'carnet_entretien', documentId: 'd3', date: '2026-03-01' }])
    expect(avecUnDocumentSur.aVerifier.map((p) => p.cle)).toEqual(['diagnostics_techniques'])
    expect(piecesRepriseCouvertesParGed([aConfirmer], COPRO)).toEqual({ couvertes: new Set(), aVerifier: new Set(['carnet']) })
  })

  it('reprise : une pièce qu’un type candidat seul couvrirait est « à vérifier », distincte d’une pièce absente ; confirmée : couverte', () => {
    const pvSuggere: DocumentGed = { id: 'p', ...COPRO, type: codeTypesAConfirmer([{ categorie: 'Base', type: "Procès-verbal d'assemblée" }], COPRO.entiteType), date: '2026-03-01' }
    expect(piecesRepriseCouvertesParGed([pvSuggere], COPRO)).toEqual({ couvertes: new Set(), aVerifier: new Set(['registre_pv']) })
    expect(piecesRepriseCouvertesParGed([], COPRO)).toEqual({ couvertes: new Set(), aVerifier: new Set() })
    expect(piecesRepriseCouvertesParGed([pvSuggere, doc('d', 'Base', "Procès-verbal d'assemblée")], COPRO)).toEqual({
      couvertes: new Set(['registre_pv']),
      aVerifier: new Set(),
    })
  })

  it('toute suggestion, même à un seul candidat, reste « à vérifier » : documents obligatoires et mutation', () => {
    const carnet: DocumentGed = { id: 'c', ...COPRO, type: codeTypesAConfirmer([{ categorie: 'Base', type: "Carnet d'entretien" }], COPRO.entiteType), date: '2026-03-01' }
    const obligatoires = controlerPieces([carnet], COPRO, documentsObligatoiresSyndicat({ destinationTotaleAutreQueHabitation: false }))
    expect(obligatoires.presentes).toEqual([])
    expect(obligatoires.aVerifier).toEqual([{ cle: 'carnet_entretien', documentIds: ['c'] }])
    expect(obligatoires.manquantes.map((p) => p.cle)).not.toContain('carnet_entretien')
    const mutation = { entiteType: 'mutation', entiteId: 'm1' }
    const etatDate: DocumentGed = { id: 'e', ...mutation, type: codeTypesAConfirmer([{ categorie: 'Copropriétaire', type: 'État daté' }], mutation.entiteType), date: '2026-03-01' }
    const pieces = controlerPieces([etatDate], mutation, piecesMutationSyndic(NATURE_VENTE_AMIABLE))
    expect(pieces.presentes).toEqual([])
    expect(pieces.aVerifier).toEqual([{ cle: 'etat_date', documentIds: ['e'] }])
    expect(pieces.manquantes.map((p) => p.cle)).not.toContain('etat_date')
  })

  it('en-tête : un document dont le type n’est pas confirmé (suggestion d’après le texte) ne rend jamais une pièce présente', () => {
    expect(SOURCE('pieces-obligatoires-ged.ts')).toContain(
      "un document dont le type n'est pas confirmé (suggestion d'après le texte, code « à confirmer » de typologie-documents.ts) ne la rend jamais présente",
    )
  })
})

describe('extranet (D. 2019-502) : trois publics exclusifs', () => {
  it('9 documents pour tous les copropriétaires, 4 pour le copropriétaire du lot, 5 pour le conseil syndical', () => {
    expect(documentsExtranetDuPublic('coproprietaires', HABITATION)).toHaveLength(9)
    expect(documentsExtranetDuPublic('coproprietaire_du_lot', HABITATION)).toHaveLength(4)
    expect(documentsExtranetDuPublic('conseil_syndical', HABITATION)).toHaveLength(5)
    expect(DOCUMENTS_EXTRANET).toHaveLength(18)
  })

  it('immeuble à destination totale autre que d’habitation : pas de fiche synthétique (L. 1965 art. 8-2 ; D. 2019-502 art. 1, 2°)', () => {
    const bureaux = { destinationTotaleAutreQueHabitation: true, accesEnLigneEcarteParAg: false }
    const pieces = documentsExtranetDuPublic('coproprietaires', bureaux)
    expect(pieces.map((p) => p.cle)).not.toContain('fiche_synthetique')
    expect(pieces).toHaveLength(8)
    expect(controlerPieces([], COPRO, pieces).manquantes.map((p) => p.cle)).not.toContain('fiche_synthetique')
    const habitation = documentsExtranetDuPublic('coproprietaires', HABITATION)
    expect(controlerPieces([], COPRO, habitation).manquantes.map((p) => p.cle)).toContain('fiche_synthetique')
  })

  it('accès en ligne écarté par l’AG (L. 1965 art. 18 I, majorité de l’art. 25) : aucune pièce due au titre de l’extranet', () => {
    const ecarte = { destinationTotaleAutreQueHabitation: false, accesEnLigneEcarteParAg: true }
    for (const publicVise of ['coproprietaires', 'coproprietaire_du_lot', 'conseil_syndical'] as const)
      expect(documentsExtranetDuPublic(publicVise, ecarte)).toEqual([])
    expect(SOURCE('pieces-obligatoires-ged.ts')).toContain(
      "sauf décision contraire de l'assemblée générale prise à la majorité de l'article 25",
    )
  })

  it('avis d’appel de fonds : transmis à compter du 1er juillet 2020 ET sur les trois dernières années (art. 2, 4° et art. 4 I)', () => {
    const reference = composerDateIso(2026, 10, 30)
    expect(avisAppelDansExtranet(composerDateIso(2020, 6, 30), composerDateIso(2021, 1, 1))).toBe(false)
    expect(avisAppelDansExtranet(composerDateIso(2020, 7, 1), composerDateIso(2021, 1, 1))).toBe(true)
    expect(avisAppelDansExtranet(composerDateIso(2021, 1, 15), reference)).toBe(false)
    expect(avisAppelDansExtranet(composerDateIso(2023, 10, 30), reference)).toBe(false)
    expect(avisAppelDansExtranet(composerDateIso(2023, 10, 31), reference)).toBe(true)
    expect(avisAppelDansExtranet(reference, reference)).toBe(true)
    expect(avisAppelDansExtranet(composerDateIso(2026, 11, 2), reference)).toBe(false)
    expect(() => avisAppelDansExtranet('01/07/2020', reference)).toThrow()
    expect(() => avisAppelDansExtranet(composerDateIso(2024, 1, 1), '30/10/2026')).toThrow(/30\/10\/2026/)
  })

  it('assignations : seulement celles délivrées AU NOM du syndicat (D. 2019-502 art. 3, 3°)', () => {
    const piece = DOCUMENTS_EXTRANET.find((p) => p.cle === 'assignations_decisions')
    expect(piece?.libelle).toMatch(/^Assignations en justice délivrées au nom du syndicat/)
    expect(piece?.libelle).toMatch(/délais de recours n'ont pas expiré/)
    const pieces = documentsExtranetDuPublic('conseil_syndical', HABITATION)
    const parHuissier = controlerPieces([doc('h', 'Huissier de justice', 'Assignation')], COPRO, pieces)
    expect(parHuissier.presentes.map((p) => p.cle)).not.toContain('assignations_decisions')
    const parAvocat = controlerPieces([doc('a', "Cabinet d'avocat", 'Assignation')], COPRO, pieces)
    expect(parAvocat.presentes.map((p) => p.cle)).not.toContain('assignations_decisions')
    const auNom = controlerPieces([doc('b', 'Base', 'Assignation au nom du syndicat')], COPRO, pieces)
    expect(auNom.presentes.map((p) => p.cle)).toContain('assignations_decisions')
  })

  it('en-tête : les pièces « éventuelles » déduites sont toutes citées, assignations et décisions comprises', () => {
    expect(SOURCE('pieces-obligatoires-ged.ts')).toMatch(/pièces « éventuelles » : [^;]*assignations et décisions de justice/)
  })

  describe('administration provisoire (J67, R119) : contrôle gardé par prudence, à confirmer, jamais bloquant', () => {
    const AP = { ...HABITATION, administrationProvisoire: true }

    it('ordonnance de désignation (et de prolongation) à la place du contrat de syndic, marquée « équivalence VitFix »', () => {
      const pieces = documentsExtranetDuPublic('coproprietaires', AP)
      expect(pieces.map((p) => p.cle)).not.toContain('contrat_syndic')
      expect(pieces).toHaveLength(9)
      expect(pieces.find((p) => p.cle === 'ordonnance_designation')).toMatchObject({
        public: 'coproprietaires',
        certitude: 'EQUIVALENCE_VITFIX',
        presence: 'requise',
        modeles: [
          { categorie: 'Tribunal', type: 'Ordonnance de désignation' },
          { categorie: 'Tribunal', type: 'Ordonnance de prolongation de mission' },
        ],
      })
      const controle = controlerPieces([doc('o', 'Tribunal', 'Ordonnance de désignation')], COPRO, pieces)
      expect(controle.presentes.map((p) => p.cle)).toContain('ordonnance_designation')
    })

    it('attestations : sans la carte professionnelle ; assurance et garantie « éventuelles »', () => {
      const attestations = documentsExtranetDuPublic('conseil_syndical', AP).find((p) => p.cle === 'attestations_syndic')
      expect(attestations?.presence).toBe('eventuelle')
      expect(attestations?.libelle).not.toMatch(/Carte professionnelle/)
      expect(attestations?.modeles.map((m) => m.type)).not.toContain('Carte professionnelle')
      expect(controlerPieces([], COPRO, documentsExtranetDuPublic('conseil_syndical', AP)).manquantes.map((p) => p.cle)).not.toContain('attestations_syndic')
    })

    it('libellé « à confirmer » sous administration provisoire seulement ; syndic : liste inchangée', () => {
      expect(avertissementExtranet(AP)).toBe(
        "Obligation du syndic professionnel (L. 1965 art. 18, I), appliquée par prudence à l'administrateur provisoire : à confirmer (J67, R119). Alertes seulement, jamais bloquantes.",
      )
      expect(avertissementExtranet(HABITATION)).toBeNull()
      expect(documentsExtranetDuPublic('coproprietaires', HABITATION).map((p) => p.cle)).toContain('contrat_syndic')
      expect(documentsExtranetDuPublic('coproprietaires', { ...AP, accesEnLigneEcarteParAg: true })).toEqual([])
    })

    it('en-tête : la question de l’extranet sous administration provisoire quitte les points non établis', () => {
      const source = SOURCE('pieces-obligatoires-ged.ts')
      expect(source).not.toContain("doit-il tenir l'extranet du décret 2019-502 pour la copropriété administrée ? » (la loi vise")
      expect(source).toMatch(/J67, R119[\s\S]*appliquée par prudence/)
    })
  })
})

describe('fiche synthétique à mettre à jour (J67, R120 ; D. 2016-1822 art. 1)', () => {
  const fiche = (date: string) => doc(`f-${date}`, 'Base', 'Fiche synthétique', date)
  const approbation = { date: '2026-06-10', parAdministrateurProvisoire: false, notificationsPv: ['2026-06-25', '2026-06-20'] }

  it('deux mois depuis la plus tôt des notifications du PV, sans fiche datée après l’AG : à mettre à jour', () => {
    const alerte = alerteFicheSynthetique([fiche('2025-08-01')], COPRO, approbation, '2026-08-21')
    expect(alerte).toEqual({
      aMettreAJour: true,
      depart: '2026-06-20',
      origineDepart: 'notification_pv',
      echeance: '2026-08-20',
      derniereFiche: { documentId: 'f-2025-08-01', date: '2025-08-01' },
      aVerifier: [],
      fondement: 'D. 2016-1822 art. 1 ; L. 1965 art. 8-2',
      justification:
        "Départ : la plus tôt des notifications du procès-verbal de l'assemblée du 10/06/2026 qui a approuvé les comptes, le 20/06/2026 ; données à établir dans les 2 mois (D. 2016-1822 art. 1), au plus tard le 20/08/2026.",
      // Relecture : la durée affichée est lue dans DELAI_MISE_A_JOUR_FICHE_SYNTHETIQUE_MOIS, comme l'échéance.
      message: "Fiche synthétique à mettre à jour : aucune fiche datée après l'assemblée du 10/06/2026, délai de 2 mois échu le 20/08/2026.",
      aConfirmer: false,
    })
  })

  it('fiche faite dans le délai, après l’AG : pas d’alerte ; délai non échu : pas d’alerte', () => {
    expect(alerteFicheSynthetique([fiche('2026-07-25')], COPRO, approbation, '2026-10-01')).toMatchObject({
      aMettreAJour: false,
      derniereFiche: { date: '2026-07-25' },
    })
    expect(alerteFicheSynthetique([], COPRO, approbation, '2026-08-20').aMettreAJour).toBe(false)
    expect(alerteFicheSynthetique([fiche('2026-06-10')], COPRO, approbation, '2026-09-01').aMettreAJour).toBe(true)
  })

  it('sans notification saisie : départ à la date de l’AG (plus tôt, donc prudent)', () => {
    expect(alerteFicheSynthetique([], COPRO, { ...approbation, notificationsPv: [] }, '2026-08-11')).toMatchObject({
      aMettreAJour: true,
      depart: '2026-06-10',
      origineDepart: 'date_ag',
      echeance: '2026-08-10',
    })
  })

  it('comptes approuvés par l’administrateur provisoire : départ à sa décision, à confirmer', () => {
    const decision = { date: '2026-05-04', parAdministrateurProvisoire: true, notificationsPv: [] }
    const alerte = alerteFicheSynthetique([], COPRO, decision, '2026-07-05')
    expect(alerte).toMatchObject({ aMettreAJour: true, depart: '2026-05-04', origineDepart: 'decision_administrateur', echeance: '2026-07-04', aConfirmer: true })
    expect(alerte.justification).toMatch(/décision de l'administrateur provisoire du 04\/05\/2026.*à confirmer/)
    expect(() => alerteFicheSynthetique([], COPRO, { ...decision, notificationsPv: ['2026-05-10'] }, '2026-07-05')).toThrow(/pas de procès-verbal/)
  })

  it('fiche à confirmer datée après l’AG : à vérifier, sans faire tomber l’alerte ; contrôles des dates', () => {
    const suggestion: DocumentGed = { id: 's', ...COPRO, type: codeTypesAConfirmer([{ categorie: 'Base', type: 'Fiche synthétique' }], COPRO.entiteType), date: '2026-07-01' }
    expect(alerteFicheSynthetique([suggestion], COPRO, approbation, '2026-09-01')).toMatchObject({ aMettreAJour: true, aVerifier: ['s'] })
    expect(() => alerteFicheSynthetique([], COPRO, { ...approbation, notificationsPv: ['2026-06-01'] }, '2026-09-01')).toThrow(/avant l'assemblée/)
    expect(() => alerteFicheSynthetique([], COPRO, approbation, '01/09/2026')).toThrow(/AAAA-MM-JJ/)
  })

  it('mentions obligatoires en données (aide-mémoire, aucun contrôle du contenu) : carnet d’entretien et fiche synthétique', () => {
    expect(MENTIONS_OBLIGATOIRES.carnet_entretien.map((m) => m.fondement)).toEqual([
      'D. 2001-477 art. 3',
      'D. 2001-477 art. 3',
      'D. 2001-477 art. 3',
      'D. 2001-477 art. 4',
      'D. 2001-477 art. 4',
      'D. 2001-477 art. 4',
      'D. 2001-477 art. 4',
      'D. 2001-477 art. 4',
    ])
    expect(MENTIONS_OBLIGATOIRES.fiche_synthetique).toHaveLength(6)
    expect(MENTIONS_OBLIGATOIRES.fiche_synthetique[1].libelle).toMatch(/syndic ou administrateur provisoire.*cadre de son intervention/)
    const cles = new Set(DOCUMENTS_OBLIGATOIRES_SYNDICAT.map((p) => p.cle))
    for (const cle of Object.keys(MENTIONS_OBLIGATOIRES)) expect(cles.has(cle)).toBe(true)
  })
})

const VENTE: NatureMutation = NATURE_VENTE_AMIABLE
const DROIT_REEL: NatureMutation = { acteConventionnel: true, titreOnereux: false, venteParActeAuthentique: false }
const SUCCESSION: NatureMutation = { acteConventionnel: false, titreOnereux: false, venteParActeAuthentique: false }
const ADJUDICATION: NatureMutation = { acteConventionnel: false, titreOnereux: true, venteParActeAuthentique: false }

describe('pièces de mutation', () => {
  it('côté syndic : état daté (D. 1967 art. 5), avis de mutation et certificats (L. 1965 art. 20), notification (art. 6)', () => {
    const pieces = piecesMutationSyndic(VENTE)
    const parCle = new Map(pieces.map((p) => [p.cle, p]))
    expect(parCle.get('etat_date')?.fondement).toMatch(/D\. 1967 art\. 5/)
    expect(parCle.get('etat_date')?.certitude).toBe('TEXTE')
    expect(parCle.get('certificat_art20_ii')?.fondement).toMatch(/art\. 20, II/)
    expect(parCle.get('certificat_art20_ii')?.presence).toBe('requise')
    expect(parCle.get('opposition_art20')?.presence).toBe('eventuelle')
    expect(pieces.map((p) => p.cle)).toEqual([
      'demande_etat_date',
      'etat_date',
      'certificat_art20_i',
      'avis_mutation',
      'opposition_art20',
      'certificat_art20_ii',
      'notification_art6',
      'procuration_mainlevee',
    ])
    expect(parCle.get('notification_art6')?.fondement).toMatch(/D\. 1967 art\. 6/)
    expect(parCle.get('procuration_mainlevee')?.certitude).toBe('GESTEAM')
  })

  it('contrôle d’un dossier de vente amiable (acte authentique de vente)', () => {
    const mutation = { entiteType: 'mutation', entiteId: 'm1' }
    const documents = [
      doc('a', 'Étude notariale', 'Demande pré-état daté / état daté', '2026-02-01', mutation),
      doc('b', 'Copropriétaire', 'État daté mutation', '2026-02-10', mutation),
    ]
    const resultat = controlerPieces(documents, mutation, piecesMutationSyndic(VENTE))
    expect(resultat.presentes.map((p) => p.cle)).toEqual(['demande_etat_date', 'etat_date'])
    expect(resultat.manquantes.map((p) => p.cle)).toEqual(['certificat_art20_ii', 'notification_art6'])
    expect(resultat.eventuellesAbsentes.map((p) => p.cle)).toEqual(['avis_mutation', 'opposition_art20', 'procuration_mainlevee'])
    expect(resultat.nonControlables.map((p) => p.cle)).toEqual(['certificat_art20_i'])
  })

  it('constitution de droit réel (acte conventionnel de l’art. 4, pas une vente) : ni certificat de l’art. 20 II ni pièces de l’art. 20 I', () => {
    const mutation = { entiteType: 'mutation', entiteId: 'm2' }
    const cles = piecesMutationSyndic(DROIT_REEL).map((p) => p.cle)
    for (const cle of ['certificat_art20_ii', 'avis_mutation', 'certificat_art20_i', 'opposition_art20']) expect(cles).not.toContain(cle)
    const notification = doc('n', 'Étude notariale', 'Notification de vente', '2026-02-01', mutation)
    const resultat = controlerPieces([notification], mutation, piecesMutationSyndic(DROIT_REEL))
    expect(resultat.manquantes.map((p) => p.cle)).toEqual(['etat_date'])
  })

  it('succession, adjudication (non conventionnelles) : état daté « éventuel » (D. 1967 art. 5 → art. 4), notification de l’art. 6 requise', () => {
    const mutation = { entiteType: 'mutation', entiteId: 'm3' }
    const succession = controlerPieces([], mutation, piecesMutationSyndic(SUCCESSION))
    expect(succession.manquantes.map((p) => p.cle)).toEqual(['notification_art6'])
    expect(succession.eventuellesAbsentes.map((p) => p.cle)).toContain('etat_date')
    expect(piecesMutationSyndic(SUCCESSION).map((p) => p.cle)).not.toContain('avis_mutation')
    const adjudication = piecesMutationSyndic(ADJUDICATION).map((p) => p.cle)
    expect(adjudication).toContain('avis_mutation')
    expect(adjudication).not.toContain('certificat_art20_ii')
    expect(controlerPieces([], mutation, piecesMutationSyndic(ADJUDICATION)).manquantes.map((p) => p.cle)).toEqual(['notification_art6'])
  })

  describe('usufruit et nue-propriété (J67, R115)', () => {
    it('constitution ou cession à titre onéreux : trois cases cochées, art. 20 en lecture prudente', () => {
      expect(NATURE_CESSION_DROIT_REEL_ONEREUSE).toEqual({ acteConventionnel: true, titreOnereux: true, venteParActeAuthentique: true })
      for (const droit of ['usufruit', 'nue_propriete'] as const)
        expect(mutationDroitDemembre({ droit, operation: 'constitution', aTitreOnereux: true })).toEqual({
          nature: NATURE_CESSION_DROIT_REEL_ONEREUSE,
          avertissements: [AVERTISSEMENT_ART20_DROIT_DEMEMBRE],
        })
      expect(mutationDroitDemembre({ droit: 'nue_propriete', operation: 'cession', aTitreOnereux: true }).avertissements).toEqual([AVERTISSEMENT_ART20_DROIT_DEMEMBRE])
      expect(AVERTISSEMENT_ART20_DROIT_DEMEMBRE).toMatch(/^Lecture prudente : art\. 20 appliqué à un droit démembré, à confirmer/)
      const cles = piecesMutationSyndic(mutationDroitDemembre({ droit: 'usufruit', operation: 'constitution', aTitreOnereux: true }).nature).map((p) => p.cle)
      expect(cles).toEqual(expect.arrayContaining(['certificat_art20_i', 'avis_mutation', 'certificat_art20_ii', 'notification_art6', 'etat_date']))
    })

    it('cession d’un usufruit déjà constitué : avertissement de plus sur l’état daté (D. 1967 art. 4 ne vise que la constitution)', () => {
      expect(mutationDroitDemembre({ droit: 'usufruit', operation: 'cession', aTitreOnereux: true }).avertissements).toEqual([
        AVERTISSEMENT_ART20_DROIT_DEMEMBRE,
        AVERTISSEMENT_ETAT_DATE_USUFRUIT_CONSTITUE,
      ])
      expect(AVERTISSEMENT_ETAT_DATE_USUFRUIT_CONSTITUE).toMatch(/^État daté : lecture prudente \(D\. 1967 art\. 4 ne vise que la constitution/)
    })

    it('donation : seule la case « acte conventionnel » ; notification de l’art. 6 et état daté requis', () => {
      const donation = mutationDroitDemembre({ droit: 'nue_propriete', operation: 'constitution', aTitreOnereux: false })
      expect(donation).toEqual({ nature: DROIT_REEL, avertissements: [] })
      const presence = new Map(piecesMutationSyndic(donation.nature).map((p) => [p.cle, p.presence]))
      expect([presence.get('notification_art6'), presence.get('etat_date')]).toEqual(['requise', 'requise'])
      expect(presence.has('certificat_art20_ii')).toBe(false)
    })
  })

  describe('mainlevée de l’inscription du syndicat (J67, R116)', () => {
    const mainlevee = (inscriptionSyndicat?: InscriptionSyndicat) =>
      piecesMutationSyndic(VENTE, inscriptionSyndicat === undefined ? undefined : { inscriptionSyndicat }).find((p) => p.cle === 'procuration_mainlevee')

    it('inscription connue : pièce requise, fondée sur L. 1965 art. 19, al. 2 et C. civ. art. 2435 et 2436, libellé élargi', () => {
      expect(mainlevee('oui')).toMatchObject({
        libelle: "Mainlevée de l'inscription du syndicat (acte authentique, procuration ou accord certifié par le notaire)",
        fondement: 'L. 1965 art. 19, al. 2 ; C. civ. art. 2435 et 2436',
        certitude: 'TEXTE',
        presence: 'requise',
      })
    })

    it('inscription inconnue (par défaut) : pièce éventuelle, comme avant ; absence établie : pièce non listée', () => {
      const attendu = {
        libelle: "Mainlevée de l'inscription du syndicat (acte authentique, procuration ou accord certifié par le notaire), à fournir si une inscription du syndicat existe sur le lot",
        fondement: null,
        certitude: 'GESTEAM',
        presence: 'eventuelle',
      }
      expect(mainlevee()).toMatchObject(attendu)
      expect(mainlevee('inconnue')).toMatchObject(attendu)
      expect(mainlevee('non')).toBeUndefined()
      expect(() => piecesMutationSyndic(VENTE, { inscriptionSyndicat: 'peut-être' as never })).toThrow(/oui, non ou inconnue/)
    })

    it('source : hypothèque inscrite au contentieux ou bordereau publié classé sur le lot ; sans l’un ni l’autre, inconnue (jamais « non »)', () => {
      const lot = { entiteType: 'lot', entiteId: 'l1' }
      const bordereau = doc('b', 'Base', 'Bordereau hypothèque publié', '2025-04-01', lot)
      expect(inscriptionSyndicatConnue({ hypothequesInscritesLe: ['2025-03-10'], documents: [], lot })).toBe('oui')
      expect(inscriptionSyndicatConnue({ hypothequesInscritesLe: [null], documents: [bordereau], lot })).toBe('oui')
      expect(inscriptionSyndicatConnue({ hypothequesInscritesLe: [null], documents: [{ ...bordereau, entiteId: 'l2' }], lot })).toBe('inconnue')
      expect(inscriptionSyndicatConnue({ hypothequesInscritesLe: [], documents: [doc('c', 'Base', "Carnet d'entretien", '2025-04-01', lot)], lot })).toBe('inconnue')
    })
  })

  it('nature incohérente : une vente est à titre onéreux', () => {
    expect(() => piecesMutationSyndic({ acteConventionnel: true, titreOnereux: false, venteParActeAuthentique: true })).toThrow(/onéreux/)
  })

  it('remise à l’acquéreur sur promesse (CCH L. 721-2 II) : 1° a à c, 2° a à d, 3° à 7°', () => {
    const pieces = piecesRemiseAcquereur({ mode: 'promesse', acquereurDejaCoproprietaire: false, lotAnnexe: false, syndicatArt14_3Alinea2: false })
    expect(pieces.map((p) => p.cle)).toEqual(['1a', '1b', '1c', '2a', '2b', '2c', '2d', '3', '4', '5', '6', '7'])
  })

  it.each([
    [{ acquereurDejaCoproprietaire: true, lotAnnexe: false, syndicatArt14_3Alinea2: false }, ['2a', '2b', '2c', '2d']],
    [{ acquereurDejaCoproprietaire: false, lotAnnexe: true, syndicatArt14_3Alinea2: false }, ['1a', '1b', '2a', '2b', '2c', '2d']],
    [{ acquereurDejaCoproprietaire: false, lotAnnexe: false, syndicatArt14_3Alinea2: true }, ['1a', '1b', '1c', '2a', '2d', '3', '4', '5', '6', '7']],
  ])('exceptions de la promesse %#', (circonstances, cles) => {
    expect(piecesRemiseAcquereur({ mode: 'promesse', ...circonstances }).map((p) => p.cle)).toEqual(cles)
  })

  it('acte sans promesse (III) : 1°, 2° c, 3° à 7° ; vente publique (IV) : 1° à 7°, exception du lot annexe seule', () => {
    const sans = { acquereurDejaCoproprietaire: false, lotAnnexe: false, syndicatArt14_3Alinea2: false }
    expect(piecesRemiseAcquereur({ mode: 'acte_sans_promesse', ...sans }).map((p) => p.cle)).toEqual(['1a', '1b', '1c', '2c', '3', '4', '5', '6', '7'])
    expect(piecesRemiseAcquereur({ mode: 'acte_sans_promesse', ...sans, acquereurDejaCoproprietaire: true }).map((p) => p.cle)).toEqual(['2c'])
    expect(piecesRemiseAcquereur({ mode: 'vente_publique', ...sans, acquereurDejaCoproprietaire: true })).toHaveLength(12)
    expect(piecesRemiseAcquereur({ mode: 'vente_publique', ...sans, lotAnnexe: true }).map((p) => p.cle)).toEqual(['1a', '1b', '2a', '2b', '2c', '2d'])
  })

  it('immeuble sans usage d’habitation (L. 721-2, I) : aucune pièce ; art. 14-3 al. 2 aussi en vente publique', () => {
    const sans = { acquereurDejaCoproprietaire: false, lotAnnexe: false, syndicatArt14_3Alinea2: false }
    expect(piecesRemiseAcquereur({ mode: 'promesse', ...sans, usageHabitation: false })).toEqual([])
    expect(piecesRemiseAcquereur({ mode: 'vente_publique', ...sans, syndicatArt14_3Alinea2: true }).map((p) => p.cle)).not.toContain('2b')
  })

  it('renvoi de L. 721-2 II 2° au 2e alinéa de l’art. 14-3 (J67, R114) : drapeau faux par défaut, 2° b et c exigés pour tous les syndicats', () => {
    const pieces = piecesRemiseAcquereur({ mode: 'promesse', acquereurDejaCoproprietaire: false, lotAnnexe: false })
    expect(pieces.map((p) => p.cle)).toEqual(expect.arrayContaining(['2b', '2c']))
    const source = SOURCE('pieces-mutation-ged.ts')
    expect(source).not.toContain("Syndicat relevant de l'art. 14-3, al. 2 de la loi de 1965")
    expect(source).not.toContain('est rédigée dans le 2° lui-même : appliquée partout')
    expect(source).not.toMatch(/🔴 Syndicat qui « relève du deuxième alinéa/)
    expect(source).not.toContain('vise-t-elle les petites copropriétés')
    expect(source).toMatch(/J67, R114[\s\S]*art\. 41-8[\s\S]*art\. 41-10/)
    expect(source).toContain('version du 16/07/2006 au 01/06/2020')
    expect(source).toContain('D. 2016-1822, art. 2, dernier alinéa')
  })

  it('en-tête (J67, R117) : informations financières et notice listées sans contrôle du contenu ; arrêtés cherchés, non trouvés', () => {
    const source = SOURCE('pieces-mutation-ged.ts')
    expect(source).not.toMatch(/🔴[^🔵🟢]*arrêtés prévus par L\. 721-2\) : non relus/)
    expect(source).toMatch(/J67, R117[\s\S]*recherche du 17\/11\/2026[\s\S]*non trouvés, non vérifié/)
  })

  it('en-tête : L. 721-3 ne vise que les 1° et 2° (promesse), le 1° et le 2° c (acte sans promesse)', () => {
    const source = SOURCE('pieces-mutation-ged.ts')
    expect(source).not.toContain('L. 721-3 : à défaut de remise,')
    expect(source).toContain(
      'L. 721-3 : si les documents et informations du 1° et du 2° (promesse) ou du 1° et du 2° c (acte sans promesse) ne sont pas remis ou joints',
    )
  })

  it('les informations financières du 2° ne sont pas des types de document : non contrôlables', () => {
    const pieces = piecesRemiseAcquereur({ mode: 'promesse', acquereurDejaCoproprietaire: false, lotAnnexe: false, syndicatArt14_3Alinea2: false })
    for (const cle of ['2a', '2b', '2c', '2d', '4']) expect(pieces.find((p) => p.cle === cle)?.modeles).toEqual([])
  })
})

describe('reprise des pièces (reprise.ts) couverte par la GED', () => {
  it('chaque clé de reprise correspond à une pièce existante', () => {
    const cles = new Set(PIECES_REPRISE.map((p) => p.cle))
    for (const cle of Object.keys(TYPES_GED_PAR_PIECE_REPRISE)) expect(cles.has(cle as never)).toBe(true)
  })

  it('pièces couvertes par des documents GED de la copropriété, sans toucher au journal de reprise', () => {
    const documents = [
      doc('d1', 'Base', "Feuille de présence"),
      doc('d2', 'Étude notariale', 'Règlement de copropriété (règlement, modificatifs)'),
      doc('d3', 'Fournisseur', 'Contrat, avenant entreprise'),
      doc('d4', 'Base', 'Divers'),
    ]
    const { couvertes, aVerifier } = piecesRepriseCouvertesParGed(documents, COPRO)
    expect([...couvertes].sort()).toEqual(['contrats', 'registre_pv', 'reglement'])
    expect(aVerifier.size).toBe(0)
    expect(piecesRepriseRecues(documents, 'c1').size).toBe(0)
  })
})
