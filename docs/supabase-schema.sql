-- ============================================================
-- AppTap — Supabase Schema
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. TABLAS

CREATE TABLE profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre        text NOT NULL,
  apellidos     text NOT NULL,
  numero_socio  text UNIQUE NOT NULL,
  avatar_url    text,
  rol           text NOT NULL DEFAULT 'socio' CHECK (rol IN ('socio', 'moderador', 'admin')),
  fecha_alta    timestamptz NOT NULL DEFAULT now(),
  activo        boolean NOT NULL DEFAULT true
);

CREATE TABLE noticias (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo      text NOT NULL,
  contenido   text NOT NULL,
  autor_id    uuid REFERENCES profiles(id),
  fecha       timestamptz NOT NULL DEFAULT now(),
  imagen_url  text,
  publicada   boolean NOT NULL DEFAULT false
);

CREATE TABLE competiciones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        text NOT NULL,
  modalidad     text NOT NULL,
  total_platos  int NOT NULL CHECK (total_platos > 0),
  fecha         timestamptz NOT NULL,
  activa        boolean NOT NULL DEFAULT false,
  creada_por    uuid REFERENCES profiles(id)
);

CREATE TABLE scores (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES profiles(id),
  competicion_id  uuid REFERENCES competiciones(id),
  platos_rotos    int NOT NULL CHECK (platos_rotos >= 0),
  fecha           timestamptz NOT NULL DEFAULT now(),
  registrado_por  uuid REFERENCES profiles(id)
);

-- 2. TRIGGER: crear profile al crear usuario en auth

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, nombre, apellidos, numero_socio, rol)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', 'Nuevo'),
    COALESCE(NEW.raw_user_meta_data->>'apellidos', 'Usuario'),
    COALESCE(NEW.raw_user_meta_data->>'numero_socio', '0000'),
    'socio'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 3. ROW LEVEL SECURITY

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE noticias ENABLE ROW LEVEL SECURITY;
ALTER TABLE competiciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- Función helper: obtener rol del usuario autenticado
CREATE OR REPLACE FUNCTION get_my_rol()
RETURNS text AS $$
  SELECT rol FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- profiles
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() = 'admin');
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated
  USING (get_my_rol() = 'admin');

-- noticias
CREATE POLICY "noticias_select" ON noticias FOR SELECT TO authenticated
  USING (publicada = true OR get_my_rol() IN ('moderador', 'admin'));
CREATE POLICY "noticias_insert" ON noticias FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() IN ('moderador', 'admin'));
CREATE POLICY "noticias_update" ON noticias FOR UPDATE TO authenticated
  USING (get_my_rol() IN ('moderador', 'admin'));
CREATE POLICY "noticias_delete" ON noticias FOR DELETE TO authenticated
  USING (get_my_rol() IN ('moderador', 'admin'));

-- competiciones
CREATE POLICY "competiciones_select" ON competiciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "competiciones_insert" ON competiciones FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() IN ('moderador', 'admin'));
CREATE POLICY "competiciones_update" ON competiciones FOR UPDATE TO authenticated
  USING (get_my_rol() IN ('moderador', 'admin'));

-- scores
CREATE POLICY "scores_select" ON scores FOR SELECT TO authenticated USING (true);
CREATE POLICY "scores_insert" ON scores FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() IN ('moderador', 'admin'));

-- 4. SEED: primer usuario admin
-- INSTRUCCIONES:
-- 1. Ve a Supabase Dashboard > Authentication > Users > Add user
-- 2. Introduce email y contraseña del admin
-- 3. Copia el UUID del usuario creado
-- 4. Ejecuta este UPDATE reemplazando <UUID_ADMIN>:

-- UPDATE profiles
-- SET nombre = 'Admin', apellidos = 'San Isidro', numero_socio = '0001', rol = 'admin'
-- WHERE id = '<UUID_ADMIN>';

-- ============================================================
-- Tabla: solicitudes_registro
-- ============================================================
CREATE TABLE solicitudes_registro (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          text NOT NULL,
  apellidos       text NOT NULL,
  email           text NOT NULL UNIQUE,
  mensaje         text,
  estado          text NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente', 'aceptada', 'rechazada')),
  fecha           timestamptz NOT NULL DEFAULT now(),
  revisada_por    uuid REFERENCES profiles(id),
  fecha_revision  timestamptz,
  motivo_rechazo  text
);

ALTER TABLE solicitudes_registro ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario (incluso no autenticado) puede insertar una solicitud
CREATE POLICY "solicitudes_insert_public" ON solicitudes_registro
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Solo admins pueden leer solicitudes
CREATE POLICY "solicitudes_select_admin" ON solicitudes_registro
  FOR SELECT TO authenticated USING (get_my_rol() = 'admin');

-- Solo admins pueden actualizar solicitudes
CREATE POLICY "solicitudes_update_admin" ON solicitudes_registro
  FOR UPDATE TO authenticated USING (get_my_rol() = 'admin');
