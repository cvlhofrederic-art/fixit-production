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
 *    informations sur des écritures déjà comptabilisées ».
 * 🟢 Payments Canada, guide camt.053.001.08 (MyStandards, 19/04/2024) : Sts devient un choix (Sts/Cd « BOOK ») ; Dbtr et Cdtr
 *    deviennent des choix (Dbtr/Pty/Nm) ; BookgDt en Dt ou DtTm ; RvslInd « Should only be present when the value is true ».
 * 🟢 Banques nordiques (POP Pankki, Nordea) : PRCD, solde clos précédent, peut tenir lieu d'ancien solde.
 *
 * Choix 🔵 (déduits, à valider) : ancien solde OPBD, à défaut PRCD ; date d'une écriture = BookgDt, à défaut ValDt (date ou
 *    date-heure, jour lu tel qu'écrit) ; une écriture au statut autre que BOOK est écartée avec un avertissement ; libellé =
 *    AddtlTxInf (valeurs « /LIB/ » seules s'il y a des mots-clés), RmtInf/Ustrd, RmtInf/Strd/CdtrRefInf/Ref, AddtlNtryInf
 *    (mêmes règles), puis la contrepartie (payeur d'un crédit, bénéficiaire d'un débit, inversés pour une contre-passation
 *    dont les parties restent celles de l'opération d'origine), au plus 1 000 caractères (composerLibelle, avertissement
 *    au-delà) ; totaux annoncés (TxsSummry) comparés aux écritures lues
 *    quand ils sont présents ; montant à zéros de fin admis au-delà des décimales de la devise (« 10.500 » en EUR).
 * 🔴 Non établi / non traité : versions 001.03 à 001.07 et après 001.08 non relues une à une (seuls les éléments ci-dessus
 *    sont lus, par leur nom local) ; relevé paginé sur plusieurs messages (refusé) ; écritures globales (lots, TxDtls
 *    multiples) non éclatées en transactions ; soldes de type propriétaire (Prtry) ignorés ; validation XSD complète.
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

/** Soldes OPBD (à défaut PRCD) et CLBD du relevé ; erreurs consignées dans le contexte. */
function lireSoldes(stmt: ElementXml, contexte: Contexte): { ouverture: SoldeLu | null; cloture: SoldeLu | null } {
  const parCode = new Map<string, ElementXml[]>()
  for (const bal of enfantsNommes(stmt, 'Bal')) {
    const code = texteSuivi(bal, 'Tp', 'CdOrPrtry', 'Cd')
    if (code) parCode.set(code, [...(parCode.get(code) ?? []), bal])
  }
  const lire = (codes: string[], nature: string): SoldeLu | null => {
    const code = codes.find((candidat) => parCode.has(candidat))
    if (!code) {
      contexte.erreurs.push(`Relevé ${contexte.rang} : ${nature} (${codes.join(' ou ')}) absent.`)
      return null
    }
    const [bal, ...autres] = parCode.get(code) ?? []
    if (autres.length > 0) {
      contexte.erreurs.push(`Relevé ${contexte.rang} : plusieurs soldes ${code}.`)
      return null
    }
    const montant = montantSigne(bal, contexte),
      date = lireJour(enfant(bal, 'Dt'))
    if (typeof montant === 'string') contexte.erreurs.push(`Relevé ${contexte.rang} : ${nature} ${code} : ${montant}`)
    if (!date) contexte.erreurs.push(`Relevé ${contexte.rang} : date du ${nature} ${code} absente ou invalide.`)
    return typeof montant === 'number' && date ? { montant, date } : null
  }
  return { ouverture: lire(['OPBD', 'PRCD'], 'ancien solde'), cloture: lire(['CLBD'], 'nouveau solde') }
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
  const transactions = enfantsNommes(ntry, 'NtryDtls').flatMap((details) => enfantsNommes(details, 'TxDtls')),
    payeur = premier(transactions.map((tx) => nomPartie(suivre(tx, 'RltdPties', 'Dbtr')))),
    beneficiaire = premier(transactions.map((tx) => nomPartie(suivre(tx, 'RltdPties', 'Cdtr')))),
    contrepassation = ['true', '1'].includes(texteSuivi(ntry, 'RvslInd') ?? ''),
    credit = montantMineur > 0,
    textes = [
      ...transactions.flatMap((tx) => [
        ...textesUtiles(texteSuivi(tx, 'AddtlTxInf')),
        ...enfantsNommes(enfant(tx, 'RmtInf'), 'Ustrd').map((ustrd) => ustrd.texte),
        ...enfantsNommes(enfant(tx, 'RmtInf'), 'Strd').map((strd) => texteSuivi(strd, 'CdtrRefInf', 'Ref')),
      ]),
      ...textesUtiles(texteSuivi(ntry, 'AddtlNtryInf')),
    ],
    { libelle, tronque } = composerLibelle(textes, credit !== contrepassation ? payeur : beneficiaire)
  if (tronque) avertissements.push(avertissementLibelleTronque(prefixe))
  return {
    date,
    libelle,
    montant: montantMajeur(montantMineur, contexte.decimales),
    montantMineur,
    dateValeur,
    codeOperation: codeOperation(ntry),
    referenceBanque: texteSuivi(ntry, 'AcctSvcrRef') ?? premier(transactions.map((tx) => texteSuivi(tx, 'Refs', 'AcctSvcrRef'))),
    numeroEcriture: texteSuivi(ntry, 'NtryRef'),
    payeur,
    beneficiaire,
    referenceClient: premier(
      transactions.map((tx) => {
        const reference = texteSuivi(tx, 'Refs', 'EndToEndId')
        return reference === REFERENCE_NON_FOURNIE ? null : reference
      }),
    ),
    motifRejet: premier(transactions.map((tx) => texteSuivi(tx, 'RtrInf', 'Rsn', 'Cd'))),
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

/** Contrôle des totaux annoncés (TxsSummry) quand ils sont présents. */
function controlerTotaux(stmt: ElementXml, ecritures: ElementXml[], contexte: Contexte): void {
  const resume = enfant(stmt, 'TxsSummry')
  if (!resume) return
  const montants = ecritures.map((ntry) => montantSigne(ntry, contexte)).filter((m): m is number => typeof m === 'number'),
    { credits, debits } = totauxMouvements(montants.map((montantMineur) => ({ montantMineur }))),
    nombreCredits = montants.filter((m) => m > 0).length,
    montant = (valeur: number) => formaterMontantMineur(valeur, contexte.decimales, contexte.devise),
    incoherence = (detail: string) => contexte.erreurs.push(`Relevé ${contexte.rang} : totaux annoncés incohérents : ${detail}.`)
  const comparer = (bloc: string, ecrituresDuBloc: string, montantsDuBloc: string, nombreLu: number, sommeLue: number) => {
    const nombre = texteSuivi(resume, bloc, 'NbOfNtries'),
      somme = texteSuivi(resume, bloc, 'Sum')
    if (nombre !== null && Number(nombre) !== nombreLu) incoherence(`${nombre} ${ecrituresDuBloc} annoncées, ${nombreLu} lues`)
    if (somme === null) return
    const annonce = lireMontant(somme, contexte.devise, contexte.decimales)
    if (typeof annonce === 'string') incoherence(`${montantsDuBloc} : ${annonce}`)
    else if (annonce !== sommeLue) incoherence(`${montantsDuBloc} annoncés ${montant(annonce)}, lus ${montant(sommeLue)}`)
  }
  comparer('TtlNtries', 'écritures', 'montants des écritures', ecritures.length, credits + debits)
  comparer('TtlCdtNtries', 'écritures au crédit', 'crédits', nombreCredits, credits)
  comparer('TtlDbtNtries', 'écritures au débit', 'débits', ecritures.length - nombreCredits, debits)
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
    pagination = suivre(message, 'GrpHdr', 'MsgPgntn')
  if (statements.length === 0) {
    resultat.erreurs.push(`Message ${numero} : aucun relevé (Stmt).`)
    return 0
  }
  if (pagination) {
    const page = texteSuivi(pagination, 'PgNb') ?? '?',
      derniere = texteSuivi(pagination, 'LastPgInd')
    if (page !== '1' || (derniere !== 'true' && derniere !== '1')) {
      resultat.erreurs.push(
        `Message ${numero} refusé : relevé paginé (page ${page}, dernière page : ${derniere === 'true' || derniere === '1' ? 'oui' : 'non'}) ; ` +
          'la lecture d’un relevé réparti sur plusieurs messages n’est pas traitée.',
      )
      return statements.length
    }
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
