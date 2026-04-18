/**
 * Télécharge directement un devis sauvegardé depuis la liste (sans ouvrir le formulaire).
 *
 * Deux chemins de rendu :
 *  - Artisan / non-BTP (défaut) → generateDevisPdfV2 (design compact Vitfix Pro, identique à l'Aperçu)
 *  - BTP pro (orgRole === 'pro_societe' → useBtpDesign: true) → generateDevisPdfV3 (design BTP)
 *
 * Reconstruit les paramètres attendus par chaque générateur à partir du document en localStorage.
 */

import type { Locale } from '@/lib/i18n/config'
import type { ProductLine, DevisAcompte } from '@/lib/devis-types'
import { supabase } from '@/lib/supabase'
import { generateDevisPdfV3 } from '@/lib/pdf/devis-pdf-v3'
import { buildV2Input } from '@/lib/pdf/build-v2-input'
import { mapLegalFormToCode } from '@/lib/devis-utils'

interface SavedDevis {
  id?: string
  docType?: 'devis' | 'facture'
  docNumber?: string
  docTitle?: string
  docDate?: string
  docValidity?: number
  prestationDate?: string
  executionDelay?: string
  executionDelayDays?: number
  executionDelayType?: string
  companyStatus?: string
  companyName?: string
  companySiret?: string
  companyAddress?: string
  companyRCS?: string
  companyCapital?: string
  companyPhone?: string
  companyEmail?: string
  tvaEnabled?: boolean
  tvaNumber?: string
  companyAPE?: string
  insuranceType?: 'rc_pro' | 'decennale' | 'both'
  insuranceName?: string
  insuranceNumber?: string
  insuranceCoverage?: string
  mediatorName?: string
  mediatorUrl?: string
  isHorsEtablissement?: boolean
  clientType?: 'particulier' | 'professionnel'
  clientName?: string
  clientEmail?: string
  clientPhone?: string
  clientSiret?: string
  clientAddress?: string
  interventionAddress?: string
  interventionBatiment?: string
  interventionEtage?: string
  interventionEspacesCommuns?: string
  interventionExterieur?: string
  paymentMode?: string
  paymentDelay?: string
  paymentDue?: string
  paymentCondition?: string
  penaltyRate?: string
  recoveryFee?: string
  escompte?: string
  discount?: string
  iban?: string
  bic?: string
  lines?: ProductLine[]
  materialLines?: ProductLine[]
  laborLines?: ProductLine[]
  acomptesEnabled?: boolean
  acomptes?: unknown[]
  notes?: string
}

interface DownloadContext {
  locale: Locale
  t: (k: string) => string
  artisan: { id?: string; company_name?: string | null; logo_url?: string | null; rm?: string | null; rc_pro?: string | null } | null
  /** Force le rendu BTP (V3). Par défaut, utilise V2 (design Vitfix Pro compact, identique à l'Aperçu). */
  useBtpDesign?: boolean
}

function svgToImageDataUrl(svgString: string, width: number, height: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width * 2
      canvas.height = height * 2
      const ctx = canvas.getContext('2d')!
      ctx.scale(2, 2)
      ctx.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG render failed')) }
    img.src = url
  })
}

function currencyFormat(n: number, locale: Locale): string {
  const fmt = new Intl.NumberFormat(locale === 'pt' ? 'pt-PT' : 'fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
  return fmt.replace(/[\u202F\u00A0]/g, ' ') + ' €'
}

// ─── Fetch fresh artisan data (logo + insurance) from profiles_artisan ─────
// Align with DevisFactureForm.freshArtisanData behavior (priorise les valeurs
// sauvegardées dans le devis, puis fallback Supabase, puis cache du contexte).
async function fetchFreshArtisanData(
  artisanId: string | undefined,
  doc: SavedDevis,
  cachedLogoUrl: string | null,
): Promise<{
  logoUrl: string | null
  insuranceName: string | null
  insuranceNumber: string | null
  insuranceCoverage: string | null
  insuranceType: 'rc_pro' | 'decennale' | 'both' | null
}> {
  let logoUrl: string | null = cachedLogoUrl
  let insuranceName: string | null = doc.insuranceName || null
  let insuranceNumber: string | null = doc.insuranceNumber || null
  let insuranceCoverage: string | null = doc.insuranceCoverage || null
  let insuranceType: 'rc_pro' | 'decennale' | 'both' | null = doc.insuranceType || null

  if (!artisanId) return { logoUrl, insuranceName, insuranceNumber, insuranceCoverage, insuranceType }

  try {
    const { data } = await supabase
      .from('profiles_artisan')
      .select('logo_url, insurance_name, insurance_number, insurance_coverage, insurance_type')
      .eq('id', artisanId)
      .single()
    if (data?.logo_url) logoUrl = data.logo_url as string
    if (data?.insurance_name && !insuranceName) insuranceName = data.insurance_name as string
    if (data?.insurance_number && !insuranceNumber) insuranceNumber = data.insurance_number as string
    if (data?.insurance_coverage && !insuranceCoverage) insuranceCoverage = data.insurance_coverage as string
    if (data?.insurance_type && !insuranceType) insuranceType = data.insurance_type as 'rc_pro' | 'decennale' | 'both'
  } catch { /* fallback to cached values */ }

  return { logoUrl, insuranceName, insuranceNumber, insuranceCoverage, insuranceType }
}

// ─── V2 path — design compact Vitfix Pro (identique à l'Aperçu) ────────────
async function downloadWithV2(doc: SavedDevis, ctx: DownloadContext): Promise<void> {
  const { artisan } = ctx
  const lines: ProductLine[] = (doc.lines as ProductLine[]) || []
  const materialLines = (doc.materialLines as ProductLine[]) || []
  const laborLines = (doc.laborLines as ProductLine[]) || []
  const mergedLines = lines.length > 0 ? lines : [...laborLines, ...materialLines]

  const fresh = await fetchFreshArtisanData(artisan?.id, doc, artisan?.logo_url ?? null)

  const delayStr = doc.executionDelay
    || (doc.executionDelayDays && doc.executionDelayDays > 0
      ? `${doc.executionDelayDays} ${doc.executionDelayType === 'calendaires' ? 'jours calendaires' : 'jours ouvrés'}`
      : 'À convenir')

  const input = buildV2Input({
    // Artisan
    logoUrl: fresh.logoUrl,
    companyName: doc.companyName || '',
    artisanCompanyName: artisan?.company_name ?? undefined,
    companySiret: doc.companySiret || '',
    artisanRm: (artisan?.rm as string | null) ?? null,
    companyAddress: doc.companyAddress || '',
    companyPhone: doc.companyPhone || '',
    companyEmail: doc.companyEmail || '',
    artisanRcPro: (artisan?.rc_pro as string | null) ?? null,
    insuranceName: fresh.insuranceName,
    insuranceNumber: fresh.insuranceNumber,
    insuranceCoverage: fresh.insuranceCoverage,
    insuranceType: fresh.insuranceType,
    tvaEnabled: doc.tvaEnabled !== false,
    paymentMode: doc.paymentMode || 'Virement bancaire',
    paymentCondition: doc.paymentCondition || doc.escompte || '',

    // Client
    clientName: doc.clientName || '',
    clientSiret: doc.clientSiret || null,
    clientAddress: doc.clientAddress || null,
    clientPhone: doc.clientPhone || null,
    clientEmail: doc.clientEmail || null,
    interventionAddress: doc.interventionAddress || null,
    interventionBatiment: doc.interventionBatiment || null,
    interventionEtage: doc.interventionEtage || null,
    interventionEspacesCommuns: doc.interventionEspacesCommuns || null,
    interventionExterieur: doc.interventionExterieur || null,

    // Document
    docType: doc.docType || 'devis',
    docNumber: doc.docNumber || '',
    docTitle: doc.docTitle || '',
    docDate: doc.docDate || new Date().toISOString().split('T')[0],
    docValidity: doc.docValidity || 30,
    executionDelay: delayStr,
    prestationDate: doc.prestationDate || doc.docDate || '',

    // Lines
    lines: mergedLines,

    // Acomptes
    acomptesEnabled: doc.acomptesEnabled || false,
    acomptes: (doc.acomptes as DevisAcompte[]) || [],

    // Notes & mediator
    notes: doc.notes || '',
    mediatorName: doc.mediatorName || '',
    mediatorUrl: doc.mediatorUrl || '',

    // Flags
    isHorsEtablissement: doc.isHorsEtablissement ?? (doc.clientType === 'particulier'),
  })

  const { generateDevisPdfV2 } = await import('@/lib/pdf/devis-generator-v2')
  const pdf = await generateDevisPdfV2(input)
  pdf.save(`${doc.docNumber || 'devis'}.pdf`)
}

// ─── V3 path — design BTP (inchangé, utilisé uniquement par pro_societe) ───
async function downloadWithV3(doc: SavedDevis, ctx: DownloadContext): Promise<void> {
  const { locale, t, artisan } = ctx
  const lines: ProductLine[] = (doc.lines as ProductLine[]) || []
  const materialLines = (doc.materialLines as ProductLine[]) || []
  const laborLines = (doc.laborLines as ProductLine[]) || []

  const sum = (arr: ProductLine[]) => arr.reduce((s, l) => s + (l.totalHT || 0), 0)
  const subtotalHT = sum([...lines, ...materialLines, ...laborLines])
  const tvaEnabled = doc.tvaEnabled !== false
  const totalTTC = tvaEnabled
    ? lines.concat(materialLines, laborLines).reduce((s, l) => s + (l.totalHT || 0) * (1 + (l.tvaRate || 0) / 100), 0)
    : subtotalHT

  const statusCode = mapLegalFormToCode(doc.companyStatus || '')

  const delayStr = doc.executionDelay
    || (doc.executionDelayDays && doc.executionDelayDays > 0
      ? `${doc.executionDelayDays} ${doc.executionDelayType === 'calendaires' ? 'jours calendaires' : 'jours ouvrés'}`
      : '')

  await generateDevisPdfV3({
    action: 'download',
    locale,
    localeFormats: {
      currencyFormat: (n: number) => currencyFormat(n, locale),
      taxLabel: locale === 'pt' ? 'IVA' : 'TVA',
    },
    t,
    docType: doc.docType || 'devis',
    docNumber: doc.docNumber || '',
    docTitle: doc.docTitle || `${doc.docType === 'facture' ? 'Facture' : 'Devis'} ${doc.docNumber || ''}`,
    docDate: doc.docDate || new Date().toISOString().split('T')[0],
    docValidity: doc.docValidity || 30,
    prestationDate: doc.prestationDate || doc.docDate || '',
    executionDelay: delayStr,
    companyStatus: statusCode,
    companyName: doc.companyName || artisan?.company_name || '',
    companySiret: doc.companySiret || '',
    companyAddress: doc.companyAddress || '',
    companyRCS: doc.companyRCS || '',
    companyCapital: doc.companyCapital || '',
    companyPhone: doc.companyPhone || '',
    companyEmail: doc.companyEmail || '',
    tvaEnabled,
    tvaNumber: doc.tvaNumber || '',
    companyAPE: doc.companyAPE || '',
    insuranceName: doc.insuranceName || '',
    insuranceNumber: doc.insuranceNumber || '',
    insuranceCoverage: doc.insuranceCoverage || '',
    insuranceType: doc.insuranceType || 'rc_pro',
    mediatorName: doc.mediatorName || '',
    mediatorUrl: doc.mediatorUrl || '',
    isHorsEtablissement: doc.isHorsEtablissement ?? (doc.clientType === 'particulier'),
    clientName: doc.clientName || '',
    clientEmail: doc.clientEmail || '',
    clientAddress: doc.clientAddress || '',
    clientPhone: doc.clientPhone || '',
    clientSiret: doc.clientSiret || '',
    clientType: doc.clientType || 'particulier',
    interventionAddress: doc.interventionAddress || '',
    interventionBatiment: doc.interventionBatiment || '',
    interventionEtage: doc.interventionEtage || '',
    interventionEspacesCommuns: doc.interventionEspacesCommuns || '',
    interventionExterieur: doc.interventionExterieur || '',
    paymentMode: doc.paymentMode || 'Virement bancaire',
    paymentDue: doc.paymentDelay || doc.paymentDue || '30 jours',
    paymentCondition: doc.paymentCondition || doc.escompte || '',
    discount: doc.discount || '',
    penaltyRate: doc.penaltyRate || '',
    recoveryFee: doc.recoveryFee || '',
    iban: doc.iban || '',
    bic: doc.bic || '',
    lines: lines.length > 0 ? lines : [...laborLines, ...materialLines],
    laborLines: laborLines.length > 0 ? laborLines : undefined,
    materialLines: materialLines.length > 0 ? materialLines : undefined,
    subtotalHT,
    totalTTC,
    acomptesEnabled: doc.acomptesEnabled || false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    acomptes: (doc.acomptes as any) || [],
    notes: doc.notes || '',
    sourceDevisRef: null,
    signatureData: null,
    attachedRapport: null,
    selectedPhotos: [],
    artisan: artisan ? {
      id: artisan.id,
      logo_url: artisan.logo_url || undefined,
      company_name: artisan.company_name || undefined,
      rm: (artisan.rm as string | undefined) || doc.companyRCS || undefined,
      rc_pro: (artisan.rc_pro as string | undefined) || doc.insuranceNumber || undefined,
    } : null,
    ptFiscalData: null,
    svgToImageDataUrl,
    fetchFreshLogo: async () => {
      if (!artisan?.id) return artisan?.logo_url || null
      try {
        const { data } = await supabase.from('profiles_artisan').select('logo_url').eq('id', artisan.id).single()
        return (data?.logo_url as string) || artisan.logo_url || null
      } catch {
        return artisan.logo_url || null
      }
    },
  })
}

export async function downloadSavedDevis(doc: SavedDevis, ctx: DownloadContext): Promise<void> {
  if (ctx.useBtpDesign) {
    return downloadWithV3(doc, ctx)
  }
  return downloadWithV2(doc, ctx)
}
