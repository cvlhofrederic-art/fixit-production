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
  legal_form?: string | null
  /**
   * Salarié invité d'une société BTP seulement : identifiant de la fiche `profiles_artisan` de SA société.
   *
   * Son compte n'a pas de fiche à lui. Le tableau de bord lui donne l'identité de la société — raison sociale,
   * SIRET ou NIPC, adresse, logo, assurance, langue — tout en laissant `id` sur SON compte, pour que les clés du
   * navigateur (`fixit_documents_<id>`, `fixit_drafts_<id>`) restent les siennes et n'écrasent jamais celles du
   * gérant sur un poste partagé. Ce champ porte donc l'identifiant de la fiche là où il faut vraiment celui de la
   * société : gabarit du document, relecture de la fiche au téléchargement, propriétaire enregistré en base.
   * Lire par `idFicheDocuments` (lib/documents/identite-documents.ts), jamais directement.
   */
  fiche_societe_id?: string
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

export type AvailabilitySlotType = 'rdv' | 'visite'

export interface Availability {
  id: string
  artisan_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_available: boolean
  slot_type?: AvailabilitySlotType  // default 'rdv' côté serveur (back-compat)
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
  /**
   * @deprecated Champ des documents enregistrés par d'anciens écrans. La mise en forme du tableau de bord et
   * `fetchDocumentsFromSupabase` ne posent que `docType` : un filtre écrit sur `type` ne retient donc RIEN des
   * documents d'aujourd'hui. Il était obligatoire jusqu'au 26/11/2026, ce qui laissait `tsc` valider
   * `doc.type === 'facture'` partout — le CA par chantier a vécu huit mois ainsi, et « Devis récents » depuis sa
   * création. Pour tester le type d'un document : `estDuType` (lib/documents/liste-effective.ts), qui lit les deux.
   */
  type?: 'devis' | 'facture' | 'avoir'
  /** Type posé par les formulaires et par la relecture depuis la base. Un avoir porte « facture » + `factureSubType`. */
  docType?: string
  docNumber?: string
  clientName?: string
  client_name?: string
  client?: string
  ref?: string
  number?: string
  service?: string
  title?: string
  description?: string
  lines?: Array<{ description?: string; totalHT?: number; total?: number; [key: string]: unknown }>
  totalTTC?: number
  totalHT?: number
  total?: number
  amount?: number
  status?: string
  signatureData?: string | null
  /** Date du document, saisie dans le formulaire. C'est elle qui sert à trier et à datter un document. */
  docDate?: string
  /** Horodatage de l'enregistrement local (`DevisFactureForm`, `DevisFactureFormBTP`). */
  savedAt?: string
  /** Horodatage de l'émission (« Marquer envoyée », envoi au client). */
  sentAt?: string
  /**
   * @deprecated Comme `type` : ces deux champs ne sont posés par AUCUNE écriture du dépôt. Un tri ou un affichage
   * écrit sur eux rend toujours la même valeur — c'est ce qui laissait « Devis récents » montrer le plus ancien
   * devis, le comparateur rendant 0 pour toute paire. Utiliser `docDate`, puis `savedAt` ou `sentAt`.
   */
  date?: string
  /** @deprecated Voir `date`. */
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
