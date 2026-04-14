-- 026_movimientos_manuales_solo_admin.sql
-- Restringir insert/delete de movimientos_manuales a solo admin.
-- SELECT se mantiene para admin + moderador.

DROP POLICY IF EXISTS "movimientos_manuales_insert" ON public.movimientos_manuales;
DROP POLICY IF EXISTS "movimientos_manuales_delete" ON public.movimientos_manuales;

CREATE POLICY "movimientos_manuales_insert_admin"
  ON public.movimientos_manuales FOR INSERT
  WITH CHECK (public.get_my_rol() = 'admin');

CREATE POLICY "movimientos_manuales_delete_admin"
  ON public.movimientos_manuales FOR DELETE
  USING (public.get_my_rol() = 'admin');
