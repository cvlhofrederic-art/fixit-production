/**
 * Devis PDF Generator V2 — V5 corrections
 * Matches spec: SPEC_PDF_VITFIX_PRO.md + devis_lepore_logo_arbre.pdf reference
 * Standalone generator — does NOT replace components/DevisFactureForm.tsx
 * Rollback: delete lib/pdf/ directory
 *
 * V2 = artisan / auto-entrepreneur / micro-entrepreneur / EI uniquement.
 *      Les SAS/SARL/SCI passent par BTP V3 (devis-pdf-v3.ts).
 *
 * Calculs centralisés via lib/money.ts (BOFiP §50, ROUND_HALF_UP).
 */

import { sumMoney, round2 } from '@/lib/money'
import { computeEcheanceDate } from '@/lib/pdf/payment-due'

// ─── Interfaces ───────────────────────────────────────────────

export interface DevisGeneratorInput {
  artisan: {
    logo_url: string | null
    nom: string
    siret: string
    rm: string | null
    adresse: string
    telephone: string
    email: string
    rc_pro: string | null
    insurance_name: string | null
    insurance_number: string | null
    insurance_coverage: string | null
    insurance_type: 'rc_pro' | 'decennale' | 'both' | null
    tva_mention: string
    mode_paiement: string
    condition_paiement?: string | null
    /** Nom commercial / marque affiché au-dessus du nom dans l'encadré EMETTEUR.
     *  PT : "Empresa : Vitfix" — FR : "Enseigne : MonEntreprise".
     *  Si null/vide, la ligne n'est pas affichée. */
    company_name?: string | null
    /** Codes d'activité affichés dans la boîte EMETTEUR.
     *  PT : CAE (Classificação Portuguesa das Atividades Económicas), ex: "81210, 38112".
     *  FR : APE/NAF (legacy non rendu pour l'instant côté V2, peut être ajouté).
     *  Affiché à la place de la ligne Assurance en PT — le seguro reste dans
     *  les mentions légales en pied de page. */
    cae?: string | null
  }
  client: {
    nom: string
    siret?: string | null
    adresse: string | null
    telephone: string | null
    email: string | null
    intervention_adresse?: string | null
    intervention_batiment?: string | null
    intervention_etage?: string | null
    intervention_espaces_communs?: string | null
    intervention_exterieur?: string | null
  }
  devis: {
    numero: string
    titre: string
    date_emission: Date
    validite_jours: number
    delai_execution: string
    date_prestation: Date | null
    docType?: 'devis' | 'facture'
    /** Sous-type facture (méthode pro 2026). Affiche un label explicite sous le
     *  numéro pour les types "acompte", "situation" et "avoir" (mentions
     *  légalement requises, art. 289 CGI / BOI-TVA-DECLA-30-20-20-30 §70 pour
     *  les avoirs). V2 cible artisan/EI ; pour la méthode pro BTP, utiliser V3. */
    factureSubType?: 'standard' | 'acompte' | 'situation' | 'avoir'
    situationNumber?: number
    situationAvancement?: number
    acompteOrdre?: number
    acompteTotal?: number
    acomptePourcentage?: number
    parentInvoiceNumber?: string
    avoirMotif?: string
    /** Source unique de vérité pour la date d'échéance facture (art. L441-10
     *  C. com.). Trois formats supportés via lib/pdf/payment-due.ts :
     *   - ISO date (YYYY-MM-DD) → override manuel direct
     *   - "X jours [fin de mois]" → emission + X (+ snap fin de mois)
     *   - "Comptant à réception" → emission (J0)
     *  Si null/vide → fallback validite_jours (30 par défaut). */
    paymentDue?: string | null
  }
  mode_affichage: 'bloc' | 'sections'
  lignes: LigneDevis[]
  etapes?: EtapeIntervention[]
  acomptes?: Acompte[]
  signature?: SignatureData
  notes?: string
  mediateur?: string
  mediateur_url?: string
  penalite_retard?: string
  /** Escompte pour paiement anticipé (art. L.441-9). Si présent, remplace la
   *  mention « aucun escompte accordé » sur le PDF. */
  escompte?: string | null
  dechets_chantier?: string // FIX FINAL #6: mention optionnelle déchets
  isHorsEtablissement?: boolean // Rétractation B2C hors établissement uniquement
  locale?: 'fr' | 'pt'
  // Ventilation TVA multi-taux passée par le form (auto-entrepreneur en TVA
  // après dépassement du seuil 293 B peut avoir 5,5/10/20%). Si vide ou
  // non fourni, V2 ignore (mode legacy single-rate).
  tvaBreakdown?: Array<{ rate: number; base: number; amount: number }>
  // Labels personnalisés pour les sections dynamiques (parité BTP V3 customTables).
  // Clés au format `custom_<tableId>` ou `labor` → label affiché. Merge avec
  // SECTION_LABELS au moment du rendu.
  customSectionLabels?: Record<string, string>
}

export interface LigneDevis {
  designation: string
  /** Description complémentaire libre saisie par l'utilisateur (entre titre et
   *  étapes). Rendue en gris 8pt sous le titre. Parité avec V3 BTP. */
  lineDetail?: string
  quantite: number
  unite: string
  prix_unitaire: number
  total: number
  // Section markers : sections statiques (main_oeuvre, materiaux…) ou dynamiques
  // (`custom_<id>`, `labor`) pour les tables custom de l'artisan V2 (parité BTP).
  section?: 'main_oeuvre' | 'materiaux' | 'deplacement' | 'location' | 'labor' | string | null
  etapes?: EtapeIntervention[]  // étapes rattachées à CETTE ligne
}

export interface EtapeIntervention {
  ordre: number
  designation: string
}

export interface Acompte {
  label: string
  montant: number
  pourcentage?: number // FIX FINAL #4
  declencheur: string
  statut: 'payé' | 'en attente'
}

export interface SignatureData {
  image_base64: string
  signe_le: Date
  signe_par: string
  ip_address?: string
}

// ─── Colors — spec palette, 7 couleurs uniquement ────────────

const COLOR = {
  TEXT:       '#0D0D0D',
  TEXT_LIGHT: '#888888',
  WHITE:      '#FFFFFF',
  BG_GRAY:    '#F5F5F3',
  BORDER:     '#E0E0DC',
  ACCENT:     '#FFD600',
  BLACK:      '#0D0D0D',
}

// ─── Layout constants (mm) — from JSPDF_COORDINATES.js ───────

const ML = 18.0             // marge gauche
const MR = 18.0             // marge droite
const EM_W = 83.11          // largeur encadré émetteur
const DEST_X0 = 104.99      // x début encadré destinataire
const DEST_W = 86.99         // largeur encadré destinataire
const TEXT_X_EM = 21.88      // x texte émetteur (ML + padding 3.88)
const TEXT_X_DEST = 108.87   // x texte destinataire
const BOX_H_MIN = 47.27     // hauteur min encadrés (134pt) — FIX #2

// ─── Helpers ─────────────────────────────────────────────────

const ptToMm = (pt: number) => pt / 2.835

function formatPrice(n: number): string {
  const parts = n.toFixed(2).split('.')
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return intPart + ',' + parts[1] + ' \u20AC'
}

function formatDate(d: Date, locale: 'fr-FR' | 'pt-PT' = 'fr-FR'): string {
  return d.toLocaleDateString(locale)
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)]
}

function formatUnitForPdf(unit: string, locale: 'fr' | 'pt' = 'fr'): string {
  const MAP_FR: Record<string, string> = { m2: 'm\u00B2', m3: 'm\u00B3', ml: 'ml', h: 'h', j: 'j', f: 'Forfait', u: 'u', L: 'L', kg: 'kg', t: 't', pce: 'pce', ens: 'ens', pt: 'pt', lot: 'Lot', m: 'm' }
  const MAP_PT: Record<string, string> = { m2: 'm\u00B2', m3: 'm\u00B3', ml: 'ml', h: 'h', j: 'j', f: 'Servi\u00E7o', u: 'u', L: 'L', kg: 'kg', t: 't', pce: 'pce', ens: 'ens', pt: 'pt', lot: 'Lote', m: 'm' }
  const MAP = locale === 'pt' ? MAP_PT : MAP_FR
  return MAP[unit] || unit
}

function cleanDescription(desc: string): string {
  return desc.replace(/\[unit:[^\]]*\]/gi, '').replace(/\[min:[^\]]*\]/gi, '').replace(/\[max:[^\]]*\]/gi, '').replace(/\s{2,}/g, ' ').trim()
}

/** Normalise une adresse ALL CAPS venant de l'API BAN en Title Case lisible */
function titleCaseAddress(addr: string): string {
  if (!addr) return addr
  if (addr !== addr.toUpperCase()) return addr
  const lowerWords = new Set(['de', 'du', 'des', 'le', 'la', 'les', 'l', 'en', 'et', 'au', 'aux', 'sur'])
  const abbrMap: Record<string, string> = {
    'RES': 'Rés.', 'RESIDENCE': 'Résidence', 'BAT': 'Bât.', 'BATIMENT': 'Bâtiment',
    'AV': 'Av.', 'AVENUE': 'Avenue', 'BD': 'Bd', 'BOULEVARD': 'Boulevard',
    'RUE': 'Rue', 'IMPASSE': 'Impasse', 'ALLEE': 'Allée', 'ALLÉE': 'Allée',
    'CHEMIN': 'Chemin', 'PLACE': 'Place', 'ROUTE': 'Route', 'COURS': 'Cours',
    'CEDEX': 'Cedex', 'ST': 'St', 'STE': 'Ste',
  }
  // First pass: split on spaces/commas, handle abbreviations and title case
  let result = addr.split(/(\s+|,\s*)/g).map((part, idx) => {
    const trimmed = part.trim()
    if (!trimmed || /^[\s,]+$/.test(part)) return part
    if (/^\d{5}$/.test(trimmed)) return trimmed
    if (abbrMap[trimmed]) return abbrMap[trimmed]
    const lower = trimmed.toLowerCase()
    if (idx > 0 && lowerWords.has(lower)) return lower
    return lower.charAt(0).toUpperCase() + lower.slice(1)
  }).join('')
  // FIX FINAL #2: Restore apostrophes — "L Aurore" → "L'Aurore", "D Azur" → "D'Azur"
  result = result.replace(/\b([LlDd])\s+([A-Za-zÀ-ÿ])/g, (_, letter, next) => {
    return letter.toUpperCase() + '\'' + next.toUpperCase()
  })
  // Capitalize after apostrophe if needed: "l'aurore" → "L'Aurore"
  result = result.replace(/'([a-zà-ÿ])/g, (_, c) => '\'' + c.toUpperCase())
  return result
}

/**
 * Sépare une adresse en {rue, ville} en extrayant le code postal.
 * "BATIMENT B RES L AURORE 13600 LA CIOTAT" → { rue: "Bât. B Rés. L'Aurore", ville: "13600 La Ciotat" }
 *
 * Défense en profondeur (12/05/2026) : certains profils artisan ont
 * `company_address` contenant la ville+code postal DEUX FOIS (artefact
 * parsing KBIS/SIRENE initial qui auto-concatène puis duplique). Sans
 * dé-duplication, le PDF V2 affichait "Ville : 13830 Roquefort, 13830
 * Roquefort". On dédoublonne en gardant uniquement la 1ère occurrence
 * unique d'une partie ville.
 */
function splitAddress(addr: string): { rue: string; ville: string } | null {
  if (!addr) return null
  const norm = titleCaseAddress(addr)
  // 1) FR : code postal 5 chiffres (75001, 13830...).
  // 2) PT : code postal 4-3 (XXXX-XXX, ex: 4430-319 Vila Nova de Gaia).
  //    On essaie PT d'abord parce qu'un préfixe 4 chiffres + tiret + 3 chiffres
  //    matcherait aussi le regex FR en mode "5 premiers chiffres" sur "4430-".
  const ptMatch = norm.match(/^(.+?)\s*,?\s*(\d{4}-\d{3})\s+(.+)$/)
  if (ptMatch) {
    const villeRaw = ptMatch[3].trim()
    const parts = villeRaw.split(/\s*,\s*/).map(p => p.trim()).filter(Boolean)
    // Dé-duplication ville (cf. dédoublonnage FR)
    const dedup: string[] = []
    for (const p of parts) {
      const normalized = p.replace(/\d{4}-\d{3}\s+/, '').toLowerCase().trim()
      if (dedup.length === 0) { dedup.push(p); continue }
      if (normalized === parts[0].replace(/\d{4}-\d{3}\s+/, '').toLowerCase()) continue
      dedup.push(p)
    }
    return { rue: ptMatch[1].replace(/,\s*$/, '').trim(), ville: `${ptMatch[2]} ${dedup.join(', ')}` }
  }
  const match = norm.match(/^(.+?)\s*,?\s*(\d{5})\s+(.+)$/)
  if (match) {
    // Dé-duplication ville : si "Ville1, Ville2" sont identiques après norm,
    // ne garder qu'une seule occurrence (cf. bug data profile_artisan).
    const villeRaw = match[3].trim()
    const parts = villeRaw.split(/\s*,\s*/).map(p => p.trim()).filter(Boolean)
    // Dédoublonne aussi sur le code postal en préfixe de la 2e partie
    const dedup: string[] = []
    for (const p of parts) {
      const normalized = p.replace(/\d{5}\s+/, '').toLowerCase().trim()
      const baseNorm = (match[2] + ' ' + parts[0].replace(/\d{5}\s+/, '')).toLowerCase().trim()
      if (dedup.length === 0) { dedup.push(p); continue }
      // Si ce segment normalisé est déjà couvert par le premier, skip
      if (normalized === parts[0].replace(/\d{5}\s+/, '').toLowerCase() || p.toLowerCase() === baseNorm) continue
      dedup.push(p)
    }
    const villeDedup = dedup.join(', ')
    return { rue: match[1].replace(/,\s*$/, '').trim(), ville: `${match[2]} ${villeDedup}` }
  }
  // Pas de code postal trouvé — renvoyer tel quel
  return { rue: norm, ville: '' }
}

const SECTION_LABELS: Record<string, string> = {
  main_oeuvre: "MAIN D'OEUVRE",
  materiaux: 'MATÉRIAUX',
  deplacement: 'DÉPLACEMENT',
  location: 'LOCATION',
  // Parité BTP V3 — label par défaut pour les lignes principales quand le mode
  // 'sections' est activé par la présence de customTables côté artisan V2.
  labor: "PRESTATIONS",
}

// ─── Main export ─────────────────────────────────────────────

export async function generateDevisPdfV2(input: DevisGeneratorInput) {
  const { jsPDF } = await import('jspdf')

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // Helvetica seul (WinAnsi 1252) — couvre tout le français standard :
  // €(0x80), ²(0xB2), °(0xB0), —(0x97), accents Latin-1 (éèàùçÉ...).
  //
  // Historique : la PR #103 (audit conformité 2026) avait embarqué Liberation
  // Sans TTF par précaution Unicode. Mais ça change le kerning + métriques
  // typographiques par rapport au rendu legacy → utilisateurs voient le PDF
  // « différent ». User feedback (12/05/2026) demande rendu visuel identique
  // à l'OLD. Helvetica WinAnsi suffit pour le périmètre FR/PT actuel.
  //
  // Si on a besoin de CJK / cyrillique / caractères hors Latin-1 plus tard,
  // réactiver Liberation Sans (ou Noto Sans) avec embedded loader.
  const FONT = 'helvetica'

  const pageW = pdf.internal.pageSize.getWidth()   // 210
  const pageH = pdf.internal.pageSize.getHeight()   // 297
  const contentW = pageW - ML - MR                   // ~174mm
  const xRight = pageW - MR                          // 192mm
  let y = 0

  const boxPadX = ptToMm(11)           // ~3.88mm
  const boxPadTop = ptToMm(19)         // ~6.7mm — modèle: 18.5-19pt marge top

  // i18n — FR par défaut, PT activé via input.locale === 'pt'.
  // Aligné sur lib/pdf/devis-pdf-v3.ts (mêmes libellés PT, parité visuelle).
  const isPt = input.locale === 'pt'
  const T = {
    emitter:        isPt ? 'EMITENTE'              : 'ÉMETTEUR',
    recipient:      isPt ? 'DESTINATÁRIO'          : 'DESTINATAIRE',
    society:        isPt ? 'Empresa'               : 'Société',
    name:           isPt ? 'Nome'                  : 'Nom',
    siret:          isPt ? 'NIF'                   : 'SIRET',
    address:        isPt ? 'Morada'                : 'Adresse',
    city:           isPt ? 'Cidade'                : 'Ville',
    phone:          isPt ? 'Tel.'                  : 'Tél',
    email:          isPt ? 'Email'                 : 'E-mail',
    interventionAt: isPt ? 'Local de intervenção :' : "Lieu d'intervention :",
    building:       isPt ? 'Edif.'                 : 'Bât.',
    floor:          isPt ? 'Andar'                 : 'Étage',
    commonAreas:    isPt ? 'Local : Áreas comuns'  : 'Lieu : Espaces communs',
    exterior:       isPt ? 'Local : Exterior'      : 'Lieu : Extérieur',
    insurance:      isPt ? 'Seguro'                : 'Assurance',
    rcPro:          isPt ? 'Seguro RC Pro'         : 'RC Pro',
    decennale:      isPt ? 'Garantia Decenal'      : 'Décennale',
    rcProAndDec:    isPt ? 'RC Pro + Decenal'      : 'RC Pro + Décennale',
    dateEmission:   isPt ? 'DATA DE EMISSÃO'       : "DATE D'ÉMISSION",
    validity:       isPt ? 'VALIDADE'              : 'VALIDITÉ',
    days:           isPt ? 'dias'                  : 'jours',
    execDelay:      isPt ? 'PRAZO DE EXECUÇÃO'     : "DÉLAI D'EXÉCUTION",
    toBeAgreed:     isPt ? 'A combinar'            : 'À convenir',
    prestationDate: isPt ? 'DATA DA PRESTAÇÃO'     : 'DATE PRESTATION',
    dueDate:        isPt ? 'VENCIMENTO'            : "DATE D'ÉCHÉANCE",
    invoiceNum:     isPt ? 'N.º FATURA'            : 'N° FACTURE',
    designation:    isPt ? 'DESCRIÇÃO'             : 'DÉSIGNATION',
    qty:            isPt ? 'QTD'                   : 'QTÉ',
    unit:           isPt ? 'UNID'                  : 'UNITÉ',
    priceU:         isPt ? 'PREÇO U.'              : 'PRIX U.',
    priceUTtc:      isPt ? 'PREÇO S/IVA'           : 'PRIX U. TTC',
    total:          isPt ? 'TOTAL'                 : 'TOTAL',
    totalTtc:       isPt ? 'TOTAL S/IVA'           : 'TOTAL TTC',
    subtotal:       isPt ? 'Subtotal'              : 'Sous-total',
    subtotalHt:     isPt ? 'Subtotal s/IVA'        : 'Sous-total HT',
    tva:            isPt ? 'IVA'                   : 'TVA',
    tvaOn:          isPt ? 's/'                    : 'sur',
    totalNet:       isPt ? 'TOTAL S/IVA'           : 'TOTAL NET',
    totalFinalTtc:  isPt ? 'TOTAL C/IVA'           : 'TOTAL TTC',
    totalToPay:     isPt ? 'TOTAL A PAGAR'         : 'TOTAL À RÉGLER',
    conditions:     isPt ? 'CONDIÇÕES'             : 'CONDITIONS',
    forApproval:    isPt ? 'ACEITAÇÃO'             : 'BON POUR ACCORD',
    settlement:     isPt ? 'PAGAMENTO'             : 'RÈGLEMENT',
    scheduleLabel:  isPt ? 'PLANO DE PAGAMENTO'    : 'ÉCHÉANCIER DE PAIEMENT',
    advanceWord:    isPt ? 'Adiantamento'          : 'Acompte',
    dateInput:      isPt ? 'Data : ___ / ___ / ______' : 'Date : ___ / ___ / ______',
    signature:      isPt ? 'Assinatura :'          : 'Signature :',
    accepted:       isPt
      ? 'Orçamento recebido antes da execução dos trabalhos, lido e aprovado.'
      : "Devis reçu avant exécution des travaux, lu et approuvé, bon pour accord.",
    payNotice1:     isPt ? 'Montante a pagar conforme as condições indicadas ao lado.' : 'Montant à régler selon les modalités indiquées ci-contre.',
    payNotice2:     isPt ? 'Por favor indique o número da fatura no pagamento.'        : 'Merci de rappeler le numéro de facture lors du paiement.',
    page:           isPt ? 'Página'                : 'Page',
    docDate:        isPt ? 'Data de emissão'       : "Date d'émission",
    payMode:        isPt ? 'Modo de pagamento'     : 'Mode de règlement',
    payTerms:       isPt ? 'Condições de pagamento': 'Conditions de paiement',
    quoteValidity:  isPt ? 'Validade do orçamento' : 'Validité du devis',
    fromEmission:   isPt ? 'a contar da data de emissão' : "à compter de la date d'émission",
    execDelayCond:  isPt ? 'Prazo de execução'     : "Délai d'exécution",
    amendmentNote:  isPt ? 'Qualquer alteração será objeto de um aditamento assinado por ambas as partes.' : "Toute modification fera l'objet d'un avenant signé par les deux parties.",
    penaltyLabel:   isPt ? 'Juros de mora'         : 'Pénalités de retard',
    defaultRate:    isPt ? 'taxa de juro legal em vigor' : "3 fois le taux d'intérêt légal",
    b2bIndemnity:   isPt ? null                    : 'Indemnité forfaitaire de recouvrement : 40 € (art. D.441-5 C. com.).',
    noEarlyDiscount: isPt ? 'Sem desconto por pagamento antecipado.' : 'Aucun escompte accordé pour paiement anticipé (art. L.441-9 C. com.).',
    earlyDiscountLabel: isPt ? 'Desconto por pagamento antecipado' : 'Escompte pour paiement anticipé (art. L.441-9 C. com.)',
    quoteFree:      isPt ? 'Orçamento gratuito.'   : 'Devis gratuit.',
    eiMention:      isPt ? 'Trabalhador independente (Recibos Verdes). Atividade declarada nas Finanças.' : 'Entrepreneur individuel (EI). Loi n°2022-172 du 14 février 2022.',
    tvaExempt:      isPt ? null                    : 'TVA non applicable, article 293 B du CGI.',
    retractionLegal1: isPt ? 'Direito de livre resolução: 14 dias de calendário a contar da assinatura (art. 10.º DL 24/2014).' : 'Droit de rétractation : 14 jours calendaires à compter de la signature (art. L. 221-18 C. conso.).',
    retractionLegal2: isPt ? 'Nenhum pagamento exigível antes de 7 dias após assinatura (art. 13.º DL 24/2014), salvo trabalhos urgentes.' : 'Aucun paiement exigible avant 7 jours après signature (art. L. 221-10 C. conso.), sauf travaux urgents.',
    mediationLabel: isPt ? 'Em caso de litígio, entidade RAL competente' : 'Médiation de la consommation (art. L. 612-1 C. conso.)',
    generatedBy:    isPt ? 'Documento gerado por Vitfix Pro em'   : 'Document généré par Vitfix Pro le',
    retractionTitle: isPt ? 'DIREITO DE LIVRE RESOLUÇÃO' : 'DROIT DE RÉTRACTATION',
    retractionLawRef: isPt ? 'Art. 10.º do Decreto-Lei n.º 24/2014' : 'Article L. 221-18 du Code de la consommation',
    retractionText1: isPt
      ? 'O cliente dispõe de um prazo de 14 dias de calendário, a contar da assinatura do presente orçamento, para exercer o seu direito de livre resolução, sem necessidade de justificação nem de pagamento de penalidades.'
      : "Le client dispose d'un délai de 14 jours calendaires à compter de la signature du présent devis pour exercer son droit de rétractation, sans avoir à justifier de motifs ni à payer de pénalités.",
    retractionText2: isPt
      ? 'Para exercer este direito, o cliente pode utilizar o formulário abaixo ou enviar qualquer declaração inequívoca em que manifeste a sua vontade de resolver o contrato.'
      : "Pour exercer ce droit, le client peut utiliser le formulaire ci-dessous ou adresser toute déclaration dénuée d'ambiguïté exprimant sa volonté de se rétracter.",
    retractionText3: isPt
      ? 'Nenhum pagamento pode ser exigido antes do termo do prazo de 7 dias a contar da assinatura, salvo trabalhos urgentes expressamente solicitados pelo cliente.'
      : "Aucun paiement ne peut être exigé avant l'expiration d'un délai de 7 jours à compter de la signature (art. L. 221-10 C. conso.), sauf travaux urgents demandés expressément par le client.",
    retractionForm: isPt ? 'FORMULÁRIO DE LIVRE RESOLUÇÃO' : 'FORMULAIRE DE RÉTRACTATION',
    attentionTo:    isPt ? 'À atenção de : '       : "À l'attention de : ",
    retractionNotify: isPt
      ? 'Pela presente notifico a minha resolução do contrato relativo à prestação de serviços supra.'
      : 'Je notifie par la présente ma rétractation du contrat portant sur la prestation de services ci-dessus.',
    formOrdered:    isPt ? 'Encomendado em / recebido em :' : 'Commandé le / reçu le :',
    formClientName: isPt ? 'Nome do cliente :'     : 'Nom du client :',
    formAddress:    isPt ? 'Morada :'              : 'Adresse :',
    formDate:       isPt ? 'Data : ___ / ___ / ______' : 'Date : ___ / ___ / ______',
    formSignature:  isPt ? 'Assinatura :'          : 'Signature :',
    companyName:    isPt ? 'Empresa'                : 'Enseigne',
    insuranceCoverDefault: isPt ? 'Portugal continental' : 'France métropolitaine',
    contractWord:   isPt ? 'apólice n.º'           : 'contrat n°',
    coverageWord:   isPt ? 'cobertura'             : 'couverture',
    sectionLabels:  isPt
      ? { main_oeuvre: 'MÃO DE OBRA', materiaux: 'MATERIAIS', deplacement: 'DESLOCAÇÃO', location: 'ALUGUER', labor: 'PRESTAÇÕES' } as Record<string, string>
      : SECTION_LABELS,
  }
  const dateLocale = isPt ? 'pt-PT' : 'fr-FR'

  // ── Helpers ──

  const drawHLine = (x1: number, yPos: number, x2: number, color = COLOR.BORDER, width = 0.18) => {
    pdf.setDrawColor(color); pdf.setLineWidth(width); pdf.line(x1, yPos, x2, yPos)
  }
  const drawVLine = (x: number, y1: number, y2: number, color = COLOR.BORDER, width = 0.18) => {
    pdf.setDrawColor(color); pdf.setLineWidth(width); pdf.line(x, y1, x, y2)
  }
  const checkPageBreak = (needed: number): boolean => {
    if (y + needed > pageH - 15) { pdf.addPage(); y = 18; return true }
    return false
  }

  // ═══════════════════════════════════════════════════════════
  // 1. LOGO (coin haut-gauche)
  // ═══════════════════════════════════════════════════════════

  // [Audit 03/05/2026 ÉLEVÉ] console.log fuit l'URL signée Supabase dans la
  // console navigateur → leak Sentry session replay. Conservé en dev only.
  if (process.env.NODE_ENV !== 'production') {
    console.log('[PDF V2] Logo URL:', input.artisan.logo_url ? input.artisan.logo_url.substring(0, 80) + '...' : 'null/empty')
  }
  // Validation URL logo : 3 sources autorisées (data:image/, blob:, https allowlist).
  // Hotfix 04/05/2026 (post-audit) : ajout data: et blob: — sans ça, les logos
  // stockés en data URI base64 dans profiles_artisan.logo_url étaient rejetés
  // silencieusement → logo disparu sur tous les PDF prod V2.
  const isProdV2 = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production'
  const ALLOWED_LOGO_DOMAINS = isProdV2
    ? ['supabase.co', 'supabase.io', 'vitfix.io', 'vitfix.pt']
    : ['supabase.co', 'supabase.io', 'vitfix.io', 'vitfix.pt', 'localhost', '127.0.0.1']
  const isLogoUrlAllowed = (url: string): boolean => {
    if (!url) return false
    if (url.startsWith('data:image/')) {
      return /^data:image\/(png|jpe?g|webp|gif);(?:[a-z0-9-]+;)*base64,/i.test(url)
    }
    if (url.startsWith('blob:')) return true
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
      return ALLOWED_LOGO_DOMAINS.some(d => parsed.hostname === d || parsed.hostname.endsWith('.' + d))
    } catch {
      return false
    }
  }
  if (input.artisan.logo_url && isLogoUrlAllowed(input.artisan.logo_url)) {
    try {
      const logoImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('Logo load failed'))
        img.src = input.artisan.logo_url!
      })
      const canvasSize = 500
      const canvas = document.createElement('canvas')
      canvas.width = canvasSize; canvas.height = canvasSize
      const ctx = canvas.getContext('2d')
      if (ctx) {
        const ratio = logoImg.width / logoImg.height
        let drawW = canvasSize, drawH = canvasSize
        if (ratio > 1) { drawH = canvasSize / ratio } else { drawW = canvasSize * ratio }
        ctx.drawImage(logoImg, (canvasSize - drawW) / 2, (canvasSize - drawH) / 2, drawW, drawH)
        const logoSize = ptToMm(65)
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', ptToMm(15), ptToMm(8), logoSize, logoSize)
      }
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') console.warn('[PDF V2] Logo load failed:', e)
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 2. TITRE + 3. NUMÉRO + 4. LIGNE D'ACCENT
  // ═══════════════════════════════════════════════════════════

  y = ptToMm(71)
  pdf.setFont(FONT, 'bold'); pdf.setTextColor(COLOR.TEXT)
  // Auto-fit du titre (méthode pro) : 16pt si le titre tient dans la largeur
  // utile (= largeur de la ligne d'accent, contentW). Sinon réduction par
  // paliers jusqu'à 13pt pour tenir sur une ligne ; si toujours trop long,
  // passage à 14pt + wrap sur plusieurs lignes. Jamais de débordement.
  const titleMaxW = contentW
  let titleSize = 16
  pdf.setFontSize(titleSize)
  while (titleSize > 13 && pdf.getTextWidth(input.devis.titre) > titleMaxW) {
    titleSize -= 1
    pdf.setFontSize(titleSize)
  }
  let titleLines: string[]
  if (pdf.getTextWidth(input.devis.titre) <= titleMaxW) {
    titleLines = [input.devis.titre]
  } else {
    titleSize = 14
    pdf.setFontSize(titleSize)
    titleLines = pdf.splitTextToSize(input.devis.titre, titleMaxW)
  }
  const titleLineH = ptToMm(titleSize + 3)
  for (let i = 0; i < titleLines.length; i++) {
    pdf.text(titleLines[i], pageW / 2, y + i * titleLineH, { align: 'center' })
  }
  y += (titleLines.length - 1) * titleLineH

  y += ptToMm(20)
  pdf.setFont(FONT, 'normal'); pdf.setFontSize(9); pdf.setTextColor(COLOR.TEXT_LIGHT)
  pdf.text(input.devis.numero, pageW / 2, y, { align: 'center' })

  // Label sous-type facture (méthode pro 2026) — mention légalement requise
  // pour acompte / situation (art. 289 CGI + BOFIP-TVA-DECLA-30-10-20).
  // Standard et devis : aucun label additionnel.
  const subTypeLabel = input.devis.docType === 'facture' && input.devis.factureSubType && input.devis.factureSubType !== 'standard'
    ? input.devis.factureSubType === 'acompte'
      ? (isPt ? 'FATURA DE ADIANTAMENTO' : 'FACTURE D\'ACOMPTE')
      : `${isPt ? 'FATURA DE SITUAÇÃO' : 'FACTURE DE SITUATION'}${input.devis.situationNumber ? ` N° ${input.devis.situationNumber}` : ''}${input.devis.situationAvancement != null ? ` — ${input.devis.situationAvancement}%` : ''}`
    : null
  if (subTypeLabel) {
    y += ptToMm(12)
    pdf.setFont(FONT, 'bold'); pdf.setFontSize(8); pdf.setTextColor(COLOR.TEXT)
    pdf.text(subTypeLabel, pageW / 2, y, { align: 'center' })
  }

  y += ptToMm(12)
  pdf.setFillColor(COLOR.ACCENT)
  pdf.rect(ML, y, contentW, ptToMm(3), 'F')
  y += ptToMm(3) + 5

  // ═══════════════════════════════════════════════════════════
  // 5. ENCADRÉS ÉMETTEUR & DESTINATAIRE — FIX #2 (H=134pt min)
  // ═══════════════════════════════════════════════════════════

  const boxStartY = y

  // FIX #2: Hauteur fixe minimum 47.27mm (134pt) comme dans le PDF de référence
  // On calcule la hauteur du contenu et on prend le max avec BOX_H_MIN
  let emContentH = boxPadTop + ptToMm(18) // label
  emContentH += ptToMm(14) // nom
  if (input.artisan.siret) emContentH += ptToMm(14)
  if (input.artisan.company_name) emContentH += ptToMm(14)
  if (input.artisan.rm && !isPt) emContentH += ptToMm(14)
  if (input.artisan.adresse) { emContentH += ptToMm(14); if (splitAddress(input.artisan.adresse)?.ville) emContentH += ptToMm(14) }
  if (input.artisan.telephone) emContentH += ptToMm(14)
  if (input.artisan.email) emContentH += ptToMm(14)
  if (isPt && input.artisan.cae) emContentH += ptToMm(14)
  if (!isPt && input.artisan.insurance_name) emContentH += ptToMm(14)
  emContentH += boxPadTop

  let destContentH = boxPadTop + ptToMm(18) + ptToMm(14) // label + nom
  if (input.client.adresse) { destContentH += ptToMm(14); if (splitAddress(input.client.adresse)?.ville) destContentH += ptToMm(14) }
  if (input.client.siret) destContentH += ptToMm(14)
  if (input.client.intervention_adresse) {
    destContentH += ptToMm(15) + ptToMm(14) // label (+3pt respiration) + adresse
    if (input.client.intervention_batiment) destContentH += ptToMm(14)
    if (input.client.intervention_etage) destContentH += ptToMm(14)
    if (input.client.intervention_espaces_communs) destContentH += ptToMm(14)
    if (input.client.intervention_exterieur) destContentH += ptToMm(14)
  }
  if (input.client.telephone) destContentH += ptToMm(14)
  if (input.client.email) destContentH += ptToMm(14)
  destContentH += boxPadTop

  const boxH = Math.max(emContentH, destContentH, BOX_H_MIN)

  // Dessiner les fonds D'ABORD — coordonnées exactes JSPDF_COORDINATES.js
  pdf.setFillColor(COLOR.BG_GRAY); pdf.setDrawColor(COLOR.BORDER); pdf.setLineWidth(0.18)
  pdf.rect(ML, boxStartY, EM_W, boxH, 'FD')
  pdf.rect(DEST_X0, boxStartY, DEST_W, boxH, 'FD')

  // ── Émetteur (texte par-dessus, UNE SEULE FOIS) ──
  let ey = boxStartY + boxPadTop
  pdf.setFontSize(7); pdf.setFont(FONT, 'normal'); pdf.setTextColor(COLOR.TEXT_LIGHT)
  pdf.text(T.emitter, TEXT_X_EM, ey)
  ey += ptToMm(18)

  pdf.setFontSize(10); pdf.setFont(FONT, 'normal'); pdf.setTextColor(COLOR.TEXT)

  // Nom commercial / marque — affiché au-dessus du nom civil si renseigné.
  if (input.artisan.company_name) {
    pdf.text(`${T.companyName} : ${input.artisan.company_name}`, TEXT_X_EM, ey)
    ey += ptToMm(14)
  }

  // Suffixe " — EI" accolé au nom : FR L.526-22 C. com. (loi n°2022-172) +
  // PT lecture officielle "Empresário em Nome Individual". On l'ajoute si le
  // nom ne contient pas déjà une forme juridique (SAS/SARL/SCI/EI/etc.).
  const nomAvecEI = /\b(EI|EIRL|SAS|SASU|SARL|EURL|SA|SCI|SNC)\b/i.test(input.artisan.nom)
    ? input.artisan.nom
    : `${input.artisan.nom} - EI`
  // PT : label "Nome" (Trabalhador independente / Empresário em Nome Individual).
  // FR : label "Société" (EI ou société commerciale).
  // Le suffixe "— EI" s'applique aux deux locales : en FR c'est l'obligation
  // L.526-22 C. com., en PT c'est la lecture officielle du sigle EI.
  pdf.text(`${isPt ? T.name : T.society} : ${nomAvecEI}`, TEXT_X_EM, ey)
  ey += ptToMm(14)
  if (input.artisan.siret) { pdf.text(`${T.siret} : ${input.artisan.siret}`, TEXT_X_EM, ey); ey += ptToMm(14) }

  // RM (Répertoire des Métiers) — FR uniquement, n'existe pas au PT.
  if (input.artisan.rm && !isPt) {
    let rmRaw = input.artisan.rm.trim()
    if (!rmRaw.startsWith('RM ')) rmRaw = `RM ${rmRaw}`
    const rmDisplay = rmRaw.includes(' : ') ? rmRaw : rmRaw.replace(/^(RM\s+[A-Za-zÀ-ÿ\s-]+?)\s+(\d+)$/, '$1 : $2')
    pdf.text(rmDisplay, TEXT_X_EM, ey); ey += ptToMm(14)
  }

  // FIX #3: Adresse séparée en Adresse + Ville
  if (input.artisan.adresse) {
    const parts = splitAddress(input.artisan.adresse)
    if (parts) {
      const emMaxW = EM_W - boxPadX * 2
      // Ligne "Adresse : {rue}" — réduire police si trop long
      const rueText = `${T.address} : ${parts.rue}`
      let fontSize = 10
      pdf.setFontSize(fontSize)
      if (pdf.getTextWidth(rueText) > emMaxW) { fontSize = 9; pdf.setFontSize(fontSize) }
      if (pdf.getTextWidth(rueText) > emMaxW) { fontSize = 8; pdf.setFontSize(fontSize) }
      pdf.text(rueText, TEXT_X_EM, ey)
      pdf.setFontSize(10)
      ey += ptToMm(14)
      // Ligne "Ville : {cp} {ville}" (si le split a trouvé un code postal)
      if (parts.ville) {
        pdf.text(`${T.city} : ${parts.ville}`, TEXT_X_EM, ey); ey += ptToMm(14)
      }
    }
  }

  if (input.artisan.telephone) { pdf.text(`${T.phone} : ${input.artisan.telephone}`, TEXT_X_EM, ey); ey += ptToMm(14) }
  if (input.artisan.email) { pdf.text(`${T.email} : ${input.artisan.email}`, TEXT_X_EM, ey); ey += ptToMm(14) }

  // PT : CAE (Classificação Portuguesa das Atividades Económicas) — affichée à
  // la place de la ligne Assurance dans la boîte (le seguro reste dans les
  // mentions légales du pied de page).
  if (isPt && input.artisan.cae) {
    pdf.text(`CAE : ${input.artisan.cae}`, TEXT_X_EM, ey); ey += ptToMm(14)
  }

  // Assurance (FR uniquement dans la boîte ; PT garde uniquement le pied légal)
  if (!isPt && input.artisan.insurance_name) {
    const insLabel = input.artisan.insurance_type === 'rc_pro' ? T.rcPro
      : input.artisan.insurance_type === 'decennale' ? T.decennale
      : input.artisan.insurance_type === 'both' ? T.rcProAndDec : T.insurance
    const emMaxW = EM_W - boxPadX * 2
    let insText = `${insLabel} : ${input.artisan.insurance_name}`
    if (input.artisan.insurance_number) insText += isPt ? `, ${T.contractWord} ${input.artisan.insurance_number}` : `, n° ${input.artisan.insurance_number}`
    // Réduire police si trop long
    let insFontSize = 10
    pdf.setFontSize(insFontSize)
    if (pdf.getTextWidth(insText) > emMaxW) { insFontSize = 9; pdf.setFontSize(insFontSize) }
    if (pdf.getTextWidth(insText) > emMaxW) { insFontSize = 8; pdf.setFontSize(insFontSize) }
    pdf.text(insText, TEXT_X_EM, ey); ey += ptToMm(14)
    pdf.setFontSize(10) // reset
  }

  // ── Destinataire (texte par-dessus, UNE SEULE FOIS) ──
  let dy = boxStartY + boxPadTop
  pdf.setFontSize(7); pdf.setFont(FONT, 'normal'); pdf.setTextColor(COLOR.TEXT_LIGHT)
  pdf.text(T.recipient, TEXT_X_DEST, dy)
  dy += ptToMm(18)

  pdf.setFontSize(10); pdf.setFont(FONT, 'normal'); pdf.setTextColor(COLOR.TEXT)
  // FIX FINAL #3: "Société/Empresa" si SIRET/NIF client (B2B), "Nom/Nome" sinon (B2C).
  // PT exception : en Portugal, les particuliers ont aussi un NIF — utiliser
  // toujours "Nome" sauf si un flag explicite indique une entreprise.
  const clientLabel = (input.client.siret && !isPt) ? T.society : T.name
  pdf.text(`${clientLabel} : ${input.client.nom || '---'}`, TEXT_X_DEST, dy)
  dy += ptToMm(14)

  // FIX #4 + FIX FINAL #5: Adresse destinataire — ne pas afficher si vide
  if (input.client.adresse && input.client.adresse.trim().length > 3) {
    const parts = splitAddress(input.client.adresse)
    if (parts && parts.rue && parts.rue.trim().length > 1) {
      pdf.text(`${T.address} : ${parts.rue}`, TEXT_X_DEST, dy); dy += ptToMm(14)
      if (parts.ville && parts.ville.trim().length > 1) { pdf.text(`${T.city} : ${parts.ville}`, TEXT_X_DEST, dy); dy += ptToMm(14) }
    }
  }

  if (input.client.siret) { pdf.text(`${T.siret} : ${input.client.siret}`, TEXT_X_DEST, dy); dy += ptToMm(14) }
  if (input.client.intervention_adresse) {
    pdf.setFontSize(8); pdf.setTextColor(COLOR.TEXT_LIGHT)
    pdf.text(T.interventionAt, TEXT_X_DEST, dy); dy += ptToMm(15)
    pdf.setFontSize(10); pdf.setTextColor(COLOR.TEXT)
    pdf.text(input.client.intervention_adresse, TEXT_X_DEST, dy); dy += ptToMm(14)
    if (input.client.intervention_batiment) { pdf.text(`${T.building} ${input.client.intervention_batiment}`, TEXT_X_DEST, dy); dy += ptToMm(14) }
    if (input.client.intervention_etage) { pdf.text(`${T.floor} : ${input.client.intervention_etage}`, TEXT_X_DEST, dy); dy += ptToMm(14) }
    if (input.client.intervention_espaces_communs) { pdf.text(`${T.commonAreas}, ${input.client.intervention_espaces_communs}`, TEXT_X_DEST, dy); dy += ptToMm(14) }
    if (input.client.intervention_exterieur) { pdf.text(`${T.exterior}, ${input.client.intervention_exterieur}`, TEXT_X_DEST, dy); dy += ptToMm(14) }
  }
  if (input.client.telephone) { pdf.text(`${T.phone} : ${input.client.telephone}`, TEXT_X_DEST, dy); dy += ptToMm(14) }
  if (input.client.email) { pdf.text(`${T.email} : ${input.client.email}`, TEXT_X_DEST, dy); dy += ptToMm(14) }

  y = boxStartY + boxH + 4

  // ═══════════════════════════════════════════════════════════
  // 7. TABLEAU DES DATES (4 colonnes)
  // ═══════════════════════════════════════════════════════════

  const dateBoxH = ptToMm(49)
  const dateSepY = y + ptToMm(20)

  pdf.setFillColor(COLOR.BG_GRAY); pdf.setDrawColor(COLOR.BORDER); pdf.setLineWidth(0.18)
  pdf.rect(ML, y, contentW, dateBoxH, 'FD')

  const isFactureHdr = input.devis.docType === 'facture'
  // Date d'échéance facture : source unique = input.devis.paymentDue
  // (helper partagé V2+V3, aligné art. L441-10 C. com.). Pour les devis,
  // garde le sens "validité" via validite_jours (durée pendant laquelle
  // l'offre commerciale tient — sémantique différente du délai de paiement).
  const echeanceDate = isFactureHdr
    ? computeEcheanceDate(input.devis.date_emission, input.devis.paymentDue ?? null, {
        fallbackDays: input.devis.validite_jours || 30,
      })
    : (() => {
        const d = new Date(input.devis.date_emission)
        d.setDate(d.getDate() + (input.devis.validite_jours || 30))
        return d
      })()
  const dateCols = isFactureHdr
    ? [
        { label: T.dateEmission,   value: formatDate(input.devis.date_emission, dateLocale) },
        { label: T.dueDate,        value: formatDate(echeanceDate, dateLocale) },
        { label: T.prestationDate, value: input.devis.date_prestation ? formatDate(input.devis.date_prestation, dateLocale) : '—' },
        { label: T.invoiceNum,     value: input.devis.numero },
      ]
    : [
        { label: T.dateEmission,   value: formatDate(input.devis.date_emission, dateLocale) },
        { label: T.validity,       value: `${input.devis.validite_jours} ${T.days}` },
        { label: T.execDelay,      value: input.devis.delai_execution || T.toBeAgreed },
        { label: T.prestationDate, value: input.devis.date_prestation ? formatDate(input.devis.date_prestation, dateLocale) : '—' },
      ]

  const dateVSeps = [60.52, 103.05, 147.51]
  const dateCenters = [(ML + dateVSeps[0]) / 2, (dateVSeps[0] + dateVSeps[1]) / 2, (dateVSeps[1] + dateVSeps[2]) / 2, (dateVSeps[2] + xRight) / 2]
  drawHLine(ML, dateSepY, xRight, COLOR.BORDER, 0.18)
  dateVSeps.forEach(x => drawVLine(x, y, y + dateBoxH, COLOR.BORDER, 0.18))

  dateCols.forEach((c, i) => {
    pdf.setFontSize(7); pdf.setFont(FONT, 'normal'); pdf.setTextColor(COLOR.TEXT_LIGHT)
    pdf.text(c.label, dateCenters[i], y + ptToMm(14), { align: 'center' })
  })
  dateCols.forEach((c, i) => {
    pdf.setFontSize(10); pdf.setFont(FONT, 'bold'); pdf.setTextColor(COLOR.TEXT)
    pdf.text(c.value, dateCenters[i], dateSepY + ptToMm(17), { align: 'center' })
  })

  y += dateBoxH + 4

  // ═══════════════════════════════════════════════════════════
  // 8. TABLEAU PRESTATIONS — FIX #1 (pas de doublon) + FIX #5 (alternance)
  // ═══════════════════════════════════════════════════════════

  const tColWidths = { designation: contentW * 0.50 }
  const headerH = ptToMm(29)
  const minRowH = ptToMm(32)

  // Franchise en base (art. 293 B CGI) → pas de TVA → colonnes "PRIX U." / "TOTAL"
  // TVA applicable → colonnes "PRIX U. TTC" / "TOTAL TTC"
  // Détection : tva_mention "non applicable" ET pas de tvaBreakdown reçu
  // (un auto-entrepreneur en TVA après seuil 293 B fournit un breakdown).
  // PT : convention inverse (prix toujours s/IVA dans le tableau, IVA détaillée
  // au pied du tableau). Donc même header "PREÇO S/IVA" / "TOTAL S/IVA" qu'il
  // y ait IVA ou non — quand IVA exemptée le breakdown est vide, le pied affiche
  // juste le TOTAL.
  const isFranchise293B = /non applicable/i.test(input.artisan.tva_mention || '')
    && (!input.tvaBreakdown || input.tvaBreakdown.length === 0)
  const drawTableHeader = () => {
    pdf.setFillColor(COLOR.BLACK)
    pdf.rect(ML, y, contentW, headerH, 'F')
    pdf.setFont(FONT, 'bold'); pdf.setFontSize(8); pdf.setTextColor(COLOR.WHITE)
    const hTextY = y + headerH / 2 + 1
    pdf.text(T.designation, ptToMm(62), hTextY)
    pdf.text(T.qty, 121.92, hTextY, { align: 'center' })
    pdf.text(T.unit, 135.41, hTextY, { align: 'center' })
    const priceHdr = isPt ? T.priceUTtc : (isFranchise293B ? T.priceU : T.priceUTtc)
    const totalHdr = isPt ? T.totalTtc  : (isFranchise293B ? T.total  : T.totalTtc)
    pdf.text(priceHdr, 162.26, hTextY, { align: 'right' })
    pdf.text(totalHdr, 188.71, hTextY, { align: 'right' })
    y += headerH
    drawHLine(ML, y, ML + contentW, COLOR.ACCENT, 0.7)
  }

  // FIX #1: Chaque texte rendu UNE SEULE FOIS, pas de boucle double
  const drawRow = (line: LigneDevis, rowIdx: number, lineEtapes: EtapeIntervention[] = []) => {
    const cleaned = cleanDescription(line.designation)
    const nlParts = cleaned.split('\n')
    const title = nlParts[0]
    // detail = continuation du titre (legacy : description multi-ligne via \n
    // dans designation). Concaténé avec lineDetail (champ libre dédié, parité
    // V3 BTP) pour rendu unifié sous le titre.
    const inlineDetail = nlParts.slice(1).join('\n').trim()
    const lineDetailText = (line.lineDetail || '').trim()
    const detail = [inlineDetail, lineDetailText].filter(Boolean).join('\n')

    // Mesurer les hauteurs nécessaires — largeur = de x=62pt à la colonne QTÉ
    const desigTextW = tColWidths.designation - (ptToMm(62) - ML) - 2
    pdf.setFont(FONT, 'normal'); pdf.setFontSize(10)
    const titleWrapped = pdf.splitTextToSize(title, desigTextW)
    let descWrapped: string[] = []
    if (detail) {
      pdf.setFontSize(8)
      descWrapped = pdf.splitTextToSize(detail, desigTextW)
    }
    // Hauteur étapes (si présentes)
    const etapesH = lineEtapes.length > 0 ? ptToMm(4) + lineEtapes.length * ptToMm(11) : 0
    const textH = titleWrapped.length * ptToMm(14) + descWrapped.length * ptToMm(12) + etapesH + 4
    const rowH = Math.max(minRowH, textH)

    if (y + rowH > pageH - 25) { pdf.addPage(); y = 18; drawTableHeader() }

    // FIX #5: Alternance fond WHITE/BG_GRAY
    pdf.setFillColor(rowIdx % 2 === 0 ? COLOR.WHITE : COLOR.BG_GRAY)
    pdf.rect(ML, y, contentW, rowH, 'F')

    // x=62pt (21.87mm) = TEXT_LEFT pour tout le texte aligné
    const TEXT_LEFT = ptToMm(62)

    // Titre (10pt TEXT) — UNE SEULE FOIS
    let textY = y + 5
    pdf.setFont(FONT, 'normal'); pdf.setFontSize(10); pdf.setTextColor(COLOR.TEXT)
    for (let i = 0; i < titleWrapped.length; i++) {
      pdf.text(titleWrapped[i], TEXT_LEFT, textY)
      textY += ptToMm(14)
    }

    // Description (8pt TEXT_LIGHT) — UNE SEULE FOIS
    if (descWrapped.length > 0) {
      pdf.setFontSize(8); pdf.setTextColor(COLOR.TEXT_LIGHT)
      for (let i = 0; i < descWrapped.length; i++) {
        pdf.text(descWrapped[i], TEXT_LEFT, textY)
        textY += ptToMm(12)
      }
    }

    // Étapes du chantier — alignées avec TEXT_LEFT (même x que Désignation)
    if (lineEtapes.length > 0) {
      textY += ptToMm(4)
      pdf.setFontSize(7.5); pdf.setTextColor('#555555'); pdf.setFont(FONT, 'normal')
      for (let ei = 0; ei < lineEtapes.length; ei++) {
        pdf.text(`${ei + 1}. ${lineEtapes[ei].designation}`, TEXT_LEFT, textY)
        textY += ptToMm(11)
      }
    }

    // Données numériques — alignées avec le TITRE (y + 5), pas centrées verticalement
    const numY = y + 5
    pdf.setFont(FONT, 'normal'); pdf.setFontSize(10); pdf.setTextColor(COLOR.TEXT)
    pdf.text(String(line.quantite), 121.92, numY, { align: 'center' })
    pdf.text(formatUnitForPdf(line.unite, input.locale || 'fr'), 135.41, numY, { align: 'center' })
    pdf.text(formatPrice(line.prix_unitaire), 162.26, numY, { align: 'right' })
    pdf.setFont(FONT, 'bold')
    pdf.text(formatPrice(line.total), 188.71, numY, { align: 'right' })

    // Bordure bas
    pdf.setDrawColor(COLOR.BORDER); pdf.setLineWidth(0.18)
    pdf.line(ML, y + rowH, ML + contentW, y + rowH)
    y += rowH
  }

  // Fallback: si input.etapes global existe mais pas line.etapes, on garde le comportement legacy
  const globalEtapes = input.etapes
    ? [...input.etapes].sort((a, b) => a.ordre - b.ordre).filter(e => e.designation.trim())
    : []
  const hasPerLineEtapes = input.lignes.some(l => l.etapes && l.etapes.length > 0)

  const getEtapesForLine = (line: LigneDevis, idx: number): EtapeIntervention[] => {
    if (hasPerLineEtapes) {
      // Chaque ligne porte ses propres étapes
      return (line.etapes || []).sort((a, b) => a.ordre - b.ordre).filter(e => e.designation.trim())
    }
    // Legacy: toutes les étapes sous la première ligne
    return idx === 0 ? globalEtapes : []
  }

  if (input.mode_affichage === 'bloc') {
    drawTableHeader()
    input.lignes.forEach((line, idx) => {
      drawRow(line, idx, getEtapesForLine(line, idx))
    })
  } else {
    const grouped: Record<string, LigneDevis[]> = {}
    for (const line of input.lignes) { const k = line.section || 'autres'; if (!grouped[k]) grouped[k] = []; grouped[k].push(line) }
    let globalIdx = 0
    for (const [section, lines] of Object.entries(grouped)) {
      checkPageBreak(headerH + minRowH * lines.length + 12)
      pdf.setFont(FONT, 'bold'); pdf.setFontSize(9); pdf.setTextColor(COLOR.TEXT)
      // Label custom passé par le caller (parité BTP V3 customTables) → fallback
      // sur SECTION_LABELS figés → fallback sur la clé en majuscules.
      const customLabel = input.customSectionLabels?.[section]
      pdf.text(customLabel || T.sectionLabels[section] || section.toUpperCase(), ML, y + 4)
      y += 7
      drawTableHeader()
      let st = 0
      lines.forEach((l, i) => { drawRow(l, i, getEtapesForLine(l, globalIdx)); st += l.total; globalIdx++ })
      pdf.setFont(FONT, 'bold'); pdf.setFontSize(8); pdf.setTextColor(COLOR.TEXT)
      pdf.text(`${T.subtotal} : ${formatPrice(st)}`, ML + contentW - 3, y + 4, { align: 'right' })
      y += 8
    }
  }

  // ═══════════════════════════════════════════════════════════
  // SOUS-TOTAL + TVA — FIX #6 (bordure FD) + multi-taux
  // ═══════════════════════════════════════════════════════════

  // Total HT via centimes entiers (sumMoney) — zéro drift IEEE 754.
  const totalNet = sumMoney(input.lignes.map(l => l.total))
  // Détection : auto-entrepreneur en TVA (a passé le seuil 293 B) → afficher
  // ventilation TVA multi-taux. Sinon mode legacy single-rate (mention 293 B).
  const tvaBreakdown = input.tvaBreakdown && input.tvaBreakdown.length > 0
    ? input.tvaBreakdown
    : []
  const hasTvaBreakdown = tvaBreakdown.length > 0
  const totalTVA = hasTvaBreakdown ? sumMoney(tvaBreakdown.map(t => t.amount)) : 0
  const totalTTC = round2(totalNet + totalTVA)

  const stH = ptToMm(27)
  const totH = ptToMm(27)
  // checkPageBreak avant bloc totaux : évite TOTAL NET clippé en bas de page.
  // Inclut maintenant les lignes TVA multi-taux (auto-entrepreneur en TVA après
  // dépassement seuil 293 B) — Chunk 4 PR #103.
  const tvaRowH = 6
  const totalsBlockHV2 = stH + tvaBreakdown.length * tvaRowH + 4 + totH + 4
  checkPageBreak(totalsBlockHV2)

  // FIX #6: 'FD' = fond gris + bordure (pas juste fond)
  pdf.setFillColor(COLOR.BG_GRAY); pdf.setDrawColor(COLOR.BORDER); pdf.setLineWidth(0.18)
  pdf.rect(ML, y, contentW, stH, 'FD')

  pdf.setFontSize(7.5); pdf.setFont(FONT, 'normal'); pdf.setTextColor(COLOR.TEXT_LIGHT)
  // PT : on remplace la mention française "TVA non applicable, art. 293 B CGI"
  // par le badge "IVA 23%" (ou autre taux si breakdown), aligné avec le PDF V2 PT.
  // Si pas d'IVA (artisan exempt), on n'affiche pas de badge.
  const tvaMentionDisplay = isPt
    ? (hasTvaBreakdown ? `${T.tva} ${tvaBreakdown[0]?.rate ?? 23}%` : '')
    : input.artisan.tva_mention
  if (tvaMentionDisplay) pdf.text(tvaMentionDisplay, 21.16, y + stH / 2 + 1)
  pdf.setFontSize(9); pdf.setFont(FONT, 'normal'); pdf.setTextColor(COLOR.TEXT)
  pdf.text(hasTvaBreakdown ? T.subtotalHt : T.subtotal, 148.15, y + stH / 2 + 1)
  pdf.setFontSize(10); pdf.setFont(FONT, 'bold'); pdf.setTextColor(COLOR.TEXT)
  pdf.text(formatPrice(totalNet), 188.71, y + stH / 2 + 1, { align: 'right' })
  y += stH

  // Détail TVA par taux (auto-entrepreneur en TVA après seuil 293 B)
  if (hasTvaBreakdown) {
    tvaBreakdown.forEach(({ rate, base, amount }) => {
      if (rate === 0) return
      pdf.setFillColor(COLOR.WHITE)
      pdf.rect(ML + contentW / 2, y, contentW / 2, tvaRowH, 'F')
      pdf.setFontSize(8); pdf.setFont(FONT, 'normal'); pdf.setTextColor(COLOR.TEXT_LIGHT)
      pdf.text(`${T.tva} ${rate}% ${T.tvaOn} ${formatPrice(base)}`, 148.15, y + 4)
      pdf.setFont(FONT, 'bold'); pdf.setTextColor(COLOR.TEXT)
      pdf.text(formatPrice(amount), 188.71, y + 4, { align: 'right' })
      y += tvaRowH
    })
  }

  // ═══════════════════════════════════════════════════════════
  // 9. BLOC TOTAL NET (moitié droite)
  // ═══════════════════════════════════════════════════════════

  y += 4  // même gap que sous TOTAL NET → BON POUR ACCORD
  // totH déjà déclaré plus haut (estimation totalsBlockHV2)
  pdf.setFillColor(COLOR.BG_GRAY)
  pdf.rect(DEST_X0, y, DEST_W, totH, 'F')
  pdf.setFontSize(12); pdf.setFont(FONT, 'bold'); pdf.setTextColor(COLOR.TEXT)
  // Si TVA active (auto-entrepreneur en TVA), afficher TOTAL TTC ; sinon TOTAL NET
  const finalLabel = input.devis.docType === 'facture'
    ? T.totalToPay
    : (hasTvaBreakdown ? T.totalFinalTtc : T.totalNet)
  const finalAmount = hasTvaBreakdown ? totalTTC : totalNet
  pdf.text(finalLabel, DEST_X0 + boxPadX, y + totH / 2 + 1.5)
  pdf.text(formatPrice(finalAmount), DEST_X0 + DEST_W - boxPadX, y + totH / 2 + 1.5, { align: 'right' })
  y += totH + 4

  // ═══════════════════════════════════════════════════════════
  // 11. CONDITIONS + 12. BON POUR ACCORD + 10. ACOMPTES
  // ═══════════════════════════════════════════════════════════

  checkPageBreak(55)
  const condStartY = y

  // CONDITIONS (fond blanc, pas de bordure) — aligné avec BON POUR ACCORD (+5mm)
  pdf.setFontSize(10); pdf.setFont(FONT, 'bold'); pdf.setTextColor(COLOR.TEXT)
  pdf.text(T.conditions, ML, condStartY + 5)
  let cy = condStartY + 13

  pdf.setFontSize(9); pdf.setFont(FONT, 'normal'); pdf.setTextColor(COLOR.TEXT)
  const isFacture = input.devis.docType === 'facture'
  // Mode de paiement : PT garde la valeur saisie (déjà PT type "Transferência
  // bancária"). FR : retraduit "Transferência bancária" → "Virement bancaire"
  // si l'utilisateur a sélectionné le label PT par erreur.
  const payModeDisplay = isPt
    ? input.artisan.mode_paiement
    : (input.artisan.mode_paiement === 'Transferência bancária' ? 'Virement bancaire' : input.artisan.mode_paiement)
  // Éclater mode_paiement multi-ligne (ex: "Transferência bancária.\nIBAN: …\nTitular: …")
  // en lignes séparées pour le rendu dans le bloc CONDITIONS.
  const payModeLines = payModeDisplay.includes('\n')
    ? payModeDisplay.split('\n').map((l, i) => i === 0 ? `${T.payMode} : ${l}` : l)
    : [`${T.payMode} : ${payModeDisplay}.`]
  const condLines = isFacture
    ? [
        `${T.docDate} : ${formatDate(input.devis.date_emission, dateLocale)}.`,
        ...payModeLines,
        ...(input.artisan.condition_paiement ? [`${T.payTerms} : ${input.artisan.condition_paiement}.`] : []),
      ]
    : [
        `${T.quoteValidity} : ${input.devis.validite_jours} ${T.days} ${T.fromEmission}.`,
        `${T.execDelayCond} : ${input.devis.delai_execution || T.toBeAgreed}.`,
        T.amendmentNote,
        ...payModeLines,
        ...(input.artisan.condition_paiement ? [`${T.payTerms} : ${input.artisan.condition_paiement}.`] : []),
        ...(input.dechets_chantier ? [input.dechets_chantier] : []), // FIX FINAL #6
      ]
  condLines.forEach(line => {
    const wrapped = pdf.splitTextToSize(line, EM_W - 4)
    pdf.text(wrapped, ML, cy)
    cy += wrapped.length * ptToMm(13)
  })

  if (input.notes && input.notes.trim()) {
    cy += 2
    pdf.setFont(FONT, 'italic'); pdf.setFontSize(9); pdf.setTextColor(COLOR.TEXT)
    const noteWrapped = pdf.splitTextToSize(input.notes.trim(), EM_W - 4)
    pdf.text(noteWrapped, ML, cy)
    cy += noteWrapped.length * ptToMm(13)
  }

  // FIX FINAL #1: Pénalités de retard / Juros de mora (obligation légale)
  // FR : Art. L.441-9 / L.441-10 / D.441-5 C. com. — indemnité 40 € B2B uniquement
  // PT : taxa de juro legal em vigor + Lei 144/2015 (RAL) — pas d'indemnité 40 €
  cy += 3
  pdf.setFontSize(7); pdf.setFont(FONT, 'normal'); pdf.setTextColor('#888888')
  const penaltyRate = input.penalite_retard || T.defaultRate
  const isB2B = !!input.client.siret
  // #9 : si l'artisan a saisi un escompte pour paiement anticipé, on l'affiche
  // au lieu de la mention « aucun escompte accordé » (imprimée à tort même quand
  // un escompte était offert → mention légale contradictoire).
  const escompteStr = (input.escompte || '').trim()
  const penaltyLines = [
    `${T.penaltyLabel} : ${penaltyRate}.`,
    ...(isB2B && T.b2bIndemnity ? [T.b2bIndemnity] : []),
    escompteStr ? `${T.earlyDiscountLabel} : ${escompteStr}.` : T.noEarlyDiscount,
  ]
  penaltyLines.forEach(line => {
    pdf.text(line, ML, cy)
    cy += ptToMm(10)
  })

  // BON POUR ACCORD / ACEITAÇÃO — FIX #7: fond gris + bordure DROITE et BAS uniquement
  const sigH = Math.max(cy - condStartY, 46)
  // Fond gris (sans bordure complète)
  pdf.setFillColor(COLOR.BG_GRAY)
  pdf.rect(DEST_X0, condStartY, DEST_W, sigH, 'F')
  // Bordure droite uniquement
  pdf.setDrawColor(COLOR.BORDER); pdf.setLineWidth(0.18)
  pdf.line(DEST_X0 + DEST_W, condStartY, DEST_X0 + DEST_W, condStartY + sigH) // droite
  pdf.line(DEST_X0, condStartY + sigH, DEST_X0 + DEST_W, condStartY + sigH)   // bas

  pdf.setFontSize(9.5); pdf.setFont(FONT, 'bold'); pdf.setTextColor(COLOR.TEXT)
  pdf.text(isFacture ? T.settlement : T.forApproval, DEST_X0 + boxPadX, condStartY + 5)

  let sy = condStartY + 12
  pdf.setFontSize(9); pdf.setFont(FONT, 'normal'); pdf.setTextColor(COLOR.TEXT)

  if (input.signature) {
    try {
      pdf.addImage(input.signature.image_base64, 'PNG', DEST_X0 + boxPadX, sy, DEST_W - boxPadX * 2 - 10, 18)
      sy += 20
      pdf.setFontSize(7); pdf.setFont(FONT, 'bold')
      pdf.text(input.signature.signe_par, DEST_X0 + boxPadX, sy)
      pdf.setFont(FONT, 'normal'); pdf.setTextColor(COLOR.TEXT_LIGHT)
      pdf.text(formatDate(input.signature.signe_le, dateLocale), DEST_X0 + boxPadX, sy + 3)
    } catch { pdf.text(input.signature.signe_par, DEST_X0 + boxPadX, sy) }
  } else if (isFacture) {
    const payLines = [T.payNotice1, T.payNotice2]
    const wrapped = pdf.splitTextToSize(payLines.join(' '), DEST_W - boxPadX * 2)
    pdf.text(wrapped, DEST_X0 + boxPadX, sy)
  } else {
    const appWrapped = pdf.splitTextToSize(T.accepted, DEST_W - boxPadX * 2)
    pdf.text(appWrapped, DEST_X0 + boxPadX, sy)
    sy += appWrapped.length * ptToMm(13) + 4
    pdf.text(T.dateInput, DEST_X0 + boxPadX, sy)
    sy += ptToMm(18)
    pdf.text(T.signature, DEST_X0 + boxPadX, sy)
  }

  y = condStartY + sigH + 4

  // ═══════════════════════════════════════════════════════════
  // 10. ACOMPTES — carré gris sous BON POUR ACCORD (côté droit)
  // ═══════════════════════════════════════════════════════════

  if (input.acomptes && input.acomptes.length > 0) {
    // Même espacement que BON POUR ACCORD : titre à +5, contenu à +12, lignes +4.6mm
    const acBlockH = 12 + input.acomptes.length * ptToMm(13) + 4
    checkPageBreak(acBlockH + 4)
    // Carré gris — même x et largeur que BON POUR ACCORD
    pdf.setFillColor(COLOR.BG_GRAY); pdf.setDrawColor(COLOR.BORDER); pdf.setLineWidth(0.18)
    pdf.rect(DEST_X0, y, DEST_W, acBlockH, 'FD')
    // Titre — même position relative que BON POUR ACCORD (+5mm)
    pdf.setFontSize(9); pdf.setFont(FONT, 'bold'); pdf.setTextColor(COLOR.TEXT)
    pdf.text(T.scheduleLabel, DEST_X0 + boxPadX, y + 5)
    // Première ligne à +12mm (même gap que BON POUR ACCORD titre→contenu)
    let ay = y + 12
    pdf.setFontSize(8); pdf.setFont(FONT, 'normal'); pdf.setTextColor(COLOR.TEXT)
    // Normaliser les labels acomptes en FR (éviter mélange PT/FR)
    const normLabel = (label: string, idx: number) => {
      if (/adiantamento/i.test(label)) return `${T.advanceWord} ${idx + 1}`
      return label
    }
    const normTrigger = (t: string) => {
      const MAP: Record<string, string> = {
        'Na assinatura': 'À la signature',
        'No início dos trabalhos': 'Au démarrage des travaux',
        'A meio do projeto': 'À mi-parcours',
        'Na entrega': 'À la livraison',
      }
      return MAP[t] || t
    }
    for (let aci = 0; aci < input.acomptes.length; aci++) {
      const ac = input.acomptes[aci]
      const label = input.locale === 'pt' ? ac.label : normLabel(ac.label, aci)
      const trigger = input.locale === 'pt' ? ac.declencheur : normTrigger(ac.declencheur)
      // FIX FINAL #4: afficher pourcentage si disponible — mais pas si le label
      // le contient déjà (ex: "Adiantamento 30%" → ne pas redoubler "30% 30%").
      const labelHasPct = ac.pourcentage && label.includes(`${ac.pourcentage}%`)
      const pctStr = (ac.pourcentage && !labelHasPct) ? `${ac.pourcentage}% ` : ''
      pdf.text(`${label} : ${pctStr}${trigger}`, DEST_X0 + boxPadX, ay)
      pdf.setFont(FONT, 'bold')
      pdf.text(formatPrice(ac.montant), DEST_X0 + DEST_W - boxPadX, ay, { align: 'right' })
      pdf.setFont(FONT, 'normal')
      ay += ptToMm(13)
    }
    y += acBlockH + 4
  }

  // ═══════════════════════════════════════════════════════════
  // 13. MENTIONS LÉGALES (bas de page 1)
  // ═══════════════════════════════════════════════════════════

  const genDate = formatDate(new Date(), dateLocale)
  // Build insurance mention from new fields, fallback to rc_pro
  const insName = input.artisan.insurance_name
  const insNumber = input.artisan.insurance_number
  const insCoverage = input.artisan.insurance_coverage || T.insuranceCoverDefault
  const insTypeLabel = input.artisan.insurance_type === 'decennale' ? T.decennale
    : input.artisan.insurance_type === 'both' ? T.rcProAndDec : T.rcPro
  // FR : RC Pro obligatoire (art. L243-2 C. assurances) — throw si manquant.
  // PT : pas d'obligation légale équivalente pour ENI / Trabalhador independente
  //   → on tolère l'absence et on n'affiche pas de ligne assurance.
  let insuranceLine: string | null
  if (insName && insNumber) {
    insuranceLine = `${insTypeLabel} ${insName}, ${T.contractWord} ${insNumber}, ${T.coverageWord} ${insCoverage}.`
  } else if (insName) {
    insuranceLine = `${insTypeLabel} ${insName}, ${T.coverageWord} ${insCoverage}.`
  } else if (input.artisan.rc_pro) {
    insuranceLine = `${T.rcPro} ${input.artisan.rc_pro}, ${T.coverageWord} ${insCoverage}.`
  } else if (isPt) {
    insuranceLine = null
  } else {
    throw new Error('Assurance RC Pro obligatoire pour générer un devis (art. L243-2 C. assurances)')
  }
  // Rétractation et délai 7 jours : applicables UNIQUEMENT B2C hors établissement
  // et seulement pour un devis (pas sur une facture émise après prestation).
  // PT : un NIF ne signifie pas B2B (tous les particuliers ont un NIF).
  // On exclut la rétractation uniquement si le client a un SIRET FR (pas NIF PT).
  const clientIsB2B = !isPt && !!input.client.siret
  const showRetractation = !isFacture && input.isHorsEtablissement !== false && !clientIsB2B
  // isFranchise293B d\u00E9j\u00E0 d\u00E9clar\u00E9 ligne 501 (coh\u00E9rence avec en-t\u00EAte tableau).
  const legalParagraph = [
    T.eiMention,
    isFranchise293B && T.tvaExempt ? T.tvaExempt : null,
    insuranceLine,
    isFacture ? null : T.quoteFree,
    showRetractation ? T.retractionLegal1 : null,
    showRetractation ? T.retractionLegal2 : null,
    // PT : Livro de Reclamações obligatoire (DL 156/2005) + CNIACC (Lei 144/2015).
    isPt ? 'Livro de Reclamações disponível em formato eletrónico em www.livroreclamacoes.pt (DL 156/2005).' : null,
    isPt && !input.mediateur
      ? `${T.mediationLabel} (sem adesão voluntária): CNIACC — www.cniacc.pt (Lei 144/2015 art. 18.º).`
      : null,
    input.mediateur
      ? `${T.mediationLabel} : ${input.mediateur}${input.mediateur_url ? ', ' + input.mediateur_url : ''}.`
      : null,
    `${T.generatedBy} ${genDate}.`,
  ].filter(Boolean).join(' ')

  const legalY = pageH - 18
  if (y < legalY - 2) {
    drawHLine(ML, legalY, xRight, COLOR.BORDER, 0.18)
    pdf.setFont(FONT, 'normal'); pdf.setFontSize(6.5); pdf.setTextColor(COLOR.TEXT_LIGHT)
    pdf.text(pdf.splitTextToSize(legalParagraph, contentW), ML, legalY + 3)
  } else {
    y += 4
    drawHLine(ML, y, xRight, COLOR.BORDER, 0.18); y += 3
    pdf.setFont(FONT, 'normal'); pdf.setFontSize(6.5); pdf.setTextColor(COLOR.TEXT_LIGHT)
    const lw = pdf.splitTextToSize(legalParagraph, contentW)
    pdf.text(lw, ML, y); y += lw.length * ptToMm(10)
  }

  // ═══════════════════════════════════════════════════════════
  // PAGE 2: DROIT DE RÉTRACTATION (B2C uniquement — art. L. 221-18 C. conso.)
  // ═══════════════════════════════════════════════════════════

  if (!isFacture && input.isHorsEtablissement !== false && !clientIsB2B) {
  pdf.addPage()
  let ry = 8
  pdf.setFillColor(COLOR.ACCENT); pdf.rect(ML, ry, contentW, ptToMm(3), 'F')
  ry += ptToMm(3) + 8

  pdf.setFontSize(12); pdf.setFont(FONT, 'bold'); pdf.setTextColor(COLOR.TEXT)
  pdf.text(T.retractionTitle, ML, ry); ry += 5
  pdf.setFontSize(9); pdf.setFont(FONT, 'normal'); pdf.setTextColor(COLOR.TEXT)
  pdf.text(T.retractionLawRef, ML, ry); ry += 8

  pdf.setFontSize(9); pdf.setFont(FONT, 'normal'); pdf.setTextColor(COLOR.TEXT)
  const retTexts = [T.retractionText1, T.retractionText2, T.retractionText3]
  retTexts.forEach(txt => {
    const w = pdf.splitTextToSize(txt, contentW)
    pdf.text(w, ML, ry); ry += w.length * ptToMm(13) + 4
  })
  ry += 4

  // Formulaire rétractation / Formulário de livre resolução
  pdf.setFillColor(COLOR.TEXT); pdf.rect(ML, ry, contentW, 8, 'F')
  pdf.setFontSize(10); pdf.setFont(FONT, 'bold'); pdf.setTextColor(COLOR.WHITE)
  pdf.text(T.retractionForm, ML + boxPadX, ry + 5.5)
  ry += 12

  pdf.setFontSize(9); pdf.setFont(FONT, 'normal'); pdf.setTextColor(COLOR.TEXT)
  const formAttn = T.attentionTo
  pdf.setFont(FONT, 'bold')
  // Adresse artisan normalisée — remplacer \n par ", " pour une ligne continue,
  // puis wrapper si trop long pour éviter le chevauchement.
  const artAddr = titleCaseAddress(input.artisan.adresse).replace(/\n/g, ', ')
  const attnPhone = input.artisan.telephone ? ` — Tel.: ${input.artisan.telephone}` : ''
  const attnEmail = input.artisan.email ? ` — Email: ${input.artisan.email}` : ''
  const attnFull = `${formAttn}${input.artisan.nom}, ${artAddr}${attnPhone}${attnEmail}`
  const attnWrapped = pdf.splitTextToSize(attnFull, contentW - boxPadX * 2)
  pdf.text(attnWrapped, ML + boxPadX, ry)
  ry += attnWrapped.length * ptToMm(13) + 2

  pdf.setFont(FONT, 'normal')
  pdf.text(T.retractionNotify, ML + boxPadX, ry)
  ry += 8

  const formFields = [T.formOrdered, T.formClientName, T.formAddress, T.formDate, T.formSignature]
  for (const f of formFields) {
    pdf.text(f, ML + boxPadX, ry)
    // Trace souligné pour les champs à remplir (sauf Date / Assinatura qui ont
    // déjà leurs propres séparateurs visuels via les underscores).
    if (!f.startsWith(T.formDate.slice(0, 4)) && !f.startsWith(T.formSignature.slice(0, 4))) {
      const fw = pdf.getTextWidth(f) + 2
      pdf.setDrawColor(COLOR.BORDER); pdf.setLineWidth(0.2)
      pdf.line(ML + boxPadX + fw, ry + 0.5, xRight - boxPadX, ry + 0.5)
    }
    ry += 8
  }
  } // end B2C retractation guard

  // ═══════════════════════════════════════════════════════════
  // PAGINATION
  // ═══════════════════════════════════════════════════════════

  const totalPages = pdf.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i)
    pdf.setFont(FONT, 'normal'); pdf.setFontSize(8); pdf.setTextColor(COLOR.TEXT_LIGHT)
    pdf.text(`${T.page} ${i}/${totalPages}`, xRight - 2, pageH - 3.2, { align: 'right' })
  }

  return pdf
}
