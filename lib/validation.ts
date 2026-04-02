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

export const availabilityToggleSchema = z.object({
  artisan_id: z.string().uuid(),
  day_of_week: z.number().int().min(0).max(6),
})

export const availabilityUpdateSchema = z.object({
  availability_id: z.string().uuid(),
  field: z.enum(['start_time', 'end_time']),
  value: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM'),
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
// Frontend sends camelCase, DB expects snake_case — validation uses frontend names
export const syndicImmeubleSchema = z.object({
  nom: z.string().max(200).optional(),
  adresse: z.string().max(500).optional(),
  ville: z.string().max(200).optional(),
  codePostal: z.string().max(10).optional(),
  nbLots: z.number().int().min(1).max(9999).optional(),
  anneeConstruction: z.number().int().min(1800).max(2100).optional().nullable(),
  typeImmeuble: z.string().max(100).optional().nullable(),
  gestionnaire: z.string().max(200).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  prochainControle: z.string().max(20).optional().nullable(),
  nbInterventions: z.number().int().min(0).optional(),
  budgetAnnuel: z.number().min(0).optional(),
  depensesAnnee: z.number().min(0).optional(),
  geolocActivee: z.boolean().optional(),
  rayonDetection: z.number().min(0).max(5000).optional(),
  reglementTexte: z.string().max(50000).optional(),
  reglementPdfNom: z.string().max(255).optional(),
  reglementDateMaj: z.string().max(20).optional(),
  reglementChargesRepartition: z.string().max(5000).optional(),
  reglementMajoriteAg: z.string().max(5000).optional(),
  reglementFondsTravaux: z.boolean().optional(),
  reglementFondsRoulementPct: z.number().min(0).max(100).optional(),
})

// ── Syndic Team Invite schema ─────────────────────────────────────────────
export const syndicTeamInviteSchema = z.object({
  email: strictEmail,
  full_name: z.string().min(1, 'Nom requis').max(200),
  memberRole: z.string().min(1).max(50),
  customModules: z.array(z.string().max(100)).max(50).optional(),
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
  message: z.string().min(1, 'Message requis').max(5000).optional(),
  artisan_id: z.string().uuid('artisan_id doit être un UUID valide').optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  financialContext: z.record(z.string(), z.unknown()).optional(),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().max(10000),
  })).max(30).optional(),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().max(10000),
  })).max(30).optional(),
  systemPrompt: z.string().max(20000).optional(),
  locale: z.string().max(5).optional(),
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

// ── Wallet Scan schema ───────────────────────────────────────────────────────
export const walletScanSchema = z.object({
  fileBase64: z.string().min(10).max(10_000_000), // Max ~7.5 MB
  fileName: z.string().max(255),
  docKey: z.string().max(50),
  artisanId: z.string().uuid(),
})

// ── Save Logo schema ─────────────────────────────────────────────────────────
export const saveLogoSchema = z.object({
  base64: z.string().min(10).max(700_000), // Max ~500KB file
  field: z.enum(['logo_url', 'profile_photo_url']).default('logo_url'),
})

// ── Login Attempt schema ─────────────────────────────────────────────────────
export const loginAttemptSchema = z.object({
  email: z.string().email().max(254),
  success: z.boolean(),
  role: z.string().max(20).optional(),
  reason: z.string().max(200).optional(),
})

// ── Financial routes schemas ─────────────────────────────────────────────────

export const stripeCheckoutSchema = z.object({
  planId: z.enum(['artisan_starter', 'artisan_pro', 'syndic_essential', 'syndic_premium']),
})

export const docNumberSchema = z.object({
  docType: z.enum(['devis', 'facture', 'avoir']),
  year: z.number().int().min(2024).max(2100).optional(),
})

export const walletSyncSchema = z.object({
  docKey: z.string().min(1).max(50),
  hasDocument: z.boolean().optional(),
  expiryDate: z.string().max(20).optional().nullable(),
})

// ── Artisan Payment Info schema ──────────────────────────────────────────────
export const artisanPaymentInfoSchema = z.object({
  paiement_modes: z.array(z.record(z.string(), z.unknown())).max(10),
  paiement_mention_devis: z.boolean().optional().default(true),
  paiement_mention_facture: z.boolean().optional().default(true),
})

// ── Artisan Absence schema (POST) ──────────────────────────────────────────
export const artisanAbsencePostSchema = z.object({
  artisan_id: z.string().uuid(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  reason: z.string().max(500).optional(),
  label: z.string().max(200).optional(),
})

// ── Referral Click schema ──────────────────────────────────────────────────
export const referralClickSchema = z.object({
  code: z.string().min(4).max(12),
  source: z.string().max(50).optional(),
})

// ── Referral Signup schema ─────────────────────────────────────────────────
export const referralSignupSchema = z.object({
  code: z.string().min(4).max(12),
  artisan_id: z.string().uuid(),
  user_id: z.string().uuid(),
})

// ── Declaration Sociale schema ─────────────────────────────────────────────
export const declarationSocialeSchema = z.object({
  action: z.enum(['configurer', 'marquer_declaree']),
  // Configurer fields
  type_activite: z.string().max(100).optional(),
  periodicite: z.string().max(50).optional(),
  acre_actif: z.boolean().optional(),
  acre_date_fin: z.string().max(20).optional().nullable(),
  // Marquer déclarée fields
  periode_label: z.string().max(50).optional(),
  date_debut: z.string().max(20).optional(),
  date_fin: z.string().max(20).optional(),
  ca_periode: z.number().min(0).max(10_000_000).optional(),
  taux_applique: z.number().min(0).max(1).optional(),
  cotisations_estimees: z.number().min(0).max(10_000_000).optional(),
  date_limite: z.string().max(20).optional(),
})

// ── Service Etapes schema ──────────────────────────────────────────────────
export const serviceEtapesPostSchema = z.object({
  service_id: z.string().uuid(),
  action: z.string().max(50).optional(),
  designation: z.string().max(500).optional(),
  ordre: z.union([
    z.number().int(),
    z.array(z.object({ id: z.string().uuid(), ordre: z.number().int() })),
  ]).optional(),
})

export const serviceEtapesPatchSchema = z.object({
  id: z.string().uuid(),
  service_id: z.string().uuid(),
  designation: z.string().max(500).optional(),
  ordre: z.number().int().optional(),
})

// ── Rapport IA schema ──────────────────────────────────────────────────────
export const rapportIaSchema = z.object({
  booking_id: z.string().uuid(),
})

// ── Pro Channel schema ─────────────────────────────────────────────────────
export const proChannelSchema = z.object({
  artisan_id: z.string().uuid(),
  target_artisan_id: z.string().uuid().optional(),
  content: z.string().max(5000).optional(),
  type: z.string().max(50).optional(),
})

// ── Simulateur Travaux schema ──────────────────────────────────────────────
export const simulateurTravauxSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().max(10000),
  })).min(1).max(30),
})

// ── Copro AI schema ────────────────────────────────────────────────────────
export const coproAiSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().max(10000),
  })).min(1).max(30),
  systemPrompt: z.string().max(20000).optional(),
  stream: z.boolean().optional(),
})

// ── Fixy Chat schema ───────────────────────────────────────────────────────
export const fixyChatSchema = z.object({
  message: z.string().min(1).max(5000),
  role: z.string().max(50).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  conversation_history: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().max(10000),
  })).max(30).optional(),
  locale: z.string().max(5).optional(),
  stream: z.boolean().optional(),
})

// ── Tracking Update schema ─────────────────────────────────────────────────
export const trackingUpdateSchema = z.object({
  token: z.string().min(1).max(100),
  status: z.string().max(50),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
})

// ── Email Agent Action schema ──────────────────────────────────────────────
export const emailAgentActionSchema = z.object({
  action: z.string().min(1).max(50),
  email_id: z.string().max(200).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
})

// ── Artisan Photos schema ──────────────────────────────────────────────────
export const artisanPhotosSchema = z.object({
  artisan_id: z.string().uuid(),
  photo_url: z.string().max(2_000_000).optional(),
  photo_base64: z.string().max(2_000_000).optional(),
  description: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
})

// ── Syndic Send Email schema ────────────────────────────────────────────────
export const syndicSendEmailSchema = z.object({
  template: z.enum(['unpaid_reminder', 'ag_invitation', 'intervention', 'team_invite', 'generic']),
  recipients: z.union([
    z.object({ email: z.string().email(), name: z.string().max(200) }),
    z.array(z.object({ email: z.string().email(), name: z.string().max(200) })).max(100),
  ]),
  params: z.record(z.string(), z.unknown()).optional(),
  locale: z.string().max(5).optional(),
})

// ── Syndic Notify Artisan schema ───────────────────────────────────────────
export const syndicNotifyArtisanSchema = z.object({
  artisan_id: z.string().uuid(),
  syndic_id: z.string().uuid().optional(),
  type: z.string().max(50).optional().default('new_mission'),
  title: z.string().min(1).max(200),
  body: z.string().max(5000).optional(),
  data_json: z.record(z.string(), z.unknown()).optional(),
})

// ── Syndic Coproprios schema ───────────────────────────────────────────────
export const syndicCoproprioPOSTSchema = z.object({
  nom: z.string().min(1).max(200),
  prenom: z.string().max(200).optional(),
  email: z.string().email().optional(),
  telephone: z.string().max(20).optional(),
  immeuble_id: z.string().uuid().optional(),
  fraction: z.string().max(20).optional(),
  batiment: z.string().max(100).optional(),
  etage: z.string().max(20).optional(),
  est_proprietaire: z.boolean().optional(),
  tantiemes: z.number().int().min(0).optional(),
})

// ── Syndic Assemblees schema ───────────────────────────────────────────────
export const syndicAssembleeSchema = z.object({
  titre: z.string().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  heure: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM').optional(),
  lieu: z.string().max(500).optional(),
  type: z.string().max(50).optional(),
  immeuble_id: z.string().uuid().optional(),
  description: z.string().max(5000).optional(),
  ordre_du_jour: z.array(z.record(z.string(), z.unknown())).max(50).optional(),
})

// ── Syndic Max AI schema ───────────────────────────────────────────────────
export const syndicMaxAiSchema = z.object({
  message: z.string().min(1).max(5000),
  syndic_context: z.record(z.string(), z.unknown()).optional(),
  conversation_history: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().max(10000),
  })).max(50).optional(),
  stream: z.boolean().optional(),
  locale: z.string().max(5).optional(),
})

// ── Syndic Mission Report schema ───────────────────────────────────────────
export const syndicMissionReportSchema = z.object({
  syndic_id: z.string().uuid(),
  artisan_id: z.string().uuid(),
  artisan_nom: z.string().max(200).optional(),
  mission_id: z.string().uuid().optional().nullable(),
  immeuble: z.string().max(500).optional(),
  type_travaux: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  photos_before: z.array(z.string()).max(10).optional(),
  photos_after: z.array(z.string()).max(10).optional(),
  signature_svg: z.string().max(50000).optional(),
  gps_lat: z.number().min(-90).max(90).optional().nullable(),
  gps_lng: z.number().min(-180).max(180).optional().nullable(),
  started_at: z.string().max(50).optional(),
  completed_at: z.string().max(50).optional(),
  booking_id: z.string().uuid().optional().nullable(),
})

// ── Syndic Invite schema ───────────────────────────────────────────────────
export const syndicInviteSchema = z.object({
  token: z.string().min(1).max(200),
  password: z.string().min(8).max(200),
})

// ── Syndic Import Gecond schema ────────────────────────────────────────────
export const syndicImportGecondSchema = z.object({
  action: z.enum(['parse', 'import']),
  csvContent: z.string().max(5_500_000).optional(),
  immeubleName: z.string().max(500).optional(),
  createImmeuble: z.boolean().optional(),
})

// ── Pro Channel schema ─────────────────────────────────────────────────────
export const proChannelPostSchema = z.object({
  content: z.string().max(5000).optional(),
  contact_id: z.string().uuid().optional(),
  type: z.string().max(50).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

// ── Tracking Update schema ─────────────────────────────────────────────────
export const trackingUpdatePostSchema = z.object({
  token: z.string().min(1).max(200),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  status: z.string().max(50).optional(),
  artisanNom: z.string().max(200).optional(),
  artisanInitiales: z.string().max(10).optional(),
  missionTitre: z.string().max(500).optional(),
  missionAdresse: z.string().max(500).optional(),
  photos: z.array(z.string()).max(20).optional(),
  startedAt: z.string().max(50).optional(),
})

// ── Email Agent Action schema ──────────────────────────────────────────────
export const emailAgentActionPostSchema = z.object({
  action: z.string().min(1).max(50),
  email_id: z.string().max(200),
  syndic_id: z.string().uuid(),
  note: z.string().max(5000).optional(),
})

// ── Artisan Photos POST schema ─────────────────────────────────────────────
export const artisanPhotosPostSchema = z.object({
  artisan_id: z.string().uuid(),
  photo_base64: z.string().min(10).max(2_000_000).optional(),
  description: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
})

// ── Portugal Fiscal schemas ────────────────────────────────────────────────
export const ptFiscalSeriesSchema = z.object({
  seriesPrefix: z.string().max(20).optional(),
  docType: z.string().min(1).max(10),
  validationCode: z.string().min(1).max(100),
  fiscalYear: z.number().int().min(2024).max(2100),
  fiscalSpace: z.string().max(10).optional(),
})

export const ptFiscalRegisterDocSchema = z.object({
  docType: z.string().min(1).max(50),
  issuerNIF: z.string().min(1).max(20),
  issuerName: z.string().max(200).optional(),
  issuerAddress: z.string().max(500).optional(),
  issuerCity: z.string().max(200).optional(),
  issuerPostalCode: z.string().max(20).optional(),
  clientNIF: z.string().max(20).optional(),
  clientName: z.string().max(200).optional(),
  clientAddress: z.string().max(500).optional(),
  clientCity: z.string().max(200).optional(),
  clientPostalCode: z.string().max(20).optional(),
  clientCountry: z.string().max(5).optional(),
  fiscalSpace: z.string().max(10).optional(),
  lines: z.array(z.record(z.string(), z.unknown())).min(1).max(100),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  isSimplified: z.boolean().optional(),
})

// ── String sanitizer (XSS prevention) ────────────────────────────────────────
// Strips all HTML tags to prevent XSS (no jsdom/DOMPurify — server-safe)
export function sanitizeHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').trim()
}

// ── Helper: validate and return typed result ─────────────────────────────────
export function validateBody<T>(schema: z.ZodSchema<T>, data: unknown):
  { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data)
  if (result.success) return { success: true, data: result.data }
  const messages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
  return { success: false, error: messages }
}

// ── Admin API schemas ─────────────────────────────────────────────────────────

// GET /api/admin/users — query params
export const adminUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  role: z.string().max(50).default(''),
  search: z.string().max(200).default(''),
})

// GET /api/admin/subscriptions — query params
export const adminSubscriptionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  plan: z.string().max(50).default(''),
  status: z.string().max(50).default(''),
})

// GET /api/admin/kyc — query params
export const adminKycQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().max(50).default('pending'),
})

// PATCH /api/admin/kyc — approve or reject
export const adminKycPatchSchema = z.object({
  artisan_id: z.string().uuid('artisan_id must be a valid UUID'),
  action: z.enum(['approve', 'reject']),
  rejection_reason: z.string().max(2000).optional(),
}).refine(
  (data) => data.action !== 'reject' || (data.rejection_reason && data.rejection_reason.length > 0),
  { message: 'rejection_reason is required when action is reject', path: ['rejection_reason'] }
)

// GET /api/admin/setup — query params
export const adminSetupQuerySchema = z.object({
  step: z.enum(['tables', 'admin', 'insurance', 'all']).default('all'),
})

// POST /api/admin/init-team-table — body
export const adminInitTeamTableSchema = z.object({
  cabinet_id: z.string().uuid('cabinet_id must be a valid UUID'),
  user_id: z.string().uuid('user_id must be a valid UUID').optional().nullable(),
  email: strictEmail,
  full_name: z.string().max(200).default(''),
  role: z.string().max(50).default('syndic_tech'),
})

// ── BTP Sous-traitance — création d'offre ────────────────────────────────────
export const createSousTraitanceOffreSchema = z.object({
  // Infos publieur (entreprise BTP)
  btp_company_id: z.string().min(1).max(200),
  btp_company_name: z.string().min(2).max(200),
  publisher_user_id: z.string().uuid(),
  publisher_name: z.string().min(2).max(200),
  publisher_email: strictEmail,
  publisher_phone: z.string().max(20).optional(),

  // Détails de la mission
  title: z.string().min(5).max(200),
  description: z.string().min(20).max(5000),
  category: z.string().min(1).max(100),
  mission_type: z.enum(['sous_traitance_complete', 'renfort_equipe']),

  // Localisation
  location_city: z.string().min(2).max(200),
  location_postal: z.string().max(10).optional(),
  location_address: z.string().max(500).optional(),

  // Dates
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD').optional(),
  duration_text: z.string().max(200).optional(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),

  // Budget
  budget_min: z.number().min(0).max(10_000_000).optional().nullable(),
  budget_max: z.number().min(0).max(10_000_000).optional().nullable(),

  // Exigences
  nb_intervenants_souhaite: z.number().int().min(1).max(100).optional(),
  require_rc_pro: z.boolean().default(false),
  require_decennale: z.boolean().default(false),
  require_qualibat: z.boolean().default(false),

  // Urgence & photos
  urgency: z.enum(['normal', 'urgent', 'emergency']).default('normal'),
  photos: z.array(z.string().url()).max(10).default([]),
})

// ── BTP Sous-traitance — candidature artisan ─────────────────────────────────
export const createSousTraitanceCandidatureSchema = z.object({
  marche_id: z.string().uuid(),
  artisan_id: z.string().uuid(),
  artisan_user_id: z.string().uuid(),
  artisan_company_name: z.string().max(200).optional(),
  artisan_rating: z.number().min(0).max(5).optional(),
  artisan_phone: z.string().max(20).optional(),
  price: z.number().min(0).max(10_000_000),
  timeline: z.string().min(1).max(100),
  description: z.string().min(10).max(3000),
  disponibilites: z.string().max(500).optional(),
  experience_years: z.number().int().min(0).max(50).optional(),
  materials_included: z.boolean().default(false),
  guarantee: z.string().max(500).optional(),
})

// ── Verification routes schemas ──────────────────────────────────────────────

export const verifySiretQuerySchema = z.object({
  siret: z.string().min(1, 'SIRET requis').max(20),
})

export const verifyNifQuerySchema = z.object({
  nif: z.string().min(1, 'NIF obrigatório').max(15),
})

export const verifyIdFormSchema = z.object({
  nom: z.string().min(1, 'Nom requis').max(200),
  prenom: z.string().min(1, 'Prénom requis').max(200),
})

export const verifyKbisFormSchema = z.object({
  market: z.enum(['fr_artisan', 'fr_btp', 'pt_artisan'], {
    error: 'Paramètre market invalide. Valeurs acceptées : fr_artisan, fr_btp, pt_artisan',
  }),
})

// ── Email Agent Classify schema ──────────────────────────────────────────────
export const emailAgentClassifySchema = z.object({
  from: z.string().max(500).optional(),
  subject: z.string().max(1000).optional(),
  body: z.string().max(50000).optional(),
})

// ── Email Agent Callback schema (OAuth GET query params) ─────────────────────
export const emailAgentCallbackSchema = z.object({
  code: z.string().max(2000).optional(),
  state: z.string().max(500).optional(),
  error: z.string().max(200).optional(),
})

// ── Email Agent Connect schema (GET query params) ────────────────────────────
export const emailAgentConnectSchema = z.object({
  token: z.string().max(5000).optional(),
})

// ── Email Agent OCR schema ───────────────────────────────────────────────────
export const emailAgentOcrSchema = z.object({
  image_base64: z.string().min(1, 'image_base64 requis').max(14_000_000),
  mime_type: z.string().max(100).optional().default('image/jpeg'),
})

// ── Email Agent Poll GET schema (query params) ──────────────────────────────
export const emailAgentPollGetSchema = z.object({
  syndic_id: z.string().uuid('syndic_id doit être un UUID valide').optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  urgence: z.enum(['haute', 'moyenne', 'basse']).optional(),
  statut: z.string().max(50).optional(),
})
