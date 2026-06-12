// ─────────────────────────────────────────────────────────────────────────────
// Types générés depuis le schéma Supabase LIVE (projet irluhepekbqgquveaett)
// Génération : MCP supabase generate_typescript_types — 2026-06-12 (audit P2, TSQ-01)
// Régénérer après toute migration : supabase gen types typescript --linked
// NE PAS éditer à la main.
// ─────────────────────────────────────────────────────────────────────────────
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      analyses_devis: {
        Row: {
          action_recommandee: string | null
          alertes: Json | null
          analysis_text: string | null
          artisan_nom: string | null
          artisan_siret: string | null
          created_at: string
          extracted: Json | null
          filename: string | null
          id: string
          is_vitfix: boolean | null
          messages_negociation: Json | null
          model: string | null
          pdf_text: string | null
          pdf_url: string | null
          score_confiance: number | null
          score_conformite: number | null
          score_conformite_max: number | null
          score_prix_ecart: number | null
          scores_details: Json | null
          siret_verified: boolean | null
          tokens_used: number | null
          user_id: string
          user_type: string
        }
        Insert: {
          action_recommandee?: string | null
          alertes?: Json | null
          analysis_text?: string | null
          artisan_nom?: string | null
          artisan_siret?: string | null
          created_at?: string
          extracted?: Json | null
          filename?: string | null
          id?: string
          is_vitfix?: boolean | null
          messages_negociation?: Json | null
          model?: string | null
          pdf_text?: string | null
          pdf_url?: string | null
          score_confiance?: number | null
          score_conformite?: number | null
          score_conformite_max?: number | null
          score_prix_ecart?: number | null
          scores_details?: Json | null
          siret_verified?: boolean | null
          tokens_used?: number | null
          user_id: string
          user_type: string
        }
        Update: {
          action_recommandee?: string | null
          alertes?: Json | null
          analysis_text?: string | null
          artisan_nom?: string | null
          artisan_siret?: string | null
          created_at?: string
          extracted?: Json | null
          filename?: string | null
          id?: string
          is_vitfix?: boolean | null
          messages_negociation?: Json | null
          model?: string | null
          pdf_text?: string | null
          pdf_url?: string | null
          score_confiance?: number | null
          score_conformite?: number | null
          score_conformite_max?: number | null
          score_prix_ecart?: number | null
          scores_details?: Json | null
          siret_verified?: boolean | null
          tokens_used?: number | null
          user_id?: string
          user_type?: string
        }
        Relationships: []
      }
      artisan_absences: {
        Row: {
          artisan_id: string
          created_at: string | null
          end_date: string
          id: string
          label: string | null
          reason: string | null
          start_date: string
        }
        Insert: {
          artisan_id: string
          created_at?: string | null
          end_date: string
          id?: string
          label?: string | null
          reason?: string | null
          start_date: string
        }
        Update: {
          artisan_id?: string
          created_at?: string | null
          end_date?: string
          id?: string
          label?: string | null
          reason?: string | null
          start_date?: string
        }
        Relationships: []
      }
      artisan_notifications: {
        Row: {
          artisan_id: string
          body: string | null
          created_at: string | null
          data_json: Json | null
          id: string
          read: boolean | null
          title: string
          type: string
        }
        Insert: {
          artisan_id: string
          body?: string | null
          created_at?: string | null
          data_json?: Json | null
          id?: string
          read?: boolean | null
          title: string
          type?: string
        }
        Update: {
          artisan_id?: string
          body?: string | null
          created_at?: string | null
          data_json?: Json | null
          id?: string
          read?: boolean | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      artisan_photos: {
        Row: {
          artisan_id: string
          booking_id: string | null
          created_at: string | null
          id: string
          label: string | null
          lat: number | null
          lng: number | null
          source: string | null
          taken_at: string
          thumbnail_url: string | null
          url: string
        }
        Insert: {
          artisan_id: string
          booking_id?: string | null
          created_at?: string | null
          id?: string
          label?: string | null
          lat?: number | null
          lng?: number | null
          source?: string | null
          taken_at?: string
          thumbnail_url?: string | null
          url: string
        }
        Update: {
          artisan_id?: string
          booking_id?: string | null
          created_at?: string | null
          id?: string
          label?: string | null
          lat?: number | null
          lng?: number | null
          source?: string | null
          taken_at?: string
          thumbnail_url?: string | null
          url?: string
        }
        Relationships: []
      }
      artisans_catalogue: {
        Row: {
          adresse: string | null
          arrondissement: string | null
          certifie: boolean | null
          created_at: string | null
          date_import: string | null
          fiche_active: boolean | null
          google_avis: number | null
          google_note: number | null
          id: number
          metier: string
          nom_entreprise: string
          pappers_verifie: boolean | null
          specialite: string | null
          telephone_pro: string | null
          ville: string | null
        }
        Insert: {
          adresse?: string | null
          arrondissement?: string | null
          certifie?: boolean | null
          created_at?: string | null
          date_import?: string | null
          fiche_active?: boolean | null
          google_avis?: number | null
          google_note?: number | null
          id?: number
          metier: string
          nom_entreprise: string
          pappers_verifie?: boolean | null
          specialite?: string | null
          telephone_pro?: string | null
          ville?: string | null
        }
        Update: {
          adresse?: string | null
          arrondissement?: string | null
          certifie?: boolean | null
          created_at?: string | null
          date_import?: string | null
          fiche_active?: boolean | null
          google_avis?: number | null
          google_note?: number | null
          id?: number
          metier?: string
          nom_entreprise?: string
          pappers_verifie?: boolean | null
          specialite?: string | null
          telephone_pro?: string | null
          ville?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          record_id: string | null
          table_name: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      availability: {
        Row: {
          artisan_id: string | null
          day_of_week: number | null
          end_time: string
          id: string
          is_available: boolean | null
          slot_type: string
          start_time: string
        }
        Insert: {
          artisan_id?: string | null
          day_of_week?: number | null
          end_time: string
          id?: string
          is_available?: boolean | null
          slot_type?: string
          start_time: string
        }
        Update: {
          artisan_id?: string | null
          day_of_week?: number | null
          end_time?: string
          id?: string
          is_available?: boolean | null
          slot_type?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "profiles_artisan"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_messages: {
        Row: {
          attachment_url: string | null
          booking_id: string
          content: string | null
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          metadata: Json | null
          read_at: string | null
          sender_id: string
          sender_name: string | null
          sender_role: string
          type: string | null
        }
        Insert: {
          attachment_url?: string | null
          booking_id: string
          content?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          metadata?: Json | null
          read_at?: string | null
          sender_id: string
          sender_name?: string | null
          sender_role?: string
          type?: string | null
        }
        Update: {
          attachment_url?: string | null
          booking_id?: string
          content?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          metadata?: Json | null
          read_at?: string | null
          sender_id?: string
          sender_name?: string | null
          sender_role?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_booking_messages_booking"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_reviews: {
        Row: {
          artisan_id: string
          booking_id: string
          client_id: string
          comment: string | null
          created_at: string | null
          id: string
          rating: number
        }
        Insert: {
          artisan_id: string
          booking_id: string
          client_id: string
          comment?: string | null
          created_at?: string | null
          id?: string
          rating: number
        }
        Update: {
          artisan_id?: string
          booking_id?: string
          client_id?: string
          comment?: string | null
          created_at?: string | null
          id?: string
          rating?: number
        }
        Relationships: []
      }
      bookings: {
        Row: {
          address: string
          artisan_id: string | null
          booking_date: string
          booking_time: string
          cancelled_at: string | null
          client_id: string | null
          commission_rate: number | null
          completed_at: string | null
          confirmed_at: string | null
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          duration_minutes: number | null
          id: string
          notes: string | null
          payment_intent_id: string | null
          payment_status: string | null
          price_ht: number | null
          price_ttc: number | null
          rapport_ia_genere_le: string | null
          rapport_ia_source: string | null
          rapport_ia_texte_brut: string | null
          service_id: string | null
          status: string | null
        }
        Insert: {
          address: string
          artisan_id?: string | null
          booking_date: string
          booking_time: string
          cancelled_at?: string | null
          client_id?: string | null
          commission_rate?: number | null
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          payment_intent_id?: string | null
          payment_status?: string | null
          price_ht?: number | null
          price_ttc?: number | null
          rapport_ia_genere_le?: string | null
          rapport_ia_source?: string | null
          rapport_ia_texte_brut?: string | null
          service_id?: string | null
          status?: string | null
        }
        Update: {
          address?: string
          artisan_id?: string | null
          booking_date?: string
          booking_time?: string
          cancelled_at?: string | null
          client_id?: string | null
          commission_rate?: number | null
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          payment_intent_id?: string | null
          payment_status?: string | null
          price_ht?: number | null
          price_ttc?: number | null
          rapport_ia_genere_le?: string | null
          rapport_ia_source?: string | null
          rapport_ia_texte_brut?: string | null
          service_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "profiles_artisan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles_client"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          display_order: number | null
          featured: boolean | null
          icon: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          featured?: boolean | null
          icon?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          featured?: boolean | null
          icon?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      chantiers_btp: {
        Row: {
          acompte_recu: number | null
          adresse: string | null
          budget: number | null
          client: string | null
          code_postal: string | null
          created_at: string
          date_debut: string | null
          date_fin: string | null
          description: string | null
          equipe: string | null
          geo_rayon_m: number
          id: string
          latitude: number | null
          longitude: number | null
          marge_prevue_pct: number | null
          montant_facture: number | null
          owner_id: string
          penalite_retard_jour: number | null
          sous_taches: Json
          statut: string
          titre: string
          tva_taux: number | null
          updated_at: string
          ville: string | null
        }
        Insert: {
          acompte_recu?: number | null
          adresse?: string | null
          budget?: number | null
          client?: string | null
          code_postal?: string | null
          created_at?: string
          date_debut?: string | null
          date_fin?: string | null
          description?: string | null
          equipe?: string | null
          geo_rayon_m?: number
          id?: string
          latitude?: number | null
          longitude?: number | null
          marge_prevue_pct?: number | null
          montant_facture?: number | null
          owner_id: string
          penalite_retard_jour?: number | null
          sous_taches?: Json
          statut?: string
          titre: string
          tva_taux?: number | null
          updated_at?: string
          ville?: string | null
        }
        Update: {
          acompte_recu?: number | null
          adresse?: string | null
          budget?: number | null
          client?: string | null
          code_postal?: string | null
          created_at?: string
          date_debut?: string | null
          date_fin?: string | null
          description?: string | null
          equipe?: string | null
          geo_rayon_m?: number
          id?: string
          latitude?: number | null
          longitude?: number | null
          marge_prevue_pct?: number | null
          montant_facture?: number | null
          owner_id?: string
          penalite_retard_jour?: number | null
          sous_taches?: Json
          statut?: string
          titre?: string
          tva_taux?: number | null
          updated_at?: string
          ville?: string | null
        }
        Relationships: []
      }
      charges_fixes: {
        Row: {
          categorie: string
          created_at: string | null
          date_debut: string | null
          date_fin: string | null
          frequence: string
          id: string
          label: string
          montant: number
          owner_id: string
          updated_at: string | null
        }
        Insert: {
          categorie: string
          created_at?: string | null
          date_debut?: string | null
          date_fin?: string | null
          frequence: string
          id?: string
          label: string
          montant: number
          owner_id: string
          updated_at?: string | null
        }
        Update: {
          categorie?: string
          created_at?: string | null
          date_debut?: string | null
          date_fin?: string | null
          frequence?: string
          id?: string
          label?: string
          montant?: number
          owner_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      client_favorites: {
        Row: {
          artisan_id: string
          client_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          artisan_id: string
          client_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          artisan_id?: string
          client_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: []
      }
      conversation_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          metadata: Json | null
          ordre_mission: Json | null
          read: boolean | null
          sender_id: string
          type: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          metadata?: Json | null
          ordre_mission?: Json | null
          read?: boolean | null
          sender_id: string
          type?: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          metadata?: Json | null
          ordre_mission?: Json | null
          read?: boolean | null
          sender_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          artisan_id: string
          contact_avatar: string | null
          contact_id: string
          contact_name: string
          contact_type: string
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          unread_count: number | null
        }
        Insert: {
          artisan_id: string
          contact_avatar?: string | null
          contact_id: string
          contact_name?: string
          contact_type?: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          unread_count?: number | null
        }
        Update: {
          artisan_id?: string
          contact_avatar?: string | null
          contact_id?: string
          contact_name?: string
          contact_type?: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          unread_count?: number | null
        }
        Relationships: []
      }
      conversations_simulateur: {
        Row: {
          bourse_publiee: boolean | null
          client_id: string | null
          code_postal: string | null
          created_at: string | null
          devis_demande: boolean | null
          estimation_basse: number | null
          estimation_haute: number | null
          id: string
          messages: Json
          metiers_detectes: string[] | null
          ville: string | null
        }
        Insert: {
          bourse_publiee?: boolean | null
          client_id?: string | null
          code_postal?: string | null
          created_at?: string | null
          devis_demande?: boolean | null
          estimation_basse?: number | null
          estimation_haute?: number | null
          id?: string
          messages?: Json
          metiers_detectes?: string[] | null
          ville?: string | null
        }
        Update: {
          bourse_publiee?: boolean | null
          client_id?: string | null
          code_postal?: string | null
          created_at?: string | null
          devis_demande?: boolean | null
          estimation_basse?: number | null
          estimation_haute?: number | null
          id?: string
          messages?: Json
          metiers_detectes?: string[] | null
          ville?: string | null
        }
        Relationships: []
      }
      credits_log: {
        Row: {
          artisan_id: string
          created_at: string | null
          description: string | null
          id: string
          mois_credits: number
          referral_id: string | null
          type: string
        }
        Insert: {
          artisan_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          mois_credits: number
          referral_id?: string | null
          type: string
        }
        Update: {
          artisan_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          mois_credits?: number
          referral_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "credits_log_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "profiles_artisan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credits_log_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_heartbeats: {
        Row: {
          cron_name: string
          details: Json | null
          duration_ms: number | null
          id: string
          ran_at: string
          status: string
        }
        Insert: {
          cron_name: string
          details?: Json | null
          duration_ms?: number | null
          id?: string
          ran_at?: string
          status?: string
        }
        Update: {
          cron_name?: string
          details?: Json | null
          duration_ms?: number | null
          id?: string
          ran_at?: string
          status?: string
        }
        Relationships: []
      }
      data_requests: {
        Row: {
          action_taken: string | null
          created_at: string
          id: string
          notes: string | null
          processed_at: string | null
          processed_by: string | null
          received_at: string
          request_type: string
          requester_email: string
          requester_name: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          action_taken?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          received_at?: string
          request_type: string
          requester_email: string
          requester_name?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          action_taken?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          received_at?: string
          request_type?: string
          requester_email?: string
          requester_name?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      dc4_btp: {
        Row: {
          adresse: string | null
          chantier: string | null
          chantier_id: string | null
          created_at: string | null
          date_agrement: string | null
          dc4_genere: boolean | null
          email: string | null
          entreprise: string
          id: string
          lot: string | null
          montant_marche: number | null
          owner_id: string
          responsable: string | null
          siret: string | null
          statut: string
          taux_tva: number | null
          telephone: string | null
          updated_at: string | null
        }
        Insert: {
          adresse?: string | null
          chantier?: string | null
          chantier_id?: string | null
          created_at?: string | null
          date_agrement?: string | null
          dc4_genere?: boolean | null
          email?: string | null
          entreprise?: string
          id?: string
          lot?: string | null
          montant_marche?: number | null
          owner_id: string
          responsable?: string | null
          siret?: string | null
          statut?: string
          taux_tva?: number | null
          telephone?: string | null
          updated_at?: string | null
        }
        Update: {
          adresse?: string | null
          chantier?: string | null
          chantier_id?: string | null
          created_at?: string | null
          date_agrement?: string | null
          dc4_genere?: boolean | null
          email?: string | null
          entreprise?: string
          id?: string
          lot?: string | null
          montant_marche?: number | null
          owner_id?: string
          responsable?: string | null
          siret?: string | null
          statut?: string
          taux_tva?: number | null
          telephone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dc4_btp_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "chantiers_btp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dc4_btp_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "v_rentabilite_chantier"
            referencedColumns: ["chantier_id"]
          },
        ]
      }
      dce_analyses_btp: {
        Row: {
          country: string | null
          created_at: string | null
          id: string
          owner_id: string
          project_type: string | null
          result: Json | null
          status: string
          titre: string
        }
        Insert: {
          country?: string | null
          created_at?: string | null
          id?: string
          owner_id: string
          project_type?: string | null
          result?: Json | null
          status?: string
          titre?: string
        }
        Update: {
          country?: string | null
          created_at?: string | null
          id?: string
          owner_id?: string
          project_type?: string | null
          result?: Json | null
          status?: string
          titre?: string
        }
        Relationships: []
      }
      declarations_sociales: {
        Row: {
          artisan_id: string
          ca_periode: number
          cotisations_estimees: number
          created_at: string
          date_debut: string
          date_declaration_effectuee: string | null
          date_fin: string
          date_limite_declaration: string
          id: string
          notes: string | null
          pays: string
          periode_label: string
          statut: string
          taux_applique: number
        }
        Insert: {
          artisan_id: string
          ca_periode?: number
          cotisations_estimees?: number
          created_at?: string
          date_debut: string
          date_declaration_effectuee?: string | null
          date_fin: string
          date_limite_declaration: string
          id?: string
          notes?: string | null
          pays?: string
          periode_label: string
          statut?: string
          taux_applique?: number
        }
        Update: {
          artisan_id?: string
          ca_periode?: number
          cotisations_estimees?: number
          created_at?: string
          date_debut?: string
          date_declaration_effectuee?: string | null
          date_fin?: string
          date_limite_declaration?: string
          id?: string
          notes?: string | null
          pays?: string
          periode_label?: string
          statut?: string
          taux_applique?: number
        }
        Relationships: [
          {
            foreignKeyName: "declarations_sociales_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "profiles_artisan"
            referencedColumns: ["id"]
          },
        ]
      }
      depenses_btp: {
        Row: {
          amount: number
          category: string
          chantier_id: string | null
          created_at: string
          date: string
          id: string
          label: string
          notes: string | null
          owner_id: string
        }
        Insert: {
          amount: number
          category?: string
          chantier_id?: string | null
          created_at?: string
          date?: string
          id?: string
          label: string
          notes?: string | null
          owner_id: string
        }
        Update: {
          amount?: number
          category?: string
          chantier_id?: string | null
          created_at?: string
          date?: string
          id?: string
          label?: string
          notes?: string | null
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "depenses_btp_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "chantiers_btp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "depenses_btp_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "v_rentabilite_chantier"
            referencedColumns: ["chantier_id"]
          },
        ]
      }
      devis: {
        Row: {
          anonymized_at: string | null
          artisan_id: string
          artisan_user_id: string | null
          cancelled_at: string | null
          cancelled_by_user_id: string | null
          cancelled_reason: string | null
          chain_signature: string | null
          chantier_id: string | null
          client_address: string | null
          client_email: string | null
          client_name: string
          client_phone: string | null
          client_response_at: string | null
          client_response_reason: string | null
          client_siren: string | null
          client_type: string | null
          content_hash: string | null
          country: string
          created_at: string
          currency: string
          deleted_at: string | null
          frais_annexes: Json | null
          id: string
          items: Json
          legal_hold: boolean
          legal_mentions: string | null
          notes: string | null
          numero: string | null
          pdf_url: string | null
          previous_hash: string | null
          raw_data: Json | null
          regime_tva: string
          signed_at: string | null
          signer_name: string | null
          status: string
          tax_label: string
          tax_rate: number
          total_ht_cents: number
          total_tax_cents: number
          total_ttc_cents: number
          tva_intra_emetteur: string | null
          tva_intra_preneur: string | null
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          anonymized_at?: string | null
          artisan_id: string
          artisan_user_id?: string | null
          cancelled_at?: string | null
          cancelled_by_user_id?: string | null
          cancelled_reason?: string | null
          chain_signature?: string | null
          chantier_id?: string | null
          client_address?: string | null
          client_email?: string | null
          client_name?: string
          client_phone?: string | null
          client_response_at?: string | null
          client_response_reason?: string | null
          client_siren?: string | null
          client_type?: string | null
          content_hash?: string | null
          country?: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          frais_annexes?: Json | null
          id?: string
          items?: Json
          legal_hold?: boolean
          legal_mentions?: string | null
          notes?: string | null
          numero?: string | null
          pdf_url?: string | null
          previous_hash?: string | null
          raw_data?: Json | null
          regime_tva?: string
          signed_at?: string | null
          signer_name?: string | null
          status?: string
          tax_label?: string
          tax_rate?: number
          total_ht_cents?: number
          total_tax_cents?: number
          total_ttc_cents?: number
          tva_intra_emetteur?: string | null
          tva_intra_preneur?: string | null
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          anonymized_at?: string | null
          artisan_id?: string
          artisan_user_id?: string | null
          cancelled_at?: string | null
          cancelled_by_user_id?: string | null
          cancelled_reason?: string | null
          chain_signature?: string | null
          chantier_id?: string | null
          client_address?: string | null
          client_email?: string | null
          client_name?: string
          client_phone?: string | null
          client_response_at?: string | null
          client_response_reason?: string | null
          client_siren?: string | null
          client_type?: string | null
          content_hash?: string | null
          country?: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          frais_annexes?: Json | null
          id?: string
          items?: Json
          legal_hold?: boolean
          legal_mentions?: string | null
          notes?: string | null
          numero?: string | null
          pdf_url?: string | null
          previous_hash?: string | null
          raw_data?: Json | null
          regime_tva?: string
          signed_at?: string | null
          signer_name?: string | null
          status?: string
          tax_label?: string
          tax_rate?: number
          total_ht_cents?: number
          total_tax_cents?: number
          total_ttc_cents?: number
          tva_intra_emetteur?: string | null
          tva_intra_preneur?: string | null
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devis_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "chantiers_btp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devis_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "v_rentabilite_chantier"
            referencedColumns: ["chantier_id"]
          },
        ]
      }
      doc_sequences: {
        Row: {
          artisan_user_id: string
          doc_type: string
          last_seq: number
          year: number
        }
        Insert: {
          artisan_user_id: string
          doc_type: string
          last_seq?: number
          year: number
        }
        Update: {
          artisan_user_id?: string
          doc_type?: string
          last_seq?: number
          year?: number
        }
        Relationships: []
      }
      documents_audit_log: {
        Row: {
          action: string
          cancelled_reason: string | null
          created_at: string
          details: Json | null
          doc_number: string | null
          id: string
          new_status: string | null
          old_status: string | null
          record_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          cancelled_reason?: string | null
          created_at?: string
          details?: Json | null
          doc_number?: string | null
          id?: string
          new_status?: string | null
          old_status?: string | null
          record_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          cancelled_reason?: string | null
          created_at?: string
          details?: Json | null
          doc_number?: string | null
          id?: string
          new_status?: string | null
          old_status?: string | null
          record_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      dpgf_btp: {
        Row: {
          client: string | null
          created_at: string | null
          date_remise: string | null
          id: string
          lots: Json
          montant_estime: number | null
          owner_id: string
          statut: string
          titre: string
          updated_at: string | null
        }
        Insert: {
          client?: string | null
          created_at?: string | null
          date_remise?: string | null
          id?: string
          lots?: Json
          montant_estime?: number | null
          owner_id: string
          statut?: string
          titre?: string
          updated_at?: string | null
        }
        Update: {
          client?: string | null
          created_at?: string | null
          date_remise?: string | null
          id?: string
          lots?: Json
          montant_estime?: number | null
          owner_id?: string
          statut?: string
          titre?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      equipe_membres_btp: {
        Row: {
          equipe_id: string
          membre_id: string
        }
        Insert: {
          equipe_id: string
          membre_id: string
        }
        Update: {
          equipe_id?: string
          membre_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipe_membres_btp_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes_btp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipe_membres_btp_membre_id_fkey"
            columns: ["membre_id"]
            isOneToOne: false
            referencedRelation: "membres_btp"
            referencedColumns: ["id"]
          },
        ]
      }
      equipes_btp: {
        Row: {
          chantier_id: string | null
          created_at: string
          id: string
          metier: string | null
          nom: string
          owner_id: string
        }
        Insert: {
          chantier_id?: string | null
          created_at?: string
          id?: string
          metier?: string | null
          nom: string
          owner_id: string
        }
        Update: {
          chantier_id?: string | null
          created_at?: string
          id?: string
          metier?: string | null
          nom?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipes_btp_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "chantiers_btp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipes_btp_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "v_rentabilite_chantier"
            referencedColumns: ["chantier_id"]
          },
        ]
      }
      factures: {
        Row: {
          anonymized_at: string | null
          artisan_id: string
          artisan_user_id: string | null
          avoir_de_facture_id: string | null
          cancelled_at: string | null
          cancelled_by_user_id: string | null
          cancelled_reason: string | null
          chain_signature: string | null
          chantier_id: string | null
          client_address: string | null
          client_email: string | null
          client_name: string
          client_phone: string | null
          client_siren: string | null
          client_type: string | null
          content_hash: string | null
          country: string
          created_at: string
          currency: string
          deleted_at: string | null
          devis_id: string | null
          due_date: string | null
          frais_annexes: Json | null
          id: string
          items: Json
          legal_hold: boolean
          legal_mentions: string | null
          notes: string | null
          numero: string | null
          paid_at: string | null
          payment_method: string | null
          pdf_url: string | null
          previous_hash: string | null
          raw_data: Json | null
          regime_tva: string
          signed_at: string | null
          status: string
          tax_label: string
          tax_rate: number
          total_ht_cents: number
          total_tax_cents: number
          total_ttc_cents: number
          tva_intra_emetteur: string | null
          tva_intra_preneur: string | null
          updated_at: string
        }
        Insert: {
          anonymized_at?: string | null
          artisan_id: string
          artisan_user_id?: string | null
          avoir_de_facture_id?: string | null
          cancelled_at?: string | null
          cancelled_by_user_id?: string | null
          cancelled_reason?: string | null
          chain_signature?: string | null
          chantier_id?: string | null
          client_address?: string | null
          client_email?: string | null
          client_name?: string
          client_phone?: string | null
          client_siren?: string | null
          client_type?: string | null
          content_hash?: string | null
          country?: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          devis_id?: string | null
          due_date?: string | null
          frais_annexes?: Json | null
          id?: string
          items?: Json
          legal_hold?: boolean
          legal_mentions?: string | null
          notes?: string | null
          numero?: string | null
          paid_at?: string | null
          payment_method?: string | null
          pdf_url?: string | null
          previous_hash?: string | null
          raw_data?: Json | null
          regime_tva?: string
          signed_at?: string | null
          status?: string
          tax_label?: string
          tax_rate?: number
          total_ht_cents?: number
          total_tax_cents?: number
          total_ttc_cents?: number
          tva_intra_emetteur?: string | null
          tva_intra_preneur?: string | null
          updated_at?: string
        }
        Update: {
          anonymized_at?: string | null
          artisan_id?: string
          artisan_user_id?: string | null
          avoir_de_facture_id?: string | null
          cancelled_at?: string | null
          cancelled_by_user_id?: string | null
          cancelled_reason?: string | null
          chain_signature?: string | null
          chantier_id?: string | null
          client_address?: string | null
          client_email?: string | null
          client_name?: string
          client_phone?: string | null
          client_siren?: string | null
          client_type?: string | null
          content_hash?: string | null
          country?: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          devis_id?: string | null
          due_date?: string | null
          frais_annexes?: Json | null
          id?: string
          items?: Json
          legal_hold?: boolean
          legal_mentions?: string | null
          notes?: string | null
          numero?: string | null
          paid_at?: string | null
          payment_method?: string | null
          pdf_url?: string | null
          previous_hash?: string | null
          raw_data?: Json | null
          regime_tva?: string
          signed_at?: string | null
          status?: string
          tax_label?: string
          tax_rate?: number
          total_ht_cents?: number
          total_tax_cents?: number
          total_ttc_cents?: number
          tva_intra_emetteur?: string | null
          tva_intra_preneur?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "factures_avoir_de_facture_id_fkey"
            columns: ["avoir_de_facture_id"]
            isOneToOne: false
            referencedRelation: "factures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_avoir_de_facture_id_fkey"
            columns: ["avoir_de_facture_id"]
            isOneToOne: false
            referencedRelation: "v_factures_chain_check"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "chantiers_btp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "v_rentabilite_chantier"
            referencedColumns: ["chantier_id"]
          },
          {
            foreignKeyName: "factures_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "v_devis_chain_check"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_keys: {
        Row: {
          created_at: string | null
          id: string
          key: string
          response_body: Json | null
          response_status: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          response_body?: Json | null
          response_status?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          response_body?: Json | null
          response_status?: number | null
        }
        Relationships: []
      }
      marches: {
        Row: {
          access_token: string
          acheteur: string | null
          artisan_dispo_info: Json | null
          btp_company_id: string | null
          btp_company_name: string | null
          budget_max: number | null
          budget_min: number | null
          candidatures_count: number | null
          category: string
          concelho: string | null
          contrainte_calendrier: string | null
          cpv_codes: string[] | null
          created_at: string | null
          date_publication: string | null
          deadline: string
          departement: string | null
          description: string
          district: string | null
          duration_text: string | null
          expert_referent: string | null
          id: string
          immeuble_adresse: string | null
          immeuble_nom: string | null
          is_recurring: boolean | null
          langue: string | null
          location_address: string | null
          location_city: string
          location_lat: number | null
          location_lng: number | null
          location_postal: string | null
          lot_technique: string | null
          matched_artisans: string[] | null
          max_candidatures: number | null
          mise_aux_normes: boolean | null
          mission_type: string | null
          montant_estime: number | null
          nb_intervenants_souhaite: number | null
          nb_logements: number | null
          nb_lots: number | null
          nb_unites: number | null
          numero_sinistre: string | null
          parent_marche_id: string | null
          partie_commune: boolean | null
          pays: string | null
          phase_chantier: string | null
          photos: string[] | null
          preferred_work_mode: string | null
          procedure_type: string | null
          programme_immobilier: string | null
          publisher_company: string | null
          publisher_email: string | null
          publisher_name: string
          publisher_phone: string | null
          publisher_siret: string | null
          publisher_type: string | null
          publisher_user_id: string | null
          recurrence_interval: string | null
          reference_chantier: string | null
          require_decennale: boolean | null
          require_qualibat: boolean | null
          require_rc_pro: boolean | null
          require_rge: boolean | null
          source: string | null
          source_id: string | null
          source_type: string | null
          start_date: string | null
          status: string | null
          synced_at: string | null
          template_id: string | null
          title: string
          titre_traduit: string | null
          type_etablissement: string | null
          type_hebergement: string | null
          type_sinistre: string | null
          unread_messages_count: number | null
          updated_at: string | null
          urgency: string | null
          url_source: string | null
          zone_test: string | null
        }
        Insert: {
          access_token: string
          acheteur?: string | null
          artisan_dispo_info?: Json | null
          btp_company_id?: string | null
          btp_company_name?: string | null
          budget_max?: number | null
          budget_min?: number | null
          candidatures_count?: number | null
          category: string
          concelho?: string | null
          contrainte_calendrier?: string | null
          cpv_codes?: string[] | null
          created_at?: string | null
          date_publication?: string | null
          deadline: string
          departement?: string | null
          description: string
          district?: string | null
          duration_text?: string | null
          expert_referent?: string | null
          id?: string
          immeuble_adresse?: string | null
          immeuble_nom?: string | null
          is_recurring?: boolean | null
          langue?: string | null
          location_address?: string | null
          location_city: string
          location_lat?: number | null
          location_lng?: number | null
          location_postal?: string | null
          lot_technique?: string | null
          matched_artisans?: string[] | null
          max_candidatures?: number | null
          mise_aux_normes?: boolean | null
          mission_type?: string | null
          montant_estime?: number | null
          nb_intervenants_souhaite?: number | null
          nb_logements?: number | null
          nb_lots?: number | null
          nb_unites?: number | null
          numero_sinistre?: string | null
          parent_marche_id?: string | null
          partie_commune?: boolean | null
          pays?: string | null
          phase_chantier?: string | null
          photos?: string[] | null
          preferred_work_mode?: string | null
          procedure_type?: string | null
          programme_immobilier?: string | null
          publisher_company?: string | null
          publisher_email?: string | null
          publisher_name: string
          publisher_phone?: string | null
          publisher_siret?: string | null
          publisher_type?: string | null
          publisher_user_id?: string | null
          recurrence_interval?: string | null
          reference_chantier?: string | null
          require_decennale?: boolean | null
          require_qualibat?: boolean | null
          require_rc_pro?: boolean | null
          require_rge?: boolean | null
          source?: string | null
          source_id?: string | null
          source_type?: string | null
          start_date?: string | null
          status?: string | null
          synced_at?: string | null
          template_id?: string | null
          title: string
          titre_traduit?: string | null
          type_etablissement?: string | null
          type_hebergement?: string | null
          type_sinistre?: string | null
          unread_messages_count?: number | null
          updated_at?: string | null
          urgency?: string | null
          url_source?: string | null
          zone_test?: string | null
        }
        Update: {
          access_token?: string
          acheteur?: string | null
          artisan_dispo_info?: Json | null
          btp_company_id?: string | null
          btp_company_name?: string | null
          budget_max?: number | null
          budget_min?: number | null
          candidatures_count?: number | null
          category?: string
          concelho?: string | null
          contrainte_calendrier?: string | null
          cpv_codes?: string[] | null
          created_at?: string | null
          date_publication?: string | null
          deadline?: string
          departement?: string | null
          description?: string
          district?: string | null
          duration_text?: string | null
          expert_referent?: string | null
          id?: string
          immeuble_adresse?: string | null
          immeuble_nom?: string | null
          is_recurring?: boolean | null
          langue?: string | null
          location_address?: string | null
          location_city?: string
          location_lat?: number | null
          location_lng?: number | null
          location_postal?: string | null
          lot_technique?: string | null
          matched_artisans?: string[] | null
          max_candidatures?: number | null
          mise_aux_normes?: boolean | null
          mission_type?: string | null
          montant_estime?: number | null
          nb_intervenants_souhaite?: number | null
          nb_logements?: number | null
          nb_lots?: number | null
          nb_unites?: number | null
          numero_sinistre?: string | null
          parent_marche_id?: string | null
          partie_commune?: boolean | null
          pays?: string | null
          phase_chantier?: string | null
          photos?: string[] | null
          preferred_work_mode?: string | null
          procedure_type?: string | null
          programme_immobilier?: string | null
          publisher_company?: string | null
          publisher_email?: string | null
          publisher_name?: string
          publisher_phone?: string | null
          publisher_siret?: string | null
          publisher_type?: string | null
          publisher_user_id?: string | null
          recurrence_interval?: string | null
          reference_chantier?: string | null
          require_decennale?: boolean | null
          require_qualibat?: boolean | null
          require_rc_pro?: boolean | null
          require_rge?: boolean | null
          source?: string | null
          source_id?: string | null
          source_type?: string | null
          start_date?: string | null
          status?: string | null
          synced_at?: string | null
          template_id?: string | null
          title?: string
          titre_traduit?: string | null
          type_etablissement?: string | null
          type_hebergement?: string | null
          type_sinistre?: string | null
          unread_messages_count?: number | null
          updated_at?: string | null
          urgency?: string | null
          url_source?: string | null
          zone_test?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marches_parent_marche_id_fkey"
            columns: ["parent_marche_id"]
            isOneToOne: false
            referencedRelation: "marches"
            referencedColumns: ["id"]
          },
        ]
      }
      marches_candidatures: {
        Row: {
          artisan_company_name: string | null
          artisan_decennale_valid: boolean | null
          artisan_disponibilite: string | null
          artisan_distance_km: number | null
          artisan_evaluated: boolean | null
          artisan_id: string
          artisan_qualibat_valid: boolean | null
          artisan_rating: number | null
          artisan_rating_count: number | null
          artisan_rc_pro_valid: boolean | null
          artisan_rge_valid: boolean | null
          artisan_tarif_horaire: number | null
          artisan_tarif_journalier: number | null
          artisan_user_id: string
          artisan_work_mode: string | null
          created_at: string | null
          description: string
          guarantee: string | null
          id: string
          marche_id: string
          materials_included: boolean | null
          price: number
          publisher_evaluated: boolean | null
          status: string | null
          timeline: string
          updated_at: string | null
        }
        Insert: {
          artisan_company_name?: string | null
          artisan_decennale_valid?: boolean | null
          artisan_disponibilite?: string | null
          artisan_distance_km?: number | null
          artisan_evaluated?: boolean | null
          artisan_id: string
          artisan_qualibat_valid?: boolean | null
          artisan_rating?: number | null
          artisan_rating_count?: number | null
          artisan_rc_pro_valid?: boolean | null
          artisan_rge_valid?: boolean | null
          artisan_tarif_horaire?: number | null
          artisan_tarif_journalier?: number | null
          artisan_user_id: string
          artisan_work_mode?: string | null
          created_at?: string | null
          description: string
          guarantee?: string | null
          id?: string
          marche_id: string
          materials_included?: boolean | null
          price: number
          publisher_evaluated?: boolean | null
          status?: string | null
          timeline: string
          updated_at?: string | null
        }
        Update: {
          artisan_company_name?: string | null
          artisan_decennale_valid?: boolean | null
          artisan_disponibilite?: string | null
          artisan_distance_km?: number | null
          artisan_evaluated?: boolean | null
          artisan_id?: string
          artisan_qualibat_valid?: boolean | null
          artisan_rating?: number | null
          artisan_rating_count?: number | null
          artisan_rc_pro_valid?: boolean | null
          artisan_rge_valid?: boolean | null
          artisan_tarif_horaire?: number | null
          artisan_tarif_journalier?: number | null
          artisan_user_id?: string
          artisan_work_mode?: string | null
          created_at?: string | null
          description?: string
          guarantee?: string | null
          id?: string
          marche_id?: string
          materials_included?: boolean | null
          price?: number
          publisher_evaluated?: boolean | null
          status?: string | null
          timeline?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_marches_candidatures_artisan"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "profiles_artisan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marches_candidatures_marche_id_fkey"
            columns: ["marche_id"]
            isOneToOne: false
            referencedRelation: "marches"
            referencedColumns: ["id"]
          },
        ]
      }
      marches_evaluations: {
        Row: {
          candidature_id: string
          commentaire: string | null
          created_at: string | null
          evaluator_type: string
          id: string
          marche_id: string
          note_communication: number | null
          note_globale: number
          note_ponctualite: number | null
          note_prix: number | null
          note_qualite: number | null
        }
        Insert: {
          candidature_id: string
          commentaire?: string | null
          created_at?: string | null
          evaluator_type: string
          id?: string
          marche_id: string
          note_communication?: number | null
          note_globale: number
          note_ponctualite?: number | null
          note_prix?: number | null
          note_qualite?: number | null
        }
        Update: {
          candidature_id?: string
          commentaire?: string | null
          created_at?: string | null
          evaluator_type?: string
          id?: string
          marche_id?: string
          note_communication?: number | null
          note_globale?: number
          note_ponctualite?: number | null
          note_prix?: number | null
          note_qualite?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "marches_evaluations_candidature_id_fkey"
            columns: ["candidature_id"]
            isOneToOne: false
            referencedRelation: "marches_candidatures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marches_evaluations_marche_id_fkey"
            columns: ["marche_id"]
            isOneToOne: false
            referencedRelation: "marches"
            referencedColumns: ["id"]
          },
        ]
      }
      marches_messages: {
        Row: {
          candidature_id: string | null
          content: string
          created_at: string | null
          id: string
          marche_id: string
          read: boolean | null
          sender_email: string | null
          sender_name: string
          sender_type: string
        }
        Insert: {
          candidature_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          marche_id: string
          read?: boolean | null
          sender_email?: string | null
          sender_name: string
          sender_type: string
        }
        Update: {
          candidature_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          marche_id?: string
          read?: boolean | null
          sender_email?: string | null
          sender_name?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "marches_messages_candidature_id_fkey"
            columns: ["candidature_id"]
            isOneToOne: false
            referencedRelation: "marches_candidatures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marches_messages_marche_id_fkey"
            columns: ["marche_id"]
            isOneToOne: false
            referencedRelation: "marches"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_demandes: {
        Row: {
          buyer_user_id: string
          created_at: string
          date_debut: string | null
          date_fin: string | null
          id: string
          listing_id: string
          message: string | null
          prix_propose: number | null
          reponse_vendeur: string | null
          status: string
          type_demande: string
          updated_at: string
        }
        Insert: {
          buyer_user_id: string
          created_at?: string
          date_debut?: string | null
          date_fin?: string | null
          id?: string
          listing_id: string
          message?: string | null
          prix_propose?: number | null
          reponse_vendeur?: string | null
          status?: string
          type_demande: string
          updated_at?: string
        }
        Update: {
          buyer_user_id?: string
          created_at?: string
          date_debut?: string | null
          date_fin?: string | null
          id?: string
          listing_id?: string
          message?: string | null
          prix_propose?: number | null
          reponse_vendeur?: string | null
          status?: string
          type_demande?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_demandes_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_listings: {
        Row: {
          accessible_ae: boolean
          annee: number | null
          caracteristiques: Json | null
          categorie: string
          country: string
          created_at: string
          description: string | null
          disponible_de: string | null
          disponible_jusqu: string | null
          etat: string
          id: string
          latitude: number | null
          localisation: string | null
          longitude: number | null
          marque: string | null
          modele: string | null
          photos: string[] | null
          prix_location_jour: number | null
          prix_location_mois: number | null
          prix_location_semaine: number | null
          prix_vente: number | null
          status: string
          title: string
          type_annonce: string
          updated_at: string
          user_id: string
          vendeur_nom: string | null
          vendeur_phone: string | null
          vues: number
        }
        Insert: {
          accessible_ae?: boolean
          annee?: number | null
          caracteristiques?: Json | null
          categorie: string
          country?: string
          created_at?: string
          description?: string | null
          disponible_de?: string | null
          disponible_jusqu?: string | null
          etat?: string
          id?: string
          latitude?: number | null
          localisation?: string | null
          longitude?: number | null
          marque?: string | null
          modele?: string | null
          photos?: string[] | null
          prix_location_jour?: number | null
          prix_location_mois?: number | null
          prix_location_semaine?: number | null
          prix_vente?: number | null
          status?: string
          title: string
          type_annonce: string
          updated_at?: string
          user_id: string
          vendeur_nom?: string | null
          vendeur_phone?: string | null
          vues?: number
        }
        Update: {
          accessible_ae?: boolean
          annee?: number | null
          caracteristiques?: Json | null
          categorie?: string
          country?: string
          created_at?: string
          description?: string | null
          disponible_de?: string | null
          disponible_jusqu?: string | null
          etat?: string
          id?: string
          latitude?: number | null
          localisation?: string | null
          longitude?: number | null
          marque?: string | null
          modele?: string | null
          photos?: string[] | null
          prix_location_jour?: number | null
          prix_location_mois?: number | null
          prix_location_semaine?: number | null
          prix_vente?: number | null
          status?: string
          title?: string
          type_annonce?: string
          updated_at?: string
          user_id?: string
          vendeur_nom?: string | null
          vendeur_phone?: string | null
          vues?: number
        }
        Relationships: []
      }
      membres_btp: {
        Row: {
          actif: boolean | null
          charges_patronales_pct: number | null
          charges_pct: number
          charges_salariales_pct: number | null
          cout_horaire: number
          created_at: string
          email: string | null
          equipe_id: string | null
          heures_hebdo: number | null
          id: string
          indemnite_trajet_jour: number | null
          nom: string
          owner_id: string
          panier_repas_jour: number | null
          prenom: string
          prime_mensuelle: number | null
          role_perso: string | null
          salaire_brut_mensuel: number | null
          salaire_net_mensuel: number | null
          telephone: string | null
          type_compte: string
          type_contrat: string | null
        }
        Insert: {
          actif?: boolean | null
          charges_patronales_pct?: number | null
          charges_pct?: number
          charges_salariales_pct?: number | null
          cout_horaire?: number
          created_at?: string
          email?: string | null
          equipe_id?: string | null
          heures_hebdo?: number | null
          id?: string
          indemnite_trajet_jour?: number | null
          nom: string
          owner_id: string
          panier_repas_jour?: number | null
          prenom: string
          prime_mensuelle?: number | null
          role_perso?: string | null
          salaire_brut_mensuel?: number | null
          salaire_net_mensuel?: number | null
          telephone?: string | null
          type_compte?: string
          type_contrat?: string | null
        }
        Update: {
          actif?: boolean | null
          charges_patronales_pct?: number | null
          charges_pct?: number
          charges_salariales_pct?: number | null
          cout_horaire?: number
          created_at?: string
          email?: string | null
          equipe_id?: string | null
          heures_hebdo?: number | null
          id?: string
          indemnite_trajet_jour?: number | null
          nom?: string
          owner_id?: string
          panier_repas_jour?: number | null
          prenom?: string
          prime_mensuelle?: number | null
          role_perso?: string | null
          salaire_brut_mensuel?: number | null
          salaire_net_mensuel?: number | null
          telephone?: string | null
          type_compte?: string
          type_contrat?: string | null
        }
        Relationships: []
      }
      photos: {
        Row: {
          artisan_id: string | null
          caption: string | null
          created_at: string | null
          display_order: number | null
          id: string
          url: string
        }
        Insert: {
          artisan_id?: string | null
          caption?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          url: string
        }
        Update: {
          artisan_id?: string | null
          caption?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "photos_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "profiles_artisan"
            referencedColumns: ["id"]
          },
        ]
      }
      pointages_btp: {
        Row: {
          arrivee_lat: number | null
          arrivee_lng: number | null
          chantier_id: string | null
          chantier_nom: string | null
          created_at: string
          date: string
          depart_lat: number | null
          depart_lng: number | null
          distance_m: number | null
          employe: string
          heure_arrivee: string
          heure_depart: string | null
          heures_travaillees: number | null
          id: string
          membre_id: string | null
          mode: string
          notes: string | null
          owner_id: string
          pause_minutes: number
          poste: string | null
        }
        Insert: {
          arrivee_lat?: number | null
          arrivee_lng?: number | null
          chantier_id?: string | null
          chantier_nom?: string | null
          created_at?: string
          date: string
          depart_lat?: number | null
          depart_lng?: number | null
          distance_m?: number | null
          employe: string
          heure_arrivee: string
          heure_depart?: string | null
          heures_travaillees?: number | null
          id?: string
          membre_id?: string | null
          mode?: string
          notes?: string | null
          owner_id: string
          pause_minutes?: number
          poste?: string | null
        }
        Update: {
          arrivee_lat?: number | null
          arrivee_lng?: number | null
          chantier_id?: string | null
          chantier_nom?: string | null
          created_at?: string
          date?: string
          depart_lat?: number | null
          depart_lng?: number | null
          distance_m?: number | null
          employe?: string
          heure_arrivee?: string
          heure_depart?: string | null
          heures_travaillees?: number | null
          id?: string
          membre_id?: string | null
          mode?: string
          notes?: string | null
          owner_id?: string
          pause_minutes?: number
          poste?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pointages_btp_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "chantiers_btp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pointages_btp_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "v_rentabilite_chantier"
            referencedColumns: ["chantier_id"]
          },
          {
            foreignKeyName: "pointages_btp_membre_id_fkey"
            columns: ["membre_id"]
            isOneToOne: false
            referencedRelation: "membres_btp"
            referencedColumns: ["id"]
          },
        ]
      }
      pro_role_permissions: {
        Row: {
          access_level: string
          company_id: string
          created_at: string
          id: string
          member_id: string
          module_id: string
          updated_at: string
        }
        Insert: {
          access_level: string
          company_id: string
          created_at?: string
          id?: string
          member_id: string
          module_id: string
          updated_at?: string
        }
        Update: {
          access_level?: string
          company_id?: string
          created_at?: string
          id?: string
          member_id?: string
          module_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pro_role_permissions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pro_team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      pro_team_audit_log: {
        Row: {
          action: string
          actor_id: string
          company_id: string
          created_at: string
          details: Json | null
          id: string
          target_member_id: string | null
        }
        Insert: {
          action: string
          actor_id: string
          company_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_member_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          company_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_member_id?: string | null
        }
        Relationships: []
      }
      pro_team_members: {
        Row: {
          accepted_at: string | null
          assigned_chantiers: string[] | null
          company_id: string
          created_at: string
          email: string
          full_name: string
          id: string
          invite_sent_at: string | null
          invite_token: string | null
          is_active: boolean
          last_login_at: string | null
          phone: string | null
          role: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          assigned_chantiers?: string[] | null
          company_id: string
          created_at?: string
          email: string
          full_name?: string
          id?: string
          invite_sent_at?: string | null
          invite_token?: string | null
          is_active?: boolean
          last_login_at?: string | null
          phone?: string | null
          role: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          assigned_chantiers?: string[] | null
          company_id?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          invite_sent_at?: string | null
          invite_token?: string | null
          is_active?: boolean
          last_login_at?: string | null
          phone?: string | null
          role?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profile_specialties: {
        Row: {
          created_at: string
          id: string
          specialty_id: string
          user_id: string
          verified_source: string
        }
        Insert: {
          created_at?: string
          id?: string
          specialty_id: string
          user_id: string
          verified_source?: string
        }
        Update: {
          created_at?: string
          id?: string
          specialty_id?: string
          user_id?: string
          verified_source?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_specialties_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_artisan: {
        Row: {
          acre_actif: boolean | null
          acre_date_fin: string | null
          active: boolean | null
          ape_code: string | null
          auto_accept: boolean | null
          auto_block_duration_minutes: number | null
          auto_reply_message: string | null
          bio: string | null
          categories: string[] | null
          certidao_extracted: Json | null
          company_address: string | null
          company_city: string | null
          company_name: string | null
          company_postal_code: string | null
          created_at: string | null
          credit_mois_gratuits: number | null
          decennale_valid: boolean | null
          declaration_configuree: boolean | null
          email: string | null
          hourly_rate: number | null
          id: string
          insurance_coverage: string | null
          insurance_expiry: string | null
          insurance_name: string | null
          insurance_number: string | null
          insurance_scan_data: Json | null
          insurance_type: string | null
          insurance_url: string | null
          insurance_verified: boolean | null
          intervention_zones: Json | null
          kbis_extracted: Json | null
          kbis_extracted_encrypted: string | null
          kbis_url: string | null
          kyc_checks: Json | null
          kyc_market: string | null
          kyc_rejection_reason: string | null
          kyc_reviewed_at: string | null
          kyc_reviewed_by: string | null
          kyc_score: number | null
          kyc_status: string | null
          kyc_verified_at: string | null
          language: string | null
          last_seen_at: string | null
          latitude: number | null
          legal_form: string | null
          logo_url: string | null
          longitude: number | null
          marches_categories: string[] | null
          marches_description: string | null
          marches_opt_in: boolean | null
          marches_tarif_horaire: number | null
          marches_tarif_journalier: number | null
          marches_work_mode: string | null
          mediator_name: string | null
          mediator_url: string | null
          naf_code: string | null
          naf_label: string | null
          nif_encrypted: string | null
          paiement_mention_devis: boolean | null
          paiement_mention_facture: boolean | null
          paiement_modes: Json | null
          periodicite_declaration: string | null
          phone: string | null
          pii_encryption_version: number
          profile_photo_url: string | null
          qualibat_valid: boolean | null
          rating_avg: number | null
          rating_count: number | null
          rc_pro_valid: boolean | null
          rcs_number: string | null
          referral_code: string | null
          referral_flagged: boolean | null
          referral_parrain_id: string | null
          rge_valid: boolean | null
          share_capital: string | null
          siren: string | null
          siret: string | null
          siret_encrypted: string | null
          slug: string | null
          subscription_tier: string | null
          total_parrainages_reussis: number | null
          tva_auto_activate: boolean
          tva_intra: string | null
          tva_notified_level: string | null
          type_activite: string | null
          updated_at: string | null
          user_id: string | null
          verified: boolean | null
          zone_radius_km: number | null
        }
        Insert: {
          acre_actif?: boolean | null
          acre_date_fin?: string | null
          active?: boolean | null
          ape_code?: string | null
          auto_accept?: boolean | null
          auto_block_duration_minutes?: number | null
          auto_reply_message?: string | null
          bio?: string | null
          categories?: string[] | null
          certidao_extracted?: Json | null
          company_address?: string | null
          company_city?: string | null
          company_name?: string | null
          company_postal_code?: string | null
          created_at?: string | null
          credit_mois_gratuits?: number | null
          decennale_valid?: boolean | null
          declaration_configuree?: boolean | null
          email?: string | null
          hourly_rate?: number | null
          id?: string
          insurance_coverage?: string | null
          insurance_expiry?: string | null
          insurance_name?: string | null
          insurance_number?: string | null
          insurance_scan_data?: Json | null
          insurance_type?: string | null
          insurance_url?: string | null
          insurance_verified?: boolean | null
          intervention_zones?: Json | null
          kbis_extracted?: Json | null
          kbis_extracted_encrypted?: string | null
          kbis_url?: string | null
          kyc_checks?: Json | null
          kyc_market?: string | null
          kyc_rejection_reason?: string | null
          kyc_reviewed_at?: string | null
          kyc_reviewed_by?: string | null
          kyc_score?: number | null
          kyc_status?: string | null
          kyc_verified_at?: string | null
          language?: string | null
          last_seen_at?: string | null
          latitude?: number | null
          legal_form?: string | null
          logo_url?: string | null
          longitude?: number | null
          marches_categories?: string[] | null
          marches_description?: string | null
          marches_opt_in?: boolean | null
          marches_tarif_horaire?: number | null
          marches_tarif_journalier?: number | null
          marches_work_mode?: string | null
          mediator_name?: string | null
          mediator_url?: string | null
          naf_code?: string | null
          naf_label?: string | null
          nif_encrypted?: string | null
          paiement_mention_devis?: boolean | null
          paiement_mention_facture?: boolean | null
          paiement_modes?: Json | null
          periodicite_declaration?: string | null
          phone?: string | null
          pii_encryption_version?: number
          profile_photo_url?: string | null
          qualibat_valid?: boolean | null
          rating_avg?: number | null
          rating_count?: number | null
          rc_pro_valid?: boolean | null
          rcs_number?: string | null
          referral_code?: string | null
          referral_flagged?: boolean | null
          referral_parrain_id?: string | null
          rge_valid?: boolean | null
          share_capital?: string | null
          siren?: string | null
          siret?: string | null
          siret_encrypted?: string | null
          slug?: string | null
          subscription_tier?: string | null
          total_parrainages_reussis?: number | null
          tva_auto_activate?: boolean
          tva_intra?: string | null
          tva_notified_level?: string | null
          type_activite?: string | null
          updated_at?: string | null
          user_id?: string | null
          verified?: boolean | null
          zone_radius_km?: number | null
        }
        Update: {
          acre_actif?: boolean | null
          acre_date_fin?: string | null
          active?: boolean | null
          ape_code?: string | null
          auto_accept?: boolean | null
          auto_block_duration_minutes?: number | null
          auto_reply_message?: string | null
          bio?: string | null
          categories?: string[] | null
          certidao_extracted?: Json | null
          company_address?: string | null
          company_city?: string | null
          company_name?: string | null
          company_postal_code?: string | null
          created_at?: string | null
          credit_mois_gratuits?: number | null
          decennale_valid?: boolean | null
          declaration_configuree?: boolean | null
          email?: string | null
          hourly_rate?: number | null
          id?: string
          insurance_coverage?: string | null
          insurance_expiry?: string | null
          insurance_name?: string | null
          insurance_number?: string | null
          insurance_scan_data?: Json | null
          insurance_type?: string | null
          insurance_url?: string | null
          insurance_verified?: boolean | null
          intervention_zones?: Json | null
          kbis_extracted?: Json | null
          kbis_extracted_encrypted?: string | null
          kbis_url?: string | null
          kyc_checks?: Json | null
          kyc_market?: string | null
          kyc_rejection_reason?: string | null
          kyc_reviewed_at?: string | null
          kyc_reviewed_by?: string | null
          kyc_score?: number | null
          kyc_status?: string | null
          kyc_verified_at?: string | null
          language?: string | null
          last_seen_at?: string | null
          latitude?: number | null
          legal_form?: string | null
          logo_url?: string | null
          longitude?: number | null
          marches_categories?: string[] | null
          marches_description?: string | null
          marches_opt_in?: boolean | null
          marches_tarif_horaire?: number | null
          marches_tarif_journalier?: number | null
          marches_work_mode?: string | null
          mediator_name?: string | null
          mediator_url?: string | null
          naf_code?: string | null
          naf_label?: string | null
          nif_encrypted?: string | null
          paiement_mention_devis?: boolean | null
          paiement_mention_facture?: boolean | null
          paiement_modes?: Json | null
          periodicite_declaration?: string | null
          phone?: string | null
          pii_encryption_version?: number
          profile_photo_url?: string | null
          qualibat_valid?: boolean | null
          rating_avg?: number | null
          rating_count?: number | null
          rc_pro_valid?: boolean | null
          rcs_number?: string | null
          referral_code?: string | null
          referral_flagged?: boolean | null
          referral_parrain_id?: string | null
          rge_valid?: boolean | null
          share_capital?: string | null
          siren?: string | null
          siret?: string | null
          siret_encrypted?: string | null
          slug?: string | null
          subscription_tier?: string | null
          total_parrainages_reussis?: number | null
          tva_auto_activate?: boolean
          tva_intra?: string | null
          tva_notified_level?: string | null
          type_activite?: string | null
          updated_at?: string | null
          user_id?: string | null
          verified?: boolean | null
          zone_radius_km?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_artisan_referral_parrain_id_fkey"
            columns: ["referral_parrain_id"]
            isOneToOne: false
            referencedRelation: "profiles_artisan"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_client: {
        Row: {
          address: string | null
          created_at: string | null
          first_name: string | null
          id: string
          language: string | null
          last_name: string | null
          phone: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          first_name?: string | null
          id?: string
          language?: string | null
          last_name?: string | null
          phone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          first_name?: string | null
          id?: string
          language?: string | null
          last_name?: string | null
          phone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      rapports_btp: {
        Row: {
          chantier_id: string | null
          contenu: Json | null
          created_at: string | null
          date: string | null
          id: string
          owner_id: string
          photos: Json | null
          status: string | null
          titre: string | null
        }
        Insert: {
          chantier_id?: string | null
          contenu?: Json | null
          created_at?: string | null
          date?: string | null
          id?: string
          owner_id: string
          photos?: Json | null
          status?: string | null
          titre?: string | null
        }
        Update: {
          chantier_id?: string | null
          contenu?: Json | null
          created_at?: string | null
          date?: string | null
          id?: string
          owner_id?: string
          photos?: Json | null
          status?: string | null
          titre?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rapports_btp_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "chantiers_btp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rapports_btp_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "v_rentabilite_chantier"
            referencedColumns: ["chantier_id"]
          },
        ]
      }
      ref_prix_prestations_2026: {
        Row: {
          annee: number | null
          corps_metier: string
          created_at: string | null
          id: string
          prestation: string
          prix_max: number
          prix_min: number
          prix_moyen: number
          region: string | null
          source: string | null
          unite: string
        }
        Insert: {
          annee?: number | null
          corps_metier: string
          created_at?: string | null
          id?: string
          prestation: string
          prix_max: number
          prix_min: number
          prix_moyen: number
          region?: string | null
          source?: string | null
          unite: string
        }
        Update: {
          annee?: number | null
          corps_metier?: string
          created_at?: string | null
          id?: string
          prestation?: string
          prix_max?: number
          prix_min?: number
          prix_moyen?: number
          region?: string | null
          source?: string | null
          unite?: string
        }
        Relationships: []
      }
      ref_taux: {
        Row: {
          created_at: string | null
          date_debut_validite: string
          date_fin_validite: string | null
          description: string | null
          id: string
          juridiction: string
          regime: string
          seuil_max: number | null
          seuil_min: number | null
          source_reglementaire: string
          taux: number
          type_charge: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          date_debut_validite: string
          date_fin_validite?: string | null
          description?: string | null
          id?: string
          juridiction: string
          regime: string
          seuil_max?: number | null
          seuil_min?: number | null
          source_reglementaire: string
          taux: number
          type_charge: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          date_debut_validite?: string
          date_fin_validite?: string | null
          description?: string | null
          id?: string
          juridiction?: string
          regime?: string
          seuil_max?: number | null
          seuil_min?: number | null
          source_reglementaire?: string
          taux?: number
          type_charge?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      ref_taux_audit: {
        Row: {
          ancien_taux: number | null
          created_at: string | null
          id: string
          modifie_par: string
          motif: string | null
          nouveau_taux: number | null
          ref_taux_id: string | null
        }
        Insert: {
          ancien_taux?: number | null
          created_at?: string | null
          id?: string
          modifie_par: string
          motif?: string | null
          nouveau_taux?: number | null
          ref_taux_id?: string | null
        }
        Update: {
          ancien_taux?: number | null
          created_at?: string | null
          id?: string
          modifie_par?: string
          motif?: string | null
          nouveau_taux?: number | null
          ref_taux_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ref_taux_audit_ref_taux_id_fkey"
            columns: ["ref_taux_id"]
            isOneToOne: false
            referencedRelation: "ref_taux"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_risk_log: {
        Row: {
          artisan_id: string | null
          created_at: string | null
          detail: string | null
          id: string
          ip: string | null
          referral_id: string
          type_evenement: string
        }
        Insert: {
          artisan_id?: string | null
          created_at?: string | null
          detail?: string | null
          id?: string
          ip?: string | null
          referral_id: string
          type_evenement: string
        }
        Update: {
          artisan_id?: string | null
          created_at?: string | null
          detail?: string | null
          id?: string
          ip?: string | null
          referral_id?: string
          type_evenement?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_risk_log_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "profiles_artisan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_risk_log_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          code: string
          created_at: string | null
          date_clic: string | null
          date_fin_periode_verification: string | null
          date_inscription: string | null
          date_premier_paiement: string | null
          date_recompense: string | null
          en_revue_manuelle: boolean | null
          filleul_id: string | null
          id: string
          ip_clic: string | null
          ip_inscription: string | null
          meme_ip_que_parrain: boolean | null
          meme_moyen_paiement_que_parrain: boolean | null
          mois_offerts_filleul: number | null
          mois_offerts_parrain: number | null
          note_admin: string | null
          parrain_id: string
          rappel_envoye: boolean | null
          risk_flags: Json | null
          risk_score: number | null
          source_partage: string | null
          statut: string
          stripe_customer_id_filleul: string | null
          stripe_payment_method_filleul: string | null
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          date_clic?: string | null
          date_fin_periode_verification?: string | null
          date_inscription?: string | null
          date_premier_paiement?: string | null
          date_recompense?: string | null
          en_revue_manuelle?: boolean | null
          filleul_id?: string | null
          id?: string
          ip_clic?: string | null
          ip_inscription?: string | null
          meme_ip_que_parrain?: boolean | null
          meme_moyen_paiement_que_parrain?: boolean | null
          mois_offerts_filleul?: number | null
          mois_offerts_parrain?: number | null
          note_admin?: string | null
          parrain_id: string
          rappel_envoye?: boolean | null
          risk_flags?: Json | null
          risk_score?: number | null
          source_partage?: string | null
          statut?: string
          stripe_customer_id_filleul?: string | null
          stripe_payment_method_filleul?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          date_clic?: string | null
          date_fin_periode_verification?: string | null
          date_inscription?: string | null
          date_premier_paiement?: string | null
          date_recompense?: string | null
          en_revue_manuelle?: boolean | null
          filleul_id?: string | null
          id?: string
          ip_clic?: string | null
          ip_inscription?: string | null
          meme_ip_que_parrain?: boolean | null
          meme_moyen_paiement_que_parrain?: boolean | null
          mois_offerts_filleul?: number | null
          mois_offerts_parrain?: number | null
          note_admin?: string | null
          parrain_id?: string
          rappel_envoye?: boolean | null
          risk_flags?: Json | null
          risk_score?: number | null
          source_partage?: string | null
          statut?: string
          stripe_customer_id_filleul?: string | null
          stripe_payment_method_filleul?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_filleul_id_fkey"
            columns: ["filleul_id"]
            isOneToOne: false
            referencedRelation: "profiles_artisan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_parrain_id_fkey"
            columns: ["parrain_id"]
            isOneToOne: false
            referencedRelation: "profiles_artisan"
            referencedColumns: ["id"]
          },
        ]
      }
      retenues_btp: {
        Row: {
          caution: boolean | null
          chantier: string
          chantier_id: string | null
          client: string | null
          created_at: string | null
          date_fin_travaux: string | null
          date_liberation: string | null
          id: string
          montant_marche: number | null
          montant_retenu: number | null
          owner_id: string
          statut: string
          taux_retenue: number | null
          updated_at: string | null
        }
        Insert: {
          caution?: boolean | null
          chantier?: string
          chantier_id?: string | null
          client?: string | null
          created_at?: string | null
          date_fin_travaux?: string | null
          date_liberation?: string | null
          id?: string
          montant_marche?: number | null
          montant_retenu?: number | null
          owner_id: string
          statut?: string
          taux_retenue?: number | null
          updated_at?: string | null
        }
        Update: {
          caution?: boolean | null
          chantier?: string
          chantier_id?: string | null
          client?: string | null
          created_at?: string | null
          date_fin_travaux?: string | null
          date_liberation?: string | null
          id?: string
          montant_marche?: number | null
          montant_retenu?: number | null
          owner_id?: string
          statut?: string
          taux_retenue?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retenues_btp_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "chantiers_btp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retenues_btp_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "v_rentabilite_chantier"
            referencedColumns: ["chantier_id"]
          },
        ]
      }
      reviews: {
        Row: {
          artisan_id: string | null
          booking_id: string | null
          client_id: string | null
          comment: string | null
          created_at: string | null
          id: string
          rating: number | null
          response: string | null
        }
        Insert: {
          artisan_id?: string | null
          booking_id?: string | null
          client_id?: string | null
          comment?: string | null
          created_at?: string | null
          id?: string
          rating?: number | null
          response?: string | null
        }
        Update: {
          artisan_id?: string | null
          booking_id?: string | null
          client_id?: string | null
          comment?: string | null
          created_at?: string | null
          id?: string
          rating?: number | null
          response?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "profiles_artisan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles_client"
            referencedColumns: ["id"]
          },
        ]
      }
      service_etapes: {
        Row: {
          created_at: string | null
          designation: string
          id: string
          ordre: number
          service_id: string
        }
        Insert: {
          created_at?: string | null
          designation: string
          id?: string
          ordre?: number
          service_id: string
        }
        Update: {
          created_at?: string | null
          designation?: string
          id?: string
          ordre?: number
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_etapes_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean | null
          artisan_id: string | null
          category_id: string | null
          created_at: string | null
          delai_minimum_heures: number
          description: string | null
          duration_minutes: number
          id: string
          name: string
          price_ht: number
          price_ttc: number
          validation_auto: boolean
        }
        Insert: {
          active?: boolean | null
          artisan_id?: string | null
          category_id?: string | null
          created_at?: string | null
          delai_minimum_heures?: number
          description?: string | null
          duration_minutes: number
          id?: string
          name: string
          price_ht: number
          price_ttc: number
          validation_auto?: boolean
        }
        Update: {
          active?: boolean | null
          artisan_id?: string | null
          category_id?: string | null
          created_at?: string | null
          delai_minimum_heures?: number
          description?: string | null
          duration_minutes?: number
          id?: string
          name?: string
          price_ht?: number
          price_ttc?: number
          validation_auto?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "services_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "profiles_artisan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      settings_btp: {
        Row: {
          amortissements_mensuels: number | null
          charges_patronales_pct: number
          cout_horaire_chef_chantier: number
          cout_horaire_conducteur: number
          cout_horaire_ouvrier: number
          depot_adresse: string | null
          depot_lat: number | null
          depot_lng: number | null
          depot_rayon_m: number
          devise: string
          frais_fixes_mensuels: Json | null
          geo_pointage_enabled: boolean
          objectif_marge_pct: number | null
          owner_id: string
          regime_tva: string | null
          salaire_patron_mensuel: number | null
          salaire_patron_type: string | null
          statut_juridique: string | null
          taux_cotisations_patron: number | null
          taux_is: number | null
          updated_at: string
        }
        Insert: {
          amortissements_mensuels?: number | null
          charges_patronales_pct?: number
          cout_horaire_chef_chantier?: number
          cout_horaire_conducteur?: number
          cout_horaire_ouvrier?: number
          depot_adresse?: string | null
          depot_lat?: number | null
          depot_lng?: number | null
          depot_rayon_m?: number
          devise?: string
          frais_fixes_mensuels?: Json | null
          geo_pointage_enabled?: boolean
          objectif_marge_pct?: number | null
          owner_id: string
          regime_tva?: string | null
          salaire_patron_mensuel?: number | null
          salaire_patron_type?: string | null
          statut_juridique?: string | null
          taux_cotisations_patron?: number | null
          taux_is?: number | null
          updated_at?: string
        }
        Update: {
          amortissements_mensuels?: number | null
          charges_patronales_pct?: number
          cout_horaire_chef_chantier?: number
          cout_horaire_conducteur?: number
          cout_horaire_ouvrier?: number
          depot_adresse?: string | null
          depot_lat?: number | null
          depot_lng?: number | null
          depot_rayon_m?: number
          devise?: string
          frais_fixes_mensuels?: Json | null
          geo_pointage_enabled?: boolean
          objectif_marge_pct?: number | null
          owner_id?: string
          regime_tva?: string | null
          salaire_patron_mensuel?: number | null
          salaire_patron_type?: string | null
          statut_juridique?: string | null
          taux_cotisations_patron?: number | null
          taux_is?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      situations_btp: {
        Row: {
          chantier: string
          chantier_id: string | null
          client: string | null
          created_at: string | null
          date: string
          id: string
          montant_marche: number | null
          numero: number
          owner_id: string
          statut: string
          travaux: Json
          updated_at: string | null
        }
        Insert: {
          chantier?: string
          chantier_id?: string | null
          client?: string | null
          created_at?: string | null
          date?: string
          id?: string
          montant_marche?: number | null
          numero?: number
          owner_id: string
          statut?: string
          travaux?: Json
          updated_at?: string | null
        }
        Update: {
          chantier?: string
          chantier_id?: string | null
          client?: string | null
          created_at?: string | null
          date?: string
          id?: string
          montant_marche?: number | null
          numero?: number
          owner_id?: string
          statut?: string
          travaux?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "situations_btp_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "chantiers_btp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "situations_btp_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "v_rentabilite_chantier"
            referencedColumns: ["chantier_id"]
          },
        ]
      }
      specialties: {
        Row: {
          applies_to: string
          code_ape: string | null
          created_at: string
          id: string
          label_fr: string
          label_pt: string | null
          slug: string
          sort_order: number
        }
        Insert: {
          applies_to?: string
          code_ape?: string | null
          created_at?: string
          id?: string
          label_fr: string
          label_pt?: string | null
          slug: string
          sort_order?: number
        }
        Update: {
          applies_to?: string
          code_ape?: string | null
          created_at?: string
          id?: string
          label_fr?: string
          label_pt?: string | null
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      stripe_webhook_events: {
        Row: {
          event_id: string
          event_type: string
          processed_at: string
        }
        Insert: {
          event_id: string
          event_type: string
          processed_at?: string
        }
        Update: {
          event_id?: string
          event_type?: string
          processed_at?: string
        }
        Relationships: []
      }
      subscription_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          occurred_at: string
          payload: Json
          stripe_customer_id: string | null
          stripe_event_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          occurred_at?: string
          payload?: Json
          stripe_customer_id?: string | null
          stripe_event_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          occurred_at?: string
          payload?: Json
          stripe_customer_id?: string | null
          stripe_event_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      subscription_metrics: {
        Row: {
          active_count: number
          churn_count: number
          date: string
          mrr_cents: number
          new_count: number
          past_due_count: number
          snapshot_at: string
          trial_count: number
        }
        Insert: {
          active_count?: number
          churn_count?: number
          date: string
          mrr_cents?: number
          new_count?: number
          past_due_count?: number
          snapshot_at?: string
          trial_count?: number
        }
        Update: {
          active_count?: number
          churn_count?: number
          date?: string
          mrr_cents?: number
          new_count?: number
          past_due_count?: number
          snapshot_at?: string
          trial_count?: number
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sync_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_detail: string | null
          id: string
          nb_errors: number | null
          nb_inserts: number | null
          nb_skipped: number | null
          nb_updates: number | null
          source: string
          started_at: string | null
          statut: string | null
          zone_test: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_detail?: string | null
          id?: string
          nb_errors?: number | null
          nb_inserts?: number | null
          nb_skipped?: number | null
          nb_updates?: number | null
          source: string
          started_at?: string | null
          statut?: string | null
          zone_test?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_detail?: string | null
          id?: string
          nb_errors?: number | null
          nb_inserts?: number | null
          nb_skipped?: number | null
          nb_updates?: number | null
          source?: string
          started_at?: string | null
          statut?: string | null
          zone_test?: string | null
        }
        Relationships: []
      }
      syndic_ag_presences: {
        Row: {
          assemblee_id: string
          cabinet_id: string
          coproprio_id: string | null
          created_at: string
          heure_arrivee: string | null
          id: string
          nom: string
          representant: string | null
          tantiemes: number
          type_presence: string
        }
        Insert: {
          assemblee_id: string
          cabinet_id: string
          coproprio_id?: string | null
          created_at?: string
          heure_arrivee?: string | null
          id?: string
          nom?: string
          representant?: string | null
          tantiemes?: number
          type_presence?: string
        }
        Update: {
          assemblee_id?: string
          cabinet_id?: string
          coproprio_id?: string | null
          created_at?: string
          heure_arrivee?: string | null
          id?: string
          nom?: string
          representant?: string | null
          tantiemes?: number
          type_presence?: string
        }
        Relationships: [
          {
            foreignKeyName: "syndic_ag_presences_assemblee_id_fkey"
            columns: ["assemblee_id"]
            isOneToOne: false
            referencedRelation: "syndic_assemblees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syndic_ag_presences_coproprio_id_fkey"
            columns: ["coproprio_id"]
            isOneToOne: false
            referencedRelation: "syndic_coproprios"
            referencedColumns: ["id"]
          },
        ]
      }
      syndic_ai_audit: {
        Row: {
          action: string
          agent_id: string
          conversation_id: string | null
          created_at: string
          error_message: string | null
          id: string
          ip_address: unknown
          status: string
          syndic_id: string
          tool_payload: Json | null
          user_agent: string | null
        }
        Insert: {
          action: string
          agent_id: string
          conversation_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          ip_address?: unknown
          status: string
          syndic_id: string
          tool_payload?: Json | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          agent_id?: string
          conversation_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          ip_address?: unknown
          status?: string
          syndic_id?: string
          tool_payload?: Json | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "syndic_ai_audit_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "syndic_ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      syndic_ai_conversations: {
        Row: {
          agent_id: string
          archived_at: string | null
          created_at: string
          id: string
          immeuble_id: string | null
          last_message_preview: string | null
          locale: string
          message_count: number
          syndic_id: string
          title: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          archived_at?: string | null
          created_at?: string
          id?: string
          immeuble_id?: string | null
          last_message_preview?: string | null
          locale: string
          message_count?: number
          syndic_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          archived_at?: string | null
          created_at?: string
          id?: string
          immeuble_id?: string | null
          last_message_preview?: string | null
          locale?: string
          message_count?: number
          syndic_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "syndic_ai_conversations_immeuble_id_fkey"
            columns: ["immeuble_id"]
            isOneToOne: false
            referencedRelation: "syndic_immeubles"
            referencedColumns: ["id"]
          },
        ]
      }
      syndic_ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          tool_calls: Json | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          tool_calls?: Json | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          tool_calls?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "syndic_ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "syndic_ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      syndic_alertes: {
        Row: {
          cabinet_id: string
          created_at: string
          created_by: string | null
          id: string
          immeuble_id: string | null
          message: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          titre: string
        }
        Insert: {
          cabinet_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          immeuble_id?: string | null
          message?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          titre: string
        }
        Update: {
          cabinet_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          immeuble_id?: string | null
          message?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          titre?: string
        }
        Relationships: [
          {
            foreignKeyName: "syndic_alertes_immeuble_id_fkey"
            columns: ["immeuble_id"]
            isOneToOne: false
            referencedRelation: "syndic_immeubles"
            referencedColumns: ["id"]
          },
        ]
      }
      syndic_alfredo_learning: {
        Row: {
          created_at: string
          diff_score: number | null
          draft_proposed: string
          email_id: string | null
          id: string
          metadata: Json | null
          syndic_id: string
          user_final_version: string
        }
        Insert: {
          created_at?: string
          diff_score?: number | null
          draft_proposed: string
          email_id?: string | null
          id?: string
          metadata?: Json | null
          syndic_id: string
          user_final_version: string
        }
        Update: {
          created_at?: string
          diff_score?: number | null
          draft_proposed?: string
          email_id?: string | null
          id?: string
          metadata?: Json | null
          syndic_id?: string
          user_final_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_syndic_alfredo_learning_email"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "syndic_emails_analysed"
            referencedColumns: ["id"]
          },
        ]
      }
      syndic_appels_charges: {
        Row: {
          cabinet_id: string
          coproprio_id: string | null
          created_at: string
          echeance: string | null
          exercice: string
          iban: string | null
          id: string
          immeuble_id: string | null
          montant_paye: number
          montant_total: number
          notes: string | null
          periode_debut: string
          periode_fin: string
          reference_paiement: string | null
          statut: string
          updated_at: string
        }
        Insert: {
          cabinet_id: string
          coproprio_id?: string | null
          created_at?: string
          echeance?: string | null
          exercice: string
          iban?: string | null
          id?: string
          immeuble_id?: string | null
          montant_paye?: number
          montant_total: number
          notes?: string | null
          periode_debut: string
          periode_fin: string
          reference_paiement?: string | null
          statut?: string
          updated_at?: string
        }
        Update: {
          cabinet_id?: string
          coproprio_id?: string | null
          created_at?: string
          echeance?: string | null
          exercice?: string
          iban?: string | null
          id?: string
          immeuble_id?: string | null
          montant_paye?: number
          montant_total?: number
          notes?: string | null
          periode_debut?: string
          periode_fin?: string
          reference_paiement?: string | null
          statut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "syndic_appels_charges_coproprio_id_fkey"
            columns: ["coproprio_id"]
            isOneToOne: false
            referencedRelation: "syndic_coproprios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syndic_appels_charges_immeuble_id_fkey"
            columns: ["immeuble_id"]
            isOneToOne: false
            referencedRelation: "syndic_immeubles"
            referencedColumns: ["id"]
          },
        ]
      }
      syndic_artisans: {
        Row: {
          artisan_user_id: string | null
          assurance_decennale_expiration: string | null
          assurance_decennale_valide: boolean | null
          cabinet_id: string
          compte_existant: boolean
          created_at: string
          email: string
          id: string
          metier: string
          nb_interventions: number
          nom: string
          nom_famille: string
          note: number
          prenom: string
          rc_pro_expiration: string | null
          rc_pro_valide: boolean
          siret: string
          statut: string
          telephone: string
          updated_at: string
          vitfix_certifie: boolean
        }
        Insert: {
          artisan_user_id?: string | null
          assurance_decennale_expiration?: string | null
          assurance_decennale_valide?: boolean | null
          cabinet_id: string
          compte_existant?: boolean
          created_at?: string
          email: string
          id?: string
          metier?: string
          nb_interventions?: number
          nom?: string
          nom_famille?: string
          note?: number
          prenom?: string
          rc_pro_expiration?: string | null
          rc_pro_valide?: boolean
          siret?: string
          statut?: string
          telephone?: string
          updated_at?: string
          vitfix_certifie?: boolean
        }
        Update: {
          artisan_user_id?: string | null
          assurance_decennale_expiration?: string | null
          assurance_decennale_valide?: boolean | null
          cabinet_id?: string
          compte_existant?: boolean
          created_at?: string
          email?: string
          id?: string
          metier?: string
          nb_interventions?: number
          nom?: string
          nom_famille?: string
          note?: number
          prenom?: string
          rc_pro_expiration?: string | null
          rc_pro_valide?: boolean
          siret?: string
          statut?: string
          telephone?: string
          updated_at?: string
          vitfix_certifie?: boolean
        }
        Relationships: []
      }
      syndic_assemblees: {
        Row: {
          cabinet_id: string
          convocation_count: number | null
          convocation_sent_at: string | null
          created_at: string
          date_ag: string
          id: string
          immeuble: string
          lieu: string
          notes: string | null
          ordre_du_jour: Json
          presents: number
          pv_content: string | null
          quorum: number
          signataire_nom: string | null
          signataire_role: string | null
          signature_ts: string | null
          statut: string
          titre: string
          total_tantiemes: number
          type_ag: string
          updated_at: string
        }
        Insert: {
          cabinet_id: string
          convocation_count?: number | null
          convocation_sent_at?: string | null
          created_at?: string
          date_ag: string
          id?: string
          immeuble?: string
          lieu?: string
          notes?: string | null
          ordre_du_jour?: Json
          presents?: number
          pv_content?: string | null
          quorum?: number
          signataire_nom?: string | null
          signataire_role?: string | null
          signature_ts?: string | null
          statut?: string
          titre?: string
          total_tantiemes?: number
          type_ag?: string
          updated_at?: string
        }
        Update: {
          cabinet_id?: string
          convocation_count?: number | null
          convocation_sent_at?: string | null
          created_at?: string
          date_ag?: string
          id?: string
          immeuble?: string
          lieu?: string
          notes?: string | null
          ordre_du_jour?: Json
          presents?: number
          pv_content?: string | null
          quorum?: number
          signataire_nom?: string | null
          signataire_role?: string | null
          signature_ts?: string | null
          statut?: string
          titre?: string
          total_tantiemes?: number
          type_ag?: string
          updated_at?: string
        }
        Relationships: []
      }
      syndic_automation_runs: {
        Row: {
          automation_id: string
          cabinet_id: string
          docs_generated: number
          emails_sent: number
          error_message: string | null
          finished_at: string | null
          id: string
          result_meta: Json | null
          started_at: string
          status: string
        }
        Insert: {
          automation_id: string
          cabinet_id: string
          docs_generated?: number
          emails_sent?: number
          error_message?: string | null
          finished_at?: string | null
          id?: string
          result_meta?: Json | null
          started_at?: string
          status: string
        }
        Update: {
          automation_id?: string
          cabinet_id?: string
          docs_generated?: number
          emails_sent?: number
          error_message?: string | null
          finished_at?: string | null
          id?: string
          result_meta?: Json | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "syndic_automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "syndic_automations"
            referencedColumns: ["id"]
          },
        ]
      }
      syndic_automations: {
        Row: {
          cabinet_id: string
          created_at: string
          created_by: string | null
          cron_expr: string
          description: string | null
          failure_count: number
          id: string
          last_run_at: string | null
          last_run_message: string | null
          last_run_status: string | null
          locale: string
          name: string
          next_run_at: string | null
          params: Json
          run_count: number
          status: string
          task_type: string
          timezone: string
          updated_at: string
        }
        Insert: {
          cabinet_id: string
          created_at?: string
          created_by?: string | null
          cron_expr: string
          description?: string | null
          failure_count?: number
          id?: string
          last_run_at?: string | null
          last_run_message?: string | null
          last_run_status?: string | null
          locale?: string
          name: string
          next_run_at?: string | null
          params?: Json
          run_count?: number
          status?: string
          task_type: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          cabinet_id?: string
          created_at?: string
          created_by?: string | null
          cron_expr?: string
          description?: string | null
          failure_count?: number
          id?: string
          last_run_at?: string | null
          last_run_message?: string | null
          last_run_status?: string | null
          locale?: string
          name?: string
          next_run_at?: string | null
          params?: Json
          run_count?: number
          status?: string
          task_type?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      syndic_avisos: {
        Row: {
          cabinet_id: string
          categoria: string
          created_at: string
          descricao: string
          fixado: boolean
          id: string
          immeuble: string
          notes: string
          prioridade: string
          titulo: string
          updated_at: string
          views: number
        }
        Insert: {
          cabinet_id: string
          categoria?: string
          created_at?: string
          descricao?: string
          fixado?: boolean
          id?: string
          immeuble?: string
          notes?: string
          prioridade?: string
          titulo?: string
          updated_at?: string
          views?: number
        }
        Update: {
          cabinet_id?: string
          categoria?: string
          created_at?: string
          descricao?: string
          fixado?: boolean
          id?: string
          immeuble?: string
          notes?: string
          prioridade?: string
          titulo?: string
          updated_at?: string
          views?: number
        }
        Relationships: []
      }
      syndic_cabinets: {
        Row: {
          adresse: string | null
          code_postal: string | null
          created_at: string | null
          email: string | null
          id: string
          nom: string
          siret: string | null
          telephone: string | null
          user_id: string | null
          ville: string | null
        }
        Insert: {
          adresse?: string | null
          code_postal?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          nom: string
          siret?: string | null
          telephone?: string | null
          user_id?: string | null
          ville?: string | null
        }
        Update: {
          adresse?: string | null
          code_postal?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          nom?: string
          siret?: string | null
          telephone?: string | null
          user_id?: string | null
          ville?: string | null
        }
        Relationships: []
      }
      syndic_caderneta: {
        Row: {
          cabinet_id: string
          cee: string
          created_at: string
          custo: number
          data: string | null
          edificio: string
          estado: string
          garantia: string
          id: string
          localizacao: string
          natureza: string
          notas: string
          prestador: string
          updated_at: string
        }
        Insert: {
          cabinet_id: string
          cee?: string
          created_at?: string
          custo?: number
          data?: string | null
          edificio?: string
          estado?: string
          garantia?: string
          id?: string
          localizacao?: string
          natureza?: string
          notas?: string
          prestador?: string
          updated_at?: string
        }
        Update: {
          cabinet_id?: string
          cee?: string
          created_at?: string
          custo?: number
          data?: string | null
          edificio?: string
          estado?: string
          garantia?: string
          id?: string
          localizacao?: string
          natureza?: string
          notas?: string
          prestador?: string
          updated_at?: string
        }
        Relationships: []
      }
      syndic_campanhas: {
        Row: {
          cabinet_id: string
          created_at: string
          destinatarios: number
          edificio: string
          estado: string
          id: string
          mensagem: string
          nome: string
          tipo: string
        }
        Insert: {
          cabinet_id: string
          created_at?: string
          destinatarios?: number
          edificio?: string
          estado?: string
          id?: string
          mensagem?: string
          nome?: string
          tipo?: string
        }
        Update: {
          cabinet_id?: string
          created_at?: string
          destinatarios?: number
          edificio?: string
          estado?: string
          id?: string
          mensagem?: string
          nome?: string
          tipo?: string
        }
        Relationships: []
      }
      syndic_cert_energ: {
        Row: {
          cabinet_id: string
          classe: string
          created_at: string
          data_emissao: string | null
          data_validade: string | null
          edificio: string
          id: string
          notas: string
          numero: string
          perito: string
          updated_at: string
        }
        Insert: {
          cabinet_id: string
          classe?: string
          created_at?: string
          data_emissao?: string | null
          data_validade?: string | null
          edificio?: string
          id?: string
          notas?: string
          numero?: string
          perito?: string
          updated_at?: string
        }
        Update: {
          cabinet_id?: string
          classe?: string
          created_at?: string
          data_emissao?: string | null
          data_validade?: string | null
          edificio?: string
          id?: string
          notas?: string
          numero?: string
          perito?: string
          updated_at?: string
        }
        Relationships: []
      }
      syndic_checklists: {
        Row: {
          cabinet_id: string
          created_at: string
          edificio: string
          estado: string
          id: string
          items: Json
          tipo: string
          titulo: string
        }
        Insert: {
          cabinet_id: string
          created_at?: string
          edificio?: string
          estado?: string
          id?: string
          items?: Json
          tipo?: string
          titulo?: string
        }
        Update: {
          cabinet_id?: string
          created_at?: string
          edificio?: string
          estado?: string
          id?: string
          items?: Json
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      syndic_contab_chamadas: {
        Row: {
          cabinet_id: string
          created_at: string
          data_emissao: string | null
          data_vencimento: string | null
          distribuicao: string
          edificio: string
          id: string
          liquidadas: number
          montante: number
          notas: string
          titulo: string
          updated_at: string
        }
        Insert: {
          cabinet_id: string
          created_at?: string
          data_emissao?: string | null
          data_vencimento?: string | null
          distribuicao?: string
          edificio?: string
          id?: string
          liquidadas?: number
          montante?: number
          notas?: string
          titulo?: string
          updated_at?: string
        }
        Update: {
          cabinet_id?: string
          created_at?: string
          data_emissao?: string | null
          data_vencimento?: string | null
          distribuicao?: string
          edificio?: string
          id?: string
          liquidadas?: number
          montante?: number
          notas?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      syndic_contab_diario: {
        Row: {
          cabinet_id: string
          conta: string
          created_at: string
          data: string | null
          descricao: string
          id: string
          montante: number
          tipo: string
          updated_at: string
        }
        Insert: {
          cabinet_id: string
          conta?: string
          created_at?: string
          data?: string | null
          descricao?: string
          id?: string
          montante?: number
          tipo?: string
          updated_at?: string
        }
        Update: {
          cabinet_id?: string
          conta?: string
          created_at?: string
          data?: string | null
          descricao?: string
          id?: string
          montante?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      syndic_contab_fracoes: {
        Row: {
          cabinet_id: string
          created_at: string
          id: string
          identificacao: string
          notas: string
          permilagem: number
          proprietario: string
          tipo: string
          updated_at: string
        }
        Insert: {
          cabinet_id: string
          created_at?: string
          id?: string
          identificacao?: string
          notas?: string
          permilagem?: number
          proprietario?: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          cabinet_id?: string
          created_at?: string
          id?: string
          identificacao?: string
          notas?: string
          permilagem?: number
          proprietario?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      syndic_contab_orcamentos: {
        Row: {
          ano: string
          aprovado: boolean
          cabinet_id: string
          created_at: string
          edificio: string
          id: string
          notas: string
          rubricas: string
          total_previsto: number
          updated_at: string
        }
        Insert: {
          ano?: string
          aprovado?: boolean
          cabinet_id: string
          created_at?: string
          edificio?: string
          id?: string
          notas?: string
          rubricas?: string
          total_previsto?: number
          updated_at?: string
        }
        Update: {
          ano?: string
          aprovado?: boolean
          cabinet_id?: string
          created_at?: string
          edificio?: string
          id?: string
          notas?: string
          rubricas?: string
          total_previsto?: number
          updated_at?: string
        }
        Relationships: []
      }
      syndic_contrats: {
        Row: {
          cabinet_id: string
          categoria: string
          created_at: string
          custo_anual: number
          custo_mensal: number
          data_fim: string | null
          data_inicio: string | null
          fornecedor: string
          id: string
          immeuble: string
          notes: string
          statut: string
          updated_at: string
        }
        Insert: {
          cabinet_id: string
          categoria?: string
          created_at?: string
          custo_anual?: number
          custo_mensal?: number
          data_fim?: string | null
          data_inicio?: string | null
          fornecedor?: string
          id?: string
          immeuble?: string
          notes?: string
          statut?: string
          updated_at?: string
        }
        Update: {
          cabinet_id?: string
          categoria?: string
          created_at?: string
          custo_anual?: number
          custo_mensal?: number
          data_fim?: string | null
          data_inicio?: string | null
          fornecedor?: string
          id?: string
          immeuble?: string
          notes?: string
          statut?: string
          updated_at?: string
        }
        Relationships: []
      }
      syndic_coproprios: {
        Row: {
          acces_portail: boolean
          batiment: string
          cabinet_id: string
          created_at: string
          email_locataire: string | null
          email_proprietaire: string
          est_occupe: boolean
          etage: number
          id: string
          immeuble: string
          nom_locataire: string | null
          nom_proprietaire: string
          notes: string | null
          numero_porte: string
          prenom_locataire: string | null
          prenom_proprietaire: string
          solde: number | null
          tantieme: number | null
          tel_locataire: string | null
          tel_proprietaire: string
          updated_at: string
        }
        Insert: {
          acces_portail?: boolean
          batiment?: string
          cabinet_id: string
          created_at?: string
          email_locataire?: string | null
          email_proprietaire?: string
          est_occupe?: boolean
          etage?: number
          id?: string
          immeuble?: string
          nom_locataire?: string | null
          nom_proprietaire?: string
          notes?: string | null
          numero_porte?: string
          prenom_locataire?: string | null
          prenom_proprietaire?: string
          solde?: number | null
          tantieme?: number | null
          tel_locataire?: string | null
          tel_proprietaire?: string
          updated_at?: string
        }
        Update: {
          acces_portail?: boolean
          batiment?: string
          cabinet_id?: string
          created_at?: string
          email_locataire?: string | null
          email_proprietaire?: string
          est_occupe?: boolean
          etage?: number
          id?: string
          immeuble?: string
          nom_locataire?: string | null
          nom_proprietaire?: string
          notes?: string | null
          numero_porte?: string
          prenom_locataire?: string | null
          prenom_proprietaire?: string
          solde?: number | null
          tantieme?: number | null
          tel_locataire?: string | null
          tel_proprietaire?: string
          updated_at?: string
        }
        Relationships: []
      }
      syndic_dashboard_prefs: {
        Row: {
          cabinet_id: string
          item_order: Json
          items_hidden: Json
          updated_at: string
        }
        Insert: {
          cabinet_id: string
          item_order?: Json
          items_hidden?: Json
          updated_at?: string
        }
        Update: {
          cabinet_id?: string
          item_order?: Json
          items_hidden?: Json
          updated_at?: string
        }
        Relationships: []
      }
      syndic_decl_encargos: {
        Row: {
          cabinet_id: string
          condomino: string
          created_at: string
          data_pedido: string | null
          divida: number
          edificio: string
          encargos_correntes: number
          estado: string
          fracao: string
          id: string
          notas: string
          prazo_limite: string | null
          updated_at: string
        }
        Insert: {
          cabinet_id: string
          condomino?: string
          created_at?: string
          data_pedido?: string | null
          divida?: number
          edificio?: string
          encargos_correntes?: number
          estado?: string
          fracao?: string
          id?: string
          notas?: string
          prazo_limite?: string | null
          updated_at?: string
        }
        Update: {
          cabinet_id?: string
          condomino?: string
          created_at?: string
          data_pedido?: string | null
          divida?: number
          edificio?: string
          encargos_correntes?: number
          estado?: string
          fracao?: string
          id?: string
          notas?: string
          prazo_limite?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      syndic_deliberacoes: {
        Row: {
          ag: string
          cabinet_id: string
          created_at: string
          deliberacao: string
          estado: string
          id: string
          origem: string
          prazo: string | null
          responsavel: string
        }
        Insert: {
          ag?: string
          cabinet_id: string
          created_at?: string
          deliberacao?: string
          estado?: string
          id?: string
          origem?: string
          prazo?: string | null
          responsavel?: string
        }
        Update: {
          ag?: string
          cabinet_id?: string
          created_at?: string
          deliberacao?: string
          estado?: string
          id?: string
          origem?: string
          prazo?: string | null
          responsavel?: string
        }
        Relationships: []
      }
      syndic_elevadores: {
        Row: {
          cabinet_id: string
          categoria: string
          created_at: string
          ema: string
          estado: string
          id: string
          immeuble: string
          marca: string
          notes: string
          proxima_inspecao: string | null
          ultima_inspecao: string | null
          updated_at: string
        }
        Insert: {
          cabinet_id: string
          categoria?: string
          created_at?: string
          ema?: string
          estado?: string
          id?: string
          immeuble?: string
          marca?: string
          notes?: string
          proxima_inspecao?: string | null
          ultima_inspecao?: string | null
          updated_at?: string
        }
        Update: {
          cabinet_id?: string
          categoria?: string
          created_at?: string
          ema?: string
          estado?: string
          id?: string
          immeuble?: string
          marca?: string
          notes?: string
          proxima_inspecao?: string | null
          ultima_inspecao?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      syndic_emails_analysed: {
        Row: {
          actions_suggerees: Json | null
          analyse_at: string | null
          body_preview: string | null
          created_at: string | null
          draft_body_html: string | null
          draft_body_text: string | null
          draft_generated_at: string | null
          draft_meta: Json | null
          draft_reviewed_at: string | null
          draft_reviewed_by: string | null
          draft_status: string | null
          draft_subject: string | null
          from_email: string
          from_name: string | null
          gmail_message_id: string
          gmail_thread_id: string | null
          id: string
          immeuble_detecte: string | null
          locataire_detecte: string | null
          note_interne: string | null
          received_at: string
          reponse_suggeree: string | null
          response_approved_by: string | null
          response_sent: string | null
          response_sent_at: string | null
          resume_ia: string | null
          statut: string
          subject: string | null
          syndic_id: string
          to_email: string | null
          type_demande: string
          updated_at: string | null
          urgence: string
        }
        Insert: {
          actions_suggerees?: Json | null
          analyse_at?: string | null
          body_preview?: string | null
          created_at?: string | null
          draft_body_html?: string | null
          draft_body_text?: string | null
          draft_generated_at?: string | null
          draft_meta?: Json | null
          draft_reviewed_at?: string | null
          draft_reviewed_by?: string | null
          draft_status?: string | null
          draft_subject?: string | null
          from_email?: string
          from_name?: string | null
          gmail_message_id: string
          gmail_thread_id?: string | null
          id?: string
          immeuble_detecte?: string | null
          locataire_detecte?: string | null
          note_interne?: string | null
          received_at?: string
          reponse_suggeree?: string | null
          response_approved_by?: string | null
          response_sent?: string | null
          response_sent_at?: string | null
          resume_ia?: string | null
          statut?: string
          subject?: string | null
          syndic_id: string
          to_email?: string | null
          type_demande?: string
          updated_at?: string | null
          urgence?: string
        }
        Update: {
          actions_suggerees?: Json | null
          analyse_at?: string | null
          body_preview?: string | null
          created_at?: string | null
          draft_body_html?: string | null
          draft_body_text?: string | null
          draft_generated_at?: string | null
          draft_meta?: Json | null
          draft_reviewed_at?: string | null
          draft_reviewed_by?: string | null
          draft_status?: string | null
          draft_subject?: string | null
          from_email?: string
          from_name?: string | null
          gmail_message_id?: string
          gmail_thread_id?: string | null
          id?: string
          immeuble_detecte?: string | null
          locataire_detecte?: string | null
          note_interne?: string | null
          received_at?: string
          reponse_suggeree?: string | null
          response_approved_by?: string | null
          response_sent?: string | null
          response_sent_at?: string | null
          resume_ia?: string | null
          statut?: string
          subject?: string | null
          syndic_id?: string
          to_email?: string | null
          type_demande?: string
          updated_at?: string | null
          urgence?: string
        }
        Relationships: []
      }
      syndic_enquetes: {
        Row: {
          anonima: boolean
          cabinet_id: string
          created_at: string
          descricao: string
          edificio: string
          estado: string
          id: string
          options: Json
          prazo: string | null
          tipo: string
          titulo: string
          total: number
        }
        Insert: {
          anonima?: boolean
          cabinet_id: string
          created_at?: string
          descricao?: string
          edificio?: string
          estado?: string
          id?: string
          options?: Json
          prazo?: string | null
          tipo?: string
          titulo?: string
          total?: number
        }
        Update: {
          anonima?: boolean
          cabinet_id?: string
          created_at?: string
          descricao?: string
          edificio?: string
          estado?: string
          id?: string
          options?: Json
          prazo?: string | null
          tipo?: string
          titulo?: string
          total?: number
        }
        Relationships: []
      }
      syndic_factures_copro: {
        Row: {
          cabinet_id: string
          coproprio_id: string | null
          created_at: string
          description: string | null
          echeance: string | null
          emise_le: string
          id: string
          immeuble_id: string | null
          montant_ht: number
          montant_ttc: number
          numero_facture: string
          pdf_url: string | null
          statut: string
          tva_taux: number
        }
        Insert: {
          cabinet_id: string
          coproprio_id?: string | null
          created_at?: string
          description?: string | null
          echeance?: string | null
          emise_le: string
          id?: string
          immeuble_id?: string | null
          montant_ht: number
          montant_ttc: number
          numero_facture: string
          pdf_url?: string | null
          statut?: string
          tva_taux?: number
        }
        Update: {
          cabinet_id?: string
          coproprio_id?: string | null
          created_at?: string
          description?: string | null
          echeance?: string | null
          emise_le?: string
          id?: string
          immeuble_id?: string | null
          montant_ht?: number
          montant_ttc?: number
          numero_facture?: string
          pdf_url?: string | null
          statut?: string
          tva_taux?: number
        }
        Relationships: [
          {
            foreignKeyName: "syndic_factures_copro_coproprio_id_fkey"
            columns: ["coproprio_id"]
            isOneToOne: false
            referencedRelation: "syndic_coproprios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syndic_factures_copro_immeuble_id_fkey"
            columns: ["immeuble_id"]
            isOneToOne: false
            referencedRelation: "syndic_immeubles"
            referencedColumns: ["id"]
          },
        ]
      }
      syndic_fcr_edificios: {
        Row: {
          cabinet_id: string
          created_at: string
          endereco: string
          id: string
          nome: string
          orcamento_anual: number
          percentagem_fcr: number
          saldo_inicial: number
          updated_at: string
        }
        Insert: {
          cabinet_id: string
          created_at?: string
          endereco?: string
          id?: string
          nome?: string
          orcamento_anual?: number
          percentagem_fcr?: number
          saldo_inicial?: number
          updated_at?: string
        }
        Update: {
          cabinet_id?: string
          created_at?: string
          endereco?: string
          id?: string
          nome?: string
          orcamento_anual?: number
          percentagem_fcr?: number
          saldo_inicial?: number
          updated_at?: string
        }
        Relationships: []
      }
      syndic_fcr_movimentos: {
        Row: {
          cabinet_id: string
          created_at: string
          data: string | null
          descricao: string
          edificio: string
          id: string
          montante: number
          tipo: string
          updated_at: string
        }
        Insert: {
          cabinet_id: string
          created_at?: string
          data?: string | null
          descricao?: string
          edificio?: string
          id?: string
          montante?: number
          tipo?: string
          updated_at?: string
        }
        Update: {
          cabinet_id?: string
          created_at?: string
          data?: string | null
          descricao?: string
          edificio?: string
          id?: string
          montante?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      syndic_immeubles: {
        Row: {
          adresse: string
          annee_construction: number | null
          budget_annuel: number | null
          cabinet_id: string | null
          code_postal: string
          created_at: string | null
          depenses_annee: number | null
          geoloc_activee: boolean | null
          gestionnaire: string | null
          id: string
          latitude: number | null
          longitude: number | null
          nb_interventions: number | null
          nb_lots: number | null
          nom: string
          prochain_controle: string | null
          rayon_detection: number | null
          reglement_charges_repartition: string | null
          reglement_date_maj: string | null
          reglement_fonds_roulement_pct: number | null
          reglement_fonds_travaux: boolean | null
          reglement_majorite_ag: string | null
          reglement_pdf_nom: string | null
          reglement_texte: string | null
          statut: string
          type_immeuble: string | null
          updated_at: string | null
          ville: string
        }
        Insert: {
          adresse?: string
          annee_construction?: number | null
          budget_annuel?: number | null
          cabinet_id?: string | null
          code_postal?: string
          created_at?: string | null
          depenses_annee?: number | null
          geoloc_activee?: boolean | null
          gestionnaire?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nb_interventions?: number | null
          nb_lots?: number | null
          nom: string
          prochain_controle?: string | null
          rayon_detection?: number | null
          reglement_charges_repartition?: string | null
          reglement_date_maj?: string | null
          reglement_fonds_roulement_pct?: number | null
          reglement_fonds_travaux?: boolean | null
          reglement_majorite_ag?: string | null
          reglement_pdf_nom?: string | null
          reglement_texte?: string | null
          statut?: string
          type_immeuble?: string | null
          updated_at?: string | null
          ville?: string
        }
        Update: {
          adresse?: string
          annee_construction?: number | null
          budget_annuel?: number | null
          cabinet_id?: string | null
          code_postal?: string
          created_at?: string | null
          depenses_annee?: number | null
          geoloc_activee?: boolean | null
          gestionnaire?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nb_interventions?: number | null
          nb_lots?: number | null
          nom?: string
          prochain_controle?: string | null
          rayon_detection?: number | null
          reglement_charges_repartition?: string | null
          reglement_date_maj?: string | null
          reglement_fonds_roulement_pct?: number | null
          reglement_fonds_travaux?: boolean | null
          reglement_majorite_ag?: string | null
          reglement_pdf_nom?: string | null
          reglement_texte?: string | null
          statut?: string
          type_immeuble?: string | null
          updated_at?: string | null
          ville?: string
        }
        Relationships: []
      }
      syndic_impayes: {
        Row: {
          appel_charge_id: string | null
          cabinet_id: string
          coproprio_id: string | null
          created_at: string
          depuis: string
          derniere_relance_at: string | null
          id: string
          immeuble_id: string | null
          montant: number
          nature: string
          nb_relances: number
          notes: string | null
          statut: string
        }
        Insert: {
          appel_charge_id?: string | null
          cabinet_id: string
          coproprio_id?: string | null
          created_at?: string
          depuis: string
          derniere_relance_at?: string | null
          id?: string
          immeuble_id?: string | null
          montant: number
          nature: string
          nb_relances?: number
          notes?: string | null
          statut?: string
        }
        Update: {
          appel_charge_id?: string | null
          cabinet_id?: string
          coproprio_id?: string | null
          created_at?: string
          depuis?: string
          derniere_relance_at?: string | null
          id?: string
          immeuble_id?: string | null
          montant?: number
          nature?: string
          nb_relances?: number
          notes?: string | null
          statut?: string
        }
        Relationships: [
          {
            foreignKeyName: "syndic_impayes_appel_charge_id_fkey"
            columns: ["appel_charge_id"]
            isOneToOne: false
            referencedRelation: "syndic_appels_charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syndic_impayes_coproprio_id_fkey"
            columns: ["coproprio_id"]
            isOneToOne: false
            referencedRelation: "syndic_coproprios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syndic_impayes_immeuble_id_fkey"
            columns: ["immeuble_id"]
            isOneToOne: false
            referencedRelation: "syndic_immeubles"
            referencedColumns: ["id"]
          },
        ]
      }
      syndic_infracoes: {
        Row: {
          cabinet_id: string
          condomino: string
          created_at: string
          descricao: string
          edificio: string
          etapa: string
          id: string
          multa: number
          tipo: string
        }
        Insert: {
          cabinet_id: string
          condomino?: string
          created_at?: string
          descricao?: string
          edificio?: string
          etapa?: string
          id?: string
          multa?: number
          tipo?: string
        }
        Update: {
          cabinet_id?: string
          condomino?: string
          created_at?: string
          descricao?: string
          edificio?: string
          etapa?: string
          id?: string
          multa?: number
          tipo?: string
        }
        Relationships: []
      }
      syndic_legal_corpus_fr: {
        Row: {
          article: string | null
          chunk_hash: string | null
          chunk_index: number | null
          content: string
          created_at: string
          embedding: string | null
          id: string
          language: string
          parent_path: string | null
          question_embedding: string | null
          search_vector: unknown
          source: string
          theme: string | null
          title: string
          updated_at: string | null
          version: number | null
        }
        Insert: {
          article?: string | null
          chunk_hash?: string | null
          chunk_index?: number | null
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          language?: string
          parent_path?: string | null
          question_embedding?: string | null
          search_vector?: unknown
          source: string
          theme?: string | null
          title: string
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          article?: string | null
          chunk_hash?: string | null
          chunk_index?: number | null
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          language?: string
          parent_path?: string | null
          question_embedding?: string | null
          search_vector?: unknown
          source?: string
          theme?: string | null
          title?: string
          updated_at?: string | null
          version?: number | null
        }
        Relationships: []
      }
      syndic_legal_corpus_pt: {
        Row: {
          article: string | null
          chunk_hash: string | null
          chunk_index: number | null
          content: string
          created_at: string
          embedding: string | null
          id: string
          language: string
          parent_path: string | null
          question_embedding: string | null
          search_vector: unknown
          source: string
          theme: string | null
          title: string
          updated_at: string | null
          version: number | null
        }
        Insert: {
          article?: string | null
          chunk_hash?: string | null
          chunk_index?: number | null
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          language?: string
          parent_path?: string | null
          question_embedding?: string | null
          search_vector?: unknown
          source: string
          theme?: string | null
          title: string
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          article?: string | null
          chunk_hash?: string | null
          chunk_index?: number | null
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          language?: string
          parent_path?: string | null
          question_embedding?: string | null
          search_vector?: unknown
          source?: string
          theme?: string | null
          title?: string
          updated_at?: string | null
          version?: number | null
        }
        Relationships: []
      }
      syndic_messages: {
        Row: {
          artisan_user_id: string
          cabinet_id: string
          content: string
          created_at: string
          id: string
          message_type: string
          mission_id: string | null
          read_at: string | null
          sender_id: string
          sender_name: string
          sender_role: string
        }
        Insert: {
          artisan_user_id: string
          cabinet_id: string
          content: string
          created_at?: string
          id?: string
          message_type?: string
          mission_id?: string | null
          read_at?: string | null
          sender_id: string
          sender_name?: string
          sender_role: string
        }
        Update: {
          artisan_user_id?: string
          cabinet_id?: string
          content?: string
          created_at?: string
          id?: string
          message_type?: string
          mission_id?: string | null
          read_at?: string | null
          sender_id?: string
          sender_name?: string
          sender_role?: string
        }
        Relationships: []
      }
      syndic_missions: {
        Row: {
          acces_logement: string | null
          artisan: string | null
          artisan_id: string | null
          batiment: string | null
          cabinet_id: string
          canal_messages: Json | null
          created_at: string | null
          date_creation: string | null
          date_intervention: string | null
          date_rapport: string | null
          deleted_at: string | null
          deleted_by: string | null
          demandeur_email: string | null
          demandeur_messages: Json | null
          demandeur_nom: string | null
          demandeur_role: string | null
          description: string | null
          duree_intervention: string | null
          est_partie_commune: boolean | null
          etage: string | null
          id: string
          immeuble: string | null
          locataire: string | null
          materiaux_utilises: string | null
          montant_devis: number | null
          montant_facture: number | null
          num_lot: string | null
          priorite: string | null
          problemes_constates: string | null
          rapport_artisan: string | null
          recommandations: string | null
          signalement_id: string | null
          statut: string | null
          telephone_locataire: string | null
          travail_effectue: string | null
          type: string | null
          updated_at: string | null
          zone_signalee: string | null
        }
        Insert: {
          acces_logement?: string | null
          artisan?: string | null
          artisan_id?: string | null
          batiment?: string | null
          cabinet_id: string
          canal_messages?: Json | null
          created_at?: string | null
          date_creation?: string | null
          date_intervention?: string | null
          date_rapport?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          demandeur_email?: string | null
          demandeur_messages?: Json | null
          demandeur_nom?: string | null
          demandeur_role?: string | null
          description?: string | null
          duree_intervention?: string | null
          est_partie_commune?: boolean | null
          etage?: string | null
          id?: string
          immeuble?: string | null
          locataire?: string | null
          materiaux_utilises?: string | null
          montant_devis?: number | null
          montant_facture?: number | null
          num_lot?: string | null
          priorite?: string | null
          problemes_constates?: string | null
          rapport_artisan?: string | null
          recommandations?: string | null
          signalement_id?: string | null
          statut?: string | null
          telephone_locataire?: string | null
          travail_effectue?: string | null
          type?: string | null
          updated_at?: string | null
          zone_signalee?: string | null
        }
        Update: {
          acces_logement?: string | null
          artisan?: string | null
          artisan_id?: string | null
          batiment?: string | null
          cabinet_id?: string
          canal_messages?: Json | null
          created_at?: string | null
          date_creation?: string | null
          date_intervention?: string | null
          date_rapport?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          demandeur_email?: string | null
          demandeur_messages?: Json | null
          demandeur_nom?: string | null
          demandeur_role?: string | null
          description?: string | null
          duree_intervention?: string | null
          est_partie_commune?: boolean | null
          etage?: string | null
          id?: string
          immeuble?: string | null
          locataire?: string | null
          materiaux_utilises?: string | null
          montant_devis?: number | null
          montant_facture?: number | null
          num_lot?: string | null
          priorite?: string | null
          problemes_constates?: string | null
          rapport_artisan?: string | null
          recommandations?: string | null
          signalement_id?: string | null
          statut?: string | null
          telephone_locataire?: string | null
          travail_effectue?: string | null
          type?: string | null
          updated_at?: string | null
          zone_signalee?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_syndic_missions_cabinet"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "syndic_cabinets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syndic_missions_signalement_id_fkey"
            columns: ["signalement_id"]
            isOneToOne: false
            referencedRelation: "syndic_signalements"
            referencedColumns: ["id"]
          },
        ]
      }
      syndic_notifications: {
        Row: {
          body: string | null
          created_at: string | null
          data_json: Json | null
          id: string
          read: boolean | null
          syndic_id: string
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          data_json?: Json | null
          id?: string
          read?: boolean | null
          syndic_id: string
          title: string
          type?: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          data_json?: Json | null
          id?: string
          read?: boolean | null
          syndic_id?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      syndic_nps: {
        Row: {
          cabinet_id: string
          comentario: string
          condomino: string
          created_at: string
          id: string
          intervencao: string
          nota: number
          prestador: string
          tipo: string
        }
        Insert: {
          cabinet_id: string
          comentario?: string
          condomino?: string
          created_at?: string
          id?: string
          intervencao?: string
          nota?: number
          prestador?: string
          tipo?: string
        }
        Update: {
          cabinet_id?: string
          comentario?: string
          condomino?: string
          created_at?: string
          id?: string
          intervencao?: string
          nota?: number
          prestador?: string
          tipo?: string
        }
        Relationships: []
      }
      syndic_oauth_tokens: {
        Row: {
          access_token: string | null
          access_token_enc: string | null
          access_token_encrypted: string | null
          created_at: string | null
          email: string | null
          encryption_version: number
          expires_at: string | null
          id: string
          oauth_nonce: string | null
          oauth_nonce_expires_at: string | null
          provider: string
          refresh_token: string | null
          refresh_token_enc: string | null
          refresh_token_encrypted: string | null
          syndic_id: string
          updated_at: string | null
        }
        Insert: {
          access_token?: string | null
          access_token_enc?: string | null
          access_token_encrypted?: string | null
          created_at?: string | null
          email?: string | null
          encryption_version?: number
          expires_at?: string | null
          id?: string
          oauth_nonce?: string | null
          oauth_nonce_expires_at?: string | null
          provider?: string
          refresh_token?: string | null
          refresh_token_enc?: string | null
          refresh_token_encrypted?: string | null
          syndic_id: string
          updated_at?: string | null
        }
        Update: {
          access_token?: string | null
          access_token_enc?: string | null
          access_token_encrypted?: string | null
          created_at?: string | null
          email?: string | null
          encryption_version?: number
          expires_at?: string | null
          id?: string
          oauth_nonce?: string | null
          oauth_nonce_expires_at?: string | null
          provider?: string
          refresh_token?: string | null
          refresh_token_enc?: string | null
          refresh_token_encrypted?: string | null
          syndic_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      syndic_obras: {
        Row: {
          cabinet_id: string
          created_at: string
          descricao: string
          empresa: string
          estado: string
          id: string
          local: string
          num_orcamentos: number
          orcamento: number
          prazo: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          cabinet_id: string
          created_at?: string
          descricao?: string
          empresa?: string
          estado?: string
          id?: string
          local?: string
          num_orcamentos?: number
          orcamento?: number
          prazo?: string | null
          tipo?: string
          titulo?: string
        }
        Update: {
          cabinet_id?: string
          created_at?: string
          descricao?: string
          empresa?: string
          estado?: string
          id?: string
          local?: string
          num_orcamentos?: number
          orcamento?: number
          prazo?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      syndic_obrigacoes: {
        Row: {
          cabinet_id: string
          concluido: boolean
          created_at: string
          descricao: string
          edificio: string
          id: string
          prazo: string | null
          tipo: string
        }
        Insert: {
          cabinet_id: string
          concluido?: boolean
          created_at?: string
          descricao?: string
          edificio?: string
          id?: string
          prazo?: string | null
          tipo?: string
        }
        Update: {
          cabinet_id?: string
          concluido?: boolean
          created_at?: string
          descricao?: string
          edificio?: string
          id?: string
          prazo?: string | null
          tipo?: string
        }
        Relationships: []
      }
      syndic_orcamentos: {
        Row: {
          cabinet_id: string
          created_at: string
          empresa: string
          id: string
          notas: string | null
          obra_id: string
          prazo_dias: number | null
          recomendado: boolean
          validade: string | null
          valor: number
        }
        Insert: {
          cabinet_id: string
          created_at?: string
          empresa?: string
          id?: string
          notas?: string | null
          obra_id: string
          prazo_dias?: number | null
          recomendado?: boolean
          validade?: string | null
          valor?: number
        }
        Update: {
          cabinet_id?: string
          created_at?: string
          empresa?: string
          id?: string
          notas?: string | null
          obra_id?: string
          prazo_dias?: number | null
          recomendado?: boolean
          validade?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "syndic_orcamentos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "syndic_obras"
            referencedColumns: ["id"]
          },
        ]
      }
      syndic_planning_events: {
        Row: {
          assigne_a: string | null
          assigne_role: string | null
          cabinet_id: string
          created_at: string | null
          cree_par: string | null
          date: string
          description: string | null
          duree_min: number | null
          heure: string | null
          id: string
          statut: string | null
          titre: string
          type: string | null
        }
        Insert: {
          assigne_a?: string | null
          assigne_role?: string | null
          cabinet_id: string
          created_at?: string | null
          cree_par?: string | null
          date: string
          description?: string | null
          duree_min?: number | null
          heure?: string | null
          id?: string
          statut?: string | null
          titre: string
          type?: string | null
        }
        Update: {
          assigne_a?: string | null
          assigne_role?: string | null
          cabinet_id?: string
          created_at?: string | null
          cree_par?: string | null
          date?: string
          description?: string | null
          duree_min?: number | null
          heure?: string | null
          id?: string
          statut?: string | null
          titre?: string
          type?: string | null
        }
        Relationships: []
      }
      syndic_planos_man: {
        Row: {
          ano_inicio: number | null
          cabinet_id: string
          created_at: string
          descricao: string
          edificio: string
          estado: string
          id: string
          orcamento: number
          periodicidade: string
          titulo: string
        }
        Insert: {
          ano_inicio?: number | null
          cabinet_id: string
          created_at?: string
          descricao?: string
          edificio?: string
          estado?: string
          id?: string
          orcamento?: number
          periodicidade?: string
          titulo?: string
        }
        Update: {
          ano_inicio?: number | null
          cabinet_id?: string
          created_at?: string
          descricao?: string
          edificio?: string
          estado?: string
          id?: string
          orcamento?: number
          periodicidade?: string
          titulo?: string
        }
        Relationships: []
      }
      syndic_prazos_legais: {
        Row: {
          cabinet_id: string
          created_at: string
          data_limite: string | null
          id: string
          immeuble: string
          notes: string
          statut: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          cabinet_id: string
          created_at?: string
          data_limite?: string | null
          id?: string
          immeuble?: string
          notes?: string
          statut?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Update: {
          cabinet_id?: string
          created_at?: string
          data_limite?: string | null
          id?: string
          immeuble?: string
          notes?: string
          statut?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      syndic_processos_jud: {
        Row: {
          cabinet_id: string
          contraparte: string
          created_at: string
          data: string | null
          descricao: string
          estado: string
          id: string
          prazo: string | null
          processo: string
          tipo: string
          valor: number
        }
        Insert: {
          cabinet_id: string
          contraparte?: string
          created_at?: string
          data?: string | null
          descricao?: string
          estado?: string
          id?: string
          prazo?: string | null
          processo?: string
          tipo?: string
          valor?: number
        }
        Update: {
          cabinet_id?: string
          contraparte?: string
          created_at?: string
          data?: string | null
          descricao?: string
          estado?: string
          id?: string
          prazo?: string | null
          processo?: string
          tipo?: string
          valor?: number
        }
        Relationships: []
      }
      syndic_procuracoes: {
        Row: {
          ag_ref: string
          cabinet_id: string
          condomino: string
          created_at: string
          data_validade: string | null
          fracao: string
          id: string
          immeuble: string
          notes: string
          procurador: string
          statut: string
          updated_at: string
        }
        Insert: {
          ag_ref?: string
          cabinet_id: string
          condomino?: string
          created_at?: string
          data_validade?: string | null
          fracao?: string
          id?: string
          immeuble?: string
          notes?: string
          procurador?: string
          statut?: string
          updated_at?: string
        }
        Update: {
          ag_ref?: string
          cabinet_id?: string
          condomino?: string
          created_at?: string
          data_validade?: string | null
          fracao?: string
          id?: string
          immeuble?: string
          notes?: string
          procurador?: string
          statut?: string
          updated_at?: string
        }
        Relationships: []
      }
      syndic_recouvrement: {
        Row: {
          avocat_huissier: string | null
          cabinet_id: string
          coproprio_id: string | null
          created_at: string
          date_cloture: string | null
          date_ouverture: string
          id: string
          immeuble_id: string | null
          impaye_id: string | null
          montant_initial: number
          montant_recouvre: number
          notes: string | null
          procedure: string
          prochaine_echeance: string | null
          statut: string
        }
        Insert: {
          avocat_huissier?: string | null
          cabinet_id: string
          coproprio_id?: string | null
          created_at?: string
          date_cloture?: string | null
          date_ouverture: string
          id?: string
          immeuble_id?: string | null
          impaye_id?: string | null
          montant_initial: number
          montant_recouvre?: number
          notes?: string | null
          procedure: string
          prochaine_echeance?: string | null
          statut?: string
        }
        Update: {
          avocat_huissier?: string | null
          cabinet_id?: string
          coproprio_id?: string | null
          created_at?: string
          date_cloture?: string | null
          date_ouverture?: string
          id?: string
          immeuble_id?: string | null
          impaye_id?: string | null
          montant_initial?: number
          montant_recouvre?: number
          notes?: string | null
          procedure?: string
          prochaine_echeance?: string | null
          statut?: string
        }
        Relationships: [
          {
            foreignKeyName: "syndic_recouvrement_coproprio_id_fkey"
            columns: ["coproprio_id"]
            isOneToOne: false
            referencedRelation: "syndic_coproprios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syndic_recouvrement_immeuble_id_fkey"
            columns: ["immeuble_id"]
            isOneToOne: false
            referencedRelation: "syndic_immeubles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syndic_recouvrement_impaye_id_fkey"
            columns: ["impaye_id"]
            isOneToOne: false
            referencedRelation: "syndic_impayes"
            referencedColumns: ["id"]
          },
        ]
      }
      syndic_reembolsos: {
        Row: {
          antigo_proprietario: string
          cabinet_id: string
          created_at: string
          data_venda: string | null
          fracao: string
          id: string
          immeuble: string
          metodo: string
          montante_reembolso: number
          notes: string
          quotas_pagas: number
          statut: string
          updated_at: string
        }
        Insert: {
          antigo_proprietario?: string
          cabinet_id: string
          created_at?: string
          data_venda?: string | null
          fracao?: string
          id?: string
          immeuble?: string
          metodo?: string
          montante_reembolso?: number
          notes?: string
          quotas_pagas?: number
          statut?: string
          updated_at?: string
        }
        Update: {
          antigo_proprietario?: string
          cabinet_id?: string
          created_at?: string
          data_venda?: string | null
          fracao?: string
          id?: string
          immeuble?: string
          metodo?: string
          montante_reembolso?: number
          notes?: string
          quotas_pagas?: number
          statut?: string
          updated_at?: string
        }
        Relationships: []
      }
      syndic_reservas: {
        Row: {
          cabinet_id: string
          created_at: string
          data: string | null
          espaco: string
          estado: string
          hora: string
          id: string
          notes: string
          quem: string
        }
        Insert: {
          cabinet_id: string
          created_at?: string
          data?: string | null
          espaco?: string
          estado?: string
          hora?: string
          id?: string
          notes?: string
          quem?: string
        }
        Update: {
          cabinet_id?: string
          created_at?: string
          data?: string | null
          espaco?: string
          estado?: string
          hora?: string
          id?: string
          notes?: string
          quem?: string
        }
        Relationships: []
      }
      syndic_resolutions: {
        Row: {
          assemblee_id: string
          cabinet_id: string
          created_at: string
          description: string | null
          id: string
          majorite: string
          numero_ordre: number
          statut: string
          titre: string
          updated_at: string
          vote_abstention: number
          vote_contre: number
          vote_pour: number
        }
        Insert: {
          assemblee_id: string
          cabinet_id: string
          created_at?: string
          description?: string | null
          id?: string
          majorite?: string
          numero_ordre?: number
          statut?: string
          titre?: string
          updated_at?: string
          vote_abstention?: number
          vote_contre?: number
          vote_pour?: number
        }
        Update: {
          assemblee_id?: string
          cabinet_id?: string
          created_at?: string
          description?: string | null
          id?: string
          majorite?: string
          numero_ordre?: number
          statut?: string
          titre?: string
          updated_at?: string
          vote_abstention?: number
          vote_contre?: number
          vote_pour?: number
        }
        Relationships: [
          {
            foreignKeyName: "syndic_resolutions_assemblee_id_fkey"
            columns: ["assemblee_id"]
            isOneToOne: false
            referencedRelation: "syndic_assemblees"
            referencedColumns: ["id"]
          },
        ]
      }
      syndic_seg_edificio: {
        Row: {
          cabinet_id: string
          categoria: string
          created_at: string
          encarregado: string
          id: string
          immeuble: string
          notes: string
          plano_emergencia: boolean
          ultimo_exercicio: string | null
          updated_at: string
        }
        Insert: {
          cabinet_id: string
          categoria?: string
          created_at?: string
          encarregado?: string
          id?: string
          immeuble?: string
          notes?: string
          plano_emergencia?: boolean
          ultimo_exercicio?: string | null
          updated_at?: string
        }
        Update: {
          cabinet_id?: string
          categoria?: string
          created_at?: string
          encarregado?: string
          id?: string
          immeuble?: string
          notes?: string
          plano_emergencia?: boolean
          ultimo_exercicio?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      syndic_seguros: {
        Row: {
          apolice: string
          cabinet_id: string
          capital: number
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          id: string
          immeuble: string
          notes: string
          premio_anual: number
          seguradora: string
          statut: string
          tipo: string
          updated_at: string
        }
        Insert: {
          apolice?: string
          cabinet_id: string
          capital?: number
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          immeuble?: string
          notes?: string
          premio_anual?: number
          seguradora?: string
          statut?: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          apolice?: string
          cabinet_id?: string
          capital?: number
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          immeuble?: string
          notes?: string
          premio_anual?: number
          seguradora?: string
          statut?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      syndic_signalement_messages: {
        Row: {
          auteur: string
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          role: string
          signalement_id: string | null
          texte: string
        }
        Insert: {
          auteur: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          role: string
          signalement_id?: string | null
          texte: string
        }
        Update: {
          auteur?: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          role?: string
          signalement_id?: string | null
          texte?: string
        }
        Relationships: [
          {
            foreignKeyName: "syndic_signalement_messages_signalement_id_fkey"
            columns: ["signalement_id"]
            isOneToOne: false
            referencedRelation: "syndic_signalements"
            referencedColumns: ["id"]
          },
        ]
      }
      syndic_signalements: {
        Row: {
          artisan_assigne: string | null
          artisan_assigne_id: string | null
          batiment: string | null
          cabinet_id: string
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          demandeur_email: string | null
          demandeur_nom: string
          demandeur_role: string | null
          demandeur_telephone: string | null
          description: string | null
          est_partie_commune: boolean | null
          etage: string | null
          id: string
          immeuble_nom: string | null
          num_lot: string | null
          priorite: string | null
          statut: string | null
          type_intervention: string
          updated_at: string | null
          zone_signalee: string | null
        }
        Insert: {
          artisan_assigne?: string | null
          artisan_assigne_id?: string | null
          batiment?: string | null
          cabinet_id: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          demandeur_email?: string | null
          demandeur_nom?: string
          demandeur_role?: string | null
          demandeur_telephone?: string | null
          description?: string | null
          est_partie_commune?: boolean | null
          etage?: string | null
          id?: string
          immeuble_nom?: string | null
          num_lot?: string | null
          priorite?: string | null
          statut?: string | null
          type_intervention?: string
          updated_at?: string | null
          zone_signalee?: string | null
        }
        Update: {
          artisan_assigne?: string | null
          artisan_assigne_id?: string | null
          batiment?: string | null
          cabinet_id?: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          demandeur_email?: string | null
          demandeur_nom?: string
          demandeur_role?: string | null
          demandeur_telephone?: string | null
          description?: string | null
          est_partie_commune?: boolean | null
          etage?: string | null
          id?: string
          immeuble_nom?: string | null
          num_lot?: string | null
          priorite?: string | null
          statut?: string | null
          type_intervention?: string
          updated_at?: string | null
          zone_signalee?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_syndic_signalements_cabinet"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "syndic_cabinets"
            referencedColumns: ["id"]
          },
        ]
      }
      syndic_sinistros: {
        Row: {
          cabinet_id: string
          created_at: string
          data_declaracao: string | null
          descricao: string
          id: string
          immeuble: string
          indemnizacao: number
          montante_estimado: number
          notes: string
          seguradora: string
          statut: string
          tipo: string
          updated_at: string
          urgente: boolean
        }
        Insert: {
          cabinet_id: string
          created_at?: string
          data_declaracao?: string | null
          descricao?: string
          id?: string
          immeuble?: string
          indemnizacao?: number
          montante_estimado?: number
          notes?: string
          seguradora?: string
          statut?: string
          tipo?: string
          updated_at?: string
          urgente?: boolean
        }
        Update: {
          cabinet_id?: string
          created_at?: string
          data_declaracao?: string | null
          descricao?: string
          id?: string
          immeuble?: string
          indemnizacao?: number
          montante_estimado?: number
          notes?: string
          seguradora?: string
          statut?: string
          tipo?: string
          updated_at?: string
          urgente?: boolean
        }
        Relationships: []
      }
      syndic_team_members: {
        Row: {
          accepted_at: string | null
          cabinet_id: string
          created_at: string
          custom_modules: string[] | null
          email: string
          full_name: string
          id: string
          invite_sent_at: string | null
          invite_token: string | null
          is_active: boolean
          phone: string | null
          role: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          cabinet_id: string
          created_at?: string
          custom_modules?: string[] | null
          email: string
          full_name?: string
          id?: string
          invite_sent_at?: string | null
          invite_token?: string | null
          is_active?: boolean
          phone?: string | null
          role: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          cabinet_id?: string
          created_at?: string
          custom_modules?: string[] | null
          email?: string
          full_name?: string
          id?: string
          invite_sent_at?: string | null
          invite_token?: string | null
          is_active?: boolean
          phone?: string | null
          role?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      syndic_vistorias: {
        Row: {
          cabinet_id: string
          created_at: string
          data_vistoria: string | null
          id: string
          immeuble: string
          notes: string
          pontos_deficientes: number
          pontos_vigiar: number
          statut: string
          titulo: string
          updated_at: string
        }
        Insert: {
          cabinet_id: string
          created_at?: string
          data_vistoria?: string | null
          id?: string
          immeuble?: string
          notes?: string
          pontos_deficientes?: number
          pontos_vigiar?: number
          statut?: string
          titulo?: string
          updated_at?: string
        }
        Update: {
          cabinet_id?: string
          created_at?: string
          data_vistoria?: string | null
          id?: string
          immeuble?: string
          notes?: string
          pontos_deficientes?: number
          pontos_vigiar?: number
          statut?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      syndic_votacoes: {
        Row: {
          artigo: string
          cabinet_id: string
          created_at: string
          descricao: string
          edificio: string
          estado: string
          id: string
          maioria: string
          options: Json
          perm_total: number
          prazo: string | null
          titulo: string
        }
        Insert: {
          artigo?: string
          cabinet_id: string
          created_at?: string
          descricao?: string
          edificio?: string
          estado?: string
          id?: string
          maioria?: string
          options?: Json
          perm_total?: number
          prazo?: string | null
          titulo?: string
        }
        Update: {
          artigo?: string
          cabinet_id?: string
          created_at?: string
          descricao?: string
          edificio?: string
          estado?: string
          id?: string
          maioria?: string
          options?: Json
          perm_total?: number
          prazo?: string | null
          titulo?: string
        }
        Relationships: []
      }
      syndic_votes_correspondance: {
        Row: {
          cabinet_id: string
          copropriétaire: string
          coproprio_id: string | null
          created_at: string
          date_reception: string
          id: string
          resolution_id: string
          tantiemes: number
          vote: string
        }
        Insert: {
          cabinet_id: string
          copropriétaire?: string
          coproprio_id?: string | null
          created_at?: string
          date_reception?: string
          id?: string
          resolution_id: string
          tantiemes?: number
          vote: string
        }
        Update: {
          cabinet_id?: string
          copropriétaire?: string
          coproprio_id?: string | null
          created_at?: string
          date_reception?: string
          id?: string
          resolution_id?: string
          tantiemes?: number
          vote?: string
        }
        Relationships: [
          {
            foreignKeyName: "syndic_votes_correspondance_coproprio_id_fkey"
            columns: ["coproprio_id"]
            isOneToOne: false
            referencedRelation: "syndic_coproprios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syndic_votes_correspondance_resolution_id_fkey"
            columns: ["resolution_id"]
            isOneToOne: false
            referencedRelation: "syndic_resolutions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_storage: {
        Row: {
          key: string
          updated_at: string
          user_id: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          user_id: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          user_id?: string
          value?: Json
        }
        Relationships: []
      }
    }
    Views: {
      syndic_email_daily_report: {
        Row: {
          date: string | null
          missions_crees: number | null
          non_traites: number | null
          repondus: number | null
          syndic_id: string | null
          total: number | null
          traites: number | null
          urgences_basses: number | null
          urgences_hautes: number | null
          urgences_moyennes: number | null
        }
        Relationships: []
      }
      v_devis_chain_check: {
        Row: {
          artisan_user_id: string | null
          chain_status: string | null
          content_hash: string | null
          expected_previous_hash: string | null
          id: string | null
          numero: string | null
          previous_hash: string | null
          signed_at: string | null
        }
        Relationships: []
      }
      v_documents_retention_status: {
        Row: {
          anonymized_count: number | null
          legal_hold_count: number | null
          over_10y_not_anonymized: number | null
          table_name: string | null
          total_count: number | null
        }
        Relationships: []
      }
      v_factures_chain_check: {
        Row: {
          artisan_user_id: string | null
          chain_status: string | null
          content_hash: string | null
          expected_previous_hash: string | null
          id: string | null
          numero: string | null
          previous_hash: string | null
          signed_at: string | null
        }
        Relationships: []
      }
      v_rentabilite_chantier: {
        Row: {
          acompte_recu: number | null
          benefice_net: number | null
          benefice_par_homme_jour: number | null
          budget: number | null
          ca_reel: number | null
          chantier_id: string | null
          client: string | null
          cout_charges_patronales: number | null
          cout_indemnites: number | null
          cout_main_oeuvre_brut: number | null
          cout_main_oeuvre_total: number | null
          cout_total: number | null
          date_debut: string | null
          date_fin: string | null
          detail_ouvriers: Json | null
          jours_prevu: number | null
          marge_prevue_pct: number | null
          montant_devis_ht_lie: number | null
          montant_facture: number | null
          montant_facture_ht_lie: number | null
          nb_devis_lies: number | null
          nb_factures_liees: number | null
          nb_jours_pointes: number | null
          nb_ouvriers: number | null
          owner_id: string | null
          penalite_retard_jour: number | null
          perte_par_jour_retard: number | null
          statut: string | null
          titre: string | null
          total_autres: number | null
          total_depenses: number | null
          total_frais_annexes_devis: number | null
          total_frais_annexes_factures: number | null
          total_heures: number | null
          total_materiaux: number | null
          tva_taux: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      anonymize_old_devis: { Args: never; Returns: number }
      anonymize_old_factures: { Args: never; Returns: number }
      calc_total_ht_cents_from_raw_data: {
        Args: { raw: Json }
        Returns: number
      }
      decrypt_token: {
        Args: { encrypted: string; encryption_key: string }
        Returns: string
      }
      delete_user_data: { Args: { p_user_id: string }; Returns: Json }
      encrypt_token: {
        Args: { encryption_key: string; token: string }
        Returns: string
      }
      export_user_data: { Args: { p_user_id: string }; Returns: Json }
      get_decrypted_oauth_token: {
        Args: { p_syndic_id: string }
        Returns: {
          access_token: string
          expires_at: string
          refresh_token: string
        }[]
      }
      haversine_distance: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
      increment_listing_vues: {
        Args: { listing_id: string }
        Returns: undefined
      }
      next_doc_number: {
        Args: { p_artisan_user_id: string; p_doc_type: string; p_year?: number }
        Returns: string
      }
      pt_fiscal_next_seq: { Args: { p_series_id: string }; Returns: number }
      pt_fiscal_previous_hash: {
        Args: { p_series_id: string }
        Returns: string
      }
      search_legal_corpus_hybrid_fr: {
        Args: {
          match_count?: number
          query_embedding: string
          query_text: string
        }
        Returns: {
          article: string
          bm25_score: number
          content: string
          id: string
          parent_path: string
          rrf_score: number
          source: string
          theme: string
          title: string
          vector_score: number
        }[]
      }
      search_legal_corpus_hybrid_pt: {
        Args: {
          match_count?: number
          query_embedding: string
          query_text: string
        }
        Returns: {
          article: string
          bm25_score: number
          content: string
          id: string
          parent_path: string
          rrf_score: number
          source: string
          theme: string
          title: string
          vector_score: number
        }[]
      }
      set_encrypted_oauth_token: {
        Args: {
          p_access_token: string
          p_encryption_version?: number
          p_expires_at: string
          p_refresh_token: string
          p_syndic_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

