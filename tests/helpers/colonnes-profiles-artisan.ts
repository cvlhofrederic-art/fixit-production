// Colonnes de public.profiles_artisan en production (relevé du 31/10/2026 ; aucune migration n'en a ajouté depuis).
// Le schéma de production diffère des migrations du dépôt : c'est cette liste qui dit si une colonne existe. Seule
// liste du dépôt : tests/seo/sitemap-fiches-artisans.test.ts la lit aussi ; au prochain relevé, ne mettre à jour qu'elle.
export const COLONNES_PROFILES_ARTISAN_PRODUCTION: readonly string[] = [
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

// Colonnes qu'aucune page publique ne doit lire ni envoyer au navigateur : pièces justificatives (chemins ou anciens
// liens), données extraites ou chiffrées, informations de paiement, résultats des contrôles, parrainage et crédits,
// réglages fiscaux. id_document_url n'existe pas en production mais figure dans les migrations.
export const COLONNES_PROFILES_ARTISAN_PRIVEES: readonly string[] = [
  'kbis_url', 'id_document_url', 'id_document_verso_url', 'insurance_url',
  'kbis_extracted', 'kbis_extracted_encrypted', 'certidao_extracted', 'nif_encrypted', 'siret_encrypted',
  'pii_encryption_version', 'insurance_scan_data', 'insurance_number',
  'paiement_modes', 'paiement_mention_devis', 'paiement_mention_facture',
  'kyc_checks', 'kyc_market', 'kyc_rejection_reason', 'kyc_reviewed_at', 'kyc_reviewed_by', 'kyc_score', 'kyc_status',
  'kyc_verified_at',
  'referral_code', 'referral_flagged', 'referral_parrain_id', 'credit_mois_gratuits', 'total_parrainages_reussis',
  'tva_auto_activate', 'tva_notified_level', 'type_activite', 'periodicite_declaration', 'declaration_configuree',
  'acre_actif', 'acre_date_fin', 'subscription_tier', 'last_seen_at', 'auto_reply_message',
]
