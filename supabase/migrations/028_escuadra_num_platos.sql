-- Número de platos por tirador en una escuadra de torneo.
-- Por defecto 25 (una tanda estándar); en torneos puede variar (50, 75, 100...).
alter table public.escuadras
  add column if not exists num_platos int not null default 25 check (num_platos between 1 and 200);
