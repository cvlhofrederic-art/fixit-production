// Construction du brouillon d'une facture d'acompte à partir d'un parent
// (FACTURE émise ou DEVIS). Source unique partagée par FacturesSection
// (« → Acompte ») et DevisSection (« Facturer → Acompte »).
//
// Met à l'échelle TOUTES les collections monétaires au % (via scaleDocumentLines,
// TVA de chaque ligne conservées), pose factureSubType='acompte' + métadonnées
// (ordre / total / %), et relie l'acompte à son devis source le cas échéant.

import { scaleDocumentLines } from '@/lib/devis-totals'
import { devisLinkFields } from '@/lib/devis-utils'

export interface AcompteParams {
  percentage: number
  ordre: number
  total: number
  declencheur: string
}

export function buildAcomptePrefill(
  parent: Record<string, unknown>,
  p: AcompteParams,
): Record<string, unknown> {
  const scaled = scaleDocumentLines(
    parent as unknown as Parameters<typeof scaleDocumentLines>[0],
    p.percentage / 100,
  )
  const docNumber = (parent.docNumber as string | undefined) || ''
  const docTitle = (parent.docTitle as string | undefined) || docNumber
  const isDevis = parent.docType === 'devis'
  return {
    ...scaled,
    // Lien devis source : pour un acompte tiré directement d'un devis, on garde
    // la référence (sourceDevisNumber/Id) ; pour un acompte tiré d'une facture,
    // l'éventuel lien hérité du parent est déjà porté par `...scaled`.
    ...(isDevis ? devisLinkFields(parent as { id?: unknown; docNumber?: unknown }) : {}),
    id: undefined,
    docType: 'facture',
    docNumber: '',
    status: 'brouillon',
    savedAt: undefined,
    sentAt: undefined,
    docDate: new Date().toISOString().slice(0, 10),
    docTitle: `Acompte N°${p.ordre} sur ${p.total} (${p.percentage}%) — ${docTitle}`,
    factureSubType: 'acompte',
    acompteOrdre: p.ordre,
    acompteTotal: p.total,
    acomptePourcentage: p.percentage,
    acompteDeFactureId: (parent.id as string | undefined) ?? docNumber,
    parentInvoiceNumber: docNumber,
    notes: `Acompte ${p.percentage}% (N°${p.ordre} sur ${p.total}) sur ${isDevis ? 'devis' : 'facture'} ${docNumber}. ` +
           `Déclencheur : ${p.declencheur}. TVA exigible à l'encaissement (art. 289 CGI + BOFIP-TVA-DECLA-30-10-20).`,
  }
}
