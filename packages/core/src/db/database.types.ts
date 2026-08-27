/**
 * Types générés depuis la base Supabase locale.
 *
 * Régénérer après chaque migration :  pnpm db:types
 * Ce fichier est un placeholder tant que la phase 1 (schéma) n'est pas passée.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
