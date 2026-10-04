import {
  decouperLigneCsv,
  detecterSeparateurCsv,
  parserDateReleve,
  parserMontant,
  trouverColonne,
} from '@/lib/administrateur-judiciaire/domain/import/csv'
import { normaliserTexte } from '@/lib/administrateur-judiciaire/domain/texte'

/** Import d'un relevé bancaire CSV, dédoublonnage et proposition d'imputation aux copropriétaires. */

/** Ligne de relevé lue : date ISO, libellé, montant (positif = encaissement). */
export interface LigneReleve {
  date: string
  libelle: string
  montant: number
}

/** Index des colonnes ; `montant` null → débit et crédit séparés. */
export interface ColonnesReleve {
  date: number
  libelle: number
  montant: number | null
  debit: number | null
  credit: number | null
}

export interface ResultatReleve {
  lignes: LigneReleve[]
  erreurs: string[]
  separateur: string
  colonnes: ColonnesReleve
}

/**
 * Lit un relevé. En-tête reconnu si une cellule contient 3 lettres et qu'aucune n'est une date. Sans en-tête :
 * 4 colonnes ou plus → date, libellé, débit, crédit ; sinon date, libellé, montant. Débit/crédit : montant =
 * crédit − |débit|, illisible si les deux cellules sont vides. Numéros de ligne à partir de 2 s'il y a un en-tête.
 */
export function parserReleveBancaire(texte: string): ResultatReleve {
  const lignesTexte = texte
      .replace(/\r/g, '')
      .split('\n')
      .map((ligne) => ligne.trimEnd())
      .filter((ligne) => ligne.trim().length > 0),
    resultatVide: ResultatReleve = {
      lignes: [],
      erreurs: [],
      separateur: ';',
      colonnes: {
        date: 0,
        libelle: 1,
        montant: 2,
        debit: null,
        credit: null,
      },
    }
  if (lignesTexte.length === 0)
    return {
      ...resultatVide,
      erreurs: ['Relevé vide.'],
    }
  const separateur = detecterSeparateurCsv(lignesTexte[0]),
    premiereLigne = decouperLigneCsv(lignesTexte[0], separateur),
    avecEntete =
      premiereLigne.some((cellule) => /[a-zA-Z]{3,}/.test(cellule)) &&
      !premiereLigne.some((cellule) => parserDateReleve(cellule))
  let colonnes = resultatVide.colonnes
  if (avecEntete) {
    const entetes = premiereLigne.map((cellule) => normaliserTexte(cellule)),
      colonneDate = trouverColonne(entetes, /^DATE$/, /DATE OP/, /DATE/),
      colonneLibelle = trouverColonne(entetes, /LIBELLE/, /LABEL/, /DESCRIPTION/, /INTITULE/, /OBJET/, /DETAIL/),
      colonneMontant = trouverColonne(entetes, /^MONTANT/, /AMOUNT/, /SOLDE MOUV/),
      colonneDebit = trouverColonne(entetes, /DEBIT/),
      colonneCredit = trouverColonne(entetes, /CREDIT/)
    if (
      colonneDate == null ||
      colonneLibelle == null ||
      (colonneMontant == null && (colonneDebit == null || colonneCredit == null))
    )
      return {
        ...resultatVide,
        separateur,
        erreurs: [
          `En-tête non reconnu : « ${premiereLigne.join(' | ')} ». Colonnes attendues : date, libellé, montant (ou débit et crédit).`,
        ],
      }
    colonnes = {
      date: colonneDate,
      libelle: colonneLibelle,
      montant: colonneMontant,
      debit: colonneDebit,
      credit: colonneCredit,
    }
  } else
    colonnes =
      premiereLigne.length >= 4
        ? {
            date: 0,
            libelle: 1,
            montant: null,
            debit: 2,
            credit: 3,
          }
        : {
            date: 0,
            libelle: 1,
            montant: 2,
            debit: null,
            credit: null,
          }
  const lignes: LigneReleve[] = [],
    erreurs: string[] = []
  ;(avecEntete ? lignesTexte.slice(1) : lignesTexte).forEach((ligne, rang) => {
    const numeroLigne = rang + (avecEntete ? 2 : 1),
      cellules = decouperLigneCsv(ligne, separateur),
      // Une colonne absente (null) se lit comme une cellule inexistante.
      cellule = (index: number | null): string | undefined => (index == null ? undefined : cellules[index]),
      date = parserDateReleve(cellules[colonnes.date] ?? '')
    if (!date) {
      erreurs.push(`Ligne ${numeroLigne} : date illisible « ${cellules[colonnes.date] ?? ''} ».`)
      return
    }
    const libelle = (cellules[colonnes.libelle] ?? '').replace(/\s+/g, ' ').trim()
    let montant: number | null = null
    if (colonnes.montant != null) montant = parserMontant(cellules[colonnes.montant] ?? '')
    else {
      const debit = parserMontant(cellule(colonnes.debit) ?? '') ?? 0,
        credit = parserMontant(cellule(colonnes.credit) ?? '') ?? 0
      montant = cellule(colonnes.debit) || cellule(colonnes.credit) ? credit - Math.abs(debit) : null
    }
    if (montant == null) {
      erreurs.push(`Ligne ${numeroLigne} : montant illisible.`)
      return
    }
    if (!libelle) {
      erreurs.push(`Ligne ${numeroLigne} : libellé vide.`)
      return
    }
    lignes.push({
      date,
      libelle,
      montant,
    })
  })
  return {
    lignes,
    erreurs,
    separateur,
    colonnes,
  }
}

/** Clé de dédoublonnage : date, montant au centime et libellé normalisé. */
export const cleLigneReleve = (ligne: LigneReleve): string =>
  `${ligne.date}|${ligne.montant.toFixed(2)}|${normaliserTexte(ligne.libelle)}`

export interface ResultatDedoublonnage<L extends LigneReleve = LigneReleve> {
  retenues: L[]
  doublons: L[]
}

/** Écarte les lignes déjà importées (`existantes`) et les répétitions internes au relevé. */
export function dedoublonnerReleve<L extends LigneReleve>(lignes: L[], existantes: LigneReleve[]): ResultatDedoublonnage<L> {
  const cles = new Set(existantes.map(cleLigneReleve)),
    retenues: L[] = [],
    doublons: L[] = []
  for (const ligne of lignes) {
    const cle = cleLigneReleve(ligne)
    if (cles.has(cle)) doublons.push(ligne)
    else {
      cles.add(cle)
      retenues.push(ligne)
    }
  }
  return {
    retenues,
    doublons,
  }
}

/** Mots sans valeur pour rapprocher un libellé bancaire d'un nom (en majuscules normalisées). */
export const MOTS_IGNORES_RAPPROCHEMENT = new Set([
  'VIR',
  'SEPA',
  'PRLV',
  'CB',
  'CHQ',
  'CHEQUE',
  'VIREMENT',
  'DE',
  'DU',
  'LA',
  'LE',
  'LES',
  'ET',
  'M',
  'MME',
  'MR',
  'MLLE',
  'SCI',
  'COPRO',
  'CHARGES',
  'CHARGE',
  'APPEL',
  'FONDS',
  'LOT',
  'REF',
  'REFERENCE',
])

/** Mots normalisés d'au moins 3 caractères, hors mots ignorés et nombres. */
export function motsSignificatifs(texte: string): string[] {
  return normaliserTexte(texte)
    .split(' ')
    .filter((mot) => mot.length >= 3 && !MOTS_IGNORES_RAPPROCHEMENT.has(mot) && !/^\d+$/.test(mot))
}

export type ConfianceImputation = 'forte' | 'probable'

export interface PropositionImputation<L extends LigneReleve = LigneReleve, C = { nom: string; solde: number }> {
  ligne: L
  candidat: C | null
  confiance: ConfianceImputation | null
  motif: string
}

/**
 * Propose un copropriétaire pour chaque encaissement : score = part des mots du nom présents dans le libellé,
 * + 0,25 si le montant solde exactement la dette ; seuil 0,5. Confiance forte si le nom complet (2 mots au moins)
 * est trouvé ou si le montant égale le solde dû.
 */
export function proposerImputations<L extends LigneReleve, C extends { nom: string; solde: number }>(
  lignes: L[],
  coproprietaires: C[],
): PropositionImputation<L, C>[] {
  return lignes.map((ligne) => {
    if (ligne.montant <= 0)
      return {
        ligne,
        candidat: null,
        confiance: null,
        motif: 'Débit : pas un encaissement de copropriétaire.',
      }
    const libelle = ` ${normaliserTexte(ligne.libelle)} `
    let meilleur: { c: C; score: number; total: number } | null = null
    for (const coproprietaire of coproprietaires) {
      const mots = motsSignificatifs(coproprietaire.nom)
      if (mots.length === 0) continue
      const trouves = mots.filter((mot) => libelle.includes(` ${mot} `)).length
      if (trouves === 0) continue
      const score = trouves / mots.length + (Math.abs(ligne.montant + coproprietaire.solde) < 5e-3 ? 0.25 : 0)
      if (!meilleur || score > meilleur.score)
        meilleur = {
          c: coproprietaire,
          score,
          total: mots.length,
        }
    }
    if (!meilleur || meilleur.score < 0.5)
      return {
        ligne,
        candidat: null,
        confiance: null,
        motif: 'Aucun nom de copropriétaire reconnu dans le libellé.',
      }
    const montantEgalSolde = Math.abs(ligne.montant + meilleur.c.solde) < 5e-3,
      nomComplet = meilleur.score >= 1,
      forte = (nomComplet && meilleur.total >= 2) || montantEgalSolde
    return {
      ligne,
      candidat: meilleur.c,
      confiance: forte ? 'forte' : 'probable',
      motif: `${nomComplet ? 'Nom complet' : 'Nom partiel'} dans le libellé${montantEgalSolde ? ' · montant égal au solde dû' : ''}.`,
    }
  })
}
