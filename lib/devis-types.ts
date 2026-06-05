// ═══════════════════════════════════════════════
// TYPES & CONSTANTS for DevisFactureForm
// Extracted from components/DevisFactureForm.tsx
// ═══════════════════════════════════════════════

// ── Gestion des déchets de chantier (loi AGEC, décret 2020-1817) ──
// Art. D.541-45-1 C. env. : 4 infos obligatoires dans le devis BTP :
//   1. Nature des déchets (inertes / non dangereux non inertes / dangereux)
//   2. Estimation des quantités
//   3. Nom + adresse de l'installation de collecte/traitement
//   4. Modalités de tri sur chantier (+ coût, qui peut rester "inclus")
export interface DechetsChantierInfo {
  /** Ex. « Inertes (gravats, terres) et non dangereux non inertes (bois, plastique) ». */
  nature?: string
  /** Estimation quantitative — chiffre seul, ex. « 2.5 ». */
  quantiteEstimee?: string
  /** Unité de mesure — ex. m³, kg, L, t. */
  unite?: string
  /** Raison sociale de l'installation de collecte/traitement. */
  installationNom?: string
  /** Adresse complète de l'installation. */
  installationAdresse?: string
  /** Modalités de tri pratiquées sur le chantier. */
  modalitesTri?: string
  /** Coût de gestion — peut rester « Inclus dans la prestation ». */
  coutGestion?: string
}

// ── Signature types ──
export interface SignatureData {
  svg_data: string
  signataire: string
  timestamp: string
  document_ref: string
  hash_sha256: string
}

export interface ProductLine {
  id: number
  description: string
  lineDetail?: string  // description libre entre titre et étapes
  qty: number
  unit: string  // valeur courte : u, m2, ml, m3, h, j, f, lot, m, kg, L, t, pce, ens, pt, ou valeur personnalisée
  customUnit?: string  // si unit === 'autre', contient la valeur saisie (max 8 chars)
  priceHT: number
  tvaRate: number
  totalHT: number
  source?: 'etape_motif' | 'manual'  // traçabilité étape → ligne
  etape_id?: string  // lien vers l'étape source
  etapes?: DevisEtape[]  // étapes d'intervention rattachées à cette prestation
}

// ═══════════════════════════════════════════════
// UNITÉS DE MESURE DEVIS
// ═══════════════════════════════════════════════
export const UNITES_DEVIS = [
  // Géométrie
  { value: 'm2',       label: 'm² — Mètre carré'    },
  { value: 'ml',       label: 'ml — Mètre linéaire' },
  { value: 'm',        label: 'm — Mètre'           },
  { value: 'm3',       label: 'm³ — Mètre cube'     },
  // Comptage
  { value: 'u',        label: 'u — Unité'           },
  { value: 'pce',      label: 'pce — Pièce'         },
  { value: 'ens',      label: 'ens — Ensemble'      },
  { value: 'lot',      label: 'lot — Lot'           },
  { value: 'pt',       label: 'pt — Point'          },
  // Poids / volume liquide
  { value: 'kg',       label: 'kg — Kilogramme'     },
  { value: 't',        label: 't — Tonne'           },
  { value: 'L',        label: 'L — Litre'           },
  // Conditionnement chantier
  { value: 'sac',      label: 'sac — Sac'           },
  { value: 'rl',       label: 'rl — Rouleau'        },
  { value: 'palette',  label: 'palette'             },
  { value: 'benne',    label: 'benne'               },
  { value: 'camion',   label: 'camion'              },
  // Temps
  { value: 'h',        label: 'h — Heure'           },
  { value: 'j',        label: 'j — Jour'            },
  { value: 'sem',      label: 'sem — Semaine'       },
  // Facturation
  { value: 'f',        label: 'f — Forfait'         },
  { value: 'autre',    label: '✏️ Personnalisé...' },
]

export const UNITE_VALUES = new Set(UNITES_DEVIS.map(u => u.value))

export interface DevisEtape {
  id: string
  ordre: number
  designation: string
  prixHT?: number           // prix optionnel pour détailler le coût par étape
  unit?: string             // unité optionnelle par étape (ex. m², h, forfait)
  source_etape_id?: string  // id de l'étape template (null si ajoutée manuellement)
}

export interface DevisAcompte {
  id: string
  ordre: number
  label: string
  pourcentage: number
  declencheur: string
}

export interface FraisAnnexeItem {
  id: number
  designation: string
  categorie: 'deplacement' | 'location_materiel' | 'hebergement' | 'peage' | 'carburant' | 'autre'
  quantite: number
  unite: 'forfait' | 'km' | 'jour' | 'heure'
  prix_unitaire_ht: number
  tva_applicable: number
  total_ht: number
}

export const FRAIS_ANNEXES_CATEGORIES = [
  { value: 'deplacement', label: 'Déplacement' },
  { value: 'location_materiel', label: 'Location matériel' },
  { value: 'hebergement', label: 'Hébergement' },
  { value: 'peage', label: 'Péage' },
  { value: 'carburant', label: 'Carburant' },
  { value: 'autre', label: 'Autre' },
] as const

export const FRAIS_ANNEXES_UNITES = [
  { value: 'forfait', label: 'Forfait' },
  { value: 'km', label: 'km' },
  { value: 'jour', label: 'Jour' },
  { value: 'heure', label: 'Heure' },
] as const

// CustomTable — sections de prestations additionnelles renommables/masquables.
// Parité avec le système BTP V3 : permet à un artisan EI de créer plusieurs
// blocs de prestations (ex. "DEPENSES PARC COROT (0F25-602G)") groupés par
// catégorie sémantique (labor / material / frais) ou neutres.
//
// Le rendu PDF V2 utilise mode_affichage='sections' pour grouper les lignes
// par section (cf. lib/pdf/devis-generator-v2.ts). Le label affiché est
// `customTable.name` ; la category sert juste à choisir une icône/couleur côté
// UI et à grouper les sous-totaux dans le résumé.
export interface CustomTable {
  id: string
  name: string
  category?: 'labor' | 'material' | 'frais'
  lines: ProductLine[]
}

export interface DevisFactureData {
  id?: string
  docType: 'devis' | 'facture'
  docNumber: string
  docTitle: string
  // Lien devis → facture (méthode pro 2026) : une facture issue d'un devis garde
  // la référence du devis source (traçabilité + reprise de l'échéancier d'acomptes).
  sourceDevisNumber?: string
  sourceDevisId?: string
  // Entreprise
  companyStatus: string
  companyName: string
  companySiret: string
  companyAddress: string
  companyRCS: string
  companyCapital: string
  companyPhone: string
  companyEmail: string
  insuranceNumber: string
  insuranceName: string
  insuranceCoverage: string
  insuranceType: 'rc_pro' | 'decennale' | 'both'
  // Médiateur
  mediatorName: string
  mediatorUrl: string
  isHorsEtablissement: boolean
  // TVA
  tvaEnabled: boolean
  tvaNumber: string
  // Client
  clientName: string
  clientEmail: string
  clientAddress: string
  interventionAddress: string
  interventionBatiment?: string
  interventionEtage?: string
  interventionEspacesCommuns?: string
  interventionExterieur?: string
  clientPhone: string
  clientSiret: string
  clientType: 'particulier' | 'professionnel'
  // Document
  docDate: string
  docValidity: number
  prestationDate: string
  executionDelay: string
  executionDelayDays: number
  executionDelayType: 'ouvres' | 'calendaires'
  // Sous-type facture (méthode pro 2026) — distingue les quatre cas légaux :
  //  - 'standard' : facture finale émise après prestation (art. 289 CGI)
  //  - 'acompte'  : facture d'acompte émise à l'encaissement, avant prestation
  //                 (TVA exigible à l'encaissement depuis 01/01/2023)
  //  - 'situation': facture de situation BTP (chantier long, avancement)
  //  - 'avoir'    : note de crédit annulant tout ou partie d'une facture émise
  //                 (BOI-TVA-DECLA-30-20-20-30 §70 ; art. 272 CGI). Montants
  //                 négatifs. Préfixe AV- via RPC next_doc_number. Référence
  //                 facture parente dans avoirDeFactureId.
  // Sur docType='devis', toujours undefined. Numérotation FACT-/AV- séparée
  // par RPC next_doc_number (séquence chronologique par préfixe et par artisan,
  // conforme Bpifrance / art. 242 nonies A annexe II CGI).
  factureSubType?: 'standard' | 'acompte' | 'situation' | 'avoir'
  /** Numéro de situation pour facture de situation BTP (1, 2, 3...) */
  situationNumber?: number
  /** Pourcentage d'avancement pour facture de situation BTP (0-100) */
  situationAvancement?: number
  /** Numéro d'ordre dans une série d'acomptes fractionnés (1, 2, 3...). */
  acompteOrdre?: number
  /** Nombre total d'acomptes prévus dans la série (ex. 3 pour "Acompte 2 sur 3"). */
  acompteTotal?: number
  /** Pourcentage de la base TTC représenté par cet acompte (1-100). */
  acomptePourcentage?: number
  /** ID de la facture parente sur laquelle s'impute cet acompte. */
  acompteDeFactureId?: string
  /** ID de la facture parente annulée (totalement ou partiellement) par cet avoir. */
  avoirDeFactureId?: string
  /** Motif d'annulation/correction (5-500 chars) — obligatoire pour les avoirs.
   *  Preuve fiscale (Code commerce L123-22, conservation 10 ans). */
  avoirMotif?: string
  // Payment (facture only)
  paymentMode: string
  paymentDue: string
  paymentCondition: string
  discount: string
  iban: string
  bic: string
  // Lines
  lines: ProductLine[]
  materialLines?: ProductLine[]
  fraisAnnexes: FraisAnnexeItem[]
  // Tables additionnelles (parité BTP V3) — sections nommables ajoutées
  // dynamiquement par l'artisan, persistées dans raw_data (pas de migration DB).
  customTables?: CustomTable[]
  ordreDeService?: string
  chantierId?: string
  // Étapes d'intervention (descriptif pour le client)
  etapes?: DevisEtape[]
  // Notes
  notes: string
  // Acomptes
  acomptesEnabled?: boolean
  acomptes?: DevisAcompte[]
}

export interface ArtisanBasic {
  id: string
  company_name?: string
  company_address?: string
  address?: string
  siret?: string
  phone?: string
  email?: string
  city?: string
  [key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface ServiceBasic {
  id: string
  name: string
  price_ht?: number
  price_ttc?: number
  duration_minutes?: number
  description?: string
  [key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface BookingBasic {
  id: string
  booking_date?: string
  booking_time?: string
  status: string
  client_id?: string
  client_name?: string
  address?: string
  notes?: string
  price_ht?: number
  price_ttc?: number
  service_id?: string
  services?: { name: string } | null
  [key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface DevisFactureFormProps {
  artisan: ArtisanBasic
  services: ServiceBasic[]
  bookings: BookingBasic[]
  initialDocType?: 'devis' | 'facture'
  initialData?: Partial<DevisFactureData>
  onBack: () => void
  onSave?: (data: DevisFactureData) => void
  onConvertToFacture?: (data: DevisFactureData) => void
}
