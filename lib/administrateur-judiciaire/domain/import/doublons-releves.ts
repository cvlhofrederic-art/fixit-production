import {
  designationReleve,
  type CompteReleve,
  type MouvementReleve,
  type ReleveCompte,
} from '@/lib/administrateur-judiciaire/domain/import/releve-compte'

/**
 * Doublons des relevés structurés (CFONB 120, camt.053) à l'import : ce qui a déjà été importé est reconnu par relevé,
 * puis par mouvement, jamais à l'intérieur d'un relevé. Fonctions pures, montants en UNITÉS MINEURES ENTIÈRES, sans
 * écran ni stockage : les empreintes à garder (empreinteReleve, empreintesMouvements) attendent les tables de Frédéric.
 *
 * Pourquoi pas dedoublonnerReleve (releve-bancaire.ts, import CSV) : sa clé date + montant + libellé écarte aussi les
 * répétitions internes au fichier. Or un relevé structuré n'est retenu que si ancien solde + mouvements = nouveau solde
 * (releve-compte.ts) : deux mouvements identiques du même jour (deux frais, deux virements d'un même copropriétaire)
 * y sont deux mouvements réels, et en écarter un ferait diverger le compte 512 du nouveau solde que le lecteur vient de
 * contrôler. 🔵 Règle : un relevé retenu n'est jamais dédoublonné à l'intérieur.
 *
 * Sources relevées le 20/11/2026 :
 * 🟢 CFONB, « Guide d'utilisation du standard ISO 20022 pour les relevés de compte — camt.053.001.02 », V1.2, juillet 2019
 *    (copie Qualiac) : p. 31, Stmt/Id [1..1], « Identifiant unique du relevé propre à chaque établissement » ;
 *    Stmt/ElctrncSeqNb [0..1], « Numéro de séquence du relevé, s'incrémente de 1 à chaque relevé envoyé (en fonction de
 *    l'accord bilatéral entre la banque et son client) » ; p. 35, Ntry/AcctSvcrRef [0..1], « Référence de l'écriture
 *    attribuée par la banque » (« Unique reference as assigned by the account servicing institution to unambiguously
 *    identify the entry ») ; Ntry/NtryRef [0..1], « Référence de l'écriture comptable ».
 * 🟢 CFONB, « Relevé de compte sur support informatique », juillet 2004, p. 6 : zones 2-R « Numéro d'écriture » et 2-S
 *    « Zone référence » du mouvement ; 🔴 leur unicité n'y est pas dite.
 *
 * Choix 🔵 (déduits, à valider) :
 * - même relevé : même compte (IBAN, ou RIB comparé à la partie nationale d'un IBAN FR / MC, comme compteCorrespond) et
 *   même devise, puis même identifiant (Stmt/Id) si les deux en portent un ; sinon même période, mêmes ancien et nouveau
 *   soldes, mêmes totaux des crédits et des débits, et numéros de séquence égaux quand les deux en portent un — ce qui
 *   reconnaît aussi un relevé lu en CFONB puis en camt.053. Même identifiant mais contenu différent : relevé non repris,
 *   avec un avertissement (relevé corrigé ou erreur de la banque, à vérifier) ;
 * - même mouvement (dans un relevé non reconnu) : même compte, même devise, même date, même montant, et même référence de
 *   la banque, ou même numéro d'écriture si les références ne se contredisent pas (l'une manque ou elles sont égales) ;
 *   un mouvement sans référence ni numéro n'est jamais un doublon. Date et montant sont exigés en plus de la référence
 *   parce que l'unicité de la référence CFONB n'est pas établie. Le relevé n'est alors repris qu'en partie, avec un
 *   avertissement : le compte 512 ne rejoint le nouveau solde que si ces mouvements ont bien été importés ;
 * - les relevés d'un même fichier sont traités dans l'ordre : un relevé ou un mouvement déjà vu plus haut dans le
 *   fichier compte comme déjà importé (un fichier qui contient deux fois le même relevé).
 * 🔴 Non traité : un mouvement importé d'un CSV (sans référence) n'est pas reconnu ; relevés qui se chevauchent sans être
 *   identiques (relevé intrajournalier puis relevé de fin de journée) : seuls les mouvements à référence sont écartés.
 */

/** Ce qu'il faut garder d'un relevé importé pour le reconnaître à un import suivant. */
export type EmpreinteReleve = Pick<
  ReleveCompte,
  | 'compte'
  | 'devise'
  | 'identifiant'
  | 'numeroSequence'
  | 'dateOuverture'
  | 'dateCloture'
  | 'soldeOuvertureMineur'
  | 'soldeClotureMineur'
  | 'totalCreditsMineur'
  | 'totalDebitsMineur'
>

/** Ce qu'il faut garder d'un mouvement importé pour le reconnaître à un import suivant. */
export type EmpreinteMouvement = Pick<MouvementReleve, 'date' | 'montantMineur' | 'referenceBanque' | 'numeroEcriture'> & {
  compte: CompteReleve
  devise: string
}

/** Relevés et mouvements déjà importés (empreintes gardées à chaque import). */
export interface DejaImporte {
  releves: readonly EmpreinteReleve[]
  mouvements: readonly EmpreinteMouvement[]
}

export interface ResultatDedoublonnageReleves {
  /** Mouvements à importer, dans l'ordre du fichier : ceux des relevés nouveaux, moins les mouvements déjà importés. */
  lignes: MouvementReleve[]
  /** Relevés nouveaux, repris en entier ou en partie. */
  nouveaux: ReleveCompte[]
  /** Relevés reconnus comme déjà importés : aucun de leurs mouvements n'est repris. */
  dejaImportes: ReleveCompte[]
  /** Mouvements d'un relevé nouveau écartés comme déjà importés (référence de la banque ou numéro d'écriture). */
  doublons: MouvementReleve[]
  avertissements: string[]
}

export const empreinteReleve = (releve: ReleveCompte): EmpreinteReleve => ({
  compte: releve.compte,
  devise: releve.devise,
  identifiant: releve.identifiant,
  numeroSequence: releve.numeroSequence,
  dateOuverture: releve.dateOuverture,
  dateCloture: releve.dateCloture,
  soldeOuvertureMineur: releve.soldeOuvertureMineur,
  soldeClotureMineur: releve.soldeClotureMineur,
  totalCreditsMineur: releve.totalCreditsMineur,
  totalDebitsMineur: releve.totalDebitsMineur,
})

export const empreintesMouvements = (releve: ReleveCompte): EmpreinteMouvement[] =>
  releve.mouvements.map((mouvement) => ({
    compte: releve.compte,
    devise: releve.devise,
    date: mouvement.date,
    montantMineur: mouvement.montantMineur,
    referenceBanque: mouvement.referenceBanque,
    numeroEcriture: mouvement.numeroEcriture,
  }))

const IBAN_NATIONAL_RIB = /^(FR|MC)\d{2}[A-Z0-9]{23}$/

/** Identifiant comparable d'un compte : la partie nationale d'un IBAN FR ou MC se confond avec le RIB ; null s'il n'y en a pas. */
function identifiantCompte(compte: CompteReleve): string | null {
  if (compte.iban) {
    const iban = compte.iban.replaceAll(/\s+/g, '').toUpperCase()
    return IBAN_NATIONAL_RIB.test(iban) ? `RIB ${iban.slice(4)}` : `IBAN ${iban}`
  }
  if (compte.rib) return `RIB ${compte.rib.banque}${compte.rib.guichet}${compte.rib.numero}${compte.rib.cle}`.toUpperCase()
  return compte.autreIdentifiant ? `AUTRE ${compte.autreIdentifiant}` : null
}

const memeContenu = (a: EmpreinteReleve, b: EmpreinteReleve): boolean =>
  a.dateOuverture === b.dateOuverture &&
  a.dateCloture === b.dateCloture &&
  a.soldeOuvertureMineur === b.soldeOuvertureMineur &&
  a.soldeClotureMineur === b.soldeClotureMineur &&
  a.totalCreditsMineur === b.totalCreditsMineur &&
  a.totalDebitsMineur === b.totalDebitsMineur

/** « identique » : même relevé ; « identifiant » : même identifiant mais contenu différent ; null : relevés distincts. */
function comparerReleves(a: EmpreinteReleve, b: EmpreinteReleve): 'identique' | 'identifiant' | null {
  const compte = identifiantCompte(a.compte)
  if (compte === null || compte !== identifiantCompte(b.compte) || a.devise !== b.devise) return null
  if (a.identifiant && b.identifiant) {
    if (a.identifiant !== b.identifiant) return null
    return memeContenu(a, b) ? 'identique' : 'identifiant'
  }
  const sequencesContraires = a.numeroSequence !== null && b.numeroSequence !== null && a.numeroSequence !== b.numeroSequence
  return !sequencesContraires && memeContenu(a, b) ? 'identique' : null
}

/** Mouvements déjà vus : par référence de la banque, et par numéro d'écriture avec les références qui l'accompagnent. */
interface IndexMouvements {
  parReference: Set<string>
  parNumero: Map<string, (string | null)[]>
}

/** Compte, devise, date et montant d'un mouvement, sous forme de clé ; null si le compte n'est pas identifié. */
function baseMouvement(mouvement: EmpreinteMouvement): string | null {
  const compte = identifiantCompte(mouvement.compte)
  return compte === null ? null : JSON.stringify([compte, mouvement.devise, mouvement.date, mouvement.montantMineur])
}

function indexer(index: IndexMouvements, mouvement: EmpreinteMouvement): void {
  const base = baseMouvement(mouvement)
  if (base === null) return
  if (mouvement.referenceBanque) index.parReference.add(`${base} ${JSON.stringify(mouvement.referenceBanque)}`)
  if (!mouvement.numeroEcriture) return
  const cle = `${base} ${JSON.stringify(mouvement.numeroEcriture)}`,
    references = index.parNumero.get(cle)
  if (references) references.push(mouvement.referenceBanque)
  else index.parNumero.set(cle, [mouvement.referenceBanque])
}

/** Déjà vu : même référence de la banque, ou même numéro d'écriture sans références contraires (voir l'en-tête). */
function dejaVu(index: IndexMouvements, mouvement: EmpreinteMouvement): boolean {
  const base = baseMouvement(mouvement)
  if (base === null) return false
  if (mouvement.referenceBanque && index.parReference.has(`${base} ${JSON.stringify(mouvement.referenceBanque)}`)) return true
  const references = mouvement.numeroEcriture ? index.parNumero.get(`${base} ${JSON.stringify(mouvement.numeroEcriture)}`) : undefined
  return references?.some((reference) => reference === null || mouvement.referenceBanque === null) ?? false
}

const pluriel = (nombre: number, mot: string): string => `${nombre} ${mot}${nombre > 1 ? 's' : ''}`

/** Avertissement d'un relevé reconnu comme déjà importé. */
function avertissementDejaImporte(releve: ReleveCompte, designation: string, comparaison: 'identique' | 'identifiant'): string {
  if (comparaison === 'identifiant')
    return (
      `${designation} : même identifiant « ${releve.identifiant ?? ''} » qu’un relevé déjà importé, mais période, soldes ou ` +
      'totaux différents ; relevé non repris, à vérifier.'
    )
  const nombre = releve.mouvements.length
  return `${designation} déjà importé : ${nombre === 0 ? 'aucun mouvement' : `${pluriel(nombre, 'mouvement')} non repris`}.`
}

/**
 * Relevés retenus par lireReleve (CFONB 120, camt.053) → mouvements à importer : relevés déjà importés écartés en entier,
 * mouvements déjà importés écartés un à un, rien d'écarté à l'intérieur d'un relevé (voir l'en-tête).
 */
export function dedoublonnerRelevesStructures(releves: readonly ReleveCompte[], deja: DejaImporte): ResultatDedoublonnageReleves {
  const connus = [...deja.releves],
    index: IndexMouvements = { parReference: new Set(), parNumero: new Map() },
    resultat: ResultatDedoublonnageReleves = { lignes: [], nouveaux: [], dejaImportes: [], doublons: [], avertissements: [] }
  for (const mouvement of deja.mouvements) indexer(index, mouvement)
  for (const releve of releves) {
    const designation = designationReleve(releve.rang, releve.compte, releve.dateOuverture, releve.dateCloture),
      empreinte = empreinteReleve(releve),
      comparaison = connus.map((connu) => comparerReleves(empreinte, connu)).find((resultatComparaison) => resultatComparaison !== null)
    if (comparaison) {
      resultat.dejaImportes.push(releve)
      resultat.avertissements.push(avertissementDejaImporte(releve, designation, comparaison))
      continue
    }
    reprendreReleve(releve, designation, index, resultat)
    connus.push(empreinte)
  }
  return resultat
}

/**
 * Relevé nouveau : ses mouvements déjà vus avant lui sont écartés (avertissement), les autres sont à importer — ils ne
 * sont pas comparés entre eux — puis tous rejoignent les mouvements vus.
 */
function reprendreReleve(releve: ReleveCompte, designation: string, index: IndexMouvements, resultat: ResultatDedoublonnageReleves): void {
  const empreintes = empreintesMouvements(releve),
    doublonsAvant = resultat.doublons.length
  releve.mouvements.forEach((mouvement, rang) => {
    if (dejaVu(index, empreintes[rang])) resultat.doublons.push(mouvement)
    else resultat.lignes.push(mouvement)
  })
  resultat.nouveaux.push(releve)
  for (const empreinte of empreintes) indexer(index, empreinte)
  const ecartes = resultat.doublons.length - doublonsAvant
  if (ecartes === 0) return
  const accord = (singulier: string) => (ecartes > 1 ? `${singulier}s` : singulier)
  resultat.avertissements.push(
    `${designation} : ${pluriel(ecartes, 'mouvement')} déjà ${accord('importé')} (même référence de la banque ou même ` +
      `numéro d’écriture) ${accord('écarté')} ; relevé repris en partie, à vérifier.`,
  )
}
