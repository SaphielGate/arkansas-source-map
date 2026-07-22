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
      source_evidence: {
        Row: { evidence_id: string; source_id: string; relationship_note: string | null };
        Insert: { evidence_id: string; source_id: string; relationship_note?: string | null };
        Update: { relationship_note?: string | null };
        Relationships: [];
      };
      sources: {
        Row: { created_at: string; description: string | null; id: string; jurisdiction: string | null; name: string; source_type: string; updated_at: string; url: string };
        Insert: { description?: string | null; jurisdiction?: string | null; name: string; source_type: string; url: string };
        Update: { description?: string | null; jurisdiction?: string | null; name?: string; source_type?: string; url?: string; updated_at?: string };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
