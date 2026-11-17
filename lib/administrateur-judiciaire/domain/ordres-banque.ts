import { validerIban } from '@/lib/administrateur-judiciaire/domain/comptes-bancaires'
import { estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'

/**
 * Ordres de banque d'un syndicat (cartographie Gestéam, tranche 29). Fonctions pures, montants en CENTIMES ENTIERS, sans
 * écran ni envoi : les fichiers sont produits, jamais transmis par VitFix.
 *
 * D1 — l'ordre porte sur un compte bancaire du SYNDICAT et porte l'identifiant (traitementId) du traitement auquel il
 * se rattache : l'encaissement pour une remise ; pour un virement, le traitement « Règlement de factures » ou
 * « Règlement de soldes de compte » sous lequel tous les règlements de l'ordre sont écrits ensemble, une fois l'ordre
 * émis (reglements-fournisseurs.ts, traitementReglements). À la création d'un ordre de virement, ce traitement
 * n'existe donc pas encore : traitementId en réserve l'identifiant.
 *
 * Gestéam — « Comptabilité Ordre de banques » : Date · Compte (512) · Type (Remise de chèques, Ordre de virement…) ·
 * Tiers · Libellé · No pièce · Or(dres) · Montant · Statut (Enregistré / Émis) ; fiche : Émis le, Nombre de pièces,
 * Information virement, Traitement, Banque, Encaissement, Règlement (+ IBAN).
 * Virements : ISO 20022 pain.001.001.03 (virement SEPA). 🔴 À valider avec la banque du syndicat avant tout dépôt.
 *
 * Point 39 du bilan 2 : les dix types d'ordre de Gestéam, le rang, le tiers et l'état imputé de chaque ordre d'un lot
 * sont dans types-ordres-banque.ts ; le virement de banque à banque entre comptes du syndicat, dans virement-interne.ts.
 * Le contrôle d'émission unique (verifierEmission) sert aussi au lot de virements internes, émis entier
 * (emettreLotVirementsInternes), et à l'ordre constaté (emettreOrdreConstate) ; un ordre d'un lot (ordresDuLot) ne
 * s'émet jamais seul : il prend le statut du lot.
 */

export interface LigneCheque {
  encaissementId: string
  tireur: string
  numeroCheque: string
  montantCentimes: number
}

export interface LigneVirement {
  reglementId: string
  beneficiaire: string
  iban: string
  bic: string | null
  montantCentimes: number
  libelle: string
  /** Règlements regroupés dans ce virement (« 1 virement par mandat », paiement-fournisseurs.ts) ; absent : reglementId seul. */
  reglementIds?: string[]
}

interface BaseOrdre {
  id: string
  numero: string
  date: string
  coproprieteId: string
  banqueId: string
  /** Traitement de rattachement (voir D1 ci-dessus) : encaissement, ou règlement écrit après l'émission du virement. */
  traitementId: string
}

export type StatutOrdre = 'Enregistré' | 'Émis'

interface Totaux {
  statut: StatutOrdre
  dateEmission: string | null
  nombrePieces: number
  totalCentimes: number
}

export type RemiseCheques = BaseOrdre & Totaux & { type: 'Remise de chèques'; lignes: LigneCheque[] }
export type OrdreVirement = BaseOrdre & Totaux & { type: 'Ordre de virement'; lignes: LigneVirement[] }
export type OrdreBanque = RemiseCheques | OrdreVirement

function verifierBase(base: BaseOrdre, lignes: { montantCentimes: number }[]): void {
  if (!estDateIsoValide(base.date)) throw new Error(`Date invalide (${base.date}) : AAAA-MM-JJ attendu.`)
  if (!base.coproprieteId.trim()) throw new Error('Ordre sans syndicat : D1 le rattache au compte du syndicat.')
  if (lignes.length === 0) throw new Error('Ordre vide : aucune pièce.')
  for (const l of lignes)
    if (!Number.isInteger(l.montantCentimes) || l.montantCentimes <= 0)
      throw new Error(`Montant invalide (${l.montantCentimes}) : centimes entiers strictement positifs attendus.`)
}

const totaux = (lignes: { montantCentimes: number }[]): Totaux => ({
  statut: 'Enregistré',
  dateEmission: null,
  nombrePieces: lignes.length,
  totalCentimes: lignes.reduce((s, l) => s + l.montantCentimes, 0),
})

export function creerRemiseCheques(saisie: BaseOrdre & { lignes: LigneCheque[] }): RemiseCheques {
  verifierBase(saisie, saisie.lignes)
  const numeros = new Set<string>()
  for (const l of saisie.lignes) {
    const cle = l.numeroCheque.trim()
    if (numeros.has(cle)) throw new Error(`Chèque n° ${cle} en double dans la remise.`)
    numeros.add(cle)
  }
  return { ...saisie, type: 'Remise de chèques', ...totaux(saisie.lignes) }
}

/**
 * Un identifiant de bout en bout (reglementId de la ligne, EndToEndId du fichier) par virement, jamais deux fois dans
 * l'ordre : il sert de référence du paiement, comme le n° d'un chèque d'une remise. Contrôlé à la création de l'ordre et
 * de nouveau sur un ordre relu (reglements-fournisseurs.ts), qui peut n'être pas passé par creerOrdreVirement.
 */
export function verifierIdentifiantsVirement(lignes: LigneVirement[]): void {
  const identifiants = new Set<string>()
  for (const l of lignes) {
    if (identifiants.has(l.reglementId))
      throw new Error(`Identifiant de bout en bout « ${l.reglementId} » en double dans l'ordre : chaque virement a sa propre référence de paiement.`)
    identifiants.add(l.reglementId)
  }
}

/** Ordre de virement : IBAN contrôlés, identifiants de bout en bout uniques (verifierIdentifiantsVirement). */
export function creerOrdreVirement(saisie: BaseOrdre & { lignes: LigneVirement[] }): OrdreVirement {
  verifierBase(saisie, saisie.lignes)
  for (const l of saisie.lignes) if (!validerIban(l.iban)) throw new Error(`IBAN invalide pour ${l.beneficiaire}.`)
  verifierIdentifiantsVirement(saisie.lignes)
  return { ...saisie, type: 'Ordre de virement', ...totaux(saisie.lignes) }
}

/** Pièce émise une seule fois : lot d'ordres de banque, virement interne, ordre constaté (types-ordres-banque.ts). */
export interface PieceEmise {
  numero: string
  statut: StatutOrdre
  dateEmission: string | null
}

/** Contrôle commun à toute émission : une seule fois, à une date ISO. N'émet rien. */
export function verifierEmission(piece: PieceEmise, dateEmission: string): void {
  if (piece.statut === 'Émis') throw new Error(`Ordre ${piece.numero} déjà émis le ${piece.dateEmission}.`)
  if (!estDateIsoValide(dateEmission)) throw new Error(`Date d'émission invalide (${dateEmission}) : AAAA-MM-JJ attendu.`)
}

/**
 * Émission d'un lot (remise de chèques, ordre de virement) : une seule fois ; renvoie un nouvel ordre. Ses ordres
 * (ordresDuLot) en prennent le statut et la date d'émission : ils ne s'émettent pas seuls.
 */
export function emettreOrdre<O extends OrdreBanque>(ordre: O, dateEmission: string): O {
  verifierEmission(ordre, dateEmission)
  return { ...ordre, statut: 'Émis', dateEmission }
}

const echapper = (texte: string) =>
  texte.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
const euros = (centimes: number) => (centimes / 100).toFixed(2)
const ibanBrut = (iban: string) => iban.replace(/\s+/g, '').toUpperCase()

/** Fichier pain.001.001.03 d'un ordre de virement ; le débiteur est le syndicat. */
export function genererPain001(
  ordre: OrdreVirement,
  debiteur: { nom: string; iban: string; bic: string },
  { messageId, dateCreation, dateExecution }: { messageId: string; dateCreation: string; dateExecution: string },
): string {
  if (ordre.type !== 'Ordre de virement') throw new Error('Fichier de virement : seul un ordre de virement en produit un.')
  if (!validerIban(debiteur.iban)) throw new Error('IBAN du syndicat débiteur invalide.')
  if (!estDateIsoValide(dateExecution)) throw new Error(`Date d'exécution invalide (${dateExecution}) : AAAA-MM-JJ attendu.`)
  const transactions = ordre.lignes
    .map(
      (l) => `      <CdtTrfTxInf>
        <PmtId><EndToEndId>${echapper(l.reglementId)}</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="EUR">${euros(l.montantCentimes)}</InstdAmt></Amt>
        ${l.bic ? `<CdtrAgt><FinInstnId><BIC>${echapper(l.bic)}</BIC></FinInstnId></CdtrAgt>` : ''}
        <Cdtr><Nm>${echapper(l.beneficiaire)}</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>${ibanBrut(l.iban)}</IBAN></Id></CdtrAcct>
        <RmtInf><Ustrd>${echapper(l.libelle)}</Ustrd></RmtInf>
      </CdtTrfTxInf>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${echapper(messageId)}</MsgId>
      <CreDtTm>${dateCreation}</CreDtTm>
      <NbOfTxs>${ordre.nombrePieces}</NbOfTxs>
      <CtrlSum>${euros(ordre.totalCentimes)}</CtrlSum>
      <InitgPty><Nm>${echapper(debiteur.nom)}</Nm></InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${echapper(ordre.numero)}</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>${ordre.nombrePieces}</NbOfTxs>
      <CtrlSum>${euros(ordre.totalCentimes)}</CtrlSum>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl></PmtTpInf>
      <ReqdExctnDt>${dateExecution}</ReqdExctnDt>
      <Dbtr><Nm>${echapper(debiteur.nom)}</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>${ibanBrut(debiteur.iban)}</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><BIC>${echapper(debiteur.bic)}</BIC></FinInstnId></DbtrAgt>
      <ChrgBr>SLEV</ChrgBr>
${transactions}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>
`
}
