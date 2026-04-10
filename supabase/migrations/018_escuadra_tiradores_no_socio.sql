-- Añadir soporte para "no socios" en escuadra_tiradores
-- (necesario para torneos que admiten tiradores externos)

-- 1. Hacer user_id nullable
ALTER TABLE escuadra_tiradores ALTER COLUMN user_id DROP NOT NULL;

-- 2. Añadir columnas para no socios
ALTER TABLE escuadra_tiradores
  ADD COLUMN IF NOT EXISTS nombre_externo text,
  ADD COLUMN IF NOT EXISTS es_no_socio boolean NOT NULL DEFAULT false;

-- 3. Constraint de unicidad para no socios por nombre_externo
ALTER TABLE escuadra_tiradores
  ADD CONSTRAINT escuadra_tiradores_escuadra_nombre_ext_key
  UNIQUE (escuadra_id, nombre_externo);
