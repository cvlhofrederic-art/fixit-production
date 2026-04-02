// Shared TypeScript interfaces for the Vitfix platform
// Replaces `any` types across dashboard components

export interface Artisan {
  id: string
  user_id: string
  nom?: string
  company_name?: string
  email?: string
  phone?: string
  bio?: string
  siret?: string
  nif?: string
  logo_url?: string | null
  photo_url?: string | null
  rating_avg?: number
  rating_count?: number
  auto_accept?: boolean
  auto_reply_message?: string
  auto_block_duration_minutes?: number
  zone_radius_km?: number
  insurance_name?: string
  insurance_number?: string
  insurance_coverage?: string
  insurance_type?: string
  insurance_expiry?: string | null
  subscription_plan?: string
  subscription_status?: string
  stripe_customer_id?: string | null
  created_at?: string
  updated_at?: string
  profile_photo_url?: string | null
  user_metadata?: { full_name?: string; avatar_url?: string; [key: string]: unknown } | null
  slug?: string
  category?: string
  specialties?: string[]
  latitude?: number | null
  longitude?: number | null
  city?: string
  postal_code?: string
  full_name?: string
  kbis_url?: string | null
  insurance_url?: string | null
  insurance_verified?: boolean
  insurance_scan_data?: Record<string, unknown> | null
  is_active?: boolean
  verified?: boolean
}

export interface Service {
  id: string
  artisan_id: string
  name: string
  description?: string
  price_ht?: number
  price_ttc?: number
  duration_minutes?: number
  active?: boolean
  category?: string
  validation_auto?: boolean
  delai_minimum_heures?: number
  created_at?: string
}

export interface Booking {
  id: string
  artisan_id: string
  service_id?: string
  client_id?: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | string
  booking_date?: string
  booking_time?: string
  duration_minutes?: number
  address?: string
  notes?: string
  price_ht?: number
  price_ttc?: number
  confirmed_at?: string | null
  cancelled_at?: string | null
  completed_at?: string | null
  created_at?: string
  services?: { name: string; price_ttc?: number } | null
  profiles_artisan?: Partial<Artisan> | null
  client_name?: string
  client_phone?: string
  client_email?: string
  client_address?: string
  name?: string
  phone?: string
  email?: string
  expires_at?: string | null
  syndic_id?: string | null
  metadata?: Record<string, unknown> | null
}

export interface Availability {
  id: string
  artisan_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_available: boolean
}

export interface Absence {
  id: string
  artisan_id: string
  start_date: string
  end_date: string
  reason?: string
  label?: string
  source?: string
  created_at?: string
}

export interface Notification {
  id: string
  user_id: string
  type: string
  title?: string
  message?: string
  body?: string
  read?: boolean
  data?: Record<string, unknown>
  data_json?: string | Record<string, unknown> | null
  created_at?: string
}

export interface ChatMessage {
  id: string
  booking_id: string
  sender_id?: string
  sender_role?: string
  content: string
  type?: 'text' | 'photo' | 'voice' | 'devis_sent' | 'devis_signed' | string
  attachment_url?: string | null
  read?: boolean
  metadata?: Record<string, unknown>
  created_at?: string
  sender_name?: string
}

export interface SavedDocument {
  id: string
  type: 'devis' | 'facture' | 'avoir'
  docNumber?: string
  clientName?: string
  service?: string
  totalTTC?: number
  totalHT?: number
  status?: string
  created_at?: string
}

export interface SyndicCabinet {
  id: string
  user_id: string
  nom: string
  siret?: string
  adresse?: string
  ville?: string
  code_postal?: string
  telephone?: string
  email?: string
  created_at?: string
}

export interface Immeuble {
  id: string
  cabinet_id: string
  nom: string
  adresse: string
  ville: string
  code_postal: string
  nb_lots?: number
  created_at?: string
}
