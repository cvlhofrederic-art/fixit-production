// tests/helpers/colonnes-production.ts — colonnes réelles de tables de la production, partagées par les faux clients
// Supabase des tests. Une colonne hors liste y est traitée comme absente, comme PostgREST la refuse (code 42703) : une
// lecture qui nomme une colonne inexistante échoue dans le test comme elle échoue en production.

/**
 * Les 90 colonnes de public.profiles_artisan en production, relevées le 31/10/2026 (information_schema.columns).
 * Absentes notamment : org_role, country, is_verified, nif, city (la ville est company_city), photo_url (la photo est
 * profile_photo_url), services_offered, first_name.
 */
export const COLONNES_PROFILES_ARTISAN: readonly string[] = [
  'acre_actif', 'acre_date_fin', 'active', 'ape_code', 'auto_accept', 'auto_block_duration_minutes', 'auto_reply_message',
  'bio', 'categories', 'certidao_extracted', 'company_address', 'company_city', 'company_name', 'company_postal_code',
  'created_at', 'credit_mois_gratuits', 'decennale_valid', 'declaration_configuree', 'email', 'hourly_rate', 'id',
  'id_document_verso_url', 'insurance_coverage', 'insurance_expiry', 'insurance_name', 'insurance_number',
  'insurance_scan_data', 'insurance_type', 'insurance_url', 'insurance_verified', 'intervention_zones', 'kbis_extracted',
  'kbis_extracted_encrypted', 'kbis_url', 'kyc_checks', 'kyc_market', 'kyc_rejection_reason', 'kyc_reviewed_at',
  'kyc_reviewed_by', 'kyc_score', 'kyc_status', 'kyc_verified_at', 'language', 'last_seen_at', 'latitude', 'legal_form',
  'logo_url', 'longitude', 'marches_categories', 'marches_description', 'marches_opt_in', 'marches_tarif_horaire',
  'marches_tarif_journalier', 'marches_work_mode', 'mediator_name', 'mediator_url', 'naf_code', 'naf_label',
  'nif_encrypted', 'paiement_mention_devis', 'paiement_mention_facture', 'paiement_modes', 'periodicite_declaration',
  'phone', 'pii_encryption_version', 'profile_photo_url', 'qualibat_valid', 'rating_avg', 'rating_count', 'rc_pro_valid',
  'rcs_number', 'referral_code', 'referral_flagged', 'referral_parrain_id', 'rge_valid', 'share_capital', 'siren', 'siret',
  'siret_encrypted', 'slug', 'subscription_tier', 'total_parrainages_reussis', 'tva_auto_activate', 'tva_intra',
  'tva_notified_level', 'type_activite', 'updated_at', 'user_id', 'verified', 'zone_radius_km',
]
