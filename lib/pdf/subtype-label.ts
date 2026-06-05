// Label réglementaire du sous-type de facture (acompte / situation / avoir),
// affiché sous le numéro sur le PDF (mentions légales : art. 289 CGI pour
// l'acompte, BOI-TVA-DECLA-30-20-20-30 §70 pour l'avoir).
//
// MIROIR de la logique inline de devis-pdf-v3.ts (BTP) — GARDER ALIGNÉ. Utilisé
// par le générateur V2 (artisan) pour que le label du PDF téléchargé depuis la
// liste soit complet (N°/%/facture parente), comme l'aperçu in-form.

export interface SubTypeLabelInput {
  docType?: 'devis' | 'facture'
  factureSubType?: 'standard' | 'acompte' | 'situation' | 'avoir'
  acompteOrdre?: number
  acompteTotal?: number
  acomptePourcentage?: number
  parentInvoiceNumber?: string
  situationNumber?: number
  situationAvancement?: number
}

export function buildSubTypeLabel(devis: SubTypeLabelInput, isPt: boolean): string | null {
  if (devis.docType !== 'facture' || !devis.factureSubType || devis.factureSubType === 'standard') {
    return null
  }
  if (devis.factureSubType === 'acompte') {
    const base = isPt ? 'FATURA DE ADIANTAMENTO' : 'FACTURE D\'ACOMPTE'
    const ordreSuffix = (devis.acompteOrdre && devis.acompteTotal)
      ? ` N°${devis.acompteOrdre} ${isPt ? 'de' : 'sur'} ${devis.acompteTotal}`
      : ''
    const pctSuffix = devis.acomptePourcentage != null ? ` — ${devis.acomptePourcentage}%` : ''
    const refSuffix = devis.parentInvoiceNumber
      ? ` (${isPt ? 'sobre fatura' : 'sur facture'} ${devis.parentInvoiceNumber})`
      : ''
    return `${base}${ordreSuffix}${pctSuffix}${refSuffix}`
  }
  if (devis.factureSubType === 'situation') {
    return `${isPt ? 'FATURA DE SITUAÇÃO' : 'FACTURE DE SITUATION'}`
      + `${devis.situationNumber ? ` N° ${devis.situationNumber}` : ''}`
      + `${devis.situationAvancement != null ? ` — ${devis.situationAvancement}%` : ''}`
  }
  if (devis.factureSubType === 'avoir') {
    const base = isPt ? 'NOTA DE CRÉDITO (AVOIR)' : 'AVOIR'
    return devis.parentInvoiceNumber
      ? `${base} ${isPt ? 'sobre fatura' : 'sur facture'} ${devis.parentInvoiceNumber}`
      : base
  }
  return null
}
