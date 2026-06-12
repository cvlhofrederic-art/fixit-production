// ─────────────────────────────────────────────────────────────────────────────
// Couche CANONIQUE des types Database — lib/database-types.ts (TIRET)
//
// Pourquoi ce fichier : lib/database.types.ts (POINT) est généré depuis le
// schéma LIVE de prod (2026-06-12). Or le code requête des tables/RPC qui
// n'existent pas ENCORE en live — elles seront créées par le lot de migrations
// 20260612 (supabase/migrations/, cf. REPAIR-RUNBOOK.md) :
//   - rfqs, rfq_items, offers, offer_items, suppliers, analytics_events
//     (20260612000005_tables_droppees_restaurees.sql)
//   - factures_recues (084_factures_recues_pa.sql)
//   - syndic_eventos (20260605000002_syndic_v54_eventos.sql)
//   - syndic_documents (20260521000002_lea_documents.sql)
//   - syndic_pdf_templates, syndic_pdf_generated (20260521000004_lea_pdf_templates.sql)
//   - RPC search_syndic_documents_hybrid (20260521000003_lea_documents_hybrid_search.sql)
//
// Ce fichier fusionne les types générés avec ces définitions « pending »,
// dérivées à la main du SQL des migrations (mêmes conventions que le
// générateur Supabase : uuid/text/date/timestamptz → string, numeric/int/
// bigint → number, jsonb → Json, vector → string, colonne GENERATED → never
// en Insert/Update, FK vers auth.users non listées dans Relationships).
//
// RÈGLE D'IMPORT : tout le code importe `Database` d'ICI, jamais de
// './database.types' directement.
//
// ⚠️ APRÈS application du lot DB (supabase db push) et régénération de
// database.types.ts (`supabase gen types typescript --linked`), VIDER
// PendingTables / PendingFunctions / PendingEnums (les ramener à
// `{ [_ in never]: never }` ou supprimer la fusion) — sinon ces définitions
// manuelles masqueraient le schéma réellement généré.
//
// NB : les helpers génériques ré-exportés (Tables<>, TablesInsert<>, Enums<>…)
// restent liés au schéma LIVE uniquement. Pour une table pending, utiliser
// Database['public']['Tables']['rfqs']['Row'] (etc.) jusqu'à la régénération.
// ─────────────────────────────────────────────────────────────────────────────

import type { Database as GeneratedDatabase, Json } from "./database.types"

export * from "./database.types"

// ── Enums pending (créés par les migrations 20260521) ───────────────────────
type PendingEnums = {
  syndic_document_type:
    | "facture_artisan"
    | "facture_syndic"
    | "devis"
    | "contrat"
    | "rib"
    | "ata_ag"
    | "releve_bancaire"
    | "pv_assemblee"
    | "autre"
  syndic_document_status: "pending" | "processing" | "processed" | "error"
  syndic_pdf_template_type:
    | "chamada_quotas"
    | "lettre_relance_impaye"
    | "ata_ag"
    | "pv_assemblee"
    | "convocation_ag"
    | "avis_passage"
    | "autre"
}

// ── Tables pending (à vider après régénération, cf. en-tête) ────────────────
type PendingTables = {
  analytics_events: {
    Row: {
      created_at: string
      event_type: string
      id: string
      page_url: string | null
      properties: Json | null
      session_id: string
      user_agent: string | null
      user_id: string | null
    }
    Insert: {
      created_at?: string
      event_type: string
      id?: string
      page_url?: string | null
      properties?: Json | null
      session_id: string
      user_agent?: string | null
      user_id?: string | null
    }
    Update: {
      created_at?: string
      event_type?: string
      id?: string
      page_url?: string | null
      properties?: Json | null
      session_id?: string
      user_agent?: string | null
      user_id?: string | null
    }
    Relationships: []
  }
  factures_recues: {
    Row: {
      artisan_notes: string | null
      artisan_user_id: string
      currency: string
      date_echeance: string | null
      date_emission: string
      emetteur_email: string | null
      emetteur_name: string
      emetteur_siret: string
      format: string
      id: string
      numero: string
      pa_message_id: string
      paid_at: string | null
      pdf_url: string | null
      raw_xml: string | null
      received_at: string
      source_pa: string
      status: string
      total_ht_cents: number
      total_ttc_cents: number
      total_tva_cents: number
      validated_at: string | null
    }
    Insert: {
      artisan_notes?: string | null
      artisan_user_id: string
      currency?: string
      date_echeance?: string | null
      date_emission: string
      emetteur_email?: string | null
      emetteur_name: string
      emetteur_siret: string
      format: string
      id?: string
      numero: string
      pa_message_id: string
      paid_at?: string | null
      pdf_url?: string | null
      raw_xml?: string | null
      received_at?: string
      source_pa: string
      status?: string
      total_ht_cents?: number
      total_ttc_cents?: number
      total_tva_cents?: number
      validated_at?: string | null
    }
    Update: {
      artisan_notes?: string | null
      artisan_user_id?: string
      currency?: string
      date_echeance?: string | null
      date_emission?: string
      emetteur_email?: string | null
      emetteur_name?: string
      emetteur_siret?: string
      format?: string
      id?: string
      numero?: string
      pa_message_id?: string
      paid_at?: string | null
      pdf_url?: string | null
      raw_xml?: string | null
      received_at?: string
      source_pa?: string
      status?: string
      total_ht_cents?: number
      total_ttc_cents?: number
      total_tva_cents?: number
      validated_at?: string | null
    }
    Relationships: []
  }
  offer_items: {
    Row: {
      created_at: string | null
      id: string
      offer_id: string
      product_name: string
      quantity: number
      rfq_item_id: string | null
      total_price: number | null
      unit_price: number
    }
    Insert: {
      created_at?: string | null
      id?: string
      offer_id: string
      product_name: string
      quantity: number
      rfq_item_id?: string | null
      total_price?: never
      unit_price: number
    }
    Update: {
      created_at?: string | null
      id?: string
      offer_id?: string
      product_name?: string
      quantity?: number
      rfq_item_id?: string | null
      total_price?: never
      unit_price?: number
    }
    Relationships: [
      {
        foreignKeyName: "fk_offer_items_rfq_item"
        columns: ["rfq_item_id"]
        isOneToOne: false
        referencedRelation: "rfq_items"
        referencedColumns: ["id"]
      },
      {
        foreignKeyName: "offer_items_offer_id_fkey"
        columns: ["offer_id"]
        isOneToOne: false
        referencedRelation: "offers"
        referencedColumns: ["id"]
      },
    ]
  }
  offers: {
    Row: {
      comment: string | null
      created_at: string | null
      delivery_days: number | null
      id: string
      rfq_id: string
      status: string
      supplier_email: string
      supplier_id: string | null
      supplier_name: string
      token: string
      total_price: number | null
    }
    Insert: {
      comment?: string | null
      created_at?: string | null
      delivery_days?: number | null
      id?: string
      rfq_id: string
      status?: string
      supplier_email: string
      supplier_id?: string | null
      supplier_name: string
      token?: string
      total_price?: number | null
    }
    Update: {
      comment?: string | null
      created_at?: string | null
      delivery_days?: number | null
      id?: string
      rfq_id?: string
      status?: string
      supplier_email?: string
      supplier_id?: string | null
      supplier_name?: string
      token?: string
      total_price?: number | null
    }
    Relationships: [
      {
        foreignKeyName: "fk_offers_supplier"
        columns: ["supplier_id"]
        isOneToOne: false
        referencedRelation: "suppliers"
        referencedColumns: ["id"]
      },
      {
        foreignKeyName: "offers_rfq_id_fkey"
        columns: ["rfq_id"]
        isOneToOne: false
        referencedRelation: "rfqs"
        referencedColumns: ["id"]
      },
    ]
  }
  rfq_items: {
    Row: {
      category: string | null
      created_at: string | null
      id: string
      notes: string | null
      product_name: string
      product_ref: string | null
      quantity: number
      rfq_id: string
      unit: string | null
    }
    Insert: {
      category?: string | null
      created_at?: string | null
      id?: string
      notes?: string | null
      product_name: string
      product_ref?: string | null
      quantity?: number
      rfq_id: string
      unit?: string | null
    }
    Update: {
      category?: string | null
      created_at?: string | null
      id?: string
      notes?: string | null
      product_name?: string
      product_ref?: string | null
      quantity?: number
      rfq_id?: string
      unit?: string | null
    }
    Relationships: [
      {
        foreignKeyName: "rfq_items_rfq_id_fkey"
        columns: ["rfq_id"]
        isOneToOne: false
        referencedRelation: "rfqs"
        referencedColumns: ["id"]
      },
    ]
  }
  rfqs: {
    Row: {
      country: string
      created_at: string | null
      id: string
      message: string | null
      status: string
      title: string
      updated_at: string | null
      user_id: string
    }
    Insert: {
      country: string
      created_at?: string | null
      id?: string
      message?: string | null
      status?: string
      title?: string
      updated_at?: string | null
      user_id: string
    }
    Update: {
      country?: string
      created_at?: string | null
      id?: string
      message?: string | null
      status?: string
      title?: string
      updated_at?: string | null
      user_id?: string
    }
    Relationships: []
  }
  suppliers: {
    Row: {
      active: boolean | null
      categories: string[] | null
      country: string
      created_at: string | null
      email: string
      id: string
      name: string
    }
    Insert: {
      active?: boolean | null
      categories?: string[] | null
      country: string
      created_at?: string | null
      email: string
      id?: string
      name: string
    }
    Update: {
      active?: boolean | null
      categories?: string[] | null
      country?: string
      created_at?: string | null
      email?: string
      id?: string
      name?: string
    }
    Relationships: []
  }
  syndic_documents: {
    Row: {
      cabinet_id: string
      embedding: string | null
      error_message: string | null
      extracted_metadata: Json | null
      extracted_text: string | null
      filename: string
      id: string
      immeuble_id: string | null
      mime_type: string
      processed_at: string | null
      size_bytes: number
      status: PendingEnums["syndic_document_status"]
      storage_path: string
      tags: string[] | null
      type: PendingEnums["syndic_document_type"]
      uploaded_at: string
      uploaded_by: string | null
    }
    Insert: {
      cabinet_id: string
      embedding?: string | null
      error_message?: string | null
      extracted_metadata?: Json | null
      extracted_text?: string | null
      filename: string
      id?: string
      immeuble_id?: string | null
      mime_type: string
      processed_at?: string | null
      size_bytes: number
      status?: PendingEnums["syndic_document_status"]
      storage_path: string
      tags?: string[] | null
      type?: PendingEnums["syndic_document_type"]
      uploaded_at?: string
      uploaded_by?: string | null
    }
    Update: {
      cabinet_id?: string
      embedding?: string | null
      error_message?: string | null
      extracted_metadata?: Json | null
      extracted_text?: string | null
      filename?: string
      id?: string
      immeuble_id?: string | null
      mime_type?: string
      processed_at?: string | null
      size_bytes?: number
      status?: PendingEnums["syndic_document_status"]
      storage_path?: string
      tags?: string[] | null
      type?: PendingEnums["syndic_document_type"]
      uploaded_at?: string
      uploaded_by?: string | null
    }
    Relationships: [
      {
        foreignKeyName: "syndic_documents_immeuble_id_fkey"
        columns: ["immeuble_id"]
        isOneToOne: false
        referencedRelation: "syndic_immeubles"
        referencedColumns: ["id"]
      },
    ]
  }
  syndic_eventos: {
    Row: {
      cabinet_id: string
      created_at: string
      dia: string
      edificio: string
      hora_fim: string
      hora_inicio: string
      id: string
      responsavel: string
      tipo: string
      titulo: string
    }
    Insert: {
      cabinet_id: string
      created_at?: string
      dia?: string
      edificio?: string
      hora_fim?: string
      hora_inicio?: string
      id?: string
      responsavel?: string
      tipo?: string
      titulo?: string
    }
    Update: {
      cabinet_id?: string
      created_at?: string
      dia?: string
      edificio?: string
      hora_fim?: string
      hora_inicio?: string
      id?: string
      responsavel?: string
      tipo?: string
      titulo?: string
    }
    Relationships: []
  }
  syndic_pdf_generated: {
    Row: {
      cabinet_id: string
      field_values: Json
      filename: string
      generated_at: string
      generated_by: string | null
      id: string
      size_bytes: number
      storage_path: string
      template_id: string | null
    }
    Insert: {
      cabinet_id: string
      field_values?: Json
      filename: string
      generated_at?: string
      generated_by?: string | null
      id?: string
      size_bytes: number
      storage_path: string
      template_id?: string | null
    }
    Update: {
      cabinet_id?: string
      field_values?: Json
      filename?: string
      generated_at?: string
      generated_by?: string | null
      id?: string
      size_bytes?: number
      storage_path?: string
      template_id?: string | null
    }
    Relationships: [
      {
        foreignKeyName: "syndic_pdf_generated_template_id_fkey"
        columns: ["template_id"]
        isOneToOne: false
        referencedRelation: "syndic_pdf_templates"
        referencedColumns: ["id"]
      },
    ]
  }
  syndic_pdf_templates: {
    Row: {
      cabinet_id: string
      created_at: string
      created_by: string | null
      description: string | null
      id: string
      is_active: boolean
      locale: string
      name: string
      placeholders: Json
      storage_path: string
      type: PendingEnums["syndic_pdf_template_type"]
      updated_at: string
    }
    Insert: {
      cabinet_id: string
      created_at?: string
      created_by?: string | null
      description?: string | null
      id?: string
      is_active?: boolean
      locale?: string
      name: string
      placeholders?: Json
      storage_path: string
      type?: PendingEnums["syndic_pdf_template_type"]
      updated_at?: string
    }
    Update: {
      cabinet_id?: string
      created_at?: string
      created_by?: string | null
      description?: string | null
      id?: string
      is_active?: boolean
      locale?: string
      name?: string
      placeholders?: Json
      storage_path?: string
      type?: PendingEnums["syndic_pdf_template_type"]
      updated_at?: string
    }
    Relationships: []
  }
}

// ── RPC pending (à vider après régénération, cf. en-tête) ───────────────────
// Signature SQL : search_syndic_documents_hybrid(p_cabinet_id uuid, query_text
// text, query_embedding vector(1024), query_locale text DEFAULT 'french',
// filter_type syndic_document_type DEFAULT NULL, filter_immeuble_id uuid
// DEFAULT NULL, match_count integer DEFAULT 5) RETURNS TABLE(…).
// Les deux filtres DEFAULT NULL acceptent explicitement null (le call site
// lib/syndic/lea-documents-search.ts passe `?? null`).
type PendingFunctions = {
  search_syndic_documents_hybrid: {
    Args: {
      filter_immeuble_id?: string | null
      filter_type?: PendingEnums["syndic_document_type"] | null
      match_count?: number
      p_cabinet_id: string
      query_embedding: string
      query_locale?: string
      query_text: string
    }
    Returns: {
      bm25_score: number
      extracted_metadata: Json
      filename: string
      id: string
      immeuble_id: string
      rrf_score: number
      snippet: string
      status: PendingEnums["syndic_document_status"]
      type: PendingEnums["syndic_document_type"]
      uploaded_at: string
      vector_score: number
    }[]
  }
}

// ── Database fusionné : schéma live + objets pending du lot 20260612 ────────
// Merge APLATI (mapped type) plutôt qu'intersection `&` : l'intersection
// approfondit l'instanciation des génériques supabase-js et déclenche TS2589
// (« excessively deep ») sur les call sites à nom de table dynamique
// (ex. lib/syndic/v54/crud-route.ts). Le mapped type produit un objet plat.
type Merge<A, B> = {
  [K in keyof A | keyof B]: K extends keyof B ? B[K] : K extends keyof A ? A[K] : never
}

// Shadow volontaire du `Database` ré-exporté plus haut : la déclaration locale
// prime sur l'export étoile (sémantique ES modules).
export type Database = {
  __InternalSupabase: GeneratedDatabase["__InternalSupabase"]
  public: {
    Tables: Merge<GeneratedDatabase["public"]["Tables"], PendingTables>
    Views: GeneratedDatabase["public"]["Views"]
    Functions: Merge<GeneratedDatabase["public"]["Functions"], PendingFunctions>
    Enums: Merge<GeneratedDatabase["public"]["Enums"], PendingEnums>
    CompositeTypes: GeneratedDatabase["public"]["CompositeTypes"]
  }
}
