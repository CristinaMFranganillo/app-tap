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

-- RLS: los admin pueden leer y escribir todo
ALTER TABLE temporadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access temporadas"
  ON temporadas FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.rol IN ('admin', 'moderador')
    )
  );

CREATE POLICY "Admin full access cuotas"
  ON cuotas FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.rol IN ('admin', 'moderador')
    )
  );
