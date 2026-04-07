-- supabase/migrations/009_entrenamiento_fallos.sql

CREATE TABLE IF NOT EXISTS entrenamiento_fallos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escuadra_id    uuid NOT NULL REFERENCES escuadras(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  numero_plato   int NOT NULL CHECK (numero_plato BETWEEN 1 AND 25),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (escuadra_id, user_id, numero_plato)
);

ALTER TABLE entrenamiento_fallos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entrenamiento_fallos_select"
  ON entrenamiento_fallos FOR SELECT TO authenticated USING (true);

CREATE POLICY "entrenamiento_fallos_insert"
  ON entrenamiento_fallos FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() IN ('admin', 'moderador'));

CREATE POLICY "entrenamiento_fallos_delete"
  ON entrenamiento_fallos FOR DELETE TO authenticated
  USING (get_my_rol() IN ('admin', 'moderador'));
