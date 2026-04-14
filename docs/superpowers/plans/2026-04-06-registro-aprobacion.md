# Registro con Aprobación — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que aspirantes a socio soliciten acceso desde el login; la solicitud queda pendiente hasta que un admin la acepta o rechaza, enviando email en ambos casos.

**Architecture:** Angular 19 standalone components con Supabase como backend. La pantalla de registro es pública (sin authGuard). El panel admin `/admin/solicitudes` usa roleGuard. Dos Supabase Edge Functions (aceptar-solicitud, rechazar-solicitud) ejecutan lógica con service_role internamente (crear usuario en Auth, enviar emails con Resend).

**Tech Stack:** Angular 19, Supabase JS SDK v2, Supabase Edge Functions (Deno/TypeScript), Resend (emails), Tailwind CSS, Bootstrap Icons, Angular Signals, RxJS

---

## File Map

### Nuevos
- `src/app/core/models/solicitud.model.ts` — tipos `EstadoSolicitud` e interfaz `SolicitudRegistro`
- `src/app/features/registro/solicitud.service.ts` — CRUD + llamadas a Edge Functions
- `src/app/features/registro/registro.component.ts` + `.html` — formulario público de solicitud
- `src/app/features/registro/registro-confirmacion.component.ts` + `.html` — pantalla de confirmación
- `src/app/features/admin/solicitudes/lista-solicitudes.component.ts` + `.html` — panel admin con pestañas
- `supabase/functions/aceptar-solicitud/index.ts` — Edge Function: crea usuario Auth + envía magic link + email bienvenida
- `supabase/functions/rechazar-solicitud/index.ts` — Edge Function: marca rechazada + envía email rechazo

### Modificados
- `src/app/app.routes.ts` — añadir rutas `/registro` y `/registro/confirmacion` (públicas)
- `src/app/features/admin/admin.routes.ts` — añadir ruta `/admin/solicitudes`
- `src/app/features/auth/login/login.component.html` — añadir enlace "¿Quieres ser socio?"
- `docs/supabase-schema.sql` — añadir tabla `solicitudes_registro` + políticas RLS

---

## Task 1: Modelo TypeScript y SQL

**Files:**
- Create: `src/app/core/models/solicitud.model.ts`
- Modify: `docs/supabase-schema.sql`

- [ ] **Step 1: Crear el modelo TypeScript**

Crear `src/app/core/models/solicitud.model.ts`:

```typescript
export type EstadoSolicitud = 'pendiente' | 'aceptada' | 'rechazada';

export interface SolicitudRegistro {
  id: string;
  nombre: string;
  apellidos: string;
  email: string;
  mensaje?: string;
  estado: EstadoSolicitud;
  fecha: Date;
  revisadaPor?: string;
  fechaRevision?: Date;
  motivoRechazo?: string;
}
```

- [ ] **Step 2: Añadir SQL al schema**

Abrir `docs/supabase-schema.sql` y añadir al final:

```sql
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
```

- [ ] **Step 3: Verificar que el SQL no tiene errores sintácticos**

Abrir `docs/supabase-schema.sql` y confirmar que la función `get_my_rol()` ya está definida en el archivo (debería estar de secciones anteriores). Si no existe, añadir antes de las políticas:

```sql
CREATE OR REPLACE FUNCTION get_my_rol()
RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT rol FROM profiles WHERE id = auth.uid()
$$;
```

- [ ] **Step 4: Commit**

```bash
git add src/app/core/models/solicitud.model.ts docs/supabase-schema.sql
git commit -m "feat: add SolicitudRegistro model and SQL schema"
```

---

## Task 2: SolicitudService

**Files:**
- Create: `src/app/features/registro/solicitud.service.ts`

- [ ] **Step 1: Crear el directorio**

```bash
mkdir -p src/app/features/registro
```

- [ ] **Step 2: Crear el servicio**

Crear `src/app/features/registro/solicitud.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import { from, Observable, map } from 'rxjs';
import { SolicitudRegistro, EstadoSolicitud } from '../../core/models/solicitud.model';
import { supabase } from '../../core/supabase/supabase.client';

function toSolicitud(row: Record<string, unknown>): SolicitudRegistro {
  return {
    id: row['id'] as string,
    nombre: row['nombre'] as string,
    apellidos: row['apellidos'] as string,
    email: row['email'] as string,
    mensaje: (row['mensaje'] as string) ?? undefined,
    estado: row['estado'] as EstadoSolicitud,
    fecha: new Date(row['fecha'] as string),
    revisadaPor: (row['revisada_por'] as string) ?? undefined,
    fechaRevision: row['fecha_revision'] ? new Date(row['fecha_revision'] as string) : undefined,
    motivoRechazo: (row['motivo_rechazo'] as string) ?? undefined,
  };
}

@Injectable({ providedIn: 'root' })
export class SolicitudService {
  /** Admin: obtiene todas las solicitudes */
  getAll(): Observable<SolicitudRegistro[]> {
    return from(
      supabase.from('solicitudes_registro').select('*').order('fecha', { ascending: false })
    ).pipe(map(({ data }) => (data ?? []).map(toSolicitud)));
  }

  /** Público: envía una nueva solicitud de registro */
  async create(data: { nombre: string; apellidos: string; email: string; mensaje?: string }): Promise<void> {
    const { error } = await supabase.from('solicitudes_registro').insert({
      nombre: data.nombre,
      apellidos: data.apellidos,
      email: data.email,
      mensaje: data.mensaje ?? null,
    });
    if (error) {
      if (error.code === '23505') {
        throw new Error('Ya existe una solicitud con este email.');
      }
      throw new Error('Error al enviar la solicitud. Inténtalo de nuevo.');
    }
  }

  /** Admin: acepta una solicitud llamando a la Edge Function */
  async aceptar(solicitudId: string, numeroSocio: string, rol: string): Promise<void> {
    const { error } = await supabase.functions.invoke('aceptar-solicitud', {
      body: { solicitudId, numeroSocio, rol },
    });
    if (error) throw new Error('Error al aceptar la solicitud.');
  }

  /** Admin: rechaza una solicitud llamando a la Edge Function */
  async rechazar(solicitudId: string, motivo?: string): Promise<void> {
    const { error } = await supabase.functions.invoke('rechazar-solicitud', {
      body: { solicitudId, motivo: motivo ?? null },
    });
    if (error) throw new Error('Error al rechazar la solicitud.');
  }
}
```

- [ ] **Step 3: Verificar que `supabase.client.ts` exporta `supabase`**

Abrir `src/app/core/supabase/supabase.client.ts` y confirmar que exporta `export const supabase`. Si no existe el archivo, crearlo:

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

export const supabase: SupabaseClient = createClient(
  environment.supabaseUrl,
  environment.supabaseAnonKey
);
```

- [ ] **Step 4: Commit**

```bash
git add src/app/features/registro/solicitud.service.ts
git commit -m "feat: add SolicitudService with Supabase queries and Edge Function calls"
```

---

## Task 3: Pantalla de Registro pública (`/registro`)

**Files:**
- Create: `src/app/features/registro/registro.component.ts`
- Create: `src/app/features/registro/registro.component.html`

- [ ] **Step 1: Crear el componente TypeScript**

Crear `src/app/features/registro/registro.component.ts`:

```typescript
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SolicitudService } from './solicitud.service';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './registro.component.html',
})
export class RegistroComponent {
  private fb = inject(FormBuilder);
  private solicitudService = inject(SolicitudService);
  private router = inject(Router);

  form = this.fb.group({
    nombre:    ['', [Validators.required, Validators.minLength(2)]],
    apellidos: ['', [Validators.required, Validators.minLength(2)]],
    email:     ['', [Validators.required, Validators.email]],
    mensaje:   [''],
  });

  error = signal('');
  loading = signal(false);

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');

    const { nombre, apellidos, email, mensaje } = this.form.value;

    try {
      await this.solicitudService.create({
        nombre: nombre!,
        apellidos: apellidos!,
        email: email!,
        mensaje: mensaje || undefined,
      });
      // Navegar a confirmación pasando el email como state
      this.router.navigate(['/registro/confirmacion'], {
        state: { email },
      });
    } catch (err: unknown) {
      this.error.set(err instanceof Error ? err.message : 'Error al enviar la solicitud.');
    } finally {
      this.loading.set(false);
    }
  }

  irAlLogin(): void {
    this.router.navigate(['/login']);
  }
}
```

- [ ] **Step 2: Crear la plantilla HTML**

Crear `src/app/features/registro/registro.component.html`:

```html
<div class="flex flex-col min-h-screen bg-brand-dark">
  <!-- Hero -->
  <div class="flex flex-col items-center gap-2 pt-10 pb-5 px-4">
    <div class="w-[72px] h-[72px] rounded-full bg-white border-[3px] border-gray-800 overflow-hidden">
      <img src="logo.png" alt="Logo" class="w-full h-full object-cover" />
    </div>
    <h1 class="text-white font-black text-[14px] tracking-wide">Campo de Tiro</h1>
    <p class="text-brand-yellow font-bold text-[8px] uppercase tracking-[2px]">San Isidro</p>
  </div>

  <!-- Card form -->
  <div class="flex-1 bg-white rounded-t-[22px] px-4 pt-5 pb-6 overflow-y-auto">
    <h2 class="text-brand-dark font-black text-[14px] mb-1">Solicitar acceso</h2>
    <p class="text-gray-400 text-[8.5px] font-medium mb-4">
      Rellena el formulario y la asociación revisará tu solicitud.
    </p>

    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <!-- Nombre -->
      <label class="block text-[8px] font-bold text-gray-300 uppercase tracking-wide mb-1">Nombre *</label>
      <div class="flex items-center gap-2 bg-surface rounded-[10px] px-3 py-2 mb-3">
        <i class="bi bi-person-fill text-gray-300 text-[13px]"></i>
        <input
          formControlName="nombre"
          type="text"
          autocomplete="given-name"
          placeholder="Tu nombre"
          class="flex-1 bg-transparent text-[10px] font-medium text-brand-dark outline-none placeholder-gray-300"
        />
      </div>

      <!-- Apellidos -->
      <label class="block text-[8px] font-bold text-gray-300 uppercase tracking-wide mb-1">Apellidos *</label>
      <div class="flex items-center gap-2 bg-surface rounded-[10px] px-3 py-2 mb-3">
        <i class="bi bi-person-fill text-gray-300 text-[13px]"></i>
        <input
          formControlName="apellidos"
          type="text"
          autocomplete="family-name"
          placeholder="Tus apellidos"
          class="flex-1 bg-transparent text-[10px] font-medium text-brand-dark outline-none placeholder-gray-300"
        />
      </div>

      <!-- Email -->
      <label class="block text-[8px] font-bold text-gray-300 uppercase tracking-wide mb-1">Email *</label>
      <div class="flex items-center gap-2 bg-surface rounded-[10px] px-3 py-2 mb-3">
        <i class="bi bi-envelope-fill text-gray-300 text-[13px]"></i>
        <input
          formControlName="email"
          type="email"
          autocomplete="email"
          placeholder="tu@email.com"
          class="flex-1 bg-transparent text-[10px] font-medium text-brand-dark outline-none placeholder-gray-300"
        />
      </div>

      <!-- Mensaje opcional -->
      <label class="block text-[8px] font-bold text-gray-300 uppercase tracking-wide mb-1">
        Mensaje <span class="text-gray-200 font-normal">(opcional)</span>
      </label>
      <div class="bg-surface rounded-[10px] px-3 py-2 mb-4">
        <textarea
          formControlName="mensaje"
          rows="3"
          placeholder="Preséntate brevemente o añade cualquier información relevante..."
          class="w-full bg-transparent text-[10px] font-medium text-brand-dark outline-none placeholder-gray-300 resize-none"
        ></textarea>
      </div>

      @if (error()) {
        <p class="text-danger text-[9px] font-semibold mb-3">{{ error() }}</p>
      }

      <button
        type="submit"
        [disabled]="form.invalid || loading()"
        class="w-full flex items-center justify-center gap-2 bg-brand-yellow text-brand-dark font-bold text-[11px] tracking-wide rounded-[12px] py-3 disabled:opacity-50"
      >
        <i class="bi bi-send-fill"></i>
        {{ loading() ? 'Enviando...' : 'Enviar solicitud' }}
      </button>
    </form>

    <button
      (click)="irAlLogin()"
      class="w-full text-center mt-4 text-[8.5px] text-gray-300 font-semibold"
    >
      ← Volver al login
    </button>
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/features/registro/registro.component.ts src/app/features/registro/registro.component.html
git commit -m "feat: add public registration form component"
```

---

## Task 4: Pantalla de Confirmación (`/registro/confirmacion`)

**Files:**
- Create: `src/app/features/registro/registro-confirmacion.component.ts`
- Create: `src/app/features/registro/registro-confirmacion.component.html`

- [ ] **Step 1: Crear el componente TypeScript**

Crear `src/app/features/registro/registro-confirmacion.component.ts`:

```typescript
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-registro-confirmacion',
  standalone: true,
  imports: [],
  templateUrl: './registro-confirmacion.component.html',
})
export class RegistroConfirmacionComponent {
  private router = inject(Router);

  // El email se pasa como state de navegación
  email: string = (this.router.getCurrentNavigation()?.extras?.state as { email?: string })?.email ?? '';

  irAlLogin(): void {
    this.router.navigate(['/login']);
  }
}
```

- [ ] **Step 2: Crear la plantilla HTML**

Crear `src/app/features/registro/registro-confirmacion.component.html`:

```html
<div class="flex flex-col min-h-screen bg-brand-dark">
  <!-- Hero -->
  <div class="flex flex-col items-center gap-2 pt-10 pb-5 px-4">
    <div class="w-[72px] h-[72px] rounded-full bg-white border-[3px] border-gray-800 overflow-hidden">
      <img src="logo.png" alt="Logo" class="w-full h-full object-cover" />
    </div>
    <h1 class="text-white font-black text-[14px] tracking-wide">Campo de Tiro</h1>
    <p class="text-brand-yellow font-bold text-[8px] uppercase tracking-[2px]">San Isidro</p>
  </div>

  <!-- Card -->
  <div class="flex-1 bg-white rounded-t-[22px] px-4 pt-8 pb-6 flex flex-col items-center text-center">
    <!-- Icono éxito -->
    <div class="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
      <i class="bi bi-check-circle-fill text-success text-[32px]"></i>
    </div>

    <h2 class="text-brand-dark font-black text-[16px] mb-2">¡Solicitud enviada!</h2>
    <p class="text-gray-400 text-[9.5px] font-medium leading-relaxed mb-4 max-w-[280px]">
      Tu solicitud está pendiente de revisión por la asociación. Te avisaremos por email cuando sea revisada.
    </p>

    @if (email) {
      <div class="bg-surface rounded-[10px] px-4 py-2 mb-6">
        <p class="text-[8px] text-gray-300 font-medium">Email registrado</p>
        <p class="text-[10px] font-bold text-brand-dark">{{ email }}</p>
      </div>
    }

    <button
      (click)="irAlLogin()"
      class="w-full flex items-center justify-center gap-2 bg-brand-yellow text-brand-dark font-bold text-[11px] tracking-wide rounded-[12px] py-3"
    >
      <i class="bi bi-box-arrow-in-right"></i>
      Volver al login
    </button>
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/features/registro/registro-confirmacion.component.ts src/app/features/registro/registro-confirmacion.component.html
git commit -m "feat: add registration confirmation screen"
```

---

## Task 5: Routing — rutas públicas de registro y enlace en login

**Files:**
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/features/auth/login/login.component.html`

- [ ] **Step 1: Añadir rutas públicas en app.routes.ts**

Abrir `src/app/app.routes.ts`. El archivo actual tiene esta estructura:

```typescript
import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  // ... resto de rutas
  { path: '**', redirectTo: '' },
];
```

Añadir las dos rutas de registro ANTES del `{ path: '**', redirectTo: '' }`:

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
    path: 'registro',
    loadComponent: () =>
      import('./features/registro/registro.component').then(m => m.RegistroComponent),
  },
  {
    path: 'registro/confirmacion',
    loadComponent: () =>
      import('./features/registro/registro-confirmacion.component').then(m => m.RegistroConfirmacionComponent),
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

- [ ] **Step 2: Añadir enlace en login.component.html**

Abrir `src/app/features/auth/login/login.component.html`. Al final del archivo, después del `<p>¿Olvidaste tu contraseña?</p>`, añadir el enlace de registro. El archivo actual termina con:

```html
    <p class="text-center mt-3 text-[8.5px] text-gray-300 font-semibold">¿Olvidaste tu contraseña?</p>
  </div>
</div>
```

Reemplazar esas últimas líneas con:

```html
    <p class="text-center mt-3 text-[8.5px] text-gray-300 font-semibold">¿Olvidaste tu contraseña?</p>

    <div class="flex items-center gap-2 mt-4">
      <div class="flex-1 h-px bg-gray-100"></div>
      <span class="text-[7.5px] text-gray-200 font-medium">o</span>
      <div class="flex-1 h-px bg-gray-100"></div>
    </div>

    <a
      routerLink="/registro"
      class="block w-full text-center mt-3 text-[8.5px] text-brand-dark font-bold"
    >
      ¿Quieres ser socio? <span class="text-brand-yellow">Solicita el acceso →</span>
    </a>
  </div>
</div>
```

- [ ] **Step 3: Añadir RouterLink al import del LoginComponent**

Abrir `src/app/features/auth/login/login.component.ts`. Añadir `RouterLink` a los imports:

```typescript
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
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

- [ ] **Step 4: Commit**

```bash
git add src/app/app.routes.ts src/app/features/auth/login/login.component.html src/app/features/auth/login/login.component.ts
git commit -m "feat: add public registro routes and login link to registration"
```

---

## Task 6: Panel Admin — Lista de Solicitudes

**Files:**
- Create: `src/app/features/admin/solicitudes/lista-solicitudes.component.ts`
- Create: `src/app/features/admin/solicitudes/lista-solicitudes.component.html`
- Modify: `src/app/features/admin/admin.routes.ts`

- [ ] **Step 1: Crear directorio**

```bash
mkdir -p src/app/features/admin/solicitudes
```

- [ ] **Step 2: Crear el componente TypeScript**

Crear `src/app/features/admin/solicitudes/lista-solicitudes.component.ts`:

```typescript
import { Component, inject, signal, computed } from '@angular/core';
import { Subject, switchMap, startWith } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SolicitudService } from '../../../features/registro/solicitud.service';
import { SolicitudRegistro } from '../../../core/models/solicitud.model';
import { AuthService } from '../../../core/auth/auth.service';

type Tab = 'pendientes' | 'aceptadas' | 'rechazadas';

@Component({
  selector: 'app-lista-solicitudes',
  standalone: true,
  imports: [DatePipe, FormsModule],
  templateUrl: './lista-solicitudes.component.html',
})
export class ListaSolicitudesComponent {
  private solicitudService = inject(SolicitudService);
  private auth = inject(AuthService);

  private refresh$ = new Subject<void>();

  private todas = toSignal(
    this.refresh$.pipe(startWith(null), switchMap(() => this.solicitudService.getAll())),
    { initialValue: [] as SolicitudRegistro[] }
  );

  tabActiva = signal<Tab>('pendientes');

  pendientes = computed(() => this.todas().filter(s => s.estado === 'pendiente'));
  aceptadas  = computed(() => this.todas().filter(s => s.estado === 'aceptada'));
  rechazadas = computed(() => this.todas().filter(s => s.estado === 'rechazada'));

  // Estado modales
  modalAceptar: SolicitudRegistro | null = null;
  modalRechazar: SolicitudRegistro | null = null;

  // Campos modales
  numeroSocio = '';
  rolSeleccionado = 'socio';
  motivoRechazo = '';

  // Estados de carga/error
  loadingAccion = false;
  errorAccion = '';

  setTab(tab: Tab): void {
    this.tabActiva.set(tab);
  }

  abrirModalAceptar(solicitud: SolicitudRegistro): void {
    this.modalAceptar = solicitud;
    this.numeroSocio = '';
    this.rolSeleccionado = 'socio';
    this.errorAccion = '';
  }

  abrirModalRechazar(solicitud: SolicitudRegistro): void {
    this.modalRechazar = solicitud;
    this.motivoRechazo = '';
    this.errorAccion = '';
  }

  cerrarModales(): void {
    this.modalAceptar = null;
    this.modalRechazar = null;
    this.errorAccion = '';
    this.loadingAccion = false;
  }

  async confirmarAceptar(): Promise<void> {
    if (!this.modalAceptar || !this.numeroSocio.trim()) return;
    this.loadingAccion = true;
    this.errorAccion = '';
    try {
      await this.solicitudService.aceptar(this.modalAceptar.id, this.numeroSocio.trim(), this.rolSeleccionado);
      this.cerrarModales();
      this.refresh$.next();
    } catch (err: unknown) {
      this.errorAccion = err instanceof Error ? err.message : 'Error al aceptar.';
    } finally {
      this.loadingAccion = false;
    }
  }

  async confirmarRechazar(): Promise<void> {
    if (!this.modalRechazar) return;
    this.loadingAccion = true;
    this.errorAccion = '';
    try {
      await this.solicitudService.rechazar(this.modalRechazar.id, this.motivoRechazo || undefined);
      this.cerrarModales();
      this.refresh$.next();
    } catch (err: unknown) {
      this.errorAccion = err instanceof Error ? err.message : 'Error al rechazar.';
    } finally {
      this.loadingAccion = false;
    }
  }
}
```

- [ ] **Step 3: Crear la plantilla HTML**

Crear `src/app/features/admin/solicitudes/lista-solicitudes.component.html`:

```html
<div class="p-3">
  <!-- Pestañas -->
  <div class="flex gap-1 mb-3 bg-surface rounded-[10px] p-1">
    <button
      (click)="setTab('pendientes')"
      [class]="tabActiva() === 'pendientes'
        ? 'flex-1 text-[8.5px] font-bold py-1.5 rounded-[8px] bg-white text-brand-dark shadow-sm'
        : 'flex-1 text-[8.5px] font-medium py-1.5 rounded-[8px] text-gray-400'"
    >
      Pendientes
      @if (pendientes().length > 0) {
        <span class="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-danger text-white text-[7px] font-bold">
          {{ pendientes().length }}
        </span>
      }
    </button>
    <button
      (click)="setTab('aceptadas')"
      [class]="tabActiva() === 'aceptadas'
        ? 'flex-1 text-[8.5px] font-bold py-1.5 rounded-[8px] bg-white text-brand-dark shadow-sm'
        : 'flex-1 text-[8.5px] font-medium py-1.5 rounded-[8px] text-gray-400'"
    >
      Aceptadas ({{ aceptadas().length }})
    </button>
    <button
      (click)="setTab('rechazadas')"
      [class]="tabActiva() === 'rechazadas'
        ? 'flex-1 text-[8.5px] font-bold py-1.5 rounded-[8px] bg-white text-brand-dark shadow-sm'
        : 'flex-1 text-[8.5px] font-medium py-1.5 rounded-[8px] text-gray-400'"
    >
      Rechazadas ({{ rechazadas().length }})
    </button>
  </div>

  <!-- Tab: Pendientes -->
  @if (tabActiva() === 'pendientes') {
    @for (s of pendientes(); track s.id) {
      <div class="bg-white rounded-[12px] px-3 py-2 mb-2 shadow-sm">
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <p class="text-[9.5px] font-bold text-brand-dark">{{ s.nombre }} {{ s.apellidos }}</p>
            <p class="text-[8px] text-gray-400 font-medium truncate">{{ s.email }}</p>
            <p class="text-[7.5px] text-gray-300 font-medium mt-0.5">{{ s.fecha | date:'d MMM yyyy, HH:mm' : '' : 'es' }}</p>
            @if (s.mensaje) {
              <p class="text-[8px] text-gray-500 font-medium mt-1 italic line-clamp-2">"{{ s.mensaje }}"</p>
            }
          </div>
          <div class="flex flex-col gap-1.5 shrink-0">
            <button
              (click)="abrirModalAceptar(s)"
              class="flex items-center gap-1 bg-success/10 text-success rounded-[8px] px-2 py-1 text-[8px] font-bold"
            >
              <i class="bi bi-check-lg"></i> Aceptar
            </button>
            <button
              (click)="abrirModalRechazar(s)"
              class="flex items-center gap-1 bg-danger/10 text-danger rounded-[8px] px-2 py-1 text-[8px] font-bold"
            >
              <i class="bi bi-x-lg"></i> Rechazar
            </button>
          </div>
        </div>
      </div>
    }
    @if (pendientes().length === 0) {
      <p class="text-center text-[9px] text-gray-400 mt-6">No hay solicitudes pendientes.</p>
    }
  }

  <!-- Tab: Aceptadas -->
  @if (tabActiva() === 'aceptadas') {
    @for (s of aceptadas(); track s.id) {
      <div class="bg-white rounded-[12px] px-3 py-2 mb-2 shadow-sm opacity-80">
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 rounded-full bg-success shrink-0"></div>
          <div class="flex-1 min-w-0">
            <p class="text-[9.5px] font-bold text-brand-dark">{{ s.nombre }} {{ s.apellidos }}</p>
            <p class="text-[8px] text-gray-400 font-medium truncate">{{ s.email }}</p>
            <p class="text-[7.5px] text-gray-300 font-medium">Aceptada {{ s.fechaRevision | date:'d MMM yyyy' : '' : 'es' }}</p>
          </div>
        </div>
      </div>
    }
    @if (aceptadas().length === 0) {
      <p class="text-center text-[9px] text-gray-400 mt-6">No hay solicitudes aceptadas.</p>
    }
  }

  <!-- Tab: Rechazadas -->
  @if (tabActiva() === 'rechazadas') {
    @for (s of rechazadas(); track s.id) {
      <div class="bg-white rounded-[12px] px-3 py-2 mb-2 shadow-sm opacity-80">
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 rounded-full bg-danger shrink-0"></div>
          <div class="flex-1 min-w-0">
            <p class="text-[9.5px] font-bold text-brand-dark">{{ s.nombre }} {{ s.apellidos }}</p>
            <p class="text-[8px] text-gray-400 font-medium truncate">{{ s.email }}</p>
            <p class="text-[7.5px] text-gray-300 font-medium">Rechazada {{ s.fechaRevision | date:'d MMM yyyy' : '' : 'es' }}</p>
            @if (s.motivoRechazo) {
              <p class="text-[8px] text-gray-500 font-medium mt-0.5 italic">Motivo: {{ s.motivoRechazo }}</p>
            }
          </div>
        </div>
      </div>
    }
    @if (rechazadas().length === 0) {
      <p class="text-center text-[9px] text-gray-400 mt-6">No hay solicitudes rechazadas.</p>
    }
  }
</div>

<!-- Modal Aceptar -->
@if (modalAceptar) {
  <div class="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4" (click)="cerrarModales()">
    <div class="bg-white rounded-[16px] p-4 w-full max-w-sm" (click)="$event.stopPropagation()">
      <h3 class="text-[12px] font-black text-brand-dark mb-1">Aceptar solicitud</h3>
      <p class="text-[8.5px] text-gray-400 font-medium mb-4">
        {{ modalAceptar.nombre }} {{ modalAceptar.apellidos }} — {{ modalAceptar.email }}
      </p>

      <label class="block text-[8px] font-bold text-gray-300 uppercase tracking-wide mb-1">Número de socio *</label>
      <div class="flex items-center gap-2 bg-surface rounded-[10px] px-3 py-2 mb-3">
        <i class="bi bi-hash text-gray-300 text-[13px]"></i>
        <input
          [(ngModel)]="numeroSocio"
          type="text"
          placeholder="0042"
          class="flex-1 bg-transparent text-[10px] font-medium text-brand-dark outline-none placeholder-gray-300"
        />
      </div>

      <label class="block text-[8px] font-bold text-gray-300 uppercase tracking-wide mb-1">Rol</label>
      <select
        [(ngModel)]="rolSeleccionado"
        class="w-full bg-surface rounded-[10px] px-3 py-2 mb-4 text-[10px] font-medium text-brand-dark outline-none"
      >
        <option value="socio">Socio</option>
        <option value="moderador">Moderador</option>
        <option value="admin">Admin</option>
      </select>

      @if (errorAccion) {
        <p class="text-danger text-[9px] font-semibold mb-3">{{ errorAccion }}</p>
      }

      <div class="flex gap-2">
        <button
          (click)="cerrarModales()"
          class="flex-1 py-2.5 rounded-[12px] border border-gray-200 text-[9px] font-bold text-gray-400"
        >
          Cancelar
        </button>
        <button
          (click)="confirmarAceptar()"
          [disabled]="!numeroSocio.trim() || loadingAccion"
          class="flex-1 py-2.5 rounded-[12px] bg-success text-white text-[9px] font-bold disabled:opacity-50"
        >
          {{ loadingAccion ? 'Procesando...' : 'Confirmar' }}
        </button>
      </div>
    </div>
  </div>
}

<!-- Modal Rechazar -->
@if (modalRechazar) {
  <div class="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4" (click)="cerrarModales()">
    <div class="bg-white rounded-[16px] p-4 w-full max-w-sm" (click)="$event.stopPropagation()">
      <h3 class="text-[12px] font-black text-brand-dark mb-1">Rechazar solicitud</h3>
      <p class="text-[8.5px] text-gray-400 font-medium mb-4">
        {{ modalRechazar.nombre }} {{ modalRechazar.apellidos }} — {{ modalRechazar.email }}
      </p>

      <label class="block text-[8px] font-bold text-gray-300 uppercase tracking-wide mb-1">
        Motivo <span class="text-gray-200 font-normal">(opcional)</span>
      </label>
      <div class="bg-surface rounded-[10px] px-3 py-2 mb-4">
        <textarea
          [(ngModel)]="motivoRechazo"
          rows="3"
          placeholder="Indica el motivo del rechazo..."
          class="w-full bg-transparent text-[10px] font-medium text-brand-dark outline-none placeholder-gray-300 resize-none"
        ></textarea>
      </div>

      @if (errorAccion) {
        <p class="text-danger text-[9px] font-semibold mb-3">{{ errorAccion }}</p>
      }

      <div class="flex gap-2">
        <button
          (click)="cerrarModales()"
          class="flex-1 py-2.5 rounded-[12px] border border-gray-200 text-[9px] font-bold text-gray-400"
        >
          Cancelar
        </button>
        <button
          (click)="confirmarRechazar()"
          [disabled]="loadingAccion"
          class="flex-1 py-2.5 rounded-[12px] bg-danger text-white text-[9px] font-bold disabled:opacity-50"
        >
          {{ loadingAccion ? 'Procesando...' : 'Rechazar' }}
        </button>
      </div>
    </div>
  </div>
}
```

- [ ] **Step 4: Añadir ruta en admin.routes.ts**

Abrir `src/app/features/admin/admin.routes.ts`. Añadir la ruta de solicitudes al principio del array (antes de socios):

```typescript
import { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/role.guard';

export const adminRoutes: Routes = [
  // Solicitudes de registro
  {
    path: 'solicitudes',
    canActivate: [roleGuard],
    data: { roles: ['admin'] },
    loadComponent: () =>
      import('./solicitudes/lista-solicitudes.component').then(m => m.ListaSolicitudesComponent),
  },
  // Socios
  {
    path: 'socios',
    canActivate: [roleGuard],
    data: { roles: ['admin'] },
    loadComponent: () =>
      import('./socios/lista-socios/lista-socios.component').then(m => m.ListaSociosComponent),
  },
  {
    path: 'socios/nuevo',
    canActivate: [roleGuard],
    data: { roles: ['admin'] },
    loadComponent: () =>
      import('./socios/form-socio/form-socio.component').then(m => m.FormSocioComponent),
  },
  {
    path: 'socios/:id',
    canActivate: [roleGuard],
    data: { roles: ['admin'] },
    loadComponent: () =>
      import('./socios/form-socio/form-socio.component').then(m => m.FormSocioComponent),
  },
  // Noticias
  {
    path: 'noticias',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./noticias/lista-noticias-admin/lista-noticias-admin.component').then(m => m.ListaNoticiasAdminComponent),
  },
  {
    path: 'noticias/nueva',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./noticias/form-noticia/form-noticia.component').then(m => m.FormNoticiaComponent),
  },
  {
    path: 'noticias/:id/editar',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./noticias/form-noticia/form-noticia.component').then(m => m.FormNoticiaComponent),
  },
  // Scores
  {
    path: 'scores/nuevo',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./scores/form-score/form-score.component').then(m => m.FormScoreComponent),
  },
  // Competiciones
  {
    path: 'competiciones/nueva',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./competiciones/form-competicion/form-competicion.component').then(m => m.FormCompeticionComponent),
  },
];
```

- [ ] **Step 5: Commit**

```bash
git add src/app/features/admin/solicitudes/ src/app/features/admin/admin.routes.ts
git commit -m "feat: add admin solicitudes panel with tabs and modals"
```

---

## Task 7: Edge Function — aceptar-solicitud

**Files:**
- Create: `supabase/functions/aceptar-solicitud/index.ts`

- [ ] **Step 1: Crear directorio**

```bash
mkdir -p supabase/functions/aceptar-solicitud
```

- [ ] **Step 2: Crear la Edge Function**

Crear `supabase/functions/aceptar-solicitud/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { solicitudId, numeroSocio, rol } = await req.json()

    if (!solicitudId || !numeroSocio || !rol) {
      return new Response(
        JSON.stringify({ error: 'Faltan campos obligatorios: solicitudId, numeroSocio, rol' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Obtener el ID del admin que hace la petición (desde el JWT de la request)
    const authHeader = req.headers.get('Authorization')
    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader ?? '' } } }
    )
    const { data: { user: adminUser } } = await supabaseAnon.auth.getUser()
    const adminUserId = adminUser?.id ?? null

    // Cliente con service_role para operaciones privilegiadas
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Leer la solicitud
    const { data: solicitud, error: readError } = await supabaseAdmin
      .from('solicitudes_registro')
      .select('*')
      .eq('id', solicitudId)
      .single()

    if (readError || !solicitud) {
      return new Response(
        JSON.stringify({ error: 'Solicitud no encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Crear usuario en Auth con contraseña aleatoria (el magic link permite establecerla)
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: solicitud.email,
      email_confirm: true,
      user_metadata: {
        nombre: solicitud.nombre,
        apellidos: solicitud.apellidos,
        numero_socio: numeroSocio,
      },
    })

    if (createError || !authData.user) {
      return new Response(
        JSON.stringify({ error: `Error creando usuario: ${createError?.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const newUserId = authData.user.id

    // 3. Actualizar el profile creado por el trigger
    await supabaseAdmin.from('profiles').update({
      nombre: solicitud.nombre,
      apellidos: solicitud.apellidos,
      numero_socio: numeroSocio,
      rol: rol,
      activo: true,
    }).eq('id', newUserId)

    // 4. Marcar solicitud como aceptada
    await supabaseAdmin.from('solicitudes_registro').update({
      estado: 'aceptada',
      revisada_por: adminUserId,
      fecha_revision: new Date().toISOString(),
    }).eq('id', solicitudId)

    // 5. Generar magic link para que el usuario establezca su contraseña
    await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: solicitud.email,
    })

    // 6. Enviar email de bienvenida con Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (resendApiKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'noreply@campotirosanisidro.es',
          to: solicitud.email,
          subject: '¡Bienvenido/a a Campo de Tiro San Isidro!',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1A1A1A;">¡Bienvenido/a, ${solicitud.nombre}!</h2>
              <p>Tu solicitud de acceso a <strong>Campo de Tiro San Isidro</strong> ha sido <strong>aprobada</strong>.</p>
              <p>Tu número de socio es: <strong>#${numeroSocio}</strong></p>
              <p>En breve recibirás otro email para establecer tu contraseña y acceder a la aplicación.</p>
              <p style="color: #666; font-size: 12px;">Campo de Tiro San Isidro</p>
            </div>
          `,
        }),
      })
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

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/aceptar-solicitud/index.ts
git commit -m "feat: add aceptar-solicitud Edge Function"
```

---

## Task 8: Edge Function — rechazar-solicitud

**Files:**
- Create: `supabase/functions/rechazar-solicitud/index.ts`

- [ ] **Step 1: Crear directorio**

```bash
mkdir -p supabase/functions/rechazar-solicitud
```

- [ ] **Step 2: Crear la Edge Function**

Crear `supabase/functions/rechazar-solicitud/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { solicitudId, motivo } = await req.json()

    if (!solicitudId) {
      return new Response(
        JSON.stringify({ error: 'Falta el campo obligatorio: solicitudId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Obtener ID del admin desde el JWT
    const authHeader = req.headers.get('Authorization')
    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader ?? '' } } }
    )
    const { data: { user: adminUser } } = await supabaseAnon.auth.getUser()
    const adminUserId = adminUser?.id ?? null

    // Cliente privilegiado
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Leer la solicitud
    const { data: solicitud, error: readError } = await supabaseAdmin
      .from('solicitudes_registro')
      .select('*')
      .eq('id', solicitudId)
      .single()

    if (readError || !solicitud) {
      return new Response(
        JSON.stringify({ error: 'Solicitud no encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Marcar solicitud como rechazada
    await supabaseAdmin.from('solicitudes_registro').update({
      estado: 'rechazada',
      motivo_rechazo: motivo ?? null,
      revisada_por: adminUserId,
      fecha_revision: new Date().toISOString(),
    }).eq('id', solicitudId)

    // 3. Enviar email de rechazo con Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (resendApiKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'noreply@campotirosanisidro.es',
          to: solicitud.email,
          subject: 'Solicitud de acceso — Campo de Tiro San Isidro',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1A1A1A;">Hola, ${solicitud.nombre}</h2>
              <p>Tras revisar tu solicitud de acceso a <strong>Campo de Tiro San Isidro</strong>, lamentablemente no podemos aprobarla en este momento.</p>
              ${motivo ? `<p><strong>Motivo:</strong> ${motivo}</p>` : ''}
              <p>Si tienes alguna pregunta, puedes ponerte en contacto con la asociación.</p>
              <p style="color: #666; font-size: 12px;">Campo de Tiro San Isidro</p>
            </div>
          `,
        }),
      })
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

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/rechazar-solicitud/index.ts
git commit -m "feat: add rechazar-solicitud Edge Function"
```

---

## Task 9: Verificación manual y smoke test

**Files:** ninguno (verificación)

Este task no puede automatizarse porque requiere un proyecto Supabase activo. Es la lista de comprobaciones manuales una vez el backend esté configurado.

- [ ] **Step 1: Ejecutar el SQL en Supabase Dashboard**

En Supabase Dashboard → SQL Editor, ejecutar el bloque SQL de `docs/supabase-schema.sql` correspondiente a `solicitudes_registro` (tabla + RLS policies).

- [ ] **Step 2: Verificar que la app arranca sin errores**

```bash
npm start
```

Abrir `http://localhost:4200`. La app debe cargar sin errores en consola.

- [ ] **Step 3: Flujo de registro**

1. Ir a `http://localhost:4200/registro`
2. Rellenar nombre, apellidos, email válido (no existente en la tabla), mensaje opcional
3. Hacer clic en "Enviar solicitud"
4. Verificar redirección a `/registro/confirmacion` con el email mostrado
5. En Supabase Dashboard → Table Editor → `solicitudes_registro`, confirmar que la fila existe con `estado='pendiente'`

- [ ] **Step 4: Verificar link en login**

1. Ir a `http://localhost:4200/login`
2. Confirmar que aparece el enlace "¿Quieres ser socio? Solicita el acceso →"
3. Hacer clic y verificar navegación a `/registro`

- [ ] **Step 5: Flujo admin — ver solicitudes**

1. Entrar como admin
2. Navegar a `/admin/solicitudes`
3. Verificar las tres pestañas: Pendientes (con badge), Aceptadas, Rechazadas
4. Confirmar que la solicitud creada en Step 3 aparece en Pendientes con nombre, email, fecha y mensaje

- [ ] **Step 6: Commit de cualquier fix menor encontrado**

```bash
git add -p
git commit -m "fix: smoke test corrections"
```
