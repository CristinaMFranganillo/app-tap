-- Añadir columna email a profiles para evitar depender de auth.users en cada consulta
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;
