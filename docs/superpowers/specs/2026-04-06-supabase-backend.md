# AppTap — Supabase Backend + Auth Design
**Spec de diseño · 2026-04-06**

---

## 1. Visión general

Integrar Supabase como backend de AppTap: base de datos PostgreSQL, autenticación con JWT, y API REST automática. Los servicios Angular mock se reescriben para consumir Supabase. Los componentes no cambian. La app se despliega en Vercel.

**Stack añadido:**
- Supabase (PostgreSQL + Auth + REST API + RLS)
- `@supabase/supabase-js` — SDK cliente
- Variables de entorno: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

---

## 2. Esquema de base de datos

### Tabla `profiles`
Extiende `auth.users` de Supabase. Se crea automáticamente al registrar un usuario mediante un trigger.

```sql
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
```

### Tabla `noticias`
```sql
CREATE TABLE noticias (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo      text NOT NULL,
  contenido   text NOT NULL,
  autor_id    uuid REFERENCES profiles(id),
  fecha       timestamptz NOT NULL DEFAULT now(),
  imagen_url  text,
  publicada   boolean NOT NULL DEFAULT false
);
```

### Tabla `competiciones`
```sql
CREATE TABLE competiciones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        text NOT NULL,
  modalidad     text NOT NULL,
  total_platos  int NOT NULL CHECK (total_platos > 0),
  fecha         timestamptz NOT NULL,
  activa        boolean NOT NULL DEFAULT false,
  creada_por    uuid REFERENCES profiles(id)
);
```

### Tabla `scores`
```sql
CREATE TABLE scores (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES profiles(id),
  competicion_id  uuid REFERENCES competiciones(id),
  platos_rotos    int NOT NULL CHECK (platos_rotos >= 0),
  fecha           timestamptz NOT NULL DEFAULT now(),
  registrado_por  uuid REFERENCES profiles(id)
);
```

### Trigger: crear profile al registrar usuario
```sql
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
```

---

## 3. Row Level Security (RLS)

RLS protege los datos a nivel de base de datos, independientemente del frontend.

```sql
-- Activar RLS en todas las tablas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE noticias ENABLE ROW LEVEL SECURITY;
ALTER TABLE competiciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- Función helper para obtener el rol del usuario autenticado
CREATE OR REPLACE FUNCTION get_my_rol()
RETURNS text AS $$
  SELECT rol FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- profiles: cualquier autenticado puede leer; solo admin puede modificar
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() = 'admin');
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated
  USING (get_my_rol() = 'admin');

-- noticias: autenticados leen publicadas; moderador/admin gestiona
CREATE POLICY "noticias_select" ON noticias FOR SELECT TO authenticated
  USING (publicada = true OR get_my_rol() IN ('moderador', 'admin'));
CREATE POLICY "noticias_insert" ON noticias FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() IN ('moderador', 'admin'));
CREATE POLICY "noticias_update" ON noticias FOR UPDATE TO authenticated
  USING (get_my_rol() IN ('moderador', 'admin'));
CREATE POLICY "noticias_delete" ON noticias FOR DELETE TO authenticated
  USING (get_my_rol() IN ('moderador', 'admin'));

-- competiciones: todos leen; moderador/admin gestiona
CREATE POLICY "competiciones_select" ON competiciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "competiciones_insert" ON competiciones FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() IN ('moderador', 'admin'));
CREATE POLICY "competiciones_update" ON competiciones FOR UPDATE TO authenticated
  USING (get_my_rol() IN ('moderador', 'admin'));

-- scores: todos leen; moderador/admin registra
CREATE POLICY "scores_select" ON scores FOR SELECT TO authenticated USING (true);
CREATE POLICY "scores_insert" ON scores FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() IN ('moderador', 'admin'));
```

---

## 4. Seed — usuario admin inicial

```sql
-- Ejecutar en Supabase Authentication > crear usuario manualmente primero,
-- luego actualizar su profile:
UPDATE profiles
SET
  nombre = 'Admin',
  apellidos = 'San Isidro',
  numero_socio = '0001',
  rol = 'admin',
  activo = true
WHERE id = '<uuid-del-usuario-creado>';
```

---

## 5. Cliente Supabase en Angular

### Archivo: `src/app/core/supabase/supabase.client.ts`

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

export const supabase: SupabaseClient = createClient(
  environment.supabaseUrl,
  environment.supabaseAnonKey
);
```

### Archivos de entorno

`src/environments/environment.ts` (desarrollo):
```typescript
export const environment = {
  production: false,
  supabaseUrl: import.meta.env['VITE_SUPABASE_URL'] as string,
  supabaseAnonKey: import.meta.env['VITE_SUPABASE_ANON_KEY'] as string,
};
```

`src/environments/environment.prod.ts` (producción):
```typescript
export const environment = {
  production: true,
  supabaseUrl: import.meta.env['VITE_SUPABASE_URL'] as string,
  supabaseAnonKey: import.meta.env['VITE_SUPABASE_ANON_KEY'] as string,
};
```

`.env` (local, no commitear):
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

---

## 6. Mapeo de modelos TypeScript ↔ tablas

| TypeScript | Supabase tabla | Notas |
|---|---|---|
| `User.id` | `profiles.id` | uuid |
| `User.nombre` | `profiles.nombre` | — |
| `User.apellidos` | `profiles.apellidos` | — |
| `User.email` | `auth.users.email` | fuera de profiles |
| `User.numeroSocio` | `profiles.numero_socio` | snake_case |
| `User.avatarUrl` | `profiles.avatar_url` | snake_case |
| `User.rol` | `profiles.rol` | CHECK constraint |
| `User.fechaAlta` | `profiles.fecha_alta` | snake_case |
| `User.activo` | `profiles.activo` | — |
| `News.autorId` | `noticias.autor_id` | snake_case |
| `News.imagenUrl` | `noticias.imagen_url` | snake_case |
| `Score.userId` | `scores.user_id` | snake_case |
| `Score.competicionId` | `scores.competicion_id` | snake_case |
| `Score.platosRotos` | `scores.platos_rotos` | snake_case |
| `Score.registradoPor` | `scores.registrado_por` | snake_case |
| `Competicion.totalPlatos` | `competiciones.total_platos` | snake_case |
| `Competicion.creadaPor` | `competiciones.creada_por` | snake_case |

Los servicios Angular mapean snake_case → camelCase al leer y camelCase → snake_case al escribir.

---

## 7. Servicios Angular — cambios

### AuthService
- `login(email, password)` → `supabase.auth.signInWithPassword({ email, password })`
- Tras login: leer profile del usuario desde `profiles` para obtener `rol`, `nombre`, etc.
- `logout()` → `supabase.auth.signOut()`
- `currentUser$` → derivado de `supabase.auth.onAuthStateChange()`
- Token JWT: Supabase lo gestiona automáticamente en localStorage

### NewsService
- `getPublicadas()` → `supabase.from('noticias').select('*').eq('publicada', true).order('fecha', { ascending: false })`
- `getAll()` → `supabase.from('noticias').select('*').order('fecha', { ascending: false })`
- `getById(id)` → `supabase.from('noticias').select('*').eq('id', id).single()`
- `create(data)` → `supabase.from('noticias').insert(toSnakeCase(data))`
- `update(id, data)` → `supabase.from('noticias').update(toSnakeCase(data)).eq('id', id)`
- `delete(id)` → `supabase.from('noticias').delete().eq('id', id)`

### CompeticionService
- `getAll()` → `supabase.from('competiciones').select('*').order('fecha', { ascending: false })`
- `getActiva()` → `supabase.from('competiciones').select('*').eq('activa', true).single()`
- `getById(id)` → `supabase.from('competiciones').select('*').eq('id', id).single()`
- `create(data)` / `update(id, data)` → insert/update con snake_case

### ScoreService
- `getByCompeticion(id)` → `supabase.from('scores').select('*').eq('competicion_id', id)`
- `getByUser(id)` → `supabase.from('scores').select('*').eq('user_id', id).order('fecha', { ascending: false })`
- `getRanking(competicionId)` → query + ordenar en cliente (o vista SQL en Supabase)
- `create(data)` → insert con snake_case

### UserService (profiles)
- `getAll()` → `supabase.from('profiles').select('*, email:auth.users(email)').order('fecha_alta')`
- `getById(id)` → `supabase.from('profiles').select('*').eq('id', id).single()`
- `create(data)` → `supabase.auth.admin.createUser(...)` (requiere service role key — solo desde backend seguro)
- `update(id, data)` → `supabase.from('profiles').update(toSnakeCase(data)).eq('id', id)`
- `toggleActivo(id)` → update del campo `activo`

> **Nota sobre crear usuarios:** La creación de usuarios nuevos desde el admin requiere la `service_role` key de Supabase, que NO debe exponerse en el frontend. Alternativa: el admin crea el usuario desde el dashboard de Supabase, o se implementa una Edge Function de Supabase para esta operación.

---

## 8. Despliegue

### Supabase
1. Crear proyecto en supabase.com
2. Ejecutar el SQL del esquema (sección 2) en SQL Editor
3. Ejecutar el SQL de RLS (sección 3)
4. Crear usuario admin desde Authentication > Users
5. Ejecutar seed SQL (sección 4) para asignar rol admin
6. Copiar Project URL y anon key

### Vercel
1. Conectar repositorio Git
2. Framework Preset: Angular (o Vite)
3. Build Command: `ng build`
4. Output Directory: `dist/app-tap/browser`
5. Variables de entorno:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

### `.gitignore`
Asegurarse de que `.env` está en `.gitignore` (nunca commitear credenciales).

---

## 9. Archivos modificados / creados

### Nuevos
- `src/app/core/supabase/supabase.client.ts` — instancia cliente Supabase
- `src/environments/environment.ts`
- `src/environments/environment.prod.ts`
- `.env` (local, no commitear)
- `docs/supabase-schema.sql` — SQL completo del esquema + RLS + seed

### Modificados
- `src/app/core/auth/auth.service.ts` — login/logout/session con Supabase Auth
- `src/app/features/noticias/news.service.ts` — queries Supabase
- `src/app/features/scores/competicion.service.ts` — queries Supabase
- `src/app/features/scores/score.service.ts` — queries Supabase
- `src/app/features/admin/socios/user.service.ts` — queries Supabase profiles
- `package.json` — añadir `@supabase/supabase-js`
- `angular.json` — fileReplacements para environments

### No modificados
- Todos los componentes Angular (templates, lógica de UI)
- Guards (`authGuard`, `roleGuard`)
- `AuthInterceptor`
- Modelos TypeScript
- Routing
