import { estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  avertissementLibelleTronque,
  avertissementsContinuite,
  cleRib,
  composerLibelle,
  controlerSoldes,
  decimalesDevise,
  designationReleve,
  montantMajeur,
  totauxMouvements,
  type ComplementReleve,
  type CompteReleve,
  type MouvementReleve,
  type ReleveCompte,
  type ResultatLectureReleves,
} from '@/lib/administrateur-judiciaire/domain/import/releve-compte'

/**
 * Lecture d'un relevé de compte CFONB 120 caractères. Fonctions pures, montants en UNITÉS MINEURES ENTIÈRES (centimes
 * pour l'euro), sans écran : rien n'est branché sur l'import de la trésorerie (voir le mémo de branchement).
 *
 * Sources relevées le 20/11/2026 :
 * 🟢 CFONB, « Relevé de compte sur support informatique », juillet 2004, § 2 et 3 (copie publiée par Qualiac, annexe
 *    TIFB) : enregistrements de 120 caractères ; 01 ancien solde, 04 mouvement, 05 complément facultatif et non limité en
 *    nombre, 07 nouveau solde ; « Les fichiers de relevés de comptes peuvent contenir plusieurs relevés » ; un compte non
 *    mouvementé n'a que 01 et 07. Zones (position, longueur) : code 1-2, banque 3-7, (01/07 réservée, 04/05 code opération
 *    interne) 8-11, guichet 12-16, devise ISO 4217 17-19, nombre de décimales 20, compte 22-32 ; 01/07 : date JJMMAA 35-40,
 *    montant 91-104 ; 04 : code opération interbancaire 33-34, date de comptabilisation 35-40, motif de rejet 41-42, date de
 *    valeur 43-48, libellé 49-79, numéro d'écriture 82-88, indices d'exonération 89 et d'indisponibilité 90, montant
 *    91-104, référence 105-120 ; 05 : qualifiant 46-48, informations complémentaires 49-118.
 * 🟢 Même brochure, « description détaillée des données » (reprise mot pour mot dans le guide de paramétrage du Crédit
 *    Agricole Centre Loire et dans le guide CFONB camt.053 V1.2, § 2.13) : montant cadré à droite, complété de zéros,
 *    signe superposé au dernier caractère — en ASCII « { » et « A » à « I » pour + 0 à + 9, « } » et « J » à « R » pour
 *    − 0 à − 9 ; « Les contenus des zones B et D à H sont identiques dans tous les enregistrements d'un même relevé » ;
 *    les positions 3 à 40 d'un 05 sont identiques à celles du 04 qu'il complète ; numéro d'écriture à zéro s'il n'est pas
 *    renseigné ; motif de rejet renseigné pour les seuls impayés et rejets.
 * 🟢 CFONB, « Évolutions du relevé de compte 120 caractères pour les opérations de virements et de prélèvements SEPA »,
 *    V2.0, mars 2010, § 4.2 (copie publiée par Millennium BCP) : qualifiants des 05 — NPY nom du payeur, NBE nom du
 *    bénéficiaire, NPO / NBU tiers débiteur / créancier, IPY IBE IPO IBU identifiants, LCC et LC2 libellé de client à client
 *    (lignes 1 et 2), LCS libellé structuré, RCN référence de client à client (49-83) et nature du paiement (84-118), REF
 *    références de la remise et de la transaction, MMO montant d'origine, CBE compte du bénéficiaire, RUM référence du
 *    mandat, CPY compte débiteur ; le qualifiant LIB (libellé libre, plusieurs possibles) est conservé.
 *
 * Choix 🔵 (déduits, à valider) : années JJMMAA lues 20AA ; date de valeur vide ou à zéro → null ; libellé = libellé du 04
 *    puis textes LIB, LCC et LC2 dans l'ordre du fichier, plus le nom de la contrepartie (composerLibelle : au-delà de
 *    1 000 caractères, textes suivants omis avec un avertissement) ; un relevé dont un enregistrement est faux est refusé
 *    en entier, les autres relevés du fichier restent lus ; lignes de moins de 120 caractères complétées de blancs (blancs
 *    de fin rognés par un éditeur) tant que les zones obligatoires sont entières, sinon « enregistrement tronqué » ;
 *    fichier sans séparateur de ligne découpé tous les 120 caractères ; nombre de décimales (zone 1-F) égal à celui de la
 *    devise selon ISO 4217 (decimalesDevise), sinon relevé refusé — la brochure ne fait que nommer la zone et désigner
 *    la devise par son code ISO 4217, mais les montants sont rendus en unités mineures de la devise (un relevé EUR à
 *    3 décimales serait lu en millièmes) ; le guide CFONB camt.053 (§ 1.11) pose la même règle pour le format XML.
 * 🔴 Non établi : fichiers en EBCDIC (seul l'ASCII est lu) ; qualifiants propres à une banque (gardés bruts dans
 *    `complements`) ; MMO non interprété.
 */

const LONGUEUR_ENREGISTREMENT = 120
/** Fin du montant (position 104) pour 01, 04 et 07 ; fin du qualifiant (position 48) pour 05. */
const LONGUEUR_MINIMALE: Readonly<Record<string, number>> = { '01': 104, '04': 104, '05': 48, '07': 104 }
const SIGNES_POSITIFS = '{ABCDEFGHI'
const SIGNES_NEGATIFS = '}JKLMNOPQR'
const QUALIFIANTS_LIBELLE = new Set(['LIB', 'LCC', 'LC2'])

/** Zone d'un enregistrement : position à partir de 1, longueur en caractères. */
const zone = (ligne: string, position: number, longueur: number): string => ligne.slice(position - 1, position - 1 + longueur)

/**
 * Montant CFONB de 14 caractères → entier signé en unités mineures : 13 chiffres puis le caractère qui porte le signe
 * et le chiffre des unités. Null si la zone est illisible. Zéro négatif rendu comme zéro.
 */
export function decoderMontantCfonb(zoneMontant: string): number | null {
  if (!/^\d{13}[{}A-R]$/.test(zoneMontant)) return null
  const signe = zoneMontant[13],
    positif = SIGNES_POSITIFS.indexOf(signe),
    negatif = SIGNES_NEGATIFS.indexOf(signe),
    unite = positif >= 0 ? positif : negatif
  if (unite < 0) return null
  const valeur = Number(zoneMontant.slice(0, 13)) * 10 + unite
  return negatif >= 0 ? -valeur || 0 : valeur
}

/** Date JJMMAA → ISO (20AA) ; null si invalide. */
function lireDate(zoneDate: string): string | null {
  const m = /^(\d{2})(\d{2})(\d{2})$/.exec(zoneDate)
  const iso = m ? `20${m[3]}-${m[2]}-${m[1]}` : null
  return estDateIsoValide(iso) ? iso : null
}

const texteOuNull = (valeur: string): string | null => valeur.trim() || null

interface MouvementEnCours {
  ligne: number
  /** Positions 3 à 40 du 04, que ses 05 doivent reprendre. */
  entete: string
  mouvement: Omit<MouvementReleve, 'libelle' | 'payeur' | 'beneficiaire' | 'referenceClient'> | null
  libelle04: string
}

interface ReleveEnCours {
  rang: number
  ligne01: number
  /** Zones B et D à H de l'ancien solde : banque, guichet, devise, décimales, compte. */
  zonesCompte: string
  compte: CompteReleve
  devise: string
  decimales: number
  dateOuverture: string | null
  soldeOuverture: number | null
  mouvements: MouvementEnCours[]
  dernier: MouvementEnCours | null
  erreurs: string[]
}

interface Lecture {
  avertissements: string[]
  erreurs: string[]
  releves: ReleveCompte[]
  enCours: ReleveEnCours | null
  rang: number
}

const zonesCompte = (ligne: string): string => zone(ligne, 3, 5) + zone(ligne, 12, 21)

function signaler(lecture: Lecture, numero: number, message: string): void {
  if (lecture.enCours) lecture.enCours.erreurs.push(`Relevé ${lecture.enCours.rang}, ligne ${numero} : ${message}`)
  else lecture.erreurs.push(`Ligne ${numero} : ${message}`)
}

/** Refus du relevé en cours : ses erreurs d'enregistrement, puis le motif. */
function refuser(lecture: Lecture, releve: ReleveEnCours, motif: string, dateCloture: string | null = null): void {
  lecture.erreurs.push(...releve.erreurs, `${designationReleve(releve.rang, releve.compte, releve.dateOuverture, dateCloture)} refusé : ${motif}`)
}

function compteDe(lecture: Lecture, numero: number, ligne: string): CompteReleve {
  const banque = zone(ligne, 3, 5),
    guichet = zone(ligne, 12, 5),
    numeroCompte = zone(ligne, 22, 11).trim()
  const lisible = /^\d{5}$/.test(banque) && /^\d{5}$/.test(guichet) && /^[A-Z0-9]{11}$/i.test(numeroCompte)
  if (!lisible) signaler(lecture, numero, `RIB illisible « ${banque} ${guichet} ${numeroCompte} ».`)
  return {
    iban: null,
    rib: lisible ? { banque, guichet, numero: numeroCompte, cle: cleRib(banque, guichet, numeroCompte) } : null,
    autreIdentifiant: lisible ? null : `${banque} ${guichet} ${numeroCompte}`.trim(),
    titulaire: null,
  }
}

function ouvrirReleve(lecture: Lecture, numero: number, ligne: string, longueur: number): void {
  if (lecture.enCours) refuser(lecture, lecture.enCours, `nouveau solde (07) absent avant l’ancien solde de la ligne ${numero}.`)
  lecture.rang += 1
  const releve: ReleveEnCours = {
    rang: lecture.rang,
    ligne01: numero,
    zonesCompte: zonesCompte(ligne),
    compte: { iban: null, rib: null, autreIdentifiant: null, titulaire: null },
    devise: zone(ligne, 17, 3).trim(),
    decimales: Number(zone(ligne, 20, 1)),
    dateOuverture: lireDate(zone(ligne, 35, 6)),
    soldeOuverture: decoderMontantCfonb(zone(ligne, 91, 14)),
    mouvements: [],
    dernier: null,
    erreurs: [],
  }
  lecture.enCours = releve
  releve.compte = compteDe(lecture, numero, ligne)
  if (longueur < LONGUEUR_MINIMALE['01']) return signaler(lecture, numero, `enregistrement tronqué (${longueur} caractères).`)
  controlerDevise(lecture, numero, releve, zone(ligne, 20, 1))
  if (!releve.dateOuverture) signaler(lecture, numero, `date de l’ancien solde invalide « ${zone(ligne, 35, 6)} ».`)
  if (releve.soldeOuverture === null) signaler(lecture, numero, `montant de l’ancien solde illisible « ${zone(ligne, 91, 14)} ».`)
}

/** Devise et nombre de décimales de l'ancien solde : lisibles, et décimales égales à celles de la devise (ISO 4217). */
function controlerDevise(lecture: Lecture, numero: number, releve: ReleveEnCours, zoneDecimales: string): void {
  const deviseLisible = /^[A-Z]{3}$/.test(releve.devise),
    decimalesLisibles = /^\d$/.test(zoneDecimales),
    attendues = decimalesDevise(releve.devise)
  if (!deviseLisible) signaler(lecture, numero, `code devise illisible « ${releve.devise} ».`)
  if (!decimalesLisibles) signaler(lecture, numero, `nombre de décimales illisible « ${zoneDecimales} ».`)
  if (deviseLisible && decimalesLisibles && releve.decimales !== attendues)
    signaler(lecture, numero, `nombre de décimales ${releve.decimales} incompatible avec la devise ${releve.devise} (${attendues} selon ISO 4217).`)
}

/** Contrôle commun à 04, 05 et 07 : un relevé ouvert et les mêmes zones de compte que l'ancien solde. */
function releveDeLaLigne(lecture: Lecture, numero: number, ligne: string, nature: string): ReleveEnCours | null {
  const releve = lecture.enCours
  if (!releve) {
    lecture.erreurs.push(`Ligne ${numero} : ${nature} hors relevé (aucun ancien solde 01 ouvert).`)
    return null
  }
  if (zonesCompte(ligne) !== releve.zonesCompte)
    signaler(lecture, numero, `banque, guichet, devise, décimales et compte doivent être identiques à ceux de l’ancien solde (ligne ${releve.ligne01}).`)
  return releve
}

function lireMouvement(lecture: Lecture, numero: number, ligne: string, longueur: number): void {
  const releve = releveDeLaLigne(lecture, numero, ligne, 'mouvement (04)')
  if (!releve) return
  releve.dernier = null
  if (longueur < LONGUEUR_MINIMALE['04']) return signaler(lecture, numero, `enregistrement tronqué (${longueur} caractères).`)
  const date = lireDate(zone(ligne, 35, 6)),
    zoneValeur = zone(ligne, 43, 6),
    dateValeur = /^[0 ]{6}$/.test(zoneValeur) ? null : lireDate(zoneValeur),
    montantMineur = decoderMontantCfonb(zone(ligne, 91, 14)),
    numeroEcriture = zone(ligne, 82, 7).trim()
  if (!date) signaler(lecture, numero, `date de comptabilisation invalide « ${zone(ligne, 35, 6)} ».`)
  if (!dateValeur && !/^[0 ]{6}$/.test(zoneValeur)) signaler(lecture, numero, `date de valeur invalide « ${zoneValeur} ».`)
  if (montantMineur === null) signaler(lecture, numero, `montant illisible « ${zone(ligne, 91, 14)} ».`)
  const enCours: MouvementEnCours = {
    ligne: numero,
    entete: zone(ligne, 3, 38),
    libelle04: zone(ligne, 49, 31),
    mouvement:
      date && montantMineur !== null
        ? {
            date,
            montant: montantMajeur(montantMineur, releve.decimales),
            montantMineur,
            dateValeur,
            codeOperation: texteOuNull(zone(ligne, 33, 2)),
            referenceBanque: texteOuNull(zone(ligne, 105, 16)),
            numeroEcriture: /^0*$/.test(numeroEcriture) ? null : numeroEcriture,
            motifRejet: texteOuNull(zone(ligne, 41, 2)),
            contrepassation: false,
            complements: [],
          }
        : null,
  }
  releve.mouvements.push(enCours)
  releve.dernier = enCours
}

function lireComplement(lecture: Lecture, numero: number, ligne: string, longueur: number): void {
  const releve = releveDeLaLigne(lecture, numero, ligne, 'complément (05)')
  if (!releve) return
  const dernier = releve.dernier
  if (!dernier) return signaler(lecture, numero, 'complément (05) sans mouvement (04) qui le précède.')
  if (longueur < LONGUEUR_MINIMALE['05']) return signaler(lecture, numero, `enregistrement tronqué (${longueur} caractères).`)
  if (zone(ligne, 3, 38) !== dernier.entete)
    return signaler(lecture, numero, `complément (05) dont les positions 3 à 40 diffèrent de celles de son mouvement (ligne ${dernier.ligne}).`)
  dernier.mouvement?.complements.push({ qualifiant: zone(ligne, 46, 3).trim(), texte: zone(ligne, 49, 70).trimEnd() })
}

/** Mouvement complet : libellé, payeur, bénéficiaire et référence de client à client tirés des 05 ; libellé coupé signalé. */
function finaliserMouvement(enCours: MouvementEnCours, rang: number, avertissements: string[]): MouvementReleve | null {
  const { mouvement } = enCours
  if (!mouvement) return null
  const premier = (qualifiant: string): ComplementReleve | undefined => mouvement.complements.find((c) => c.qualifiant === qualifiant),
    payeur = texteOuNull(premier('NPY')?.texte ?? ''),
    beneficiaire = texteOuNull(premier('NBE')?.texte ?? ''),
    referenceClient = texteOuNull(premier('RCN')?.texte.slice(0, 35) ?? ''),
    { libelle, tronque } = composerLibelle(
      [enCours.libelle04, ...mouvement.complements.filter((c) => QUALIFIANTS_LIBELLE.has(c.qualifiant)).map((c) => c.texte)],
      mouvement.montantMineur > 0 ? payeur : beneficiaire,
    )
  if (tronque) avertissements.push(avertissementLibelleTronque(`Relevé ${rang}, ligne ${enCours.ligne}`))
  return {
    ...mouvement,
    libelle,
    payeur,
    beneficiaire,
    referenceClient,
  }
}

function fermerReleve(lecture: Lecture, numero: number, ligne: string, longueur: number): void {
  const releve = releveDeLaLigne(lecture, numero, ligne, 'nouveau solde (07)')
  if (!releve) return
  let dateCloture: string | null = null,
    soldeCloture: number | null = null
  if (longueur < LONGUEUR_MINIMALE['07']) signaler(lecture, numero, `enregistrement tronqué (${longueur} caractères).`)
  else {
    dateCloture = lireDate(zone(ligne, 35, 6))
    soldeCloture = decoderMontantCfonb(zone(ligne, 91, 14))
    if (!dateCloture) signaler(lecture, numero, `date du nouveau solde invalide « ${zone(ligne, 35, 6)} ».`)
    if (soldeCloture === null) signaler(lecture, numero, `montant du nouveau solde illisible « ${zone(ligne, 91, 14)} ».`)
  }
  lecture.enCours = null
  if (releve.erreurs.length > 0 || !releve.dateOuverture || releve.soldeOuverture === null || !dateCloture || soldeCloture === null) {
    const nombre = releve.erreurs.length
    return refuser(lecture, releve, `${nombre} enregistrement${nombre > 1 ? 's' : ''} en erreur.`, dateCloture)
  }
  const retenus = releve.mouvements
      .map((enCours) => finaliserMouvement(enCours, releve.rang, lecture.avertissements))
      .filter((mouvement): mouvement is MouvementReleve => mouvement !== null),
    { credits, debits } = totauxMouvements(retenus),
    lu: ReleveCompte = {
      format: 'cfonb120',
      rang: releve.rang,
      identifiant: null,
      numeroSequence: null,
      compte: releve.compte,
      devise: releve.devise,
      decimales: releve.decimales,
      dateOuverture: releve.dateOuverture,
      dateCloture,
      soldeOuvertureMineur: releve.soldeOuverture,
      soldeClotureMineur: soldeCloture,
      totalCreditsMineur: credits,
      totalDebitsMineur: debits,
      mouvements: retenus,
    },
    ecart = controlerSoldes(lu)
  if (ecart) refuser(lecture, releve, ecart, dateCloture)
  else lecture.releves.push(lu)
}

type LecteurEnregistrement = (lecture: Lecture, numero: number, ligne: string, longueur: number) => void

/** Lecteur de chaque code d'enregistrement. */
const LECTEURS: ReadonlyMap<string, LecteurEnregistrement> = new Map([
  ['01', ouvrirReleve],
  ['04', lireMouvement],
  ['05', lireComplement],
  ['07', fermerReleve],
])

/** Un enregistrement : refusé s'il est trop long ou de code inconnu (un 05 qui le suit n'a plus de mouvement), sinon lu. */
function lireEnregistrement(lecture: Lecture, numero: number, contenu: string): void {
  if (contenu.length > LONGUEUR_ENREGISTREMENT) return signaler(lecture, numero, `${contenu.length} caractères au lieu de 120.`)
  const code = contenu.slice(0, 2),
    lecteur = LECTEURS.get(code)
  if (lecteur) return lecteur(lecture, numero, contenu.padEnd(LONGUEUR_ENREGISTREMENT, ' '), contenu.length)
  signaler(lecture, numero, `code d’enregistrement « ${code} » inconnu (01, 04, 05 ou 07 attendu).`)
  if (lecture.enCours) lecture.enCours.dernier = null
}

/** Enregistrements numérotés : lignes non vides, ou tranches de 120 caractères d'un fichier sans séparateur. */
function decouper(texte: string): { enregistrements: { numero: number; contenu: string }[]; erreur: string | null } {
  const propre = texte.replace(/^﻿/, '')
  if (!/[\r\n]/.test(propre) && propre.trimEnd().length > LONGUEUR_ENREGISTREMENT) {
    if (propre.length % LONGUEUR_ENREGISTREMENT !== 0)
      return {
        enregistrements: [],
        erreur: `Fichier sans séparateur de ligne de ${propre.length} caractères : pas un multiple de 120, fichier tronqué ?`,
      }
    return {
      enregistrements: Array.from({ length: propre.length / LONGUEUR_ENREGISTREMENT }, (_, index) => ({
        numero: index + 1,
        contenu: propre.slice(index * LONGUEUR_ENREGISTREMENT, (index + 1) * LONGUEUR_ENREGISTREMENT),
      })),
      erreur: null,
    }
  }
  return {
    enregistrements: propre
      .split(/\r\n|\n|\r/)
      .map((contenu, index) => ({ numero: index + 1, contenu }))
      .filter(({ contenu }) => contenu.trimEnd() !== ''),
    erreur: null,
  }
}

/**
 * Lit un fichier CFONB 120 : relevés contrôlés (ancien solde + mouvements = nouveau solde), erreurs des relevés refusés,
 * avertissements de continuité entre relevés successifs d'un même compte.
 */
export function lireReleveCfonb120(texte: string): ResultatLectureReleves {
  const { enregistrements, erreur } = decouper(texte)
  if (erreur) return { releves: [], erreurs: [erreur], avertissements: [] }
  if (enregistrements.length === 0) return { releves: [], erreurs: ['Relevé vide.'], avertissements: [] }
  const lecture: Lecture = { erreurs: [], avertissements: [], releves: [], enCours: null, rang: 0 }
  for (const { numero, contenu } of enregistrements) lireEnregistrement(lecture, numero, contenu)
  if (lecture.enCours) refuser(lecture, lecture.enCours, 'nouveau solde (07) absent, fichier tronqué ?')
  return { releves: lecture.releves, erreurs: lecture.erreurs, avertissements: [...lecture.avertissements, ...avertissementsContinuite(lecture.releves)] }
}
