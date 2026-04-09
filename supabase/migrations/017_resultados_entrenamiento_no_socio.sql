-- Añadir soporte para "no socios" en resultados_entrenamiento
-- (misma estructura que resultados_torneo)

-- 1. Hacer user_id nullable (no socios no tienen user_id)
ALTER TABLE resultados_entrenamiento ALTER COLUMN user_id DROP NOT NULL;

-- 2. Añadir columnas para no socios
ALTER TABLE resultados_entrenamiento
  ADD COLUMN IF NOT EXISTS nombre_externo text,
  ADD COLUMN IF NOT EXISTS es_no_socio boolean NOT NULL DEFAULT false;

-- 3. Constraint de unicidad para no socios por nombre_externo
ALTER TABLE resultados_entrenamiento
  ADD CONSTRAINT resultados_entrenamiento_escuadra_nombre_ext_key
  UNIQUE (escuadra_id, nombre_externo);
