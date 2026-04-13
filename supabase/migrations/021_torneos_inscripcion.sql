-- Precio de inscripción por torneo (socio / no socio)
ALTER TABLE torneos
  ADD COLUMN IF NOT EXISTS precio_inscripcion_socio numeric(8,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS precio_inscripcion_no_socio numeric(8,2) NOT NULL DEFAULT 0;

-- Vinculación de movimientos de caja con torneos para detectar socios ya inscritos
ALTER TABLE movimientos_caja
  ADD COLUMN IF NOT EXISTS torneo_id uuid REFERENCES torneos(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_movimientos_caja_torneo_id
  ON movimientos_caja(torneo_id);
