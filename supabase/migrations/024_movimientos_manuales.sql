-- Tabla para gastos e ingresos manuales del club
create table if not exists public.movimientos_manuales (
  id             uuid primary key default gen_random_uuid(),
  tipo           text not null check (tipo in ('gasto', 'ingreso')),
  concepto       text not null,
  importe        numeric(10,2) not null check (importe > 0),
  fecha          text not null,                              -- 'YYYY-MM-DD'
  registrado_por uuid references auth.users(id),
  created_at     timestamptz not null default now()
);

-- RLS
alter table public.movimientos_manuales enable row level security;

-- Admin y moderador pueden ver todos los movimientos
create policy "movimientos_manuales_select"
  on public.movimientos_manuales for select
  using (public.get_my_rol() in ('admin', 'moderador'));

-- Admin y moderador pueden insertar
create policy "movimientos_manuales_insert"
  on public.movimientos_manuales for insert
  with check (public.get_my_rol() in ('admin', 'moderador'));

-- Admin y moderador pueden eliminar
create policy "movimientos_manuales_delete"
  on public.movimientos_manuales for delete
  using (public.get_my_rol() in ('admin', 'moderador'));
