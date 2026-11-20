import { validerIban } from '@/lib/administrateur-judiciaire/domain/comptes-bancaires'
import { estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  avertissementLibelleTronque,
  avertissementsContinuite,
  composerLibelle,
  controlerSoldes,
  decimalesDevise,
  designationReleve,
  formaterMontantMineur,
  montantMajeur,
  totauxMouvements,
  type CompteReleve,
  type MouvementReleve,
  type ReleveCompte,
  type ResultatLectureReleves,
} from '@/lib/administrateur-judiciaire/domain/import/releve-compte'
import { enfant, enfantsNommes, lireXml, suivre, texteSuivi, type ElementXml } from '@/lib/administrateur-judiciaire/domain/import/xml-minimal'

/**
 * Lecture d'un relevé de compte ISO 20022 camt.053 (BankToCustomerStatement), toutes versions 001.NN. Fonctions pures,
 * montants en UNITÉS MINEURES ENTIÈRES (centimes pour l'euro), sans écran : rien n'est branché sur l'import de la
 * trésorerie (voir le mémo de branchement). XML lu par xml-minimal.ts (aucune DTD, aucune entité externe).
 *
 * Sources relevées le 20/11/2026 :
 * 🟢 CFONB, « Guide d'utilisation du standard ISO 20022 pour les relevés de compte — camt.053.001.02 », V1.2, juillet 2019
 *    (copie publiée par Qualiac, annexe TIFB) : message = GrpHdr puis Stmt [1..n] (un relevé par compte) ; Acct/Id/IBAN (la
 *    communauté française n'utilise que l'IBAN, § 2.6), Acct/Ccy ; Bal : ancien solde OPBD et nouveau solde CLBD, une
 *    occurrence chacun, Amt Ccy, CdtDbtInd CRDT / DBIT, Dt/Dt ; Ntry [0..n] : Amt, CdtDbtInd, RvslInd, Sts « BOOK », BookgDt,
 *    ValDt, AcctSvcrRef, BkTxCd (Domn/Cd, Fmly/Cd, SubFmlyCd ; Prtry/Cd), NtryDtls/TxDtls (Refs/EndToEndId, RltdPties,
 *    RmtInf, AddtlTxInf), AddtlNtryInf ; § 2.10 : AddtlTxInf reprend le libellé CFONB précédé du mot-clé « /LIB/ », AddtlNtryInf
 *    porte « /ECM/Yes|No » (exonération de commission) ; § 1.11 : point décimal, 5 décimales au plus, nombre de décimales
 *    compatible avec ISO 4217 ; § 1.12 : un fichier peut regrouper plusieurs messages ; « Il contient uniquement des
 *    informations sur des écritures déjà comptabilisées ». P. 31 : GrpHdr/MsgPgntn, PgNb de type Max5NumericText
 *    (« 01 » vaut 1), LastPgInd ; Stmt/ElctrncSeqNb [0..1], « Numéro de séquence du relevé, s'incrémente de 1 à chaque
 *    relevé envoyé ». P. 32-33 : TxsSummry, « nombre et somme des écritures comptabilisées », TtlCdtNtries et
 *    TtlDbtNtries (« Indiquer "0" s'il n'y a pas d'écriture »). P. 37 : NtryDtls/Btch/NbOfTxs (Max15NumericText, « Nombre
 *    de chèques dans la remise ») ; TxDtls [0..n], « Une seule occurrence » dans le guide.
 * 🟢 Payments Canada, guide camt.053.001.08 (MyStandards, 19/04/2024) : Sts devient un choix (Sts/Cd « BOOK ») ; Dbtr et Cdtr
 *    deviennent des choix (Dbtr/Pty/Nm) ; BookgDt en Dt ou DtTm ; RvslInd « Should only be present when the value is true ».
 * 🟢 Banques nordiques (POP Pankki, Nordea) : PRCD, solde clos précédent, peut tenir lieu d'ancien solde.
 *
 * Choix 🔵 (déduits, à valider) : ancien solde OPBD, à défaut PRCD ; date d'une écriture = BookgDt, à défaut ValDt (date ou
 *    date-heure, jour lu tel qu'écrit) ; une écriture au statut autre que BOOK est écartée avec un avertissement ; libellé =
 *    AddtlTxInf (valeurs « /LIB/ » seules s'il y a des mots-clés), RmtInf/Ustrd, RmtInf/Strd/CdtrRefInf/Ref, AddtlNtryInf
 *    (mêmes règles), puis la contrepartie (payeur d'un crédit, bénéficiaire d'un débit, inversés pour une contre-passation
 *    dont les parties restent celles de l'opération d'origine), au plus 1 000 caractères (composerLibelle, avertissement
 *    au-delà) ; totaux annoncés (TxsSummry), quand ils sont présents, comparés aux seules écritures comptabilisées, chacune
 *    comptée au crédit ou au débit selon son CdtDbtInd (une écriture à 0,00 au crédit est un crédit) ; montant à zéros de
 *    fin admis au-delà des décimales de la devise (« 10.500 » en EUR) ; message unique si PgNb vaut 1 et LastPgInd est vrai.
 *    Écriture globale (plus d'une TxDtls, ou Btch/NbOfTxs supérieur à 1) : rendue comme une seule écriture, sans payeur,
 *    bénéficiaire, référence ni texte des transactions (le nom d'un seul débiteur ferait imputer tout le lot à un
 *    copropriétaire), libellé = AddtlNtryInf suivi de « (écriture globale de N transactions) », avec un avertissement.
 * 🔴 Non établi / non traité : versions 001.03 à 001.07 et après 001.08 non relues une à une (seuls les éléments ci-dessus
 *    sont lus, par leur nom local) ; relevé paginé sur plusieurs messages (refusé) ; écritures globales non éclatées en
 *    transactions ; soldes de type propriétaire (Prtry) ignorés ; validation XSD complète.
 */

const ESPACE_CAMT053 = /^urn:iso:std:iso:20022:tech:xsd:camt\.053\.001\.\d{2}$/
const STATUT_COMPTABILISE = 'BOOK'
const REFERENCE_NON_FOURNIE = 'NOTPROVIDED'

interface Contexte {
  rang: number
  devise: string
  decimales: number
  erreurs: string[]
}

/** Montant ISO 20022 → entier en unités mineures ; message d'erreur sinon. */
function lireMontant(texte: string | null, devise: string, decimales: number): number | string {
  const m = texte ? /^(\d+)(?:\.(\d+))?$/.exec(texte) : null
  if (!m || m[1].length + (m[2]?.length ?? 0) > 18 || (m[2]?.length ?? 0) > 5) return `montant illisible « ${texte ?? ''} ».`
  const fraction = (m[2] ?? '').replace(/0+$/, '')
  if (fraction.length > decimales)
    return `montant « ${texte} » : ${devise} admet ${decimales} décimale${decimales > 1 ? 's' : ''}.`
  const valeur = Number(m[1] + fraction.padEnd(decimales, '0'))
  return Number.isSafeInteger(valeur) ? valeur : `montant « ${texte} » hors des limites de calcul exact.`
}

/** Sens CRDT / DBIT → +1 / −1 ; message d'erreur sinon. */
function lireSens(element: ElementXml | null): 1 | -1 | string {
  const sens = texteSuivi(element, 'CdtDbtInd')
  if (sens === 'CRDT') return 1
  if (sens === 'DBIT') return -1
  return `sens « ${sens ?? ''} » illisible (CRDT ou DBIT attendu).`
}

/** Montant signé d'un élément portant Amt (attribut Ccy) et CdtDbtInd ; message d'erreur sinon. */
function montantSigne(element: ElementXml, contexte: Contexte): number | string {
  const amt = enfant(element, 'Amt'),
    devise = amt?.attributs.Ccy?.trim()
  if (!amt) return 'montant (Amt) absent.'
  if (!devise) return 'devise absente (attribut Ccy de Amt).'
  if (devise !== contexte.devise) return `devise ${devise} différente de celle du relevé (${contexte.devise}).`
  const montant = lireMontant(amt.texte.trim(), devise, contexte.decimales),
    sens = lireSens(element)
  if (typeof montant === 'string') return montant
  if (typeof sens === 'string') return sens
  return sens * montant || 0
}

/** Jour (AAAA-MM-JJ) d'un choix Dt / DtTm ; null si absent ou invalide. */
function lireJour(choix: ElementXml | null): string | null {
  const brut = texteSuivi(choix, 'Dt') ?? texteSuivi(choix, 'DtTm'),
    jour = brut ? brut.slice(0, 10) : null
  return estDateIsoValide(jour) ? jour : null
}

interface SoldeLu {
  montant: number
  date: string
}

/** Soldes du relevé (Bal) rangés par code de type (Tp/CdOrPrtry/Cd), dans l'ordre du document. */
function soldesParCode(stmt: ElementXml): Map<string, ElementXml[]> {
  const parCode = new Map<string, ElementXml[]>()
  for (const bal of enfantsNommes(stmt, 'Bal')) {
    const code = texteSuivi(bal, 'Tp', 'CdOrPrtry', 'Cd'),
      deja = code ? parCode.get(code) : undefined
    if (deja) deja.push(bal)
    else if (code) parCode.set(code, [bal])
  }
  return parCode
}

/** Solde du premier code présent parmi `codes` (une seule occurrence admise) ; erreurs consignées dans le contexte. */
function lireSolde(parCode: ReadonlyMap<string, ElementXml[]>, codes: readonly string[], nature: string, contexte: Contexte): SoldeLu | null {
  const code = codes.find((candidat) => parCode.has(candidat)),
    soldes = code ? (parCode.get(code) ?? []) : []
  if (!code) contexte.erreurs.push(`Relevé ${contexte.rang} : ${nature} (${codes.join(' ou ')}) absent.`)
  else if (soldes.length > 1) contexte.erreurs.push(`Relevé ${contexte.rang} : plusieurs soldes ${code}.`)
  if (!code || soldes.length !== 1) return null
  const [bal] = soldes,
    montant = montantSigne(bal, contexte),
    date = lireJour(enfant(bal, 'Dt'))
  if (typeof montant === 'string') contexte.erreurs.push(`Relevé ${contexte.rang} : ${nature} ${code} : ${montant}`)
  if (!date) contexte.erreurs.push(`Relevé ${contexte.rang} : date du ${nature} ${code} absente ou invalide.`)
  return typeof montant === 'number' && date ? { montant, date } : null
}

/** Soldes OPBD (à défaut PRCD) et CLBD du relevé ; erreurs consignées dans le contexte. */
function lireSoldes(stmt: ElementXml, contexte: Contexte): { ouverture: SoldeLu | null; cloture: SoldeLu | null } {
  const parCode = soldesParCode(stmt)
  return { ouverture: lireSolde(parCode, ['OPBD', 'PRCD'], 'ancien solde', contexte), cloture: lireSolde(parCode, ['CLBD'], 'nouveau solde', contexte) }
}

/** Textes utiles d'un champ libre : valeurs « /LIB/ » s'il commence par un mot-clé « /XXX/ », sinon le texte entier. */
function textesUtiles(texte: string | null): string[] {
  if (!texte) return []
  if (!/^\/[A-Z0-9]{2,4}\//.test(texte)) return [texte]
  return [...texte.matchAll(/\/([A-Z0-9]{2,4})\/([\s\S]*?)(?=\/[A-Z0-9]{2,4}\/|$)/g)]
    .filter(([, cle]) => cle === 'LIB')
    .map(([, , valeur]) => valeur)
}

/** Nom d'une partie : v02 Dbtr/Nm, v08 et suivantes Dbtr/Pty/Nm. */
const nomPartie = (partie: ElementXml | null): string | null => texteSuivi(partie, 'Nm') ?? texteSuivi(partie, 'Pty', 'Nm')

const premier = <T>(valeurs: (T | null)[]): T | null => valeurs.find((valeur): valeur is T => valeur !== null) ?? null

function codeOperation(ntry: ElementXml): string | null {
  const domaine = suivre(ntry, 'BkTxCd', 'Domn'),
    codes = [texteSuivi(domaine, 'Cd'), texteSuivi(domaine, 'Fmly', 'Cd'), texteSuivi(domaine, 'Fmly', 'SubFmlyCd')]
  return codes.every(Boolean) ? codes.join('/') : texteSuivi(ntry, 'BkTxCd', 'Prtry', 'Cd')
}

/** Statut d'une écriture : v02 Sts, v08 et suivantes Sts/Cd (ou Sts/Prtry) ; null s'il est absent. */
const statutEcriture = (ntry: ElementXml): string | null =>
  texteSuivi(ntry, 'Sts', 'Cd') ?? texteSuivi(ntry, 'Sts') ?? texteSuivi(ntry, 'Sts', 'Prtry')

/** L'écriture est-elle comptabilisée (BOOK) ? Sinon avertissement (statut lu, écriture écartée) ou erreur (statut absent). */
function estComptabilisee(ntry: ElementXml, prefixe: string, contexte: Contexte, avertissements: string[]): boolean {
  const statut = statutEcriture(ntry)
  if (statut === STATUT_COMPTABILISE) return true
  if (statut) avertissements.push(`${prefixe} : écriture au statut ${statut}, non comptabilisée, écartée.`)
  else contexte.erreurs.push(`${prefixe} : statut (Sts) absent.`)
  return false
}

/** Parties, références et textes d'une écriture (ceux de sa transaction s'il n'y en a qu'une). */
interface DetailsEcriture {
  textes: (string | null)[]
  payeur: string | null
  beneficiaire: string | null
  referenceClient: string | null
  motifRejet: string | null
  /** Refs/AcctSvcrRef de la transaction, à défaut de celle de l'écriture. */
  referenceTransaction: string | null
  /** Nombre de transactions de l'écriture (voir nombreTransactions). */
  transactions: number
}

/** Le plus grand du nombre de TxDtls et de la somme des Btch/NbOfTxs lisibles de l'écriture. */
function nombreTransactions(ntry: ElementXml, transactions: readonly ElementXml[]): number {
  const annonce = enfantsNommes(ntry, 'NtryDtls')
    .flatMap((details) => enfantsNommes(details, 'Btch'))
    .map((lot) => texteSuivi(lot, 'NbOfTxs') ?? '')
    .filter((nombre) => /^\d{1,15}$/.test(nombre))
    .reduce((somme, nombre) => somme + Number(nombre), 0)
  return Math.max(transactions.length, annonce)
}

/** Détails d'une écriture simple (au plus une transaction) : ceux de sa TxDtls, suivis du texte de l'écriture. */
function detailsTransaction(tx: ElementXml | null, textesEcriture: string[]): Omit<DetailsEcriture, 'transactions'> {
  const rmtInf = enfant(tx, 'RmtInf'),
    reference = texteSuivi(tx, 'Refs', 'EndToEndId')
  return {
    textes: [
      ...textesUtiles(texteSuivi(tx, 'AddtlTxInf')),
      ...enfantsNommes(rmtInf, 'Ustrd').map((ustrd) => ustrd.texte),
      ...enfantsNommes(rmtInf, 'Strd').map((strd) => texteSuivi(strd, 'CdtrRefInf', 'Ref')),
      ...textesEcriture,
    ],
    payeur: nomPartie(suivre(tx, 'RltdPties', 'Dbtr')),
    beneficiaire: nomPartie(suivre(tx, 'RltdPties', 'Cdtr')),
    referenceClient: reference === REFERENCE_NON_FOURNIE ? null : reference,
    motifRejet: texteSuivi(tx, 'RtrInf', 'Rsn', 'Cd'),
    referenceTransaction: texteSuivi(tx, 'Refs', 'AcctSvcrRef'),
  }
}

/**
 * Détails d'une écriture. Écriture globale (plus d'une transaction) : rien n'est pris des transactions — ni payeur, ni
 * bénéficiaire, ni référence, ni texte —, le libellé est le texte de l'écriture suivi de « (écriture globale de N
 * transactions) » (voir l'en-tête).
 */
function detailsEcriture(ntry: ElementXml): DetailsEcriture {
  const transactions = enfantsNommes(ntry, 'NtryDtls').flatMap((details) => enfantsNommes(details, 'TxDtls')),
    nombre = nombreTransactions(ntry, transactions),
    textesEcriture = textesUtiles(texteSuivi(ntry, 'AddtlNtryInf'))
  if (nombre <= 1) return { ...detailsTransaction(transactions.at(0) ?? null, textesEcriture), transactions: nombre }
  return {
    textes: [...textesEcriture, `(écriture globale de ${nombre} transactions)`],
    payeur: null,
    beneficiaire: null,
    referenceClient: null,
    motifRejet: null,
    referenceTransaction: null,
    transactions: nombre,
  }
}

/** Écriture comptabilisée → mouvement ; null si elle est écartée (statut) ou fausse (erreur consignée). */
function lireEcriture(ntry: ElementXml, rangEcriture: number, contexte: Contexte, avertissements: string[]): MouvementReleve | null {
  const prefixe = `Relevé ${contexte.rang}, écriture ${rangEcriture}`
  if (!estComptabilisee(ntry, prefixe, contexte, avertissements)) return null
  const montantMineur = montantSigne(ntry, contexte),
    bookgDt = enfant(ntry, 'BookgDt'),
    dateValeur = lireJour(enfant(ntry, 'ValDt')),
    date = bookgDt ? lireJour(bookgDt) : dateValeur
  if (typeof montantMineur === 'string') contexte.erreurs.push(`${prefixe} : ${montantMineur}`)
  if (!date) contexte.erreurs.push(`${prefixe} : date de comptabilisation absente ou invalide.`)
  if (typeof montantMineur === 'string' || !date) return null
  const details = detailsEcriture(ntry),
    contrepassation = ['true', '1'].includes(texteSuivi(ntry, 'RvslInd') ?? ''),
    credit = montantMineur > 0,
    { libelle, tronque } = composerLibelle(details.textes, credit === contrepassation ? details.beneficiaire : details.payeur)
  if (details.transactions > 1)
    avertissements.push(
      `${prefixe} : écriture globale de ${details.transactions} transactions non éclatée ; ` +
        'payeurs, bénéficiaires, références et textes des transactions non repris.',
    )
  if (tronque) avertissements.push(avertissementLibelleTronque(prefixe))
  return {
    date,
    libelle,
    montant: montantMajeur(montantMineur, contexte.decimales),
    montantMineur,
    dateValeur,
    codeOperation: codeOperation(ntry),
    referenceBanque: texteSuivi(ntry, 'AcctSvcrRef') ?? details.referenceTransaction,
    numeroEcriture: texteSuivi(ntry, 'NtryRef'),
    payeur: details.payeur,
    beneficiaire: details.beneficiaire,
    referenceClient: details.referenceClient,
    motifRejet: details.motifRejet,
    contrepassation,
    complements: [],
  }
}

/** Compte du relevé : IBAN (contrôlé), sinon autre identifiant ; erreurs consignées. */
function lireCompte(stmt: ElementXml, contexte: Contexte): CompteReleve {
  const brut = texteSuivi(stmt, 'Acct', 'Id', 'IBAN'),
    iban = brut ? brut.replaceAll(/\s+/g, '').toUpperCase() : null,
    autreIdentifiant = iban ? null : texteSuivi(stmt, 'Acct', 'Id', 'Othr', 'Id')
  if (iban && !validerIban(iban)) contexte.erreurs.push(`Relevé ${contexte.rang} : IBAN invalide « ${iban} ».`)
  if (!iban && !autreIdentifiant) contexte.erreurs.push(`Relevé ${contexte.rang} : compte non identifié (ni IBAN ni autre identifiant).`)
  return { iban, rib: null, autreIdentifiant, titulaire: texteSuivi(stmt, 'Acct', 'Ownr', 'Nm') }
}

interface TotalLu {
  nombre: number
  /** Somme des montants, en valeur absolue. */
  somme: number
}

/**
 * Totaux des écritures comptabilisées (statut BOOK), au crédit et au débit selon CdtDbtInd — et non selon le signe du
 * montant, nul pour une écriture à 0,00. Appelé sur un relevé sans erreur : montants et sens sont lisibles.
 */
function totauxComptabilises(ecritures: readonly ElementXml[], contexte: Contexte): { credits: TotalLu; debits: TotalLu } {
  const credits: TotalLu = { nombre: 0, somme: 0 },
    debits: TotalLu = { nombre: 0, somme: 0 }
  for (const ntry of ecritures) {
    const montant = statutEcriture(ntry) === STATUT_COMPTABILISE ? montantSigne(ntry, contexte) : null
    if (typeof montant !== 'number') continue
    const total = lireSens(ntry) === 1 ? credits : debits
    total.nombre += 1
    total.somme += Math.abs(montant)
  }
  return { credits, debits }
}

/** Contrôle des totaux annoncés (TxsSummry) quand ils sont présents, sur les seules écritures comptabilisées. */
function controlerTotaux(stmt: ElementXml, ecritures: ElementXml[], contexte: Contexte): void {
  const resume = enfant(stmt, 'TxsSummry')
  if (!resume) return
  const { credits, debits } = totauxComptabilises(ecritures, contexte),
    montant = (valeur: number) => formaterMontantMineur(valeur, contexte.decimales, contexte.devise),
    incoherence = (detail: string) => contexte.erreurs.push(`Relevé ${contexte.rang} : totaux annoncés incohérents : ${detail}.`)
  const comparer = (bloc: string, ecrituresDuBloc: string, montantsDuBloc: string, lu: TotalLu) => {
    const nombre = texteSuivi(resume, bloc, 'NbOfNtries'),
      somme = texteSuivi(resume, bloc, 'Sum')
    if (nombre !== null && Number(nombre) !== lu.nombre) incoherence(`${nombre} ${ecrituresDuBloc} annoncées, ${lu.nombre} lues`)
    if (somme === null) return
    const annonce = lireMontant(somme, contexte.devise, contexte.decimales)
    if (typeof annonce === 'string') incoherence(`${montantsDuBloc} : ${annonce}`)
    else if (annonce !== lu.somme) incoherence(`${montantsDuBloc} annoncés ${montant(annonce)}, lus ${montant(lu.somme)}`)
  }
  comparer('TtlNtries', 'écritures', 'montants des écritures', { nombre: credits.nombre + debits.nombre, somme: credits.somme + debits.somme })
  comparer('TtlCdtNtries', 'écritures au crédit', 'crédits', credits)
  comparer('TtlDbtNtries', 'écritures au débit', 'débits', debits)
}

/** Un relevé (Stmt) : retenu dans `releves` s'il est complet et équilibré, sinon ses erreurs et son refus. */
function lireStatement(stmt: ElementXml, rang: number, resultat: ResultatLectureReleves): void {
  const erreurs: string[] = [],
    deviseCompte = texteSuivi(stmt, 'Acct', 'Ccy'),
    deviseSolde = premier(enfantsNommes(stmt, 'Bal').map((bal) => enfant(bal, 'Amt')?.attributs.Ccy?.trim() ?? null)),
    devise = deviseCompte ?? deviseSolde ?? '',
    contexte: Contexte = { rang, devise, decimales: decimalesDevise(devise), erreurs },
    compte = lireCompte(stmt, contexte)
  if (!/^[A-Z]{3}$/.test(devise)) erreurs.push(`Relevé ${rang} : devise du compte illisible « ${devise} ».`)
  const { ouverture, cloture } = lireSoldes(stmt, contexte),
    ecritures = enfantsNommes(stmt, 'Ntry'),
    mouvements = ecritures
      .map((ntry, index) => lireEcriture(ntry, index + 1, contexte, resultat.avertissements))
      .filter((mouvement): mouvement is MouvementReleve => mouvement !== null)
  // Une écriture fausse fausserait aussi les totaux : ils ne sont comparés que sur un relevé sans autre erreur.
  if (erreurs.length === 0) controlerTotaux(stmt, ecritures, contexte)
  const designation = designationReleve(rang, compte, ouverture?.date, cloture?.date)
  if (erreurs.length > 0 || !ouverture || !cloture) {
    resultat.erreurs.push(...erreurs, `${designation} refusé : ${erreurs.length} erreur${erreurs.length > 1 ? 's' : ''}.`)
    return
  }
  const { credits, debits } = totauxMouvements(mouvements),
    releve: ReleveCompte = {
      format: 'camt053',
      rang,
      identifiant: texteSuivi(stmt, 'Id'),
      compte,
      devise,
      decimales: contexte.decimales,
      dateOuverture: ouverture.date,
      dateCloture: cloture.date,
      soldeOuvertureMineur: ouverture.montant,
      soldeClotureMineur: cloture.montant,
      totalCreditsMineur: credits,
      totalDebitsMineur: debits,
      mouvements,
    },
    ecart = controlerSoldes(releve)
  if (ecart) resultat.erreurs.push(`${designation} refusé : ${ecart}`)
  else resultat.releves.push(releve)
}

/**
 * Motif du refus d'un message paginé, null s'il n'est pas paginé ou s'il est seul : PgNb de 1 à 5 chiffres valant 1
 * (« 1 », « 01 »… : Max5NumericText) et LastPgInd vrai.
 */
function refusPagination(message: ElementXml, numero: number): string | null {
  const pagination = suivre(message, 'GrpHdr', 'MsgPgntn')
  if (!pagination) return null
  const page = texteSuivi(pagination, 'PgNb') ?? '?',
    derniere = ['true', '1'].includes(texteSuivi(pagination, 'LastPgInd') ?? '')
  if (/^\d{1,5}$/.test(page) && Number(page) === 1 && derniere) return null
  return (
    `Message ${numero} refusé : relevé paginé (page ${page}, dernière page : ${derniere ? 'oui' : 'non'}) ; ` +
    'la lecture d’un relevé réparti sur plusieurs messages n’est pas traitée.'
  )
}

/** Relevés d'un message ; rend le nombre de relevés (Stmt) qu'il contient. */
function lireMessage(document: ElementXml, numero: number, rangPrecedent: number, resultat: ResultatLectureReleves): number {
  if (document.nom !== 'Document' || !ESPACE_CAMT053.test(document.espaceDeNoms)) {
    resultat.erreurs.push(
      `Message ${numero} non reconnu : <${document.nom}> de l’espace de noms « ${document.espaceDeNoms} », camt.053 attendu.`,
    )
    return 0
  }
  const message = enfant(document, 'BkToCstmrStmt')
  if (!message) {
    resultat.erreurs.push(`Message ${numero} : élément BkToCstmrStmt absent.`)
    return 0
  }
  const statements = enfantsNommes(message, 'Stmt'),
    refus = refusPagination(message, numero)
  if (statements.length === 0) {
    resultat.erreurs.push(`Message ${numero} : aucun relevé (Stmt).`)
    return 0
  }
  if (refus) {
    resultat.erreurs.push(refus)
    return statements.length
  }
  statements.forEach((stmt, index) => lireStatement(stmt, rangPrecedent + index + 1, resultat))
  return statements.length
}

/**
 * Lit un fichier camt.053 (un ou plusieurs messages) : relevés contrôlés (ancien solde + écritures comptabilisées =
 * nouveau solde, totaux annoncés), erreurs des relevés refusés, avertissements (écritures écartées, continuité).
 */
export function lireReleveCamt053(texte: string): ResultatLectureReleves {
  const resultat: ResultatLectureReleves = { releves: [], erreurs: [], avertissements: [] }
  let documents: ElementXml[]
  try {
    documents = lireXml(texte)
  } catch (erreur) {
    resultat.erreurs.push(`Fichier camt.053 illisible : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return resultat
  }
  let rang = 0
  documents.forEach((document, index) => {
    rang += lireMessage(document, index + 1, rang, resultat)
  })
  resultat.avertissements.push(...avertissementsContinuite(resultat.releves))
  return resultat
}
