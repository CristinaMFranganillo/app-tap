# Módulo Entrenamientos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el módulo de entrenamientos separado de competiciones, con escuadras y resultados propios, dando mayor peso visual a los entrenamientos en el panel admin.

**Architecture:** Se añade una nueva rama de features bajo `admin/entrenamientos/` con su propio servicio, modelos y componentes. El panel `admin-scores` se reorganiza para mostrar entrenamientos arriba (prominente) y competiciones abajo (secundario). El modelo `Escuadra` se extiende con `entrenamientoId` opcional.

**Tech Stack:** Angular 17+ standalone components · Supabase · Tailwind CSS · SCSS BEM

---

## File Map

### Crear
- `src/app/core/models/entrenamiento.model.ts` — interfaces Entrenamiento, ResultadoEntrenamiento
- `src/app/features/admin/entrenamientos/entrenamiento.service.ts` — CRUD entrenamientos + resultados_entrenamiento
- `src/app/features/admin/entrenamientos/lista-entrenamientos/lista-entrenamientos.component.ts/html/scss` — lista para embedir en admin-scores
- `src/app/features/admin/entrenamientos/form-entrenamiento/form-entrenamiento.component.ts/html/scss` — crear entrenamiento (solo fecha)
- `src/app/features/admin/entrenamientos/detalle-entrenamiento/detalle-entrenamiento.component.ts/html/scss` — detalle con lista de escuadras
- `src/app/features/admin/entrenamientos/form-escuadra-entrenamiento/form-escuadra-entrenamiento.component.ts/html/scss` — 6 puestos sin competición
- `src/app/features/admin/entrenamientos/registrar-resultado-entrenamiento/registrar-resultado-entrenamiento.component.ts/html/scss` — input numérico por tirador

### Modificar
- `src/app/core/models/escuadra.model.ts` — añadir `entrenamientoId?: string`
- `src/app/features/scores/escuadra.service.ts` — añadir `getByEntrenamiento`, `createEscuadraEntrenamiento`
- `src/app/features/admin/admin.routes.ts` — rutas `/admin/entrenamientos/...`
- `src/app/features/admin/scores/admin-scores/admin-scores.component.ts/html/scss` — reorganizar con sección entrenamientos arriba
- `src/app/shared/components/bottom-nav/bottom-nav.component.ts` — "Torneos" → "Entrena" con `bi-bullseye`

---

## Task 1: Modelo de datos

**Files:**
- Create: `src/app/core/models/entrenamiento.model.ts`
- Modify: `src/app/core/models/escuadra.model.ts`

- [ ] **Step 1: Crear entrenamiento.model.ts**

```typescript
// src/app/core/models/entrenamiento.model.ts
export interface Entrenamiento {
  id: string;
  fecha: string;        // 'YYYY-MM-DD'
  creadoPor: string;
  createdAt?: string;
  numEscuadras?: number;
}

export interface ResultadoEntrenamiento {
  id: string;
  escuadraId: string;
  userId: string;
  puesto: number;
  platosRotos: number;
}
```

- [ ] **Step 2: Extender Escuadra con entrenamientoId**

Reemplazar el contenido de `src/app/core/models/escuadra.model.ts`:

```typescript
export interface Escuadra {
  id: string;
  competicionId?: string;
  entrenamientoId?: string;
  numero: number;
  tiradores?: EscuadraTirador[];
}

export interface EscuadraTirador {
  id: string;
  escuadraId: string;
  userId: string;
  puesto: number;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/core/models/
git commit -m "feat: add Entrenamiento model and extend Escuadra with entrenamientoId"
```

---

## Task 2: EntrenamientoService

**Files:**
- Create: `src/app/features/admin/entrenamientos/entrenamiento.service.ts`

- [ ] **Step 1: Crear el servicio**

```typescript
// src/app/features/admin/entrenamientos/entrenamiento.service.ts
import { Injectable } from '@angular/core';
import { from, Observable, map } from 'rxjs';
import { Entrenamiento, ResultadoEntrenamiento } from '../../../core/models/entrenamiento.model';
import { supabase } from '../../../core/supabase/supabase.client';

function toEntrenamiento(row: Record<string, unknown>): Entrenamiento {
  return {
    id: row['id'] as string,
    fecha: row['fecha'] as string,
    creadoPor: row['creado_por'] as string,
    createdAt: row['created_at'] as string,
    numEscuadras: row['num_escuadras'] as number ?? 0,
  };
}

function toResultado(row: Record<string, unknown>): ResultadoEntrenamiento {
  return {
    id: row['id'] as string,
    escuadraId: row['escuadra_id'] as string,
    userId: row['user_id'] as string,
    puesto: row['puesto'] as number,
    platosRotos: row['platos_rotos'] as number,
  };
}

@Injectable({ providedIn: 'root' })
export class EntrenamientoService {

  getAll(): Observable<Entrenamiento[]> {
    return from(
      supabase
        .from('entrenamientos')
        .select('*, escuadras(count)')
        .order('fecha', { ascending: false })
    ).pipe(
      map(({ data }) =>
        (data ?? []).map(row => ({
          ...toEntrenamiento(row as Record<string, unknown>),
          numEscuadras: (row as any).escuadras?.[0]?.count ?? 0,
        }))
      )
    );
  }

  getById(id: string): Observable<Entrenamiento> {
    return from(
      supabase.from('entrenamientos').select('*').eq('id', id).single()
    ).pipe(map(({ data }) => toEntrenamiento(data as Record<string, unknown>)));
  }

  async create(fecha: string, creadoPor: string): Promise<string> {
    const { data, error } = await supabase
      .from('entrenamientos')
      .insert({ fecha, creado_por: creadoPor })
      .select('id')
      .single();
    if (error || !data) throw new Error(error?.message ?? 'Error creando entrenamiento');
    return (data as Record<string, unknown>)['id'] as string;
  }

  getResultadosByEscuadra(escuadraId: string): Observable<ResultadoEntrenamiento[]> {
    return from(
      supabase
        .from('resultados_entrenamiento')
        .select('*')
        .eq('escuadra_id', escuadraId)
        .order('puesto')
    ).pipe(map(({ data }) => (data ?? []).map(toResultado)));
  }

  async upsertResultados(
    resultados: { escuadraId: string; userId: string; puesto: number; platosRotos: number }[],
    registradoPor: string
  ): Promise<void> {
    const rows = resultados.map(r => ({
      escuadra_id: r.escuadraId,
      user_id: r.userId,
      puesto: r.puesto,
      platos_rotos: r.platosRotos,
      registrado_por: registradoPor,
    }));
    const { error } = await supabase
      .from('resultados_entrenamiento')
      .upsert(rows, { onConflict: 'escuadra_id,user_id' });
    if (error) throw new Error('Error guardando resultados');
  }
}
```

- [ ] **Step 2: Extender EscuadraService con métodos para entrenamientos**

Añadir al final de `src/app/features/scores/escuadra.service.ts` antes del cierre de clase:

```typescript
  getByEntrenamiento(entrenamientoId: string): Observable<Escuadra[]> {
    return from(
      supabase
        .from('escuadras')
        .select('*, escuadra_tiradores(*)')
        .eq('entrenamiento_id', entrenamientoId)
        .order('numero')
    ).pipe(
      map(({ data }) =>
        (data ?? []).map(row => ({
          id: (row as any)['id'] as string,
          entrenamientoId: (row as any)['entrenamiento_id'] as string,
          numero: (row as any)['numero'] as number,
          tiradores: ((row as any)['escuadra_tiradores'] ?? []).map((t: Record<string, unknown>) => ({
            id: t['id'] as string,
            escuadraId: t['escuadra_id'] as string,
            userId: t['user_id'] as string,
            puesto: t['puesto'] as number,
          })),
        }))
      )
    );
  }

  async createEscuadraEntrenamiento(entrenamientoId: string, numero: number): Promise<string> {
    const { data, error } = await supabase
      .from('escuadras')
      .insert({ entrenamiento_id: entrenamientoId, numero })
      .select('id')
      .single();
    if (error || !data) throw new Error('Error creando escuadra');
    return (data as Record<string, unknown>)['id'] as string;
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/app/features/admin/entrenamientos/entrenamiento.service.ts
git add src/app/features/scores/escuadra.service.ts
git commit -m "feat: add EntrenamientoService and escuadra methods for entrenamientos"
```

---

## Task 3: Rutas admin para entrenamientos

**Files:**
- Modify: `src/app/features/admin/admin.routes.ts`

- [ ] **Step 1: Añadir rutas de entrenamientos**

Añadir al array `adminRoutes` en `admin.routes.ts` antes del cierre `]`:

```typescript
  // Entrenamientos
  {
    path: 'entrenamientos/nuevo',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./entrenamientos/form-entrenamiento/form-entrenamiento.component')
        .then(m => m.FormEntrenamientoComponent),
  },
  {
    path: 'entrenamientos/:id',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./entrenamientos/detalle-entrenamiento/detalle-entrenamiento.component')
        .then(m => m.DetalleEntrenamientoComponent),
  },
  {
    path: 'entrenamientos/:id/escuadra/nueva',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./entrenamientos/form-escuadra-entrenamiento/form-escuadra-entrenamiento.component')
        .then(m => m.FormEscuadraEntrenamientoComponent),
  },
  {
    path: 'entrenamientos/:entrenamientoId/escuadra/:escuadraId/resultados',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./entrenamientos/registrar-resultado-entrenamiento/registrar-resultado-entrenamiento.component')
        .then(m => m.RegistrarResultadoEntrenamientoComponent),
  },
```

- [ ] **Step 2: Commit**

```bash
git add src/app/features/admin/admin.routes.ts
git commit -m "feat: add admin routes for entrenamientos module"
```

---

## Task 4: FormEntrenamientoComponent

**Files:**
- Create: `src/app/features/admin/entrenamientos/form-entrenamiento/form-entrenamiento.component.ts`
- Create: `src/app/features/admin/entrenamientos/form-entrenamiento/form-entrenamiento.component.html`
- Create: `src/app/features/admin/entrenamientos/form-entrenamiento/form-entrenamiento.component.scss`

- [ ] **Step 1: Crear el componente TS**

```typescript
// src/app/features/admin/entrenamientos/form-entrenamiento/form-entrenamiento.component.ts
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EntrenamientoService } from '../entrenamiento.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-form-entrenamiento',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './form-entrenamiento.component.html',
  styleUrl: './form-entrenamiento.component.scss',
})
export class FormEntrenamientoComponent {
  private entrenamientoService = inject(EntrenamientoService);
  private authService = inject(AuthService);
  private router = inject(Router);

  fecha: string = new Date().toISOString().split('T')[0];
  loading = false;
  error = '';

  async onSubmit(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      const user = await firstValueFrom(this.authService.currentUser$);
      if (!user) throw new Error('No autenticado');
      const id = await this.entrenamientoService.create(this.fecha, user.id);
      this.router.navigate(['/admin/entrenamientos', id]);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Error al crear entrenamiento';
    } finally {
      this.loading = false;
    }
  }

  cancel(): void {
    this.router.navigate(['/admin/scores']);
  }
}
```

- [ ] **Step 2: Crear el HTML**

```html
<!-- src/app/features/admin/entrenamientos/form-entrenamiento/form-entrenamiento.component.html -->
<div class="form-entrenamiento">
  <div class="page-header">
    <button (click)="cancel()" class="form-entrenamiento__back-btn">
      <i class="bi bi-chevron-left form-entrenamiento__back-icon"></i>
    </button>
    <h2 class="form-entrenamiento__title">Nuevo entrenamiento</h2>
  </div>

  <div class="form-entrenamiento__card">
    <label class="form-label">Fecha</label>
    <input
      type="date"
      [(ngModel)]="fecha"
      class="form-input form-entrenamiento__date"
    />

    @if (error) {
      <p class="form-entrenamiento__error">{{ error }}</p>
    }

    <div class="form-entrenamiento__actions">
      <button type="button" (click)="cancel()" class="btn-secondary">Cancelar</button>
      <button (click)="onSubmit()" [disabled]="loading" class="btn-primary">
        {{ loading ? 'Creando...' : 'Crear entrenamiento' }}
      </button>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Crear el SCSS**

```scss
// src/app/features/admin/entrenamientos/form-entrenamiento/form-entrenamiento.component.scss
.form-entrenamiento {
  @apply p-3;

  &__back-btn { @apply text-gray-400; }
  &__back-icon { @apply text-[15px]; }
  &__title { @apply text-[18px] font-extrabold text-secondary; }

  &__card {
    @apply bg-white rounded-card p-4 shadow-card flex flex-col gap-3;
  }

  &__date { @apply mt-1; }

  &__error { @apply text-[13px] text-danger font-semibold; }

  &__actions { @apply flex gap-2 pt-1; }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/features/admin/entrenamientos/form-entrenamiento/
git commit -m "feat: add FormEntrenamientoComponent"
```

---

## Task 5: DetalleEntrenamientoComponent

**Files:**
- Create: `src/app/features/admin/entrenamientos/detalle-entrenamiento/detalle-entrenamiento.component.ts`
- Create: `src/app/features/admin/entrenamientos/detalle-entrenamiento/detalle-entrenamiento.component.html`
- Create: `src/app/features/admin/entrenamientos/detalle-entrenamiento/detalle-entrenamiento.component.scss`

- [ ] **Step 1: Crear el componente TS**

```typescript
// src/app/features/admin/entrenamientos/detalle-entrenamiento/detalle-entrenamiento.component.ts
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { EntrenamientoService } from '../entrenamiento.service';
import { EscuadraService } from '../../../../features/scores/escuadra.service';
import { Entrenamiento } from '../../../../core/models/entrenamiento.model';
import { Escuadra } from '../../../../core/models/escuadra.model';
import { DatePipe } from '@angular/common';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-detalle-entrenamiento',
  standalone: true,
  imports: [DatePipe, EmptyStateComponent],
  templateUrl: './detalle-entrenamiento.component.html',
  styleUrl: './detalle-entrenamiento.component.scss',
})
export class DetalleEntrenamientoComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private entrenamientoService = inject(EntrenamientoService);
  private escuadraService = inject(EscuadraService);

  private id$ = this.route.paramMap.pipe(map(p => p.get('id')!));

  entrenamiento = toSignal(
    this.id$.pipe(switchMap(id => this.entrenamientoService.getById(id))),
    { initialValue: null as Entrenamiento | null }
  );

  escuadras = toSignal(
    this.id$.pipe(switchMap(id => this.escuadraService.getByEntrenamiento(id))),
    { initialValue: [] as Escuadra[] }
  );

  nuevaEscuadra(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.router.navigate(['/admin/entrenamientos', id, 'escuadra', 'nueva']);
  }

  irResultados(escuadraId: string): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.router.navigate(['/admin/entrenamientos', id, 'escuadra', escuadraId, 'resultados']);
  }

  goBack(): void {
    this.router.navigate(['/admin/scores']);
  }
}
```

> **Nota:** Añadir `import { map } from 'rxjs';` al principio del archivo.

- [ ] **Step 2: Crear el HTML**

```html
<!-- src/app/features/admin/entrenamientos/detalle-entrenamiento/detalle-entrenamiento.component.html -->
<div class="detalle-entrenamiento">
  <div class="page-header">
    <button (click)="goBack()" class="detalle-entrenamiento__back-btn">
      <i class="bi bi-chevron-left detalle-entrenamiento__back-icon"></i>
    </button>
    <h2 class="detalle-entrenamiento__title">
      Entrenamiento {{ entrenamiento()?.fecha | date:'d MMM yyyy' : '' : 'es' }}
    </h2>
  </div>

  @if (escuadras().length === 0) {
    <app-empty-state icon="bi-people" mensaje="Sin escuadras todavía" />
  } @else {
    @for (e of escuadras(); track e.id) {
      <div class="card escuadra-item" (click)="irResultados(e.id)">
        <div class="escuadra-item__info">
          <p class="escuadra-item__nombre">Escuadra {{ e.numero }}</p>
          <p class="escuadra-item__tiradores">{{ e.tiradores?.length ?? 0 }} tiradores</p>
        </div>
        <i class="bi bi-chevron-right escuadra-item__arrow"></i>
      </div>
    }
  }

  <button (click)="nuevaEscuadra()" class="fab">
    <i class="bi bi-plus-lg"></i>
  </button>
</div>
```

- [ ] **Step 3: Crear el SCSS**

```scss
// src/app/features/admin/entrenamientos/detalle-entrenamiento/detalle-entrenamiento.component.scss
.detalle-entrenamiento {
  @apply p-3;

  &__back-btn { @apply text-gray-400; }
  &__back-icon { @apply text-[15px]; }
  &__title { @apply text-[18px] font-extrabold text-secondary; }
}

.escuadra-item {
  @apply flex items-center justify-between cursor-pointer;

  &__info { @apply flex-1 min-w-0; }
  &__nombre { @apply text-base font-bold text-secondary; }
  &__tiradores { @apply text-xs text-neutral-300 font-medium; }
  &__arrow { @apply text-neutral-300 text-[14px]; }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/features/admin/entrenamientos/detalle-entrenamiento/
git commit -m "feat: add DetalleEntrenamientoComponent"
```

---

## Task 6: FormEscuadraEntrenamientoComponent

**Files:**
- Create: `src/app/features/admin/entrenamientos/form-escuadra-entrenamiento/form-escuadra-entrenamiento.component.ts`
- Create: `src/app/features/admin/entrenamientos/form-escuadra-entrenamiento/form-escuadra-entrenamiento.component.html`
- Create: `src/app/features/admin/entrenamientos/form-escuadra-entrenamiento/form-escuadra-entrenamiento.component.scss`

- [ ] **Step 1: Crear el componente TS**

```typescript
// src/app/features/admin/entrenamientos/form-escuadra-entrenamiento/form-escuadra-entrenamiento.component.ts
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { EscuadraService } from '../../../../features/scores/escuadra.service';
import { UserService } from '../../socios/user.service';
import { User } from '../../../../core/models/user.model';

@Component({
  selector: 'app-form-escuadra-entrenamiento',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './form-escuadra-entrenamiento.component.html',
  styleUrl: './form-escuadra-entrenamiento.component.scss',
})
export class FormEscuadraEntrenamientoComponent {
  private escuadraService = inject(EscuadraService);
  private userService = inject(UserService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  socios = toSignal(this.userService.getAll(), { initialValue: [] as User[] });
  puestos: (string | null)[] = [null, null, null, null, null, null];
  loading = false;
  error = '';

  async onSubmit(): Promise<void> {
    const asignados = this.puestos.filter(p => p !== null);
    if (asignados.length === 0) { this.error = 'Asigna al menos un tirador'; return; }
    this.loading = true;
    this.error = '';
    try {
      const entrenamientoId = this.route.snapshot.paramMap.get('id')!;
      const escuadras = await firstValueFrom(this.escuadraService.getByEntrenamiento(entrenamientoId));
      const numero = escuadras.length + 1;
      const escuadraId = await this.escuadraService.createEscuadraEntrenamiento(entrenamientoId, numero);
      for (let i = 0; i < this.puestos.length; i++) {
        const userId = this.puestos[i];
        if (userId) await this.escuadraService.addTirador(escuadraId, userId, i + 1);
      }
      this.router.navigate(['/admin/entrenamientos', entrenamientoId]);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Error al guardar';
    } finally {
      this.loading = false;
    }
  }

  cancel(): void {
    const entrenamientoId = this.route.snapshot.paramMap.get('id')!;
    this.router.navigate(['/admin/entrenamientos', entrenamientoId]);
  }
}
```

- [ ] **Step 2: Crear el HTML**

```html
<!-- form-escuadra-entrenamiento.component.html -->
<div class="form-escuadra-e">
  <div class="page-header">
    <button (click)="cancel()" class="form-escuadra-e__back-btn">
      <i class="bi bi-chevron-left form-escuadra-e__back-icon"></i>
    </button>
    <h2 class="form-escuadra-e__title">Nueva escuadra</h2>
  </div>

  <p class="form-escuadra-e__section-label">Tiradores por puesto</p>

  @for (puesto of puestos; track $index) {
    <div class="form-escuadra-e__puesto">
      <label class="form-label">Puesto {{ $index + 1 }}</label>
      <select [(ngModel)]="puestos[$index]" class="form-input">
        <option [value]="null">— Sin asignar —</option>
        @for (s of socios(); track s.id) {
          <option [value]="s.id">{{ s.nombre }} {{ s.apellidos }}</option>
        }
      </select>
    </div>
  }

  @if (error) {
    <p class="form-escuadra-e__error">{{ error }}</p>
  }

  <div class="form-escuadra-e__actions">
    <button (click)="cancel()" class="btn-secondary">Cancelar</button>
    <button (click)="onSubmit()" [disabled]="loading" class="btn-primary">
      {{ loading ? 'Guardando...' : 'Crear escuadra' }}
    </button>
  </div>
</div>
```

- [ ] **Step 3: Crear el SCSS**

```scss
// form-escuadra-entrenamiento.component.scss
.form-escuadra-e {
  @apply p-3;

  &__back-btn { @apply text-gray-400; }
  &__back-icon { @apply text-[15px]; }
  &__title { @apply text-[18px] font-extrabold text-secondary; }
  &__section-label { @apply text-xs font-bold text-neutral-300 uppercase tracking-wide mb-2; }
  &__puesto { @apply mb-2; }
  &__error { @apply text-danger text-sm font-semibold mt-3; }
  &__actions { @apply flex gap-2 mt-4; }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/features/admin/entrenamientos/form-escuadra-entrenamiento/
git commit -m "feat: add FormEscuadraEntrenamientoComponent"
```

---

## Task 7: RegistrarResultadoEntrenamientoComponent

**Files:**
- Create: `src/app/features/admin/entrenamientos/registrar-resultado-entrenamiento/registrar-resultado-entrenamiento.component.ts`
- Create: `src/app/features/admin/entrenamientos/registrar-resultado-entrenamiento/registrar-resultado-entrenamiento.component.html`
- Create: `src/app/features/admin/entrenamientos/registrar-resultado-entrenamiento/registrar-resultado-entrenamiento.component.scss`

- [ ] **Step 1: Crear el componente TS**

```typescript
// registrar-resultado-entrenamiento.component.ts
import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap, map, of } from 'rxjs';
import { EntrenamientoService } from '../entrenamiento.service';
import { EscuadraService } from '../../../../features/scores/escuadra.service';
import { UserService } from '../../socios/user.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { firstValueFrom } from 'rxjs';

interface PuestoForm {
  userId: string;
  nombre: string;
  platosRotos: number;
  puesto: number;
}

@Component({
  selector: 'app-registrar-resultado-entrenamiento',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './registrar-resultado-entrenamiento.component.html',
  styleUrl: './registrar-resultado-entrenamiento.component.scss',
})
export class RegistrarResultadoEntrenamientoComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private entrenamientoService = inject(EntrenamientoService);
  private escuadraService = inject(EscuadraService);
  private userService = inject(UserService);
  private authService = inject(AuthService);

  private escuadraId = this.route.snapshot.paramMap.get('escuadraId')!;
  private entrenamientoId = this.route.snapshot.paramMap.get('entrenamientoId')!;

  private socios = toSignal(this.userService.getAll(), { initialValue: [] });
  private tiradores = toSignal(
    this.escuadraService.getTiradoresByEscuadra(this.escuadraId),
    { initialValue: [] }
  );

  puestos = computed<PuestoForm[]>(() => {
    const socios = this.socios();
    return this.tiradores().map(t => {
      const socio = socios.find(s => s.id === t.userId);
      return {
        userId: t.userId,
        nombre: socio ? `${socio.nombre} ${socio.apellidos}` : t.userId,
        platosRotos: 0,
        puesto: t.puesto,
      };
    });
  });

  puestosForm = signal<PuestoForm[]>([]);

  saving = signal(false);
  error = signal('');

  ngOnInit(): void {
    // Inicializar form editable desde computed
    this.puestosForm.set(this.puestos().map(p => ({ ...p })));
  }

  async guardar(): Promise<void> {
    this.saving.set(true);
    this.error.set('');
    try {
      const user = await firstValueFrom(this.authService.currentUser$);
      if (!user) throw new Error('No autenticado');
      await this.entrenamientoService.upsertResultados(
        this.puestosForm().map(p => ({
          escuadraId: this.escuadraId,
          userId: p.userId,
          puesto: p.puesto,
          platosRotos: p.platosRotos,
        })),
        user.id
      );
      this.router.navigate(['/admin/entrenamientos', this.entrenamientoId]);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      this.saving.set(false);
    }
  }

  goBack(): void {
    this.router.navigate(['/admin/entrenamientos', this.entrenamientoId]);
  }
}
```

- [ ] **Step 2: Crear el HTML**

```html
<!-- registrar-resultado-entrenamiento.component.html -->
<div class="registrar-e">
  <div class="page-header">
    <button (click)="goBack()" class="registrar-e__back-btn">
      <i class="bi bi-chevron-left registrar-e__back-icon"></i>
    </button>
    <h2 class="registrar-e__title">Resultados escuadra</h2>
  </div>

  @for (p of puestosForm(); track p.userId) {
    <div class="card resultado-item">
      <div class="resultado-item__info">
        <p class="resultado-item__nombre">{{ p.nombre }}</p>
        <p class="resultado-item__puesto">Puesto {{ p.puesto }}</p>
      </div>
      <div class="resultado-item__input-wrap">
        <input
          type="number"
          [(ngModel)]="p.platosRotos"
          min="0"
          max="25"
          class="resultado-item__input"
        />
        <span class="resultado-item__unit">platos</span>
      </div>
    </div>
  }

  @if (error()) {
    <p class="registrar-e__error">{{ error() }}</p>
  }

  <button (click)="guardar()" [disabled]="saving()" class="registrar-e__btn-guardar btn-primary">
    {{ saving() ? 'Guardando...' : 'Guardar resultados' }}
  </button>
</div>
```

- [ ] **Step 3: Crear el SCSS**

```scss
// registrar-resultado-entrenamiento.component.scss
.registrar-e {
  @apply p-3;

  &__back-btn { @apply text-gray-400; }
  &__back-icon { @apply text-[15px]; }
  &__title { @apply text-[18px] font-extrabold text-secondary; }
  &__error { @apply text-danger text-sm font-semibold mt-2; }
  &__btn-guardar { @apply w-full mt-4; }
}

.resultado-item {
  @apply flex items-center justify-between;

  &__info { @apply flex-1 min-w-0; }
  &__nombre { @apply text-base font-bold text-secondary truncate; }
  &__puesto { @apply text-xs text-neutral-300 font-medium; }

  &__input-wrap { @apply flex items-center gap-1; }

  &__input {
    @apply w-16 bg-neutral-100 rounded-input px-2 py-1
           text-base font-black text-secondary text-center outline-none
           focus:ring-2 focus:ring-primary/40;
  }

  &__unit { @apply text-xs text-neutral-300 font-medium; }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/features/admin/entrenamientos/registrar-resultado-entrenamiento/
git commit -m "feat: add RegistrarResultadoEntrenamientoComponent"
```

---

## Task 8: Rediseño AdminScoresComponent

**Files:**
- Modify: `src/app/features/admin/scores/admin-scores/admin-scores.component.ts`
- Modify: `src/app/features/admin/scores/admin-scores/admin-scores.component.html`
- Modify: `src/app/features/admin/scores/admin-scores/admin-scores.component.scss`

- [ ] **Step 1: Actualizar el TS para cargar también entrenamientos**

```typescript
// admin-scores.component.ts
import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { CompeticionService } from '../../../scores/competicion.service';
import { EntrenamientoService } from '../../entrenamientos/entrenamiento.service';
import { Competicion } from '../../../../core/models/competicion.model';
import { Entrenamiento } from '../../../../core/models/entrenamiento.model';

@Component({
  selector: 'app-admin-scores',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './admin-scores.component.html',
  styleUrl: './admin-scores.component.scss',
})
export class AdminScoresComponent {
  private competicionService = inject(CompeticionService);
  private entrenamientoService = inject(EntrenamientoService);
  private router = inject(Router);

  competiciones = toSignal(this.competicionService.getAll(), { initialValue: [] as Competicion[] });
  entrenamientos = toSignal(this.entrenamientoService.getAll(), { initialValue: [] as Entrenamiento[] });

  nuevoEntrenamiento(): void {
    this.router.navigate(['/admin/entrenamientos/nuevo']);
  }

  verEntrenamiento(id: string): void {
    this.router.navigate(['/admin/entrenamientos', id]);
  }

  nuevaCompeticion(): void {
    this.router.navigate(['/admin/competiciones/nueva']);
  }

  totalPlatos(c: Competicion): number {
    return c.platosPorSerie * c.numSeries;
  }
}
```

- [ ] **Step 2: Reescribir el HTML con entrenamientos arriba**

```html
<!-- admin-scores.component.html -->
<div class="admin-scores">

  <!-- ── ENTRENAMIENTOS (sección principal) ───────────────────── -->
  <section class="admin-scores__section">
    <h2 class="admin-scores__section-title">Entrenamientos</h2>

    <button (click)="nuevoEntrenamiento()" class="admin-scores__btn-primary">
      <i class="bi bi-plus-circle admin-scores__btn-primary-icon"></i>
      <span>Nuevo entrenamiento</span>
    </button>

    @if (entrenamientos().length === 0) {
      <div class="admin-scores__empty">
        <i class="bi bi-bullseye admin-scores__empty-icon"></i>
        <p class="admin-scores__empty-title">Sin entrenamientos</p>
        <p class="admin-scores__empty-subtitle">Crea el primero con el botón de arriba</p>
      </div>
    } @else {
      @for (e of entrenamientos(); track e.id) {
        <div class="card entrenamiento-item" (click)="verEntrenamiento(e.id)">
          <div class="entrenamiento-item__info">
            <p class="entrenamiento-item__fecha">{{ e.fecha | date:'EEEE d MMM yyyy' : '' : 'es' }}</p>
            <p class="entrenamiento-item__meta">{{ e.numEscuadras }} escuadra{{ e.numEscuadras !== 1 ? 's' : '' }}</p>
          </div>
          <i class="bi bi-chevron-right entrenamiento-item__arrow"></i>
        </div>
      }
    }
  </section>

  <!-- ── COMPETICIONES (sección secundaria) ───────────────────── -->
  <section class="admin-scores__section admin-scores__section--secondary">
    <h2 class="admin-scores__section-title admin-scores__section-title--secondary">Competiciones</h2>

    <button (click)="nuevaCompeticion()" class="admin-scores__btn-secondary">
      <i class="bi bi-trophy admin-scores__btn-secondary-icon"></i>
      <span>Nueva competición</span>
    </button>

    @if (competiciones().length === 0) {
      <p class="admin-scores__empty-text">Sin competiciones registradas.</p>
    } @else {
      @for (c of competiciones(); track c.id) {
        <div class="card competicion-item">
          <div class="competicion-item__header">
            <div class="competicion-item__info">
              <div class="competicion-item__nombre-row">
                <p class="competicion-item__nombre">{{ c.nombre }}</p>
                @if (c.activa) {
                  <span class="badge badge--primary">Activa</span>
                }
              </div>
              <p class="competicion-item__modalidad">{{ c.modalidad }}</p>
            </div>
            <div class="competicion-item__stats">
              <p class="competicion-item__total">{{ totalPlatos(c) }}<span class="competicion-item__total-unit"> platos</span></p>
              <p class="competicion-item__series">{{ c.numSeries }} serie(s) · {{ c.platosPorSerie }}/serie</p>
            </div>
          </div>
          @if (c.lugar) {
            <p class="competicion-item__lugar"><i class="bi bi-geo-alt"></i> {{ c.lugar }}</p>
          }
          <p class="competicion-item__fecha">{{ c.fecha | date:'dd/MM/yyyy' }}</p>
        </div>
      }
    }
  </section>

</div>
```

- [ ] **Step 3: Reescribir el SCSS con jerarquía visual**

```scss
// admin-scores.component.scss
.admin-scores {
  @apply p-3 flex flex-col gap-6;
}

// ── Secciones ──────────────────────────────────────────────────

.admin-scores__section {
  @apply flex flex-col gap-3;

  &--secondary {
    @apply pt-4 border-t border-neutral-200;
  }
}

.admin-scores__section-title {
  @apply text-base font-black text-secondary uppercase tracking-[1.5px];

  &--secondary {
    @apply text-sm font-bold text-neutral-400 uppercase tracking-[1.5px];
  }
}

// ── Botón primario de acción (entrenamientos) ──────────────────

.admin-scores__btn-primary {
  @apply flex items-center gap-3 bg-primary rounded-card px-4 py-3
         font-extrabold text-secondary w-full
         active:scale-[.98] transition-transform duration-fast;

  &-icon { @apply text-[20px]; }

  span { @apply text-base; }
}

// ── Botón secundario de acción (competiciones) ─────────────────

.admin-scores__btn-secondary {
  @apply flex items-center gap-2 bg-neutral-100 rounded-card px-3 py-2.5
         font-bold text-secondary w-full
         active:scale-[.98] transition-transform duration-fast;

  &-icon { @apply text-[16px] text-neutral-400; }

  span { @apply text-sm; }
}

// ── Estado vacío ───────────────────────────────────────────────

.admin-scores__empty {
  @apply flex flex-col items-center justify-center py-8 text-center;
}

.admin-scores__empty-icon {
  @apply text-[40px] text-neutral-200 mb-2;
}

.admin-scores__empty-title {
  @apply text-sm font-bold text-neutral-300 uppercase tracking-wider;
}

.admin-scores__empty-subtitle {
  @apply text-xs text-neutral-300 mt-1;
}

.admin-scores__empty-text {
  @apply text-sm text-neutral-300 font-medium;
}

// ── Tarjeta entrenamiento ──────────────────────────────────────

.entrenamiento-item {
  @apply flex items-center justify-between cursor-pointer
         active:scale-[.99] transition-transform duration-fast;

  &__info { @apply flex-1 min-w-0; }

  &__fecha {
    @apply text-base font-bold text-secondary capitalize truncate;
  }

  &__meta {
    @apply text-xs text-neutral-300 font-medium mt-0.5;
  }

  &__arrow { @apply text-neutral-300 text-[14px]; }
}

// ── Tarjeta competición (más compacta/discreta) ────────────────

.competicion-item__header {
  @apply flex items-start justify-between;
}

.competicion-item__info { @apply flex-1 min-w-0; }

.competicion-item__nombre-row {
  @apply flex items-center gap-2;
}

.competicion-item__nombre {
  @apply text-sm font-bold text-secondary truncate;
}

.competicion-item__modalidad {
  @apply text-xs text-neutral-300 font-medium mt-0.5;
}

.competicion-item__stats { @apply text-right ml-2; }

.competicion-item__total {
  @apply text-sm font-black text-secondary;
}

.competicion-item__total-unit {
  @apply text-xs text-neutral-300 font-medium;
}

.competicion-item__series { @apply text-xs text-neutral-300; }

.competicion-item__lugar { @apply text-xs text-neutral-300 mt-1; }

.competicion-item__fecha { @apply text-xs text-neutral-300 mt-0.5; }
```

- [ ] **Step 4: Commit**

```bash
git add src/app/features/admin/scores/admin-scores/
git commit -m "feat: redesign admin-scores panel with entrenamientos as primary section"
```

---

## Task 9: Bottom nav — renombrar Torneos a Entrena

**Files:**
- Modify: `src/app/shared/components/bottom-nav/bottom-nav.component.ts`

- [ ] **Step 1: Cambiar label e icono en ambos navs**

En `SOCIO_NAV` y `ADMIN_NAV`, cambiar la entrada de `/scores`:

```typescript
// SOCIO_NAV — cambiar:
{ route: '/scores', icon: 'bi-trophy', label: 'Torneos' }
// por:
{ route: '/scores', icon: 'bi-bullseye', label: 'Entrena' }

// ADMIN_NAV — cambiar:
{ route: '/admin/scores', icon: 'bi-trophy', label: 'Torneos' }
// por:
{ route: '/admin/scores', icon: 'bi-bullseye', label: 'Entrena' }
```

- [ ] **Step 2: Commit**

```bash
git add src/app/shared/components/bottom-nav/bottom-nav.component.ts
git commit -m "feat: rename Torneos to Entrena in bottom nav"
```

---

## Self-Review

### Cobertura de spec
- ✅ Entrenamientos independientes de competiciones
- ✅ Escuadras y resultados dentro de entrenamientos
- ✅ Panel admin reorganizado: entrenamientos arriba (peso visual mayor), competiciones abajo
- ✅ Rutas `/admin/entrenamientos/...` separadas
- ✅ Bottom nav actualizado
- ✅ Modelo Escuadra extendido con `entrenamientoId`
- ✅ `EscuadraService` extendido con métodos para entrenamientos
- ✅ Resultados numéricos (total platos) en lugar de plato a plato

### Tipos consistentes
- `Entrenamiento.fecha` es `string` ('YYYY-MM-DD') en todas las tareas
- `entrenamientoId` es `string` en modelos, servicios y rutas
- `PuestoForm` definido localmente en Task 7 — no se reutiliza en otros tasks
