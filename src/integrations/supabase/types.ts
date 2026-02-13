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
      breach_events: {
        Row: {
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
            foreignKeyName: "breach_events_scan_run_id_fkey"
            columns: ["scan_run_id"]
            isOneToOne: false
            referencedRelation: "scan_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_documents: {
        Row: {
          claim_id: string
          created_at: string
          file_path: string
          file_type: string | null
          id: string
          note: string | null
          user_id: string
        }
        Insert: {
          claim_id: string
          created_at?: string
          file_path: string
          file_type?: string | null
          id?: string
          note?: string | null
          user_id: string
        }
        Update: {
          claim_id?: string
          created_at?: string
          file_path?: string
          file_type?: string | null
          id?: string
          note?: string | null
          user_id?: string
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
      claims: {
        Row: {
          created_at: string
          est_payout: number | null
          fee_percent: number
          filed_at: string | null
          final_payout: number | null
          flag_reason: string | null
          flagged: boolean
          id: string
          scan_run_id: string | null
          settlement_id: string
          status: Database["public"]["Enums"]["claim_status_t"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          est_payout?: number | null
          fee_percent?: number
          filed_at?: string | null
          final_payout?: number | null
          flag_reason?: string | null
          flagged?: boolean
          id?: string
          scan_run_id?: string | null
          settlement_id: string
          status?: Database["public"]["Enums"]["claim_status_t"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          est_payout?: number | null
          fee_percent?: number
          filed_at?: string | null
          final_payout?: number | null
          flag_reason?: string | null
          flagged?: boolean
          id?: string
          scan_run_id?: string | null
          settlement_id?: string
          status?: Database["public"]["Enums"]["claim_status_t"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
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
      payouts: {
        Row: {
          amount: number
          claim_id: string
          created_at: string
          id: string
          paid_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount?: number
          claim_id: string
          created_at?: string
          id?: string
          paid_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          claim_id?: string
          created_at?: string
          id?: string
          paid_at?: string | null
          status?: string
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
      settlement_matches: {
        Row: {
          created_at: string
          id: string
          match_reason: string | null
          payout_estimate: number | null
          scan_run_id: string | null
          settlement_id: string
          status: Database["public"]["Enums"]["settlement_status_t"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_reason?: string | null
          payout_estimate?: number | null
          scan_run_id?: string | null
          settlement_id: string
          status?: Database["public"]["Enums"]["settlement_status_t"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          match_reason?: string | null
          payout_estimate?: number | null
          scan_run_id?: string | null
          settlement_id?: string
          status?: Database["public"]["Enums"]["settlement_status_t"]
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
      settlements: {
        Row: {
          breach_year: number | null
          company: string
          created_at: string
          created_by: string | null
          deadline: string | null
          description: string | null
          id: string
          name: string
          payout_max: number | null
          payout_min: number | null
          status: Database["public"]["Enums"]["settlement_status_t"]
          tags: string[]
          updated_at: string
          url: string | null
        }
        Insert: {
          breach_year?: number | null
          company: string
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          name: string
          payout_max?: number | null
          payout_min?: number | null
          status?: Database["public"]["Enums"]["settlement_status_t"]
          tags?: string[]
          updated_at?: string
          url?: string | null
        }
        Update: {
          breach_year?: number | null
          company?: string
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          name?: string
          payout_max?: number | null
          payout_min?: number | null
          status?: Database["public"]["Enums"]["settlement_status_t"]
          tags?: string[]
          updated_at?: string
          url?: string | null
        }
        Relationships: []
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
      is_admin: { Args: { p_user: string }; Returns: boolean }
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
        | "submitted"
        | "under_review"
        | "documentation_required"
        | "approved"
        | "rejected"
        | "paid"
      plan_t: "free" | "premium"
      risk_level_t: "low" | "medium" | "high" | "critical"
      scan_status_t: "queued" | "running" | "completed" | "failed"
      settlement_status_t: "open" | "pending" | "closed"
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
      settlement_status_t: ["open", "pending", "closed"],
    },
  },
} as const
