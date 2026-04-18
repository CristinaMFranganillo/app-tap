-- supabase/migrations/030_notificaciones.sql

-- ENUM
CREATE TYPE tipo_notificacion AS ENUM ('torneo', 'cuota', 'aviso', 'resultado', 'otro');

-- Tabla principal
CREATE TABLE IF NOT EXISTS notificaciones (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo           text NOT NULL,
  cuerpo           text NOT NULL,
  tipo             tipo_notificacion NOT NULL,
  destinatarios    uuid[],
  fecha_expiracion date,
  created_by       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Tabla lecturas
CREATE TABLE IF NOT EXISTS notificaciones_leidas (
  notificacion_id  uuid NOT NULL REFERENCES notificaciones(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  leida_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notificacion_id, user_id)
);

-- RLS notificaciones
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "socios_ven_sus_notificaciones" ON notificaciones
  FOR SELECT TO authenticated
  USING (
    (destinatarios IS NULL OR auth.uid() = ANY(destinatarios))
    AND (fecha_expiracion IS NULL OR fecha_expiracion >= CURRENT_DATE)
  );

CREATE POLICY "admin_crud_notificaciones" ON notificaciones
  FOR ALL TO authenticated
  USING (get_my_rol() = 'admin')
  WITH CHECK (get_my_rol() = 'admin');

-- RLS notificaciones_leidas
ALTER TABLE notificaciones_leidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario_ve_sus_lecturas" ON notificaciones_leidas
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "usuario_inserta_sus_lecturas" ON notificaciones_leidas
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "usuario_borra_sus_lecturas" ON notificaciones_leidas
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Habilitar realtime en notificaciones
ALTER PUBLICATION supabase_realtime ADD TABLE notificaciones;
