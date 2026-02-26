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
      admin_activity_logs: {
        Row: {
          action: string
          admin_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          meta: Json
        }
        Insert: {
          action: string
          admin_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          meta?: Json
        }
        Update: {
          action?: string
          admin_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          meta?: Json
        }
        Relationships: []
      }
      alerts: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          related_claim_id: string | null
          related_scan_run_id: string | null
          related_settlement_id: string | null
          severity: Database["public"]["Enums"]["risk_level_t"]
          title: string
          type: Database["public"]["Enums"]["alert_type_t"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          related_claim_id?: string | null
          related_scan_run_id?: string | null
          related_settlement_id?: string | null
          severity?: Database["public"]["Enums"]["risk_level_t"]
          title: string
          type: Database["public"]["Enums"]["alert_type_t"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          related_claim_id?: string | null
          related_scan_run_id?: string | null
          related_settlement_id?: string | null
          severity?: Database["public"]["Enums"]["risk_level_t"]
          title?: string
          type?: Database["public"]["Enums"]["alert_type_t"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_related_claim_id_fkey"
            columns: ["related_claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_related_scan_run_id_fkey"
            columns: ["related_scan_run_id"]
            isOneToOne: false
            referencedRelation: "scan_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_related_settlement_id_fkey"
            columns: ["related_settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          completed_at: string | null
          details: Json
          id: string
          job_name: string
          run_key: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          details?: Json
          id?: string
          job_name: string
          run_key: string
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          details?: Json
          id?: string
          job_name?: string
          run_key?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      breach_catalog: {
        Row: {
          active: boolean
          breach_year: number | null
          claim_deadline: string | null
          company: string
          created_at: string
          data_types: string[] | null
          estimated_payout_max: number | null
          estimated_payout_min: number | null
          exposed_fields: string
          id: string
          law_firm_partner: string | null
          name: string
          records_exposed: number | null
          settlement_available: boolean | null
          settlement_name: string | null
          severity: string
          source_name: string | null
          source_type: string
          source_url: string | null
          tags: string[]
          updated_at: string
          verification_status: string | null
          verified: boolean
        }
        Insert: {
          active?: boolean
          breach_year?: number | null
          claim_deadline?: string | null
          company: string
          created_at?: string
          data_types?: string[] | null
          estimated_payout_max?: number | null
          estimated_payout_min?: number | null
          exposed_fields: string
          id?: string
          law_firm_partner?: string | null
          name: string
          records_exposed?: number | null
          settlement_available?: boolean | null
          settlement_name?: string | null
          severity?: string
          source_name?: string | null
          source_type?: string
          source_url?: string | null
          tags?: string[]
          updated_at?: string
          verification_status?: string | null
          verified?: boolean
        }
        Update: {
          active?: boolean
          breach_year?: number | null
          claim_deadline?: string | null
          company?: string
          created_at?: string
          data_types?: string[] | null
          estimated_payout_max?: number | null
          estimated_payout_min?: number | null
          exposed_fields?: string
          id?: string
          law_firm_partner?: string | null
          name?: string
          records_exposed?: number | null
          settlement_available?: boolean | null
          settlement_name?: string | null
          severity?: string
          source_name?: string | null
          source_type?: string
          source_url?: string | null
          tags?: string[]
          updated_at?: string
          verification_status?: string | null
          verified?: boolean
        }
        Relationships: []
      }
      breach_events: {
        Row: {
          breach_catalog_id: string | null
          breach_year: number | null
          created_at: string
          details: Json
          exposed_fields: string[]
          id: string
          record_count_estimate: number | null
          risk_level: Database["public"]["Enums"]["risk_level_t"]
          scan_run_id: string | null
          source: string
          user_id: string
        }
        Insert: {
          breach_catalog_id?: string | null
          breach_year?: number | null
          created_at?: string
          details?: Json
          exposed_fields?: string[]
          id?: string
          record_count_estimate?: number | null
          risk_level?: Database["public"]["Enums"]["risk_level_t"]
          scan_run_id?: string | null
          source: string
          user_id: string
        }
        Update: {
          breach_catalog_id?: string | null
          breach_year?: number | null
          created_at?: string
          details?: Json
          exposed_fields?: string[]
          id?: string
          record_count_estimate?: number | null
          risk_level?: Database["public"]["Enums"]["risk_level_t"]
          scan_run_id?: string | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "breach_events_breach_catalog_id_fkey"
            columns: ["breach_catalog_id"]
            isOneToOne: false
            referencedRelation: "breach_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breach_events_scan_run_id_fkey"
            columns: ["scan_run_id"]
            isOneToOne: false
            referencedRelation: "scan_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_applications: {
        Row: {
          address: string | null
          breach_experience: string | null
          certifications_signed: boolean | null
          claim_id: string
          created_at: string | null
          documentation_available: boolean | null
          eligibility_answers: Json | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          submitted_at: string | null
        }
        Insert: {
          address?: string | null
          breach_experience?: string | null
          certifications_signed?: boolean | null
          claim_id: string
          created_at?: string | null
          documentation_available?: boolean | null
          eligibility_answers?: Json | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          submitted_at?: string | null
        }
        Update: {
          address?: string | null
          breach_experience?: string | null
          certifications_signed?: boolean | null
          claim_id?: string
          created_at?: string | null
          documentation_available?: boolean | null
          eligibility_answers?: Json | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_applications_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_assignments: {
        Row: {
          assigned_at: string
          assignment_status: string
          claim_id: string
          completed_at: string | null
          id: string
          notes: string | null
          partner_id: string
        }
        Insert: {
          assigned_at?: string
          assignment_status?: string
          claim_id: string
          completed_at?: string | null
          id?: string
          notes?: string | null
          partner_id: string
        }
        Update: {
          assigned_at?: string
          assignment_status?: string
          claim_id?: string
          completed_at?: string | null
          id?: string
          notes?: string | null
          partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_assignments_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_assignments_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_documents: {
        Row: {
          admin_notes: string | null
          claim_id: string
          created_at: string
          doc_type: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          mime_type: string | null
          note: string | null
          status: string
          updated_at: string
          user_id: string
          user_notes: string | null
          verified: boolean
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          admin_notes?: string | null
          claim_id: string
          created_at?: string
          doc_type?: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          mime_type?: string | null
          note?: string | null
          status?: string
          updated_at?: string
          user_id: string
          user_notes?: string | null
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          admin_notes?: string | null
          claim_id?: string
          created_at?: string
          doc_type?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          mime_type?: string | null
          note?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          user_notes?: string | null
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_documents_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_partner_notes: {
        Row: {
          claim_id: string
          created_at: string
          id: string
          note: string
          partner_id: string
        }
        Insert: {
          claim_id: string
          created_at?: string
          id?: string
          note: string
          partner_id: string
        }
        Update: {
          claim_id?: string
          created_at?: string
          id?: string
          note?: string
          partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_partner_notes_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_status_history: {
        Row: {
          claim_id: string
          created_at: string
          id: string
          note: string | null
          old_status: string | null
          status: string
          updated_by: string | null
        }
        Insert: {
          claim_id: string
          created_at?: string
          id?: string
          note?: string | null
          old_status?: string | null
          status: string
          updated_by?: string | null
        }
        Update: {
          claim_id?: string
          created_at?: string
          id?: string
          note?: string | null
          old_status?: string | null
          status?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_status_history_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_tasks: {
        Row: {
          assigned_to_role: string
          claim_id: string
          completed_at: string | null
          created_at: string
          details: string | null
          id: string
          status: string
          task_type: string
        }
        Insert: {
          assigned_to_role?: string
          claim_id: string
          completed_at?: string | null
          created_at?: string
          details?: string | null
          id?: string
          status?: string
          task_type: string
        }
        Update: {
          assigned_to_role?: string
          claim_id?: string
          completed_at?: string | null
          created_at?: string
          details?: string | null
          id?: string
          status?: string
          task_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_tasks_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          created_at: string
          decided_at: string | null
          est_payout: number | null
          fee_percent: number
          filed_at: string | null
          final_payout: number | null
          flag_reason: string | null
          flagged: boolean
          id: string
          match_id: string | null
          net_payout: number | null
          paid_at: string | null
          partner_firm_id: string | null
          partner_id: string | null
          platform_fee: number | null
          scan_run_id: string | null
          settlement_id: string
          status: Database["public"]["Enums"]["claim_status_t"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          est_payout?: number | null
          fee_percent?: number
          filed_at?: string | null
          final_payout?: number | null
          flag_reason?: string | null
          flagged?: boolean
          id?: string
          match_id?: string | null
          net_payout?: number | null
          paid_at?: string | null
          partner_firm_id?: string | null
          partner_id?: string | null
          platform_fee?: number | null
          scan_run_id?: string | null
          settlement_id: string
          status?: Database["public"]["Enums"]["claim_status_t"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          est_payout?: number | null
          fee_percent?: number
          filed_at?: string | null
          final_payout?: number | null
          flag_reason?: string | null
          flagged?: boolean
          id?: string
          match_id?: string | null
          net_payout?: number | null
          paid_at?: string | null
          partner_firm_id?: string | null
          partner_id?: string | null
          platform_fee?: number | null
          scan_run_id?: string | null
          settlement_id?: string
          status?: Database["public"]["Enums"]["claim_status_t"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claims_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "settlement_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_partner_firm_id_fkey"
            columns: ["partner_firm_id"]
            isOneToOne: false
            referencedRelation: "partner_firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_scan_run_id_fkey"
            columns: ["scan_run_id"]
            isOneToOne: false
            referencedRelation: "scan_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      csv_mapping_templates: {
        Row: {
          created_at: string
          id: string
          mapping_json: Json
          source_id: string | null
          template_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          mapping_json?: Json
          source_id?: string | null
          template_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          mapping_json?: Json
          source_id?: string | null
          template_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "csv_mapping_templates_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "settlement_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      deadline_alerts_sent: {
        Row: {
          sent_at: string
          settlement_id: string
          threshold_days: number
          user_id: string
        }
        Insert: {
          sent_at?: string
          settlement_id: string
          threshold_days: number
          user_id: string
        }
        Update: {
          sent_at?: string
          settlement_id?: string
          threshold_days?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deadline_alerts_sent_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_flags: {
        Row: {
          claim_id: string
          created_at: string
          id: string
          reason: string
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          user_id: string
        }
        Insert: {
          claim_id: string
          created_at?: string
          id?: string
          reason: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          user_id: string
        }
        Update: {
          claim_id?: string
          created_at?: string
          id?: string
          reason?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fraud_flags_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      monitored_identifiers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          type: string
          updated_at: string
          user_id: string
          value_hash: string
          value_last4: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          type: string
          updated_at?: string
          user_id: string
          value_hash: string
          value_last4?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          type?: string
          updated_at?: string
          user_id?: string
          value_hash?: string
          value_last4?: string | null
        }
        Relationships: []
      }
      notification_outbox: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          dedupe_key: string | null
          id: string
          last_error: string | null
          next_attempt_at: string | null
          payload: Json
          sent_at: string | null
          status: string
          template: string
          user_id: string
        }
        Insert: {
          attempts?: number
          channel: string
          created_at?: string
          dedupe_key?: string | null
          id?: string
          last_error?: string | null
          next_attempt_at?: string | null
          payload?: Json
          sent_at?: string | null
          status?: string
          template: string
          user_id: string
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          dedupe_key?: string | null
          id?: string
          last_error?: string | null
          next_attempt_at?: string | null
          payload?: Json
          sent_at?: string | null
          status?: string
          template?: string
          user_id?: string
        }
        Relationships: []
      }
      partner_activity_log: {
        Row: {
          action: string
          claim_id: string | null
          created_at: string
          id: string
          meta: Json | null
          partner_id: string
          partner_user_id: string | null
        }
        Insert: {
          action: string
          claim_id?: string | null
          created_at?: string
          id?: string
          meta?: Json | null
          partner_id: string
          partner_user_id?: string | null
        }
        Update: {
          action?: string
          claim_id?: string | null
          created_at?: string
          id?: string
          meta?: Json | null
          partner_id?: string
          partner_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_activity_log_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_activity_log_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_activity_log_partner_user_id_fkey"
            columns: ["partner_user_id"]
            isOneToOne: false
            referencedRelation: "partner_users"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_firms: {
        Row: {
          contact_email: string | null
          created_at: string
          id: string
          name: string
          status: string
          website: string | null
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          id?: string
          name: string
          status?: string
          website?: string | null
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          id?: string
          name?: string
          status?: string
          website?: string | null
        }
        Relationships: []
      }
      partner_profiles: {
        Row: {
          created_at: string
          display_name: string | null
          firm_id: string | null
          phone: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          firm_id?: string | null
          phone?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          firm_id?: string | null
          phone?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_profiles_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "partner_firms"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_users: {
        Row: {
          created_at: string
          id: string
          partner_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          partner_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          partner_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_users_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          contact_email: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          partner_type: string
          website: string | null
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          partner_type: string
          website?: string | null
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          partner_type?: string
          website?: string | null
        }
        Relationships: []
      }
      payouts: {
        Row: {
          amount: number
          claim_id: string
          created_at: string
          currency: string
          id: string
          paid_at: string | null
          status: string
          stripe_ref: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          claim_id: string
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          status?: string
          stripe_ref?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          claim_id?: string
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          status?: string
          stripe_ref?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          amount_expected: number | null
          amount_paid: number | null
          claim_id: string
          created_at: string
          id: string
          model: string
          partner_id: string
          status: string
        }
        Insert: {
          amount_expected?: number | null
          amount_paid?: number | null
          claim_id: string
          created_at?: string
          id?: string
          model?: string
          partner_id: string
          status?: string
        }
        Update: {
          amount_expected?: number | null
          amount_paid?: number | null
          claim_id?: string
          created_at?: string
          id?: string
          model?: string
          partner_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_job_queue: {
        Row: {
          attempts: number
          created_at: string
          finished_at: string | null
          id: string
          last_error: string | null
          run_at: string
          schedule_id: string | null
          started_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          finished_at?: string | null
          id?: string
          last_error?: string | null
          run_at: string
          schedule_id?: string | null
          started_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          finished_at?: string | null
          id?: string
          last_error?: string | null
          run_at?: string
          schedule_id?: string | null
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scan_job_queue_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "scan_schedule"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_run_log: {
        Row: {
          alerts_enqueued: number | null
          finished_at: string | null
          id: string
          last_error: string | null
          processed_users: number | null
          started_at: string
          status: string
        }
        Insert: {
          alerts_enqueued?: number | null
          finished_at?: string | null
          id?: string
          last_error?: string | null
          processed_users?: number | null
          started_at?: string
          status?: string
        }
        Update: {
          alerts_enqueued?: number | null
          finished_at?: string | null
          id?: string
          last_error?: string | null
          processed_users?: number | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      scan_runs: {
        Row: {
          breaches_detected: number
          completed_at: string | null
          created_at: string
          databases_scanned: number
          eligible_settlements: number
          error_message: string | null
          id: string
          provider: string | null
          requested_email_hash: string | null
          requested_phone_hash: string | null
          risk_score: number
          started_at: string | null
          status: Database["public"]["Enums"]["scan_status_t"]
          user_id: string
        }
        Insert: {
          breaches_detected?: number
          completed_at?: string | null
          created_at?: string
          databases_scanned?: number
          eligible_settlements?: number
          error_message?: string | null
          id?: string
          provider?: string | null
          requested_email_hash?: string | null
          requested_phone_hash?: string | null
          risk_score?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["scan_status_t"]
          user_id: string
        }
        Update: {
          breaches_detected?: number
          completed_at?: string | null
          created_at?: string
          databases_scanned?: number
          eligible_settlements?: number
          error_message?: string | null
          id?: string
          provider?: string | null
          requested_email_hash?: string | null
          requested_phone_hash?: string | null
          risk_score?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["scan_status_t"]
          user_id?: string
        }
        Relationships: []
      }
      scan_schedule: {
        Row: {
          created_at: string
          frequency: string
          id: string
          is_enabled: boolean
          last_run_at: string | null
          next_run_at: string
          scan_type: string
          timezone: string
          user_id: string
        }
        Insert: {
          created_at?: string
          frequency?: string
          id?: string
          is_enabled?: boolean
          last_run_at?: string | null
          next_run_at?: string
          scan_type?: string
          timezone?: string
          user_id: string
        }
        Update: {
          created_at?: string
          frequency?: string
          id?: string
          is_enabled?: boolean
          last_run_at?: string | null
          next_run_at?: string
          scan_type?: string
          timezone?: string
          user_id?: string
        }
        Relationships: []
      }
      settlement_matches: {
        Row: {
          confidence_level: string
          confidence_score: number
          created_at: string
          id: string
          match_reason: string | null
          payout_estimate: number | null
          scan_run_id: string | null
          settlement_id: string
          status: string
          user_id: string
        }
        Insert: {
          confidence_level?: string
          confidence_score?: number
          created_at?: string
          id?: string
          match_reason?: string | null
          payout_estimate?: number | null
          scan_run_id?: string | null
          settlement_id: string
          status?: string
          user_id: string
        }
        Update: {
          confidence_level?: string
          confidence_score?: number
          created_at?: string
          id?: string
          match_reason?: string | null
          payout_estimate?: number | null
          scan_run_id?: string | null
          settlement_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlement_matches_scan_run_id_fkey"
            columns: ["scan_run_id"]
            isOneToOne: false
            referencedRelation: "scan_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_matches_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_performance_metrics: {
        Row: {
          avg_payout: number | null
          conversion_rate: number | null
          created_at: string
          id: string
          settlement_id: string
          total_approved: number
          total_claims_filed: number
          total_matches: number
          total_paid: number
          total_payout_amount: number
          updated_at: string
        }
        Insert: {
          avg_payout?: number | null
          conversion_rate?: number | null
          created_at?: string
          id?: string
          settlement_id: string
          total_approved?: number
          total_claims_filed?: number
          total_matches?: number
          total_paid?: number
          total_payout_amount?: number
          updated_at?: string
        }
        Update: {
          avg_payout?: number | null
          conversion_rate?: number | null
          created_at?: string
          id?: string
          settlement_id?: string
          total_approved?: number
          total_claims_filed?: number
          total_matches?: number
          total_paid?: number
          total_payout_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlement_performance_metrics_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: true
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_raw_ingest: {
        Row: {
          content_hash: string
          created_at: string
          fetched_at: string | null
          id: string
          raw_payload: Json
          raw_url: string | null
          source_id: string | null
          source_record_id: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          fetched_at?: string | null
          id?: string
          raw_payload: Json
          raw_url?: string | null
          source_id?: string | null
          source_record_id?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          fetched_at?: string | null
          id?: string
          raw_payload?: Json
          raw_url?: string | null
          source_id?: string | null
          source_record_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settlement_raw_ingest_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "settlement_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_sources: {
        Row: {
          base_url: string | null
          created_at: string
          fetch_strategy: string | null
          id: string
          is_active: boolean | null
          name: string
          reliability_score: number | null
          type: string
        }
        Insert: {
          base_url?: string | null
          created_at?: string
          fetch_strategy?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          reliability_score?: number | null
          type: string
        }
        Update: {
          base_url?: string | null
          created_at?: string
          fetch_strategy?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          reliability_score?: number | null
          type?: string
        }
        Relationships: []
      }
      settlement_verification_queue: {
        Row: {
          changes_diff: Json | null
          created_at: string
          id: string
          notes: string | null
          priority: number | null
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          settlement_id: string
          status: string | null
        }
        Insert: {
          changes_diff?: Json | null
          created_at?: string
          id?: string
          notes?: string | null
          priority?: number | null
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          settlement_id: string
          status?: string | null
        }
        Update: {
          changes_diff?: Json | null
          created_at?: string
          id?: string
          notes?: string | null
          priority?: number | null
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          settlement_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settlement_verification_queue_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      settlements: {
        Row: {
          administrator_name: string | null
          breach_year: number | null
          canonical_key: string
          case_number: string | null
          category: string | null
          claim_deadline: string | null
          claim_url: string | null
          claims_filing_url: string | null
          company: string
          created_at: string
          created_by: string | null
          deadline: string | null
          description: string | null
          eligibility_summary: string | null
          final_approval_date: string | null
          id: string
          jurisdiction: string | null
          last_verified_at: string | null
          name: string
          notes_internal: string | null
          official_source_url: string | null
          payout_max: number | null
          payout_min: number | null
          source_id: string | null
          source_name: string | null
          source_type: string | null
          source_url: string | null
          status: string
          tags: string[]
          updated_at: string
          url: string | null
          verification_level: string
          verification_notes: string | null
          verified: boolean
        }
        Insert: {
          administrator_name?: string | null
          breach_year?: number | null
          canonical_key: string
          case_number?: string | null
          category?: string | null
          claim_deadline?: string | null
          claim_url?: string | null
          claims_filing_url?: string | null
          company: string
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          eligibility_summary?: string | null
          final_approval_date?: string | null
          id?: string
          jurisdiction?: string | null
          last_verified_at?: string | null
          name: string
          notes_internal?: string | null
          official_source_url?: string | null
          payout_max?: number | null
          payout_min?: number | null
          source_id?: string | null
          source_name?: string | null
          source_type?: string | null
          source_url?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
          url?: string | null
          verification_level?: string
          verification_notes?: string | null
          verified?: boolean
        }
        Update: {
          administrator_name?: string | null
          breach_year?: number | null
          canonical_key?: string
          case_number?: string | null
          category?: string | null
          claim_deadline?: string | null
          claim_url?: string | null
          claims_filing_url?: string | null
          company?: string
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          eligibility_summary?: string | null
          final_approval_date?: string | null
          id?: string
          jurisdiction?: string | null
          last_verified_at?: string | null
          name?: string
          notes_internal?: string | null
          official_source_url?: string | null
          payout_max?: number | null
          payout_min?: number | null
          source_id?: string | null
          source_name?: string | null
          source_type?: string | null
          source_url?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
          url?: string | null
          verification_level?: string
          verification_notes?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "settlements_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "settlement_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          provider: string | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string
          deadline_alerts: boolean
          email: string | null
          email_alerts: boolean
          last_scan_at: string | null
          monitoring_enabled: boolean
          next_scan_at: string | null
          plan: Database["public"]["Enums"]["plan_t"]
          push_alerts: boolean
          scan_frequency_days: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deadline_alerts?: boolean
          email?: string | null
          email_alerts?: boolean
          last_scan_at?: string | null
          monitoring_enabled?: boolean
          next_scan_at?: string | null
          plan?: Database["public"]["Enums"]["plan_t"]
          push_alerts?: boolean
          scan_frequency_days?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deadline_alerts?: boolean
          email?: string | null
          email_alerts?: boolean
          last_scan_at?: string | null
          monitoring_enabled?: boolean
          next_scan_at?: string | null
          plan?: Database["public"]["Enums"]["plan_t"]
          push_alerts?: boolean
          scan_frequency_days?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_risk_snapshots: {
        Row: {
          breaches_detected: number
          created_at: string
          id: string
          risk_score: number
          user_id: string
        }
        Insert: {
          breaches_detected?: number
          created_at?: string
          id?: string
          risk_score: number
          user_id: string
        }
        Update: {
          breaches_detected?: number
          created_at?: string
          id?: string
          risk_score?: number
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      call_edge_function: {
        Args: { p_job: string; p_path: string }
        Returns: Json
      }
      enqueue_due_scan_jobs: { Args: never; Returns: number }
      get_partner_id_for_user: { Args: { p_user_id: string }; Returns: string }
      is_admin:
        | { Args: never; Returns: boolean }
        | { Args: { p_user: string }; Returns: boolean }
      normalize_raw_ingest: { Args: { p_ingest_id: string }; Returns: string }
      proc_claim_outbox: {
        Args: { batch_size?: number }
        Returns: {
          attempts: number
          channel: string
          created_at: string
          dedupe_key: string | null
          id: string
          last_error: string | null
          next_attempt_at: string | null
          payload: Json
          sent_at: string | null
          status: string
          template: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notification_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      proc_cron_scan_jobs: { Args: { max_jobs?: number }; Returns: Json }
      proc_enqueue_due_jobs: { Args: { max_jobs?: number }; Returns: number }
      proc_run_scheduled_jobs: { Args: { max_jobs?: number }; Returns: number }
      rpc_partner_add_note: {
        Args: { p_claim_id: string; p_note: string }
        Returns: string
      }
      rpc_partner_update_assignment: {
        Args: { p_claim_id: string; p_notes?: string; p_status: string }
        Returns: undefined
      }
      rpc_partner_update_claim_status: {
        Args: { p_claim_id: string; p_new_status: string; p_notes?: string }
        Returns: undefined
      }
    }
    Enums: {
      alert_type_t:
        | "breach_detected"
        | "settlement_found"
        | "deadline_alert"
        | "claim_update"
        | "payout_update"
        | "system"
      claim_status_t:
        | "draft"
        | "submitted"
        | "under_review"
        | "documentation_required"
        | "approved"
        | "rejected"
        | "paid"
      plan_t: "free" | "premium"
      risk_level_t: "low" | "medium" | "high" | "critical"
      scan_status_t: "queued" | "running" | "completed" | "failed"
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
    Enums: {
      alert_type_t: [
        "breach_detected",
        "settlement_found",
        "deadline_alert",
        "claim_update",
        "payout_update",
        "system",
      ],
      claim_status_t: [
        "draft",
        "submitted",
        "under_review",
        "documentation_required",
        "approved",
        "rejected",
        "paid",
      ],
      plan_t: ["free", "premium"],
      risk_level_t: ["low", "medium", "high", "critical"],
      scan_status_t: ["queued", "running", "completed", "failed"],
    },
  },
} as const
