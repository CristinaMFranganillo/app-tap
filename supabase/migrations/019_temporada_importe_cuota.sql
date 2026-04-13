-- Añadir importe de cuota a temporadas (por defecto 25€)
ALTER TABLE temporadas
  ADD COLUMN importe_cuota numeric(8,2) NOT NULL DEFAULT 25.00;
