-- supabase/migrations/011_favorito_socio.sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS favorito boolean NOT NULL DEFAULT false;
