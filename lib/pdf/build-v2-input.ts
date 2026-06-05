/**
 * Shared input builder for V2 PDF generator.
 * Eliminates duplication between handleTestPdfV2 and handlePreviewPdf in DevisFactureForm.
 *
 * V2 = artisan / auto-entrepreneur / micro-entrepreneur / EI uniquement
 *      (par design — les SAS/SARL/SCI passent par BTP V3).
 *
 * Calculs : centralisés via lib/money.ts (BOFiP §50, ROUND_HALF_UP).
 */

import type { DevisGeneratorInput } from './devis-generator-v2'
import type { ProductLine, DevisAcompte, FraisAnnexeItem, CustomTable } from '@/lib/devis-types'
import { sumMoney, computeAcomptesAmounts } from '@/lib/money'

export interface BuildV2InputParams {
  // Artisan
  logoUrl: string | null
  companyName: string
  artisanCompanyName?: string
  companySiret: string
  artisanRm?: string | null
  companyAddress: string
  companyPhone: string
  companyEmail: string
  artisanRcPro?: string | null
  insuranceName: string | null
  insuranceNumber: string | null
  insuranceCoverage: string | null
  insuranceType: string | null
  tvaEnabled: boolean
  paymentMode: string
  paymentCondition: string
  /** Date d'échéance facture saisie manuellement par l'utilisateur (ISO
   *  YYYY-MM-DD). Sert d'override sur paymentCondition. Si vide, le PDF
   *  parse paymentCondition (ex: "60 jours") pour calculer l'échéance.
   *  Source unique de vérité : lib/pdf/payment-due.ts. */
  paymentDue?: string | null

  // Client
  clientName: string
  clientSiret: string | null
  clientAddress: string | null
  clientPhone: string | null
  clientEmail: string | null
  interventionAddress: string | null
  interventionBatiment: string | null
  interventionEtage: string | null
  interventionEspacesCommuns: string | null
  interventionExterieur: string | null

  // Document
  docType: 'devis' | 'facture'
  docNumber: string
  docTitle: string
  docDate: string
  docValidity: number
  executionDelay: string
  prestationDate: string
  /** Sous-type facture (méthode pro 2026, cf. lib/devis-types.ts). */
  factureSubType?: 'standard' | 'acompte' | 'situation' | 'avoir'
  situationNumber?: number
  situationAvancement?: number
  acompteOrdre?: number
  acompteTotal?: number
  acomptePourcentage?: number
  parentInvoiceNumber?: string
  avoirMotif?: string

  // Lines
  lines: ProductLine[]
  // Matériaux + frais annexes : OBLIGATOIRE pour le calcul des acomptes
  // (sinon acompte 30% sur 1500 € HT = 300 € au lieu de 450 €).
  materialLines?: ProductLine[]
  fraisAnnexes?: FraisAnnexeItem[]
  // Tables custom (parité BTP V3) — sections de prestations supplémentaires
  // ajoutées dynamiquement par l'artisan. Lignes flattenées dans `lignes`
  // avec marker `section: 'custom_<tableId>'`. Inclues dans totalNet pour
  // calcul correct des acomptes.
  customTables?: CustomTable[]
  // Ventilation TVA pré-calculée par le form (single source of truth) — V2
  // l'utilisera pour afficher le détail TVA multi-taux quand auto-entrepreneur
  // bascule en TVA après dépassement du seuil 293 B.
  tvaBreakdown?: Array<{ rate: number; base: number; amount: number }>

  // Acomptes
  acomptesEnabled: boolean
  acomptes: DevisAcompte[]

  // Notes & mediator
  notes: string
  mediatorName: string
  mediatorUrl: string

  // Flags
  isHorsEtablissement: boolean
}

export function buildV2Input(
  params: BuildV2InputParams,
  overrides?: { numero?: string }
): DevisGeneratorInput {
  const {
    logoUrl, companyName, artisanCompanyName, companySiret,
    artisanRm, companyAddress, companyPhone, companyEmail, artisanRcPro,
    insuranceName, insuranceNumber, insuranceCoverage, insuranceType,
    tvaEnabled, paymentMode, paymentCondition, paymentDue,
    clientName, clientSiret, clientAddress, clientPhone, clientEmail,
    interventionAddress, interventionBatiment, interventionEtage, interventionEspacesCommuns, interventionExterieur,
    docType, docNumber, docTitle, docDate, docValidity, executionDelay, prestationDate,
    factureSubType, situationNumber, situationAvancement,
    lines, materialLines, fraisAnnexes, customTables, tvaBreakdown,
    acomptesEnabled, acomptes, notes, mediatorName, mediatorUrl,
    isHorsEtablissement,
  } = params

  // Total HT global incluant labor + materials + frais annexes — utilisé
  // pour calculer les acomptes correctement. La V2 d'origine excluait
  // matériaux/frais, ce qui sous-calculait les acomptes (cf. audit MOY-9).
  const validLabor = lines.filter(l => l.description.trim())
  const validMaterials = (materialLines || []).filter(l => l.description.trim())
  const validFrais = (fraisAnnexes || []).filter(f => (f.designation || '').trim())
  // Lignes des tables custom (flattenées avec un marker section pour le PDF)
  const validCustomTables = (customTables || []).map(t => ({
    ...t,
    lines: t.lines.filter(l => l.description.trim()),
  })).filter(t => t.lines.length > 0)
  const validCustomLines = validCustomTables.flatMap(t => t.lines)
  const totalNet = sumMoney([
    ...validLabor.map(l => l.totalHT || 0),
    ...validMaterials.map(l => l.totalHT || 0),
    ...validFrais.map(f => f.total_ht || 0),
    ...validCustomLines.map(l => l.totalHT || 0),
  ])
  // Acomptes répartis avec le dernier qui rattrape le résidu d'arrondi
  // (convention comptable Henrri/EBP/Sage). Évite que la somme des acomptes
  // diffère du TOTAL TTC à 1-2 cents près.
  const acomptesAmounts = acomptesEnabled
    ? computeAcomptesAmounts(totalNet, acomptes)
    : []

  return {
    artisan: {
      logo_url: logoUrl,
      nom: companyName || artisanCompanyName || '',
      siret: companySiret || '',
      rm: artisanRm || null,
      adresse: companyAddress || '',
      telephone: companyPhone || '',
      email: companyEmail || '',
      rc_pro: artisanRcPro || null,
      insurance_name: insuranceName || null,
      insurance_number: insuranceNumber || null,
      insurance_coverage: insuranceCoverage || null,
      insurance_type: (insuranceType as 'rc_pro' | 'decennale' | 'both' | null) || null,
      tva_mention: tvaEnabled ? 'TVA applicable' : 'TVA non applicable, article 293 B du CGI.',
      mode_paiement: paymentMode || 'Virement bancaire',
      condition_paiement: paymentCondition || null,
    },
    client: {
      nom: clientName || '',
      siret: clientSiret || null,
      adresse: clientAddress || null,
      telephone: clientPhone || null,
      email: clientEmail || null,
      intervention_adresse: interventionAddress || null,
      intervention_batiment: interventionBatiment || null,
      intervention_etage: interventionEtage || null,
      intervention_espaces_communs: interventionEspacesCommuns || null,
      intervention_exterieur: interventionExterieur || null,
    },
    devis: {
      numero: overrides?.numero || docNumber || (docType === 'devis' ? 'DEVIS-DRAFT' : 'FACT-DRAFT'),
      titre: docTitle || (docType === 'devis' ? 'DEVIS' : 'FACTURE'),
      date_emission: new Date(docDate),
      validite_jours: docValidity || 30,
      delai_execution: executionDelay || 'À convenir',
      date_prestation: prestationDate ? new Date(prestationDate) : null,
      docType,
      factureSubType,
      situationNumber,
      situationAvancement,
      // Échéance facture (art. L441-10 C. com.) : on priorise paymentDue
      // (date ISO override manuel) puis paymentCondition (texte dropdown,
      // "60 jours date facture" etc.). Le helper computeEcheanceDate gère
      // les 3 formats. Pour devis, ignoré (utilise validite_jours).
      paymentDue: paymentDue || paymentCondition || null,
    },
    // mode_affichage : passe en 'sections' s'il y a des tables custom non vides
    // → le PDF V2 groupe les lignes par section (cf. devis-generator-v2.ts).
    // Sinon, comportement classique 'bloc' (toutes les lignes dans une seule table).
    mode_affichage: validCustomTables.length > 0 ? ('sections' as const) : ('bloc' as const),
    lignes: [
      // Lignes principales (labor) — section null/'labor' selon mode
      ...lines.filter(l => l.description.trim()).map(l => ({
        designation: l.description,
        lineDetail: l.lineDetail || undefined,
        quantite: l.qty,
        unite: l.unit || 'u',
        prix_unitaire: l.priceHT,
        total: l.totalHT,
        section: validCustomTables.length > 0 ? 'labor' : null,
        etapes: (l.etapes || []).filter(e => e.designation.trim()).sort((a, b) => a.ordre - b.ordre).map(e => ({
          ordre: e.ordre,
          designation: e.designation,
        })),
      })),
      // Lignes des tables custom — flattenées avec marker section `custom_<id>`.
      // Le generator V2 lit ce marker dans SECTION_LABELS pour afficher le nom
      // personnalisé de la table comme titre de section.
      ...validCustomTables.flatMap(tbl => tbl.lines.map(l => ({
        designation: l.description,
        lineDetail: l.lineDetail || undefined,
        quantite: l.qty,
        unite: l.unit || 'u',
        prix_unitaire: l.priceHT,
        total: l.totalHT,
        section: `custom_${tbl.id}`,
        etapes: (l.etapes || []).filter(e => e.designation.trim()).sort((a, b) => a.ordre - b.ordre).map(e => ({
          ordre: e.ordre,
          designation: e.designation,
        })),
      }))),
    ],
    // Custom section labels — utilisés par le PDF V2 pour libeller les sections
    // dynamiques (au-delà des labels figés labor/material/frais).
    customSectionLabels: validCustomTables.length > 0
      ? Object.fromEntries(validCustomTables.map(t => [`custom_${t.id}`, t.name]))
      : undefined,
    acomptes: acomptesEnabled ? acomptes.map((ac, i) => ({
      label: ac.label,
      // Le dernier acompte absorbe le résidu d'arrondi (cf. acomptesAmounts).
      montant: acomptesAmounts[i] ?? 0,
      declencheur: ac.declencheur,
      statut: 'en attente' as const,
    })) : undefined,
    notes: notes || undefined,
    mediateur: mediatorName || undefined,
    mediateur_url: mediatorUrl || undefined,
    isHorsEtablissement,
    tvaBreakdown: tvaBreakdown && tvaBreakdown.length > 0 ? tvaBreakdown : undefined,
  }
}
