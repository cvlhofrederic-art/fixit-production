import { validerIban } from '@/lib/administrateur-judiciaire/domain/comptes-bancaires'
import { estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  commentaireValidationBanque,
  controlerValidationBanque,
  type FicheValidationBanque,
} from '@/lib/administrateur-judiciaire/domain/validation-banque'

/**
 * Prélèvements SEPA des copropriétaires (cartographie Gestéam, tranches 25 et 29). Fonctions pures, montants en
 * CENTIMES ENTIERS, sans écran ni envoi : le fichier est produit, jamais transmis par VitFix.
 *
 * D1 — le créancier est le SYNDICAT (son ICS, son compte) ; le débiteur, le compte 450 du copropriétaire.
 *
 * Gestéam — « fiches échéancier de prélèvement » : Date · Compte (450) · Nom · Règlement · Ctx · Appel · Solde · Montant
 * · Statut « À prélever » ; le montant prélevé ne dépasse jamais le solde dû ; un compte porte jusqu'à deux R.U.M.
 * Format produit : ISO 20022 pain.008.001.02 (prélèvement SEPA Core), un bloc PmtInf par type de séquence.
 * Décision du 20/11/2026 (partie C, F103) : fichier produit, jamais transmis par VitFix ; chaque compte bancaire du
 * syndicat reçoit une fiche « validation banque » (date du test, format accepté, ICS vérifié, longueur maximale des
 * références, délais de remise : validation-banque.ts) ; sans elle, ou si l'ICS du créancier n'est pas celui que la banque
 * a vérifié, le fichier porte la mention « non validé par la banque » (genererPain008, option validationBanque). Le
 * règlement (UE) n° 260/2012 ne fixe que des exigences générales (art. 5 et annexe) : variantes de format et délais de
 * présentation relèvent du guide de la banque, que seul un test réel valide.
 */

export type SequenceSepa = 'FRST' | 'RCUR'

export interface EcheancePrelevement {
  id: string
  compteCoproprietaire: string
  debiteur: string
  iban: string
  bic: string | null
  /** Référence unique du mandat SEPA. */
  rum: string
  dateSignatureMandat: string
  sequence: SequenceSepa
  montantEcheanceCentimes: number
  soldeDuCentimes: number
  contentieux: boolean
}

export type MotifExclusion = 'solde_nul' | 'contentieux' | 'iban_invalide' | 'rum_absente'

export interface LotPrelevements {
  retenues: (EcheancePrelevement & { montantCentimes: number })[]
  exclues: { id: string; motif: MotifExclusion }[]
  totalCentimes: number
}

/** Retient les échéances prélevables, au plus le solde dû ; exclut avec motif (contentieux exclu par défaut). */
export function preparerLotPrelevements(
  echeances: EcheancePrelevement[],
  { exclureContentieux = true }: { exclureContentieux?: boolean } = {},
): LotPrelevements {
  const retenues: LotPrelevements['retenues'] = []
  const exclues: LotPrelevements['exclues'] = []
  for (const e of echeances) {
    const montantCentimes = Math.min(e.montantEcheanceCentimes, e.soldeDuCentimes)
    const motif: MotifExclusion | null =
      montantCentimes <= 0
        ? 'solde_nul'
        : exclureContentieux && e.contentieux
          ? 'contentieux'
          : !validerIban(e.iban)
            ? 'iban_invalide'
            : !e.rum.trim()
              ? 'rum_absente'
              : null
    if (motif) exclues.push({ id: e.id, motif })
    else retenues.push({ ...e, montantCentimes })
  }
  return { retenues, exclues, totalCentimes: retenues.reduce((s, r) => s + r.montantCentimes, 0) }
}

/** Identifiant créancier SEPA français : FR, 2 chiffres de clé, 3 caractères (code activité), 6 caractères. */
export const validerIcs = (ics: string): boolean => /^FR\d{2}[A-Z0-9]{3}[A-Z0-9]{6}$/.test(ics.trim().toUpperCase())

const echapper = (texte: string) =>
  texte.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
const euros = (centimes: number) => (centimes / 100).toFixed(2)
const ibanBrut = (iban: string) => iban.replace(/\s+/g, '').toUpperCase()

export interface CreancierSepa {
  nom: string
  ics: string
  iban: string
  bic: string
}

/**
 * Fichier pain.008.001.02 du lot (chaîne XML). Sans fiche « validation banque » du compte créancier (banqueId) qui accepte
 * ce format et a vérifié son ICS (validationBanque), le fichier porte la mention « non validé par la banque » (décision du
 * 20/11/2026, partie C, F103) ; sans compte créancier précisé, aucune fiche ne le valide.
 */
export function genererPain008(
  lot: LotPrelevements,
  creancier: CreancierSepa,
  {
    messageId,
    dateCreation,
    dateEcheance,
    banqueId,
    validationBanque = null,
  }: { messageId: string; dateCreation: string; dateEcheance: string; banqueId?: string; validationBanque?: FicheValidationBanque | null },
): string {
  if (lot.retenues.length === 0) throw new Error('Lot de prélèvements vide : rien à produire.')
  if (!validerIcs(creancier.ics)) throw new Error(`ICS du créancier invalide : « ${creancier.ics} ».`)
  if (!validerIban(creancier.iban)) throw new Error('IBAN du créancier invalide.')
  if (!estDateIsoValide(dateEcheance)) throw new Error(`Date d'échéance invalide (${dateEcheance}) : AAAA-MM-JJ attendu.`)
  const mention = commentaireValidationBanque(
    controlerValidationBanque(validationBanque, {
      banqueId,
      format: 'pain.008.001.02',
      ics: creancier.ics,
      references: lot.retenues.flatMap((r) => [r.id, r.rum.trim()]),
    }),
  )

  const blocs = (['FRST', 'RCUR'] as const)
    .map((sequence) => ({ sequence, lignes: lot.retenues.filter((r) => r.sequence === sequence) }))
    .filter((b) => b.lignes.length > 0)
    .map(({ sequence, lignes }, i) => {
      const somme = lignes.reduce((s, l) => s + l.montantCentimes, 0)
      const transactions = lignes
        .map(
          (l) => `      <DrctDbtTxInf>
        <PmtId><EndToEndId>${echapper(l.id)}</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">${euros(l.montantCentimes)}</InstdAmt>
        <DrctDbtTx><MndtRltdInf><MndtId>${echapper(l.rum.trim())}</MndtId><DtOfSgntr>${l.dateSignatureMandat}</DtOfSgntr></MndtRltdInf></DrctDbtTx>
        ${l.bic ? `<DbtrAgt><FinInstnId><BIC>${echapper(l.bic)}</BIC></FinInstnId></DbtrAgt>` : '<DbtrAgt><FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId></DbtrAgt>'}
        <Dbtr><Nm>${echapper(l.debiteur)}</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>${ibanBrut(l.iban)}</IBAN></Id></DbtrAcct>
        <RmtInf><Ustrd>${echapper(l.compteCoproprietaire)}</Ustrd></RmtInf>
      </DrctDbtTxInf>`,
        )
        .join('\n')
      return `    <PmtInf>
      <PmtInfId>${echapper(messageId)}-${i + 1}</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <NbOfTxs>${lignes.length}</NbOfTxs>
      <CtrlSum>${euros(somme)}</CtrlSum>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl><LclInstrm><Cd>CORE</Cd></LclInstrm><SeqTp>${sequence}</SeqTp></PmtTpInf>
      <ReqdColltnDt>${dateEcheance}</ReqdColltnDt>
      <Cdtr><Nm>${echapper(creancier.nom)}</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>${ibanBrut(creancier.iban)}</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BIC>${echapper(creancier.bic)}</BIC></FinInstnId></CdtrAgt>
      <CdtrSchmeId><Id><PrvtId><Othr><Id>${creancier.ics.trim().toUpperCase()}</Id><SchmeNm><Prtry>SEPA</Prtry></SchmeNm></Othr></PrvtId></Id></CdtrSchmeId>
${transactions}
    </PmtInf>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
${mention}<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${echapper(messageId)}</MsgId>
      <CreDtTm>${dateCreation}</CreDtTm>
      <NbOfTxs>${lot.retenues.length}</NbOfTxs>
      <CtrlSum>${euros(lot.totalCentimes)}</CtrlSum>
      <InitgPty><Nm>${echapper(creancier.nom)}</Nm></InitgPty>
    </GrpHdr>
${blocs}
  </CstmrDrctDbtInitn>
</Document>
`
}
