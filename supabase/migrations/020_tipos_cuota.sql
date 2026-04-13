-- Tipos de cuota: socio, directivo, honor
-- 1) Enum tipo_cuota
DO $$ BEGIN
  CREATE TYPE tipo_cuota AS ENUM ('socio', 'directivo', 'honor');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) Añadir columna tipo_cuota a profiles (default 'socio')
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS tipo_cuota tipo_cuota NOT NULL DEFAULT 'socio';

-- 3) Añadir los tres importes a temporadas
ALTER TABLE temporadas
  ADD COLUMN IF NOT EXISTS importe_socio numeric(8,2) NOT NULL DEFAULT 25.00,
  ADD COLUMN IF NOT EXISTS importe_directivo numeric(8,2) NOT NULL DEFAULT 25.00,
  ADD COLUMN IF NOT EXISTS importe_honor numeric(8,2) NOT NULL DEFAULT 0.00;

-- 4) Migrar el valor actual de importe_cuota a importe_socio e importe_directivo
UPDATE temporadas
   SET importe_socio = importe_cuota,
       importe_directivo = importe_cuota
 WHERE importe_cuota IS NOT NULL;

-- 5) Eliminar la columna antigua importe_cuota
ALTER TABLE temporadas DROP COLUMN IF EXISTS importe_cuota;
