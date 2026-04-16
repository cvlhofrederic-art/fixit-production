// ═══════════════════════════════════════════════
// TYPES & CONSTANTS for DevisFactureForm
// Extracted from components/DevisFactureForm.tsx
// ═══════════════════════════════════════════════

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
  { value: 'u',    label: 'u — Unité'           },
  { value: 'm2',   label: 'm² — Mètre carré'    },
  { value: 'ml',   label: 'ml — Mètre linéaire' },
  { value: 'm3',   label: 'm³ — Mètre cube'     },
  { value: 'h',    label: 'h — Heure'           },
  { value: 'j',    label: 'j — Jour'            },
  { value: 'f',    label: 'f — Forfait'         },
  { value: 'lot',  label: 'lot — Lot'           },
  { value: 'm',    label: 'm — Mètre'           },
  { value: 'kg',   label: 'kg — Kilogramme'     },
  { value: 'L',    label: 'L — Litre'           },
  { value: 't',    label: 't — Tonne'           },
  { value: 'pce',  label: 'pce — Pièce'         },
  { value: 'ens',  label: 'ens — Ensemble'      },
  { value: 'pt',   label: 'pt — Point'          },
  { value: 'autre', label: '✏️ Personnalisé...' },
]

export const UNITE_VALUES = new Set(UNITES_DEVIS.map(u => u.value))

export interface DevisEtape {
  id: string
  ordre: number
  designation: string
  source_etape_id?: string  // id de l'étape template (null si ajoutée manuellement)
}

export interface DevisAcompte {
  id: string
  ordre: number
  label: string
  pourcentage: number
  declencheur: string
}

export interface DevisFactureData {
  docType: 'devis' | 'facture'
  docNumber: string
  docTitle: string
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
  clientType?: string
  // Document
  docDate: string
  docValidity: number
  prestationDate: string
  executionDelay: string
  executionDelayDays: number
  executionDelayType: 'ouvres' | 'calendaires'
  // Payment (facture only)
  paymentMode: string
  paymentDue: string
  paymentCondition: string
  discount: string
  iban: string
  bic: string
  // Lines
  lines: ProductLine[]
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
}
