-- 1. Tabla torneos
CREATE TABLE torneos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text NOT NULL,
  fecha      date NOT NULL,
  creado_por uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. FK en escuadras
ALTER TABLE escuadras ADD COLUMN torneo_id uuid REFERENCES torneos(id) ON DELETE CASCADE;

-- 3. Resultados de torneo
CREATE TABLE resultados_torneo (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escuadra_id     uuid NOT NULL REFERENCES escuadras(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES profiles(id),
  nombre_externo  text,
  es_no_socio     boolean NOT NULL DEFAULT false,
  puesto          int NOT NULL CHECK (puesto BETWEEN 1 AND 6),
  platos_rotos    int NOT NULL,
  registrado_por  uuid REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (escuadra_id, user_id),
  UNIQUE (escuadra_id, nombre_externo)
);

-- 4. Fallos de torneo
CREATE TABLE torneo_fallos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escuadra_id   uuid NOT NULL REFERENCES escuadras(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  numero_plato  int NOT NULL CHECK (numero_plato BETWEEN 1 AND 25),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (escuadra_id, user_id, numero_plato)
);

-- 5. RLS
ALTER TABLE torneos ENABLE ROW LEVEL SECURITY;
ALTER TABLE resultados_torneo ENABLE ROW LEVEL SECURITY;
ALTER TABLE torneo_fallos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "torneos_select" ON torneos FOR SELECT TO authenticated USING (true);
CREATE POLICY "torneos_insert" ON torneos FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() IN ('admin', 'moderador'));
CREATE POLICY "torneos_update" ON torneos FOR UPDATE TO authenticated
  USING (get_my_rol() IN ('admin', 'moderador'));
CREATE POLICY "torneos_delete" ON torneos FOR DELETE TO authenticated
  USING (get_my_rol() IN ('admin', 'moderador'));

CREATE POLICY "resultados_torneo_select" ON resultados_torneo FOR SELECT TO authenticated USING (true);
CREATE POLICY "resultados_torneo_insert" ON resultados_torneo FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() IN ('admin', 'moderador'));
CREATE POLICY "resultados_torneo_update" ON resultados_torneo FOR UPDATE TO authenticated
  USING (get_my_rol() IN ('admin', 'moderador'));
CREATE POLICY "resultados_torneo_delete" ON resultados_torneo FOR DELETE TO authenticated
  USING (get_my_rol() IN ('admin', 'moderador'));

CREATE POLICY "torneo_fallos_select" ON torneo_fallos FOR SELECT TO authenticated USING (true);
CREATE POLICY "torneo_fallos_insert" ON torneo_fallos FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() IN ('admin', 'moderador'));
CREATE POLICY "torneo_fallos_update" ON torneo_fallos FOR UPDATE TO authenticated
  USING (get_my_rol() IN ('admin', 'moderador'));
CREATE POLICY "torneo_fallos_delete" ON torneo_fallos FOR DELETE TO authenticated
  USING (get_my_rol() IN ('admin', 'moderador'));
