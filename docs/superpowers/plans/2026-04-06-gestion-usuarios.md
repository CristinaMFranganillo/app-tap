# Gestión de Usuarios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el flujo de solicitud pública por creación directa de usuarios por el administrador, con Edge Functions para crear/eliminar en Supabase Auth y modal de cambio de contraseña en el primer login.

**Architecture:** El admin crea usuarios desde `/admin/socios/nuevo` — el formulario llama a una Edge Function `crear-usuario` que usa el service role de Supabase para crear el usuario en Auth y el perfil en `profiles`. Al hacer login por primera vez (`first_login = true`), el shell muestra un modal para cambiar contraseña. Toda la lógica de solicitudes públicas se elimina.

**Tech Stack:** Angular 19 (signals, standalone), Supabase Auth Admin API, Deno Edge Functions, TypeScript.

---

## Estructura de archivos

| Acción | Archivo |
|---|---|
| Crear | `supabase/functions/crear-usuario/index.ts` |
| Crear | `supabase/functions/eliminar-usuario/index.ts` |
| Modificar | `src/app/core/models/user.model.ts` — añadir `firstLogin` |
| Modificar | `src/app/core/auth/auth.service.ts` — exponer `firstLogin$` |
| Modificar | `src/app/features/admin/socios/user.service.ts` — métodos `crearEnAuth`, `eliminar` |
| Modificar | `src/app/features/admin/socios/form-socio/form-socio.component.ts` — usar nueva Edge Function |
| Modificar | `src/app/features/admin/socios/lista-socios/lista-socios.component.html` — botones editar/eliminar |
| Modificar | `src/app/features/admin/socios/lista-socios/lista-socios.component.ts` — método eliminar |
| Crear | `src/app/shared/components/cambiar-password/cambiar-password.component.ts` |
| Crear | `src/app/shared/components/cambiar-password/cambiar-password.component.html` |
| Modificar | `src/app/features/shell/shell.component.ts` — detectar firstLogin y mostrar modal |
| Modificar | `src/app/features/shell/shell.component.html` — incluir modal |
| Eliminar | `src/app/features/registro/registro.component.ts` |
| Eliminar | `src/app/features/registro/registro.component.html` |
| Eliminar | `src/app/features/registro/registro-confirmacion.component.ts` |
| Eliminar | `src/app/features/registro/registro-confirmacion.component.html` |
| Eliminar | `src/app/features/registro/solicitud.service.ts` |
| Eliminar | `src/app/features/admin/solicitudes/lista-solicitudes.component.ts` |
| Eliminar | `src/app/features/admin/solicitudes/lista-solicitudes.component.html` |
| Eliminar | `src/app/core/models/solicitud.model.ts` |
| Eliminar | `supabase/functions/aceptar-solicitud/index.ts` |
| Eliminar | `supabase/functions/rechazar-solicitud/index.ts` |
| Modificar | `src/app/app.routes.ts` — eliminar rutas /registro |
| Modificar | `src/app/features/admin/admin.routes.ts` — eliminar ruta solicitudes |

---

### Task 1: Migración BD — añadir `first_login` a profiles

**Files:**
- Create: `supabase/migrations/003_first_login.sql`

- [ ] **Step 1: Crear la migración**

```sql
-- supabase/migrations/003_first_login.sql
ALTER TABLE profiles ADD COLUMN first_login boolean NOT NULL DEFAULT true;
```

- [ ] **Step 2: Aplicar la migración en Supabase**

Usar MCP tool `mcp__supabase__apply_migration` con name `add_first_login` y el SQL anterior.

- [ ] **Step 3: Verificar**

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'first_login';
```

Resultado esperado: `first_login | boolean | true`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/003_first_login.sql
git commit -m "feat: add first_login flag to profiles"
```

---

### Task 2: Edge Function `crear-usuario`

**Files:**
- Create: `supabase/functions/crear-usuario/index.ts`

- [ ] **Step 1: Crear la función**

```typescript
// supabase/functions/crear-usuario/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { nombre, apellidos, email, rol } = await req.json()

    if (!nombre || !apellidos || !email || !rol) {
      return new Response(
        JSON.stringify({ error: 'Faltan campos: nombre, apellidos, email, rol' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Contraseña provisional = prefijo del email
    const password = email.split('@')[0]

    // 1. Crear usuario en Auth
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (createError || !authData.user) {
      return new Response(
        JSON.stringify({ error: `Error creando usuario: ${createError?.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Calcular número de socio automático
    const { data: perfiles } = await supabaseAdmin.from('profiles').select('numero_socio')
    const nums = (perfiles ?? [])
      .map((r: { numero_socio: string }) => parseInt(r.numero_socio, 10))
      .filter((n: number) => !isNaN(n))
    const max = nums.length > 0 ? Math.max(...nums) : 0
    const numeroSocio = String(max + 1).padStart(4, '0')

    // 3. Actualizar el profile creado por el trigger
    const { error: profileError } = await supabaseAdmin.from('profiles').update({
      nombre,
      apellidos,
      numero_socio: numeroSocio,
      rol,
      activo: true,
      first_login: true,
    }).eq('id', authData.user.id)

    if (profileError) {
      return new Response(
        JSON.stringify({ error: `Error actualizando perfil: ${profileError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ id: authData.user.id, numeroSocio }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Error interno: ${err}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

- [ ] **Step 2: Desplegar**

Usar MCP tool `mcp__supabase__deploy_edge_function` con name `crear-usuario`.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/crear-usuario/index.ts
git commit -m "feat: add crear-usuario edge function"
```

---

### Task 3: Edge Function `eliminar-usuario`

**Files:**
- Create: `supabase/functions/eliminar-usuario/index.ts`

- [ ] **Step 1: Crear la función**

```typescript
// supabase/functions/eliminar-usuario/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId } = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Falta userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (error) {
      return new Response(
        JSON.stringify({ error: `Error eliminando usuario: ${error.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Error interno: ${err}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

- [ ] **Step 2: Verificar que profiles tiene ON DELETE CASCADE**

```sql
SELECT tc.constraint_name, rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name = 'profiles';
```

Si no tiene CASCADE, añadirlo en una migración antes de desplegar.

- [ ] **Step 3: Desplegar**

Usar MCP tool `mcp__supabase__deploy_edge_function` con name `eliminar-usuario`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/eliminar-usuario/index.ts
git commit -m "feat: add eliminar-usuario edge function"
```

---

### Task 4: Actualizar modelo User y UserService

**Files:**
- Modify: `src/app/core/models/user.model.ts`
- Modify: `src/app/features/admin/socios/user.service.ts`

- [ ] **Step 1: Añadir `firstLogin` al modelo**

Reemplazar el contenido de `src/app/core/models/user.model.ts`:

```typescript
export type UserRole = 'socio' | 'moderador' | 'admin';

export interface User {
  id: string;
  nombre: string;
  apellidos: string;
  email: string;
  numeroSocio: string;
  avatarUrl?: string;
  rol: UserRole;
  fechaAlta: Date;
  activo: boolean;
  firstLogin: boolean;
}
```

- [ ] **Step 2: Actualizar el mapper `toUser` en `user.service.ts`**

En `src/app/features/admin/socios/user.service.ts`, actualizar la función `toUser`:

```typescript
function toUser(row: Record<string, unknown>): User {
  return {
    id: row['id'] as string,
    nombre: row['nombre'] as string,
    apellidos: row['apellidos'] as string,
    email: '',
    numeroSocio: row['numero_socio'] as string,
    avatarUrl: (row['avatar_url'] as string) ?? undefined,
    rol: row['rol'] as UserRole,
    fechaAlta: new Date(row['fecha_alta'] as string),
    activo: row['activo'] as boolean,
    firstLogin: (row['first_login'] as boolean) ?? true,
  };
}
```

- [ ] **Step 3: Añadir métodos `crearEnAuth` y `eliminar` a `UserService`**

Añadir antes del cierre de la clase en `user.service.ts`:

```typescript
async crearEnAuth(data: { nombre: string; apellidos: string; email: string; rol: string }): Promise<void> {
  const { error } = await supabase.functions.invoke('crear-usuario', { body: data });
  if (error) throw new Error('Error al crear el usuario.');
}

async eliminar(id: string): Promise<void> {
  const { error } = await supabase.functions.invoke('eliminar-usuario', { body: { userId: id } });
  if (error) throw new Error('Error al eliminar el usuario.');
  const current = this.cache.getValue();
  this.cache.next(current.filter(u => u.id !== id));
}

async setFirstLoginDone(id: string): Promise<void> {
  await supabase.from('profiles').update({ first_login: false }).eq('id', id);
}
```

- [ ] **Step 4: Eliminar `getNextNumeroSocio` y `create` de UserService**

Estos métodos quedan reemplazados por la Edge Function. Eliminar los métodos `getNextNumeroSocio` y `create` de `user.service.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/app/core/models/user.model.ts src/app/features/admin/socios/user.service.ts
git commit -m "feat: update user model and service for auth-based creation"
```

---

### Task 5: Actualizar `auth.service.ts` para exponer `firstLogin`

**Files:**
- Modify: `src/app/core/auth/auth.service.ts`

- [ ] **Step 1: Añadir `firstLogin` al perfil que se carga**

En `auth.service.ts`, en el método `loadProfile`, añadir `firstLogin` al objeto `User`:

```typescript
private async loadProfile(userId: string): Promise<void> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (data) {
    const { data: authUser } = await supabase.auth.getUser();
    const user: User = {
      id: data['id'],
      nombre: data['nombre'],
      apellidos: data['apellidos'],
      email: authUser.user?.email ?? '',
      numeroSocio: data['numero_socio'],
      avatarUrl: data['avatar_url'] ?? undefined,
      rol: data['rol'] as UserRole,
      fechaAlta: new Date(data['fecha_alta']),
      activo: data['activo'],
      firstLogin: data['first_login'] ?? true,
    };
    this.userSubject.next(user);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/core/auth/auth.service.ts
git commit -m "feat: include firstLogin in auth profile"
```

---

### Task 6: Actualizar `form-socio` para usar la Edge Function

**Files:**
- Modify: `src/app/features/admin/socios/form-socio/form-socio.component.ts`
- Modify: `src/app/features/admin/socios/form-socio/form-socio.component.html`

- [ ] **Step 1: Actualizar el componente**

Reemplazar el contenido de `form-socio.component.ts`:

```typescript
import { Component, inject, OnInit, signal } from '@angular/core';
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
  saving = signal(false);
  error = signal('');

  form = this.fb.group({
    nombre:    ['', Validators.required],
    apellidos: ['', Validators.required],
    email:     ['', [Validators.required, Validators.email]],
    rol:       ['socio' as UserRole, Validators.required],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const user = this.userService.getById(id);
      if (user) {
        this.isEdit = true;
        this.editId = id;
        this.form.patchValue(user);
        this.form.get('email')?.disable();
      }
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set('');
    const val = this.form.getRawValue();

    try {
      if (this.isEdit && this.editId) {
        await this.userService.update(this.editId, {
          nombre: val.nombre!,
          apellidos: val.apellidos!,
          rol: val.rol as UserRole,
        });
      } else {
        await this.userService.crearEnAuth({
          nombre: val.nombre!,
          apellidos: val.apellidos!,
          email: val.email!,
          rol: val.rol!,
        });
      }
      this.router.navigate(['/admin/socios']);
    } catch (err: unknown) {
      this.error.set(err instanceof Error ? err.message : 'Error al guardar.');
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    this.router.navigate(['/admin/socios']);
  }
}
```

- [ ] **Step 2: Actualizar el template**

Reemplazar el contenido de `form-socio.component.html`:

```html
<div class="p-3">
  <div class="flex items-center gap-2 mb-4">
    <button (click)="cancel()" class="text-gray-400">
      <i class="bi bi-chevron-left text-[15px]"></i>
    </button>
    <h3 class="text-[11px] font-bold text-brand-dark">{{ isEdit ? 'Editar Socio' : 'Nuevo Socio' }}</h3>
  </div>

  @if (error()) {
    <p class="text-[9px] text-danger font-semibold mb-3">{{ error() }}</p>
  }

  <div class="bg-white rounded-[12px] p-3 shadow-sm">
    <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-3">
      <div>
        <label class="block text-[7.5px] font-bold text-gray-300 uppercase tracking-wide mb-1">Nombre</label>
        <input formControlName="nombre" placeholder="Nombre"
          class="w-full bg-surface rounded-[10px] px-3 py-2 text-[10px] font-medium text-brand-dark outline-none" />
      </div>

      <div>
        <label class="block text-[7.5px] font-bold text-gray-300 uppercase tracking-wide mb-1">Apellidos</label>
        <input formControlName="apellidos" placeholder="Apellidos"
          class="w-full bg-surface rounded-[10px] px-3 py-2 text-[10px] font-medium text-brand-dark outline-none" />
      </div>

      @if (!isEdit) {
        <div>
          <label class="block text-[7.5px] font-bold text-gray-300 uppercase tracking-wide mb-1">Email</label>
          <input formControlName="email" type="email" placeholder="email@ejemplo.es"
            class="w-full bg-surface rounded-[10px] px-3 py-2 text-[10px] font-medium text-brand-dark outline-none" />
        </div>
      }

      <div>
        <label class="block text-[7.5px] font-bold text-gray-300 uppercase tracking-wide mb-1">Rol</label>
        <select formControlName="rol"
          class="w-full bg-surface rounded-[10px] px-3 py-2 text-[10px] font-medium text-brand-dark outline-none">
          <option value="socio">Socio</option>
          <option value="moderador">Moderador</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <div class="flex gap-2 pt-1">
        <button type="button" (click)="cancel()"
          class="flex-1 py-2.5 rounded-[12px] border border-gray-200 text-[9px] font-bold text-gray-400">
          Cancelar
        </button>
        <button type="submit" [disabled]="form.invalid || saving()"
          class="flex-1 py-2.5 rounded-[12px] bg-brand-yellow text-brand-dark text-[9px] font-bold disabled:opacity-50">
          {{ saving() ? 'Guardando...' : (isEdit ? 'Guardar cambios' : 'Crear socio') }}
        </button>
      </div>
    </form>
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/features/admin/socios/form-socio/
git commit -m "feat: form-socio uses crear-usuario edge function"
```

---

### Task 7: Botones editar y eliminar en lista de socios

**Files:**
- Modify: `src/app/features/admin/socios/lista-socios/lista-socios.component.ts`
- Modify: `src/app/features/admin/socios/lista-socios/lista-socios.component.html`

- [ ] **Step 1: Añadir método `eliminar` y navegación al componente**

En `lista-socios.component.ts`, añadir:

```typescript
goToEdit(id: string): void {
  this.router.navigate(['/admin/socios', id]);
}

async eliminar(id: string): Promise<void> {
  if (!confirm('¿Eliminar este socio? Esta acción no se puede deshacer.')) return;
  await this.userService.eliminar(id);
  this.refresh$.next();
}
```

También añadir `private router = inject(Router);` en los injects (ya existe en el componente — verificar si ya está).

- [ ] **Step 2: Actualizar el template para mostrar los botones**

En `lista-socios.component.html`, reemplazar la tarjeta de cada socio:

```html
@for (socio of filteredSocios(); track socio.id) {
  <div class="flex items-center gap-2 bg-white rounded-[12px] px-3 py-2 mb-2 shadow-sm">
    <app-avatar [nombre]="socio.nombre" [apellidos]="socio.apellidos" [avatarUrl]="socio.avatarUrl" [size]="34" />
    <div class="flex-1 min-w-0">
      <p class="text-[9.5px] font-bold text-brand-dark truncate">{{ socio.nombre }} {{ socio.apellidos }}</p>
      <p class="text-[8px] text-gray-400 font-medium truncate">{{ socio.email }} · {{ socio.rol | titlecase }}</p>
    </div>
    <div class="flex items-center gap-2 ml-1">
      <button (click)="toggleActivo(socio.id)"
        class="w-2 h-2 rounded-full flex-shrink-0"
        [class]="socio.activo ? 'bg-success' : 'bg-gray-200'"
        [title]="socio.activo ? 'Desactivar' : 'Activar'">
      </button>
      <span class="text-[7.5px] text-gray-300 font-semibold">#{{ socio.numeroSocio }}</span>
      <button (click)="goToEdit(socio.id)" class="text-gray-400">
        <i class="bi bi-pencil-fill text-[13px]"></i>
      </button>
      <button (click)="eliminar(socio.id)" class="text-danger">
        <i class="bi bi-trash-fill text-[13px]"></i>
      </button>
    </div>
  </div>
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/features/admin/socios/lista-socios/
git commit -m "feat: add edit and delete buttons to socios list"
```

---

### Task 8: Modal cambio de contraseña en primer login

**Files:**
- Create: `src/app/shared/components/cambiar-password/cambiar-password.component.ts`
- Create: `src/app/shared/components/cambiar-password/cambiar-password.component.html`
- Modify: `src/app/features/shell/shell.component.ts`
- Modify: `src/app/features/shell/shell.component.html`

- [ ] **Step 1: Crear el componente modal**

```typescript
// src/app/shared/components/cambiar-password/cambiar-password.component.ts
import { Component, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { UserService } from '../../../features/admin/socios/user.service';
import { supabase } from '../../../core/supabase/supabase.client';

@Component({
  selector: 'app-cambiar-password',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './cambiar-password.component.html',
})
export class CambiarPasswordComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private userService = inject(UserService);

  cerrar = output<void>();

  saving = signal(false);
  error = signal('');

  form = this.fb.group({
    password:  ['', [Validators.required, Validators.minLength(6)]],
    confirmar: ['', Validators.required],
  });

  async guardar(): Promise<void> {
    const { password, confirmar } = this.form.value;
    if (password !== confirmar) {
      this.error.set('Las contraseñas no coinciden.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    try {
      const { error } = await supabase.auth.updateUser({ password: password! });
      if (error) throw new Error(error.message);
      await this.marcarLoginDone();
      this.cerrar.emit();
    } catch (err: unknown) {
      this.error.set(err instanceof Error ? err.message : 'Error al cambiar la contraseña.');
    } finally {
      this.saving.set(false);
    }
  }

  async omitir(): Promise<void> {
    await this.marcarLoginDone();
    this.cerrar.emit();
  }

  private async marcarLoginDone(): Promise<void> {
    const id = this.auth.currentUser?.id;
    if (id) await this.userService.setFirstLoginDone(id);
  }
}
```

- [ ] **Step 2: Crear el template del modal**

```html
<!-- src/app/shared/components/cambiar-password/cambiar-password.component.html -->
<div class="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
  <div class="bg-white w-full max-w-sm rounded-t-[20px] p-5">
    <h2 class="text-[12px] font-bold text-brand-dark mb-1">¡Bienvenido!</h2>
    <p class="text-[9px] text-gray-400 font-medium mb-4">
      Estás usando una contraseña provisional. ¿Quieres cambiarla ahora?
    </p>

    @if (error()) {
      <p class="text-[9px] text-danger font-semibold mb-3">{{ error() }}</p>
    }

    <form [formGroup]="form" (ngSubmit)="guardar()" class="flex flex-col gap-3">
      <div>
        <label class="block text-[7.5px] font-bold text-gray-300 uppercase tracking-wide mb-1">Nueva contraseña</label>
        <input formControlName="password" type="password" placeholder="Mínimo 6 caracteres"
          class="w-full bg-surface rounded-[10px] px-3 py-2 text-[10px] font-medium text-brand-dark outline-none" />
      </div>
      <div>
        <label class="block text-[7.5px] font-bold text-gray-300 uppercase tracking-wide mb-1">Confirmar contraseña</label>
        <input formControlName="confirmar" type="password" placeholder="Repite la contraseña"
          class="w-full bg-surface rounded-[10px] px-3 py-2 text-[10px] font-medium text-brand-dark outline-none" />
      </div>

      <div class="flex gap-2 pt-1">
        <button type="button" (click)="omitir()"
          class="flex-1 py-2.5 rounded-[12px] border border-gray-200 text-[9px] font-bold text-gray-400">
          Ahora no
        </button>
        <button type="submit" [disabled]="form.invalid || saving()"
          class="flex-1 py-2.5 rounded-[12px] bg-brand-yellow text-brand-dark text-[9px] font-bold disabled:opacity-50">
          {{ saving() ? 'Guardando...' : 'Cambiar contraseña' }}
        </button>
      </div>
    </form>
  </div>
</div>
```

- [ ] **Step 3: Actualizar ShellComponent para detectar primer login**

Reemplazar `src/app/features/shell/shell.component.ts`:

```typescript
import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { BottomNavComponent } from '../../shared/components/bottom-nav/bottom-nav.component';
import { CambiarPasswordComponent } from '../../shared/components/cambiar-password/cambiar-password.component';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, BottomNavComponent, CambiarPasswordComponent],
  templateUrl: './shell.component.html',
})
export class ShellComponent implements OnInit {
  private auth = inject(AuthService);
  mostrarCambioPassword = signal(false);

  ngOnInit(): void {
    if (this.auth.currentUser?.firstLogin) {
      this.mostrarCambioPassword.set(true);
    }
  }

  onPasswordCerrado(): void {
    this.mostrarCambioPassword.set(false);
  }
}
```

- [ ] **Step 4: Leer el template actual del shell**

Leer `src/app/features/shell/shell.component.html` para ver su contenido actual antes de modificarlo.

- [ ] **Step 5: Actualizar el template del shell**

```html
<app-header />
<main class="flex-1 overflow-y-auto">
  <router-outlet />
</main>
<app-bottom-nav />

@if (mostrarCambioPassword()) {
  <app-cambiar-password (cerrar)="onPasswordCerrado()" />
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/shared/components/cambiar-password/ src/app/features/shell/
git commit -m "feat: show change-password modal on first login"
```

---

### Task 9: Eliminar flujo de solicitudes

**Files:**
- Delete: `src/app/features/registro/registro.component.ts`
- Delete: `src/app/features/registro/registro.component.html`
- Delete: `src/app/features/registro/registro-confirmacion.component.ts`
- Delete: `src/app/features/registro/registro-confirmacion.component.html`
- Delete: `src/app/features/registro/solicitud.service.ts`
- Delete: `src/app/features/admin/solicitudes/lista-solicitudes.component.ts`
- Delete: `src/app/features/admin/solicitudes/lista-solicitudes.component.html`
- Delete: `src/app/core/models/solicitud.model.ts`
- Delete: `supabase/functions/aceptar-solicitud/index.ts`
- Delete: `supabase/functions/rechazar-solicitud/index.ts`
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/features/admin/admin.routes.ts`

- [ ] **Step 1: Eliminar archivos del flujo de registro**

```bash
rm src/app/features/registro/registro.component.ts
rm src/app/features/registro/registro.component.html
rm src/app/features/registro/registro-confirmacion.component.ts
rm src/app/features/registro/registro-confirmacion.component.html
rm src/app/features/registro/solicitud.service.ts
rm src/app/features/admin/solicitudes/lista-solicitudes.component.ts
rm src/app/features/admin/solicitudes/lista-solicitudes.component.html
rm src/app/core/models/solicitud.model.ts
rm supabase/functions/aceptar-solicitud/index.ts
rm supabase/functions/rechazar-solicitud/index.ts
```

- [ ] **Step 2: Limpiar `app.routes.ts`**

Eliminar las rutas de registro. El archivo debe quedar:

```typescript
import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: '',
    loadComponent: () =>
      import('./features/shell/shell.component').then(m => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/home/home.component').then(m => m.HomeComponent),
      },
      {
        path: 'noticias',
        loadChildren: () =>
          import('./features/noticias/noticias.routes').then(m => m.noticiasRoutes),
      },
      {
        path: 'scores',
        loadChildren: () =>
          import('./features/scores/scores.routes').then(m => m.scoresRoutes),
      },
      {
        path: 'perfil',
        loadComponent: () =>
          import('./features/perfil/perfil.component').then(m => m.PerfilComponent),
      },
      {
        path: 'admin',
        loadChildren: () =>
          import('./features/admin/admin.routes').then(m => m.adminRoutes),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
```

- [ ] **Step 3: Limpiar `admin.routes.ts`**

Eliminar la ruta de solicitudes del array `adminRoutes` en `src/app/features/admin/admin.routes.ts`.

- [ ] **Step 4: Verificar compilación**

```bash
cd appTap && npm run build 2>&1 | tail -20
```

Esperado: sin errores de compilación.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: remove public registration flow, admin creates users directly"
```

---

### Task 10: Drop tabla `solicitudes_registro`

**Files:**
- Create: `supabase/migrations/004_drop_solicitudes.sql`

- [ ] **Step 1: Crear la migración**

```sql
-- supabase/migrations/004_drop_solicitudes.sql
DROP TABLE IF EXISTS solicitudes_registro;
```

- [ ] **Step 2: Aplicar**

Usar MCP tool `mcp__supabase__apply_migration` con name `drop_solicitudes`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/004_drop_solicitudes.sql
git commit -m "chore: drop solicitudes_registro table"
```
