-- supabase/migrations/029_coach_contexto.sql

CREATE TYPE categoria_coach AS ENUM (
  'noticia',
  'consejo_tecnico',
  'aviso_torneo',
  'equipamiento'
);

CREATE TABLE IF NOT EXISTS coach_contexto (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo           text NOT NULL,
  contenido        text NOT NULL,
  categoria        categoria_coach NOT NULL,
  activo           boolean NOT NULL DEFAULT true,
  fecha_expiracion date NULL,
  created_by       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coach_contexto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_contexto_select"
  ON coach_contexto FOR SELECT TO authenticated USING (true);

CREATE POLICY "coach_contexto_insert"
  ON coach_contexto FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() IN ('admin', 'moderador'));

CREATE POLICY "coach_contexto_update"
  ON coach_contexto FOR UPDATE TO authenticated
  USING (get_my_rol() IN ('admin', 'moderador'));

CREATE POLICY "coach_contexto_delete"
  ON coach_contexto FOR DELETE TO authenticated
  USING (get_my_rol() IN ('admin', 'moderador'));
