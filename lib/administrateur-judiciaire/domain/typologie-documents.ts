import type { FamilleDiagnostic } from '@/lib/administrateur-judiciaire/domain/immeuble-juridique'
import {
  CATEGORIES_DOCUMENT,
  GROUPES_ASSOCIATION,
  TYPES_DOCUMENT_PAR_CATEGORIE,
  TYPES_GENERIQUES_DOCUMENT,
  type CategorieDocument,
  type ReleveCategorie,
} from '@/lib/administrateur-judiciaire/domain/referentiel-types-document'
import { normaliserTexteLibre } from '@/lib/administrateur-judiciaire/domain/texte'
import type { Dossier, TypeDocumentJudiciaire, TypeEntreprise } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * GED : type de document contrôlé { catégorie, type } (point 64 du bilan 2). Fonctions pures, sans écran ni table : le
 * code se range dans DocumentLocal.type (« ged:<Catégorie>|<Type> ») sans modifier db/schema.ts.
 *
 * Gestéam — 🟢 tranche 22 § 6 et tranche 43 § 19 (référentiel à deux niveaux, voir referentiel-types-document.ts) ;
 * 🟢 tranche 43 § 19 : « le classement suit le rôle du tiers », avec un vocabulaire par rôle : mutation (notaire),
 * recouvrement (copropriétaire), péril et injonction de travaux (mairie), employeur (gardien) ; 🟢 tranche 40 :
 * groupes « Association » ; 🟢 tranche 18 § 4 : TYPE_DOCUMENT_JUDICIAIRE, échantillon de 20 libellés.
 * 🔵 Déduit :
 * - comparaison des libellés sans casse, accents, ponctuation ni élision (« Caisse allocations familiales » =
 *   « Caisse d'allocations familiales ») ; le libellé canonique du référentiel est toujours rendu ;
 * - valeurs héritées de DocumentLocal.type : « ordonnance » sous un mandat se lit Tribunal › Ordonnance de désignation
 *   (🔴 à confirmer par Hugo : « Une ordonnance importée à la création d'un mandat se classe-t-elle toujours
 *   "Tribunal › Ordonnance de désignation" ? ») ; sous « reprise », le type reste une clé du journal de reprise et
 *   AUCUN code GED n'y est écrit (piecesRepriseRecues compte chaque document de cette entité) ;
 * - code « à confirmer » (« ged-a-confirmer:<Catégorie>|<Type>;… ») : types candidats d'une pièce dont le type n'est
 *   pas confirmé, c'est-à-dire de toute suggestion d'après le texte (classement-pieces-ged.ts). Il n'a AUCUNE référence
 *   GED (referenceDuDocument rend null) : la pièce ne couvre aucune pièce obligatoire, elle la rend seulement « à
 *   vérifier » (pieces-obligatoires-ged.ts) ;
 * - liens métier marqués `DEDUIT` au-delà des types cités par la tranche 43 § 19 (`GESTEAM`) ;
 * - familles de diagnostic : seules les correspondances évidentes de la catégorie Base.
 * 🔴 Non établi :
 * - « Procès-Verbal de prise de décisions par l'AJ » (tranche 18) : absent des tranches 22 et 43. Question pour
 *   Hugo : « Dans quelle catégorie Gestéam est rangé le type "Procès-Verbal de prise de décisions par l'AJ" ? » ;
 * - DPE, ascenseur, surface habitable, DTG : aucune des huit familles de la fiche immeuble ne leur correspond
 *   évidemment (« Technique, professionnel » ? « Juridique » ?) : null.
 */

export interface ReferenceTypeDocument {
  categorie: CategorieDocument
  type: string
}

/**
 * `referentiel` : type relevé (générique ou propre) ; `categorie_non_relevee` : catégorie dont Gestéam n'a pas été
 * relevé, type libre accepté ; `type_hors_releve` : catégorie relevée en partie (Copropriétaire), type absent du relevé.
 */
export type ControleTypeDocument = 'referentiel' | 'categorie_non_relevee' | 'type_hors_releve'

export type ReferenceControlee = ReferenceTypeDocument & { controle: ControleTypeDocument }

/** Modèle de type attendu ; catégorie null = toute catégorie (types génériques, « Courrier contentieux »…). */
export interface ModeleTypeDocument {
  categorie: CategorieDocument | null
  type: string
}

/** Clé de comparaison : sans casse, accents, ponctuation, ni élision « d' » / « l' ». */
function cleLibelle(libelle: string): string {
  return normaliserTexteLibre(libelle).replace(/\b[dl] /g, '')
}

/** Deux libellés désignent le même type (comparaison de la GED). */
export const memeLibelle = (a: string, b: string): boolean => cleLibelle(a) === cleLibelle(b)

/** Libellé saisi, espaces réduits et rognés. */
export const rognerLibelle = (libelle: string): string => libelle.replace(/\s+/g, ' ').trim()

/** Catégorie du référentiel désignée par un libellé (casse, accents, élision tolérés) ; null si inconnue. */
export function categorieCanonique(categorie: string): CategorieDocument | null {
  const cle = cleLibelle(categorie)
  return CATEGORIES_DOCUMENT.find((c) => cleLibelle(c) === cle) ?? null
}

/** Types de la catégorie : les 7 génériques, puis ses types propres relevés. */
export function typesDeLaCategorie(categorie: CategorieDocument): string[] {
  return [...TYPES_GENERIQUES_DOCUMENT, ...TYPES_DOCUMENT_PAR_CATEGORIE[categorie].typesPropres]
}

type Resolution = { ok: true; ref: ReferenceControlee } | { ok: false; erreur: string }

const CONTROLE_HORS_RELEVE: Readonly<Partial<Record<ReleveCategorie, ControleTypeDocument>>> = {
  non_releve: 'categorie_non_relevee',
  partiel: 'type_hors_releve',
}

function resoudreReference(categorieSaisie: string, typeSaisi: string): Resolution {
  const categorie = categorieCanonique(categorieSaisie)
  if (!categorie) return { ok: false, erreur: `Catégorie de document inconnue : « ${categorieSaisie} ».` }
  const type = rognerLibelle(typeSaisi)
  if (!type) return { ok: false, erreur: `Type de document vide (catégorie « ${categorie} »).` }
  const canonique = typesDeLaCategorie(categorie).find((t) => memeLibelle(t, type))
  if (canonique) return { ok: true, ref: { categorie, type: canonique, controle: 'referentiel' } }
  const controle = CONTROLE_HORS_RELEVE[TYPES_DOCUMENT_PAR_CATEGORIE[categorie].releve]
  if (controle) return { ok: true, ref: { categorie, type, controle } }
  return { ok: false, erreur: `« ${type} » n'est pas un type de la catégorie « ${categorie} » (relevé Gestéam).` }
}

/**
 * Référence contrôlée : catégorie connue, type non vide ; dans une catégorie relevée, le type doit en faire partie
 * (libellé canonique rendu). Lève une erreur sinon.
 */
export function creerReferenceTypeDocument(categorie: string, type: string): ReferenceControlee {
  const resolution = resoudreReference(categorie, type)
  if (!resolution.ok) throw new Error(resolution.erreur)
  return resolution.ref
}

/** Modèles d'une catégorie (null = toute catégorie), raccourci des listes de pièces et de liens. */
export const modelesDe = (categorie: CategorieDocument | null, types: readonly string[]): ModeleTypeDocument[] =>
  types.map((type) => ({ categorie, type }))

/** La référence correspond au modèle (catégorie null = toute catégorie). */
export function correspondAuModele(ref: ReferenceTypeDocument, modele: ModeleTypeDocument): boolean {
  return (modele.categorie === null || modele.categorie === ref.categorie) && memeLibelle(modele.type, ref.type)
}

/** Références dont le libellé figure parmi les TYPES PROPRES d'une catégorie (ordre du menu). */
export function referencesDuLibelle(libelle: string): ReferenceTypeDocument[] {
  const references: ReferenceTypeDocument[] = []
  for (const categorie of CATEGORIES_DOCUMENT)
    for (const type of TYPES_DOCUMENT_PAR_CATEGORIE[categorie].typesPropres)
      if (memeLibelle(type, libelle)) references.push({ categorie, type })
  return references
}

/** Catégorie de document d'un type d'entreprise (TYPE_ENTREPRISE, casse et accents différents). 🔵 */
export function categorieDuTypeEntreprise(typeEntreprise: TypeEntreprise): CategorieDocument {
  const categorie = categorieCanonique(typeEntreprise)
  if (!categorie) throw new Error(`Type d'entreprise sans catégorie de document : « ${typeEntreprise} ».`)
  return categorie
}

/**
 * Catégorie et type d'un libellé de TYPE_DOCUMENT_JUDICIAIRE (tranche 18), s'il est le type propre d'UNE seule
 * catégorie ; null sinon (le PV de l'AJ, 🔴).
 */
export function correspondanceTypeJudiciaire(typeJudiciaire: TypeDocumentJudiciaire): ReferenceTypeDocument | null {
  const references = referencesDuLibelle(typeJudiciaire)
  return references.length === 1 ? references[0] : null
}

/** Numéro du groupe « Association » (tranche 40) d'un libellé ; null s'il n'y figure pas. */
export function groupeAssociation(libelle: string): number | null {
  return GROUPES_ASSOCIATION.find((g) => g.elements.some((e) => memeLibelle(e, libelle)))?.numero ?? null
}

const FAMILLE_PAR_TYPE_BASE: readonly [string, FamilleDiagnostic][] = [
  ['Diagnostic amiante partie commune', 'amiante_pc'],
  ['Diagnostic amiante partie privative', 'amiante_pp'],
  ['Diagnostic termites', 'termites'],
  ['Diagnostic plomb (CREP)', 'plomb'],
  ["Diagnostic plomb dans l'eau", 'plomb_eau'],
  ['Autres risques sanitaires', 'risques_sanitaires'],
]

/** Famille de diagnostic de la fiche immeuble (FAMILLES_DIAGNOSTIC) d'un type de la catégorie Base ; null sinon. */
export function familleDiagnosticDuType(ref: ReferenceTypeDocument): FamilleDiagnostic | null {
  if (ref.categorie !== 'Base') return null
  return FAMILLE_PAR_TYPE_BASE.find(([type]) => memeLibelle(type, ref.type))?.[1] ?? null
}

export type LienTypeDocument = 'mutation' | 'recouvrement' | 'obligation_immeuble' | 'employeur' | 'sinistre'

export interface LienModeles {
  lien: LienTypeDocument
  /** `GESTEAM` : types cités par la tranche 43 § 19 ; `DEDUIT` : rapprochement VitFix (🔵). */
  certitude: 'GESTEAM' | 'DEDUIT'
  modeles: readonly ModeleTypeDocument[]
}

const GARDIEN: CategorieDocument = "Gardien/Employé d'immeuble"
const EMPLOYEUR_CITES = ['Déclaration DSN', "Document unique d'évaluation des risques (DUERP)", 'Attestation de suivi médecine du travail']

/** Liens des types vers les dossiers métier (mutation → état daté, recouvrement → contentieux, péril → obligations). */
export const LIENS_TYPES_DOCUMENT: readonly LienModeles[] = [
  {
    lien: 'mutation',
    certitude: 'GESTEAM',
    modeles: modelesDe('Étude notariale', [
      'Demande pré-état daté / état daté',
      'Avis de mutation art. 20',
      'Certificat article 20-2',
      'Procuration main-levée hypothèque',
    ]),
  },
  {
    lien: 'mutation',
    certitude: 'DEDUIT',
    modeles: [
      ...modelesDe('Copropriétaire', ['État daté', 'État daté mutation', 'Notification de vente']),
      ...modelesDe('Étude notariale', ['Notification de vente', 'Attestation de vente']),
      ...modelesDe("Cabinet d'avocat", ['Avis de mutation art. 20', 'Notification de vente article 6']),
      ...modelesDe('Huissier de justice', ["Opposition article 20 (acte d'huissier)"]),
      ...modelesDe('Base', ['Devis pré-état daté']),
    ],
  },
  {
    lien: 'recouvrement',
    certitude: 'GESTEAM',
    modeles: modelesDe('Copropriétaire', [
      'Mise en demeure',
      "Protocole d'accord de recouvrement",
      "Protocole d'apurement signé",
      'Requête injonction de payer',
    ]),
  },
  {
    lien: 'recouvrement',
    certitude: 'DEDUIT',
    modeles: [
      ...modelesDe('Base', ['Requête en injonction de payer', 'Injonction de payer — scan des pièces']),
      ...modelesDe('Huissier de justice', ['Commandement de payer (huissier)', "Opposition article 20 (acte d'huissier)"]),
      ...modelesDe("Cabinet d'avocat", ['Commandement de saisie']),
      ...modelesDe('Interne', ['Relance mise en demeure', 'Police charges impayées']),
    ],
  },
  { lien: 'obligation_immeuble', certitude: 'GESTEAM', modeles: modelesDe('Mairie', ['Arrêté de péril', 'Injonction de travaux']) },
  { lien: 'obligation_immeuble', certitude: 'DEDUIT', modeles: modelesDe('Base', ["Déclaration d'insalubrité"]) },
  { lien: 'employeur', certitude: 'GESTEAM', modeles: modelesDe(GARDIEN, EMPLOYEUR_CITES) },
  {
    lien: 'employeur',
    certitude: 'DEDUIT',
    modeles: modelesDe(
      GARDIEN,
      TYPES_DOCUMENT_PAR_CATEGORIE[GARDIEN].typesPropres.filter((t) => !EMPLOYEUR_CITES.includes(t)),
    ),
  },
  {
    lien: 'sinistre',
    certitude: 'DEDUIT',
    modeles: [
      ...modelesDe("Expert d'assurance", ["Compte rendu d'expertise", 'Convocation expertise', 'État des pertes']),
      ...modelesDe("Compagnie d'assurance", ['Déclaration de sinistre', "Compte rendu d'expertise"]),
      ...modelesDe('Copropriétaire', ['Déclaration de sinistre', 'Accusé réception de sinistre']),
    ],
  },
]

/** Liens métier d'un type de document, sans doublon, dans l'ordre de LIENS_TYPES_DOCUMENT. */
export function liensDuTypeDocument(ref: ReferenceTypeDocument): LienTypeDocument[] {
  const liens = LIENS_TYPES_DOCUMENT.filter((l) => l.modeles.some((m) => correspondAuModele(ref, m))).map((l) => l.lien)
  return [...new Set(liens)]
}

const DOSSIER_PAR_LIEN: Readonly<Record<LienTypeDocument, Dossier | null>> = {
  mutation: 'Mutation',
  recouvrement: 'Contentieux',
  sinistre: 'Sinistre',
  obligation_immeuble: null,
  employeur: null,
}

/** Valeur du référentiel DOSSIER (tranche 40) où ranger un document lié ; null quand aucune ne correspond. */
export const dossierDuLien = (lien: LienTypeDocument): Dossier | null => DOSSIER_PAR_LIEN[lien]

/** Préfixe du code GED dans DocumentLocal.type. */
export const CODE_GED_PREFIXE = 'ged:'
/** Préfixe du code « à confirmer » : types candidats, aucun type retenu. */
export const CODE_A_CONFIRMER_PREFIXE = 'ged-a-confirmer:'
const SEPARATEUR_CODE = '|'
const SEPARATEUR_CANDIDATS = ';'
const ENTITE_JOURNAL_REPRISE = 'reprise'
const PREFIXE_RETRAIT_REPRISE = 'retrait:'
const ORDONNANCE_SOURCE_MANDAT: ReferenceTypeDocument = { categorie: 'Tribunal', type: 'Ordonnance de désignation' }

/**
 * Code à ranger dans DocumentLocal.type. Refusé sous l'entité « reprise » : le journal de reprise compte chacun de ses
 * documents comme une pièce reçue.
 */
export function codeTypeDocument(ref: ReferenceTypeDocument, entiteType: string): string {
  if (entiteType === ENTITE_JOURNAL_REPRISE)
    throw new Error("Aucun type GED sous l'entité « reprise » : elle porte le journal des pièces de reprise.")
  const canonique = creerReferenceTypeDocument(ref.categorie, ref.type)
  return `${CODE_GED_PREFIXE}${canonique.categorie}${SEPARATEUR_CODE}${canonique.type}`
}

/**
 * Code « à confirmer » d'une pièce dont le type n'est pas confirmé : ses types candidats, dans l'ordre. Mêmes refus que
 * codeTypeDocument (entité « reprise », type hors référentiel) ; au moins un candidat.
 */
export function codeTypesAConfirmer(candidats: readonly ReferenceTypeDocument[], entiteType: string): string {
  if (candidats.length === 0) throw new Error('Code « à confirmer » sans type candidat.')
  const codes = candidats.map((ref) => codeTypeDocument(ref, entiteType).slice(CODE_GED_PREFIXE.length))
  const ambigu = codes.find((code) => code.includes(SEPARATEUR_CANDIDATS))
  if (ambigu) throw new Error(`Type candidat contenant « ${SEPARATEUR_CANDIDATS} » : « ${ambigu} ».`)
  return `${CODE_A_CONFIRMER_PREFIXE}${codes.join(SEPARATEUR_CANDIDATS)}`
}

export type LectureTypeDocument =
  | { nature: 'ged'; ref: ReferenceTypeDocument }
  | { nature: 'a_confirmer'; candidats: ReferenceTypeDocument[] }
  | { nature: 'ordonnance_source_mandat'; ref: ReferenceTypeDocument }
  | { nature: 'journal_reprise'; cle: string; retrait: boolean }
  | { nature: 'libre'; libelle: string }

function lireCodeGed(type: string): ReferenceTypeDocument | null {
  if (!type.startsWith(CODE_GED_PREFIXE)) return null
  const corps = type.slice(CODE_GED_PREFIXE.length)
  const separateur = corps.indexOf(SEPARATEUR_CODE)
  if (separateur < 0) return null
  const resolution = resoudreReference(corps.slice(0, separateur), corps.slice(separateur + 1))
  return resolution.ok ? { categorie: resolution.ref.categorie, type: resolution.ref.type } : null
}

/** Candidats d'un code « à confirmer » ; null si ce n'en est pas un ou qu'un candidat est illisible. */
function lireCodeAConfirmer(type: string): ReferenceTypeDocument[] | null {
  if (!type.startsWith(CODE_A_CONFIRMER_PREFIXE)) return null
  const candidats = type
    .slice(CODE_A_CONFIRMER_PREFIXE.length)
    .split(SEPARATEUR_CANDIDATS)
    .map((code) => lireCodeGed(`${CODE_GED_PREFIXE}${code}`))
  return candidats.every((ref) => ref !== null) ? candidats : null
}

/**
 * Lecture de DocumentLocal.type : code GED, code « à confirmer », valeurs héritées (ordonnance d'un mandat, journal de
 * reprise) ou libellé libre.
 */
export function lireTypeDocumentLocal(document: { entiteType: string; type: string }): LectureTypeDocument {
  if (document.entiteType === ENTITE_JOURNAL_REPRISE) {
    const retrait = document.type.startsWith(PREFIXE_RETRAIT_REPRISE)
    return { nature: 'journal_reprise', cle: retrait ? document.type.slice(PREFIXE_RETRAIT_REPRISE.length) : document.type, retrait }
  }
  const ref = lireCodeGed(document.type)
  if (ref) return { nature: 'ged', ref }
  const candidats = lireCodeAConfirmer(document.type)
  if (candidats) return { nature: 'a_confirmer', candidats }
  if (document.entiteType === 'mandat' && document.type === 'ordonnance')
    return { nature: 'ordonnance_source_mandat', ref: { ...ORDONNANCE_SOURCE_MANDAT } }
  return { nature: 'libre', libelle: document.type }
}

/** Types candidats d'un document « à confirmer » ; vide pour tout autre document. Aucun n'est une référence GED. */
export function candidatsDuDocument(document: { entiteType: string; type: string }): ReferenceTypeDocument[] {
  const lecture = lireTypeDocumentLocal(document)
  return lecture.nature === 'a_confirmer' ? lecture.candidats : []
}

/**
 * Référence GED d'un document (code GED ou ordonnance source d'un mandat) ; null pour un libellé libre, la reprise ou un
 * document « à confirmer ».
 */
export function referenceDuDocument(document: { entiteType: string; type: string }): ReferenceTypeDocument | null {
  const lecture = lireTypeDocumentLocal(document)
  return lecture.nature === 'ged' || lecture.nature === 'ordonnance_source_mandat' ? lecture.ref : null
}
