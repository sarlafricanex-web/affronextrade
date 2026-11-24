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
      account_deletion_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          processed_at: string | null
          processed_by: string | null
          profile_id: string | null
          reason: string | null
          role: string
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          profile_id?: string | null
          reason?: string | null
          role: string
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          profile_id?: string | null
          reason?: string | null
          role?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_deletion_requests_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_deletion_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      billing_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: number
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: number
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "billing_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cnrc_activities: {
        Row: {
          authority: string | null
          cnrc_sector: number
          code: string
          isic_division: string | null
          label_ar: string | null
          label_fr: string
          status: string
        }
        Insert: {
          authority?: string | null
          cnrc_sector: number
          code: string
          isic_division?: string | null
          label_ar?: string | null
          label_fr: string
          status: string
        }
        Update: {
          authority?: string | null
          cnrc_sector?: number
          code?: string
          isic_division?: string | null
          label_ar?: string | null
          label_fr?: string
          status?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          activity_code: string | null
          activity_description: string | null
          africanex_export_consent: boolean
          africanex_export_consent_at: string | null
          brand_color: string | null
          brand_initials: string | null
          buyer_type: string | null
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
          interests: string[]
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
          activity_code?: string | null
          activity_description?: string | null
          africanex_export_consent?: boolean
          africanex_export_consent_at?: string | null
          brand_color?: string | null
          brand_initials?: string | null
          buyer_type?: string | null
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
          interests?: string[]
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
          activity_code?: string | null
          activity_description?: string | null
          africanex_export_consent?: boolean
          africanex_export_consent_at?: string | null
          brand_color?: string | null
          brand_initials?: string | null
          buyer_type?: string | null
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
          interests?: string[]
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
            foreignKeyName: "companies_activity_code_fkey"
            columns: ["activity_code"]
            isOneToOne: false
            referencedRelation: "cnrc_activities"
            referencedColumns: ["code"]
          },
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
          expires_on: string | null
          file_type: string | null
          id: string
          is_public: boolean
          kind: string
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          storage_path: string
          title: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          expires_on?: string | null
          file_type?: string | null
          id?: string
          is_public?: boolean
          kind: string
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          storage_path: string
          title?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          expires_on?: string | null
          file_type?: string | null
          id?: string
          is_public?: boolean
          kind?: string
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
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
          {
            foreignKeyName: "company_documents_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          nis: string | null
          rc_number: string | null
          tax_article: string | null
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
          nis?: string | null
          rc_number?: string | null
          tax_article?: string | null
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
          nis?: string | null
          rc_number?: string | null
          tax_article?: string | null
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
      email_notifications: {
        Row: {
          created_at: string
          error: string | null
          id: number
          kind: string
          locale: string
          recipient_email: string | null
          recipient_profile_id: string | null
          rfq_id: string | null
          status: string
          subject: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: never
          kind: string
          locale?: string
          recipient_email?: string | null
          recipient_profile_id?: string | null
          rfq_id?: string | null
          status: string
          subject: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: never
          kind?: string
          locale?: string
          recipient_email?: string | null
          recipient_profile_id?: string | null
          rfq_id?: string | null
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_notifications_recipient_profile_id_fkey"
            columns: ["recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_notifications_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      features: {
        Row: {
          available: boolean
          key: string
          sort_order: number
        }
        Insert: {
          available?: boolean
          key: string
          sort_order: number
        }
        Update: {
          available?: boolean
          key?: string
          sort_order?: number
        }
        Relationships: []
      }
      fx_rates: {
        Row: {
          currency: string
          dzd_per_unit: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          currency: string
          dzd_per_unit: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          currency?: string
          dzd_per_unit?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fx_rates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      offer_line_margins: {
        Row: {
          base_amount: number
          commission_amount: number
          commission_rate: number
          company_id: string | null
          export_mode: string
          fx_margin_amount: number
          fx_margin_rate: number
          insurance_amount: number
          insurance_rate: number
          margin_amount: number
          max_discount_rate: number | null
          offer_line_id: string
          product_id: string | null
          quote_id: string | null
          supplier_currency: string
          supplier_unit_price: number
          warnings: string[]
        }
        Insert: {
          base_amount: number
          commission_amount?: number
          commission_rate?: number
          company_id?: string | null
          export_mode: string
          fx_margin_amount?: number
          fx_margin_rate?: number
          insurance_amount?: number
          insurance_rate?: number
          margin_amount?: number
          max_discount_rate?: number | null
          offer_line_id: string
          product_id?: string | null
          quote_id?: string | null
          supplier_currency: string
          supplier_unit_price: number
          warnings?: string[]
        }
        Update: {
          base_amount?: number
          commission_amount?: number
          commission_rate?: number
          company_id?: string | null
          export_mode?: string
          fx_margin_amount?: number
          fx_margin_rate?: number
          insurance_amount?: number
          insurance_rate?: number
          margin_amount?: number
          max_discount_rate?: number | null
          offer_line_id?: string
          product_id?: string | null
          quote_id?: string | null
          supplier_currency?: string
          supplier_unit_price?: number
          warnings?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "offer_line_margins_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "cdct_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_line_margins_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_line_margins_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "producer_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_line_margins_offer_line_id_fkey"
            columns: ["offer_line_id"]
            isOneToOne: true
            referencedRelation: "offer_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_line_margins_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "cdct_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_line_margins_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_line_margins_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_lines: {
        Row: {
          availability: string | null
          created_at: string
          description: string
          id: string
          incoterm: string | null
          incoterm_place: string | null
          lead_time_days: number | null
          offer_id: string
          position: number
          quantity: number
          reference: string | null
          rfq_line_id: string | null
          total_amount: number
          unit: string | null
          unit_price: number
        }
        Insert: {
          availability?: string | null
          created_at?: string
          description: string
          id?: string
          incoterm?: string | null
          incoterm_place?: string | null
          lead_time_days?: number | null
          offer_id: string
          position: number
          quantity: number
          reference?: string | null
          rfq_line_id?: string | null
          total_amount: number
          unit?: string | null
          unit_price: number
        }
        Update: {
          availability?: string | null
          created_at?: string
          description?: string
          id?: string
          incoterm?: string | null
          incoterm_place?: string | null
          lead_time_days?: number | null
          offer_id?: string
          position?: number
          quantity?: number
          reference?: string | null
          rfq_line_id?: string | null
          total_amount?: number
          unit?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "offer_lines_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_lines_rfq_line_id_fkey"
            columns: ["rfq_line_id"]
            isOneToOne: false
            referencedRelation: "rfq_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_margins: {
        Row: {
          auto: boolean
          commission_amount: number | null
          commission_rate: number | null
          created_at: string
          export_mode: string | null
          freight_cost: number | null
          freight_pending: boolean
          fx_margin_rate: number | null
          fx_rate: number | null
          insurance_cost: number | null
          insurance_rate: number | null
          margin_amount: number | null
          margin_pending: boolean
          margin_rate: number | null
          offer_id: string
          producer_currency: string | null
          producer_unit_price: number | null
          source_quote_id: string | null
          updated_at: string
        }
        Insert: {
          auto?: boolean
          commission_amount?: number | null
          commission_rate?: number | null
          created_at?: string
          export_mode?: string | null
          freight_cost?: number | null
          freight_pending?: boolean
          fx_margin_rate?: number | null
          fx_rate?: number | null
          insurance_cost?: number | null
          insurance_rate?: number | null
          margin_amount?: number | null
          margin_pending?: boolean
          margin_rate?: number | null
          offer_id: string
          producer_currency?: string | null
          producer_unit_price?: number | null
          source_quote_id?: string | null
          updated_at?: string
        }
        Update: {
          auto?: boolean
          commission_amount?: number | null
          commission_rate?: number | null
          created_at?: string
          export_mode?: string | null
          freight_cost?: number | null
          freight_pending?: boolean
          fx_margin_rate?: number | null
          fx_rate?: number | null
          insurance_cost?: number | null
          insurance_rate?: number | null
          margin_amount?: number | null
          margin_pending?: boolean
          margin_rate?: number | null
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
          currency_change_at: string | null
          currency_change_note: string | null
          currency_change_to: string | null
          decided_at: string | null
          decline_reason: string | null
          freight_amount: number | null
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
          unit_price: number | null
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          cagex_insured?: boolean
          certifications?: string | null
          created_at?: string
          created_by?: string | null
          currency: string
          currency_change_at?: string | null
          currency_change_note?: string | null
          currency_change_to?: string | null
          decided_at?: string | null
          decline_reason?: string | null
          freight_amount?: number | null
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
          unit_price?: number | null
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          cagex_insured?: boolean
          certifications?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          currency_change_at?: string | null
          currency_change_note?: string | null
          currency_change_to?: string | null
          decided_at?: string | null
          decline_reason?: string | null
          freight_amount?: number | null
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
          unit_price?: number | null
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
      plan_features: {
        Row: {
          access_level: string | null
          feature_key: string
          limit_value: number | null
          period: Database["public"]["Enums"]["quota_period"]
          plan_code: string
        }
        Insert: {
          access_level?: string | null
          feature_key: string
          limit_value?: number | null
          period?: Database["public"]["Enums"]["quota_period"]
          plan_code: string
        }
        Update: {
          access_level?: string | null
          feature_key?: string
          limit_value?: number | null
          period?: Database["public"]["Enums"]["quota_period"]
          plan_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_features_feature_key_fkey"
            columns: ["feature_key"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "plan_features_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["code"]
          },
        ]
      }
      plans: {
        Row: {
          code: string
          is_active: boolean
          monthly_price_dzd: number
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          is_active?: boolean
          monthly_price_dzd: number
          name: string
          sort_order: number
        }
        Update: {
          code?: string
          is_active?: boolean
          monthly_price_dzd?: number
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      products: {
        Row: {
          carton_gross_weight_kg: number | null
          carton_height_cm: number | null
          carton_length_cm: number | null
          carton_width_cm: number | null
          cartons_per_pallet: number | null
          category: string | null
          company_id: string
          container_capacity_20ft: number | null
          container_capacity_40ft: number | null
          container_floor_20ft: number | null
          container_floor_40ft: number | null
          created_at: string
          cross_refs: string[]
          currency: string | null
          description_ar: string | null
          description_en: string | null
          description_fr: string | null
          dimensions_cm: Json | null
          discount_tiers: Json | null
          hs_code: string | null
          id: string
          images: Json
          is_locked: boolean
          lead_time_days: number | null
          max_stack_layers: number | null
          min_order_quantity: number | null
          origin_country: string
          packaging: string | null
          packaging_cost: number | null
          packaging_spec: Json | null
          palletized: boolean
          price_basis: string | null
          price_dzd_ht: number | null
          price_place: string | null
          price_valid_until: string | null
          product_cost: number | null
          product_name: string
          quota_hidden: boolean
          sku: string | null
          slug: string | null
          sort_order: number
          source: string
          status: string
          stock_quantity: number | null
          stock_sync_frequency: string
          stock_updated_at: string | null
          storage_condition: string | null
          unit: string | null
          unit_price_ht: number | null
          units_per_carton: number | null
          updated_at: string
        }
        Insert: {
          carton_gross_weight_kg?: number | null
          carton_height_cm?: number | null
          carton_length_cm?: number | null
          carton_width_cm?: number | null
          cartons_per_pallet?: number | null
          category?: string | null
          company_id: string
          container_capacity_20ft?: number | null
          container_capacity_40ft?: number | null
          container_floor_20ft?: number | null
          container_floor_40ft?: number | null
          created_at?: string
          cross_refs?: string[]
          currency?: string | null
          description_ar?: string | null
          description_en?: string | null
          description_fr?: string | null
          dimensions_cm?: Json | null
          discount_tiers?: Json | null
          hs_code?: string | null
          id?: string
          images?: Json
          is_locked?: boolean
          lead_time_days?: number | null
          max_stack_layers?: number | null
          min_order_quantity?: number | null
          origin_country?: string
          packaging?: string | null
          packaging_cost?: number | null
          packaging_spec?: Json | null
          palletized?: boolean
          price_basis?: string | null
          price_dzd_ht?: number | null
          price_place?: string | null
          price_valid_until?: string | null
          product_cost?: number | null
          product_name: string
          quota_hidden?: boolean
          sku?: string | null
          slug?: string | null
          sort_order?: number
          source?: string
          status?: string
          stock_quantity?: number | null
          stock_sync_frequency?: string
          stock_updated_at?: string | null
          storage_condition?: string | null
          unit?: string | null
          unit_price_ht?: number | null
          units_per_carton?: number | null
          updated_at?: string
        }
        Update: {
          carton_gross_weight_kg?: number | null
          carton_height_cm?: number | null
          carton_length_cm?: number | null
          carton_width_cm?: number | null
          cartons_per_pallet?: number | null
          category?: string | null
          company_id?: string
          container_capacity_20ft?: number | null
          container_capacity_40ft?: number | null
          container_floor_20ft?: number | null
          container_floor_40ft?: number | null
          created_at?: string
          cross_refs?: string[]
          currency?: string | null
          description_ar?: string | null
          description_en?: string | null
          description_fr?: string | null
          dimensions_cm?: Json | null
          discount_tiers?: Json | null
          hs_code?: string | null
          id?: string
          images?: Json
          is_locked?: boolean
          lead_time_days?: number | null
          max_stack_layers?: number | null
          min_order_quantity?: number | null
          origin_country?: string
          packaging?: string | null
          packaging_cost?: number | null
          packaging_spec?: Json | null
          palletized?: boolean
          price_basis?: string | null
          price_dzd_ht?: number | null
          price_place?: string | null
          price_valid_until?: string | null
          product_cost?: number | null
          product_name?: string
          quota_hidden?: boolean
          sku?: string | null
          slug?: string | null
          sort_order?: number
          source?: string
          status?: string
          stock_quantity?: number | null
          stock_sync_frequency?: string
          stock_updated_at?: string | null
          storage_condition?: string | null
          unit?: string | null
          unit_price_ht?: number | null
          units_per_carton?: number | null
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
          rfq_line_id: string | null
          status: string
          unit: string | null
          updated_at: string
          viewed_at: string | null
          visible_from: string
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
          rfq_line_id?: string | null
          status?: string
          unit?: string | null
          updated_at?: string
          viewed_at?: string | null
          visible_from?: string
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
          rfq_line_id?: string | null
          status?: string
          unit?: string | null
          updated_at?: string
          viewed_at?: string | null
          visible_from?: string
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
            foreignKeyName: "rfq_dispatches_line_fkey"
            columns: ["rfq_line_id", "rfq_id"]
            isOneToOne: false
            referencedRelation: "rfq_lines"
            referencedColumns: ["id", "rfq_id"]
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
      rfq_line_choices: {
        Row: {
          chosen_at: string
          chosen_by: string | null
          quote_id: string
          rfq_line_id: string
        }
        Insert: {
          chosen_at?: string
          chosen_by?: string | null
          quote_id: string
          rfq_line_id: string
        }
        Update: {
          chosen_at?: string
          chosen_by?: string | null
          quote_id?: string
          rfq_line_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfq_line_choices_chosen_by_fkey"
            columns: ["chosen_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_line_choices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_line_choices_rfq_line_id_fkey"
            columns: ["rfq_line_id"]
            isOneToOne: true
            referencedRelation: "rfq_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_lines: {
        Row: {
          created_at: string
          description: string
          id: string
          position: number
          product_id: string | null
          quantity: number | null
          reference: string | null
          rfq_id: string
          unit: string | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          position: number
          product_id?: string | null
          quantity?: number | null
          reference?: string | null
          rfq_id: string
          unit?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          position?: number
          product_id?: string | null
          quantity?: number | null
          reference?: string | null
          rfq_id?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfq_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "cdct_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_lines_rfq_id_fkey"
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
          container_count: number | null
          container_reefer: boolean
          container_size: string | null
          created_at: string
          currency: string | null
          description: string | null
          destination_country: string | null
          destination_port: string | null
          id: string
          incoterm: string | null
          logistics: string | null
          needed_by: string | null
          product_id: string | null
          quantity: number | null
          quantity_mode: string
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
          container_count?: number | null
          container_reefer?: boolean
          container_size?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          destination_country?: string | null
          destination_port?: string | null
          id?: string
          incoterm?: string | null
          logistics?: string | null
          needed_by?: string | null
          product_id?: string | null
          quantity?: number | null
          quantity_mode?: string
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
          container_count?: number | null
          container_reefer?: boolean
          container_size?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          destination_country?: string | null
          destination_port?: string | null
          id?: string
          incoterm?: string | null
          logistics?: string | null
          needed_by?: string | null
          product_id?: string | null
          quantity?: number | null
          quantity_mode?: string
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
      subscriptions: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          company_id: string
          created_at: string
          created_by: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          is_trial: boolean
          payment_reference: string | null
          plan_code: string
          price_charged_dzd: number
          scheduled_plan_code: string | null
          status: Database["public"]["Enums"]["sub_status"]
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          company_id: string
          created_at?: string
          created_by?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          is_trial?: boolean
          payment_reference?: string | null
          plan_code: string
          price_charged_dzd: number
          scheduled_plan_code?: string | null
          status?: Database["public"]["Enums"]["sub_status"]
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          company_id?: string
          created_at?: string
          created_by?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          is_trial?: boolean
          payment_reference?: string | null
          plan_code?: string
          price_charged_dzd?: number
          scheduled_plan_code?: string | null
          status?: Database["public"]["Enums"]["sub_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_activated_by_fkey"
            columns: ["activated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "cdct_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "producer_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "subscriptions_scheduled_plan_code_fkey"
            columns: ["scheduled_plan_code"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["code"]
          },
        ]
      }
      supplier_pricing: {
        Row: {
          company_id: string
          discount_tiers: Json
          updated_at: string
        }
        Insert: {
          company_id: string
          discount_tiers?: Json
          updated_at?: string
        }
        Update: {
          company_id?: string
          discount_tiers?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_pricing_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "cdct_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_pricing_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_pricing_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "producer_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_settings: {
        Row: {
          company_id: string
          export_mode: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_id: string
          export_mode: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          export_mode?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "cdct_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "producer_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_counters: {
        Row: {
          company_id: string
          feature_key: string
          period_start: string
          used: number
        }
        Insert: {
          company_id: string
          feature_key: string
          period_start: string
          used?: number
        }
        Update: {
          company_id?: string
          feature_key?: string
          period_start?: string
          used?: number
        }
        Relationships: [
          {
            foreignKeyName: "usage_counters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "cdct_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_counters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_counters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "producer_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_counters_feature_key_fkey"
            columns: ["feature_key"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["key"]
          },
        ]
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
      activate_subscription: {
        Args: { p_payment_reference: string; p_subscription: string }
        Returns: undefined
      }
      approve_claim: { Args: { p_claim: string }; Returns: undefined }
      billing_setting: { Args: { p_key: string }; Returns: number }
      buyer_open_offer: { Args: { p_offer: string }; Returns: string }
      can_read_company_billing: {
        Args: { p_company: string }
        Returns: boolean
      }
      can_use: {
        Args: { p_company: string; p_feature: string }
        Returns: {
          access_level: string
          allowed: boolean
          available: boolean
          limit_value: number
          plan_code: string
          remaining: number
          used: number
        }[]
      }
      cancel_account_deletion: { Args: never; Returns: undefined }
      compute_price: {
        Args: {
          p_cycle: Database["public"]["Enums"]["billing_cycle"]
          p_plan: string
        }
        Returns: number
      }
      consume: {
        Args: { p_amount?: number; p_company: string; p_feature: string }
        Returns: number
      }
      current_plan: { Args: { p_company: string }; Returns: string }
      decline_offer: {
        Args: { p_offer_id: string; p_reason: string }
        Returns: undefined
      }
      enforce_product_quota: { Args: { p_company: string }; Returns: number }
      is_admin: { Args: never; Returns: boolean }
      is_member_of: { Args: { target_company: string }; Returns: boolean }
      is_owner_of: { Args: { target_company: string }; Returns: boolean }
      is_privileged: { Args: never; Returns: boolean }
      mark_messages_read: {
        Args: { p_dispatch: string; p_rfq: string }
        Returns: number
      }
      my_role: { Args: never; Returns: string }
      offer_auto_inputs: {
        Args: { p_rfq: string }
        Returns: {
          company_id: string
          company_name: string
          currency: string
          discount_tiers: Json
          export_mode: string
          lead_time_days: number
          line_description: string
          line_id: string
          line_position: number
          line_quantity: number
          line_reference: string
          line_unit: string
          min_order_quantity: number
          price_basis: string
          price_dzd_ht: number
          price_place: string
          price_valid_until: string
          product_id: string
          product_name: string
          product_status: string
          product_unit: string
          stock_quantity: number
          subscription_tier: string
          unit_price_ht: number
        }[]
      }
      offer_auto_quotes: {
        Args: { p_rfq: string }
        Returns: {
          chosen: boolean
          company_id: string
          company_name: string
          currency: string
          export_mode: string
          line_id: string
          port_of_loading: string
          price_basis: string
          production_lead_days: number
          quantity: number
          quote_id: string
          quote_status: string
          subscription_tier: string
          unit_price_ht: number
          valid_until: string
        }[]
      }
      offers_overlap: { Args: { a: string; b: string }; Returns: boolean }
      plan_of: { Args: { p_company: string }; Returns: string }
      product_prices: {
        Args: { p_company: string }
        Returns: {
          discount_tiers: Json
          packaging_cost: number
          price_dzd_ht: number
          price_valid_until: string
          product_cost: number
          product_id: string
          unit_price_ht: number
        }[]
      }
      purge_expired_data: { Args: never; Returns: Json }
      quota_period_start: {
        Args: { p_period: Database["public"]["Enums"]["quota_period"] }
        Returns: string
      }
      reject_claim: { Args: { p_claim: string }; Returns: undefined }
      request_account_deletion: { Args: { p_reason?: string }; Returns: string }
      request_offer_currency: {
        Args: { p_currency: string; p_note: string; p_offer_id: string }
        Returns: undefined
      }
      request_subscription: {
        Args: {
          p_company: string
          p_cycle: Database["public"]["Enums"]["billing_cycle"]
          p_plan: string
        }
        Returns: string
      }
      rfq_settle_offers: { Args: { p_rfq: string }; Returns: undefined }
      save_auto_offers: {
        Args: { p_offers: Json; p_rfq: string }
        Returns: number
      }
      save_offer_pricing: {
        Args: { p: Json; p_offer: string }
        Returns: undefined
      }
      schedule_downgrade: {
        Args: { p_company: string; p_plan: string }
        Returns: undefined
      }
      start_trial: {
        Args: { p_company: string; p_plan: string }
        Returns: string
      }
      sync_subscriptions: { Args: never; Returns: number }
      trial_slots_used: { Args: never; Returns: number }
      try_uuid: { Args: { p: string }; Returns: string }
    }
    Enums: {
      billing_cycle: "monthly" | "annual_prepaid"
      quota_period: "none" | "once" | "month" | "quarter"
      sub_status: "pending_payment" | "active" | "past_due" | "cancelled"
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
    Enums: {
      billing_cycle: ["monthly", "annual_prepaid"],
      quota_period: ["none", "once", "month", "quarter"],
      sub_status: ["pending_payment", "active", "past_due", "cancelled"],
    },
  },
} as const
