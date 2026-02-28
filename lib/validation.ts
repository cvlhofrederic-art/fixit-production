// ── Zod validation schemas for API routes ────────────────────────────────────
// Centralized input validation — replaces manual regex checks
import { z } from 'zod'

// ── Booking schemas ──────────────────────────────────────────────────────────
export const createBookingSchema = z.object({
  artisan_id: z.string().uuid('artisan_id must be a valid UUID'),
  service_id: z.string().uuid().optional(),
  booking_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  booking_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Format: HH:MM'),
  duration_minutes: z.number().int().min(15).max(480).default(60),
  address: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  price_ht: z.number().min(0).max(100000).optional(),
  price_ttc: z.number().min(0).max(100000).optional(),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']).default('pending'),
})

// ── Artisan settings schema ──────────────────────────────────────────────────
export const artisanSettingsSchema = z.object({
  auto_reply_message: z.string().max(1000).optional(),
  auto_block_duration: z.number().int().min(0).max(480).optional(),
  bio: z.string().max(5000).optional(),
  company_name: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  city: z.string().max(100).optional(),
})

// ── Service schema ───────────────────────────────────────────────────────────
export const serviceSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  duration_minutes: z.number().int().min(15).max(480).default(60),
  price_ht: z.number().min(0).max(100000),
  price_ttc: z.number().min(0).max(100000),
  active: z.boolean().default(true),
})

// ── Availability schema ──────────────────────────────────────────────────────
export const availabilitySchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM'),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM'),
  is_available: z.boolean(),
})

// ── Message schema ───────────────────────────────────────────────────────────
export const messageSchema = z.object({
  booking_id: z.string().uuid(),
  content: z.string().min(1).max(5000),
})

// ── Comptable AI schema ──────────────────────────────────────────────────────
export const comptableAiSchema = z.object({
  message: z.string().min(1).max(5000),
  artisan_id: z.string().uuid(),
  context: z.record(z.string(), z.unknown()).optional(),
})

// ── Fixy AI schema ───────────────────────────────────────────────────────────
export const fixyAiSchema = z.object({
  message: z.string().min(1).max(5000),
  artisan_id: z.string().uuid(),
  context: z.record(z.string(), z.unknown()).optional(),
  conversation_history: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
  })).max(20).optional(),
})

// ── SIRET schema ─────────────────────────────────────────────────────────────
export const siretSchema = z.string().regex(/^\d{14}$/, 'Le SIRET doit contenir 14 chiffres')

// ── Signalement schema ───────────────────────────────────────────────────────
export const signalementSchema = z.object({
  type: z.string().min(1).max(100),
  description: z.string().min(10).max(5000),
  immeuble_id: z.string().uuid().optional(),
  demandeur_email: z.string().email().optional(),
  demandeur_nom: z.string().max(200).optional(),
  photos: z.array(z.string().url()).max(5).optional(),
})

// ── Helper: validate and return typed result ─────────────────────────────────
export function validateBody<T>(schema: z.ZodSchema<T>, data: unknown):
  { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data)
  if (result.success) return { success: true, data: result.data }
  const messages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
  return { success: false, error: messages }
}
