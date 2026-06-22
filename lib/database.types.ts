// Hand-written to mirror supabase/schema.sql (the Supabase CLI/MCP isn't linked
// to this project's account). Keep in sync with the schema; shape matches what
// `supabase gen types typescript` would emit so queries are fully typed.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      holdings: {
        Row: {
          id: string;
          user_id: string;
          ticker: string;
          asset_class: string;
          quantity: number;
          buy_price: number;
          buy_date: string;
          fi_index: string | null;
          fi_rate: number | null;
          fi_maturity: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          ticker: string;
          asset_class: string;
          quantity: number;
          buy_price?: number;
          buy_date?: string;
          fi_index?: string | null;
          fi_rate?: number | null;
          fi_maturity?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          ticker?: string;
          asset_class?: string;
          quantity?: number;
          buy_price?: number;
          buy_date?: string;
          fi_index?: string | null;
          fi_rate?: number | null;
          fi_maturity?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      contributions: {
        Row: {
          id: string;
          user_id: string;
          flow_date: string;
          amount: number;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          flow_date?: string;
          amount: number;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          flow_date?: string;
          amount?: number;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      snapshots: {
        Row: {
          id: string;
          user_id: string;
          snapshot_date: string;
          total_value: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          snapshot_date?: string;
          total_value: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          snapshot_date?: string;
          total_value?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      allocation_targets: {
        Row: {
          user_id: string;
          asset_class: string;
          target_pct: number;
        };
        Insert: {
          user_id: string;
          asset_class: string;
          target_pct: number;
        };
        Update: {
          user_id?: string;
          asset_class?: string;
          target_pct?: number;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
