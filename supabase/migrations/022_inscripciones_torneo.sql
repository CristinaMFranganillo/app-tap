-- Inscripciones a un torneo: socios (user_id) e invitados (nombre + apellidos).
-- No sustituye a movimientos_caja; es la lista de participantes autorizados
-- con el precio snapshot en el momento de la inscripción.

CREATE TABLE inscripciones_torneo (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  torneo_id       uuid NOT NULL REFERENCES torneos(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES profiles(id) ON DELETE RESTRICT,
  nombre          text,
  apellidos       text,
  es_no_socio     boolean NOT NULL,
  precio_pagado   numeric(8,2) NOT NULL CHECK (precio_pagado >= 0),
  creado_por      uuid REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now(),

  CHECK (
    (es_no_socio = false AND user_id IS NOT NULL AND nombre IS NULL AND apellidos IS NULL)
    OR
    (es_no_socio = true  AND user_id IS NULL AND nombre IS NOT NULL AND apellidos IS NOT NULL)
  )
);

-- Un socio solo puede inscribirse una vez a un torneo
CREATE UNIQUE INDEX inscripciones_torneo_socio_unico
  ON inscripciones_torneo (torneo_id, user_id)
  WHERE user_id IS NOT NULL;

-- Un invitado (normalizado) solo una vez
CREATE UNIQUE INDEX inscripciones_torneo_invitado_unico
  ON inscripciones_torneo (torneo_id, lower(trim(nombre)), lower(trim(apellidos)))
  WHERE user_id IS NULL;

CREATE INDEX idx_inscripciones_torneo_torneo ON inscripciones_torneo(torneo_id);

ALTER TABLE inscripciones_torneo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inscripciones_torneo_select" ON inscripciones_torneo
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "inscripciones_torneo_insert_admin" ON inscripciones_torneo
  FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() IN ('admin', 'moderador'));

CREATE POLICY "inscripciones_torneo_update_admin" ON inscripciones_torneo
  FOR UPDATE TO authenticated
  USING (get_my_rol() IN ('admin', 'moderador'));

CREATE POLICY "inscripciones_torneo_delete_admin" ON inscripciones_torneo
  FOR DELETE TO authenticated
  USING (get_my_rol() IN ('admin', 'moderador'));
