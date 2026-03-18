// ── Auto-generated-style Database Types ─────────────────────────────────────
// Based on full codebase column analysis.
// TODO: Replace with `supabase gen types typescript --linked` when Supabase CLI is available.
// Run: npx supabase gen types typescript --linked > lib/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles_artisan: {
        Row: {
          id: string
          user_id: string | null
          company_name: string | null
          bio: string | null
          phone: string | null
          email: string | null
          siret: string | null
          siren: string | null
          legal_form: string | null
          naf_code: string | null
          naf_label: string | null
          company_address: string | null
          company_city: string | null
          company_postal_code: string | null
          categories: string[]
          hourly_rate: number | null
          rating_avg: number
          rating_count: number
          verified: boolean
          active: boolean
          auto_accept: boolean
          auto_reply_message: string | null
          auto_block_duration_minutes: number | null
          zone_radius_km: number
          slug: string | null
          profile_photo_url: string | null
          portfolio_photos: Json | null
          country: string | null
          latitude: number | null
          longitude: number | null
          first_name: string | null
          last_name: string | null
          nom: string | null
          prenom: string | null
          metier: string | null
          statut: string | null
          language: string | null
          kyc_status: string | null
          insurance_url: string | null
          kbis_url: string | null
          id_document_url: string | null
          subscription_tier: string
          is_verified: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          company_name?: string | null
          bio?: string | null
          phone?: string | null
          email?: string | null
          siret?: string | null
          siren?: string | null
          legal_form?: string | null
          naf_code?: string | null
          naf_label?: string | null
          company_address?: string | null
          company_city?: string | null
          company_postal_code?: string | null
          categories?: string[]
          hourly_rate?: number | null
          rating_avg?: number
          rating_count?: number
          verified?: boolean
          active?: boolean
          auto_accept?: boolean
          zone_radius_km?: number
          slug?: string | null
          profile_photo_url?: string | null
          portfolio_photos?: Json | null
          country?: string | null
          latitude?: number | null
          longitude?: number | null
          first_name?: string | null
          last_name?: string | null
          nom?: string | null
          prenom?: string | null
          metier?: string | null
          statut?: string | null
          language?: string | null
          kyc_status?: string | null
          subscription_tier?: string
          is_verified?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          bio?: string | null
          phone?: string | null
          email?: string | null
          siret?: string | null
          siren?: string | null
          legal_form?: string | null
          naf_code?: string | null
          naf_label?: string | null
          company_address?: string | null
          company_city?: string | null
          company_postal_code?: string | null
          categories?: string[]
          hourly_rate?: number | null
          rating_avg?: number
          rating_count?: number
          verified?: boolean
          active?: boolean
          auto_accept?: boolean
          auto_reply_message?: string | null
          auto_block_duration_minutes?: number | null
          zone_radius_km?: number
          slug?: string | null
          profile_photo_url?: string | null
          portfolio_photos?: Json | null
          country?: string | null
          latitude?: number | null
          longitude?: number | null
          insurance_url?: string | null
          kbis_url?: string | null
          id_document_url?: string | null
          updated_at?: string
        }
      }
      profiles_client: {
        Row: {
          id: string
          first_name: string | null
          last_name: string | null
          phone: string | null
          address: string | null
        }
        Insert: {
          id: string
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          address?: string | null
        }
        Update: {
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          address?: string | null
        }
      }
      bookings: {
        Row: {
          id: string
          client_id: string | null
          artisan_id: string | null
          service_id: string | null
          booking_date: string
          booking_time: string
          duration_minutes: number | null
          status: string
          notes: string | null
          address: string
          price_ht: number | null
          price_ttc: number | null
          commission_rate: number
          payment_status: string
          payment_intent_id: string | null
          confirmed_at: string | null
          completed_at: string | null
          cancelled_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          client_id?: string | null
          artisan_id?: string | null
          service_id?: string | null
          booking_date: string
          booking_time: string
          duration_minutes?: number | null
          status?: string
          notes?: string | null
          address: string
          price_ht?: number | null
          price_ttc?: number | null
          commission_rate?: number
          payment_status?: string
          payment_intent_id?: string | null
          confirmed_at?: string | null
          created_at?: string
        }
        Update: {
          status?: string
          notes?: string | null
          price_ht?: number | null
          price_ttc?: number | null
          confirmed_at?: string | null
          completed_at?: string | null
          cancelled_at?: string | null
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
        Insert: {
          id?: string
          artisan_id: string
          category_id?: string | null
          name: string
          description?: string | null
          duration_minutes: number
          price_ht: number
          price_ttc: number
          active?: boolean
          created_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          duration_minutes?: number
          price_ht?: number
          price_ttc?: number
          active?: boolean
        }
      }
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
        Insert: {
          id?: string
          name: string
          slug: string
          icon?: string | null
          description?: string | null
          active?: boolean
          created_at?: string
        }
        Update: {
          name?: string
          slug?: string
          icon?: string | null
          description?: string | null
          active?: boolean
        }
      }
      availability: {
        Row: {
          id: string
          artisan_id: string
          day_of_week: number
          start_time: string
          end_time: string
          is_available: boolean
        }
        Insert: {
          id?: string
          artisan_id: string
          day_of_week: number
          start_time?: string
          end_time?: string
          is_available?: boolean
        }
        Update: {
          start_time?: string
          end_time?: string
          is_available?: boolean
        }
      }
      booking_messages: {
        Row: {
          id: string
          booking_id: string
          sender_id: string
          sender_role: string
          sender_name: string
          content: string
          type: string
          metadata: Json | null
          attachment_url: string | null
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          booking_id: string
          sender_id: string
          sender_role: string
          sender_name: string
          content: string
          type?: string
          metadata?: Json | null
          attachment_url?: string | null
          created_at?: string
        }
        Update: {
          read_at?: string | null
          metadata?: Json | null
        }
      }
      artisan_notifications: {
        Row: {
          id: string
          artisan_id: string
          type: string
          title: string
          body: string
          read: boolean
          data_json: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          artisan_id: string
          type: string
          title: string
          body: string
          read?: boolean
          data_json?: Json | null
          created_at?: string
        }
        Update: {
          read?: boolean
        }
      }
      artisan_absences: {
        Row: {
          id: string
          artisan_id: string
          start_date: string
          end_date: string
          reason: string | null
          label: string | null
          source: string | null
          created_at: string
        }
        Insert: {
          id?: string
          artisan_id: string
          start_date: string
          end_date: string
          reason?: string | null
          label?: string | null
          source?: string | null
        }
        Update: {
          start_date?: string
          end_date?: string
          reason?: string | null
          label?: string | null
        }
      }
      artisan_photos: {
        Row: {
          id: string
          artisan_id: string
          booking_id: string | null
          url: string
          label: string | null
          lat: number | null
          lng: number | null
          taken_at: string | null
          source: string | null
          created_at: string
        }
        Insert: {
          id?: string
          artisan_id: string
          booking_id?: string | null
          url: string
          label?: string | null
          lat?: number | null
          lng?: number | null
          taken_at?: string | null
          source?: string | null
        }
        Update: {
          label?: string | null
        }
      }
      conversations: {
        Row: {
          id: string
          artisan_id: string
          contact_id: string
          contact_type: string
          contact_name: string
          contact_avatar: string | null
          last_message_at: string | null
          last_message_preview: string | null
          unread_count: number
          created_at: string
        }
        Insert: {
          id?: string
          artisan_id: string
          contact_id: string
          contact_type: string
          contact_name: string
          contact_avatar?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          unread_count?: number
        }
        Update: {
          last_message_at?: string | null
          last_message_preview?: string | null
          unread_count?: number
        }
      }
      conversation_messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string
          type: string
          content: string
          metadata: Json | null
          ordre_mission: Json | null
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_id: string
          type?: string
          content: string
          metadata?: Json | null
          ordre_mission?: Json | null
          read?: boolean
        }
        Update: {
          read?: boolean
          ordre_mission?: Json | null
        }
      }
      subscriptions: {
        Row: {
          user_id: string
          plan_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          current_period_end: string | null
          cancel_at_period_end: boolean
          updated_at: string
        }
        Insert: {
          user_id: string
          plan_id: string
          status: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          updated_at?: string
        }
        Update: {
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          updated_at?: string
        }
      }
      idempotency_keys: {
        Row: {
          key: string
          response_body: Json
          response_status: number
          created_at: string
        }
        Insert: {
          key: string
          response_body: Json
          response_status: number
          created_at?: string
        }
        Update: {
          response_body?: Json
          response_status?: number
        }
      }
      syndic_artisans: {
        Row: {
          id: string
          cabinet_id: string
          artisan_user_id: string | null
          email: string | null
          nom: string | null
          prenom: string | null
          nom_famille: string | null
          telephone: string | null
          metier: string | null
          siret: string | null
          statut: string | null
          vitfix_certifie: boolean
          note: number | null
          nb_interventions: number
          rc_pro_valide: boolean
          rc_pro_expiration: string | null
          assurance_decennale_valide: boolean
          assurance_decennale_expiration: string | null
          compte_existant: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          cabinet_id: string
          artisan_user_id?: string | null
          email?: string | null
          nom?: string | null
          prenom?: string | null
          nom_famille?: string | null
          telephone?: string | null
          metier?: string | null
          siret?: string | null
          statut?: string | null
          vitfix_certifie?: boolean
          note?: number | null
          nb_interventions?: number
          rc_pro_valide?: boolean
          rc_pro_expiration?: string | null
          assurance_decennale_valide?: boolean
          assurance_decennale_expiration?: string | null
          compte_existant?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          artisan_user_id?: string | null
          email?: string | null
          nom?: string | null
          statut?: string | null
          rc_pro_valide?: boolean
          rc_pro_expiration?: string | null
          assurance_decennale_valide?: boolean
          assurance_decennale_expiration?: string | null
          updated_at?: string
        }
      }
      syndic_immeubles: {
        Row: {
          id: string
          cabinet_id: string
          nom: string
          adresse: string
          ville: string
          code_postal: string
          nb_lots: number
          annee_construction: number | null
          type_immeuble: string | null
          gestionnaire: string | null
          prochain_controle: string | null
          nb_interventions: number
          budget_annuel: number
          depenses_annee: number
          latitude: number | null
          longitude: number | null
          geoloc_activee: boolean
          rayon_detection: number
          reglement_texte: string | null
          reglement_pdf_nom: string | null
          reglement_date_maj: string | null
          reglement_charges_repartition: string | null
          reglement_majorite_ag: string | null
          reglement_fonds_travaux: boolean
          reglement_fonds_roulement_pct: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          cabinet_id: string
          nom: string
          adresse: string
          ville: string
          code_postal: string
          nb_lots?: number
          annee_construction?: number | null
          type_immeuble?: string | null
          gestionnaire?: string | null
          prochain_controle?: string | null
          nb_interventions?: number
          budget_annuel?: number
          depenses_annee?: number
          latitude?: number | null
          longitude?: number | null
          geoloc_activee?: boolean
          rayon_detection?: number
          reglement_texte?: string | null
          reglement_pdf_nom?: string | null
          reglement_date_maj?: string | null
          reglement_charges_repartition?: string | null
          reglement_majorite_ag?: string | null
          reglement_fonds_travaux?: boolean
          reglement_fonds_roulement_pct?: number
        }
        Update: {
          nom?: string
          adresse?: string
          ville?: string
          code_postal?: string
          nb_lots?: number
          annee_construction?: number | null
          type_immeuble?: string | null
          gestionnaire?: string | null
          prochain_controle?: string | null
          nb_interventions?: number
          budget_annuel?: number
          depenses_annee?: number
          latitude?: number | null
          longitude?: number | null
          geoloc_activee?: boolean
          rayon_detection?: number
          reglement_texte?: string | null
          reglement_pdf_nom?: string | null
          reglement_date_maj?: string | null
          reglement_charges_repartition?: string | null
          reglement_majorite_ag?: string | null
          reglement_fonds_travaux?: boolean
          reglement_fonds_roulement_pct?: number
          updated_at?: string
        }
      }
      syndic_team_members: {
        Row: {
          id: string
          cabinet_id: string
          user_id: string | null
          email: string
          full_name: string
          role: string
          invite_token: string | null
          invite_sent_at: string | null
          accepted_at: string | null
          is_active: boolean
          created_at: string
          custom_modules: string[] | null
        }
        Insert: {
          id?: string
          cabinet_id: string
          user_id?: string | null
          email: string
          full_name: string
          role: string
          invite_token?: string | null
          invite_sent_at?: string | null
          is_active?: boolean
          custom_modules?: string[] | null
        }
        Update: {
          user_id?: string | null
          full_name?: string
          role?: string
          invite_token?: string | null
          accepted_at?: string | null
          is_active?: boolean
          custom_modules?: string[] | null
        }
      }
      syndic_messages: {
        Row: {
          id: string
          cabinet_id: string
          artisan_user_id: string | null
          sender_id: string
          sender_role: string
          sender_name: string
          content: string
          message_type: string
          type: string | null
          metadata: Json | null
          mission_id: string | null
          read_at: string | null
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          cabinet_id: string
          artisan_user_id?: string | null
          sender_id: string
          sender_role: string
          sender_name: string
          content: string
          message_type?: string
          mission_id?: string | null
          created_at?: string
        }
        Update: {
          read_at?: string | null
          read?: boolean
        }
      }
      syndic_signalements: {
        Row: {
          id: string
          cabinet_id: string | null
          immeuble_nom: string
          demandeur_nom: string
          demandeur_role: string
          demandeur_email: string | null
          demandeur_telephone: string | null
          type_intervention: string
          description: string
          priorite: string
          statut: string
          batiment: string | null
          etage: string | null
          num_lot: string | null
          est_partie_commune: boolean
          zone_signalee: string | null
          artisan_assigne: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          cabinet_id?: string | null
          immeuble_nom: string
          demandeur_nom: string
          demandeur_role: string
          demandeur_email?: string | null
          demandeur_telephone?: string | null
          type_intervention: string
          description: string
          priorite?: string
          statut?: string
          batiment?: string | null
          etage?: string | null
          num_lot?: string | null
          est_partie_commune?: boolean
          zone_signalee?: string | null
        }
        Update: {
          priorite?: string
          statut?: string
          artisan_assigne?: string | null
          updated_at?: string
        }
      }
      syndic_signalement_messages: {
        Row: {
          id: string
          signalement_id: string
          auteur: string
          role: string
          texte: string
          created_at: string
        }
        Insert: {
          id?: string
          signalement_id: string
          auteur: string
          role: string
          texte: string
        }
        Update: {
          texte?: string
        }
      }
      syndic_missions: {
        Row: {
          id: string
          cabinet_id: string
          signalement_id: string | null
          immeuble: string
          artisan: string
          type: string
          description: string
          priorite: string
          statut: string
          date_creation: string
          date_intervention: string | null
          montant_devis: number | null
          montant_facture: number | null
          batiment: string | null
          etage: string | null
          num_lot: string | null
          locataire: string | null
          telephone_locataire: string | null
          acces_logement: string | null
          demandeur_nom: string | null
          demandeur_role: string | null
          demandeur_email: string | null
          est_partie_commune: boolean
          zone_signalee: string | null
          canal_messages: Json | null
          demandeur_messages: Json | null
          rapport_artisan: string | null
          travail_effectue: string | null
          materiaux_utilises: string | null
          problemes_constates: string | null
          recommandations: string | null
          date_rapport: string | null
          duree_intervention: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          cabinet_id: string
          signalement_id?: string | null
          immeuble: string
          artisan: string
          type: string
          description: string
          priorite?: string
          statut?: string
          date_creation: string
          date_intervention?: string | null
          montant_devis?: number | null
          batiment?: string | null
          etage?: string | null
          num_lot?: string | null
          locataire?: string | null
          telephone_locataire?: string | null
          acces_logement?: string | null
          demandeur_nom?: string | null
          demandeur_role?: string | null
          demandeur_email?: string | null
          est_partie_commune?: boolean
          zone_signalee?: string | null
          canal_messages?: Json | null
          demandeur_messages?: Json | null
        }
        Update: {
          artisan?: string
          description?: string
          priorite?: string
          statut?: string
          date_intervention?: string | null
          montant_devis?: number | null
          montant_facture?: number | null
          canal_messages?: Json | null
          demandeur_messages?: Json | null
          rapport_artisan?: string | null
          travail_effectue?: string | null
          materiaux_utilises?: string | null
          problemes_constates?: string | null
          recommandations?: string | null
          updated_at?: string
        }
      }
      syndic_planning_events: {
        Row: {
          id: string
          cabinet_id: string
          titre: string
          type: string
          date: string
          heure: string
          duree_min: number
          assigne_a: string
          assigne_role: string
          description: string
          cree_par: string
          statut: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          cabinet_id: string
          titre: string
          type: string
          date: string
          heure: string
          duree_min: number
          assigne_a: string
          assigne_role: string
          description: string
          cree_par: string
          statut?: string
        }
        Update: {
          titre?: string
          type?: string
          date?: string
          heure?: string
          duree_min?: number
          assigne_a?: string
          assigne_role?: string
          description?: string
          statut?: string
          updated_at?: string
        }
      }
      syndic_notifications: {
        Row: {
          id: string
          syndic_id: string
          type: string
          title: string
          body: string
          read: boolean
          data_json: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          syndic_id: string
          type: string
          title: string
          body: string
          read?: boolean
          data_json?: Json | null
          created_at?: string
        }
        Update: {
          read?: boolean
        }
      }
      syndic_emails_analysed: {
        Row: {
          id: string
          syndic_id: string
          gmail_message_id: string
          gmail_thread_id: string | null
          from_email: string
          from_name: string
          to_email: string
          subject: string
          body_preview: string
          received_at: string
          urgence: string
          type_demande: string
          resume_ia: string
          immeuble_detecte: string | null
          locataire_detecte: string | null
          actions_suggerees: string | null
          reponse_suggeree: string | null
          statut: string
          note_interne: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          syndic_id: string
          gmail_message_id: string
          gmail_thread_id?: string | null
          from_email: string
          from_name: string
          to_email: string
          subject: string
          body_preview: string
          received_at: string
          urgence: string
          type_demande: string
          resume_ia: string
          immeuble_detecte?: string | null
          locataire_detecte?: string | null
          actions_suggerees?: string | null
          reponse_suggeree?: string | null
          statut?: string
          note_interne?: string | null
        }
        Update: {
          statut?: string
          note_interne?: string | null
          updated_at?: string
        }
      }
      syndic_oauth_tokens: {
        Row: {
          syndic_id: string
          provider: string
          access_token: string
          refresh_token: string
          token_expiry: string
          email_compte: string
          scope: string
          oauth_nonce: string | null
          oauth_nonce_expires_at: string | null
          updated_at: string
        }
        Insert: {
          syndic_id: string
          provider: string
          access_token: string
          refresh_token: string
          token_expiry: string
          email_compte: string
          scope: string
          oauth_nonce?: string | null
          oauth_nonce_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          token_expiry?: string
          oauth_nonce?: string | null
          oauth_nonce_expires_at?: string | null
          updated_at?: string
        }
      }
      pt_fiscal_series: {
        Row: {
          id: string
          artisan_id: string
          series_prefix: string
          doc_type: string
          validation_code: string
          current_seq: number
          fiscal_year: number
          fiscal_space: string | null
          is_active: boolean
          updated_at: string
        }
        Insert: {
          id?: string
          artisan_id: string
          series_prefix: string
          doc_type: string
          validation_code: string
          current_seq?: number
          fiscal_year: number
          fiscal_space?: string | null
          is_active?: boolean
        }
        Update: {
          validation_code?: string
          current_seq?: number
          fiscal_space?: string | null
          is_active?: boolean
          updated_at?: string
        }
      }
      pt_fiscal_documents: {
        Row: {
          id: string
          artisan_id: string
          series_id: string
          doc_type: string
          doc_number: string
          seq_number: number
          atcud: string
          hash: string
          hash_control: string
          previous_hash: string | null
          status: string
          issue_date: string
          system_entry_date: string
          issuer_nif: string
          issuer_name: string
          issuer_address: string
          issuer_city: string
          issuer_postal_code: string
          client_nif: string
          client_name: string
          client_address: string
          client_city: string
          client_postal_code: string
          client_country: string
          net_total: number
          tax_total: number
          gross_total: number
          tax_exempt_base: number
          reduced_rate_base: number
          reduced_rate_tax: number
          intermediate_rate_base: number
          intermediate_rate_tax: number
          normal_rate_base: number
          normal_rate_tax: number
          qr_code_string: string
          fiscal_space: string
          lines: Json
        }
        Insert: {
          id?: string
          artisan_id: string
          series_id: string
          doc_type: string
          doc_number: string
          seq_number: number
          atcud: string
          hash: string
          hash_control: string
          previous_hash?: string | null
          status: string
          issue_date: string
          system_entry_date: string
          issuer_nif: string
          issuer_name: string
          issuer_address: string
          issuer_city: string
          issuer_postal_code: string
          client_nif: string
          client_name: string
          client_address: string
          client_city: string
          client_postal_code: string
          client_country: string
          net_total: number
          tax_total: number
          gross_total: number
          tax_exempt_base: number
          reduced_rate_base: number
          reduced_rate_tax: number
          intermediate_rate_base: number
          intermediate_rate_tax: number
          normal_rate_base: number
          normal_rate_tax: number
          qr_code_string: string
          fiscal_space: string
          lines: Json
        }
        Update: {
          status?: string
        }
      }
      tracking_sessions: {
        Row: {
          id: string
          booking_id: string
          status: string
          lat: number | null
          lng: number | null
          eta_minutes: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          booking_id: string
          status?: string
          lat?: number | null
          lng?: number | null
          eta_minutes?: number | null
        }
        Update: {
          status?: string
          lat?: number | null
          lng?: number | null
          eta_minutes?: number | null
          updated_at?: string
        }
      }
    }
    Views: {
      artisans_catalogue: {
        Row: {
          id: string
          google_note: number | null
          metier: string | null
          specialite: string | null
          nom_entreprise: string | null
          adresse: string | null
          ville: string | null
          arrondissement: string | null
          [key: string]: Json | undefined
        }
      }
    }
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// ── Helper types ──────────────────────────────────────────────────────────────
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
export type Views<T extends keyof Database['public']['Views']> =
  Database['public']['Views'][T]['Row']
