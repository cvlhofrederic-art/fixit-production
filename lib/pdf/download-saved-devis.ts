/**
 * Télécharge directement un devis sauvegardé depuis la liste (sans ouvrir le formulaire).
 *
 * Deux chemins de rendu :
 *  - Artisan / non-BTP (défaut) → generateDevisPdfV2 (design compact Vitfix Pro, identique à l'Aperçu)
 *  - BTP pro (orgRole === 'pro_societe' → useBtpDesign: true) → generateDevisPdfV3 (design BTP)
 *
 * Reconstruit les paramètres attendus par chaque générateur à partir du document en localStorage.
 *
 * `produireFichierDocument` rend le même fichier sans le télécharger : le téléchargement groupé des listes
 * Devis et Factures (lib/pdf/telechargement-groupe.ts) les rassemble dans une archive ZIP.
 */

import type { Locale } from '@/lib/i18n/config'
import type { ProductLine, DevisAcompte, CustomTable, FraisAnnexeItem } from '@/lib/devis-types'
import { supabase } from '@/lib/supabase'
import { generateDevisPdfV3 } from '@/lib/pdf/devis-pdf-v3'
import { getDecennaleEligibility } from '@/lib/decennale-eligibility'
import { buildV2Input, type BuildV2InputParams } from '@/lib/pdf/build-v2-input'
import { sumMoney, round2, mulMoney } from '@/lib/money'
import { mapLegalFormToCode, resolveTvaEnabledV2 } from '@/lib/devis-utils'
import { svgToImageDataUrl } from '@/lib/signature-canvas'
import { computeTva, type TvaRegime } from '@/lib/tva-calculator'
import { buildDocumentLines } from '@/lib/devis-totals'
import { aUneRemiseDeLigne, appliquerRemiseGlobale, libelleRemiseGlobale, lireRemise } from '@/lib/remise-commerciale'
import { modeleDocumentSociete } from '@/lib/pdf/modele-provence-pro'
import { champsDocumentBtp } from '@/lib/devis-btp-libelles'

export interface SavedDevis {
  id?: string
  docType?: 'devis' | 'facture'
  docNumber?: string
  docTitle?: string
  docDate?: string
  docValidity?: number
  prestationDate?: string
  /** Sous-type facture (méthode pro 2026, cf. lib/devis-types.ts). */
  factureSubType?: 'standard' | 'acompte' | 'situation' | 'avoir'
  situationNumber?: number
  situationAvancement?: number
  // Métadonnées acompte/avoir — pilotent le label réglementaire du PDF
  // (« Acompte N°X sur Y — Z% (sur facture …) », « AVOIR sur facture … » + motif).
  // Sans elles, le téléchargement depuis la liste affichait un label nu.
  acompteOrdre?: number
  acompteTotal?: number
  acomptePourcentage?: number
  parentInvoiceNumber?: string
  avoirMotif?: string
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
  // Régime TVA appliqué au document — source de vérité pour les mentions et totaux
  // (cf. lib/tva-calculator.ts). Si absent, on infère via `autoliquidationBTP`
  // (legacy flag) ou `tvaEnabled` (franchise quand false).
  regimeTva?: TvaRegime
  autoliquidationBTP?: boolean
  /** N° TVA intra du preneur (override manuel). Sinon PDF V3 calcule auto. */
  tvaIntraPreneur?: string
  /** Infos gestion déchets (loi AGEC, art. D.541-45-1 C. env.). */
  dechetsChantier?: {
    nature?: string
    quantiteEstimee?: string
    unite?: string
    installationNom?: string
    installationAdresse?: string
    modalitesTri?: string
    coutGestion?: string
  }
  /** Caractérisation sous-traitance (loi n°75-1334 du 31/12/1975) — autoliq BTP. */
  marchePrincipalRef?: string
  maitreOuvrageFinal?: string
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
  /** Document artisan enregistré depuis la correction de l'escompte : le PDF l'imprime. */
  escompteSurPdf?: boolean
  /** Remise commerciale sur le total (lib/remise-commerciale.ts). */
  remiseGlobale?: unknown
  iban?: string
  bic?: string
  lines?: ProductLine[]
  materialLines?: ProductLine[]
  laborLines?: ProductLine[]
  acomptesEnabled?: boolean
  acomptes?: unknown[]
  notes?: string
}

export interface DownloadContext {
  locale: Locale
  t: (k: string) => string
  artisan: { id?: string; company_name?: string | null; logo_url?: string | null; rm?: string | null; rc_pro?: string | null } | null
  /** Force le rendu BTP (V3). Par défaut, utilise V2 (design Vitfix Pro compact, identique à l'Aperçu). */
  useBtpDesign?: boolean
}

/** PDF d'un document enregistré, tel que le bouton « Télécharger » de la liste le produit. */
export interface FichierDocument {
  nom: string
  octets: Uint8Array
}

// svgToImageDataUrl : extrait dans lib/signature-canvas.ts (3e copie identique
// détectée par SonarCloud — partagé avec les deux formulaires devis).

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
  categories: string[] | null
  typeActivite: string | null
}> {
  let logoUrl: string | null = cachedLogoUrl
  let insuranceName: string | null = doc.insuranceName || null
  let insuranceNumber: string | null = doc.insuranceNumber || null
  let insuranceCoverage: string | null = doc.insuranceCoverage || null
  let insuranceType: 'rc_pro' | 'decennale' | 'both' | null = doc.insuranceType || null
  let categories: string[] | null = null
  let typeActivite: string | null = null

  if (!artisanId) return { logoUrl, insuranceName, insuranceNumber, insuranceCoverage, insuranceType, categories, typeActivite }

  try {
    const { data } = await supabase
      .from('profiles_artisan')
      .select('logo_url, insurance_name, insurance_number, insurance_coverage, insurance_type, categories, type_activite')
      .eq('id', artisanId)
      .single()
    if (data?.logo_url) logoUrl = data.logo_url as string
    if (data?.insurance_name && !insuranceName) insuranceName = data.insurance_name as string
    if (data?.insurance_number && !insuranceNumber) insuranceNumber = data.insurance_number as string
    if (data?.insurance_coverage && !insuranceCoverage) insuranceCoverage = data.insurance_coverage as string
    if (data?.insurance_type && !insuranceType) insuranceType = data.insurance_type as 'rc_pro' | 'decennale' | 'both'
    if (Array.isArray(data?.categories)) categories = data.categories as string[]
    if (typeof data?.type_activite === 'string') typeActivite = data.type_activite as string
  } catch { /* fallback to cached values */ }

  return { logoUrl, insuranceName, insuranceNumber, insuranceCoverage, insuranceType, categories, typeActivite }
}

// ─── V2 path — design compact Vitfix Pro (identique à l'Aperçu) ────────────
// `enregistrerBrut` : présent quand l'habillage PDF/A-3 a échoué ; le bouton de la ligne enregistre alors le PDF
// brut par jsPDF (pdf.save), comme avant le téléchargement groupé.
async function produireFichierV2(
  doc: SavedDevis,
  ctx: DownloadContext,
): Promise<FichierDocument & { enregistrerBrut?: () => void }> {
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

  // Document qui porte une remise commerciale (enregistré depuis la remise, donc jamais un document
  // antérieur) : mêmes données que le formulaire artisan (matériaux, frais annexes, tableaux
  // personnalisés, détail de TVA remisé), pour que la remise porte sur tout le document et que le PDF
  // téléchargé depuis la liste soit celui du formulaire. Les autres documents gardent leur PDF d'origine.
  // Lectures protégées (stockage local parfois incomplet) : un document sans remise ne doit jamais
  // échouer ici, puisqu'il ne lisait pas ces champs avant.
  const docBrut = doc as Record<string, unknown>
  const tablesDoc = (Array.isArray(docBrut.customTables) ? docBrut.customTables as unknown[] : [])
    .filter((t): t is CustomTable => !!t && typeof t === 'object' && Array.isArray((t as CustomTable).lines))
  const fraisDoc = (Array.isArray(docBrut.fraisAnnexes) ? docBrut.fraisAnnexes as unknown[] : [])
    .filter((f): f is FraisAnnexeItem => !!f && typeof f === 'object')
  const materiauxDoc = lines.length > 0 && Array.isArray(materialLines) ? materialLines : []
  const avecRemise = lireRemise(doc.remiseGlobale) !== null
    || aUneRemiseDeLigne([...mergedLines, ...materiauxDoc, ...tablesDoc.flatMap((t) => t.lines)])
  let donneesRemise: Pick<BuildV2InputParams, 'materialLines' | 'fraisAnnexes' | 'customTables' | 'tvaBreakdown'> = {}
  if (avecRemise) {
    const calcul = appliquerRemiseGlobale([
      ...[...mergedLines, ...materiauxDoc, ...tablesDoc.flatMap((t) => t.lines)]
        .filter(Boolean)
        .map((l) => ({ totalHT: l.totalHT || 0, tvaRate: l.tvaRate || 0 })),
      ...fraisDoc.map((f) => ({ totalHT: f.total_ht || 0, tvaRate: f.tva_applicable || 0 })),
    ], doc.remiseGlobale)
    donneesRemise = {
      materialLines: materiauxDoc,
      fraisAnnexes: fraisDoc,
      customTables: tablesDoc,
      tvaBreakdown: resolveTvaEnabledV2(doc)
        ? calcul.bases
          .map((b) => ({ rate: b.taux, base: b.base, amount: mulMoney(b.base, b.taux / 100) }))
          .sort((a, b) => b.rate - a.rate)
        : undefined,
    }
  }

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
    // Legacy sans flag : inférence franchise 293 B depuis companyStatus
    // (EI/auto FR, ENI PT) — cf. resolveTvaEnabledV2 (audit 2026-06-10).
    tvaEnabled: resolveTvaEnabledV2(doc),
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
    // Antidatage interdit (art. 1737-II CGI, pénalité jusqu'à 50 %) : pour une
    // facture brouillon, la date d'émission au PDF est la date de génération
    // (today), jamais le docDate hérité du devis. Aligné art. 289 CGI + pratique
    // Henrri/EBP/Pennylane/Sage. Une facture déjà émise (sentAt présent) garde
    // sa date historique pour l'archivage probant (arrêté 22 mars 2017).
    docDate: (() => {
      const today = new Date().toISOString().split('T')[0]
      const sentAt = (doc as { sentAt?: string }).sentAt
      if (doc.docType === 'facture' && !sentAt) return today
      return doc.docDate || today
    })(),
    docValidity: doc.docValidity || 30,
    executionDelay: delayStr,
    // prestationDate : si vide → reste vide → V3 affiche « À convenir ».
    // Avant : fallback sur doc.docDate (date du jour) → PDF affichait à tort
    // la date d'émission dans la case DATE PRESTATION.
    prestationDate: doc.prestationDate || '',
    // Sous-type facture (méthode pro 2026) — pilote le label PDF
    factureSubType: doc.factureSubType,
    situationNumber: doc.situationNumber,
    situationAvancement: doc.situationAvancement,
    // Métadonnées acompte/avoir → label réglementaire complet du PDF (sinon
    // « FACTURE D'ACOMPTE » nu au download depuis la liste vs aperçu in-form).
    acompteOrdre: doc.acompteOrdre,
    acompteTotal: doc.acompteTotal,
    acomptePourcentage: doc.acomptePourcentage,
    parentInvoiceNumber: doc.parentInvoiceNumber,
    avoirMotif: doc.avoirMotif,

    // Lines
    lines: mergedLines,
    ...donneesRemise,
    // Remise commerciale (lib/remise-commerciale.ts) et escompte saisi : l'escompte n'est imprimé
    // que pour un document enregistré depuis la correction (escompteSurPdf), les autres gardent
    // la mention « Aucun escompte accordé » de leur PDF d'origine.
    remiseGlobale: doc.remiseGlobale,
    escompte: doc.escompteSurPdf === true ? (doc.discount || '') : undefined,

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
  const nom = `${doc.docNumber || 'devis'}.pdf`

  // FR-V2 : wrap as PDF/A-3B for archivage probant (arrêté 22 mars 2017).
  // Sans ça, l'archive numérique peut être requalifiée en non-probante par
  // un contrôle DGFiP, exigeant l'original papier.
  try {
    const [{ wrapAsPdfA3 }] = await Promise.all([
      import('@/lib/pdf/pdfa3-wrap'),
    ])
    const pdfArrayBuffer = pdf.output('arraybuffer') as ArrayBuffer
    const pdfBytes = new Uint8Array(pdfArrayBuffer)
    const docTitle = doc.docType === 'facture'
      ? `Facture ${doc.docNumber || ''}`
      : `Devis ${doc.docNumber || ''}`
    const wrapped = await wrapAsPdfA3(pdfBytes, {
      title: docTitle.trim(),
      author: input.artisan.nom,
    })
    return { nom, octets: wrapped }
  } catch (e) {
    // Fallback : si le wrapping échoue, on garde au moins le PDF non-PDF/A
    // pour que le user ait son téléchargement.
    console.warn('[download-saved-devis] PDF/A-3 wrap failed, falling back to plain PDF:', e)
    return {
      nom,
      octets: new Uint8Array(pdf.output('arraybuffer') as ArrayBuffer),
      enregistrerBrut: () => { pdf.save(nom) },
    }
  }
}

async function downloadWithV2(doc: SavedDevis, ctx: DownloadContext): Promise<void> {
  const { nom, octets, enregistrerBrut } = await produireFichierV2(doc, ctx)
  if (enregistrerBrut) {
    enregistrerBrut()
    return
  }
  // Trigger download via Blob (jsPDF.save équivalent)
  const blob = new Blob([new Uint8Array(octets).buffer as ArrayBuffer], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nom
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── V3 path — design BTP (inchangé, utilisé uniquement par pro_societe) ───
// `action` : 'download' (bouton de la liste) ou 'fichier' (téléchargement groupé : rien n'est téléchargé ici,
// le fichier final — Factur-X compris — est rendu à l'appelant).
async function genererAvecV3(
  doc: SavedDevis,
  ctx: DownloadContext,
  action: 'download' | 'fichier',
): Promise<Awaited<ReturnType<typeof generateDevisPdfV3>>> {
  const { locale, t, artisan } = ctx
  // Pas de re-construction locale des collections sommées : la source
  // unique de vérité est `buildDocumentLines` (lib/devis-totals.ts). Elle
  // applique les règles communes (laborLines > lines, masquage
  // materialLines/fraisLines si leur flag Enabled === false, aplatissement
  // customTables, filtres null-safe). Tout site qui sommait à la main
  // pouvait diverger — régression DEV-2026-005 (+2 800 € phantom).
  const sourceLines = buildDocumentLines(doc as unknown as Parameters<typeof buildDocumentLines>[0]) as ProductLine[]
  // Champs encore référencés par le payload V3 (sections rendues, noms,
  // flags) — réutilisés tels quels pour respecter la forme attendue par
  // `generateDevisPdfV3`.
  const lines: ProductLine[] = (doc.lines as ProductLine[]) || []
  const materialLines = (doc.materialLines as ProductLine[]) || []
  const laborLinesRaw = (doc.laborLines as ProductLine[]) || []
  const fraisLines = ((doc as Record<string, unknown>).fraisLines as ProductLine[]) || []
  const customTables = ((doc as Record<string, unknown>).customTables as { id: string; name: string; category?: 'labor' | 'material' | 'frais'; lines: ProductLine[] }[]) || []
  const labor = laborLinesRaw.length > 0 ? laborLinesRaw : lines
  // Sommes via centimes entiers (sumMoney) — zéro drift IEEE 754.
  const subtotalHT = sumMoney(sourceLines.map(l => l.totalHT || 0))
  const tvaEnabled = doc.tvaEnabled !== false

  // Régime TVA effectif — source unique de vérité (lib/tva-calculator.ts).
  // Le flag explicite `regimeTva` (form V3 actuel) prime ; fallback rétro-compat :
  // `autoliquidationBTP=true` → 'autoliquidation_btp' ; `tvaEnabled=false` →
  // 'franchise_293b' ; sinon 'classique'. Sans ce fix, le bouton « Télécharger »
  // ignorait silencieusement le régime persisté et rendait toujours TVA classique.
  const effectiveRegime: TvaRegime =
    doc.regimeTva
      ?? (doc.autoliquidationBTP
        ? 'autoliquidation_btp'
        : (tvaEnabled ? 'classique' : 'franchise_293b'))
  const tva = computeTva({
    regime: effectiveRegime,
    lines: sourceLines
      .filter(l => (l.description || '').trim())
      .map(l => ({ totalHT: l.totalHT || 0, tvaRate: l.tvaRate || 0, horsRemise: l.horsRemise === true })),
    locale: locale === 'pt' ? 'pt' : 'fr',
    // Remise commerciale (lib/remise-commerciale.ts) : absente → totaux inchangés.
    remiseGlobale: (doc as Record<string, unknown>).remiseGlobale,
  })
  const tvaBreakdown = tva.breakdown
  const totalTTC = tva.totalTTC
  const langueLibelle = locale === 'pt' ? 'pt' : 'fr'
  const remiseGlobaleV3 = tva.remiseHT !== 0
    ? { montantHT: tva.remiseHT, libelle: libelleRemiseGlobale((doc as Record<string, unknown>).remiseGlobale, langueLibelle), base: tva.baseRemiseHT }
    : undefined

  const statusCode = mapLegalFormToCode(doc.companyStatus || '')

  // Délai, titre par défaut, type de client et rétractation : mêmes règles que
  // le formulaire BTP (lib/devis-btp-libelles.ts)
  const champs = champsDocumentBtp({
    locale,
    docType: doc.docType, docNumber: doc.docNumber, docTitle: doc.docTitle, factureSubType: doc.factureSubType,
    executionDelay: doc.executionDelay, executionDelayDays: doc.executionDelayDays, executionDelayType: doc.executionDelayType,
    clientType: doc.clientType, clientSiret: doc.clientSiret, isHorsEtablissement: doc.isHorsEtablissement,
  })

  // Fallback IBAN/BIC pour les devis legacy enregistrés avant la persistance
  // (cf. DevisFactureFormBTP.buildPayload, fix 06/05/2026). Les devis créés
  // après le fix ont iban/bic dans `doc` ; les anciens doivent re-fetcher le
  // profil paiement pour que le RIB apparaisse au téléchargement.
  let resolvedIban = doc.iban || ''
  let resolvedBic = doc.bic || ''
  let artisanCategories: string[] | null = null
  let artisanTypeActivite: string | null = null
  // Identité légale de la société (Mon profil) : reprise quand le document
  // enregistré a le champ vide, comme le fait le formulaire BTP à l'ouverture.
  let fiche: { siret?: string | null; company_address?: string | null; rcs_number?: string | null
    share_capital?: string | null; tva_intra?: string | null; ape_code?: string | null } = {}
  if (artisan?.id) {
    try {
      const { data } = await supabase
        .from('profiles_artisan')
        .select('paiement_modes, categories, type_activite, siret, company_address, rcs_number, share_capital, tva_intra, ape_code')
        .eq('id', artisan.id)
        .single()
      if (data) fiche = data as typeof fiche
      const modes = (data?.paiement_modes as Array<{ type?: string; iban?: string; bic?: string; actif?: boolean }>) || []
      const virement = modes.find(
        (m) => m.type === 'virement' && m.actif !== false && (m.iban || '').trim().length > 0,
      )
      if (virement && !resolvedIban) {
        resolvedIban = (virement.iban || '').trim()
        resolvedBic = (virement.bic || '').trim()
      }
      if (Array.isArray(data?.categories)) artisanCategories = data.categories as string[]
      if (typeof data?.type_activite === 'string') artisanTypeActivite = data.type_activite as string
    } catch (e) {
      console.warn('[download-saved-devis] Loading profile data failed:', e)
    }
  }

  return generateDevisPdfV3({
    action,
    locale,
    localeFormats: {
      currencyFormat: (n: number) => currencyFormat(n, locale),
      taxLabel: locale === 'pt' ? 'IVA' : 'TVA',
    },
    t,
    docType: doc.docType || 'devis',
    docNumber: doc.docNumber || '',
    docTitle: champs.docTitle,
    // Antidatage interdit (art. 1737-II CGI, pénalité jusqu'à 50 %) : pour une
    // facture brouillon, la date d'émission au PDF est la date de génération
    // (today). Aligné art. 289 CGI + pratique Henrri/EBP/Pennylane/Sage.
    // Une facture déjà émise (sentAt) garde sa date historique (arrêté
    // 22 mars 2017 — archivage probant).
    docDate: (() => {
      const today = new Date().toISOString().split('T')[0]
      const sentAt = (doc as { sentAt?: string }).sentAt
      if (doc.docType === 'facture' && !sentAt) return today
      return doc.docDate || today
    })(),
    docValidity: doc.docValidity || 30,
    // prestationDate : si vide → reste vide → V3 affiche « À convenir ».
    // Avant : fallback sur doc.docDate (date du jour) → PDF affichait à tort
    // la date d'émission dans la case DATE PRESTATION lors d'un download depuis
    // la liste devis (path BTP). PR #108 avait fixé le path V2 (ligne 204) mais
    // raté ce path V3. Symptôme : preview = « À convenir » ✓, download = date ✗.
    prestationDate: doc.prestationDate || '',
    // Sous-type facture (méthode pro 2026) — pilote le label PDF V3
    factureSubType: doc.factureSubType,
    situationNumber: doc.situationNumber,
    situationAvancement: doc.situationAvancement,
    // Métadonnées acompte/avoir → label réglementaire complet du PDF (sinon
    // « FACTURE D'ACOMPTE » nu au download depuis la liste vs aperçu in-form).
    acompteOrdre: doc.acompteOrdre,
    acompteTotal: doc.acompteTotal,
    acomptePourcentage: doc.acomptePourcentage,
    parentInvoiceNumber: doc.parentInvoiceNumber,
    avoirMotif: doc.avoirMotif,
    executionDelay: champs.executionDelay,
    companyStatus: statusCode,
    companyName: doc.companyName || artisan?.company_name || '',
    companySiret: doc.companySiret || fiche.siret || '',
    companyAddress: doc.companyAddress || fiche.company_address || '',
    companyRCS: doc.companyRCS || fiche.rcs_number || '',
    companyCapital: doc.companyCapital || fiche.share_capital || '',
    companyPhone: doc.companyPhone || '',
    companyEmail: doc.companyEmail || '',
    tvaEnabled,
    tvaNumber: doc.tvaNumber || fiche.tva_intra || '',
    companyAPE: doc.companyAPE || fiche.ape_code || '',
    insuranceName: doc.insuranceName || '',
    insuranceNumber: doc.insuranceNumber || '',
    insuranceCoverage: doc.insuranceCoverage || '',
    insuranceType: doc.insuranceType || 'rc_pro',
    decennaleEligibility: getDecennaleEligibility(artisanCategories ?? artisanTypeActivite),
    mediatorName: doc.mediatorName || '',
    mediatorUrl: doc.mediatorUrl || '',
    isHorsEtablissement: champs.isHorsEtablissement,
    clientName: doc.clientName || '',
    clientEmail: doc.clientEmail || '',
    clientAddress: doc.clientAddress || '',
    clientPhone: doc.clientPhone || '',
    clientSiret: doc.clientSiret || '',
    clientType: champs.clientType,
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
    iban: resolvedIban,
    bic: resolvedBic,
    lines: lines.length > 0 ? lines : [...labor, ...materialLines],
    // V3 PDF rend `laborLines` comme première section ; on lui passe le résultat
    // résolu (laborLinesRaw si présent, sinon `lines` legacy) pour garantir que
    // la section principale (souvent "DÉMOLITION") s'affiche.
    laborLines: labor.length > 0 ? labor : undefined,
    materialLines: materialLines.length > 0 ? materialLines : undefined,
    fraisLines: fraisLines.length > 0 ? fraisLines : undefined,
    linesName: ((doc as Record<string, unknown>).linesName as string) || undefined,
    materialLinesName: ((doc as Record<string, unknown>).materialLinesName as string) || undefined,
    fraisLinesName: ((doc as Record<string, unknown>).fraisLinesName as string) || undefined,
    materialLinesEnabled: ((doc as Record<string, unknown>).materialLinesEnabled as boolean) ?? undefined,
    fraisLinesEnabled: ((doc as Record<string, unknown>).fraisLinesEnabled as boolean) ?? undefined,
    customTables: customTables.length > 0 ? customTables : undefined,
    // Document remisé : HT net (base de la TVA) + HT brut et remise pour le bloc des totaux.
    // Sans remise : sous-total d'origine, inchangé.
    subtotalHT: remiseGlobaleV3 ? tva.totalHT : subtotalHT,
    totalTTC,
    ...(remiseGlobaleV3 ? { totalHTBrut: tva.totalHTBrut, remiseGlobale: remiseGlobaleV3 } : {}),
    // Breakdown vide en franchise/autoliquidation (computeTva force []),
    // donc undefined dans le PDF (pas de ligne TVA détail).
    tvaBreakdown: tvaBreakdown.length > 0 ? tvaBreakdown : undefined,
    // Régime + flag legacy passés au PDF V3 pour piloter mentions, colonnes
    // et label total. PDF V3 priorise `regimeTva` sur `autoliquidationBTP`.
    regimeTva: effectiveRegime,
    autoliquidationBTP: effectiveRegime === 'autoliquidation_btp',
    tvaIntraPreneur: doc.tvaIntraPreneur || undefined,
    dechetsChantier: doc.dechetsChantier || undefined,
    marchePrincipalRef: doc.marchePrincipalRef || undefined,
    maitreOuvrageFinal: doc.maitreOuvrageFinal || undefined,
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
    // Modèle propre à la société (Provence Pro uniquement) ; sinon modèle BTP par défaut
    modele: modeleDocumentSociete(artisan?.id),
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
    await genererAvecV3(doc, ctx, 'download')
    return
  }
  return downloadWithV2(doc, ctx)
}

/** Même PDF que `downloadSavedDevis`, rendu à l'appelant au lieu d'être téléchargé. */
export async function produireFichierDocument(doc: SavedDevis, ctx: DownloadContext): Promise<FichierDocument> {
  if (ctx.useBtpDesign) {
    const { filename, fichier } = await genererAvecV3(doc, ctx, 'fichier')
    return { nom: filename, octets: fichier }
  }
  const { nom, octets } = await produireFichierV2(doc, ctx)
  return { nom, octets }
}
