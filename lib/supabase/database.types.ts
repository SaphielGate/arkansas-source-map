export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      evidence_items: {
        Row: { created_at: string; id: string; captured_at: string | null; notes: string | null; storage_path: string; submitted_by: string; title: string };
        Insert: { captured_at?: string | null; notes?: string | null; storage_path: string; submitted_by: string; title: string };
        Update: { captured_at?: string | null; notes?: string | null; storage_path?: string; title?: string };
        Relationships: [];
      };
      location_records: {
        Row: { created_at: string; human_review_status: string; id: string; record_id: string; updated_at: string; verification_status: string; verified_at: string | null };
        Insert: { human_review_status?: string; id?: string; record_id?: string; verification_status?: string; verified_at?: string | null };
        Update: { human_review_status?: string; verification_status?: string; verified_at?: string | null };
        Relationships: [];
      };
      review_actions: {
        Row: { acted_at: string; acted_by: string; action: string; id: string; note: string | null; observation_id: string };
        Insert: { acted_by: string; action: string; note?: string | null; observation_id: string };
        Update: never;
        Relationships: [];
      };
      source_evidence: {
        Row: { evidence_id: string; source_id: string; relationship_note: string | null };
        Insert: { evidence_id: string; source_id: string; relationship_note?: string | null };
        Update: { relationship_note?: string | null };
        Relationships: [];
      };
      source_observations: {
        Row: { address: string; analyst_notes: string | null; business_name_as_listed: string; city: string; county: string; human_review_status: string; id: string; latitude: number; listing_status: string; location_record_id: string; longitude: number; normalized_address: string; review_count: number; review_note: string | null; reviewed_at: string | null; reviewed_by: string | null; source_collection_date: string; source_url: string; submitted_at: string; submitted_by: string; zip_code: string };
        Insert: { address: string; analyst_notes?: string | null; business_name_as_listed: string; city: string; county: string; latitude: number; listing_status: string; location_record_id: string; longitude: number; review_count: number; source_collection_date: string; source_url: string; submitted_by: string; zip_code: string };
        Update: { human_review_status?: string; review_note?: string | null; reviewed_at?: string | null; reviewed_by?: string | null };
        Relationships: [{ foreignKeyName: "source_observations_location_record_id_fkey"; columns: ["location_record_id"]; isOneToOne: false; referencedRelation: "location_records"; referencedColumns: ["id"] }];
      };
      sources: {
        Row: { created_at: string; description: string | null; id: string; jurisdiction: string | null; name: string; source_type: string; updated_at: string; url: string };
        Insert: { description?: string | null; jurisdiction?: string | null; name: string; source_type: string; url: string };
        Update: { description?: string | null; jurisdiction?: string | null; name?: string; source_type?: string; url?: string; updated_at?: string };
        Relationships: [];
      };
      user_roles: {
        Row: { created_at: string; granted_by: string | null; role: Database["public"]["Enums"]["app_role"]; updated_at: string; user_id: string };
        Insert: { granted_by?: string | null; role: Database["public"]["Enums"]["app_role"]; user_id: string };
        Update: { granted_by?: string | null; role?: Database["public"]["Enums"]["app_role"] };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      has_app_role: {
        Args: { p_roles: Database["public"]["Enums"]["app_role"][] };
        Returns: boolean;
      };
      review_location_observation: {
        Args: { p_action: string; p_note?: string | null; p_observation_id: string };
        Returns: undefined;
      };
      submit_location_observation: {
        Args: { p_address: string; p_analyst_notes?: string | null; p_business_name_as_listed: string; p_city: string; p_county: string; p_latitude: number; p_listing_status: string; p_longitude: number; p_review_count: number; p_source_collection_date: string; p_source_url: string; p_zip_code: string };
        Returns: { duplicate_match: string; observation_id: string; record_id: string }[];
      };
    };
    Enums: { app_role: "viewer" | "analyst" | "reviewer" | "admin" };
    CompositeTypes: Record<string, never>;
  };
};
