# AppTap — Supabase Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar todos los servicios mock de AppTap con llamadas reales a Supabase (PostgreSQL + Auth), manteniendo los componentes Angular intactos.

**Architecture:** Un cliente Supabase singleton (`supabase.client.ts`) es compartido por todos los servicios. `AuthService` usa `supabase.auth` para login/logout/sesión. Los otros 4 servicios (News, Competicion, Score, User) usan `supabase.from(tabla)` con mapping camelCase↔snake_case. Los componentes Angular no cambian.

**Tech Stack:** Angular 19, `@supabase/supabase-js` v2, Supabase PostgreSQL, Vite env vars (`import.meta.env`), Vercel deploy.

---

## File Map

### Nuevos archivos
- `src/app/core/supabase/supabase.client.ts` — instancia singleton del cliente Supabase
- `src/environments/environment.ts` — vars de entorno desarrollo
- `src/environments/environment.prod.ts` — vars de entorno producción
- `.env` — credenciales locales (NO commitear)
- `.env.example` — plantilla pública de variables (sí commitear)
- `docs/supabase-schema.sql` — SQL completo: tablas + RLS + trigger + seed

### Modificados
- `package.json` — añadir `@supabase/supabase-js`
- `angular.json` — añadir fileReplacements para environments
- `src/app/core/auth/auth.service.ts` — reescribir con Supabase Auth
- `src/app/features/auth/login/login.component.ts` — usar nuevo AuthService
- `src/app/features/noticias/news.service.ts` — reescribir con Supabase
- `src/app/features/scores/competicion.service.ts` — reescribir con Supabase
- `src/app/features/scores/score.service.ts` — reescribir con Supabase
- `src/app/features/admin/socios/user.service.ts` — reescribir con Supabase

### No modificados
- Todos los componentes (templates + lógica UI)
- Guards (`authGuard`, `roleGuard`)
- `AuthInterceptor`
- Modelos TypeScript
- Routing

---

## Task 1: Instalar @supabase/supabase-js y crear SQL schema

**Files:**
- Modify: `package.json`
- Create: `docs/supabase-schema.sql`
- Create: `.env.example`
- Create: `.env` (local, NO commitear)

- [ ] **Step 1: Instalar el SDK de Supabase**

```bash
cd C:/Users/cristina.mf/Desktop/tap/appTap
npm install @supabase/supabase-js
```

Expected: `@supabase/supabase-js` aparece en `package.json` dependencies.

- [ ] **Step 2: Crear `docs/supabase-schema.sql`**

```sql
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
```

- [ ] **Step 3: Crear `.env.example`**

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

- [ ] **Step 4: Crear `.env` local con tus credenciales reales**

Copia `.env.example` como `.env` y rellena con la URL y anon key de tu proyecto Supabase (Dashboard > Settings > API).

```
VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY
```

- [ ] **Step 5: Verificar que `.env` está en `.gitignore`**

```bash
grep -e "^\.env$" .gitignore || echo ".env" >> .gitignore
```

- [ ] **Step 6: Commit**

```bash
git add docs/supabase-schema.sql .env.example .gitignore package.json package-lock.json
git commit -m "feat: install @supabase/supabase-js and add schema SQL"
```

---

## Task 2: Configurar environments y cliente Supabase

**Files:**
- Create: `src/environments/environment.ts`
- Create: `src/environments/environment.prod.ts`
- Create: `src/app/core/supabase/supabase.client.ts`
- Modify: `angular.json`

- [ ] **Step 1: Crear `src/environments/environment.ts`**

```typescript
export const environment = {
  production: false,
  supabaseUrl: import.meta.env['VITE_SUPABASE_URL'] as string,
  supabaseAnonKey: import.meta.env['VITE_SUPABASE_ANON_KEY'] as string,
};
```

- [ ] **Step 2: Crear `src/environments/environment.prod.ts`**

```typescript
export const environment = {
  production: true,
  supabaseUrl: import.meta.env['VITE_SUPABASE_URL'] as string,
  supabaseAnonKey: import.meta.env['VITE_SUPABASE_ANON_KEY'] as string,
};
```

- [ ] **Step 3: Crear `src/app/core/supabase/supabase.client.ts`**

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

export const supabase: SupabaseClient = createClient(
  environment.supabaseUrl,
  environment.supabaseAnonKey
);
```

- [ ] **Step 4: Añadir fileReplacements en `angular.json`**

Busca la sección `"configurations"` > `"production"` dentro de `"build"` en `angular.json`. Añade `fileReplacements` si no existe:

```json
"fileReplacements": [
  {
    "replace": "src/environments/environment.ts",
    "with": "src/environments/environment.prod.ts"
  }
]
```

La sección production en angular.json quedará así (solo mostrar el bloque fileReplacements, el resto permanece igual):

```json
"production": {
  "fileReplacements": [
    {
      "replace": "src/environments/environment.ts",
      "with": "src/environments/environment.prod.ts"
    }
  ],
  ...resto de opciones existentes...
}
```

- [ ] **Step 5: Verificar que compila**

```bash
cd C:/Users/cristina.mf/Desktop/tap/appTap
npx ng build --configuration development 2>&1 | tail -5
```

Expected: sin errores de compilación.

- [ ] **Step 6: Commit**

```bash
git add src/environments/ src/app/core/supabase/ angular.json
git commit -m "feat: add Supabase client and environment config"
```

---

## Task 3: Reescribir AuthService con Supabase Auth

**Files:**
- Modify: `src/app/core/auth/auth.service.ts`
- Modify: `src/app/features/auth/login/login.component.ts`

- [ ] **Step 1: Reescribir `src/app/core/auth/auth.service.ts`**

```typescript
import { Injectable } from '@angular/core';
import { BehaviorSubject, from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { User, UserRole } from '../models/user.model';
import { supabase } from '../supabase/supabase.client';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private userSubject = new BehaviorSubject<User | null>(null);
  readonly currentUser$ = this.userSubject.asObservable();

  constructor() {
    // Restaurar sesión al iniciar la app
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        this.loadProfile(data.session.user.id);
      }
    });

    // Escuchar cambios de sesión (login/logout)
    supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        this.loadProfile(session.user.id);
      } else {
        this.userSubject.next(null);
      }
    });
  }

  private async loadProfile(userId: string): Promise<void> {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) {
      const { data: authUser } = await supabase.auth.getUser();
      const user: User = {
        id: data.id,
        nombre: data.nombre,
        apellidos: data.apellidos,
        email: authUser.user?.email ?? '',
        numeroSocio: data.numero_socio,
        avatarUrl: data.avatar_url ?? undefined,
        rol: data.rol as UserRole,
        fechaAlta: new Date(data.fecha_alta),
        activo: data.activo,
      };
      this.userSubject.next(user);
    }
  }

  login(email: string, password: string): Observable<{ error: string | null }> {
    return from(
      supabase.auth.signInWithPassword({ email, password })
    ).pipe(
      map(({ error }) => ({
        error: error ? 'Email o contraseña incorrectos.' : null,
      }))
    );
  }

  logout(): void {
    supabase.auth.signOut();
    this.userSubject.next(null);
  }

  isAuthenticated(): boolean {
    return !!this.userSubject.getValue();
  }

  hasRole(roles: UserRole[]): boolean {
    const user = this.userSubject.getValue();
    return user ? roles.includes(user.rol) : false;
  }

  get currentUser(): User | null {
    return this.userSubject.getValue();
  }
}
```

- [ ] **Step 2: Reescribir `src/app/features/auth/login/login.component.ts`**

```typescript
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  form = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  error = '';
  loading = false;

  onSubmit(): void {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = '';

    const { email, password } = this.form.value;
    this.auth.login(email!, password!).subscribe(({ error }) => {
      this.loading = false;
      if (error) {
        this.error = error;
      } else {
        this.router.navigate(['/']);
      }
    });
  }
}
```

- [ ] **Step 3: Verificar que compila**

```bash
npx ng build --configuration development 2>&1 | tail -5
```

Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/core/auth/auth.service.ts src/app/features/auth/login/login.component.ts
git commit -m "feat: replace mock AuthService with Supabase Auth"
```

---

## Task 4: Reescribir NewsService con Supabase

**Files:**
- Modify: `src/app/features/noticias/news.service.ts`

- [ ] **Step 1: Reescribir `src/app/features/noticias/news.service.ts`**

```typescript
import { Injectable } from '@angular/core';
import { from, Observable, map } from 'rxjs';
import { News } from '../../core/models/news.model';
import { supabase } from '../../core/supabase/supabase.client';

function toNews(row: Record<string, unknown>): News {
  return {
    id: row['id'] as string,
    titulo: row['titulo'] as string,
    contenido: row['contenido'] as string,
    autorId: row['autor_id'] as string,
    fecha: new Date(row['fecha'] as string),
    imagenUrl: (row['imagen_url'] as string) ?? undefined,
    publicada: row['publicada'] as boolean,
  };
}

@Injectable({ providedIn: 'root' })
export class NewsService {

  getAll(): Observable<News[]> {
    return from(
      supabase.from('noticias').select('*').order('fecha', { ascending: false })
    ).pipe(map(({ data }) => (data ?? []).map(toNews)));
  }

  getPublicadas(): Observable<News[]> {
    return from(
      supabase.from('noticias').select('*').eq('publicada', true).order('fecha', { ascending: false })
    ).pipe(map(({ data }) => (data ?? []).map(toNews)));
  }

  async getById(id: string): Promise<News | null> {
    const { data } = await supabase.from('noticias').select('*').eq('id', id).single();
    return data ? toNews(data) : null;
  }

  async create(data: Omit<News, 'id'>): Promise<void> {
    await supabase.from('noticias').insert({
      titulo: data.titulo,
      contenido: data.contenido,
      autor_id: data.autorId,
      fecha: data.fecha.toISOString(),
      imagen_url: data.imagenUrl ?? null,
      publicada: data.publicada,
    });
  }

  async update(id: string, data: Partial<News>): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (data.titulo !== undefined) payload['titulo'] = data.titulo;
    if (data.contenido !== undefined) payload['contenido'] = data.contenido;
    if (data.publicada !== undefined) payload['publicada'] = data.publicada;
    if (data.imagenUrl !== undefined) payload['imagen_url'] = data.imagenUrl;
    await supabase.from('noticias').update(payload).eq('id', id);
  }

  async delete(id: string): Promise<void> {
    await supabase.from('noticias').delete().eq('id', id);
  }
}
```

> **Nota:** `getById`, `create`, `update`, `delete` ahora retornan `Promise` en lugar de ser síncronos. Los componentes que los usan (`DetalleNoticiaComponent`, `FormNoticiaComponent`, `ListaNoticiasAdminComponent`) necesitan pequeños ajustes (ver Task 7).

- [ ] **Step 2: Commit**

```bash
git add src/app/features/noticias/news.service.ts
git commit -m "feat: replace NewsService mock with Supabase queries"
```

---

## Task 5: Reescribir CompeticionService y ScoreService con Supabase

**Files:**
- Modify: `src/app/features/scores/competicion.service.ts`
- Modify: `src/app/features/scores/score.service.ts`

- [ ] **Step 1: Reescribir `src/app/features/scores/competicion.service.ts`**

```typescript
import { Injectable } from '@angular/core';
import { from, Observable, map } from 'rxjs';
import { Competicion } from '../../core/models/competicion.model';
import { supabase } from '../../core/supabase/supabase.client';

function toCompeticion(row: Record<string, unknown>): Competicion {
  return {
    id: row['id'] as string,
    nombre: row['nombre'] as string,
    modalidad: row['modalidad'] as string,
    totalPlatos: row['total_platos'] as number,
    fecha: new Date(row['fecha'] as string),
    activa: row['activa'] as boolean,
    creadaPor: row['creada_por'] as string,
  };
}

@Injectable({ providedIn: 'root' })
export class CompeticionService {

  getAll(): Observable<Competicion[]> {
    return from(
      supabase.from('competiciones').select('*').order('fecha', { ascending: false })
    ).pipe(map(({ data }) => (data ?? []).map(toCompeticion)));
  }

  getActiva(): Observable<Competicion | undefined> {
    return from(
      supabase.from('competiciones').select('*').eq('activa', true).limit(1)
    ).pipe(map(({ data }) => data && data.length > 0 ? toCompeticion(data[0]) : undefined));
  }

  async getById(id: string): Promise<Competicion | null> {
    const { data } = await supabase.from('competiciones').select('*').eq('id', id).single();
    return data ? toCompeticion(data) : null;
  }

  async create(data: Omit<Competicion, 'id'>): Promise<void> {
    await supabase.from('competiciones').insert({
      nombre: data.nombre,
      modalidad: data.modalidad,
      total_platos: data.totalPlatos,
      fecha: data.fecha.toISOString(),
      activa: data.activa,
      creada_por: data.creadaPor,
    });
  }

  async update(id: string, data: Partial<Competicion>): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (data.nombre !== undefined) payload['nombre'] = data.nombre;
    if (data.modalidad !== undefined) payload['modalidad'] = data.modalidad;
    if (data.totalPlatos !== undefined) payload['total_platos'] = data.totalPlatos;
    if (data.fecha !== undefined) payload['fecha'] = data.fecha.toISOString();
    if (data.activa !== undefined) payload['activa'] = data.activa;
    await supabase.from('competiciones').update(payload).eq('id', id);
  }
}
```

- [ ] **Step 2: Reescribir `src/app/features/scores/score.service.ts`**

```typescript
import { Injectable } from '@angular/core';
import { from, Observable, map } from 'rxjs';
import { Score } from '../../core/models/score.model';
import { supabase } from '../../core/supabase/supabase.client';

export interface RankingEntry {
  userId: string;
  platosRotos: number;
  posicion: number;
}

function toScore(row: Record<string, unknown>): Score {
  return {
    id: row['id'] as string,
    userId: row['user_id'] as string,
    competicionId: row['competicion_id'] as string,
    platosRotos: row['platos_rotos'] as number,
    fecha: new Date(row['fecha'] as string),
    registradoPor: row['registrado_por'] as string,
  };
}

@Injectable({ providedIn: 'root' })
export class ScoreService {

  getByCompeticion(competicionId: string): Observable<Score[]> {
    return from(
      supabase.from('scores').select('*').eq('competicion_id', competicionId)
    ).pipe(map(({ data }) => (data ?? []).map(toScore)));
  }

  getByUser(userId: string): Observable<Score[]> {
    return from(
      supabase.from('scores').select('*').eq('user_id', userId).order('fecha', { ascending: false })
    ).pipe(map(({ data }) => (data ?? []).map(toScore)));
  }

  getRanking(competicionId: string): Observable<RankingEntry[]> {
    return this.getByCompeticion(competicionId).pipe(
      map(scores => {
        const sorted = [...scores].sort((a, b) => b.platosRotos - a.platosRotos);
        return sorted.map((s, i) => ({
          userId: s.userId,
          platosRotos: s.platosRotos,
          posicion: i + 1,
        }));
      })
    );
  }

  async create(data: Omit<Score, 'id'>): Promise<void> {
    await supabase.from('scores').insert({
      user_id: data.userId,
      competicion_id: data.competicionId,
      platos_rotos: data.platosRotos,
      fecha: data.fecha.toISOString(),
      registrado_por: data.registradoPor,
    });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/features/scores/competicion.service.ts src/app/features/scores/score.service.ts
git commit -m "feat: replace CompeticionService and ScoreService mocks with Supabase"
```

---

## Task 6: Reescribir UserService con Supabase

**Files:**
- Modify: `src/app/features/admin/socios/user.service.ts`

- [ ] **Step 1: Reescribir `src/app/features/admin/socios/user.service.ts`**

```typescript
import { Injectable } from '@angular/core';
import { from, Observable, map } from 'rxjs';
import { User, UserRole } from '../../../core/models/user.model';
import { supabase } from '../../../core/supabase/supabase.client';

function toUser(row: Record<string, unknown>): User {
  return {
    id: row['id'] as string,
    nombre: row['nombre'] as string,
    apellidos: row['apellidos'] as string,
    email: (row['email'] as string) ?? '',
    numeroSocio: row['numero_socio'] as string,
    avatarUrl: (row['avatar_url'] as string) ?? undefined,
    rol: row['rol'] as UserRole,
    fechaAlta: new Date(row['fecha_alta'] as string),
    activo: row['activo'] as boolean,
  };
}

@Injectable({ providedIn: 'root' })
export class UserService {

  getAll(): Observable<User[]> {
    return from(
      supabase.from('profiles').select('*').order('fecha_alta', { ascending: true })
    ).pipe(map(({ data }) => (data ?? []).map(toUser)));
  }

  async getById(id: string): Promise<User | null> {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).single();
    return data ? toUser(data) : null;
  }

  async update(id: string, data: Partial<User>): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (data.nombre !== undefined) payload['nombre'] = data.nombre;
    if (data.apellidos !== undefined) payload['apellidos'] = data.apellidos;
    if (data.numeroSocio !== undefined) payload['numero_socio'] = data.numeroSocio;
    if (data.rol !== undefined) payload['rol'] = data.rol;
    if (data.avatarUrl !== undefined) payload['avatar_url'] = data.avatarUrl;
    if (data.activo !== undefined) payload['activo'] = data.activo;
    await supabase.from('profiles').update(payload).eq('id', id);
  }

  async toggleActivo(id: string): Promise<void> {
    const user = await this.getById(id);
    if (user) {
      await supabase.from('profiles').update({ activo: !user.activo }).eq('id', id);
    }
  }
}
```

> **Nota sobre `create`:** La creación de usuarios requiere la `service_role` key que no debe estar en el frontend. Por ahora, los administradores crean usuarios directamente desde el Dashboard de Supabase (Authentication > Users > Add user), y luego desde la app pueden editar el profile (nombre, rol, etc). El botón "Nuevo socio" del admin queda deshabilitado en esta iteración.

- [ ] **Step 2: Commit**

```bash
git add src/app/features/admin/socios/user.service.ts
git commit -m "feat: replace UserService mock with Supabase profiles queries"
```

---

## Task 7: Adaptar componentes a APIs async (Promise)

Los métodos `getById`, `create`, `update`, `delete`, `toggleActivo` ahora son `async/Promise`. Los componentes que los llamaban de forma síncrona necesitan ajuste.

**Files:**
- Modify: `src/app/features/noticias/detalle/detalle-noticia.component.ts`
- Modify: `src/app/features/admin/noticias/form-noticia/form-noticia.component.ts`
- Modify: `src/app/features/admin/noticias/lista-noticias-admin/lista-noticias-admin.component.ts`
- Modify: `src/app/features/admin/socios/lista-socios/lista-socios.component.ts`
- Modify: `src/app/features/admin/socios/form-socio/form-socio.component.ts`
- Modify: `src/app/features/admin/scores/form-score/form-score.component.ts`
- Modify: `src/app/features/admin/competiciones/form-competicion/form-competicion.component.ts`
- Modify: `src/app/features/scores/ranking/scores-ranking.component.ts`
- Modify: `src/app/features/perfil/perfil.component.ts`

- [ ] **Step 1: Adaptar `detalle-noticia.component.ts`**

`getById` ahora retorna `Promise<News | null>`. Cambiar `ngOnInit` a async:

```typescript
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { NewsService } from '../news.service';
import { News } from '../../../core/models/news.model';

@Component({
  selector: 'app-detalle-noticia',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './detalle-noticia.component.html',
})
export class DetalleNoticiaComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private newsService = inject(NewsService);

  noticia = signal<News | null>(null);

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const found = await this.newsService.getById(id);
      this.noticia.set(found);
    }
    if (!this.noticia()) {
      this.router.navigate(['/noticias']);
    }
  }

  goBack(): void {
    this.router.navigate(['/noticias']);
  }
}
```

- [ ] **Step 2: Adaptar `form-noticia.component.ts`**

```typescript
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NewsService } from '../../../noticias/news.service';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-form-noticia',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './form-noticia.component.html',
})
export class FormNoticiaComponent implements OnInit {
  private fb = inject(FormBuilder);
  private newsService = inject(NewsService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  isEdit = false;
  private editId?: string;

  form = this.fb.group({
    titulo:    ['', Validators.required],
    contenido: ['', Validators.required],
    publicada: [false],
  });

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const noticia = await this.newsService.getById(id);
      if (noticia) {
        this.isEdit = true;
        this.editId = id;
        this.form.patchValue(noticia);
      }
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    const val = this.form.value;
    const autorId = this.authService.currentUser?.id ?? '';

    if (this.isEdit && this.editId) {
      await this.newsService.update(this.editId, {
        titulo: val.titulo!,
        contenido: val.contenido!,
        publicada: val.publicada ?? false,
      });
    } else {
      await this.newsService.create({
        titulo: val.titulo!,
        contenido: val.contenido!,
        publicada: val.publicada ?? false,
        autorId,
        fecha: new Date(),
      });
    }
    this.router.navigate(['/admin/noticias']);
  }

  cancel(): void {
    this.router.navigate(['/admin/noticias']);
  }
}
```

- [ ] **Step 3: Adaptar `lista-noticias-admin.component.ts`**

`delete` y `update` ahora son async. Convertir los métodos afectados:

```typescript
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { NewsService } from '../../../noticias/news.service';
import { News } from '../../../../core/models/news.model';

@Component({
  selector: 'app-lista-noticias-admin',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './lista-noticias-admin.component.html',
})
export class ListaNoticiasAdminComponent {
  private newsService = inject(NewsService);
  private router = inject(Router);

  noticias = toSignal(this.newsService.getAll(), { initialValue: [] as News[] });

  publicadas = () => this.noticias().filter(n => n.publicada);
  borradores = () => this.noticias().filter(n => !n.publicada);

  editar(id: string): void {
    this.router.navigate(['/admin/noticias', id, 'editar']);
  }

  crear(): void {
    this.router.navigate(['/admin/noticias/nueva']);
  }

  async eliminar(id: string): Promise<void> {
    await this.newsService.delete(id);
  }

  async togglePublicada(noticia: News): Promise<void> {
    await this.newsService.update(noticia.id, { publicada: !noticia.publicada });
  }
}
```

> **Nota:** `toSignal(newsService.getAll())` seguirá funcionando porque `getAll()` retorna `Observable`. Pero tras `eliminar` o `togglePublicada`, el signal no se actualizará automáticamente porque la fuente es una query puntual. Para refrescar la lista, convertir `getAll()` a una señal que se recargue. La solución simple: recargar la página o re-suscribir. Solución correcta: ver step siguiente.

- [ ] **Step 4: Añadir refresh en `lista-noticias-admin.component.ts`**

Para que la lista se actualice tras mutaciones, usar un `Subject` como trigger de refresco:

```typescript
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { Subject, switchMap, startWith } from 'rxjs';
import { NewsService } from '../../../noticias/news.service';
import { News } from '../../../../core/models/news.model';

@Component({
  selector: 'app-lista-noticias-admin',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './lista-noticias-admin.component.html',
})
export class ListaNoticiasAdminComponent {
  private newsService = inject(NewsService);
  private router = inject(Router);
  private refresh$ = new Subject<void>();

  noticias = toSignal(
    this.refresh$.pipe(
      startWith(null),
      switchMap(() => this.newsService.getAll())
    ),
    { initialValue: [] as News[] }
  );

  publicadas = () => this.noticias().filter(n => n.publicada);
  borradores = () => this.noticias().filter(n => !n.publicada);

  editar(id: string): void {
    this.router.navigate(['/admin/noticias', id, 'editar']);
  }

  crear(): void {
    this.router.navigate(['/admin/noticias/nueva']);
  }

  async eliminar(id: string): Promise<void> {
    await this.newsService.delete(id);
    this.refresh$.next();
  }

  async togglePublicada(noticia: News): Promise<void> {
    await this.newsService.update(noticia.id, { publicada: !noticia.publicada });
    this.refresh$.next();
  }
}
```

- [ ] **Step 5: Adaptar `form-socio.component.ts`**

`UserService.getById` ahora es `Promise`. Adaptar `ngOnInit`:

```typescript
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { UserService } from '../user.service';
import { UserRole } from '../../../../core/models/user.model';

@Component({
  selector: 'app-form-socio',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './form-socio.component.html',
})
export class FormSocioComponent implements OnInit {
  private fb = inject(FormBuilder);
  private userService = inject(UserService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  isEdit = false;
  private editId?: string;

  form = this.fb.group({
    nombre:      ['', Validators.required],
    apellidos:   ['', Validators.required],
    email:       ['', [Validators.required, Validators.email]],
    numeroSocio: ['', Validators.required],
    rol:         ['socio' as UserRole, Validators.required],
  });

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const user = await this.userService.getById(id);
      if (user) {
        this.isEdit = true;
        this.editId = id;
        this.form.patchValue(user);
      }
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    const val = this.form.value;
    if (this.isEdit && this.editId) {
      await this.userService.update(this.editId, {
        nombre: val.nombre!,
        apellidos: val.apellidos!,
        email: val.email!,
        numeroSocio: val.numeroSocio!,
        rol: val.rol as UserRole,
      });
    }
    this.router.navigate(['/admin/socios']);
  }

  cancel(): void {
    this.router.navigate(['/admin/socios']);
  }
}
```

- [ ] **Step 6: Adaptar `lista-socios.component.ts`**

`UserService.getAll()` sigue siendo Observable. Añadir refresh igual que en noticias:

```typescript
import { Component, inject, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TitleCasePipe } from '@angular/common';
import { Subject, switchMap, startWith } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { UserService } from '../user.service';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { User } from '../../../../core/models/user.model';

@Component({
  selector: 'app-lista-socios',
  standalone: true,
  imports: [FormsModule, TitleCasePipe, AvatarComponent],
  templateUrl: './lista-socios.component.html',
})
export class ListaSociosComponent {
  private userService = inject(UserService);
  private router = inject(Router);
  private refresh$ = new Subject<void>();

  searchTerm = signal('');

  private socios = toSignal(
    this.refresh$.pipe(
      startWith(null),
      switchMap(() => this.userService.getAll())
    ),
    { initialValue: [] as User[] }
  );

  filteredSocios = computed(() => {
    const term = this.searchTerm().toLowerCase();
    if (!term) return this.socios();
    return this.socios().filter(s =>
      s.nombre.toLowerCase().includes(term) ||
      s.apellidos.toLowerCase().includes(term) ||
      s.email.toLowerCase().includes(term) ||
      s.numeroSocio.includes(term)
    );
  });

  async toggleActivo(id: string): Promise<void> {
    await this.userService.toggleActivo(id);
    this.refresh$.next();
  }

  goToEdit(id: string): void {
    this.router.navigate(['/admin/socios', id]);
  }

  goToCreate(): void {
    this.router.navigate(['/admin/socios/nuevo']);
  }
}
```

- [ ] **Step 7: Adaptar `form-score.component.ts`**

`ScoreService.create` es ahora async:

```typescript
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ScoreService } from '../../../scores/score.service';
import { CompeticionService } from '../../../scores/competicion.service';
import { UserService } from '../../socios/user.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { User } from '../../../../core/models/user.model';
import { Competicion } from '../../../../core/models/competicion.model';

@Component({
  selector: 'app-form-score',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './form-score.component.html',
})
export class FormScoreComponent {
  private fb = inject(FormBuilder);
  private scoreService = inject(ScoreService);
  private competicionService = inject(CompeticionService);
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private router = inject(Router);

  competiciones = toSignal(this.competicionService.getAll(), { initialValue: [] as Competicion[] });
  socios = toSignal(this.userService.getAll(), { initialValue: [] as User[] });

  form = this.fb.group({
    competicionId: ['', Validators.required],
    userId:        ['', Validators.required],
    platosRotos:   [0, [Validators.required, Validators.min(0)]],
  });

  maxPlatos(): number {
    const id = this.form.value.competicionId ?? '';
    const found = this.competiciones().find(c => c.id === id);
    return found?.totalPlatos ?? 25;
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    const val = this.form.value;
    await this.scoreService.create({
      competicionId: val.competicionId!,
      userId: val.userId!,
      platosRotos: Number(val.platosRotos),
      fecha: new Date(),
      registradoPor: this.authService.currentUser?.id ?? '',
    });
    this.router.navigate(['/scores']);
  }

  cancel(): void {
    this.router.navigate(['/scores']);
  }
}
```

- [ ] **Step 8: Adaptar `form-competicion.component.ts`**

`CompeticionService.create` es ahora async:

```typescript
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CompeticionService } from '../../../scores/competicion.service';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-form-competicion',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './form-competicion.component.html',
})
export class FormCompeticionComponent {
  private fb = inject(FormBuilder);
  private competicionService = inject(CompeticionService);
  private authService = inject(AuthService);
  private router = inject(Router);

  form = this.fb.group({
    nombre:      ['', Validators.required],
    modalidad:   ['', Validators.required],
    totalPlatos: [25, [Validators.required, Validators.min(1)]],
    fecha:       ['', Validators.required],
    activa:      [false],
  });

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    const val = this.form.value;
    await this.competicionService.create({
      nombre: val.nombre!,
      modalidad: val.modalidad!,
      totalPlatos: Number(val.totalPlatos),
      fecha: new Date(val.fecha!),
      activa: val.activa ?? false,
      creadaPor: this.authService.currentUser?.id ?? '',
    });
    this.router.navigate(['/scores']);
  }

  cancel(): void {
    this.router.navigate(['/scores']);
  }
}
```

- [ ] **Step 9: Adaptar `scores-ranking.component.ts`**

`CompeticionService.getById` ahora es `Promise`. El componente lo usaba de forma síncrona. Eliminar esa referencia — el nombre ya viene del signal `competiciones`:

```typescript
import { Component, inject, signal, OnInit } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { ScoreService, RankingEntry } from '../score.service';
import { CompeticionService } from '../competicion.service';
import { UserService } from '../../admin/socios/user.service';
import { Competicion } from '../../../core/models/competicion.model';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';

@Component({
  selector: 'app-scores-ranking',
  standalone: true,
  imports: [AvatarComponent],
  templateUrl: './scores-ranking.component.html',
})
export class ScoresRankingComponent implements OnInit {
  private competicionService = inject(CompeticionService);
  private scoreService = inject(ScoreService);
  private userService = inject(UserService);

  competiciones = toSignal(this.competicionService.getAll(), { initialValue: [] as Competicion[] });
  selectedId = signal<string>('');
  socios = toSignal(this.userService.getAll(), { initialValue: [] });

  ranking = toSignal(
    toObservable(this.selectedId).pipe(
      switchMap(id => this.scoreService.getRanking(id))
    ),
    { initialValue: [] as RankingEntry[] }
  );

  ngOnInit(): void {
    const comps = this.competiciones();
    if (comps.length > 0) {
      this.selectedId.set(comps[0].id);
    }
  }

  selectCompeticion(id: string): void {
    this.selectedId.set(id);
  }

  getUserNombre(userId: string): string {
    const u = this.socios().find(s => s.id === userId);
    return u ? `${u.nombre} ${u.apellidos}` : 'Desconocido';
  }

  getUserApellidos(userId: string): string {
    return this.socios().find(s => s.id === userId)?.apellidos ?? '';
  }

  getMedalIcon(posicion: number): string {
    if (posicion === 1) return '🥇';
    if (posicion === 2) return '🥈';
    if (posicion === 3) return '🥉';
    return `${posicion}º`;
  }
}
```

- [ ] **Step 10: Verificar build**

```bash
npx ng build --configuration development 2>&1 | tail -10
```

Expected: sin errores TypeScript.

- [ ] **Step 11: Commit**

```bash
git add src/app/features/
git commit -m "feat: adapt components to async Supabase service methods"
```

---

## Task 8: Configurar Vercel deploy

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Crear `vercel.json`**

```json
{
  "buildCommand": "npx ng build --configuration production",
  "outputDirectory": "dist/app-tap/browser",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

El `rewrites` es necesario para que Angular Router funcione correctamente — todas las rutas devuelven `index.html` y Angular gestiona la navegación en el cliente.

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "feat: add vercel.json for Angular SPA deploy"
```

- [ ] **Step 3: Instrucciones de despliegue en Supabase**

Antes de desplegar en Vercel, ejecutar en Supabase Dashboard > SQL Editor:
1. El contenido completo de `docs/supabase-schema.sql`
2. Crear el primer usuario admin: Dashboard > Authentication > Users > Add user
3. Ejecutar el UPDATE del seed con el UUID del usuario creado

- [ ] **Step 4: Instrucciones de despliegue en Vercel**

1. Ir a vercel.com > New Project > importar el repositorio Git
2. En Settings > Environment Variables añadir:
   - `VITE_SUPABASE_URL` = URL del proyecto Supabase
   - `VITE_SUPABASE_ANON_KEY` = anon key del proyecto Supabase
3. Deploy

---

## Task 9: Verificación end-to-end

- [ ] **Step 1: Probar login con usuario real de Supabase**

```bash
ng serve --open
```

Navegar a `http://localhost:4200`, introducir email/contraseña del usuario admin creado en Supabase. Verificar que:
- El login funciona y redirige a Home
- El nombre del usuario aparece en el header (avatar con iniciales)
- El rol admin permite acceder a `/admin/socios`

- [ ] **Step 2: Probar CRUD de noticias**

1. Ir a `/admin/noticias` — debe mostrar lista vacía (o las que haya en Supabase)
2. Crear una noticia nueva — verificar que aparece en la lista
3. Publicarla — verificar que aparece en `/noticias`
4. Editarla — verificar que los cambios se guardan
5. Eliminarla — verificar que desaparece

- [ ] **Step 3: Probar scores y competiciones**

1. Crear una competición en `/admin/competiciones/nueva`
2. Registrar un score en `/admin/scores/nuevo`
3. Verificar ranking en `/scores`
4. Verificar historial en `/scores/historial`

- [ ] **Step 4: Verificar sesión persistente**

Recargar la página. El usuario debe seguir autenticado (Supabase guarda el token en localStorage automáticamente).

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "feat: complete Supabase integration - all services connected"
```
