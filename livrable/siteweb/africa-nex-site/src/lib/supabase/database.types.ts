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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_profile_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: number
          payload: Json | null
        }
        Insert: {
          action: string
          actor_profile_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: never
          payload?: Json | null
        }
        Update: {
          action?: string
          actor_profile_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: never
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          brand_color: string | null
          brand_initials: string | null
          city: string | null
          claim_status: string
          company_name: string
          country: string
          cover_url: string | null
          created_at: string
          created_by_admin: boolean
          description_ar: string | null
          description_en: string | null
          description_fr: string | null
          export_ports: string | null
          founded_year: number | null
          headcount: string | null
          id: string
          kind: string
          legacy_id: string | null
          legal_form: string | null
          logo_url: string | null
          monthly_capacity: number | null
          monthly_capacity_unit: string | null
          owner_profile_id: string | null
          sector: string | null
          slug: string
          status: string
          subscription_currency: string
          subscription_status: string
          subscription_tier: string
          trial_ends_at: string | null
          updated_at: string
          verified: boolean
          visibility: string
          website: string | null
          wilaya: string | null
        }
        Insert: {
          brand_color?: string | null
          brand_initials?: string | null
          city?: string | null
          claim_status?: string
          company_name: string
          country?: string
          cover_url?: string | null
          created_at?: string
          created_by_admin?: boolean
          description_ar?: string | null
          description_en?: string | null
          description_fr?: string | null
          export_ports?: string | null
          founded_year?: number | null
          headcount?: string | null
          id?: string
          kind?: string
          legacy_id?: string | null
          legal_form?: string | null
          logo_url?: string | null
          monthly_capacity?: number | null
          monthly_capacity_unit?: string | null
          owner_profile_id?: string | null
          sector?: string | null
          slug: string
          status?: string
          subscription_currency?: string
          subscription_status?: string
          subscription_tier?: string
          trial_ends_at?: string | null
          updated_at?: string
          verified?: boolean
          visibility?: string
          website?: string | null
          wilaya?: string | null
        }
        Update: {
          brand_color?: string | null
          brand_initials?: string | null
          city?: string | null
          claim_status?: string
          company_name?: string
          country?: string
          cover_url?: string | null
          created_at?: string
          created_by_admin?: boolean
          description_ar?: string | null
          description_en?: string | null
          description_fr?: string | null
          export_ports?: string | null
          founded_year?: number | null
          headcount?: string | null
          id?: string
          kind?: string
          legacy_id?: string | null
          legal_form?: string | null
          logo_url?: string | null
          monthly_capacity?: number | null
          monthly_capacity_unit?: string | null
          owner_profile_id?: string | null
          sector?: string | null
          slug?: string
          status?: string
          subscription_currency?: string
          subscription_status?: string
          subscription_tier?: string
          trial_ends_at?: string | null
          updated_at?: string
          verified?: boolean
          visibility?: string
          website?: string | null
          wilaya?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_claims: {
        Row: {
          company_id: string
          created_at: string
          evidence_path: string | null
          id: string
          job_title: string | null
          message: string | null
          phone: string | null
          profile_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          tax_id: string | null
          work_email: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          evidence_path?: string | null
          id?: string
          job_title?: string | null
          message?: string | null
          phone?: string | null
          profile_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tax_id?: string | null
          work_email?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          evidence_path?: string | null
          id?: string
          job_title?: string | null
          message?: string | null
          phone?: string | null
          profile_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tax_id?: string | null
          work_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_claims_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "cdct_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_claims_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_claims_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "producer_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_claims_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_claims_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_documents: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_public: boolean
          kind: string
          storage_path: string
          title: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_public?: boolean
          kind: string
          storage_path: string
          title?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_public?: boolean
          kind?: string
          storage_path?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "cdct_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "producer_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          profile_id: string
          role: string
        }
        Insert: {
          company_id: string
          created_at?: string
          profile_id: string
          role?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          profile_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "cdct_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "producer_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_private: {
        Row: {
          address: string | null
          company_id: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_whatsapp: string | null
          rc_number: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          company_id: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_whatsapp?: string | null
          rc_number?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          company_id?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_whatsapp?: string | null
          rc_number?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_private_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "cdct_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_private_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_private_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "producer_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json
          body: string
          created_at: string
          dispatch_id: string | null
          id: string
          read_at: string | null
          rfq_id: string
          sender_profile_id: string
          sender_role: string
        }
        Insert: {
          attachments?: Json
          body: string
          created_at?: string
          dispatch_id?: string | null
          id?: string
          read_at?: string | null
          rfq_id: string
          sender_profile_id: string
          sender_role: string
        }
        Update: {
          attachments?: Json
          body?: string
          created_at?: string
          dispatch_id?: string | null
          id?: string
          read_at?: string | null
          rfq_id?: string
          sender_profile_id?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_dispatch_id_rfq_id_fkey"
            columns: ["dispatch_id", "rfq_id"]
            isOneToOne: false
            referencedRelation: "rfq_dispatches"
            referencedColumns: ["id", "rfq_id"]
          },
          {
            foreignKeyName: "messages_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_margins: {
        Row: {
          commission_amount: number | null
          commission_rate: number | null
          created_at: string
          freight_cost: number | null
          insurance_cost: number | null
          offer_id: string
          producer_currency: string | null
          producer_unit_price: number | null
          source_quote_id: string | null
          updated_at: string
        }
        Insert: {
          commission_amount?: number | null
          commission_rate?: number | null
          created_at?: string
          freight_cost?: number | null
          insurance_cost?: number | null
          offer_id: string
          producer_currency?: string | null
          producer_unit_price?: number | null
          source_quote_id?: string | null
          updated_at?: string
        }
        Update: {
          commission_amount?: number | null
          commission_rate?: number | null
          created_at?: string
          freight_cost?: number | null
          insurance_cost?: number | null
          offer_id?: string
          producer_currency?: string | null
          producer_unit_price?: number | null
          source_quote_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_margins_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: true
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_margins_source_quote_id_fkey"
            columns: ["source_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          cagex_insured: boolean
          certifications: string | null
          created_at: string
          created_by: string | null
          currency: string
          id: string
          incoterm: string | null
          incoterm_place: string | null
          label: string
          lead_time_days: number | null
          notes: string | null
          origin_region: string | null
          packaging: string | null
          payment_terms: string | null
          published_at: string | null
          quantity: number | null
          rfq_id: string
          status: string
          total_amount: number | null
          unit_price: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          cagex_insured?: boolean
          certifications?: string | null
          created_at?: string
          created_by?: string | null
          currency: string
          id?: string
          incoterm?: string | null
          incoterm_place?: string | null
          label?: string
          lead_time_days?: number | null
          notes?: string | null
          origin_region?: string | null
          packaging?: string | null
          payment_terms?: string | null
          published_at?: string | null
          quantity?: number | null
          rfq_id: string
          status?: string
          total_amount?: number | null
          unit_price: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          cagex_insured?: boolean
          certifications?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          incoterm?: string | null
          incoterm_place?: string | null
          label?: string
          lead_time_days?: number | null
          notes?: string | null
          origin_region?: string | null
          packaging?: string | null
          payment_terms?: string | null
          published_at?: string | null
          quantity?: number | null
          rfq_id?: string
          status?: string
          total_amount?: number | null
          unit_price?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      products: {
        Row: {
          category: string | null
          company_id: string
          container_capacity_20ft: number | null
          container_capacity_40ft: number | null
          created_at: string
          currency: string | null
          description_ar: string | null
          description_en: string | null
          description_fr: string | null
          dimensions_cm: Json | null
          hs_code: string | null
          id: string
          images: Json
          is_locked: boolean
          min_order_quantity: number | null
          packaging: string | null
          price_basis: string | null
          product_name: string
          slug: string | null
          sort_order: number
          source: string
          status: string
          stock_quantity: number | null
          stock_sync_frequency: string
          unit: string | null
          unit_price_ht: number | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          company_id: string
          container_capacity_20ft?: number | null
          container_capacity_40ft?: number | null
          created_at?: string
          currency?: string | null
          description_ar?: string | null
          description_en?: string | null
          description_fr?: string | null
          dimensions_cm?: Json | null
          hs_code?: string | null
          id?: string
          images?: Json
          is_locked?: boolean
          min_order_quantity?: number | null
          packaging?: string | null
          price_basis?: string | null
          product_name: string
          slug?: string | null
          sort_order?: number
          source?: string
          status?: string
          stock_quantity?: number | null
          stock_sync_frequency?: string
          unit?: string | null
          unit_price_ht?: number | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          company_id?: string
          container_capacity_20ft?: number | null
          container_capacity_40ft?: number | null
          created_at?: string
          currency?: string | null
          description_ar?: string | null
          description_en?: string | null
          description_fr?: string | null
          dimensions_cm?: Json | null
          hs_code?: string | null
          id?: string
          images?: Json
          is_locked?: boolean
          min_order_quantity?: number | null
          packaging?: string | null
          price_basis?: string | null
          product_name?: string
          slug?: string | null
          sort_order?: number
          source?: string
          status?: string
          stock_quantity?: number | null
          stock_sync_frequency?: string
          unit?: string | null
          unit_price_ht?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "cdct_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "producer_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_views: {
        Row: {
          company_id: string
          created_at: string
          id: number
          locale: string | null
          viewer_country: string | null
          viewer_profile_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: never
          locale?: string | null
          viewer_country?: string | null
          viewer_profile_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: never
          locale?: string | null
          viewer_country?: string | null
          viewer_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_views_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "cdct_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_views_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_views_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "producer_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_views_viewer_profile_id_fkey"
            columns: ["viewer_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          locale: string
          onboarding_completed: boolean
          phone: string | null
          role: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          locale?: string
          onboarding_completed?: boolean
          phone?: string | null
          role?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          locale?: string
          onboarding_completed?: boolean
          phone?: string | null
          role?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      quotes: {
        Row: {
          attachments: Json
          author_profile_id: string | null
          available_at_port_on: string | null
          company_id: string
          created_at: string
          currency: string
          dispatch_id: string
          id: string
          notes: string | null
          payment_terms: string | null
          port_of_loading: string | null
          price_basis: string | null
          production_lead_days: number | null
          quantity: number | null
          status: string
          unit_price_ht: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          attachments?: Json
          author_profile_id?: string | null
          available_at_port_on?: string | null
          company_id: string
          created_at?: string
          currency: string
          dispatch_id: string
          id?: string
          notes?: string | null
          payment_terms?: string | null
          port_of_loading?: string | null
          price_basis?: string | null
          production_lead_days?: number | null
          quantity?: number | null
          status?: string
          unit_price_ht: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          attachments?: Json
          author_profile_id?: string | null
          available_at_port_on?: string | null
          company_id?: string
          created_at?: string
          currency?: string
          dispatch_id?: string
          id?: string
          notes?: string | null
          payment_terms?: string | null
          port_of_loading?: string | null
          price_basis?: string | null
          production_lead_days?: number | null
          quantity?: number | null
          status?: string
          unit_price_ht?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "cdct_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "producer_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: true
            referencedRelation: "rfq_dispatches"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          author_company: string | null
          author_country: string | null
          author_name: string
          author_profile_id: string | null
          comment: string | null
          created_at: string
          id: number
          legacy_producer_id: string | null
          moderated_at: string | null
          moderated_by: string | null
          producer_company_id: string
          rating: number
          status: string
        }
        Insert: {
          author_company?: string | null
          author_country?: string | null
          author_name: string
          author_profile_id?: string | null
          comment?: string | null
          created_at?: string
          id?: number
          legacy_producer_id?: string | null
          moderated_at?: string | null
          moderated_by?: string | null
          producer_company_id: string
          rating: number
          status?: string
        }
        Update: {
          author_company?: string | null
          author_country?: string | null
          author_name?: string
          author_profile_id?: string | null
          comment?: string | null
          created_at?: string
          id?: number
          legacy_producer_id?: string | null
          moderated_at?: string | null
          moderated_by?: string | null
          producer_company_id?: string
          rating?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_moderated_by_fkey"
            columns: ["moderated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_producer_company_id_fkey"
            columns: ["producer_company_id"]
            isOneToOne: false
            referencedRelation: "cdct_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_producer_company_id_fkey"
            columns: ["producer_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_producer_company_id_fkey"
            columns: ["producer_company_id"]
            isOneToOne: false
            referencedRelation: "producer_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_dispatches: {
        Row: {
          attachments: Json
          brief_specs: string | null
          brief_title: string
          company_id: string
          created_at: string
          created_by: string | null
          destination_country: string | null
          id: string
          needed_by: string | null
          quantity: number | null
          reference: string
          requested_incoterm: string | null
          respond_by: string | null
          rfq_id: string
          status: string
          unit: string | null
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          attachments?: Json
          brief_specs?: string | null
          brief_title: string
          company_id: string
          created_at?: string
          created_by?: string | null
          destination_country?: string | null
          id?: string
          needed_by?: string | null
          quantity?: number | null
          reference?: string
          requested_incoterm?: string | null
          respond_by?: string | null
          rfq_id: string
          status?: string
          unit?: string | null
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          attachments?: Json
          brief_specs?: string | null
          brief_title?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          destination_country?: string | null
          id?: string
          needed_by?: string | null
          quantity?: number | null
          reference?: string
          requested_incoterm?: string | null
          respond_by?: string | null
          rfq_id?: string
          status?: string
          unit?: string | null
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfq_dispatches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "cdct_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_dispatches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_dispatches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "producer_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_dispatches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_dispatches_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      rfqs: {
        Row: {
          attachments: Json
          buyer_company_id: string | null
          buyer_profile_id: string
          created_at: string
          currency: string | null
          description: string | null
          destination_country: string | null
          destination_port: string | null
          id: string
          incoterm: string | null
          needed_by: string | null
          product_id: string | null
          quantity: number | null
          reference: string
          source_company_id: string | null
          status: string
          target_unit_price: number | null
          title: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          attachments?: Json
          buyer_company_id?: string | null
          buyer_profile_id: string
          created_at?: string
          currency?: string | null
          description?: string | null
          destination_country?: string | null
          destination_port?: string | null
          id?: string
          incoterm?: string | null
          needed_by?: string | null
          product_id?: string | null
          quantity?: number | null
          reference?: string
          source_company_id?: string | null
          status?: string
          target_unit_price?: number | null
          title: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          attachments?: Json
          buyer_company_id?: string | null
          buyer_profile_id?: string
          created_at?: string
          currency?: string | null
          description?: string | null
          destination_country?: string | null
          destination_port?: string | null
          id?: string
          incoterm?: string | null
          needed_by?: string | null
          product_id?: string | null
          quantity?: number | null
          reference?: string
          source_company_id?: string | null
          status?: string
          target_unit_price?: number | null
          title?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfqs_buyer_company_id_fkey"
            columns: ["buyer_company_id"]
            isOneToOne: false
            referencedRelation: "cdct_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_buyer_company_id_fkey"
            columns: ["buyer_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_buyer_company_id_fkey"
            columns: ["buyer_company_id"]
            isOneToOne: false
            referencedRelation: "producer_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_buyer_profile_id_fkey"
            columns: ["buyer_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "cdct_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_source_company_id_fkey"
            columns: ["source_company_id"]
            isOneToOne: false
            referencedRelation: "cdct_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_source_company_id_fkey"
            columns: ["source_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_source_company_id_fkey"
            columns: ["source_company_id"]
            isOneToOne: false
            referencedRelation: "producer_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          company: string | null
          consent: boolean
          country: string | null
          created_at: string
          email: string
          id: number
          message: string | null
          name: string
          phone: string | null
          whatsapp: string | null
        }
        Insert: {
          company?: string | null
          consent?: boolean
          country?: string | null
          created_at?: string
          email: string
          id?: number
          message?: string | null
          name: string
          phone?: string | null
          whatsapp?: string | null
        }
        Update: {
          company?: string | null
          consent?: boolean
          country?: string | null
          created_at?: string
          email?: string
          id?: number
          message?: string | null
          name?: string
          phone?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      cdct_products: {
        Row: {
          container_capacity_20ft: number | null
          container_capacity_40ft: number | null
          currency: string | null
          dimensions_cm: Json | null
          hs_code: string | null
          id: string | null
          is_locked: boolean | null
          product_name: string | null
          stock_quantity: number | null
          stock_sync_frequency: string | null
          unit_price_ht: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          container_capacity_20ft?: number | null
          container_capacity_40ft?: number | null
          currency?: string | null
          dimensions_cm?: Json | null
          hs_code?: string | null
          id?: string | null
          is_locked?: boolean | null
          product_name?: string | null
          stock_quantity?: number | null
          stock_sync_frequency?: string | null
          unit_price_ht?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          container_capacity_20ft?: number | null
          container_capacity_40ft?: number | null
          currency?: string | null
          dimensions_cm?: Json | null
          hs_code?: string | null
          id?: string | null
          is_locked?: boolean | null
          product_name?: string | null
          stock_quantity?: number | null
          stock_sync_frequency?: string | null
          unit_price_ht?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "cdct_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "producer_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      cdct_users: {
        Row: {
          company_name: string | null
          country: string | null
          created_at: string | null
          email: string | null
          id: string | null
          status: string | null
          subscription_tier: string | null
          tax_id: string | null
        }
        Relationships: []
      }
      producer_cards: {
        Row: {
          avg_rating: number | null
          claim_status: string | null
          color: string | null
          id: string | null
          initials: string | null
          legacy_id: string | null
          location: string | null
          logo: string | null
          name: string | null
          products: string[] | null
          review_count: number | null
          sector: string | null
          slug: string | null
          verified: boolean | null
          wilaya: string | null
        }
        Insert: {
          avg_rating?: never
          claim_status?: string | null
          color?: string | null
          id?: string | null
          initials?: string | null
          legacy_id?: string | null
          location?: string | null
          logo?: string | null
          name?: string | null
          products?: never
          review_count?: never
          sector?: string | null
          slug?: string | null
          verified?: boolean | null
          wilaya?: string | null
        }
        Update: {
          avg_rating?: never
          claim_status?: string | null
          color?: string | null
          id?: string | null
          initials?: string | null
          legacy_id?: string | null
          location?: string | null
          logo?: string | null
          name?: string | null
          products?: never
          review_count?: never
          sector?: string | null
          slug?: string | null
          verified?: boolean | null
          wilaya?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_offer: { Args: { p_offer_id: string }; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
      is_member_of: { Args: { target_company: string }; Returns: boolean }
      is_owner_of: { Args: { target_company: string }; Returns: boolean }
      is_privileged: { Args: never; Returns: boolean }
      my_role: { Args: never; Returns: string }
      try_uuid: { Args: { p: string }; Returns: string }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
