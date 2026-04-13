-- Esquema de platos (1-12) en foso universal
-- Se aplica a nivel de escuadra porque todos los tiradores disparan el mismo esquema
alter table public.escuadras
  add column if not exists esquema int check (esquema between 1 and 12);
