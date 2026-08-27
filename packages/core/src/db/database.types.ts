/**
 * Types générés depuis le schéma Supabase — NE PAS ÉDITER À LA MAIN.
 *
 * Régénérer après chaque migration :  pnpm db:types
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      assignment_cards: {
        Row: {
          assignment_id: string
          card: Json
          created_at: string
          user_id: string
        }
        Insert: {
          assignment_id: string
          card: Json
          created_at?: string
          user_id: string
        }
        Update: {
          assignment_id?: string
          card?: Json
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_cards_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: true
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_cards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          assigned_at: string
          batch_id: string | null
          company_id: string
          contacted_at: string | null
          exclusive_until: string
          id: string
          is_control: boolean
          match_score: number
          opportunity_id: string
          outcome: Database["public"]["Enums"]["assignment_outcome"] | null
          outcome_at: string | null
          rank: number
          status: Database["public"]["Enums"]["assignment_status"]
          user_id: string
          viewed_at: string | null
        }
        Insert: {
          assigned_at?: string
          batch_id?: string | null
          company_id: string
          contacted_at?: string | null
          exclusive_until: string
          id?: string
          is_control?: boolean
          match_score: number
          opportunity_id: string
          outcome?: Database["public"]["Enums"]["assignment_outcome"] | null
          outcome_at?: string | null
          rank: number
          status?: Database["public"]["Enums"]["assignment_status"]
          user_id: string
          viewed_at?: string | null
        }
        Update: {
          assigned_at?: string
          batch_id?: string | null
          company_id?: string
          contacted_at?: string | null
          exclusive_until?: string
          id?: string
          is_control?: boolean
          match_score?: number
          opportunity_id?: string
          outcome?: Database["public"]["Enums"]["assignment_outcome"] | null
          outcome_at?: string | null
          rank?: number
          status?: Database["public"]["Enums"]["assignment_status"]
          user_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "daily_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          city: string | null
          commercial_name: string | null
          company_status: Database["public"]["Enums"]["company_status"]
          contact_form_url: string | null
          country: string
          created_at: string
          creation_date: string | null
          data_quality_score: number
          domain: string | null
          employee_max: number | null
          employee_min: number | null
          has_contact: boolean | null
          id: string
          identity_confidence: number
          industry_code: string | null
          industry_label: string | null
          last_scanned_at: string | null
          last_seen_at: string | null
          lat: number | null
          legal_name: string
          lon: number | null
          next_scan_at: string | null
          phone: string | null
          postal_code: string | null
          prospecting_allowed: boolean
          region: string | null
          scan_priority: number
          segment: Database["public"]["Enums"]["company_segment"]
          siren: string | null
          siret: string | null
          suppression_global: boolean
          suppression_reason: string | null
          updated_at: string
          website_confidence: number | null
          website_last_resolved_at: string | null
          website_resolution_attempts: number
          website_url: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          commercial_name?: string | null
          company_status?: Database["public"]["Enums"]["company_status"]
          contact_form_url?: string | null
          country?: string
          created_at?: string
          creation_date?: string | null
          data_quality_score?: number
          domain?: string | null
          employee_max?: number | null
          employee_min?: number | null
          has_contact?: boolean | null
          id?: string
          identity_confidence?: number
          industry_code?: string | null
          industry_label?: string | null
          last_scanned_at?: string | null
          last_seen_at?: string | null
          lat?: number | null
          legal_name: string
          lon?: number | null
          next_scan_at?: string | null
          phone?: string | null
          postal_code?: string | null
          prospecting_allowed?: boolean
          region?: string | null
          scan_priority?: number
          segment?: Database["public"]["Enums"]["company_segment"]
          siren?: string | null
          siret?: string | null
          suppression_global?: boolean
          suppression_reason?: string | null
          updated_at?: string
          website_confidence?: number | null
          website_last_resolved_at?: string | null
          website_resolution_attempts?: number
          website_url?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          commercial_name?: string | null
          company_status?: Database["public"]["Enums"]["company_status"]
          contact_form_url?: string | null
          country?: string
          created_at?: string
          creation_date?: string | null
          data_quality_score?: number
          domain?: string | null
          employee_max?: number | null
          employee_min?: number | null
          has_contact?: boolean | null
          id?: string
          identity_confidence?: number
          industry_code?: string | null
          industry_label?: string | null
          last_scanned_at?: string | null
          last_seen_at?: string | null
          lat?: number | null
          legal_name?: string
          lon?: number | null
          next_scan_at?: string | null
          phone?: string | null
          postal_code?: string | null
          prospecting_allowed?: boolean
          region?: string | null
          scan_priority?: number
          segment?: Database["public"]["Enums"]["company_segment"]
          siren?: string | null
          siret?: string | null
          suppression_global?: boolean
          suppression_reason?: string | null
          updated_at?: string
          website_confidence?: number | null
          website_last_resolved_at?: string | null
          website_resolution_attempts?: number
          website_url?: string | null
        }
        Relationships: []
      }
      company_cooldowns: {
        Row: {
          assignment_id: string | null
          company_id: string
          created_at: string
          ends_at: string | null
          id: string
          notes: string | null
          permanent: boolean
          reason: Database["public"]["Enums"]["cooldown_reason"]
          starts_at: string
        }
        Insert: {
          assignment_id?: string | null
          company_id: string
          created_at?: string
          ends_at?: string | null
          id?: string
          notes?: string | null
          permanent?: boolean
          reason: Database["public"]["Enums"]["cooldown_reason"]
          starts_at?: string
        }
        Update: {
          assignment_id?: string | null
          company_id?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          notes?: string | null
          permanent?: boolean
          reason?: Database["public"]["Enums"]["cooldown_reason"]
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_cooldowns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_event_keys: {
        Row: {
          company_id: string
          dedupe_key: string
          first_detected_at: string
        }
        Insert: {
          company_id: string
          dedupe_key: string
          first_detected_at?: string
        }
        Update: {
          company_id?: string
          dedupe_key?: string
          first_detected_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_event_keys_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_events: {
        Row: {
          company_id: string
          confidence: number
          dedupe_key: string | null
          detected_at: string
          event_type: string
          expires_at: string | null
          id: string
          importance: number
          occurred_at: string | null
          payload: Json
          source: string
        }
        Insert: {
          company_id: string
          confidence?: number
          dedupe_key?: string | null
          detected_at?: string
          event_type: string
          expires_at?: string | null
          id?: string
          importance?: number
          occurred_at?: string | null
          payload?: Json
          source: string
        }
        Update: {
          company_id?: string
          confidence?: number
          dedupe_key?: string | null
          detected_at?: string
          event_type?: string
          expires_at?: string | null
          id?: string
          importance?: number
          occurred_at?: string | null
          payload?: Json
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_events_202508: {
        Row: {
          company_id: string
          confidence: number
          dedupe_key: string | null
          detected_at: string
          event_type: string
          expires_at: string | null
          id: string
          importance: number
          occurred_at: string | null
          payload: Json
          source: string
        }
        Insert: {
          company_id: string
          confidence?: number
          dedupe_key?: string | null
          detected_at?: string
          event_type: string
          expires_at?: string | null
          id?: string
          importance?: number
          occurred_at?: string | null
          payload?: Json
          source: string
        }
        Update: {
          company_id?: string
          confidence?: number
          dedupe_key?: string | null
          detected_at?: string
          event_type?: string
          expires_at?: string | null
          id?: string
          importance?: number
          occurred_at?: string | null
          payload?: Json
          source?: string
        }
        Relationships: []
      }
      company_events_202509: {
        Row: {
          company_id: string
          confidence: number
          dedupe_key: string | null
          detected_at: string
          event_type: string
          expires_at: string | null
          id: string
          importance: number
          occurred_at: string | null
          payload: Json
          source: string
        }
        Insert: {
          company_id: string
          confidence?: number
          dedupe_key?: string | null
          detected_at?: string
          event_type: string
          expires_at?: string | null
          id?: string
          importance?: number
          occurred_at?: string | null
          payload?: Json
          source: string
        }
        Update: {
          company_id?: string
          confidence?: number
          dedupe_key?: string | null
          detected_at?: string
          event_type?: string
          expires_at?: string | null
          id?: string
          importance?: number
          occurred_at?: string | null
          payload?: Json
          source?: string
        }
        Relationships: []
      }
      company_events_202510: {
        Row: {
          company_id: string
          confidence: number
          dedupe_key: string | null
          detected_at: string
          event_type: string
          expires_at: string | null
          id: string
          importance: number
          occurred_at: string | null
          payload: Json
          source: string
        }
        Insert: {
          company_id: string
          confidence?: number
          dedupe_key?: string | null
          detected_at?: string
          event_type: string
          expires_at?: string | null
          id?: string
          importance?: number
          occurred_at?: string | null
          payload?: Json
          source: string
        }
        Update: {
          company_id?: string
          confidence?: number
          dedupe_key?: string | null
          detected_at?: string
          event_type?: string
          expires_at?: string | null
          id?: string
          importance?: number
          occurred_at?: string | null
          payload?: Json
          source?: string
        }
        Relationships: []
      }
      company_events_202511: {
        Row: {
          company_id: string
          confidence: number
          dedupe_key: string | null
          detected_at: string
          event_type: string
          expires_at: string | null
          id: string
          importance: number
          occurred_at: string | null
          payload: Json
          source: string
        }
        Insert: {
          company_id: string
          confidence?: number
          dedupe_key?: string | null
          detected_at?: string
          event_type: string
          expires_at?: string | null
          id?: string
          importance?: number
          occurred_at?: string | null
          payload?: Json
          source: string
        }
        Update: {
          company_id?: string
          confidence?: number
          dedupe_key?: string | null
          detected_at?: string
          event_type?: string
          expires_at?: string | null
          id?: string
          importance?: number
          occurred_at?: string | null
          payload?: Json
          source?: string
        }
        Relationships: []
      }
      company_events_202512: {
        Row: {
          company_id: string
          confidence: number
          dedupe_key: string | null
          detected_at: string
          event_type: string
          expires_at: string | null
          id: string
          importance: number
          occurred_at: string | null
          payload: Json
          source: string
        }
        Insert: {
          company_id: string
          confidence?: number
          dedupe_key?: string | null
          detected_at?: string
          event_type: string
          expires_at?: string | null
          id?: string
          importance?: number
          occurred_at?: string | null
          payload?: Json
          source: string
        }
        Update: {
          company_id?: string
          confidence?: number
          dedupe_key?: string | null
          detected_at?: string
          event_type?: string
          expires_at?: string | null
          id?: string
          importance?: number
          occurred_at?: string | null
          payload?: Json
          source?: string
        }
        Relationships: []
      }
      company_events_202601: {
        Row: {
          company_id: string
          confidence: number
          dedupe_key: string | null
          detected_at: string
          event_type: string
          expires_at: string | null
          id: string
          importance: number
          occurred_at: string | null
          payload: Json
          source: string
        }
        Insert: {
          company_id: string
          confidence?: number
          dedupe_key?: string | null
          detected_at?: string
          event_type: string
          expires_at?: string | null
          id?: string
          importance?: number
          occurred_at?: string | null
          payload?: Json
          source: string
        }
        Update: {
          company_id?: string
          confidence?: number
          dedupe_key?: string | null
          detected_at?: string
          event_type?: string
          expires_at?: string | null
          id?: string
          importance?: number
          occurred_at?: string | null
          payload?: Json
          source?: string
        }
        Relationships: []
      }
      company_events_202602: {
        Row: {
          company_id: string
          confidence: number
          dedupe_key: string | null
          detected_at: string
          event_type: string
          expires_at: string | null
          id: string
          importance: number
          occurred_at: string | null
          payload: Json
          source: string
        }
        Insert: {
          company_id: string
          confidence?: number
          dedupe_key?: string | null
          detected_at?: string
          event_type: string
          expires_at?: string | null
          id?: string
          importance?: number
          occurred_at?: string | null
          payload?: Json
          source: string
        }
        Update: {
          company_id?: string
          confidence?: number
          dedupe_key?: string | null
          detected_at?: string
          event_type?: string
          expires_at?: string | null
          id?: string
          importance?: number
          occurred_at?: string | null
          payload?: Json
          source?: string
        }
        Relationships: []
      }
      company_events_202603: {
        Row: {
          company_id: string
          confidence: number
          dedupe_key: string | null
          detected_at: string
          event_type: string
          expires_at: string | null
          id: string
          importance: number
          occurred_at: string | null
          payload: Json
          source: string
        }
        Insert: {
          company_id: string
          confidence?: number
          dedupe_key?: string | null
          detected_at?: string
          event_type: string
          expires_at?: string | null
          id?: string
          importance?: number
          occurred_at?: string | null
          payload?: Json
          source: string
        }
        Update: {
          company_id?: string
          confidence?: number
          dedupe_key?: string | null
          detected_at?: string
          event_type?: string
          expires_at?: string | null
          id?: string
          importance?: number
          occurred_at?: string | null
          payload?: Json
          source?: string
        }
        Relationships: []
      }
      company_events_202604: {
        Row: {
          company_id: string
          confidence: number
          dedupe_key: string | null
          detected_at: string
          event_type: string
          expires_at: string | null
          id: string
          importance: number
          occurred_at: string | null
          payload: Json
          source: string
        }
        Insert: {
          company_id: string
          confidence?: number
          dedupe_key?: string | null
          detected_at?: string
          event_type: string
          expires_at?: string | null
          id?: string
          importance?: number
          occurred_at?: string | null
          payload?: Json
          source: string
        }
        Update: {
          company_id?: string
          confidence?: number
          dedupe_key?: string | null
          detected_at?: string
          event_type?: string
          expires_at?: string | null
          id?: string
          importance?: number
          occurred_at?: string | null
          payload?: Json
          source?: string
        }
        Relationships: []
      }
      company_events_202605: {
        Row: {
          company_id: string
          confidence: number
          dedupe_key: string | null
          detected_at: string
          event_type: string
          expires_at: string | null
          id: string
          importance: number
          occurred_at: string | null
          payload: Json
          source: string
        }
        Insert: {
          company_id: string
          confidence?: number
          dedupe_key?: string | null
          detected_at?: string
          event_type: string
          expires_at?: string | null
          id?: string
          importance?: number
          occurred_at?: string | null
          payload?: Json
          source: string
        }
        Update: {
          company_id?: string
          confidence?: number
          dedupe_key?: string | null
          detected_at?: string
          event_type?: string
          expires_at?: string | null
          id?: string
          importance?: number
          occurred_at?: string | null
          payload?: Json
          source?: string
        }
        Relationships: []
      }
      company_events_202606: {
        Row: {
          company_id: string
          confidence: number
          dedupe_key: string | null
          detected_at: string
          event_type: string
          expires_at: string | null
          id: string
          importance: number
          occurred_at: string | null
          payload: Json
          source: string
        }
        Insert: {
          company_id: string
          confidence?: number
          dedupe_key?: string | null
          detected_at?: string
          event_type: string
          expires_at?: string | null
          id?: string
          importance?: number
          occurred_at?: string | null
          payload?: Json
          source: string
        }
        Update: {
          company_id?: string
          confidence?: number
          dedupe_key?: string | null
          detected_at?: string
          event_type?: string
          expires_at?: string | null
          id?: string
          importance?: number
          occurred_at?: string | null
          payload?: Json
          source?: string
        }
        Relationships: []
      }
      company_events_202607: {
        Row: {
          company_id: string
          confidence: number
          dedupe_key: string | null
          detected_at: string
          event_type: string
          expires_at: string | null
          id: string
          importance: number
          occurred_at: string | null
          payload: Json
          source: string
        }
        Insert: {
          company_id: string
          confidence?: number
          dedupe_key?: string | null
          detected_at?: string
          event_type: string
          expires_at?: string | null
          id?: string
          importance?: number
          occurred_at?: string | null
          payload?: Json
          source: string
        }
        Update: {
          company_id?: string
          confidence?: number
          dedupe_key?: string | null
          detected_at?: string
          event_type?: string
          expires_at?: string | null
          id?: string
          importance?: number
          occurred_at?: string | null
          payload?: Json
          source?: string
        }
        Relationships: []
      }
      company_events_202608: {
        Row: {
          company_id: string
          confidence: number
          dedupe_key: string | null
          detected_at: string
          event_type: string
          expires_at: string | null
          id: string
          importance: number
          occurred_at: string | null
          payload: Json
          source: string
        }
        Insert: {
          company_id: string
          confidence?: number
          dedupe_key?: string | null
          detected_at?: string
          event_type: string
          expires_at?: string | null
          id?: string
          importance?: number
          occurred_at?: string | null
          payload?: Json
          source: string
        }
        Update: {
          company_id?: string
          confidence?: number
          dedupe_key?: string | null
          detected_at?: string
          event_type?: string
          expires_at?: string | null
          id?: string
          importance?: number
          occurred_at?: string | null
          payload?: Json
          source?: string
        }
        Relationships: []
      }
      company_events_202609: {
        Row: {
          company_id: string
          confidence: number
          dedupe_key: string | null
          detected_at: string
          event_type: string
          expires_at: string | null
          id: string
          importance: number
          occurred_at: string | null
          payload: Json
          source: string
        }
        Insert: {
          company_id: string
          confidence?: number
          dedupe_key?: string | null
          detected_at?: string
          event_type: string
          expires_at?: string | null
          id?: string
          importance?: number
          occurred_at?: string | null
          payload?: Json
          source: string
        }
        Update: {
          company_id?: string
          confidence?: number
          dedupe_key?: string | null
          detected_at?: string
          event_type?: string
          expires_at?: string | null
          id?: string
          importance?: number
          occurred_at?: string | null
          payload?: Json
          source?: string
        }
        Relationships: []
      }
      company_events_202610: {
        Row: {
          company_id: string
          confidence: number
          dedupe_key: string | null
          detected_at: string
          event_type: string
          expires_at: string | null
          id: string
          importance: number
          occurred_at: string | null
          payload: Json
          source: string
        }
        Insert: {
          company_id: string
          confidence?: number
          dedupe_key?: string | null
          detected_at?: string
          event_type: string
          expires_at?: string | null
          id?: string
          importance?: number
          occurred_at?: string | null
          payload?: Json
          source: string
        }
        Update: {
          company_id?: string
          confidence?: number
          dedupe_key?: string | null
          detected_at?: string
          event_type?: string
          expires_at?: string | null
          id?: string
          importance?: number
          occurred_at?: string | null
          payload?: Json
          source?: string
        }
        Relationships: []
      }
      company_events_202611: {
        Row: {
          company_id: string
          confidence: number
          dedupe_key: string | null
          detected_at: string
          event_type: string
          expires_at: string | null
          id: string
          importance: number
          occurred_at: string | null
          payload: Json
          source: string
        }
        Insert: {
          company_id: string
          confidence?: number
          dedupe_key?: string | null
          detected_at?: string
          event_type: string
          expires_at?: string | null
          id?: string
          importance?: number
          occurred_at?: string | null
          payload?: Json
          source: string
        }
        Update: {
          company_id?: string
          confidence?: number
          dedupe_key?: string | null
          detected_at?: string
          event_type?: string
          expires_at?: string | null
          id?: string
          importance?: number
          occurred_at?: string | null
          payload?: Json
          source?: string
        }
        Relationships: []
      }
      company_field_provenance: {
        Row: {
          company_id: string
          confidence: number
          field: string
          observed_at: string
          source_name: string
          value: string | null
        }
        Insert: {
          company_id: string
          confidence: number
          field: string
          observed_at?: string
          source_name: string
          value?: string | null
        }
        Update: {
          company_id?: string
          confidence?: number
          field?: string
          observed_at?: string
          source_name?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_field_provenance_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_sources: {
        Row: {
          company_id: string
          confidence: number
          discovered_at: string
          id: string
          last_seen_at: string
          raw_payload: Json
          source_external_id: string
          source_name: string
        }
        Insert: {
          company_id: string
          confidence?: number
          discovered_at?: string
          id?: string
          last_seen_at?: string
          raw_payload: Json
          source_external_id: string
          source_name: string
        }
        Update: {
          company_id?: string
          confidence?: number
          discovered_at?: string
          id?: string
          last_seen_at?: string
          raw_payload?: Json
          source_external_id?: string
          source_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_sources_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_events: {
        Row: {
          company_id: string | null
          created_at: string
          estimated_cost_eur: number
          id: number
          job_id: number | null
          operation: string
          provider: string
          units: number
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          estimated_cost_eur: number
          id?: never
          job_id?: number | null
          operation: string
          provider: string
          units?: number
        }
        Update: {
          company_id?: string | null
          created_at?: string
          estimated_cost_eur?: number
          id?: never
          job_id?: number | null
          operation?: string
          provider?: string
          units?: number
        }
        Relationships: [
          {
            foreignKeyName: "cost_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_batches: {
        Row: {
          algorithm_version: string
          batch_date: string
          created_at: string
          delivered_count: number
          generated_at: string
          id: string
          requested_count: number
          status: string
          user_id: string
        }
        Insert: {
          algorithm_version: string
          batch_date: string
          created_at?: string
          delivered_count?: number
          generated_at?: string
          id?: string
          requested_count: number
          status?: string
          user_id: string
        }
        Update: {
          algorithm_version?: string
          batch_date?: string
          created_at?: string
          delivered_count?: number
          generated_at?: string
          id?: string
          requested_count?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_batches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_queue: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          dedupe_key: string | null
          id: number
          job_type: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          priority: number
          run_after: string
          status: Database["public"]["Enums"]["job_status"]
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: never
          job_type: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          run_after?: string
          status?: Database["public"]["Enums"]["job_status"]
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: never
          job_type?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          run_after?: string
          status?: Database["public"]["Enums"]["job_status"]
        }
        Relationships: []
      }
      job_runs: {
        Row: {
          completed_at: string | null
          error: string | null
          failed_count: number
          id: string
          job_id: number | null
          job_type: string
          metadata: Json
          processed_count: number
          started_at: string
          status: string
          success_count: number
          worker_id: string | null
        }
        Insert: {
          completed_at?: string | null
          error?: string | null
          failed_count?: number
          id?: string
          job_id?: number | null
          job_type: string
          metadata?: Json
          processed_count?: number
          started_at?: string
          status?: string
          success_count?: number
          worker_id?: string | null
        }
        Update: {
          completed_at?: string | null
          error?: string | null
          failed_count?: number
          id?: string
          job_id?: number | null
          job_type?: string
          metadata?: Json
          processed_count?: number
          started_at?: string
          status?: string
          success_count?: number
          worker_id?: string | null
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          ai_contact_angle: string | null
          ai_explanation: string | null
          ai_model: string | null
          ai_prompt_version: string | null
          ai_relevance_score: number | null
          ai_why_now: string | null
          algorithm_version: string
          base_score: number
          company_id: string
          confidence_score: number
          created_at: string
          expires_at: string
          freshness_factor: number
          id: string
          need_score: number
          opportunity_type: Database["public"]["Enums"]["opportunity_type"]
          reason_data: Json
          signal_ids: string[]
          status: Database["public"]["Enums"]["opportunity_status"]
          timing_score: number
          trigger_event_id: string | null
          updated_at: string
        }
        Insert: {
          ai_contact_angle?: string | null
          ai_explanation?: string | null
          ai_model?: string | null
          ai_prompt_version?: string | null
          ai_relevance_score?: number | null
          ai_why_now?: string | null
          algorithm_version: string
          base_score: number
          company_id: string
          confidence_score: number
          created_at?: string
          expires_at: string
          freshness_factor: number
          id?: string
          need_score: number
          opportunity_type: Database["public"]["Enums"]["opportunity_type"]
          reason_data?: Json
          signal_ids?: string[]
          status?: Database["public"]["Enums"]["opportunity_status"]
          timing_score: number
          trigger_event_id?: string | null
          updated_at?: string
        }
        Update: {
          ai_contact_angle?: string | null
          ai_explanation?: string | null
          ai_model?: string | null
          ai_prompt_version?: string | null
          ai_relevance_score?: number | null
          ai_why_now?: string | null
          algorithm_version?: string
          base_score?: number
          company_id?: string
          confidence_score?: number
          created_at?: string
          expires_at?: string
          freshness_factor?: number
          id?: string
          need_score?: number
          opportunity_type?: Database["public"]["Enums"]["opportunity_type"]
          reason_data?: Json
          signal_ids?: string[]
          status?: Database["public"]["Enums"]["opportunity_status"]
          timing_score?: number
          trigger_event_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          city: string | null
          company_name: string | null
          country: string
          created_at: string
          daily_opportunity_limit: number
          full_name: string | null
          id: string
          onboarding_completed: boolean
          region: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          city?: string | null
          company_name?: string | null
          country?: string
          created_at?: string
          daily_opportunity_limit?: number
          full_name?: string | null
          id: string
          onboarding_completed?: boolean
          region?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          city?: string | null
          company_name?: string | null
          country?: string
          created_at?: string
          daily_opportunity_limit?: number
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean
          region?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      scoring_config: {
        Row: {
          active: boolean
          created_at: string
          half_lives: Json
          notes: string | null
          thresholds: Json
          version: string
          weights: Json
        }
        Insert: {
          active?: boolean
          created_at?: string
          half_lives: Json
          notes?: string | null
          thresholds: Json
          version: string
          weights: Json
        }
        Update: {
          active?: boolean
          created_at?: string
          half_lives?: Json
          notes?: string | null
          thresholds?: Json
          version?: string
          weights?: Json
        }
        Relationships: []
      }
      signals: {
        Row: {
          active: boolean
          category: Database["public"]["Enums"]["signal_category"]
          company_id: string
          confidence: number
          created_at: string
          detected_at: string
          evidence: Json
          expires_at: string | null
          fingerprint: string
          id: string
          kind: Database["public"]["Enums"]["signal_kind"]
          signal_type: string
          source: string
          strength: number
          trigger_event_id: string | null
          value: Json
        }
        Insert: {
          active?: boolean
          category: Database["public"]["Enums"]["signal_category"]
          company_id: string
          confidence: number
          created_at?: string
          detected_at?: string
          evidence?: Json
          expires_at?: string | null
          fingerprint: string
          id?: string
          kind: Database["public"]["Enums"]["signal_kind"]
          signal_type: string
          source: string
          strength: number
          trigger_event_id?: string | null
          value?: Json
        }
        Update: {
          active?: boolean
          category?: Database["public"]["Enums"]["signal_category"]
          company_id?: string
          confidence?: number
          created_at?: string
          detected_at?: string
          evidence?: Json
          expires_at?: string | null
          fingerprint?: string
          id?: string
          kind?: Database["public"]["Enums"]["signal_kind"]
          signal_type?: string
          source?: string
          strength?: number
          trigger_event_id?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "signals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          city: string | null
          created_at: string
          excluded_industries: string[]
          id: string
          location_mode: Database["public"]["Enums"]["location_mode"]
          preferred_industries: string[]
          region: string | null
          services: Database["public"]["Enums"]["opportunity_type"][]
          updated_at: string
          user_id: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          excluded_industries?: string[]
          id?: string
          location_mode?: Database["public"]["Enums"]["location_mode"]
          preferred_industries?: string[]
          region?: string | null
          services?: Database["public"]["Enums"]["opportunity_type"][]
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string | null
          created_at?: string
          excluded_industries?: string[]
          id?: string
          location_mode?: Database["public"]["Enums"]["location_mode"]
          preferred_industries?: string[]
          region?: string | null
          services?: Database["public"]["Enums"]["opportunity_type"][]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      website_snapshots: {
        Row: {
          accessibility_score: number | null
          booking_detected: boolean
          captured_at: string
          cms: string | null
          company_id: string
          contact_form_detected: boolean
          copyright_year: number | null
          domain: string
          ecommerce_detected: boolean
          final_url: string | null
          framework: string | null
          has_media_queries: boolean | null
          has_ssl: boolean | null
          has_viewport_meta: boolean | null
          html_bytes: number | null
          html_hash: string | null
          http_status: number | null
          id: string
          meta_description: string | null
          mobile_score: number | null
          performance_score: number | null
          redirect_chain: Json
          scan_depth: string
          scan_error: string | null
          seo_score: number | null
          siren_found_in_legal: string | null
          ssl_expires_at: string | null
          tech_hash: string | null
          technologies: Json
          title: string | null
          ttfb_ms: number | null
        }
        Insert: {
          accessibility_score?: number | null
          booking_detected?: boolean
          captured_at?: string
          cms?: string | null
          company_id: string
          contact_form_detected?: boolean
          copyright_year?: number | null
          domain: string
          ecommerce_detected?: boolean
          final_url?: string | null
          framework?: string | null
          has_media_queries?: boolean | null
          has_ssl?: boolean | null
          has_viewport_meta?: boolean | null
          html_bytes?: number | null
          html_hash?: string | null
          http_status?: number | null
          id?: string
          meta_description?: string | null
          mobile_score?: number | null
          performance_score?: number | null
          redirect_chain?: Json
          scan_depth?: string
          scan_error?: string | null
          seo_score?: number | null
          siren_found_in_legal?: string | null
          ssl_expires_at?: string | null
          tech_hash?: string | null
          technologies?: Json
          title?: string | null
          ttfb_ms?: number | null
        }
        Update: {
          accessibility_score?: number | null
          booking_detected?: boolean
          captured_at?: string
          cms?: string | null
          company_id?: string
          contact_form_detected?: boolean
          copyright_year?: number | null
          domain?: string
          ecommerce_detected?: boolean
          final_url?: string | null
          framework?: string | null
          has_media_queries?: boolean | null
          has_ssl?: boolean | null
          has_viewport_meta?: boolean | null
          html_bytes?: number | null
          html_hash?: string | null
          http_status?: number | null
          id?: string
          meta_description?: string | null
          mobile_score?: number | null
          performance_score?: number | null
          redirect_chain?: Json
          scan_depth?: string
          scan_error?: string | null
          seo_score?: number | null
          siren_found_in_legal?: string | null
          ssl_expires_at?: string | null
          tech_hash?: string | null
          technologies?: Json
          title?: string | null
          ttfb_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "website_snapshots_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      website_snapshots_202508: {
        Row: {
          accessibility_score: number | null
          booking_detected: boolean
          captured_at: string
          cms: string | null
          company_id: string
          contact_form_detected: boolean
          copyright_year: number | null
          domain: string
          ecommerce_detected: boolean
          final_url: string | null
          framework: string | null
          has_media_queries: boolean | null
          has_ssl: boolean | null
          has_viewport_meta: boolean | null
          html_bytes: number | null
          html_hash: string | null
          http_status: number | null
          id: string
          meta_description: string | null
          mobile_score: number | null
          performance_score: number | null
          redirect_chain: Json
          scan_depth: string
          scan_error: string | null
          seo_score: number | null
          siren_found_in_legal: string | null
          ssl_expires_at: string | null
          tech_hash: string | null
          technologies: Json
          title: string | null
          ttfb_ms: number | null
        }
        Insert: {
          accessibility_score?: number | null
          booking_detected?: boolean
          captured_at?: string
          cms?: string | null
          company_id: string
          contact_form_detected?: boolean
          copyright_year?: number | null
          domain: string
          ecommerce_detected?: boolean
          final_url?: string | null
          framework?: string | null
          has_media_queries?: boolean | null
          has_ssl?: boolean | null
          has_viewport_meta?: boolean | null
          html_bytes?: number | null
          html_hash?: string | null
          http_status?: number | null
          id?: string
          meta_description?: string | null
          mobile_score?: number | null
          performance_score?: number | null
          redirect_chain?: Json
          scan_depth?: string
          scan_error?: string | null
          seo_score?: number | null
          siren_found_in_legal?: string | null
          ssl_expires_at?: string | null
          tech_hash?: string | null
          technologies?: Json
          title?: string | null
          ttfb_ms?: number | null
        }
        Update: {
          accessibility_score?: number | null
          booking_detected?: boolean
          captured_at?: string
          cms?: string | null
          company_id?: string
          contact_form_detected?: boolean
          copyright_year?: number | null
          domain?: string
          ecommerce_detected?: boolean
          final_url?: string | null
          framework?: string | null
          has_media_queries?: boolean | null
          has_ssl?: boolean | null
          has_viewport_meta?: boolean | null
          html_bytes?: number | null
          html_hash?: string | null
          http_status?: number | null
          id?: string
          meta_description?: string | null
          mobile_score?: number | null
          performance_score?: number | null
          redirect_chain?: Json
          scan_depth?: string
          scan_error?: string | null
          seo_score?: number | null
          siren_found_in_legal?: string | null
          ssl_expires_at?: string | null
          tech_hash?: string | null
          technologies?: Json
          title?: string | null
          ttfb_ms?: number | null
        }
        Relationships: []
      }
      website_snapshots_202509: {
        Row: {
          accessibility_score: number | null
          booking_detected: boolean
          captured_at: string
          cms: string | null
          company_id: string
          contact_form_detected: boolean
          copyright_year: number | null
          domain: string
          ecommerce_detected: boolean
          final_url: string | null
          framework: string | null
          has_media_queries: boolean | null
          has_ssl: boolean | null
          has_viewport_meta: boolean | null
          html_bytes: number | null
          html_hash: string | null
          http_status: number | null
          id: string
          meta_description: string | null
          mobile_score: number | null
          performance_score: number | null
          redirect_chain: Json
          scan_depth: string
          scan_error: string | null
          seo_score: number | null
          siren_found_in_legal: string | null
          ssl_expires_at: string | null
          tech_hash: string | null
          technologies: Json
          title: string | null
          ttfb_ms: number | null
        }
        Insert: {
          accessibility_score?: number | null
          booking_detected?: boolean
          captured_at?: string
          cms?: string | null
          company_id: string
          contact_form_detected?: boolean
          copyright_year?: number | null
          domain: string
          ecommerce_detected?: boolean
          final_url?: string | null
          framework?: string | null
          has_media_queries?: boolean | null
          has_ssl?: boolean | null
          has_viewport_meta?: boolean | null
          html_bytes?: number | null
          html_hash?: string | null
          http_status?: number | null
          id?: string
          meta_description?: string | null
          mobile_score?: number | null
          performance_score?: number | null
          redirect_chain?: Json
          scan_depth?: string
          scan_error?: string | null
          seo_score?: number | null
          siren_found_in_legal?: string | null
          ssl_expires_at?: string | null
          tech_hash?: string | null
          technologies?: Json
          title?: string | null
          ttfb_ms?: number | null
        }
        Update: {
          accessibility_score?: number | null
          booking_detected?: boolean
          captured_at?: string
          cms?: string | null
          company_id?: string
          contact_form_detected?: boolean
          copyright_year?: number | null
          domain?: string
          ecommerce_detected?: boolean
          final_url?: string | null
          framework?: string | null
          has_media_queries?: boolean | null
          has_ssl?: boolean | null
          has_viewport_meta?: boolean | null
          html_bytes?: number | null
          html_hash?: string | null
          http_status?: number | null
          id?: string
          meta_description?: string | null
          mobile_score?: number | null
          performance_score?: number | null
          redirect_chain?: Json
          scan_depth?: string
          scan_error?: string | null
          seo_score?: number | null
          siren_found_in_legal?: string | null
          ssl_expires_at?: string | null
          tech_hash?: string | null
          technologies?: Json
          title?: string | null
          ttfb_ms?: number | null
        }
        Relationships: []
      }
      website_snapshots_202510: {
        Row: {
          accessibility_score: number | null
          booking_detected: boolean
          captured_at: string
          cms: string | null
          company_id: string
          contact_form_detected: boolean
          copyright_year: number | null
          domain: string
          ecommerce_detected: boolean
          final_url: string | null
          framework: string | null
          has_media_queries: boolean | null
          has_ssl: boolean | null
          has_viewport_meta: boolean | null
          html_bytes: number | null
          html_hash: string | null
          http_status: number | null
          id: string
          meta_description: string | null
          mobile_score: number | null
          performance_score: number | null
          redirect_chain: Json
          scan_depth: string
          scan_error: string | null
          seo_score: number | null
          siren_found_in_legal: string | null
          ssl_expires_at: string | null
          tech_hash: string | null
          technologies: Json
          title: string | null
          ttfb_ms: number | null
        }
        Insert: {
          accessibility_score?: number | null
          booking_detected?: boolean
          captured_at?: string
          cms?: string | null
          company_id: string
          contact_form_detected?: boolean
          copyright_year?: number | null
          domain: string
          ecommerce_detected?: boolean
          final_url?: string | null
          framework?: string | null
          has_media_queries?: boolean | null
          has_ssl?: boolean | null
          has_viewport_meta?: boolean | null
          html_bytes?: number | null
          html_hash?: string | null
          http_status?: number | null
          id?: string
          meta_description?: string | null
          mobile_score?: number | null
          performance_score?: number | null
          redirect_chain?: Json
          scan_depth?: string
          scan_error?: string | null
          seo_score?: number | null
          siren_found_in_legal?: string | null
          ssl_expires_at?: string | null
          tech_hash?: string | null
          technologies?: Json
          title?: string | null
          ttfb_ms?: number | null
        }
        Update: {
          accessibility_score?: number | null
          booking_detected?: boolean
          captured_at?: string
          cms?: string | null
          company_id?: string
          contact_form_detected?: boolean
          copyright_year?: number | null
          domain?: string
          ecommerce_detected?: boolean
          final_url?: string | null
          framework?: string | null
          has_media_queries?: boolean | null
          has_ssl?: boolean | null
          has_viewport_meta?: boolean | null
          html_bytes?: number | null
          html_hash?: string | null
          http_status?: number | null
          id?: string
          meta_description?: string | null
          mobile_score?: number | null
          performance_score?: number | null
          redirect_chain?: Json
          scan_depth?: string
          scan_error?: string | null
          seo_score?: number | null
          siren_found_in_legal?: string | null
          ssl_expires_at?: string | null
          tech_hash?: string | null
          technologies?: Json
          title?: string | null
          ttfb_ms?: number | null
        }
        Relationships: []
      }
      website_snapshots_202511: {
        Row: {
          accessibility_score: number | null
          booking_detected: boolean
          captured_at: string
          cms: string | null
          company_id: string
          contact_form_detected: boolean
          copyright_year: number | null
          domain: string
          ecommerce_detected: boolean
          final_url: string | null
          framework: string | null
          has_media_queries: boolean | null
          has_ssl: boolean | null
          has_viewport_meta: boolean | null
          html_bytes: number | null
          html_hash: string | null
          http_status: number | null
          id: string
          meta_description: string | null
          mobile_score: number | null
          performance_score: number | null
          redirect_chain: Json
          scan_depth: string
          scan_error: string | null
          seo_score: number | null
          siren_found_in_legal: string | null
          ssl_expires_at: string | null
          tech_hash: string | null
          technologies: Json
          title: string | null
          ttfb_ms: number | null
        }
        Insert: {
          accessibility_score?: number | null
          booking_detected?: boolean
          captured_at?: string
          cms?: string | null
          company_id: string
          contact_form_detected?: boolean
          copyright_year?: number | null
          domain: string
          ecommerce_detected?: boolean
          final_url?: string | null
          framework?: string | null
          has_media_queries?: boolean | null
          has_ssl?: boolean | null
          has_viewport_meta?: boolean | null
          html_bytes?: number | null
          html_hash?: string | null
          http_status?: number | null
          id?: string
          meta_description?: string | null
          mobile_score?: number | null
          performance_score?: number | null
          redirect_chain?: Json
          scan_depth?: string
          scan_error?: string | null
          seo_score?: number | null
          siren_found_in_legal?: string | null
          ssl_expires_at?: string | null
          tech_hash?: string | null
          technologies?: Json
          title?: string | null
          ttfb_ms?: number | null
        }
        Update: {
          accessibility_score?: number | null
          booking_detected?: boolean
          captured_at?: string
          cms?: string | null
          company_id?: string
          contact_form_detected?: boolean
          copyright_year?: number | null
          domain?: string
          ecommerce_detected?: boolean
          final_url?: string | null
          framework?: string | null
          has_media_queries?: boolean | null
          has_ssl?: boolean | null
          has_viewport_meta?: boolean | null
          html_bytes?: number | null
          html_hash?: string | null
          http_status?: number | null
          id?: string
          meta_description?: string | null
          mobile_score?: number | null
          performance_score?: number | null
          redirect_chain?: Json
          scan_depth?: string
          scan_error?: string | null
          seo_score?: number | null
          siren_found_in_legal?: string | null
          ssl_expires_at?: string | null
          tech_hash?: string | null
          technologies?: Json
          title?: string | null
          ttfb_ms?: number | null
        }
        Relationships: []
      }
      website_snapshots_202512: {
        Row: {
          accessibility_score: number | null
          booking_detected: boolean
          captured_at: string
          cms: string | null
          company_id: string
          contact_form_detected: boolean
          copyright_year: number | null
          domain: string
          ecommerce_detected: boolean
          final_url: string | null
          framework: string | null
          has_media_queries: boolean | null
          has_ssl: boolean | null
          has_viewport_meta: boolean | null
          html_bytes: number | null
          html_hash: string | null
          http_status: number | null
          id: string
          meta_description: string | null
          mobile_score: number | null
          performance_score: number | null
          redirect_chain: Json
          scan_depth: string
          scan_error: string | null
          seo_score: number | null
          siren_found_in_legal: string | null
          ssl_expires_at: string | null
          tech_hash: string | null
          technologies: Json
          title: string | null
          ttfb_ms: number | null
        }
        Insert: {
          accessibility_score?: number | null
          booking_detected?: boolean
          captured_at?: string
          cms?: string | null
          company_id: string
          contact_form_detected?: boolean
          copyright_year?: number | null
          domain: string
          ecommerce_detected?: boolean
          final_url?: string | null
          framework?: string | null
          has_media_queries?: boolean | null
          has_ssl?: boolean | null
          has_viewport_meta?: boolean | null
          html_bytes?: number | null
          html_hash?: string | null
          http_status?: number | null
          id?: string
          meta_description?: string | null
          mobile_score?: number | null
          performance_score?: number | null
          redirect_chain?: Json
          scan_depth?: string
          scan_error?: string | null
          seo_score?: number | null
          siren_found_in_legal?: string | null
          ssl_expires_at?: string | null
          tech_hash?: string | null
          technologies?: Json
          title?: string | null
          ttfb_ms?: number | null
        }
        Update: {
          accessibility_score?: number | null
          booking_detected?: boolean
          captured_at?: string
          cms?: string | null
          company_id?: string
          contact_form_detected?: boolean
          copyright_year?: number | null
          domain?: string
          ecommerce_detected?: boolean
          final_url?: string | null
          framework?: string | null
          has_media_queries?: boolean | null
          has_ssl?: boolean | null
          has_viewport_meta?: boolean | null
          html_bytes?: number | null
          html_hash?: string | null
          http_status?: number | null
          id?: string
          meta_description?: string | null
          mobile_score?: number | null
          performance_score?: number | null
          redirect_chain?: Json
          scan_depth?: string
          scan_error?: string | null
          seo_score?: number | null
          siren_found_in_legal?: string | null
          ssl_expires_at?: string | null
          tech_hash?: string | null
          technologies?: Json
          title?: string | null
          ttfb_ms?: number | null
        }
        Relationships: []
      }
      website_snapshots_202601: {
        Row: {
          accessibility_score: number | null
          booking_detected: boolean
          captured_at: string
          cms: string | null
          company_id: string
          contact_form_detected: boolean
          copyright_year: number | null
          domain: string
          ecommerce_detected: boolean
          final_url: string | null
          framework: string | null
          has_media_queries: boolean | null
          has_ssl: boolean | null
          has_viewport_meta: boolean | null
          html_bytes: number | null
          html_hash: string | null
          http_status: number | null
          id: string
          meta_description: string | null
          mobile_score: number | null
          performance_score: number | null
          redirect_chain: Json
          scan_depth: string
          scan_error: string | null
          seo_score: number | null
          siren_found_in_legal: string | null
          ssl_expires_at: string | null
          tech_hash: string | null
          technologies: Json
          title: string | null
          ttfb_ms: number | null
        }
        Insert: {
          accessibility_score?: number | null
          booking_detected?: boolean
          captured_at?: string
          cms?: string | null
          company_id: string
          contact_form_detected?: boolean
          copyright_year?: number | null
          domain: string
          ecommerce_detected?: boolean
          final_url?: string | null
          framework?: string | null
          has_media_queries?: boolean | null
          has_ssl?: boolean | null
          has_viewport_meta?: boolean | null
          html_bytes?: number | null
          html_hash?: string | null
          http_status?: number | null
          id?: string
          meta_description?: string | null
          mobile_score?: number | null
          performance_score?: number | null
          redirect_chain?: Json
          scan_depth?: string
          scan_error?: string | null
          seo_score?: number | null
          siren_found_in_legal?: string | null
          ssl_expires_at?: string | null
          tech_hash?: string | null
          technologies?: Json
          title?: string | null
          ttfb_ms?: number | null
        }
        Update: {
          accessibility_score?: number | null
          booking_detected?: boolean
          captured_at?: string
          cms?: string | null
          company_id?: string
          contact_form_detected?: boolean
          copyright_year?: number | null
          domain?: string
          ecommerce_detected?: boolean
          final_url?: string | null
          framework?: string | null
          has_media_queries?: boolean | null
          has_ssl?: boolean | null
          has_viewport_meta?: boolean | null
          html_bytes?: number | null
          html_hash?: string | null
          http_status?: number | null
          id?: string
          meta_description?: string | null
          mobile_score?: number | null
          performance_score?: number | null
          redirect_chain?: Json
          scan_depth?: string
          scan_error?: string | null
          seo_score?: number | null
          siren_found_in_legal?: string | null
          ssl_expires_at?: string | null
          tech_hash?: string | null
          technologies?: Json
          title?: string | null
          ttfb_ms?: number | null
        }
        Relationships: []
      }
      website_snapshots_202602: {
        Row: {
          accessibility_score: number | null
          booking_detected: boolean
          captured_at: string
          cms: string | null
          company_id: string
          contact_form_detected: boolean
          copyright_year: number | null
          domain: string
          ecommerce_detected: boolean
          final_url: string | null
          framework: string | null
          has_media_queries: boolean | null
          has_ssl: boolean | null
          has_viewport_meta: boolean | null
          html_bytes: number | null
          html_hash: string | null
          http_status: number | null
          id: string
          meta_description: string | null
          mobile_score: number | null
          performance_score: number | null
          redirect_chain: Json
          scan_depth: string
          scan_error: string | null
          seo_score: number | null
          siren_found_in_legal: string | null
          ssl_expires_at: string | null
          tech_hash: string | null
          technologies: Json
          title: string | null
          ttfb_ms: number | null
        }
        Insert: {
          accessibility_score?: number | null
          booking_detected?: boolean
          captured_at?: string
          cms?: string | null
          company_id: string
          contact_form_detected?: boolean
          copyright_year?: number | null
          domain: string
          ecommerce_detected?: boolean
          final_url?: string | null
          framework?: string | null
          has_media_queries?: boolean | null
          has_ssl?: boolean | null
          has_viewport_meta?: boolean | null
          html_bytes?: number | null
          html_hash?: string | null
          http_status?: number | null
          id?: string
          meta_description?: string | null
          mobile_score?: number | null
          performance_score?: number | null
          redirect_chain?: Json
          scan_depth?: string
          scan_error?: string | null
          seo_score?: number | null
          siren_found_in_legal?: string | null
          ssl_expires_at?: string | null
          tech_hash?: string | null
          technologies?: Json
          title?: string | null
          ttfb_ms?: number | null
        }
        Update: {
          accessibility_score?: number | null
          booking_detected?: boolean
          captured_at?: string
          cms?: string | null
          company_id?: string
          contact_form_detected?: boolean
          copyright_year?: number | null
          domain?: string
          ecommerce_detected?: boolean
          final_url?: string | null
          framework?: string | null
          has_media_queries?: boolean | null
          has_ssl?: boolean | null
          has_viewport_meta?: boolean | null
          html_bytes?: number | null
          html_hash?: string | null
          http_status?: number | null
          id?: string
          meta_description?: string | null
          mobile_score?: number | null
          performance_score?: number | null
          redirect_chain?: Json
          scan_depth?: string
          scan_error?: string | null
          seo_score?: number | null
          siren_found_in_legal?: string | null
          ssl_expires_at?: string | null
          tech_hash?: string | null
          technologies?: Json
          title?: string | null
          ttfb_ms?: number | null
        }
        Relationships: []
      }
      website_snapshots_202603: {
        Row: {
          accessibility_score: number | null
          booking_detected: boolean
          captured_at: string
          cms: string | null
          company_id: string
          contact_form_detected: boolean
          copyright_year: number | null
          domain: string
          ecommerce_detected: boolean
          final_url: string | null
          framework: string | null
          has_media_queries: boolean | null
          has_ssl: boolean | null
          has_viewport_meta: boolean | null
          html_bytes: number | null
          html_hash: string | null
          http_status: number | null
          id: string
          meta_description: string | null
          mobile_score: number | null
          performance_score: number | null
          redirect_chain: Json
          scan_depth: string
          scan_error: string | null
          seo_score: number | null
          siren_found_in_legal: string | null
          ssl_expires_at: string | null
          tech_hash: string | null
          technologies: Json
          title: string | null
          ttfb_ms: number | null
        }
        Insert: {
          accessibility_score?: number | null
          booking_detected?: boolean
          captured_at?: string
          cms?: string | null
          company_id: string
          contact_form_detected?: boolean
          copyright_year?: number | null
          domain: string
          ecommerce_detected?: boolean
          final_url?: string | null
          framework?: string | null
          has_media_queries?: boolean | null
          has_ssl?: boolean | null
          has_viewport_meta?: boolean | null
          html_bytes?: number | null
          html_hash?: string | null
          http_status?: number | null
          id?: string
          meta_description?: string | null
          mobile_score?: number | null
          performance_score?: number | null
          redirect_chain?: Json
          scan_depth?: string
          scan_error?: string | null
          seo_score?: number | null
          siren_found_in_legal?: string | null
          ssl_expires_at?: string | null
          tech_hash?: string | null
          technologies?: Json
          title?: string | null
          ttfb_ms?: number | null
        }
        Update: {
          accessibility_score?: number | null
          booking_detected?: boolean
          captured_at?: string
          cms?: string | null
          company_id?: string
          contact_form_detected?: boolean
          copyright_year?: number | null
          domain?: string
          ecommerce_detected?: boolean
          final_url?: string | null
          framework?: string | null
          has_media_queries?: boolean | null
          has_ssl?: boolean | null
          has_viewport_meta?: boolean | null
          html_bytes?: number | null
          html_hash?: string | null
          http_status?: number | null
          id?: string
          meta_description?: string | null
          mobile_score?: number | null
          performance_score?: number | null
          redirect_chain?: Json
          scan_depth?: string
          scan_error?: string | null
          seo_score?: number | null
          siren_found_in_legal?: string | null
          ssl_expires_at?: string | null
          tech_hash?: string | null
          technologies?: Json
          title?: string | null
          ttfb_ms?: number | null
        }
        Relationships: []
      }
      website_snapshots_202604: {
        Row: {
          accessibility_score: number | null
          booking_detected: boolean
          captured_at: string
          cms: string | null
          company_id: string
          contact_form_detected: boolean
          copyright_year: number | null
          domain: string
          ecommerce_detected: boolean
          final_url: string | null
          framework: string | null
          has_media_queries: boolean | null
          has_ssl: boolean | null
          has_viewport_meta: boolean | null
          html_bytes: number | null
          html_hash: string | null
          http_status: number | null
          id: string
          meta_description: string | null
          mobile_score: number | null
          performance_score: number | null
          redirect_chain: Json
          scan_depth: string
          scan_error: string | null
          seo_score: number | null
          siren_found_in_legal: string | null
          ssl_expires_at: string | null
          tech_hash: string | null
          technologies: Json
          title: string | null
          ttfb_ms: number | null
        }
        Insert: {
          accessibility_score?: number | null
          booking_detected?: boolean
          captured_at?: string
          cms?: string | null
          company_id: string
          contact_form_detected?: boolean
          copyright_year?: number | null
          domain: string
          ecommerce_detected?: boolean
          final_url?: string | null
          framework?: string | null
          has_media_queries?: boolean | null
          has_ssl?: boolean | null
          has_viewport_meta?: boolean | null
          html_bytes?: number | null
          html_hash?: string | null
          http_status?: number | null
          id?: string
          meta_description?: string | null
          mobile_score?: number | null
          performance_score?: number | null
          redirect_chain?: Json
          scan_depth?: string
          scan_error?: string | null
          seo_score?: number | null
          siren_found_in_legal?: string | null
          ssl_expires_at?: string | null
          tech_hash?: string | null
          technologies?: Json
          title?: string | null
          ttfb_ms?: number | null
        }
        Update: {
          accessibility_score?: number | null
          booking_detected?: boolean
          captured_at?: string
          cms?: string | null
          company_id?: string
          contact_form_detected?: boolean
          copyright_year?: number | null
          domain?: string
          ecommerce_detected?: boolean
          final_url?: string | null
          framework?: string | null
          has_media_queries?: boolean | null
          has_ssl?: boolean | null
          has_viewport_meta?: boolean | null
          html_bytes?: number | null
          html_hash?: string | null
          http_status?: number | null
          id?: string
          meta_description?: string | null
          mobile_score?: number | null
          performance_score?: number | null
          redirect_chain?: Json
          scan_depth?: string
          scan_error?: string | null
          seo_score?: number | null
          siren_found_in_legal?: string | null
          ssl_expires_at?: string | null
          tech_hash?: string | null
          technologies?: Json
          title?: string | null
          ttfb_ms?: number | null
        }
        Relationships: []
      }
      website_snapshots_202605: {
        Row: {
          accessibility_score: number | null
          booking_detected: boolean
          captured_at: string
          cms: string | null
          company_id: string
          contact_form_detected: boolean
          copyright_year: number | null
          domain: string
          ecommerce_detected: boolean
          final_url: string | null
          framework: string | null
          has_media_queries: boolean | null
          has_ssl: boolean | null
          has_viewport_meta: boolean | null
          html_bytes: number | null
          html_hash: string | null
          http_status: number | null
          id: string
          meta_description: string | null
          mobile_score: number | null
          performance_score: number | null
          redirect_chain: Json
          scan_depth: string
          scan_error: string | null
          seo_score: number | null
          siren_found_in_legal: string | null
          ssl_expires_at: string | null
          tech_hash: string | null
          technologies: Json
          title: string | null
          ttfb_ms: number | null
        }
        Insert: {
          accessibility_score?: number | null
          booking_detected?: boolean
          captured_at?: string
          cms?: string | null
          company_id: string
          contact_form_detected?: boolean
          copyright_year?: number | null
          domain: string
          ecommerce_detected?: boolean
          final_url?: string | null
          framework?: string | null
          has_media_queries?: boolean | null
          has_ssl?: boolean | null
          has_viewport_meta?: boolean | null
          html_bytes?: number | null
          html_hash?: string | null
          http_status?: number | null
          id?: string
          meta_description?: string | null
          mobile_score?: number | null
          performance_score?: number | null
          redirect_chain?: Json
          scan_depth?: string
          scan_error?: string | null
          seo_score?: number | null
          siren_found_in_legal?: string | null
          ssl_expires_at?: string | null
          tech_hash?: string | null
          technologies?: Json
          title?: string | null
          ttfb_ms?: number | null
        }
        Update: {
          accessibility_score?: number | null
          booking_detected?: boolean
          captured_at?: string
          cms?: string | null
          company_id?: string
          contact_form_detected?: boolean
          copyright_year?: number | null
          domain?: string
          ecommerce_detected?: boolean
          final_url?: string | null
          framework?: string | null
          has_media_queries?: boolean | null
          has_ssl?: boolean | null
          has_viewport_meta?: boolean | null
          html_bytes?: number | null
          html_hash?: string | null
          http_status?: number | null
          id?: string
          meta_description?: string | null
          mobile_score?: number | null
          performance_score?: number | null
          redirect_chain?: Json
          scan_depth?: string
          scan_error?: string | null
          seo_score?: number | null
          siren_found_in_legal?: string | null
          ssl_expires_at?: string | null
          tech_hash?: string | null
          technologies?: Json
          title?: string | null
          ttfb_ms?: number | null
        }
        Relationships: []
      }
      website_snapshots_202606: {
        Row: {
          accessibility_score: number | null
          booking_detected: boolean
          captured_at: string
          cms: string | null
          company_id: string
          contact_form_detected: boolean
          copyright_year: number | null
          domain: string
          ecommerce_detected: boolean
          final_url: string | null
          framework: string | null
          has_media_queries: boolean | null
          has_ssl: boolean | null
          has_viewport_meta: boolean | null
          html_bytes: number | null
          html_hash: string | null
          http_status: number | null
          id: string
          meta_description: string | null
          mobile_score: number | null
          performance_score: number | null
          redirect_chain: Json
          scan_depth: string
          scan_error: string | null
          seo_score: number | null
          siren_found_in_legal: string | null
          ssl_expires_at: string | null
          tech_hash: string | null
          technologies: Json
          title: string | null
          ttfb_ms: number | null
        }
        Insert: {
          accessibility_score?: number | null
          booking_detected?: boolean
          captured_at?: string
          cms?: string | null
          company_id: string
          contact_form_detected?: boolean
          copyright_year?: number | null
          domain: string
          ecommerce_detected?: boolean
          final_url?: string | null
          framework?: string | null
          has_media_queries?: boolean | null
          has_ssl?: boolean | null
          has_viewport_meta?: boolean | null
          html_bytes?: number | null
          html_hash?: string | null
          http_status?: number | null
          id?: string
          meta_description?: string | null
          mobile_score?: number | null
          performance_score?: number | null
          redirect_chain?: Json
          scan_depth?: string
          scan_error?: string | null
          seo_score?: number | null
          siren_found_in_legal?: string | null
          ssl_expires_at?: string | null
          tech_hash?: string | null
          technologies?: Json
          title?: string | null
          ttfb_ms?: number | null
        }
        Update: {
          accessibility_score?: number | null
          booking_detected?: boolean
          captured_at?: string
          cms?: string | null
          company_id?: string
          contact_form_detected?: boolean
          copyright_year?: number | null
          domain?: string
          ecommerce_detected?: boolean
          final_url?: string | null
          framework?: string | null
          has_media_queries?: boolean | null
          has_ssl?: boolean | null
          has_viewport_meta?: boolean | null
          html_bytes?: number | null
          html_hash?: string | null
          http_status?: number | null
          id?: string
          meta_description?: string | null
          mobile_score?: number | null
          performance_score?: number | null
          redirect_chain?: Json
          scan_depth?: string
          scan_error?: string | null
          seo_score?: number | null
          siren_found_in_legal?: string | null
          ssl_expires_at?: string | null
          tech_hash?: string | null
          technologies?: Json
          title?: string | null
          ttfb_ms?: number | null
        }
        Relationships: []
      }
      website_snapshots_202607: {
        Row: {
          accessibility_score: number | null
          booking_detected: boolean
          captured_at: string
          cms: string | null
          company_id: string
          contact_form_detected: boolean
          copyright_year: number | null
          domain: string
          ecommerce_detected: boolean
          final_url: string | null
          framework: string | null
          has_media_queries: boolean | null
          has_ssl: boolean | null
          has_viewport_meta: boolean | null
          html_bytes: number | null
          html_hash: string | null
          http_status: number | null
          id: string
          meta_description: string | null
          mobile_score: number | null
          performance_score: number | null
          redirect_chain: Json
          scan_depth: string
          scan_error: string | null
          seo_score: number | null
          siren_found_in_legal: string | null
          ssl_expires_at: string | null
          tech_hash: string | null
          technologies: Json
          title: string | null
          ttfb_ms: number | null
        }
        Insert: {
          accessibility_score?: number | null
          booking_detected?: boolean
          captured_at?: string
          cms?: string | null
          company_id: string
          contact_form_detected?: boolean
          copyright_year?: number | null
          domain: string
          ecommerce_detected?: boolean
          final_url?: string | null
          framework?: string | null
          has_media_queries?: boolean | null
          has_ssl?: boolean | null
          has_viewport_meta?: boolean | null
          html_bytes?: number | null
          html_hash?: string | null
          http_status?: number | null
          id?: string
          meta_description?: string | null
          mobile_score?: number | null
          performance_score?: number | null
          redirect_chain?: Json
          scan_depth?: string
          scan_error?: string | null
          seo_score?: number | null
          siren_found_in_legal?: string | null
          ssl_expires_at?: string | null
          tech_hash?: string | null
          technologies?: Json
          title?: string | null
          ttfb_ms?: number | null
        }
        Update: {
          accessibility_score?: number | null
          booking_detected?: boolean
          captured_at?: string
          cms?: string | null
          company_id?: string
          contact_form_detected?: boolean
          copyright_year?: number | null
          domain?: string
          ecommerce_detected?: boolean
          final_url?: string | null
          framework?: string | null
          has_media_queries?: boolean | null
          has_ssl?: boolean | null
          has_viewport_meta?: boolean | null
          html_bytes?: number | null
          html_hash?: string | null
          http_status?: number | null
          id?: string
          meta_description?: string | null
          mobile_score?: number | null
          performance_score?: number | null
          redirect_chain?: Json
          scan_depth?: string
          scan_error?: string | null
          seo_score?: number | null
          siren_found_in_legal?: string | null
          ssl_expires_at?: string | null
          tech_hash?: string | null
          technologies?: Json
          title?: string | null
          ttfb_ms?: number | null
        }
        Relationships: []
      }
      website_snapshots_202608: {
        Row: {
          accessibility_score: number | null
          booking_detected: boolean
          captured_at: string
          cms: string | null
          company_id: string
          contact_form_detected: boolean
          copyright_year: number | null
          domain: string
          ecommerce_detected: boolean
          final_url: string | null
          framework: string | null
          has_media_queries: boolean | null
          has_ssl: boolean | null
          has_viewport_meta: boolean | null
          html_bytes: number | null
          html_hash: string | null
          http_status: number | null
          id: string
          meta_description: string | null
          mobile_score: number | null
          performance_score: number | null
          redirect_chain: Json
          scan_depth: string
          scan_error: string | null
          seo_score: number | null
          siren_found_in_legal: string | null
          ssl_expires_at: string | null
          tech_hash: string | null
          technologies: Json
          title: string | null
          ttfb_ms: number | null
        }
        Insert: {
          accessibility_score?: number | null
          booking_detected?: boolean
          captured_at?: string
          cms?: string | null
          company_id: string
          contact_form_detected?: boolean
          copyright_year?: number | null
          domain: string
          ecommerce_detected?: boolean
          final_url?: string | null
          framework?: string | null
          has_media_queries?: boolean | null
          has_ssl?: boolean | null
          has_viewport_meta?: boolean | null
          html_bytes?: number | null
          html_hash?: string | null
          http_status?: number | null
          id?: string
          meta_description?: string | null
          mobile_score?: number | null
          performance_score?: number | null
          redirect_chain?: Json
          scan_depth?: string
          scan_error?: string | null
          seo_score?: number | null
          siren_found_in_legal?: string | null
          ssl_expires_at?: string | null
          tech_hash?: string | null
          technologies?: Json
          title?: string | null
          ttfb_ms?: number | null
        }
        Update: {
          accessibility_score?: number | null
          booking_detected?: boolean
          captured_at?: string
          cms?: string | null
          company_id?: string
          contact_form_detected?: boolean
          copyright_year?: number | null
          domain?: string
          ecommerce_detected?: boolean
          final_url?: string | null
          framework?: string | null
          has_media_queries?: boolean | null
          has_ssl?: boolean | null
          has_viewport_meta?: boolean | null
          html_bytes?: number | null
          html_hash?: string | null
          http_status?: number | null
          id?: string
          meta_description?: string | null
          mobile_score?: number | null
          performance_score?: number | null
          redirect_chain?: Json
          scan_depth?: string
          scan_error?: string | null
          seo_score?: number | null
          siren_found_in_legal?: string | null
          ssl_expires_at?: string | null
          tech_hash?: string | null
          technologies?: Json
          title?: string | null
          ttfb_ms?: number | null
        }
        Relationships: []
      }
      website_snapshots_202609: {
        Row: {
          accessibility_score: number | null
          booking_detected: boolean
          captured_at: string
          cms: string | null
          company_id: string
          contact_form_detected: boolean
          copyright_year: number | null
          domain: string
          ecommerce_detected: boolean
          final_url: string | null
          framework: string | null
          has_media_queries: boolean | null
          has_ssl: boolean | null
          has_viewport_meta: boolean | null
          html_bytes: number | null
          html_hash: string | null
          http_status: number | null
          id: string
          meta_description: string | null
          mobile_score: number | null
          performance_score: number | null
          redirect_chain: Json
          scan_depth: string
          scan_error: string | null
          seo_score: number | null
          siren_found_in_legal: string | null
          ssl_expires_at: string | null
          tech_hash: string | null
          technologies: Json
          title: string | null
          ttfb_ms: number | null
        }
        Insert: {
          accessibility_score?: number | null
          booking_detected?: boolean
          captured_at?: string
          cms?: string | null
          company_id: string
          contact_form_detected?: boolean
          copyright_year?: number | null
          domain: string
          ecommerce_detected?: boolean
          final_url?: string | null
          framework?: string | null
          has_media_queries?: boolean | null
          has_ssl?: boolean | null
          has_viewport_meta?: boolean | null
          html_bytes?: number | null
          html_hash?: string | null
          http_status?: number | null
          id?: string
          meta_description?: string | null
          mobile_score?: number | null
          performance_score?: number | null
          redirect_chain?: Json
          scan_depth?: string
          scan_error?: string | null
          seo_score?: number | null
          siren_found_in_legal?: string | null
          ssl_expires_at?: string | null
          tech_hash?: string | null
          technologies?: Json
          title?: string | null
          ttfb_ms?: number | null
        }
        Update: {
          accessibility_score?: number | null
          booking_detected?: boolean
          captured_at?: string
          cms?: string | null
          company_id?: string
          contact_form_detected?: boolean
          copyright_year?: number | null
          domain?: string
          ecommerce_detected?: boolean
          final_url?: string | null
          framework?: string | null
          has_media_queries?: boolean | null
          has_ssl?: boolean | null
          has_viewport_meta?: boolean | null
          html_bytes?: number | null
          html_hash?: string | null
          http_status?: number | null
          id?: string
          meta_description?: string | null
          mobile_score?: number | null
          performance_score?: number | null
          redirect_chain?: Json
          scan_depth?: string
          scan_error?: string | null
          seo_score?: number | null
          siren_found_in_legal?: string | null
          ssl_expires_at?: string | null
          tech_hash?: string | null
          technologies?: Json
          title?: string | null
          ttfb_ms?: number | null
        }
        Relationships: []
      }
      website_snapshots_202610: {
        Row: {
          accessibility_score: number | null
          booking_detected: boolean
          captured_at: string
          cms: string | null
          company_id: string
          contact_form_detected: boolean
          copyright_year: number | null
          domain: string
          ecommerce_detected: boolean
          final_url: string | null
          framework: string | null
          has_media_queries: boolean | null
          has_ssl: boolean | null
          has_viewport_meta: boolean | null
          html_bytes: number | null
          html_hash: string | null
          http_status: number | null
          id: string
          meta_description: string | null
          mobile_score: number | null
          performance_score: number | null
          redirect_chain: Json
          scan_depth: string
          scan_error: string | null
          seo_score: number | null
          siren_found_in_legal: string | null
          ssl_expires_at: string | null
          tech_hash: string | null
          technologies: Json
          title: string | null
          ttfb_ms: number | null
        }
        Insert: {
          accessibility_score?: number | null
          booking_detected?: boolean
          captured_at?: string
          cms?: string | null
          company_id: string
          contact_form_detected?: boolean
          copyright_year?: number | null
          domain: string
          ecommerce_detected?: boolean
          final_url?: string | null
          framework?: string | null
          has_media_queries?: boolean | null
          has_ssl?: boolean | null
          has_viewport_meta?: boolean | null
          html_bytes?: number | null
          html_hash?: string | null
          http_status?: number | null
          id?: string
          meta_description?: string | null
          mobile_score?: number | null
          performance_score?: number | null
          redirect_chain?: Json
          scan_depth?: string
          scan_error?: string | null
          seo_score?: number | null
          siren_found_in_legal?: string | null
          ssl_expires_at?: string | null
          tech_hash?: string | null
          technologies?: Json
          title?: string | null
          ttfb_ms?: number | null
        }
        Update: {
          accessibility_score?: number | null
          booking_detected?: boolean
          captured_at?: string
          cms?: string | null
          company_id?: string
          contact_form_detected?: boolean
          copyright_year?: number | null
          domain?: string
          ecommerce_detected?: boolean
          final_url?: string | null
          framework?: string | null
          has_media_queries?: boolean | null
          has_ssl?: boolean | null
          has_viewport_meta?: boolean | null
          html_bytes?: number | null
          html_hash?: string | null
          http_status?: number | null
          id?: string
          meta_description?: string | null
          mobile_score?: number | null
          performance_score?: number | null
          redirect_chain?: Json
          scan_depth?: string
          scan_error?: string | null
          seo_score?: number | null
          siren_found_in_legal?: string | null
          ssl_expires_at?: string | null
          tech_hash?: string | null
          technologies?: Json
          title?: string | null
          ttfb_ms?: number | null
        }
        Relationships: []
      }
      website_snapshots_202611: {
        Row: {
          accessibility_score: number | null
          booking_detected: boolean
          captured_at: string
          cms: string | null
          company_id: string
          contact_form_detected: boolean
          copyright_year: number | null
          domain: string
          ecommerce_detected: boolean
          final_url: string | null
          framework: string | null
          has_media_queries: boolean | null
          has_ssl: boolean | null
          has_viewport_meta: boolean | null
          html_bytes: number | null
          html_hash: string | null
          http_status: number | null
          id: string
          meta_description: string | null
          mobile_score: number | null
          performance_score: number | null
          redirect_chain: Json
          scan_depth: string
          scan_error: string | null
          seo_score: number | null
          siren_found_in_legal: string | null
          ssl_expires_at: string | null
          tech_hash: string | null
          technologies: Json
          title: string | null
          ttfb_ms: number | null
        }
        Insert: {
          accessibility_score?: number | null
          booking_detected?: boolean
          captured_at?: string
          cms?: string | null
          company_id: string
          contact_form_detected?: boolean
          copyright_year?: number | null
          domain: string
          ecommerce_detected?: boolean
          final_url?: string | null
          framework?: string | null
          has_media_queries?: boolean | null
          has_ssl?: boolean | null
          has_viewport_meta?: boolean | null
          html_bytes?: number | null
          html_hash?: string | null
          http_status?: number | null
          id?: string
          meta_description?: string | null
          mobile_score?: number | null
          performance_score?: number | null
          redirect_chain?: Json
          scan_depth?: string
          scan_error?: string | null
          seo_score?: number | null
          siren_found_in_legal?: string | null
          ssl_expires_at?: string | null
          tech_hash?: string | null
          technologies?: Json
          title?: string | null
          ttfb_ms?: number | null
        }
        Update: {
          accessibility_score?: number | null
          booking_detected?: boolean
          captured_at?: string
          cms?: string | null
          company_id?: string
          contact_form_detected?: boolean
          copyright_year?: number | null
          domain?: string
          ecommerce_detected?: boolean
          final_url?: string | null
          framework?: string | null
          has_media_queries?: boolean | null
          has_ssl?: boolean | null
          has_viewport_meta?: boolean | null
          html_bytes?: number | null
          html_hash?: string | null
          http_status?: number | null
          id?: string
          meta_description?: string | null
          mobile_score?: number | null
          performance_score?: number | null
          redirect_chain?: Json
          scan_depth?: string
          scan_error?: string | null
          seo_score?: number | null
          siren_found_in_legal?: string | null
          ssl_expires_at?: string | null
          tech_hash?: string | null
          technologies?: Json
          title?: string | null
          ttfb_ms?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_jobs: {
        Args: { batch_size?: number; types?: string[]; worker: string }
        Returns: {
          attempts: number
          completed_at: string | null
          created_at: string
          dedupe_key: string | null
          id: number
          job_type: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          priority: number
          run_after: string
          status: Database["public"]["Enums"]["job_status"]
        }[]
        SetofOptions: {
          from: "*"
          to: "job_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      company_in_cooldown: {
        Args: { target_company: string }
        Returns: boolean
      }
      complete_job: { Args: { job_id: number }; Returns: undefined }
      ensure_month_partitions: {
        Args: { months_ahead?: number; months_back?: number }
        Returns: number
      }
      fail_job: {
        Args: { error_message: string; job_id: number }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      reclaim_stalled_jobs: {
        Args: { stalled_after?: string }
        Returns: number
      }
    }
    Enums: {
      app_role: "user" | "admin"
      assignment_outcome:
        | "no_response"
        | "not_interested"
        | "interested"
        | "meeting"
        | "proposal"
        | "client"
      assignment_status:
        | "active"
        | "contacted"
        | "completed"
        | "expired"
        | "released"
      company_segment: "local_commerce" | "b2b" | "ecommerce" | "other"
      company_status: "active" | "closed" | "unknown"
      cooldown_reason:
        | "no_response"
        | "not_interested"
        | "interested"
        | "meeting"
        | "proposal"
        | "client"
        | "expired_unused"
        | "manual"
        | "opt_out"
      job_status: "pending" | "running" | "done" | "failed" | "dead"
      location_mode: "france" | "region" | "city" | "france_remote"
      opportunity_status: "available" | "assigned" | "expired" | "rejected"
      opportunity_type:
        | "website_creation"
        | "website_redesign"
        | "ecommerce"
        | "web_application"
        | "mobile_application"
        | "ai_automation"
        | "seo"
        | "maintenance"
        | "other"
      signal_category: "need" | "timing" | "risk" | "quality"
      signal_kind: "trigger" | "modifier"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["user", "admin"],
      assignment_outcome: [
        "no_response",
        "not_interested",
        "interested",
        "meeting",
        "proposal",
        "client",
      ],
      assignment_status: [
        "active",
        "contacted",
        "completed",
        "expired",
        "released",
      ],
      company_segment: ["local_commerce", "b2b", "ecommerce", "other"],
      company_status: ["active", "closed", "unknown"],
      cooldown_reason: [
        "no_response",
        "not_interested",
        "interested",
        "meeting",
        "proposal",
        "client",
        "expired_unused",
        "manual",
        "opt_out",
      ],
      job_status: ["pending", "running", "done", "failed", "dead"],
      location_mode: ["france", "region", "city", "france_remote"],
      opportunity_status: ["available", "assigned", "expired", "rejected"],
      opportunity_type: [
        "website_creation",
        "website_redesign",
        "ecommerce",
        "web_application",
        "mobile_application",
        "ai_automation",
        "seo",
        "maintenance",
        "other",
      ],
      signal_category: ["need", "timing", "risk", "quality"],
      signal_kind: ["trigger", "modifier"],
    },
  },
} as const

