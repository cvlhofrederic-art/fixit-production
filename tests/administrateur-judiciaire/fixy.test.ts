import './fuseau-paris'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Fiche360Copropriete, Fiche360Personne } from '@/lib/administrateur-judiciaire/domain/fiche-360'
import * as agents from '@/lib/administrateur-judiciaire/domain/fixy/agents'
import * as courriel from '@/lib/administrateur-judiciaire/domain/fixy/courriel'
import * as intentions from '@/lib/administrateur-judiciaire/domain/fixy/intentions'
import * as lectureOrdonnance from '@/lib/administrateur-judiciaire/domain/fixy/lecture-ordonnance'
import * as reponses from '@/lib/administrateur-judiciaire/domain/fixy/reponses'
import * as veille from '@/lib/administrateur-judiciaire/domain/fixy/veille'
import type { EntreeIndexRecherche } from '@/lib/administrateur-judiciaire/domain/recherche'
import { rejouerOracle, type CasOracle } from './oracle'

/**
 * Non-régression « oracle » du moteur Fixy (veille, compréhension des demandes, réponses, courriels, ordonnances).
 * Chaque résultat attendu a été produit par la maquette d'origine (golden.mjs) ; la maquette fait foi.
 *
 * - fixtures/fixy-entrees.json : ENTRÉES réelles capturées dans la maquette (index de recherche Ob, fiches 360
 *   copropriété Xv et personne Qv, ordres de service Rv…) pour deux portefeuilles : « demo » (données de
 *   démonstration) et « etendu » (démo + copropriété de 250 lots sans budget, copropriété sans mandat, homonyme,
 *   personne sans lot). Dates encodées {"$date":[…]} (heure de Paris), undefined {"$undefined":true}.
 * - fixtures/fixy.json : cas et résultats attendus. Un argument {"$ref":"demo.index"} désigne une valeur des
 *   entrées, résolue ici comme côté oracle (copie par cas).
 * - Les fonctions qui reçoivent des fonctions (repondreDemandeFixy, analyserCourriel) sont appelées par une
 *   enveloppe qui reconstruit ficheCopro / fichePersonne depuis les fiches capturées ; l'expression d'oracle
 *   applique la même enveloppe à la fonction minifiée (Gb, Ub). demanderFixy = useFixy.demander (Vb puis Gb).
 * Les fixtures sont lues à l'exécution (pas d'import JSON : tsc inférerait le type de plus d'1 Mo de données).
 */
const lireJson = (nom: string): unknown => JSON.parse(readFileSync(join(__dirname, 'fixtures', nom), 'utf8'))

const entrees = lireJson('fixy-entrees.json')

function lireChemin(chemin: string): unknown {
  return chemin.split('.').reduce<unknown>((valeur, cle) => {
    if (valeur == null || !(cle in Object(valeur))) throw new Error(`$ref introuvable : ${chemin}`)
    return (valeur as Record<string, unknown>)[cle]
  }, entrees)
}

/** Remplace chaque {"$ref":"chemin"} par une copie de la valeur désignée dans les entrées capturées. */
function resoudreReferences(valeur: unknown): unknown {
  if (Array.isArray(valeur)) return valeur.map(resoudreReferences)
  if (valeur && typeof valeur === 'object') {
    const objet = valeur as Record<string, unknown>
    if (typeof objet.$ref === 'string') return resoudreReferences(lireChemin(objet.$ref))
    return Object.fromEntries(Object.entries(objet).map(([cle, v]) => [cle, resoudreReferences(v)]))
  }
  return valeur
}

const cas: CasOracle[] = (lireJson('fixy.json') as CasOracle[]).map((c) => ({
  ...c,
  args: resoudreReferences(c.args) as unknown[],
}))

/** DonneesFixy sans fonctions, telles que stockées dans la fixture. */
interface DonneesFixyJson {
  reference: string
  fichesCopro: Record<string, Fiche360Copropriete>
  fichesPersonne: Record<string, Fiche360Personne>
  copros: { code: string; nom: string }[]
  ordresDeService: reponses.OrdreDeServiceFixy[]
  impayes: veille.DossierImpayeFixy[]
}

const lirePropre = <T,>(table: Record<string, T>, cle: string): T | null =>
  Object.prototype.hasOwnProperty.call(table, cle) ? table[cle] : null

/** Même enveloppe que l'expression d'oracle (ficheCopro / fichePersonne → null si inconnue, comme useFixy). */
const versDonneesFixy = (d: DonneesFixyJson): reponses.DonneesFixy => ({
  reference: d.reference,
  ficheCopro: (code) => lirePropre(d.fichesCopro, code),
  fichePersonne: (coproprietaireId) => lirePropre(d.fichesPersonne, coproprietaireId),
  copros: d.copros,
  ordresDeService: d.ordresDeService,
  impayes: d.impayes,
})

/** Nom du constructeur de l'erreur levée (les messages d'erreur de la maquette citent des variables minifiées). */
const nomErreur = (e: unknown): string =>
  e && typeof e === 'object' && 'constructor' in e ? (e.constructor as { name: string }).name : typeof e

/** RegExp → { regex, flags } (une RegExp se sérialise en {} dans l'oracle). */
const avecRegexLisibles = (valeur: unknown): unknown =>
  valeur instanceof RegExp
    ? { regex: valeur.source, flags: valeur.flags }
    : Array.isArray(valeur)
      ? valeur.map(avecRegexLisibles)
      : valeur && typeof valeur === 'object'
        ? Object.fromEntries(Object.entries(valeur).map(([cle, v]) => [cle, avecRegexLisibles(v)]))
        : valeur

/** Constantes portées, sous le nom employé par la fixture (même valeur que la définition minifiée). */
const constantes: Record<string, unknown> = {
  COULEUR_PILL_PAR_AGENT: agents.COULEUR_PILL_PAR_AGENT,
  EXEMPLES_DEMANDES_FIXY: agents.EXEMPLES_DEMANDES_FIXY,
  MOTIFS_SUJET_COURRIEL: courriel.MOTIFS_SUJET_COURRIEL,
  MOTIFS_ETAPE_RECOUVREMENT: intentions.MOTIFS_ETAPE_RECOUVREMENT,
  MOTIFS_ACTE_A_PREPARER: intentions.MOTIFS_ACTE_A_PREPARER,
  MOTIFS_ECRAN_NAVIGATION: intentions.MOTIFS_ECRAN_NAVIGATION,
  MOIS_EN_LETTRES: lectureOrdonnance.MOIS_EN_LETTRES,
  REPONSE_AIDE_FIXY: reponses.REPONSE_AIDE_FIXY,
}

const enveloppes: Record<string, unknown> = {
  ...Object.fromEntries(
    Object.entries(constantes).flatMap(([nom, valeur]) => [
      [`constante:${nom}`, () => avecRegexLisibles(valeur)],
      [`cles:${nom}`, () => Object.keys(valeur as object)],
    ]),
  ),
  'repondreDemandeFixy:donnees': (intention: intentions.IntentionFixy, d: DonneesFixyJson) =>
    reponses.repondreDemandeFixy(intention, versDonneesFixy(d)),
  'erreur:repondreDemandeFixy:donnees': (intention: intentions.IntentionFixy, d: DonneesFixyJson) => {
    try {
      reponses.repondreDemandeFixy(intention, versDonneesFixy(d))
      return '__PAS_D_ERREUR__'
    } catch (e) {
      return nomErreur(e)
    }
  },
  demanderFixy: (texte: string, index: EntreeIndexRecherche[], d: DonneesFixyJson) => {
    const intention = intentions.comprendreDemandeFixy(texte, index)
    try {
      return { intention, reponse: reponses.repondreDemandeFixy(intention, versDonneesFixy(d)) }
    } catch (e) {
      return { intention, erreur: nomErreur(e) }
    }
  },
  'analyserCourriel:fiches': (
    texte: string,
    index: EntreeIndexRecherche[],
    fiches: Record<string, courriel.FicheCoproCourriel>,
    referenceIso: string,
  ) => courriel.analyserCourriel(texte, index, (code) => lirePropre(fiches, code), referenceIso),
}

const modules: Record<string, Record<string, unknown>> = {
  agents,
  courriel,
  intentions,
  'lecture-ordonnance': lectureOrdonnance,
  reponses,
  veille,
  'enveloppes (constantes, fonctions reçues en argument)': enveloppes,
}

describe('moteur Fixy — conformité à la maquette d’origine', () => {
  for (const [nom, module] of Object.entries(modules)) {
    const casDuModule = cas.filter((c) => typeof module[c.fn] === 'function')
    if (casDuModule.length) describe(nom, () => rejouerOracle(module, casDuModule))
  }

  it('chaque cas de la fixture vise une fonction portée', () => {
    const orphelins = cas.filter((c) => !Object.values(modules).some((module) => typeof module[c.fn] === 'function'))
    expect(orphelins.map((c) => c.id)).toEqual([])
  })
})
