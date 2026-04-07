# Campos Extendidos de Socio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir DNI, teléfono, dirección y número de socio manual a los perfiles de socio, con panel de info en la lista y formulario actualizado.

**Architecture:** Migración SQL añade columnas a `profiles`. El modelo `User` y `UserService` se extienden con los nuevos campos. El formulario de creación/edición recibe los campos nuevos. La lista añade un botón de info que muestra un bottom sheet con todos los datos. La Edge Function `crear-usuario` recibe `numeroSocio` del frontend en lugar de calcularlo.

**Tech Stack:** Angular 17+ standalone · signals · ReactiveFormsModule · Tailwind CSS · SCSS BEM · Supabase · Deno (Edge Function)

---

## File Map

### Modificar
- `supabase/migrations/006_campos_extendidos_socio.sql` — añadir columnas dni, telefono, direccion, email a profiles
- `src/app/core/models/user.model.ts` — añadir dni, telefono, direccion, email a interfaz User
- `src/app/features/admin/socios/user.service.ts` — actualizar toUser, update, crearEnAuth
- `src/app/features/admin/socios/form-socio/form-socio.component.ts` — añadir campos al form
- `src/app/features/admin/socios/form-socio/form-socio.component.html` — inputs nuevos
- `src/app/features/admin/socios/lista-socios/lista-socios.component.ts` — añadir socioInfo signal
- `src/app/features/admin/socios/lista-socios/lista-socios.component.html` — botón info + bottom sheet
- `src/app/features/admin/socios/lista-socios/lista-socios.component.scss` — estilos bottom sheet
- `supabase/functions/crear-usuario/index.ts` — recibir numeroSocio del body, validar unicidad, eliminar auto-cálculo

---

## Task 1: Migración SQL

**Files:**
- Create: `supabase/migrations/006_campos_extendidos_socio.sql`

- [ ] **Step 1: Crear el archivo de migración**

Crear `supabase/migrations/006_campos_extendidos_socio.sql` con:

```sql
-- 006_campos_extendidos_socio.sql
-- Añadir campos extendidos al perfil de socio

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS dni       text,
  ADD COLUMN IF NOT EXISTS telefono  text,
  ADD COLUMN IF NOT EXISTS direccion text,
  ADD COLUMN IF NOT EXISTS email     text;
```

> **Nota:** `numero_socio` ya existe en la tabla como UNIQUE NOT NULL. No necesita añadirse.
> **Nota:** `email` se almacena aquí para poder mostrarlo y editarlo desde el perfil sin acceder a auth.users. Es redundante con auth.users pero necesario para el acceso desde el frontend con la anon key.

- [ ] **Step 2: Ejecutar la migración en Supabase**

Ejecutar el SQL directamente en el SQL Editor de Supabase (dashboard → SQL Editor → New query):

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS dni       text,
  ADD COLUMN IF NOT EXISTS telefono  text,
  ADD COLUMN IF NOT EXISTS direccion text,
  ADD COLUMN IF NOT EXISTS email     text;
```

Expected: "Success. No rows returned."

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/006_campos_extendidos_socio.sql
git commit -m "feat: add dni, telefono, direccion, email columns to profiles"
```

---

## Task 2: Modelo y UserService

**Files:**
- Modify: `src/app/core/models/user.model.ts`
- Modify: `src/app/features/admin/socios/user.service.ts`

- [ ] **Step 1: Actualizar el modelo User**

Reemplazar completamente `src/app/core/models/user.model.ts`:

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
  dni?: string;
  telefono?: string;
  direccion?: string;
}
```

- [ ] **Step 2: Actualizar toUser en UserService**

En `src/app/features/admin/socios/user.service.ts`, reemplazar la función `toUser`:

```typescript
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
    firstLogin: (row['first_login'] as boolean) ?? true,
    dni: (row['dni'] as string) ?? undefined,
    telefono: (row['telefono'] as string) ?? undefined,
    direccion: (row['direccion'] as string) ?? undefined,
  };
}
```

- [ ] **Step 3: Actualizar el método update en UserService**

Reemplazar el método `update` en `user.service.ts`:

```typescript
  async update(id: string, data: Partial<User>): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (data.nombre !== undefined) payload['nombre'] = data.nombre;
    if (data.apellidos !== undefined) payload['apellidos'] = data.apellidos;
    if (data.numeroSocio !== undefined) payload['numero_socio'] = data.numeroSocio;
    if (data.rol !== undefined) payload['rol'] = data.rol;
    if (data.avatarUrl !== undefined) payload['avatar_url'] = data.avatarUrl;
    if (data.activo !== undefined) payload['activo'] = data.activo;
    if (data.dni !== undefined) payload['dni'] = data.dni;
    if (data.telefono !== undefined) payload['telefono'] = data.telefono;
    if (data.direccion !== undefined) payload['direccion'] = data.direccion;
    if (data.email !== undefined) payload['email'] = data.email;
    await supabase.from('profiles').update(payload).eq('id', id);
    const current = this.cache.getValue();
    this.cache.next(current.map(u => u.id === id ? { ...u, ...data } : u));
  }
```

- [ ] **Step 4: Actualizar crearEnAuth en UserService**

Reemplazar el método `crearEnAuth`:

```typescript
  async crearEnAuth(data: {
    nombre: string;
    apellidos: string;
    email: string;
    rol: string;
    numeroSocio: string;
    dni?: string;
    telefono?: string;
    direccion?: string;
  }): Promise<void> {
    const { error } = await supabase.functions.invoke('crear-usuario', { body: data });
    if (error) throw new Error('Error al crear el usuario.');
  }
```

- [ ] **Step 5: Verificar compilación**

```bash
cd C:/Users/cristina.mf/Desktop/tap/appTap
npx tsc --noEmit 2>&1 | grep -E "user.model|user.service" | head -20
```

Expected: sin salida (sin errores).

- [ ] **Step 6: Commit**

```bash
git add src/app/core/models/user.model.ts
git add src/app/features/admin/socios/user.service.ts
git commit -m "feat: extend User model and UserService with dni, telefono, direccion, email"
```

---

## Task 3: Edge Function crear-usuario

**Files:**
- Modify: `supabase/functions/crear-usuario/index.ts`

- [ ] **Step 1: Reemplazar el contenido de la Edge Function**

Reemplazar completamente `supabase/functions/crear-usuario/index.ts`:

```typescript
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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: profile } = await supabaseAdmin.from('profiles').select('rol').eq('id', user.id).single()
    if (!profile || !['admin', 'moderador'].includes(profile.rol)) {
      return new Response(
        JSON.stringify({ error: 'Sin permisos' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { nombre, apellidos, email, rol, numeroSocio, dni, telefono, direccion } = await req.json()

    if (!nombre || !apellidos || !email || !rol || !numeroSocio) {
      return new Response(
        JSON.stringify({ error: 'Faltan campos: nombre, apellidos, email, rol, numeroSocio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validar que el número de socio no esté repetido
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('numero_socio', numeroSocio)
      .maybeSingle()

    if (existing) {
      return new Response(
        JSON.stringify({ error: `El número de socio ${numeroSocio} ya está en uso` }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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

    // 2. Actualizar el profile creado por el trigger
    const { error: profileError } = await supabaseAdmin.from('profiles').update({
      nombre,
      apellidos,
      numero_socio: numeroSocio,
      rol,
      email,
      dni: dni ?? null,
      telefono: telefono ?? null,
      direccion: direccion ?? null,
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

- [ ] **Step 2: Desplegar la Edge Function en Supabase**

```bash
cd C:/Users/cristina.mf/Desktop/tap/appTap
npx supabase functions deploy crear-usuario --project-ref llaowdgdzmdgseeoctdq
```

Expected: "Deployed Function crear-usuario"

Si falla por autenticación, ejecutar primero: `! npx supabase login`

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/crear-usuario/index.ts
git commit -m "feat: accept manual numeroSocio in crear-usuario edge function, validate uniqueness"
```

---

## Task 4: FormSocioComponent

**Files:**
- Modify: `src/app/features/admin/socios/form-socio/form-socio.component.ts`
- Modify: `src/app/features/admin/socios/form-socio/form-socio.component.html`

- [ ] **Step 1: Reemplazar el TS**

Reemplazar completamente `form-socio.component.ts`:

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
  styleUrl: './form-socio.component.scss',
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
    nombre:      ['', Validators.required],
    apellidos:   ['', Validators.required],
    email:       ['', [Validators.required, Validators.email]],
    numeroSocio: ['', Validators.required],
    rol:         ['socio' as UserRole, Validators.required],
    dni:         [''],
    telefono:    [''],
    direccion:   [''],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const user = this.userService.getById(id);
      if (user) {
        this.isEdit = true;
        this.editId = id;
        this.form.patchValue({
          nombre:      user.nombre,
          apellidos:   user.apellidos,
          email:       user.email,
          numeroSocio: user.numeroSocio,
          rol:         user.rol,
          dni:         user.dni ?? '',
          telefono:    user.telefono ?? '',
          direccion:   user.direccion ?? '',
        });
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
          nombre:      val.nombre!,
          apellidos:   val.apellidos!,
          numeroSocio: val.numeroSocio!,
          rol:         val.rol as UserRole,
          dni:         val.dni || undefined,
          telefono:    val.telefono || undefined,
          direccion:   val.direccion || undefined,
        });
      } else {
        await this.userService.crearEnAuth({
          nombre:      val.nombre!,
          apellidos:   val.apellidos!,
          email:       val.email!,
          numeroSocio: val.numeroSocio!,
          rol:         val.rol!,
          dni:         val.dni || undefined,
          telefono:    val.telefono || undefined,
          direccion:   val.direccion || undefined,
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

- [ ] **Step 2: Reemplazar el HTML**

Reemplazar completamente `form-socio.component.html`:

```html
<div class="form-socio">
  <div class="page-header">
    <button type="button" (click)="cancel()" class="form-socio__back-btn">
      <i class="bi bi-chevron-left"></i>
    </button>
    <h2 class="form-socio__title">{{ isEdit ? 'Editar socio' : 'Nuevo socio' }}</h2>
  </div>

  <form [formGroup]="form" (ngSubmit)="onSubmit()" class="form-socio__body">

    <!-- Datos obligatorios -->
    <p class="form-socio__section-label">Datos obligatorios</p>

    <div class="form-field">
      <label class="form-label">Nombre *</label>
      <input formControlName="nombre" type="text" class="form-input" placeholder="Nombre" />
    </div>

    <div class="form-field">
      <label class="form-label">Apellidos *</label>
      <input formControlName="apellidos" type="text" class="form-input" placeholder="Apellidos" />
    </div>

    <div class="form-field">
      <label class="form-label">Email *</label>
      <input formControlName="email" type="email" class="form-input" placeholder="email@ejemplo.com" />
    </div>

    <div class="form-field">
      <label class="form-label">Nº Socio *</label>
      <input formControlName="numeroSocio" type="text" class="form-input" placeholder="Ej: 0042" />
    </div>

    <div class="form-field">
      <label class="form-label">Rol *</label>
      <select formControlName="rol" class="form-input">
        <option value="socio">Socio</option>
        <option value="moderador">Moderador</option>
        <option value="admin">Admin</option>
      </select>
    </div>

    <!-- Datos opcionales -->
    <p class="form-socio__section-label form-socio__section-label--optional">Datos opcionales</p>

    <div class="form-field">
      <label class="form-label">DNI</label>
      <input formControlName="dni" type="text" class="form-input" placeholder="12345678A" />
    </div>

    <div class="form-field">
      <label class="form-label">Teléfono</label>
      <input formControlName="telefono" type="tel" class="form-input" placeholder="600 000 000" />
    </div>

    <div class="form-field">
      <label class="form-label">Dirección</label>
      <input formControlName="direccion" type="text" class="form-input" placeholder="Calle, número, ciudad" />
    </div>

    @if (error()) {
      <p class="form-socio__error">{{ error() }}</p>
    }

    <div class="form-socio__actions">
      <button type="button" (click)="cancel()" class="btn-secondary">Cancelar</button>
      <button type="submit" [disabled]="form.invalid || saving()" class="btn-primary">
        {{ saving() ? 'Guardando...' : (isEdit ? 'Guardar cambios' : 'Crear socio') }}
      </button>
    </div>

  </form>
</div>
```

- [ ] **Step 3: Verificar compilación**

```bash
cd C:/Users/cristina.mf/Desktop/tap/appTap
npx tsc --noEmit 2>&1 | grep "form-socio" | head -20
```

Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/features/admin/socios/form-socio/
git commit -m "feat: extend form-socio with dni, telefono, direccion and manual numeroSocio"
```

---

## Task 5: Lista de socios con botón info y bottom sheet

**Files:**
- Modify: `src/app/features/admin/socios/lista-socios/lista-socios.component.ts`
- Modify: `src/app/features/admin/socios/lista-socios/lista-socios.component.html`
- Modify: `src/app/features/admin/socios/lista-socios/lista-socios.component.scss`

- [ ] **Step 1: Actualizar el TS**

Reemplazar completamente `lista-socios.component.ts`:

```typescript
import { Component, inject, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TitleCasePipe } from '@angular/common';
import { Subject, switchMap, startWith } from 'rxjs';
import { UserService } from '../user.service';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { User } from '../../../../core/models/user.model';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-lista-socios',
  standalone: true,
  imports: [FormsModule, TitleCasePipe, AvatarComponent],
  templateUrl: './lista-socios.component.html',
  styleUrl: './lista-socios.component.scss',
})
export class ListaSociosComponent {
  private userService = inject(UserService);
  private router = inject(Router);

  searchTerm = signal('');
  socioInfo = signal<User | null>(null);
  private refresh$ = new Subject<void>();

  private socios = toSignal(
    this.refresh$.pipe(startWith(null), switchMap(() => this.userService.getAll())),
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

  goToCreate(): void {
    this.router.navigate(['/admin/socios/nuevo']);
  }

  goToEdit(id: string): void {
    this.router.navigate(['/admin/socios', id]);
  }

  async eliminar(id: string): Promise<void> {
    if (!confirm('¿Eliminar este socio? Esta acción no se puede deshacer.')) return;
    await this.userService.eliminar(id);
    this.refresh$.next();
  }

  abrirInfo(socio: User): void {
    this.socioInfo.set(socio);
  }

  cerrarInfo(): void {
    this.socioInfo.set(null);
  }
}
```

- [ ] **Step 2: Actualizar el HTML**

Reemplazar completamente `lista-socios.component.html`:

```html
<div class="lista-socios">
  <!-- Buscador -->
  <div class="lista-socios__search">
    <i class="bi bi-search lista-socios__search-icon"></i>
    <input
      [ngModel]="searchTerm()"
      (ngModelChange)="searchTerm.set($event)"
      aria-label="Buscar socio"
      placeholder="Buscar socio..."
      class="lista-socios__search-input"
    />
  </div>

  <h3 class="section-title">Socios ({{ filteredSocios().length }})</h3>

  @for (socio of filteredSocios(); track socio.id) {
    <div class="card socio-item">
      <app-avatar [nombre]="socio.nombre" [apellidos]="socio.apellidos" [avatarUrl]="socio.avatarUrl" [size]="34" />
      <div class="socio-item__info">
        <p class="socio-item__nombre">{{ socio.nombre }} {{ socio.apellidos }}</p>
        <p class="socio-item__meta">{{ socio.rol | titlecase }} · #{{ socio.numeroSocio }}</p>
      </div>
      <div class="socio-item__actions">
        <button (click)="abrirInfo(socio)" class="socio-item__btn-info">
          <i class="bi bi-info-circle socio-item__btn-icon"></i>
        </button>
        <button (click)="goToEdit(socio.id)" class="socio-item__btn-edit">
          <i class="bi bi-pencil-fill socio-item__btn-icon"></i>
        </button>
        <button (click)="eliminar(socio.id)" class="socio-item__btn-delete">
          <i class="bi bi-trash-fill socio-item__btn-icon"></i>
        </button>
      </div>
    </div>
  }

  @if (filteredSocios().length === 0) {
    <p class="lista-socios__empty">No se encontraron socios.</p>
  }
</div>

<!-- FAB -->
<button (click)="goToCreate()" class="fab">
  <i class="bi bi-plus-lg fab-icon"></i>
</button>

<!-- Bottom sheet info -->
@if (socioInfo(); as s) {
  <div class="info-overlay" (click)="cerrarInfo()"></div>
  <div class="info-sheet">
    <div class="info-sheet__handle"></div>
    <div class="info-sheet__header">
      <h3 class="info-sheet__nombre">{{ s.nombre }} {{ s.apellidos }}</h3>
      <span class="info-sheet__socio">#{{ s.numeroSocio }}</span>
    </div>
    <div class="info-sheet__body">
      <div class="info-row">
        <i class="bi bi-envelope info-row__icon"></i>
        <span class="info-row__value">{{ s.email || '—' }}</span>
      </div>
      <div class="info-row">
        <i class="bi bi-card-text info-row__icon"></i>
        <span class="info-row__value">{{ s.dni || '—' }}</span>
      </div>
      <div class="info-row">
        <i class="bi bi-telephone info-row__icon"></i>
        <span class="info-row__value">{{ s.telefono || '—' }}</span>
      </div>
      <div class="info-row">
        <i class="bi bi-geo-alt info-row__icon"></i>
        <span class="info-row__value">{{ s.direccion || '—' }}</span>
      </div>
    </div>
    <button (click)="goToEdit(s.id); cerrarInfo()" class="btn-primary info-sheet__edit-btn">
      <i class="bi bi-pencil-fill"></i> Editar
    </button>
  </div>
}
```

- [ ] **Step 3: Añadir estilos al SCSS**

Leer `lista-socios.component.scss` para ver el contenido actual, luego añadir al final:

```scss
// ── Botón info ────────────────────────────────────────────────

.socio-item__btn-info {
  @apply text-neutral-300 text-[16px] px-1
         hover:text-secondary transition-colors;
}

// ── Bottom sheet info ─────────────────────────────────────────

.info-overlay {
  @apply fixed inset-0 z-40 bg-black/30;
}

.info-sheet {
  @apply fixed bottom-0 left-0 right-0 z-50
         bg-white rounded-t-[20px] px-4 pt-3 pb-8
         flex flex-col gap-4;
  box-shadow: 0 -4px 24px rgba(0,0,0,0.12);

  &__handle {
    @apply w-10 h-1 bg-neutral-200 rounded-full mx-auto mb-1;
  }

  &__header {
    @apply flex items-center justify-between;
  }

  &__nombre {
    @apply text-[18px] font-extrabold text-secondary;
  }

  &__socio {
    @apply text-sm font-bold text-neutral-400;
  }

  &__body {
    @apply flex flex-col gap-3;
  }

  &__edit-btn {
    @apply mt-2;
  }
}

.info-row {
  @apply flex items-center gap-3;

  &__icon {
    @apply text-neutral-300 text-[16px] flex-shrink-0 w-5 text-center;
  }

  &__value {
    @apply text-sm font-medium text-secondary;
  }
}
```

- [ ] **Step 4: Verificar compilación**

```bash
cd C:/Users/cristina.mf/Desktop/tap/appTap
npx tsc --noEmit 2>&1 | grep "lista-socios" | head -20
```

Expected: sin errores.

- [ ] **Step 5: Commit y push**

```bash
git add src/app/features/admin/socios/lista-socios/
git commit -m "feat: add info button and bottom sheet with full socio data in lista-socios"
git push origin HEAD:main
```

---

## Self-Review

### Cobertura de spec
- ✅ Campos nuevos en BD: `dni`, `telefono`, `direccion`, `email` en tabla `profiles`
- ✅ `numero_socio` es manual (el admin lo introduce en el formulario)
- ✅ `numero_socio` único — validado en la Edge Function con respuesta 409
- ✅ Formulario de creación: nombre, apellidos, email, nº socio, rol, dni, teléfono, dirección
- ✅ Formulario de edición: igual pero email deshabilitado
- ✅ Lista: icono `bi-info-circle` en cada fila
- ✅ Bottom sheet con todos los datos al pulsar info
- ✅ Bottom sheet se cierra al pulsar el overlay
- ✅ Botón "Editar" en el bottom sheet

### Tipos consistentes
- `User.dni?: string`, `User.telefono?: string`, `User.direccion?: string` — opcionales en modelo, Tasks 2, 4 y 5
- `crearEnAuth` recibe `numeroSocio: string` — Task 2 y Task 4 usan la misma firma
- `update` acepta `dni`, `telefono`, `direccion`, `email` — Task 2 y Task 4 usan los mismos nombres
- `socioInfo = signal<User | null>(null)` — Task 5 TS y HTML usan `socioInfo()`

### Placeholder scan
- Sin TBDs ni TODOs
- Todos los code blocks son completos y ejecutables
