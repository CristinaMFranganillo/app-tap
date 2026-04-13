-- En torneos, las escuadras no generan cobro: el cobro ocurre al inscribir.
-- Permitimos movimientos_caja sin escuadra (escuadra_id NULL) cuando el
-- movimiento proviene de una inscripción a torneo.

ALTER TABLE movimientos_caja
  ALTER COLUMN escuadra_id DROP NOT NULL;

-- Garantía: todo movimiento debe venir al menos de una fuente.
ALTER TABLE movimientos_caja
  ADD CONSTRAINT movimientos_caja_origen_check
  CHECK (escuadra_id IS NOT NULL OR torneo_id IS NOT NULL);
