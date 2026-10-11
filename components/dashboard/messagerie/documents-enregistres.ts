// Pré-remplissage du formulaire « Envoyer un document » (Messagerie Pro) à partir des
// devis / factures enregistrés dans le tableau de bord (savedDocuments).
//
// Le montant TTC reprend exactement le calcul de la liste Factures V5
// (components/dashboard/FacturesSection.tsx) : régime TVA du document, lignes `lines` +
// `customTables` côté Artisan, `buildDocumentLines` (toutes sections) côté BTP.

import { computeTva, type TvaRegime } from '@/lib/tva-calculator'
import { buildDocumentLines } from '@/lib/devis-totals'
import { isDocDraftStatus } from '../useDocumentCancel'

export interface DocumentEnregistre {
  id?: string
  docType?: string
  docNumber?: string
  docTitle?: string
  docDate?: string
  status?: string
  lines?: unknown
  customTables?: unknown
  regimeTva?: TvaRegime
  regime_tva?: TvaRegime
  autoliquidationBTP?: boolean
  tvaEnabled?: boolean
}

export interface PreRemplissageDocument {
  cle: string
  reference: string
  montant_ttc: number
  description: string
  /** AAAA-MM-JJ, vide si le document n'a pas de date exploitable */
  date: string
}

const STATUTS_ANNULES = new Set(['cancelled', 'annule'])

type LigneTva = { totalHT?: unknown; tvaRate?: unknown }

const estObjet = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object'

/** Montant TTC d'un devis ou d'une facture enregistré(e) — même calcul que la liste Factures V5. */
export function montantTtcDocumentEnregistre(doc: DocumentEnregistre, orgRole?: string): number {
  const tvaEnabled = doc.tvaEnabled !== false
  const regime: TvaRegime = doc.regimeTva
    ?? doc.regime_tva
    ?? (doc.autoliquidationBTP ? 'autoliquidation_btp' : (tvaEnabled ? 'classique' : 'franchise_293b'))

  let lignes: unknown[]
  if (orgRole === 'pro_societe') {
    lignes = buildDocumentLines(doc as Parameters<typeof buildDocumentLines>[0])
  } else {
    const plates = Array.isArray(doc.lines) ? doc.lines.filter(Boolean) : []
    const tables = Array.isArray(doc.customTables)
      ? doc.customTables.flatMap(t => (estObjet(t) && Array.isArray(t.lines) ? t.lines.filter(Boolean) : []))
      : []
    lignes = [...plates, ...tables]
  }

  return computeTva({
    regime,
    lines: lignes
      .filter((l): l is LigneTva => estObjet(l))
      .map(l => ({
        totalHT: Number(l.totalHT) || 0,
        tvaRate: typeof l.tvaRate === 'number' ? l.tvaRate : 20,
      })),
  }).totalTTC
}

const premiereDescription = (doc: DocumentEnregistre): string => {
  if (!Array.isArray(doc.lines)) return ''
  const ligne = doc.lines.find(l => estObjet(l) && typeof l.description === 'string' && l.description.trim())
  return estObjet(ligne) ? String(ligne.description).trim() : ''
}

/**
 * Devis (ou factures) émis du prestataire, proposés pour pré-remplir le formulaire :
 * numéroté, ni brouillon ni annulé ; du plus récent au plus ancien numéro.
 */
export function documentsPourPreRemplissage(
  docs: DocumentEnregistre[] | undefined,
  type: 'devis' | 'facture',
  orgRole?: string,
): PreRemplissageDocument[] {
  if (!Array.isArray(docs)) return []
  const vus = new Set<string>()
  return docs
    .filter((d): d is DocumentEnregistre => estObjet(d))
    .filter(d => d.docType === type)
    .filter(d => typeof d.docNumber === 'string' && d.docNumber.trim() !== '')
    .filter(d => !isDocDraftStatus(d.status, type) && !STATUTS_ANNULES.has(d.status || ''))
    .filter(d => {
      const ref = String(d.docNumber)
      if (vus.has(ref)) return false
      vus.add(ref)
      return true
    })
    .map(d => ({
      cle: String(d.id || d.docNumber),
      reference: String(d.docNumber).trim(),
      montant_ttc: montantTtcDocumentEnregistre(d, orgRole),
      description: (d.docTitle || '').trim() || premiereDescription(d),
      date: typeof d.docDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.docDate) ? d.docDate : '',
    }))
    .sort((a, b) => b.reference.localeCompare(a.reference, 'fr', { numeric: true }))
}
