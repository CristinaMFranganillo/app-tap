-- Arreglar trigger: ON CONFLICT (id) no captura conflicto en numero_socio (UNIQUE).
-- Cambiar a ON CONFLICT DO NOTHING para que ignore cualquier conflicto.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, nombre, apellidos, numero_socio, rol, activo, first_login)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', 'Nuevo'),
    COALESCE(NEW.raw_user_meta_data->>'apellidos', 'Usuario'),
    0,
    'socio',
    true,
    true
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
