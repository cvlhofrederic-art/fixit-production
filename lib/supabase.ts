import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key-for-build'

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string
          name: string
          slug: string
          icon: string | null
          description: string | null
          active: boolean
          created_at: string
        }
      }
      profiles_artisan: {
        Row: {
          id: string
          user_id: string | null
          company_name: string | null
          siret: string | null
          bio: string | null
          categories: string[]
          hourly_rate: number | null
          zone_radius_km: number
          latitude: number | null
          longitude: number | null
          rating_avg: number
          rating_count: number
          verified: boolean
          subscription_tier: string
          active: boolean
          created_at: string
          updated_at: string
        }
      }
      services: {
        Row: {
          id: string
          artisan_id: string
          category_id: string | null
          name: string
          description: string | null
          duration_minutes: number
          price_ht: number
          price_ttc: number
          active: boolean
          created_at: string
        }
      }
      bookings: {
        Row: {
          id: string
          client_id: string | null
          artisan_id: string | null
          service_id: string | null
          status: string
          booking_date: string
          booking_time: string
          duration_minutes: number | null
          address: string
          notes: string | null
          price_ht: number | null
          price_ttc: number | null
          commission_rate: number
          payment_status: string
          payment_intent_id: string | null
          created_at: string
          confirmed_at: string | null
          completed_at: string | null
          cancelled_at: string | null
        }
      }
    }
  }
}
