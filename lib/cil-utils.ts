/**
 * Carnet de Santé Logement (CIL) — utility functions
 * Extracted from client dashboard for reusability and testability.
 */

import type { Booking } from '@/lib/types'

export interface CILEntry {
  id: string
  bookingId: string
  date: string
  artisanName: string
  artisanId?: string
  serviceName: string
  category: 'plomberie' | 'electricite' | 'chauffage' | 'serrurerie' | 'peinture' | 'menuiserie' | 'autre'
  description: string
  address: string
  priceTTC: number
  hasProof: boolean
  proofPhotosCount: number
  hasSignature: boolean
  hasGPS: boolean
  warranty?: { type: string; endDate: string }
  nextMaintenance?: string
  notes?: string
  documents?: { name: string; type: string }[]
}

interface ProofEntry {
  bookingId: string
  beforePhotos?: string[]
  afterPhotos?: string[]
  signature?: string
  gpsLat?: number
  gpsLng?: number
}

/** Detect intervention category from service name */
export function detectCategory(serviceName: string): CILEntry['category'] {
  const s = serviceName.toLowerCase()
  if (s.match(/plomb|fuite|robinet|wc|sani|eau|tuyau/)) return 'plomberie'
  if (s.match(/electr|prise|tableau|disj|câbl|inter/)) return 'electricite'
  if (s.match(/chauff|chaudière|radiateur|thermo|clim/)) return 'chauffage'
  if (s.match(/serrur|porte|clé|verrou|blind/)) return 'serrurerie'
  if (s.match(/peint|mur|plaf|end/)) return 'peinture'
  if (s.match(/menuis|bois|parquet|meuble|étagère/)) return 'menuiserie'
  return 'autre'
}

/** Generate CIL entries from completed bookings */
export function generateCILEntries(
  bookings: Booking[],
  labels: { warrantyBiennial: string; warrantyAnnual: string }
): CILEntry[] {
  let proofs: ProofEntry[] = []
  try { proofs = JSON.parse(localStorage.getItem('fixit_proofs') || '[]') } catch (e) { console.warn('[storage] fixit_proofs parse', e) }

  return bookings
    .filter(b => b.status === 'completed')
    .map(b => {
      const proof = proofs.find((p: ProofEntry) => p.bookingId === b.id)
      const category = detectCategory(b.services?.name || '')
      const isStructural = ['plomberie', 'electricite', 'chauffage'].includes(category)
      const bookingDate = b.booking_date || new Date().toISOString().split('T')[0]

      const warrantyEnd = new Date(bookingDate)
      warrantyEnd.setFullYear(warrantyEnd.getFullYear() + (isStructural ? 2 : 1))

      const nextMaint = new Date(bookingDate)
      nextMaint.setFullYear(nextMaint.getFullYear() + 1)

      return {
        id: `cil-${b.id}`,
        bookingId: b.id,
        date: bookingDate,
        artisanName: b.profiles_artisan?.company_name || 'Artisan',
        artisanId: b.artisan_id,
        serviceName: b.services?.name || 'Intervention',
        category,
        description: b.notes || '',
        address: b.address || '',
        priceTTC: b.price_ttc || 0,
        hasProof: !!proof,
        proofPhotosCount: proof ? (proof.beforePhotos?.length || 0) + (proof.afterPhotos?.length || 0) : 0,
        hasSignature: !!proof?.signature,
        hasGPS: !!(proof?.gpsLat && proof?.gpsLng),
        warranty: {
          type: isStructural ? labels.warrantyBiennial : labels.warrantyAnnual,
          endDate: warrantyEnd.toISOString().split('T')[0],
        },
        nextMaintenance: nextMaint.toISOString().split('T')[0],
      }
    })
}

/** Calculate health score (0-100) from CIL entries */
export function getCILHealthScore(entries: CILEntry[]): number {
  if (entries.length === 0) return 0
  let score = 0
  let total = 0
  const now = new Date()

  entries.forEach(e => {
    // Proof coverage (+30 max)
    total += 30
    if (e.hasProof) score += 15
    if (e.hasSignature) score += 10
    if (e.hasGPS) score += 5

    // Warranty status (+40 max)
    total += 40
    if (e.warranty) {
      const wEnd = new Date(e.warranty.endDate)
      if (wEnd > now) {
        score += 40
      } else {
        const monthsExpired = (now.getTime() - wEnd.getTime()) / (1000 * 60 * 60 * 24 * 30)
        if (monthsExpired < 6) score += 20
      }
    }

    // Maintenance (+30 max)
    total += 30
    if (e.nextMaintenance) {
      const mDate = new Date(e.nextMaintenance)
      if (mDate > now) score += 30
      else {
        const monthsOverdue = (now.getTime() - mDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
        if (monthsOverdue < 3) score += 15
      }
    }
  })

  return total > 0 ? Math.round((score / total) * 100) : 0
}

/** Category display info */
export function getCategoryInfo(
  cat: CILEntry['category'],
  labels: Record<CILEntry['category'], string>
): { label: string; icon: string; color: string } {
  const info: Record<CILEntry['category'], { icon: string; color: string }> = {
    plomberie: { icon: '🚰', color: 'bg-blue-100 text-blue-700' },
    electricite: { icon: '⚡', color: 'bg-yellow-100 text-yellow-700' },
    chauffage: { icon: '🔥', color: 'bg-orange-100 text-orange-700' },
    serrurerie: { icon: '🔑', color: 'bg-purple-100 text-purple-700' },
    peinture: { icon: '🎨', color: 'bg-pink-100 text-pink-700' },
    menuiserie: { icon: '🪚', color: 'bg-amber-100 text-amber-700' },
    autre: { icon: '🔧', color: 'bg-warm-gray text-mid' },
  }
  const entry = info[cat] || info.autre
  return { label: labels[cat] || cat, ...entry }
}

/** Artisan punctuality score (% completed vs accepted) */
export function getPonctualiteScore(bookings: Booking[], artisanId: string | undefined): number | null {
  if (!artisanId) return null
  const artisanBookings = bookings.filter(b => b.artisan_id === artisanId)
  const completed = artisanBookings.filter(b => b.status === 'completed').length
  const total = artisanBookings.filter(b => ['completed', 'confirmed', 'cancelled'].includes(b.status)).length
  if (total < 2) return null
  return Math.round((completed / total) * 100)
}
