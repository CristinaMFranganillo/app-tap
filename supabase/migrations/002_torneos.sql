-- supabase/migrations/002_torneos.sql

-- 1. Modificar competiciones: añadir nuevos campos, mantener total_platos por compatibilidad
ALTER TABLE competiciones
  ADD COLUMN IF NOT EXISTS lugar text,
  ADD COLUMN IF NOT EXISTS platos_por_serie int NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS num_series int NOT NULL DEFAULT 1;

-- 2. Escuadras
CREATE TABLE escuadras (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competicion_id  uuid NOT NULL REFERENCES competiciones(id) ON DELETE CASCADE,
  numero          int NOT NULL,
  UNIQUE(competicion_id, numero)
);

-- 3. Tiradores por escuadra
CREATE TABLE escuadra_tiradores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escuadra_id uuid NOT NULL REFERENCES escuadras(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id),
  puesto      int NOT NULL CHECK (puesto BETWEEN 1 AND 6),
  UNIQUE(escuadra_id, user_id),
  UNIQUE(escuadra_id, puesto)
);

-- 4. Resultados plato a plato
CREATE TABLE resultados (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competicion_id  uuid NOT NULL REFERENCES competiciones(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES profiles(id),
  serie           int NOT NULL,
  plato           int NOT NULL,
  resultado       smallint NOT NULL CHECK (resultado IN (0, 1)),
  registrado_por  uuid REFERENCES profiles(id),
  fecha           timestamptz NOT NULL DEFAULT now(),
  UNIQUE(competicion_id, user_id, serie, plato)
);

-- 5. RLS
ALTER TABLE escuadras ENABLE ROW LEVEL SECURITY;
ALTER TABLE escuadra_tiradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE resultados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "escuadras_select" ON escuadras FOR SELECT TO authenticated USING (true);
CREATE POLICY "escuadras_insert" ON escuadras FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() IN ('admin', 'moderador'));
CREATE POLICY "escuadras_update" ON escuadras FOR UPDATE TO authenticated
  USING (get_my_rol() IN ('admin', 'moderador'));
CREATE POLICY "escuadras_delete" ON escuadras FOR DELETE TO authenticated
  USING (get_my_rol() IN ('admin', 'moderador'));

CREATE POLICY "escuadra_tiradores_select" ON escuadra_tiradores FOR SELECT TO authenticated USING (true);
CREATE POLICY "escuadra_tiradores_insert" ON escuadra_tiradores FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() IN ('admin', 'moderador'));
CREATE POLICY "escuadra_tiradores_delete" ON escuadra_tiradores FOR DELETE TO authenticated
  USING (get_my_rol() IN ('admin', 'moderador'));

CREATE POLICY "resultados_select" ON resultados FOR SELECT TO authenticated USING (true);
CREATE POLICY "resultados_insert" ON resultados FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() IN ('admin', 'moderador'));
CREATE POLICY "resultados_update" ON resultados FOR UPDATE TO authenticated
  USING (get_my_rol() IN ('admin', 'moderador'));
CREATE POLICY "resultados_delete" ON resultados FOR DELETE TO authenticated
  USING (get_my_rol() IN ('admin', 'moderador'));
