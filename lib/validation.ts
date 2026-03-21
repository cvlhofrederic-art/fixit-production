// ── Zod validation schemas for API routes ────────────────────────────────────
// Centralized input validation — replaces manual regex checks
import { z } from 'zod'

// ── Email strict : exige un TLD valide (rejette test@localhost, user@192.168.1.1) ──
// Zod .email() accepte des formats comme test@localhost → on ajoute un .refine()
export const strictEmail = z.string().email().refine(
  (val) => /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(val),
  { message: 'Email invalide : un domaine avec TLD est requis (ex: nom@domaine.fr)' }
)

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
  locale: z.string().max(5).optional(),
})

// ── SIRET schema ─────────────────────────────────────────────────────────────
export const siretSchema = z.string().regex(/^\d{14}$/, 'Le SIRET doit contenir 14 chiffres')

// ── NIF (Portugal) schema ───────────────────────────────────────────────────
export const verifyNifSchema = z.string().regex(/^\d{9}$/, 'O NIF deve conter exatamente 9 dígitos')

/**
 * Validates a Portuguese NIF (Número de Identificação Fiscal) using the mod 11 check digit algorithm.
 * - Multiply each of the first 8 digits by weights [9,8,7,6,5,4,3,2]
 * - Sum the products
 * - Remainder = 11 - (sum % 11)
 * - If remainder >= 10, check digit = 0
 * - Check digit must match the 9th digit
 */
export function isValidNif(nif: string): boolean {
  if (!/^\d{9}$/.test(nif)) return false

  const weights = [9, 8, 7, 6, 5, 4, 3, 2]
  let sum = 0
  for (let i = 0; i < 8; i++) {
    sum += parseInt(nif[i]) * weights[i]
  }

  let remainder = 11 - (sum % 11)
  if (remainder >= 10) remainder = 0

  return remainder === parseInt(nif[8])
}

// ── Signalement schema ───────────────────────────────────────────────────────
export const signalementSchema = z.object({
  type: z.string().min(1).max(100),
  description: z.string().min(10).max(5000),
  immeuble_id: z.string().uuid().optional(),
  demandeur_email: z.string().email().optional(),
  demandeur_nom: z.string().max(200).optional(),
  photos: z.array(z.string().url()).max(5).optional(),
})

// ── Pro Messagerie schema ────────────────────────────────────────────────────
export const proMessagerieSchema = z.object({
  artisan_user_id: z.string().uuid('artisan_user_id doit \u00eatre un UUID valide'),
  contact_id: z.string().uuid('contact_id doit \u00eatre un UUID valide'),
  contact_type: z.enum(['particulier', 'pro']).optional().default('particulier'),
  contact_name: z.string().max(200).optional(),
  content: z.string().max(5000).optional(),
  type: z.enum(['text', 'ordre_mission', 'system', 'photo', 'voice']).optional().default('text'),
  sender_id: z.string().uuid().optional(),
  ordre_mission: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

// ── Syndic Artisan creation schema ───────────────────────────────────────────
export const syndicArtisanSchema = z.object({
  email: strictEmail,
  nom: z.string().min(1, 'Nom requis').max(200),
  prenom: z.string().max(200).optional(),
  telephone: z.string().max(20).optional(),
  metier: z.string().max(100).optional(),
  siret: z.string().max(20).optional(),
  action: z.enum(['create', 'link']).optional(),
})

// ── Syndic Signalement message schema ────────────────────────────────────────
export const syndicSignalementMessageSchema = z.object({
  signalementId: z.string().uuid('signalementId doit \u00eatre un UUID valide'),
  auteur: z.string().max(200).optional(),
  role: z.enum(['gestionnaire', 'technicien', 'coproprio', 'syndic']).optional(),
  texte: z.string().min(1, 'Texte requis').max(5000),
})

// ── Assign Mission schema ────────────────────────────────────────────────────
// Note : le client envoie artisan_email='' et artisan_user_id=null quand non renseignés
// → on transforme les valeurs vides/null en undefined pour que .optional() fonctionne
export const assignMissionSchema = z.object({
  artisan_email: z.preprocess(v => (v === '' || v === null ? undefined : v), z.string().email().optional()),
  artisan_user_id: z.preprocess(v => (v === '' || v === null ? undefined : v), z.string().uuid().optional()),
  artisan_name: z.preprocess(v => (v === '' || v === null ? undefined : v), z.string().max(200).optional()),
  description: z.string().min(1, 'Description requise').max(5000),
  type_travaux: z.preprocess(v => (v === '' || v === null ? undefined : v), z.string().max(200).optional()),
  date_intervention: z.preprocess(v => (v === '' || v === null ? undefined : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD').optional()),
  immeuble: z.preprocess(v => (v === '' || v === null ? undefined : v), z.string().max(500).optional()),
  priorite: z.preprocess(v => (v === '' || v === null ? undefined : v), z.enum(['basse', 'normale', 'haute', 'urgente']).optional().default('normale')),
  notes: z.preprocess(v => (v === '' || v === null ? undefined : v), z.string().max(2000).optional()),
})

// ── Syndic Canal Interne schema ──────────────────────────────────────────────
export const canalInterneSchema = z.object({
  texte: z.string().min(1, 'Texte requis').max(5000),
  auteur: z.string().max(200).optional(),
  auteurRole: z.string().max(100).optional(),
  sujet: z.string().max(200).optional(),
})

// ── Syndic Messages schema ───────────────────────────────────────────────────
export const syndicMessageSchema = z.object({
  content: z.string().min(1, 'Message requis').max(5000),
  artisan_user_id: z.string().uuid().optional(),
  cabinet_id: z.string().uuid().optional(),
  mission_id: z.string().uuid().optional().nullable(),
  type: z.enum(['text', 'rapport', 'proof_of_work', 'devis']).optional().default('text'),
})

// ── Syndic Planning Events schema ────────────────────────────────────────────
export const planningEventSchema = z.object({
  titre: z.string().min(1, 'Titre requis').max(200),
  type: z.string().max(50).optional().default('autre'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  heure: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM').optional().default('09:00'),
  dureeMin: z.number().int().min(5).max(1440).optional().default(60),
  assigneA: z.string().max(200).optional(),
  assigneRole: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  creePar: z.string().max(200).optional(),
  statut: z.string().max(50).optional().default('planifie'),
})

// ── Booking Messages schema ──────────────────────────────────────────────────
export const bookingMessageSchema = z.object({
  booking_id: z.string().uuid('booking_id doit \u00eatre un UUID valide'),
  content: z.string().max(2000).optional(),
  type: z.enum(['text', 'photo', 'voice', 'devis_sent', 'devis_signed']).optional(),
  attachment_url: z.string().url().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

// ── Coproprietaire Signalement schema ────────────────────────────────────────
export const coproSignalementSchema = z.object({
  description: z.string().min(10, 'Description requise (minimum 10 caract\u00e8res)').max(5000),
  demandeurNom: z.string().min(2, 'Nom du demandeur requis').max(200).optional(),
  nom: z.string().min(2).max(200).optional(),
  immeuble: z.string().max(500).optional(),
  immeubleNom: z.string().max(500).optional(),
  cabinetId: z.string().uuid().optional().nullable(),
  demandeurRole: z.enum(['coproprio', 'locataire', 'technicien']).optional(),
  role: z.enum(['coproprio', 'locataire', 'technicien']).optional(),
  demandeurEmail: strictEmail.optional(),
  email: strictEmail.optional(),
  demandeurTelephone: z.string().max(20).optional(),
  telephone: z.string().max(20).optional(),
  typeIntervention: z.string().max(100).optional(),
  type: z.string().max(100).optional(),
  priorite: z.enum(['urgente', 'normale', 'planifiee']).optional(),
  batiment: z.string().max(100).optional(),
  etage: z.string().max(20).optional(),
  numLot: z.string().max(20).optional(),
  estPartieCommune: z.boolean().optional(),
  zoneSignalee: z.string().max(200).optional(),
})

// ── Devis Sign schema ────────────────────────────────────────────────────────
export const devisSignSchema = z.object({
  booking_id: z.string().uuid('booking_id doit \u00eatre un UUID valide'),
  message_id: z.string().uuid('message_id doit \u00eatre un UUID valide'),
  signer_name: z.string().min(1, 'Nom du signataire requis').max(200),
  signature_svg: z.string().min(10, 'Signature requise').max(50000).optional(),
  signature_hash: z.string().max(128).optional(),
})

// ── Artisan Settings (POST) schema ───────────────────────────────────────────
export const artisanSettingsPostSchema = z.object({
  company_name: z.string().max(200).optional(),
  bio: z.string().max(5000).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  auto_reply_message: z.string().max(1000).optional(),
  auto_block_duration_minutes: z.number().int().min(0).max(480).optional(),
  zone_radius_km: z.number().min(0).max(500).optional(),
})

// ── Syndic Mission creation schema ───────────────────────────────────────────
export const syndicMissionSchema = z.object({
  signalementId: z.string().uuid().optional().nullable(),
  immeuble: z.string().max(500).optional().default(''),
  artisan: z.string().max(200).optional().default(''),
  type: z.string().max(100).optional().default(''),
  description: z.string().max(5000).optional().default(''),
  priorite: z.enum(['basse', 'normale', 'haute', 'urgente']).optional().default('normale'),
  statut: z.enum(['en_attente', 'en_cours', 'terminee', 'annulee']).optional().default('en_attente'),
  dateCreation: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateIntervention: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  montantDevis: z.number().min(0).max(1_000_000).optional().nullable(),
  batiment: z.string().max(100).optional().nullable(),
  etage: z.string().max(20).optional().nullable(),
  numLot: z.string().max(20).optional().nullable(),
  locataire: z.string().max(200).optional().nullable(),
  telephoneLocataire: z.string().max(20).optional().nullable(),
  accesLogement: z.string().max(500).optional().nullable(),
  demandeurNom: z.string().max(200).optional().nullable(),
  demandeurRole: z.string().max(100).optional().nullable(),
  demandeurEmail: strictEmail.optional().nullable(),
  estPartieCommune: z.boolean().optional().default(false),
  zoneSignalee: z.string().max(200).optional().nullable(),
  canalMessages: z.array(z.unknown()).optional().default([]),
  demandeurMessages: z.array(z.unknown()).optional().default([]),
})

// ── Syndic Immeuble schema ─────────────────────────────────────────────────
export const syndicImmeubleSchema = z.object({
  nom: z.string().min(1, 'Nom requis').max(200),
  adresse: z.string().min(1, 'Adresse requise').max(500),
  ville: z.string().min(1, 'Ville requise').max(200),
  code_postal: z.string().regex(/^\d{4,5}(-\d{3})?$/, 'Code postal invalide'),
  nb_lots: z.number().int().min(1).max(9999).optional(),
  annee_construction: z.number().int().min(1800).max(2100).optional().nullable(),
  type_immeuble: z.string().max(100).optional().nullable(),
  gestionnaire: z.string().max(200).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
})

// ── Syndic Team Invite schema ─────────────────────────────────────────────
export const syndicTeamInviteSchema = z.object({
  email: strictEmail,
  full_name: z.string().min(1, 'Nom requis').max(200),
  role: z.enum(['admin', 'gestionnaire', 'comptable', 'assistant']),
})

// ── Artisan Absence schema ─────────────────────────────────────────────────
export const artisanAbsenceSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  reason: z.string().max(500).optional(),
  label: z.string().max(200).optional(),
})

// ── Comptable AI schema ────────────────────────────────────────────────────
export const comptableAiRequestSchema = z.object({
  message: z.string().min(1, 'Message requis').max(5000),
  artisan_id: z.string().uuid('artisan_id doit être un UUID valide'),
  context: z.record(z.string(), z.unknown()).optional(),
})

// ── Reset Password schema ──────────────────────────────────────────────────
export const resetPasswordSchema = z.object({
  email: strictEmail,
})

// ── Bourse aux Marchés schemas ─────────────────────────────────────────────
const MARCHES_CATEGORIES = [
  'canalizacao', 'eletricidade', 'pintura', 'serralharia', 'elevadores',
  'limpeza', 'jardinagem', 'impermeabilizacao', 'construcao', 'climatizacao',
  'seguranca', 'gas', 'telhados', 'desentupimentos', 'carpintaria',
  'vidracaria', 'mudancas', 'renovacao', 'isolamento', 'outro',
] as const

export const MARCHES_WORK_MODES = ['forfait', 'journee', 'horaire', 'tache'] as const

export const createMarcheSchema = z.object({
  publisher_name: z.string().min(2, 'Nom requis').max(200),
  publisher_email: strictEmail,
  publisher_phone: z.string().max(20).optional(),
  publisher_type: z.enum([
    // Particuliers
    'particulier_proprietaire', 'particulier_locataire', 'particulier_investisseur',
    // Pro Immobilier
    'syndic', 'gestionnaire_immobilier', 'conciergerie', 'agence_immobiliere', 'promoteur_immobilier',
    // BTP/Construction
    'entreprise_btp', 'maitre_oeuvre', 'bureau_etudes',
    // Commerce/Tertiaire
    'commerce_restaurant', 'bureau_entreprise', 'collectivite', 'hotel',
    // Assurance
    'assurance', 'expert_assure',
  ]).default('particulier_proprietaire'),
  title: z.string().min(5, 'Titre trop court (min 5)').max(200),
  description: z.string().min(20, 'Description trop courte (min 20)').max(5000),
  category: z.enum(MARCHES_CATEGORIES),
  location_city: z.string().min(1, 'Ville requise').max(100),
  location_postal: z.string().max(10).optional(),
  location_address: z.string().max(500).optional(),
  budget_min: z.number().min(0).max(1_000_000).optional(),
  budget_max: z.number().min(0).max(1_000_000).optional(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  urgency: z.enum(['normal', 'urgent', 'emergency']).default('normal'),
  photos: z.array(z.string().url()).max(10).optional(),
  // V2 — Exigences & matching
  max_candidatures: z.number().int().min(1).max(10).default(3),
  require_rc_pro: z.boolean().default(false),
  require_decennale: z.boolean().default(false),
  require_rge: z.boolean().default(false),
  require_qualibat: z.boolean().default(false),
  preferred_work_mode: z.enum(MARCHES_WORK_MODES).optional(),
  // Dynamic fields based on publisher_type
  publisher_company: z.string().max(200).optional(),
  publisher_siret: z.string().max(20).optional(),
  // Syndic-specific
  immeuble_nom: z.string().max(200).optional(),
  immeuble_adresse: z.string().max(500).optional(),
  partie_commune: z.boolean().optional(),
  nb_lots: z.number().int().min(1).max(9999).optional(),
  // Conciergerie-specific
  type_hebergement: z.string().max(100).optional(),
  nb_unites: z.number().int().min(1).max(999).optional(),
  contrainte_calendrier: z.string().max(500).optional(),
  // BTP-specific
  lot_technique: z.string().max(200).optional(),
  reference_chantier: z.string().max(200).optional(),
  // Promoteur-specific
  programme_immobilier: z.string().max(200).optional(),
  phase_chantier: z.string().max(100).optional(),
  nb_logements: z.number().int().min(1).max(9999).optional(),
  // Commerce-specific
  type_etablissement: z.string().max(100).optional(),
  mise_aux_normes: z.boolean().optional(),
  // Assurance-specific
  numero_sinistre: z.string().max(100).optional(),
  type_sinistre: z.string().max(100).optional(),
  expert_referent: z.string().max(200).optional(),
})

export const artisanMarchesPrefsSchema = z.object({
  marches_opt_in: z.boolean(),
  marches_categories: z.array(z.string()).max(20).default([]),
  marches_work_mode: z.enum(MARCHES_WORK_MODES).default('forfait'),
  marches_tarif_journalier: z.number().min(0).max(10_000).optional().nullable(),
  marches_tarif_horaire: z.number().min(0).max(1_000).optional().nullable(),
  marches_description: z.string().max(2000).optional(),
})

export const createCandidatureSchema = z.object({
  price: z.number().min(1, 'Prix minimum 1€').max(1_000_000),
  timeline: z.string().min(1).max(200),
  description: z.string().min(10, 'Description trop courte (min 10)').max(3000),
  materials_included: z.boolean().default(false),
  guarantee: z.string().max(500).optional(),
})

export const updateCandidatureStatusSchema = z.object({
  status: z.enum(['accepted', 'rejected']),
})

export { MARCHES_CATEGORIES }

// ── Helper: validate and return typed result ─────────────────────────────────
export function validateBody<T>(schema: z.ZodSchema<T>, data: unknown):
  { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data)
  if (result.success) return { success: true, data: result.data }
  const messages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
  return { success: false, error: messages }
}
