-- supabase/migrations/007_cuotas.sql

CREATE TABLE IF NOT EXISTS temporadas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       text NOT NULL,
  fecha_inicio date NOT NULL,
  activa       boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cuotas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  temporada_id  uuid NOT NULL REFERENCES temporadas(id) ON DELETE CASCADE,
  pagada        boolean NOT NULL DEFAULT false,
  fecha_pago    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, temporada_id)
);

-- Solo una temporada activa a la vez
CREATE UNIQUE INDEX IF NOT EXISTS idx_temporadas_activa
  ON temporadas (activa)
  WHERE activa = true;

-- Índice en cuotas.temporada_id
CREATE INDEX IF NOT EXISTS idx_cuotas_temporada ON cuotas (temporada_id);

-- RLS
ALTER TABLE temporadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuotas ENABLE ROW LEVEL SECURITY;

-- Temporadas: todos los autenticados pueden leer
CREATE POLICY "Todos ven temporadas"
  ON temporadas FOR SELECT
  TO authenticated
  USING (true);

-- Temporadas: solo admin/moderador pueden escribir
CREATE POLICY "temporadas_insert" ON temporadas FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() IN ('admin', 'moderador'));
CREATE POLICY "temporadas_update" ON temporadas FOR UPDATE TO authenticated
  USING (get_my_rol() IN ('admin', 'moderador'))
  WITH CHECK (get_my_rol() IN ('admin', 'moderador'));
CREATE POLICY "temporadas_delete" ON temporadas FOR DELETE TO authenticated
  USING (get_my_rol() IN ('admin', 'moderador'));

-- Cuotas: socio puede leer su propia cuota
CREATE POLICY "Socio lee su propia cuota"
  ON cuotas FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Cuotas: admin/moderador pueden insertar, actualizar y borrar
CREATE POLICY "cuotas_insert" ON cuotas FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() IN ('admin', 'moderador'));
CREATE POLICY "cuotas_update" ON cuotas FOR UPDATE TO authenticated
  USING (get_my_rol() IN ('admin', 'moderador'))
  WITH CHECK (get_my_rol() IN ('admin', 'moderador'));
CREATE POLICY "cuotas_delete" ON cuotas FOR DELETE TO authenticated
  USING (get_my_rol() IN ('admin', 'moderador'));
