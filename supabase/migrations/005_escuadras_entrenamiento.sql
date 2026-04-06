-- supabase/migrations/005_escuadras_entrenamiento.sql

-- 1. Desacoplar escuadras de competiciones
ALTER TABLE escuadras ALTER COLUMN competicion_id DROP NOT NULL;
ALTER TABLE escuadras ADD COLUMN IF NOT EXISTS fecha date NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE escuadras ADD COLUMN IF NOT EXISTS creado_por uuid REFERENCES profiles(id);

-- 2. Tabla de resultados de entrenamiento (platos totales por tirador)
CREATE TABLE IF NOT EXISTS resultados_entrenamiento (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escuadra_id    uuid NOT NULL REFERENCES escuadras(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES profiles(id),
  puesto         int NOT NULL CHECK (puesto BETWEEN 1 AND 6),
  platos_rotos   int NOT NULL DEFAULT 0,
  registrado_por uuid REFERENCES profiles(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(escuadra_id, user_id)
);

-- 3. RLS para resultados_entrenamiento
ALTER TABLE resultados_entrenamiento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "re_select" ON resultados_entrenamiento FOR SELECT TO authenticated USING (true);
CREATE POLICY "re_insert" ON resultados_entrenamiento FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() IN ('admin', 'moderador'));
CREATE POLICY "re_update" ON resultados_entrenamiento FOR UPDATE TO authenticated
  USING (get_my_rol() IN ('admin', 'moderador'));
CREATE POLICY "re_delete" ON resultados_entrenamiento FOR DELETE TO authenticated
  USING (get_my_rol() IN ('admin', 'moderador'));
