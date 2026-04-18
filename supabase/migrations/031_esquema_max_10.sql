-- Corregir constraint de esquema: el club usa esquemas 1-10, no 1-12.
alter table public.escuadras
  drop constraint if exists escuadras_esquema_check;

alter table public.escuadras
  add constraint escuadras_esquema_check check (esquema between 1 and 10);
