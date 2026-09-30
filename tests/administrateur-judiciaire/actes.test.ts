import './fuseau-paris'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as actesExpress from '@/lib/administrateur-judiciaire/domain/actes/actes-express'
import * as actesJuge from '@/lib/administrateur-judiciaire/domain/actes/actes-juge'
import * as courriersSuiviDossier from '@/lib/administrateur-judiciaire/domain/actes/courriers-suivi-dossier'
import * as dossierJuge from '@/lib/administrateur-judiciaire/domain/actes/dossier-juge'
import * as enteteCabinet from '@/lib/administrateur-judiciaire/domain/actes/entete-cabinet'
import { rejouerOracle, type CasOracle } from './oracle'

/**
 * Non-régression « oracle » des générateurs d'actes et courriers (en-tête du cabinet, actes express du cockpit,
 * actes au juge, proposition du document au juge, rapport et aide-mémoire d'audience, courriers des étapes de suivi).
 * Chaque résultat attendu a été produit par la maquette d'origine (proto/fixture.mjs) à partir d'entrées réelles
 * de la maquette : DEMO_COPROPRIETES, COPRO_VIDE, checklists de DEMO_DETAILS_DOSSIERS_SUIVI et fiches 360
 * construites par construireFiche360Copropriete dans la maquette (données de démonstration, variantes de régime,
 * de dates, de montants et de dossiers de recouvrement).
 * La fixture étendue couvre les constantes (valeur et ordre des clés), le générateur de chaque modèle du catalogue
 * des actes express et l'ordre des clés des résultats (expressions d'oracle équivalentes aux wrappers ci-dessous).
 * Les fixtures (plusieurs Mo) sont lues à l'exécution plutôt qu'importées, pour épargner l'inférence de type à tsc.
 */
const lireFixture = (nom: string): CasOracle[] =>
  JSON.parse(readFileSync(join(__dirname, 'fixtures', nom), 'utf8')) as CasOracle[]

const modules: Record<string, Record<string, unknown>> = {
  'entete-cabinet': enteteCabinet,
  'actes-express': actesExpress,
  'actes-juge': actesJuge,
  'courriers-suivi-dossier': courriersSuiviDossier,
  'dossier-juge': dossierJuge,
}
const toutesFonctions: Record<string, unknown> = Object.assign({}, ...Object.values(modules))

/** Sérialisation de l'oracle (golden.mjs) : fonctions → « [fonction] », undefined → null. */
const commeOracle = (valeur: unknown): unknown =>
  JSON.parse(
    JSON.stringify(valeur, (_cle, v: unknown) => (typeof v === 'function' ? '[fonction]' : v === undefined ? null : v)) ?? 'null',
  )

/** Structure d'une valeur (ordre des clés et types des feuilles), comme l'expression d'oracle « S ». */
const structure = (valeur: unknown): unknown =>
  Array.isArray(valeur)
    ? valeur.map(structure)
    : valeur && typeof valeur === 'object'
      ? Object.entries(valeur).map(([cle, v]) => [cle, structure(v)])
      : typeof valeur

const constantes: Record<string, unknown> = {
  TYPES_ACTES_JUGE: actesJuge.TYPES_ACTES_JUGE,
  LIBELLES_OBJECTIFS_ACTE_JUGE: actesJuge.LIBELLES_OBJECTIFS_ACTE_JUGE,
  MODELES_ACTES_EXPRESS: actesExpress.MODELES_ACTES_EXPRESS,
}

type Fonction = (...args: unknown[]) => unknown

const wrappersEtendus: Record<string, unknown> = {
  ...Object.fromEntries(
    Object.entries(constantes).flatMap(([nom, valeur]) => [
      [`constante:${nom}`, () => commeOracle(valeur)],
      [`structure:${nom}`, () => structure(valeur)],
    ]),
  ),
  'modele:acte': (cle: actesExpress.CleActeExpress, mandat: actesExpress.MandatActeExpress) =>
    actesExpress.MODELES_ACTES_EXPRESS[cle].fn(mandat),
  ...Object.fromEntries(
    Object.entries(toutesFonctions)
      .filter(([, f]) => typeof f === 'function')
      .map(([nom, f]) => [`structure:${nom}`, (...args: unknown[]) => structure((f as Fonction)(...args))]),
  ),
}

const cas = lireFixture('actes.json')
const casEtendus = lireFixture('actes-ext.json')

describe('générateurs d’actes et courriers — conformité à la maquette d’origine', () => {
  for (const [nom, module] of Object.entries(modules)) {
    const casDuModule = cas.filter((c) => typeof module[c.fn] === 'function')
    if (casDuModule.length) describe(nom, () => rejouerOracle(module, casDuModule))
  }

  it('chaque cas de la fixture vise une fonction portée', () => {
    const orphelins = cas.filter((c) => typeof toutesFonctions[c.fn] !== 'function')
    expect(orphelins.map((c) => c.id)).toEqual([])
  })

  it('chaque cas de la fixture étendue vise un wrapper', () => {
    const orphelins = casEtendus.filter((c) => typeof wrappersEtendus[c.fn] !== 'function')
    expect(orphelins.map((c) => c.id)).toEqual([])
  })

  describe('constantes, catalogue des actes express et ordre des clés', () => rejouerOracle(wrappersEtendus, casEtendus))
})
