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

/**
 * `formaterNombre` : pourcentages à virgule (« 33,33 % ») pour un document artisan au rendu complet
 * (lib/version-rendu.ts). Absent : libellé d'origine (« 33.33% »), à l'identique.
 */
export function buildSubTypeLabel(
  devis: SubTypeLabelInput,
  isPt: boolean,
  formaterNombre?: (n: number) => string,
): string | null {
  if (devis.docType !== 'facture' || !devis.factureSubType || devis.factureSubType === 'standard') {
    return null
  }
  const pourcentage = (n: number): string => (formaterNombre ? `${formaterNombre(n)} %` : `${n}%`)
  // Document portugais (28/11/2026) : « N.º » et non « N° », « NOTA DE CRÉDITO » sans « (AVOIR) », et
  // « sobre orçamento » quand le parent d'un adiantamento est un orçamento (comme devis-pdf-v3.ts).
  if (devis.factureSubType === 'acompte') {
    const base = isPt ? 'FATURA DE ADIANTAMENTO' : 'FACTURE D\'ACOMPTE'
    let ordreSuffix = ''
    if (devis.acompteOrdre && devis.acompteTotal) {
      ordreSuffix = isPt ? ` N.º ${devis.acompteOrdre} de ${devis.acompteTotal}` : ` N°${devis.acompteOrdre} sur ${devis.acompteTotal}`
    }
    const pctSuffix = devis.acomptePourcentage != null ? ` — ${pourcentage(devis.acomptePourcentage)}` : ''
    let refLabel = 'sur facture'
    if (isPt) refLabel = /^(?:DEV|ORC)-/i.test(devis.parentInvoiceNumber || '') ? 'sobre orçamento' : 'sobre fatura'
    const refSuffix = devis.parentInvoiceNumber ? ` (${refLabel} ${devis.parentInvoiceNumber})` : ''
    return `${base}${ordreSuffix}${pctSuffix}${refSuffix}`
  }
  if (devis.factureSubType === 'situation') {
    return `${isPt ? 'FATURA DE SITUAÇÃO' : 'FACTURE DE SITUATION'}`
      + `${devis.situationNumber ? ` ${isPt ? 'N.º' : 'N°'} ${devis.situationNumber}` : ''}`
      + `${devis.situationAvancement != null ? ` — ${pourcentage(devis.situationAvancement)}` : ''}`
  }
  if (devis.factureSubType === 'avoir') {
    const base = isPt ? 'NOTA DE CRÉDITO' : 'AVOIR'
    return devis.parentInvoiceNumber
      ? `${base} ${isPt ? 'sobre fatura' : 'sur facture'} ${devis.parentInvoiceNumber}`
      : base
  }
  return null
}
