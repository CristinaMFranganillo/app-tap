-- supabase/migrations/010_cuotas_admin_select.sql
-- Admin y moderador necesitan leer todas las cuotas para mostrar el estado en la lista de socios

CREATE POLICY "cuotas_select_admin"
  ON cuotas FOR SELECT
  TO authenticated
  USING (get_my_rol() IN ('admin', 'moderador'));
