import { lireReleveCamt053 } from '@/lib/administrateur-judiciaire/domain/import/releve-camt'
import { lireReleveCfonb120 } from '@/lib/administrateur-judiciaire/domain/import/releve-cfonb'
import { parserReleveBancaire, type LigneReleve } from '@/lib/administrateur-judiciaire/domain/import/releve-bancaire'
import {
  compteCorrespond,
  designationReleve,
  type ReleveCompte,
  type ResultatLectureReleves,
} from '@/lib/administrateur-judiciaire/domain/import/releve-compte'

/**
 * Détection du format d'un relevé bancaire à partir de son contenu (CSV, CFONB 120, camt.053) et lecture commune : rend
 * les LigneReleve de l'import existant (releve-bancaire.ts), plus les relevés contrôlés pour les formats structurés.
 * Fonctions pures, sans écran : l'écran de trésorerie lit toujours le CSV seul (branchement à valider, voir le mémo).
 *
 * Détection 🔵 (déduite des formats, voir releve-cfonb.ts et releve-camt.ts) :
 * - camt.053 : premier caractère utile « < » et déclaration d'un espace de noms
 *   urn:iso:std:iso:20022:tech:xsd:camt.053.001.NN dans les premiers caractères ;
 * - CFONB 120 : premier enregistrement « 01 » + code banque (5 chiffres) + 4 caractères + code guichet (5 chiffres) + code
 *   devise (3 lettres) + nombre de décimales (1 chiffre), d'au plus 120 caractères (ou fichier sans séparateur de ligne) ;
 * - CSV : première ligne portant un séparateur « ; », tabulation, « , » ou « | » ;
 * - sinon : inconnu.
 *
 * Lecture commune 🔵 : un relevé structuré dans une autre devise que celle de la comptabilité (EUR par défaut) est refusé,
 * les LigneReleve étant des euros décimaux ; si des comptes attendus sont donnés (IBAN des comptes du syndicat), un relevé
 * d'un autre compte est refusé (compteCorrespond : IBAN, ou RIB comparé à la partie nationale d'un IBAN FR / MC). Les
 * erreurs ne bloquent pas les autres relevés : c'est à l'appelant de décider s'il importe un fichier partiellement refusé
 * (🔴 à faire valider par Frédéric).
 */

export type FormatReleve = 'csv' | 'cfonb120' | 'camt053' | 'inconnu'

export interface LectureReleve {
  format: FormatReleve
  /** Lignes à importer : lignes CSV lues, ou mouvements des relevés retenus dans l'ordre du fichier. */
  lignes: LigneReleve[]
  /** Relevés contrôlés (CFONB 120, camt.053) ; vide pour le CSV, qui ne porte pas de solde. */
  releves: ReleveCompte[]
  erreurs: string[]
  avertissements: string[]
}

export interface OptionsLectureReleve {
  /** Devise de la comptabilité (EUR par défaut). */
  deviseComptable?: string
  /** IBAN des comptes dont les relevés sont attendus ; absent ou vide : pas de contrôle. */
  comptesAttendus?: readonly string[]
}

const ESPACE_CAMT053 = /xmlns(?::[\w.-]+)?\s*=\s*["']urn:iso:std:iso:20022:tech:xsd:camt\.053\.001\.\d{2}["']/
const PREMIER_ENREGISTREMENT_CFONB = /^01\d{5}.{4}\d{5}[A-Z]{3}\d/
/** Longueur de tête lue pour trouver la déclaration d'espace de noms (après déclaration XML et commentaires). */
const TETE_XML = 4096

/** Format d'un relevé d'après son contenu. */
export function detecterFormatReleve(texte: string): FormatReleve {
  const propre = texte.replace(/^﻿/, '').trimStart()
  if (propre === '') return 'inconnu'
  if (propre.startsWith('<')) return ESPACE_CAMT053.test(propre.slice(0, TETE_XML)) ? 'camt053' : 'inconnu'
  const finLigne = propre.search(/[\r\n]/),
    premiereLigne = finLigne < 0 ? propre : propre.slice(0, finLigne)
  if (PREMIER_ENREGISTREMENT_CFONB.test(premiereLigne) && (premiereLigne.length <= 120 || finLigne < 0)) return 'cfonb120'
  return /[;\t,|]/.test(premiereLigne) ? 'csv' : 'inconnu'
}

/** Refus des relevés d'une autre devise ou d'un compte non attendu ; les autres sont gardés. */
function filtrerReleves(resultat: ResultatLectureReleves, { deviseComptable = 'EUR', comptesAttendus = [] }: OptionsLectureReleve): ResultatLectureReleves {
  const releves: ReleveCompte[] = [],
    erreurs = [...resultat.erreurs]
  for (const releve of resultat.releves) {
    const designation = designationReleve(releve.rang, releve.compte, releve.dateOuverture, releve.dateCloture)
    if (releve.devise !== deviseComptable)
      erreurs.push(`${designation} refusé : relevé en ${releve.devise}, la comptabilité est tenue en ${deviseComptable}.`)
    else if (comptesAttendus.length > 0 && !comptesAttendus.some((iban) => compteCorrespond(releve.compte, iban)))
      erreurs.push(`${designation} refusé : compte absent des comptes attendus.`)
    else releves.push(releve)
  }
  return { releves, erreurs, avertissements: resultat.avertissements }
}

/** Lit un relevé de n'importe quel format reconnu ; les lignes rendues sont celles que l'import existant attend. */
export function lireReleve(texte: string, options: OptionsLectureReleve = {}): LectureReleve {
  const format = detecterFormatReleve(texte)
  if (format === 'csv') {
    const { lignes, erreurs } = parserReleveBancaire(texte)
    return { format, lignes, releves: [], erreurs, avertissements: [] }
  }
  if (format === 'inconnu')
    return { format, lignes: [], releves: [], erreurs: ['Format de relevé non reconnu : ni CSV, ni CFONB 120, ni camt.053.'], avertissements: [] }
  const { releves, erreurs, avertissements } = filtrerReleves(format === 'cfonb120' ? lireReleveCfonb120(texte) : lireReleveCamt053(texte), options)
  return { format, lignes: releves.flatMap((releve) => releve.mouvements), releves, erreurs, avertissements }
}
