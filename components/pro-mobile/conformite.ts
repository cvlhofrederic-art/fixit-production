// Portefeuille de conformité (types de documents, échéances) et preuves d'intervention de l'app mobile pro, partagés par
// app/(commun)/pro/mobile/page.tsx et components/pro-mobile/pages/MobileDocumentsSection.tsx.
export const COMPLIANCE_TYPES = [
  { key: 'decennale',      label: 'RC Décennale',         labelKey: 'proDash.wallet.assuranceDecennale', icon: '🛡️', renewYears: 1 },
  { key: 'kbis',           label: 'Extrait KBIS',         labelKey: 'proDash.wallet.kbis',              icon: '📋', renewYears: 0 },
  { key: 'urssaf',         label: 'Attestation URSSAF',   labelKey: 'proDash.wallet.urssaf',            icon: '🏛️', renewYears: 0 },
  { key: 'rge',            label: 'Certificat RGE',       labelKey: 'proDash.wallet.rge',               icon: '♻️', renewYears: 4 },
  { key: 'carte_pro',      label: 'Carte Pro BTP',        labelKey: 'proDash.wallet.carteProBtp',       icon: '🪪', renewYears: 5 },
  { key: 'passeport_prev', label: 'Passeport Prévention', labelKey: 'proDash.wallet.passeportPrevention', icon: '🎓', renewYears: 0 },
  { key: 'assurance_pro',  label: 'Assurance Pro (RC)',   labelKey: 'proDash.wallet.rcPro',             icon: '🔒', renewYears: 1 },
  { key: 'autre',          label: 'Autre document',       labelKey: 'mob.compliance.other',             icon: '📄', renewYears: 0 },
] as const
export type ComplianceType = typeof COMPLIANCE_TYPES[number]['key']

export interface ComplianceDoc {
  id: string
  type: ComplianceType
  dateExpiration: string | null
  notes: string
  addedAt: string
  // OCR fields
  ocrData?: {
    rawText?: string
    assureur?: string
    numPolice?: string
    montantGarantie?: string
    activiteCouverte?: string
    detectedType?: ComplianceType
    confidence?: number
    scannedAt?: string
  }
  photoDataUrl?: string
  verificationStatus?: 'pending' | 'verified' | 'rejected'
  passeportPrevention?: string
}

export function getComplianceStatus(doc: ComplianceDoc): 'valid' | 'expiring' | 'expired' | 'nodoc' {
  if (!doc.dateExpiration) return 'nodoc'
  const days = Math.ceil((new Date(doc.dateExpiration).getTime() - Date.now()) / 86400000)
  if (days < 0)   return 'expired'
  if (days <= 30) return 'expiring'
  return 'valid'
}

export interface ProofPhoto {
  dataUrl: string
  timestamp: string
  lat?: number
  lng?: number
  label: string
}

export interface InterventionProof {
  bookingId: string
  step: 'before' | 'during' | 'after' | 'signature'
  beforePhotos: ProofPhoto[]
  duringPhotos: ProofPhoto[]
  afterPhotos: ProofPhoto[]
  description: string
  signature?: string
  startedAt?: string
  completedAt?: string
  gpsLat?: number
  gpsLng?: number
}
