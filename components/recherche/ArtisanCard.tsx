'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Star,
  MapPin,
  Award,
  Zap,
  Clock,
  Calendar,
} from 'lucide-react'
import { getCategoryLabel } from '@/lib/search-categories'
import { getProfilePath } from '@/lib/utils'

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface Artisan {
  id: string
  user_id?: string | null
  slug?: string | null
  company_name: string | null
  bio: string | null
  categories: string[]
  hourly_rate: number | null
  rating_avg: number
  rating_count: number
  verified: boolean
  active: boolean
  zone_radius_km: number
  city?: string | null
  experience_years?: number | null
  profile_photo_url?: string | null
  services?: Service[]
  country?: string | null
  latitude?: number | null
  longitude?: number | null
  distance_km?: number | null
  org_role?: string | null
  source?: 'registered' | 'catalogue'
  telephone_pro?: string | null
  adresse?: string | null
  arrondissement?: string | null
  intervention_zones?: {
    regions?: string[]
    departments?: string[]
    cities?: string[]
  } | null
  display_location?: string | null  // calculé par la page recherche (zones prioritaires sur adresse)
}

export interface Service {
  id: string
  artisan_id: string
  name: string
  description: string | null
  duration_minutes: number
  price_ht: number
  price_ttc: number
  active: boolean
}

export interface Availability {
  id: string
  artisan_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_available: boolean
}

export interface Booking {
  id: string
  artisan_id: string
  booking_date: string
  booking_time: string
  duration_minutes: number | null
  status: string
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function getInitials(name: string | null): string {
  if (!name) return '?'
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return words[0].charAt(0).toUpperCase()
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase()
}

// ------------------------------------------------------------------
// StarsRow
// ------------------------------------------------------------------

function StarsRow({ rating, reviewCount, locale = 'fr' }: { rating: number; reviewCount: number; locale?: 'fr' | 'pt' }) {
  const fullStars = Math.floor(rating)
  const hasHalf = rating - fullStars >= 0.5
  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`w-3.5 h-3.5 ${
              i < fullStars
                ? 'fill-[#FFC107] text-yellow'
                : i === fullStars && hasHalf
                  ? 'fill-[#FFC107]/50 text-yellow'
                  : 'fill-gray-200 text-gray-200'
            }`}
          />
        ))}
      </div>
      <span className="text-sm font-semibold">{rating.toFixed(1)}</span>
      <span className="text-xs text-gray-500">({reviewCount} {locale === 'pt' ? 'avaliações' : 'avis'})</span>
    </div>
  )
}

// ------------------------------------------------------------------
// ArtisanCard
// ------------------------------------------------------------------

export interface ArtisanCardProps {
  artisan: Artisan
  availability: Availability[]
  bookings: Booking[]
  locale: 'fr' | 'pt'
}

export function ArtisanCard({
  artisan,
  availability,
  bookings,
  locale,
}: ArtisanCardProps) {
  const initials = getInitials(artisan.company_name)
  const primaryCategory = artisan.categories?.[0]
  const hasGoogleReviews = (artisan.rating_count || 0) > 0
  const rating = artisan.rating_avg || 0
  const reviewCount = artisan.rating_count || 0
  const isCatalogue = artisan.source === 'catalogue'
  const profileHref = getProfilePath(artisan, locale)

  // Badges
  const badges: { icon: React.ReactNode; label: string; color: string }[] = []
  if (artisan.verified && !isCatalogue) {
    badges.push({
      icon: <Award className="w-3 h-3" />,
      label: locale === 'pt' ? 'Profissional certificado' : 'Artisan certifié',
      color: 'bg-green-50 text-green-700 border-green-200',
    })
  }
  if (!isCatalogue) {
    const hasWeekendOrWideHours = availability.some(
      (a) => a.is_available && (a.day_of_week === 0 || a.day_of_week === 6)
    )
    if (hasWeekendOrWideHours) {
      badges.push({
        icon: <Zap className="w-3 h-3" />,
        label: locale === 'pt' ? 'Intervenção rápida' : 'Intervention rapide',
        color: 'bg-amber-50 text-amber-700 border-amber-200',
      })
    }
  }

  return (
    <div className="bg-white rounded-2xl hover:shadow-[0_4px_30px_rgba(0,0,0,0.08)] transition-shadow border-[1.5px] border-[#EFEFEF]">
      <div className="p-5 lg:p-6">
        <div className="flex flex-col lg:flex-row lg:gap-6">
          {/* Avatar */}
          <div className="flex lg:flex-col items-center lg:items-center gap-4 lg:gap-2 mb-4 lg:mb-0 lg:w-20 flex-shrink-0">
            {artisan.profile_photo_url ? (
              <Image
                src={artisan.profile_photo_url}
                alt={artisan.company_name || 'Artisan'}
                width={64}
                height={64}
                className="w-14 h-14 lg:w-16 lg:h-16 rounded-full object-cover shadow-sm flex-shrink-0"
              />
            ) : (
              <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-full bg-gradient-to-br from-yellow to-[#FFE84D] flex items-center justify-center text-white font-bold text-lg lg:text-xl shadow-sm flex-shrink-0">
                {initials}
              </div>
            )}
            {hasGoogleReviews && (
              <div className="hidden lg:flex items-center gap-0.5 mt-1">
                <Star className="w-3.5 h-3.5 fill-[#FFC107] text-yellow" />
                <span className="text-xs font-semibold">{rating.toFixed(1)}</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 mb-4 lg:mb-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                {isCatalogue ? (
                  <span className="font-bold text-lg">{artisan.company_name || 'Artisan'}</span>
                ) : (
                  <Link href={profileHref} className="font-display font-bold text-lg text-dark hover:text-yellow transition">
                    {artisan.company_name || 'Artisan'}
                  </Link>
                )}
                {primaryCategory && (
                  <p className="text-sm text-gray-500">{getCategoryLabel(primaryCategory, locale)}</p>
                )}
              </div>
            </div>

            {hasGoogleReviews && (
              <div className="mt-1 lg:hidden">
                <StarsRow rating={rating} reviewCount={reviewCount} locale={locale} />
              </div>
            )}
            {hasGoogleReviews && (
              <div className="hidden lg:block mt-1">
                <StarsRow rating={rating} reviewCount={reviewCount} locale={locale} />
              </div>
            )}

            <div className="mt-2 space-y-1">
              {artisan.experience_years && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  <span>{artisan.experience_years} {locale === 'pt' ? 'anos de experiência' : 'ans d\'expérience'}</span>
                </div>
              )}
              {(() => {
                // Inscrits : afficher la zone d'intervention pertinente (display_location)
                // Catalogue : fallback sur adresse/city
                const isRegistered = artisan.source === 'registered'
                const locationText = isRegistered
                  ? (artisan.display_location || artisan.city || '')
                  : (artisan.adresse || artisan.city || '')
                if (!locationText && artisan.distance_km == null) return null
                return (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <MapPin className="w-3 h-3" />
                    <span>
                      {locationText}
                      {artisan.distance_km != null && (
                        <span className="ml-1 font-semibold text-yellow">
                          ({artisan.distance_km < 1
                            ? `${Math.round(artisan.distance_km * 1000)} m`
                            : artisan.distance_km < 10
                              ? `${artisan.distance_km.toFixed(1)} km`
                              : `${Math.round(artisan.distance_km)} km`
                          })
                        </span>
                      )}
                    </span>
                  </div>
                )
              })()}
            </div>

            {badges.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {badges.map((badge, idx) => (
                  <span key={idx} className={`inline-flex items-center gap-1 text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full border ${badge.color}`}>
                    {badge.icon}
                    {badge.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Colonne 3 : Calendrier (inscrit) ou Contact (catalogue) */}
          <div className="lg:w-64 xl:w-72 flex-shrink-0 border-t lg:border-t-0 lg:border-l border-border pt-4 lg:pt-0 lg:pl-5">
            {isCatalogue ? (
              <div className="flex flex-col gap-3 h-full justify-center">
                {/* Numéro flouté */}
                <div
                  className="flex items-center justify-center gap-2 bg-yellow rounded-xl text-dark font-mono py-3 px-4 text-sm font-semibold"
                  style={{ filter: 'blur(4px)', userSelect: 'none', pointerEvents: 'none', letterSpacing: '0.05em' }}
                  aria-hidden="true"
                >
                  {artisan.telephone_pro || (locale === 'pt' ? '+351 ••• ••• •••' : '06 •• •• •• ••')}
                </div>
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent((artisan.company_name || '') + ' ' + (artisan.adresse || artisan.city || (locale === 'pt' ? 'Porto' : 'Marseille')))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 border border-gray-200 hover:border-yellow text-gray-700 hover:text-yellow font-semibold py-2 px-4 rounded-lg transition text-sm"
                >
                  {locale === 'pt' ? 'Ver no Google' : 'Voir sur Google'}
                </a>
                {hasGoogleReviews && (
                  <p className="text-[10px] text-gray-500 text-center">
                    {reviewCount} {locale === 'pt' ? 'avaliações Google' : 'avis Google'} {rating.toFixed(1)}/5
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3 h-full justify-center">
                <Link
                  href={profileHref}
                  className="flex items-center justify-center gap-2 bg-yellow hover:bg-yellow-light text-dark font-bold py-3 px-4 rounded-xl transition text-sm hover:-translate-y-px"
                >
                  <Calendar className="w-4 h-4" />
                  {locale === 'pt' ? 'Agendar visita' : 'Prendre rendez-vous'}
                </Link>
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent((artisan.company_name || '') + ' ' + (artisan.city || ''))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 border border-gray-200 hover:border-yellow text-gray-700 hover:text-yellow font-semibold py-2 px-4 rounded-lg transition text-sm"
                >
                  {locale === 'pt' ? 'Ver no Google' : 'Voir sur Google'}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
