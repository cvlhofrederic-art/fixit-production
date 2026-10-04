import './fuseau-paris'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as calendrierReglementaire from '@/lib/administrateur-judiciaire/domain/calendrier-reglementaire'
import * as coproprietes from '@/lib/administrateur-judiciaire/domain/coproprietes'
import * as delaisLegaux from '@/lib/administrateur-judiciaire/domain/delais-legaux'
import * as echeancesAffichage from '@/lib/administrateur-judiciaire/domain/echeances-affichage'
import * as echeancesMandat from '@/lib/administrateur-judiciaire/domain/echeances-mandat'
import * as fiche360 from '@/lib/administrateur-judiciaire/domain/fiche-360'
import * as fondements from '@/lib/administrateur-judiciaire/domain/fondements'
import * as geo from '@/lib/administrateur-judiciaire/domain/geo'
import * as honoraires from '@/lib/administrateur-judiciaire/domain/honoraires'
import * as csv from '@/lib/administrateur-judiciaire/domain/import/csv'
import * as listeCoproprietaires from '@/lib/administrateur-judiciaire/domain/import/liste-coproprietaires'
import * as releveBancaire from '@/lib/administrateur-judiciaire/domain/import/releve-bancaire'
import * as majoritesAg from '@/lib/administrateur-judiciaire/domain/majorites-ag'
import * as obligations from '@/lib/administrateur-judiciaire/domain/obligations'
import * as ordreMission from '@/lib/administrateur-judiciaire/domain/ordre-mission'
import * as planificationMandat from '@/lib/administrateur-judiciaire/domain/planification-mandat'
import * as priseDeFonction from '@/lib/administrateur-judiciaire/domain/prise-de-fonction'
import * as recherche from '@/lib/administrateur-judiciaire/domain/recherche'
import * as recouvrement from '@/lib/administrateur-judiciaire/domain/recouvrement'
import * as reprise from '@/lib/administrateur-judiciaire/domain/reprise'
import * as suiviDossiers from '@/lib/administrateur-judiciaire/domain/suivi-dossiers'
import * as selection from '@/lib/administrateur-judiciaire/selection'
import { rejouerOracle, type CasOracle } from './oracle'

/**
 * Non-régression « oracle » de la logique métier (délais légaux, fondements, imports, calculs, sélection) :
 * chaque résultat attendu a été produit par la maquette d'origine (proto/fixture.mjs) ; la fixture étendue couvre
 * les constantes, les résultats Set et les arguments RegExp (expression d'oracle équivalente au wrapper ci-dessous).
 * Les fixtures (plus de 2 Mo) sont lues à l'exécution plutôt qu'importées : un import JSON ferait inférer
 * leur type par tsc (plusieurs secondes de vérification de types à chaque passage).
 */
const lireFixture = (nom: string): CasOracle[] =>
  JSON.parse(readFileSync(join(__dirname, 'fixtures', nom), 'utf8')) as CasOracle[]

const modules: Record<string, Record<string, unknown>> = {
  'calendrier-reglementaire': calendrierReglementaire,
  coproprietes,
  'delais-legaux': delaisLegaux,
  'echeances-affichage': echeancesAffichage,
  'echeances-mandat': echeancesMandat,
  'fiche-360': fiche360,
  fondements,
  geo,
  'import/csv': csv,
  'import/liste-coproprietaires': listeCoproprietaires,
  'import/releve-bancaire': releveBancaire,
  'majorites-ag': majoritesAg,
  obligations,
  'ordre-mission': ordreMission,
  'planification-mandat': planificationMandat,
  'prise-de-fonction': priseDeFonction,
  recherche,
  recouvrement,
  suivi: suiviDossiers,
  selection,
}

/** Sérialisation de l'oracle (golden.mjs) : fonctions → « [fonction] », undefined → null. */
const commeOracle = (valeur: unknown): unknown =>
  JSON.parse(
    JSON.stringify(valeur, (_cle, v: unknown) => (typeof v === 'function' ? '[fonction]' : v === undefined ? null : v)) ?? 'null',
  )

/** Constantes portées, sous le nom employé par la fixture étendue (même valeur que la définition minifiée). */
const constantes: Record<string, unknown> = {
  EVENEMENTS_DEPART: delaisLegaux.EVENEMENTS_DEPART,
  NOTE_REMISE_ANCIEN_SYNDIC: delaisLegaux.NOTE_REMISE_ANCIEN_SYNDIC,
  REGLES_DELAIS_LEGAUX: delaisLegaux.REGLES_DELAIS_LEGAUX,
  BADGES_CERTITUDE_ECHEANCE: echeancesAffichage.BADGES_CERTITUDE_ECHEANCE,
  REGLES_NOTIFICATION_ORDONNANCE: echeancesMandat.REGLES_NOTIFICATION_ORDONNANCE,
  MESSAGES_ETAT_ECHEANCES: echeancesMandat.MESSAGES_ETAT_ECHEANCES,
  ECHEANCES_SUIVI_DOUBLONS_MOTEUR: fiche360.ECHEANCES_SUIVI_DOUBLONS_MOTEUR,
  FICHES_REGIMES: fondements.FICHES_REGIMES,
  LIBELLES_REGIMES: fondements.LIBELLES_REGIMES,
  TEXTES_REFERENCE: fondements.TEXTES_REFERENCE,
  FONDEMENTS_FORMULAIRE_COPROPRIETE: fondements.FONDEMENTS_FORMULAIRE_COPROPRIETE,
  FONDEMENTS_ASSISTANT_MANDAT: fondements.FONDEMENTS_ASSISTANT_MANDAT,
  ETAPES_TAXATION: honoraires.ETAPES_TAXATION,
  MAJORITES_AG: majoritesAg.MAJORITES_AG,
  OBLIGATIONS_SUIVI_REMPLACEES_PAR_MOTEUR: obligations.OBLIGATIONS_SUIVI_REMPLACEES_PAR_MOTEUR,
  LIBELLES_SOURCE_OBLIGATION: obligations.LIBELLES_SOURCE_OBLIGATION,
  SERVICE_RESPONSABLE_PAR_REGLE: planificationMandat.SERVICE_RESPONSABLE_PAR_REGLE,
  ACTES_PRE_REDIGES_RECHERCHE: recherche.ACTES_PRE_REDIGES_RECHERCHE,
  ORDRE_TYPES_RECHERCHE: recherche.ORDRE_TYPES_RECHERCHE,
  ETAPES_RECOUVREMENT: recouvrement.ETAPES_RECOUVREMENT,
  PARCOURS_RECOUVREMENT_DEBITEUR: recouvrement.PARCOURS_RECOUVREMENT_DEBITEUR,
  PIECES_REPRISE: reprise.PIECES_REPRISE,
  REGLE_MOTEUR_PAR_DELAI_PIECE: reprise.REGLE_MOTEUR_PAR_DELAI_PIECE,
  COPRO_VIDE: coproprietes.COPRO_VIDE,
}

/** Ordre des clés, comme l'expression d'oracle « cles:… » (tableau : clés de chaque élément objet, sinon son type). */
const ordreDesCles = (valeur: unknown): unknown =>
  Array.isArray(valeur)
    ? valeur.map((element: unknown) => (element && typeof element === 'object' ? Object.keys(element) : typeof element))
    : Object.keys(valeur as object)

const wrappersEtendus: Record<string, unknown> = {
  ...Object.fromEntries(
    Object.entries(constantes).flatMap(([nom, valeur]) => [
      [`constante:${nom}`, () => commeOracle(valeur)],
      [`cles:${nom}`, () => ordreDesCles(valeur)],
    ]),
  ),
  'liste:MOTS_IGNORES_RAPPROCHEMENT': () => [...releveBancaire.MOTS_IGNORES_RAPPROCHEMENT],
  'getTime:DATE_REFERENCE_SUIVI_DOSSIERS': () => suiviDossiers.DATE_REFERENCE_SUIVI_DOSSIERS.getTime(),
  'regex:trouverColonne': (colonnes: string[], ...motifs: string[]) =>
    csv.trouverColonne(colonnes, ...motifs.map((motif) => new RegExp(motif))),
  'liste:piecesRepriseRecues': (documents: reprise.DocumentPieceReprise[], coproprieteId: string) => [
    ...reprise.piecesRepriseRecues(documents, coproprieteId),
  ],
  'selection:choisirCopro': (code: string, defaut: string) => {
    selection.useSelectionDossier.getState().choisirCopro(code)
    const resultat = selection.codeCoproSelectionne(defaut)
    selection.useSelectionDossier.getState().choisirCopro(null)
    return resultat
  },
  'selection:etat': (code: string, coproprietaireId: string) => {
    const etat = selection.useSelectionDossier.getState()
    etat.choisirCopro(code)
    etat.choisirPersonne(coproprietaireId)
    const apres = selection.useSelectionDossier.getState()
    const resultat = { code: apres.code, coproprietaireId: apres.coproprietaireId, cles: Object.keys(apres) }
    etat.choisirCopro(null)
    etat.choisirPersonne(null)
    return resultat
  },
}

const cas = lireFixture('logique-metier.json')
const casEtendus = lireFixture('logique-metier-ext.json')

describe('logique métier — conformité à la maquette d’origine', () => {
  for (const [nom, module] of Object.entries(modules)) {
    const casDuModule = cas.filter((c) => typeof module[c.fn] === 'function')
    if (casDuModule.length) describe(nom, () => rejouerOracle(module, casDuModule))
  }

  it('chaque cas de la fixture vise une fonction portée', () => {
    const orphelins = cas.filter((c) => !Object.values(modules).some((module) => typeof module[c.fn] === 'function'))
    expect(orphelins.map((c) => c.id)).toEqual([])
  })

  describe('constantes, résultats Set et arguments RegExp', () => rejouerOracle(wrappersEtendus, casEtendus))
})
