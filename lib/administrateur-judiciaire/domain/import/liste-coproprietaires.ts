import type { Tantiemes } from '@/lib/administrateur-judiciaire/domain/format'
import {
  decouperLigneCsv,
  detecterSeparateurCsv,
  parserMontant,
} from '@/lib/administrateur-judiciaire/domain/import/csv'
import { normaliserTexte } from '@/lib/administrateur-judiciaire/domain/texte'

/** Import d'une liste de copropriétaires (CSV avec en-tête : nom, lot, tantièmes, puis solde, téléphone, e-mail). */

/** Doublon exact de decouperLigneCsv dans la maquette. */
export const decouperLigneCsvListe = decouperLigneCsv

/** « 120/10000 » → 120/10000 ; « 120 » → 120/`denominateurParDefaut` (10 000) ; espaces ignorés ; sinon null. */
export function parserTantiemes(texte: string, denominateurParDefaut = 1e4): Tantiemes | null {
  const valeur = texte.replace(/\s/g, ''),
    fraction = /^(\d+)\/(\d+)$/.exec(valeur)
  return fraction
    ? {
        numerateur: Number(fraction[1]),
        denominateur: Number(fraction[2]),
      }
    : /^\d+$/.test(valeur)
      ? {
          numerateur: Number(valeur),
          denominateur: denominateurParDefaut,
        }
      : null
}

export interface LigneListeCoproprietaires {
  nom: string
  lot: string
  tantiemes: Tantiemes
  /** 0 si la colonne est absente ou la cellule vide. */
  solde: number
  tel: string
  mail: string
}

export interface ResultatListeCoproprietaires {
  lignes: LigneListeCoproprietaires[]
  erreurs: string[]
}

/**
 * Lit la liste (en-tête obligatoire, séparateur détecté sur l'en-tête). Une ligne sans nom ou sans lot,
 * aux tantièmes illisibles ou au solde illisible est écartée avec un message.
 */
export function parserListeCoproprietaires(texte: string, denominateurParDefaut = 1e4): ResultatListeCoproprietaires {
  const lignesTexte = texte
    .replace(/\r/g, '')
    .split('\n')
    .filter((ligne) => ligne.trim())
  if (lignesTexte.length < 2)
    return {
      lignes: [],
      erreurs: ['Liste vide ou sans ligne de données.'],
    }
  const separateur = detecterSeparateurCsv(lignesTexte[0]),
    entetes = decouperLigneCsvListe(lignesTexte[0], separateur).map((entete) => normaliserTexte(entete)),
    // Variante locale de trouverColonne : renvoie -1 (et non null) si aucune colonne ne correspond.
    indexColonne = (...motifs: RegExp[]): number => {
      for (const motif of motifs) {
        const index = entetes.findIndex((entete) => motif.test(entete))
        if (index >= 0) return index
      }
      return -1
    },
    colonneNom = indexColonne(/^NOM/, /COPROPRIETAIRE/, /PROPRIETAIRE/, /TITULAIRE/),
    colonneLot = indexColonne(/^LOT/, /^N.? ?LOT/),
    colonneTantiemes = indexColonne(/TANTIEME/, /MILLIEME/, /QUOTE/),
    colonneSolde = indexColonne(/SOLDE/, /BALANCE/, /IMPAYE/),
    colonneTel = indexColonne(/TEL/),
    colonneMail = indexColonne(/MAIL/, /COURRIEL/)
  if (colonneNom < 0 || colonneLot < 0 || colonneTantiemes < 0)
    return {
      lignes: [],
      erreurs: [
        `En-tête non reconnu : « ${lignesTexte[0]} ». Colonnes attendues : nom, lot, tantièmes (puis solde, téléphone, e-mail).`,
      ],
    }
  const lignes: LigneListeCoproprietaires[] = [],
    erreurs: string[] = []
  lignesTexte.slice(1).forEach((ligne, rang) => {
    const cellules = decouperLigneCsvListe(ligne, separateur),
      numeroLigne = rang + 2,
      nom = (cellules[colonneNom] || '').trim(),
      lot = (cellules[colonneLot] || '').trim(),
      tantiemes = parserTantiemes(cellules[colonneTantiemes] || '', denominateurParDefaut)
    if (!nom || !lot) {
      erreurs.push(`Ligne ${numeroLigne} : nom ou lot manquant.`)
      return
    }
    if (!tantiemes) {
      erreurs.push(`Ligne ${numeroLigne} : tantièmes illisibles « ${cellules[colonneTantiemes] || ''} ».`)
      return
    }
    const solde = colonneSolde >= 0 && cellules[colonneSolde] ? parserMontant(cellules[colonneSolde]) : 0
    if (solde == null) {
      erreurs.push(`Ligne ${numeroLigne} : solde illisible « ${cellules[colonneSolde]} ».`)
      return
    }
    lignes.push({
      nom,
      lot,
      tantiemes,
      solde,
      tel: colonneTel >= 0 ? (cellules[colonneTel] || '').trim() : '',
      mail: colonneMail >= 0 ? (cellules[colonneMail] || '').trim() : '',
    })
  })
  return {
    lignes,
    erreurs,
  }
}

export interface ControleListeCoproprietaires {
  sommeTantiemes: number
  denominateur: number
  /** Somme des tantièmes − dénominateur (0 si la répartition est complète). */
  ecartTantiemes: number
  totalDebiteur: number
  debiteurs: number
  /** Clés « NOM|LOT » normalisées présentes plusieurs fois. */
  doublons: string[]
}

/** Contrôles de cohérence avant import ; le dénominateur est celui de la première ligne (10 000 par défaut). */
export function controlerListeCoproprietaires(lignes: LigneListeCoproprietaires[]): ControleListeCoproprietaires {
  const denominateur = lignes[0]?.tantiemes.denominateur ?? 1e4,
    sommeTantiemes = lignes.reduce((total, ligne) => total + ligne.tantiemes.numerateur, 0),
    occurrences = new Map<string, number>(),
    doublons: string[] = []
  for (const ligne of lignes) {
    const cle = `${normaliserTexte(ligne.nom)}|${normaliserTexte(ligne.lot)}`
    occurrences.set(cle, (occurrences.get(cle) || 0) + 1)
  }
  for (const [cle, nombre] of occurrences) if (nombre > 1) doublons.push(cle)
  const debiteurs = lignes.filter((ligne) => ligne.solde < 0)
  return {
    sommeTantiemes,
    denominateur,
    ecartTantiemes: sommeTantiemes - denominateur,
    totalDebiteur: debiteurs.reduce((total, ligne) => total + ligne.solde, 0),
    debiteurs: debiteurs.length,
    doublons,
  }
}
