import { estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  empreinteReleve,
  type DejaImporte,
  type EmpreinteMouvement,
  type EmpreinteReleve,
} from '@/lib/administrateur-judiciaire/domain/import/doublons-releves'
import type { LigneReleve } from '@/lib/administrateur-judiciaire/domain/import/releve-bancaire'
import type { FormatReleveStructure, MouvementReleve, ReleveCompte } from '@/lib/administrateur-judiciaire/domain/import/releve-compte'

/**
 * Relevés importés gardés (décision du 26/11/2026 du référent métier, PR 799) : ce qui est gardé d'un relevé structuré
 * (CFONB 120, camt.053) importé sur un compte bancaire et de chacun de ses mouvements, et ce qui en est relu. Fonctions
 * pures, montants en UNITÉS MINEURES ENTIÈRES de la devise du relevé (les centimes pour l'euro) ; l'écriture est dans
 * db/releves-importes.ts (table locale « relevesImportes », base en version 5).
 * - Point 10 B, « une table des relevés importés » : l'empreinte du relevé (doublons-releves.ts : compte, devise,
 *   identifiant, numéro de séquence, période, soldes d'ouverture et de clôture, totaux), son compte bancaire, sa
 *   copropriété, son format, son nombre de mouvements et sa date d'import. Relue à l'import suivant, elle fait
 *   reconnaître le relevé (dedoublonnerRelevesStructures), qui n'est alors plus compté deux fois.
 * - Point 11 B, « garder les informations du relevé » : sur chaque ligne importée, tout ce que le lecteur rend du
 *   mouvement en plus de la date, du libellé et du montant de la ligne (référence de la banque, date de valeur, payeur,
 *   bénéficiaire, référence de bout en bout, numéro d'écriture, code d'opération, motif de rejet, contre-passation,
 *   enregistrements complémentaires CFONB), et le relevé dont elle vient. Rien n'est choisi ni résumé : ce qui était
 *   perdu à l'enregistrement est gardé tel que lu.
 * - Point 3 C, « reprendre le solde banque du relevé » : le solde de clôture du dernier relevé importé du compte à la
 *   date d'un arrêté est proposé comme solde banque (soldeBanquePropose) ; la saisie à la main reste possible.
 * Le CSV n'a ni identifiant de relevé, ni solde, ni référence : rien n'en est gardé ici, son dédoublonnage reste celui de
 * releve-bancaire.ts.
 * 🔵 Choix déduits, à valider : « dernier relevé à la date » = le relevé clos au plus tard ce jour-là, à la date de
 * clôture la plus récente ; s'il est clos avant la date de l'arrêté, des mouvements ont pu passer depuis : le solde
 * reste proposé, et la réserve est dite (`anterieur`). Deux relevés clos le même jour : le dernier enregistré.
 */

/** Ce que le lecteur rend d'un mouvement en plus de la ligne (date, libellé, montant). */
export type InformationsMouvement = Omit<MouvementReleve, keyof LigneReleve>

/** Informations du mouvement gardées sur la ligne importée, avec le relevé gardé dont elle vient. */
export interface OrigineReleve extends InformationsMouvement {
  /** Identifiant du relevé gardé (table « relevesImportes »). */
  releveId: string
}

/** Relevé importé gardé : son empreinte, où et quand il a été importé. */
export interface ReleveImporte extends EmpreinteReleve {
  id: string
  /** Syndicat propriétaire du compte (D1). */
  coproprieteId: string
  /** Compte bancaire sur lequel le relevé a été importé. */
  banqueId: string
  format: FormatReleveStructure
  /** Rang du relevé dans son fichier, à partir de 1. */
  rang: number
  decimales: number
  /** Mouvements du relevé, et ceux repris à l'import (les autres : écartés comme déjà importés d'un autre relevé). */
  nombreMouvements: number
  nombreMouvementsRepris: number
  /** Jour de l'import (AAAA-MM-JJ, jour courant de l'application). */
  dateImport: string
}

/** Relevé retenu à l'analyse, avec ceux de ses mouvements qui sont repris (lignes à écrire). */
export interface ReleveRepris {
  releve: ReleveCompte
  repris: readonly MouvementReleve[]
}

export interface ContexteImport {
  id: string
  coproprieteId: string
  banqueId: string
  dateImport: string
}

/** Relevé à garder pour un relevé repris à l'import. */
export function releveImporte({ releve, repris }: ReleveRepris, contexte: ContexteImport): ReleveImporte {
  return {
    ...contexte,
    format: releve.format,
    rang: releve.rang,
    decimales: releve.decimales,
    nombreMouvements: releve.mouvements.length,
    nombreMouvementsRepris: repris.length,
    ...empreinteReleve(releve),
  }
}

/** Informations à garder sur la ligne écrite pour ce mouvement. */
export function origineDuMouvement(releveId: string, mouvement: MouvementReleve): OrigineReleve {
  // La date, le libellé et le montant sont ceux de la ligne écrite : ils ne sont pas gardés une seconde fois.
  const { date: _date, libelle: _libelle, montant: _montant, ...informations } = mouvement
  return { releveId, ...informations }
}

/** Ligne de banque déjà enregistrée : sa date (AAAA-MM-JJ) et, si elle vient d'un relevé gardé, son origine. */
export interface LigneImportee {
  date: string
  releve?: OrigineReleve | null
}

/**
 * Ce qui a déjà été importé, relu de ce qui est gardé : les relevés gardés (rendus tels quels, pour que l'appelant les
 * retrouve) et les mouvements des lignes qui en viennent. Une ligne sans origine (CSV, import antérieur à la table) ou
 * dont le relevé n'est pas parmi les relevés reçus ne donne aucune empreinte : rien n'est inventé pour elle.
 */
export function dejaImporteSurCompte<R extends ReleveImporte>(
  releves: readonly R[],
  lignes: readonly LigneImportee[],
): DejaImporte & { releves: readonly R[] } {
  const parId = new Map(releves.map((releve) => [releve.id, releve]))
  const mouvements: EmpreinteMouvement[] = []
  for (const ligne of lignes) {
    const releve = ligne.releve ? parId.get(ligne.releve.releveId) : undefined
    if (!ligne.releve || !releve) continue
    mouvements.push({
      compte: releve.compte,
      devise: releve.devise,
      date: ligne.date,
      montantMineur: ligne.releve.montantMineur,
      referenceBanque: ligne.releve.referenceBanque,
      numeroEcriture: ligne.releve.numeroEcriture,
    })
  }
  return { releves, mouvements }
}

/** Devise et décimales de la comptabilité : seuls ces relevés donnent un solde en centimes d'euro. */
const DEVISE_COMPTABLE = 'EUR'
const DECIMALES_COMPTABLES = 2

/**
 * Dernier relevé importé du compte à une date (AAAA-MM-JJ, ce jour compris) : clos au plus tard ce jour-là, à la date de
 * clôture la plus récente ; à dates égales, le dernier de la liste (ordre d'enregistrement de la base). Null sans relevé,
 * ou si la date est illisible. Un relevé d'une autre devise, à la date ou au solde de clôture illisibles, est ignoré.
 */
export function dernierReleveAu<R extends ReleveImporte>(releves: readonly R[], banqueId: string, dateIso: string): R | null {
  if (!estDateIsoValide(dateIso)) return null
  let dernier: R | null = null
  for (const releve of releves) {
    if (releve.banqueId !== banqueId || releve.devise !== DEVISE_COMPTABLE || releve.decimales !== DECIMALES_COMPTABLES) continue
    if (!estDateIsoValide(releve.dateCloture) || !Number.isSafeInteger(releve.soldeClotureMineur)) continue
    if (releve.dateCloture > dateIso) continue
    if (dernier === null || releve.dateCloture >= dernier.dateCloture) dernier = releve
  }
  return dernier
}

/** Solde banque proposé à l'ouverture d'un arrêté, et d'où il vient. */
export interface SoldeBanquePropose {
  /** Solde de clôture du relevé, en centimes entiers signés (négatif : découvert). */
  centimes: number
  /** Date de clôture du relevé (AAAA-MM-JJ) : la source dite à l'écran (« relevé du JJ/MM/AAAA »). */
  dateReleve: string
  /** Relevé clos avant la date de l'arrêté : des mouvements ont pu passer depuis, le solde est à vérifier. */
  anterieur: boolean
}

/** Solde banque proposé pour un arrêté du compte à cette date ; null : rien à proposer (voir dernierReleveAu). */
export function soldeBanquePropose(releves: readonly ReleveImporte[], banqueId: string, dateArrete: string): SoldeBanquePropose | null {
  const releve = dernierReleveAu(releves, banqueId, dateArrete)
  if (!releve) return null
  return { centimes: releve.soldeClotureMineur, dateReleve: releve.dateCloture, anterieur: releve.dateCloture < dateArrete }
}
