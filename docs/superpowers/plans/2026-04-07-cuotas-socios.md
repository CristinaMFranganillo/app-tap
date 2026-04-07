# Cuotas de Socios — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir gestión de cuotas anuales a los socios, con histórico por temporada, indicador visual en la lista y una sección de administración de temporadas.

**Architecture:** Nueva tabla `temporadas` y `cuotas` en Supabase. `CuotaService` gestiona ambas tablas. La lista de socios carga el estado de cuota de la temporada activa via join y lo muestra con un círculo de color. Una nueva sección `/admin/temporadas` permite crear temporadas y generar las cuotas masivamente.

**Tech Stack:** Angular 17+ (standalone components, signals, toSignal), Supabase (PostgreSQL), Tailwind CSS, TypeScript

---

## Mapa de ficheros

| Fichero | Acción | Responsabilidad |
|---------|--------|-----------------|
| `supabase/migrations/007_cuotas.sql` | Crear | Tablas `temporadas` y `cuotas` |
| `src/app/core/models/cuota.model.ts` | Crear | Interfaces `Temporada` y `Cuota` |
| `src/app/core/models/user.model.ts` | Modificar | Añadir campo `cuotaPagada?: boolean` |
| `src/app/features/admin/socios/cuota.service.ts` | Crear | CRUD de cuotas y temporadas |
| `src/app/features/admin/socios/user.service.ts` | Modificar | Join con cuotas en `getAll()` y `update()` |
| `src/app/features/admin/socios/lista-socios/lista-socios.component.ts` | Modificar | Toggle de cuota desde la lista |
| `src/app/features/admin/socios/lista-socios/lista-socios.component.html` | Modificar | Círculo de estado de cuota |
| `src/app/features/admin/socios/lista-socios/lista-socios.component.scss` | Modificar | Estilos del círculo |
| `src/app/features/admin/temporadas/lista-temporadas/lista-temporadas.component.ts` | Crear | Lista de temporadas + crear nueva |
| `src/app/features/admin/temporadas/lista-temporadas/lista-temporadas.component.html` | Crear | Vista de temporadas |
| `src/app/features/admin/temporadas/lista-temporadas/lista-temporadas.component.scss` | Crear | Estilos de temporadas |
| `src/app/features/admin/admin.routes.ts` | Modificar | Ruta `/admin/temporadas` |

---

## Task 1: Migración de base de datos

**Files:**
- Create: `supabase/migrations/007_cuotas.sql`

- [ ] **Step 1: Crear el fichero de migración**

```sql
-- supabase/migrations/007_cuotas.sql

CREATE TABLE IF NOT EXISTS temporadas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       text NOT NULL,
  fecha_inicio date NOT NULL,
  activa       boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cuotas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  temporada_id  uuid NOT NULL REFERENCES temporadas(id) ON DELETE CASCADE,
  pagada        boolean NOT NULL DEFAULT false,
  fecha_pago    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, temporada_id)
);

-- Solo una temporada activa a la vez
CREATE UNIQUE INDEX IF NOT EXISTS idx_temporadas_activa
  ON temporadas (activa)
  WHERE activa = true;

-- RLS: los admin pueden leer y escribir todo
ALTER TABLE temporadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access temporadas"
  ON temporadas FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.rol IN ('admin', 'moderador')
    )
  );

CREATE POLICY "Admin full access cuotas"
  ON cuotas FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.rol IN ('admin', 'moderador')
    )
  );
```

- [ ] **Step 2: Aplicar la migración en Supabase**

Opción A (Supabase CLI):
```bash
supabase db push
```

Opción B (manual): Copiar el SQL en el SQL Editor de Supabase Dashboard y ejecutarlo.

Verificar que las tablas `temporadas` y `cuotas` aparecen en el Schema Browser de Supabase.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/007_cuotas.sql
git commit -m "feat(db): add temporadas and cuotas tables"
```

---

## Task 2: Modelos de datos

**Files:**
- Create: `src/app/core/models/cuota.model.ts`
- Modify: `src/app/core/models/user.model.ts`

- [ ] **Step 1: Crear el modelo de cuotas**

Crear `src/app/core/models/cuota.model.ts`:

```typescript
export interface Temporada {
  id: string;
  nombre: string;
  fechaInicio: Date;
  activa: boolean;
}

export interface Cuota {
  id: string;
  userId: string;
  temporadaId: string;
  temporadaNombre: string;
  pagada: boolean;
  fechaPago?: Date;
}
```

- [ ] **Step 2: Añadir `cuotaPagada` al modelo User**

En `src/app/core/models/user.model.ts`, añadir el campo al final del interface:

```typescript
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
  cuotaPagada?: boolean;   // estado en la temporada activa; undefined si no hay temporada
  cuotaId?: string;        // id del registro cuota para poder actualizarlo directamente
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/core/models/cuota.model.ts src/app/core/models/user.model.ts
git commit -m "feat(models): add Temporada, Cuota interfaces and cuotaPagada to User"
```

---

## Task 3: CuotaService

**Files:**
- Create: `src/app/features/admin/socios/cuota.service.ts`

- [ ] **Step 1: Crear el servicio**

Crear `src/app/features/admin/socios/cuota.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import { from, Observable, map } from 'rxjs';
import { Temporada, Cuota } from '../../../core/models/cuota.model';
import { supabase } from '../../../core/supabase/supabase.client';

function toTemporada(row: Record<string, unknown>): Temporada {
  return {
    id: row['id'] as string,
    nombre: row['nombre'] as string,
    fechaInicio: new Date(row['fecha_inicio'] as string),
    activa: row['activa'] as boolean,
  };
}

function toCuota(row: Record<string, unknown>): Cuota {
  return {
    id: row['id'] as string,
    userId: row['user_id'] as string,
    temporadaId: row['temporada_id'] as string,
    temporadaNombre: (row['temporadas'] as Record<string, unknown>)?.['nombre'] as string ?? '',
    pagada: row['pagada'] as boolean,
    fechaPago: row['fecha_pago'] ? new Date(row['fecha_pago'] as string) : undefined,
  };
}

@Injectable({ providedIn: 'root' })
export class CuotaService {

  getTemporadaActiva(): Observable<Temporada | null> {
    return from(
      supabase.from('temporadas').select('*').eq('activa', true).maybeSingle()
    ).pipe(
      map(({ data }) => data ? toTemporada(data as Record<string, unknown>) : null)
    );
  }

  getTodasTemporadas(): Observable<Temporada[]> {
    return from(
      supabase.from('temporadas').select('*').order('fecha_inicio', { ascending: false })
    ).pipe(
      map(({ data }) => (data ?? []).map(r => toTemporada(r as Record<string, unknown>)))
    );
  }

  getCuotasSocio(userId: string): Observable<Cuota[]> {
    return from(
      supabase
        .from('cuotas')
        .select('*, temporadas(nombre)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
    ).pipe(
      map(({ data }) => (data ?? []).map(r => toCuota(r as Record<string, unknown>)))
    );
  }

  async crearTemporada(nombre: string, fechaInicio: Date): Promise<void> {
    // Desactivar temporada actual
    await supabase.from('temporadas').update({ activa: false }).eq('activa', true);

    // Crear nueva temporada activa
    const { data: nuevaTemporada, error: errT } = await supabase
      .from('temporadas')
      .insert({ nombre, fecha_inicio: fechaInicio.toISOString().split('T')[0], activa: true })
      .select()
      .single();
    if (errT) throw new Error(errT.message);

    // Obtener todos los socios activos
    const { data: socios, error: errS } = await supabase
      .from('profiles')
      .select('id')
      .eq('activo', true);
    if (errS) throw new Error(errS.message);

    // Insertar cuotas para cada socio
    if (socios && socios.length > 0) {
      const cuotas = socios.map((s: { id: string }) => ({
        user_id: s.id,
        temporada_id: (nuevaTemporada as { id: string }).id,
        pagada: false,
      }));
      const { error: errC } = await supabase.from('cuotas').insert(cuotas);
      if (errC) throw new Error(errC.message);
    }
  }

  async toggleCuota(cuotaId: string, pagada: boolean): Promise<void> {
    const payload: Record<string, unknown> = {
      pagada,
      fecha_pago: pagada ? new Date().toISOString() : null,
    };
    const { error } = await supabase.from('cuotas').update(payload).eq('id', cuotaId);
    if (error) throw new Error(error.message);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/features/admin/socios/cuota.service.ts
git commit -m "feat(socios): add CuotaService for temporadas and cuotas"
```

---

## Task 4: Modificar UserService para incluir cuota activa

**Files:**
- Modify: `src/app/features/admin/socios/user.service.ts`

- [ ] **Step 1: Actualizar `toUser` y `getAll` con join a cuotas**

Reemplazar la función `toUser` y el método `getAll` en `src/app/features/admin/socios/user.service.ts`:

```typescript
// Reemplazar la función toUser existente:
function toUser(row: Record<string, unknown>): User {
  // cuotas es un array con 0 o 1 elemento (la de la temporada activa)
  const cuotaRows = (row['cuotas'] as Record<string, unknown>[] | null) ?? [];
  const cuota = cuotaRows[0] ?? null;

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
    cuotaPagada: cuota ? (cuota['pagada'] as boolean) : undefined,
    cuotaId: cuota ? (cuota['id'] as string) : undefined,
  };
}
```

```typescript
// Reemplazar el método getAll:
getAll(): Observable<User[]> {
  return from(
    supabase
      .from('profiles')
      .select(`
        *,
        cuotas!left(id, pagada, temporada_id, temporadas!inner(activa))
      `)
      .eq('cuotas.temporadas.activa', true)
      .order('fecha_alta', { ascending: true })
  ).pipe(
    map(({ data }) => (data ?? []).map(row => toUser(row as Record<string, unknown>))),
    tap(users => this.cache.next(users))
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/features/admin/socios/user.service.ts
git commit -m "feat(socios): join cuota activa in UserService.getAll"
```

---

## Task 5: Indicador de cuota en la lista de socios

**Files:**
- Modify: `src/app/features/admin/socios/lista-socios/lista-socios.component.ts`
- Modify: `src/app/features/admin/socios/lista-socios/lista-socios.component.html`
- Modify: `src/app/features/admin/socios/lista-socios/lista-socios.component.scss`

- [ ] **Step 1: Añadir método `toggleCuota` al componente**

En `lista-socios.component.ts`, añadir el import y el método:

```typescript
// Añadir al bloque de imports:
import { CuotaService } from '../cuota.service';
```

```typescript
// Añadir dentro de la clase ListaSociosComponent, después de userService:
private cuotaService = inject(CuotaService);
```

```typescript
// Añadir método:
async toggleCuota(socio: User, event: Event): Promise<void> {
  event.stopPropagation();
  if (socio.cuotaId === undefined) return;
  await this.cuotaService.toggleCuota(socio.cuotaId, !socio.cuotaPagada);
  this.refresh$.next();
}
```

- [ ] **Step 2: Añadir el círculo de cuota en el HTML**

En `lista-socios.component.html`, dentro de `.socio-item__row`, añadir el botón de cuota **antes** del `<div class="socio-item__actions">`:

```html
<!-- Añadir justo antes de <div class="socio-item__actions"> -->
@if (socio.cuotaId !== undefined) {
  <button
    (click)="toggleCuota(socio, $event)"
    class="socio-item__cuota-btn"
    [title]="socio.cuotaPagada ? 'Cuota pagada — click para desmarcar' : 'Cuota pendiente — click para marcar'"
  >
    <span
      class="socio-item__cuota-dot"
      [class.socio-item__cuota-dot--pagada]="socio.cuotaPagada"
    ></span>
  </button>
}
```

- [ ] **Step 3: Añadir estilos del círculo**

En `lista-socios.component.scss`, añadir al final:

```scss
.socio-item__cuota-btn {
  @apply flex items-center justify-center p-1 rounded-full;
}

.socio-item__cuota-dot {
  @apply w-3 h-3 rounded-full bg-gray-300 flex-shrink-0 transition-colors duration-150;

  &--pagada {
    background-color: #10B981;
  }
}
```

- [ ] **Step 4: Añadir User al tipo importado en el template**

Verificar que `User` está importado en `lista-socios.component.ts` (ya está en `import { User } from '../../../../core/models/user.model'`). Si el método `toggleCuota` necesita el tipo en el HTML, Angular lo infiere — no hay nada más que cambiar.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/admin/socios/lista-socios/lista-socios.component.ts \
        src/app/features/admin/socios/lista-socios/lista-socios.component.html \
        src/app/features/admin/socios/lista-socios/lista-socios.component.scss
git commit -m "feat(socios): add cuota status indicator with toggle in lista-socios"
```

---

## Task 6: Historial de cuotas en el detalle del socio

**Files:**
- Modify: `src/app/features/admin/socios/lista-socios/lista-socios.component.ts`
- Modify: `src/app/features/admin/socios/lista-socios/lista-socios.component.html`

- [ ] **Step 1: Cargar historial al expandir**

En `lista-socios.component.ts`, añadir:

```typescript
// Añadir import:
import { Cuota } from '../../../../core/models/cuota.model';
```

```typescript
// Añadir propiedad en la clase:
cuotasHistorial = signal<Record<string, Cuota[]>>({});
```

```typescript
// Reemplazar el método toggleExpanded:
toggleExpanded(id: string): void {
  if (this.expandedId() === id) {
    this.expandedId.set(null);
    return;
  }
  this.expandedId.set(id);
  this.cuotaService.getCuotasSocio(id).subscribe(cuotas => {
    this.cuotasHistorial.update(h => ({ ...h, [id]: cuotas }));
  });
}
```

- [ ] **Step 2: Mostrar historial en el panel expandido**

En `lista-socios.component.html`, dentro del bloque `@if (expandedId() === socio.id)`, añadir al final de `.socio-item__details`:

```html
<!-- Añadir al final de .socio-item__details, tras la fila "Alta" -->
@if (cuotasHistorial()[socio.id]?.length) {
  <div class="socio-item__detail-row socio-item__detail-row--header">
    <span class="socio-item__detail-label">Historial cuotas</span>
  </div>
  @for (cuota of cuotasHistorial()[socio.id]; track cuota.id) {
    <div class="socio-item__detail-row">
      <span class="socio-item__detail-label">{{ cuota.temporadaNombre }}</span>
      <span class="socio-item__cuota-badge" [class.socio-item__cuota-badge--pagada]="cuota.pagada">
        {{ cuota.pagada ? 'Pagada' : 'Pendiente' }}
      </span>
    </div>
  }
}
```

- [ ] **Step 3: Estilos del badge de historial**

En `lista-socios.component.scss`, añadir al final:

```scss
.socio-item__cuota-badge {
  @apply text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400;

  &--pagada {
    @apply bg-emerald-50 text-emerald-600;
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/features/admin/socios/lista-socios/lista-socios.component.ts \
        src/app/features/admin/socios/lista-socios/lista-socios.component.html \
        src/app/features/admin/socios/lista-socios/lista-socios.component.scss
git commit -m "feat(socios): show cuotas history in expanded socio detail"
```

---

## Task 7: Sección de gestión de temporadas

**Files:**
- Create: `src/app/features/admin/temporadas/lista-temporadas/lista-temporadas.component.ts`
- Create: `src/app/features/admin/temporadas/lista-temporadas/lista-temporadas.component.html`
- Create: `src/app/features/admin/temporadas/lista-temporadas/lista-temporadas.component.scss`
- Modify: `src/app/features/admin/admin.routes.ts`

- [ ] **Step 1: Crear el componente TypeScript**

Crear `src/app/features/admin/temporadas/lista-temporadas/lista-temporadas.component.ts`:

```typescript
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subject, switchMap, startWith } from 'rxjs';
import { CuotaService } from '../../socios/cuota.service';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-lista-temporadas',
  standalone: true,
  imports: [FormsModule, DatePipe, ConfirmDialogComponent],
  templateUrl: './lista-temporadas.component.html',
  styleUrl: './lista-temporadas.component.scss',
})
export class ListaTemporadasComponent {
  private cuotaService = inject(CuotaService);

  private refresh$ = new Subject<void>();
  temporadas = toSignal(
    this.refresh$.pipe(startWith(null), switchMap(() => this.cuotaService.getTodasTemporadas())),
    { initialValue: [] }
  );

  mostrarFormulario = signal(false);
  saving = signal(false);
  error = signal('');

  // Campos del formulario nueva temporada
  nuevoNombre = signal('');
  nuevaFechaInicio = signal('');

  abrirFormulario(): void {
    // Sugerir nombre automático basado en el año actual
    const hoy = new Date();
    const year = hoy.getMonth() >= 3 ? hoy.getFullYear() : hoy.getFullYear() - 1;
    this.nuevoNombre.set(`${year}-${year + 1}`);
    this.nuevaFechaInicio.set('');
    this.error.set('');
    this.mostrarFormulario.set(true);
  }

  cerrarFormulario(): void {
    this.mostrarFormulario.set(false);
  }

  async crearTemporada(): Promise<void> {
    if (!this.nuevoNombre() || !this.nuevaFechaInicio()) {
      this.error.set('El nombre y la fecha de inicio son obligatorios.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    try {
      await this.cuotaService.crearTemporada(
        this.nuevoNombre(),
        new Date(this.nuevaFechaInicio())
      );
      this.mostrarFormulario.set(false);
      this.refresh$.next();
    } catch (err: unknown) {
      this.error.set(err instanceof Error ? err.message : 'Error al crear la temporada.');
    } finally {
      this.saving.set(false);
    }
  }
}
```

- [ ] **Step 2: Crear el template HTML**

Crear `src/app/features/admin/temporadas/lista-temporadas/lista-temporadas.component.html`:

```html
<div class="lista-temporadas">
  <div class="page-header">
    <h3 class="lista-temporadas__title">Temporadas</h3>
  </div>

  @if (error()) {
    <p class="lista-temporadas__error">{{ error() }}</p>
  }

  @for (temporada of temporadas(); track temporada.id) {
    <div class="card temporada-item" [class.temporada-item--activa]="temporada.activa">
      <div class="temporada-item__row">
        <div class="temporada-item__info">
          <p class="temporada-item__nombre">{{ temporada.nombre }}</p>
          <p class="temporada-item__meta">Inicio: {{ temporada.fechaInicio | date:'dd/MM/yyyy' }}</p>
        </div>
        @if (temporada.activa) {
          <span class="temporada-item__badge">Activa</span>
        }
      </div>
    </div>
  }

  @if (temporadas().length === 0) {
    <p class="lista-temporadas__empty">No hay temporadas registradas.</p>
  }
</div>

<!-- FAB -->
<button (click)="abrirFormulario()" class="fab">
  <i class="bi bi-plus-lg fab-icon"></i>
</button>

<!-- Diálogo nueva temporada -->
@if (mostrarFormulario()) {
  <div class="modal-overlay" (click)="cerrarFormulario()">
    <div class="modal-card" (click)="$event.stopPropagation()">
      <h4 class="modal-card__title">Nueva temporada</h4>

      @if (error()) {
        <p class="form-error">{{ error() }}</p>
      }

      <div class="modal-card__field">
        <label class="form-label">Nombre <span class="form-required">*</span></label>
        <input
          [ngModel]="nuevoNombre()"
          (ngModelChange)="nuevoNombre.set($event)"
          placeholder="ej: 2026-2027"
          class="form-input-surface"
        />
      </div>

      <div class="modal-card__field">
        <label class="form-label">Fecha inicio de cobro <span class="form-required">*</span></label>
        <input
          type="date"
          [ngModel]="nuevaFechaInicio()"
          (ngModelChange)="nuevaFechaInicio.set($event)"
          class="form-input-surface"
        />
      </div>

      <div class="modal-card__actions">
        <button type="button" (click)="cerrarFormulario()" class="btn-secondary">Cancelar</button>
        <button
          type="button"
          (click)="crearTemporada()"
          [disabled]="saving()"
          class="btn-primary"
        >
          {{ saving() ? 'Creando...' : 'Crear temporada' }}
        </button>
      </div>
    </div>
  </div>
}
```

- [ ] **Step 3: Crear los estilos SCSS**

Crear `src/app/features/admin/temporadas/lista-temporadas/lista-temporadas.component.scss`:

```scss
.lista-temporadas {
  @apply p-3;
}

.lista-temporadas__title {
  @apply text-[16px] font-bold text-brand-dark;
}

.lista-temporadas__error {
  @apply text-danger text-[13px] mb-3;
}

.lista-temporadas__empty {
  @apply text-center text-[13px] text-gray-400 mt-6;
}

.temporada-item {
  @apply mb-2;

  &__row {
    @apply flex items-center justify-between;
  }

  &__info {
    @apply flex flex-col gap-0.5;
  }

  &__nombre {
    @apply text-[14px] font-bold text-brand-dark;
  }

  &__meta {
    @apply text-[12px] text-gray-400 font-medium;
  }

  &__badge {
    @apply text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600;
  }

  &--activa {
    @apply border-l-4 border-emerald-400;
  }
}

.fab-icon {
  @apply text-[18px] font-black;
}

.modal-overlay {
  @apply fixed inset-0 bg-black/40 z-50 flex items-end justify-center;
}

.modal-card {
  @apply bg-white rounded-t-2xl w-full max-w-lg p-5 flex flex-col gap-4;

  &__title {
    @apply text-[16px] font-bold text-brand-dark;
  }

  &__field {
    @apply flex flex-col gap-1;
  }

  &__actions {
    @apply flex gap-3 justify-end;
  }
}
```

- [ ] **Step 4: Añadir la ruta en admin.routes.ts**

En `src/app/features/admin/admin.routes.ts`, añadir la nueva ruta después del bloque de socios (línea 26):

```typescript
// Temporadas (cuotas)
{
  path: 'temporadas',
  canActivate: [roleGuard],
  data: { roles: ['admin'] },
  loadComponent: () =>
    import('./temporadas/lista-temporadas/lista-temporadas.component').then(m => m.ListaTemporadasComponent),
},
```

- [ ] **Step 5: Commit**

```bash
git add src/app/features/admin/temporadas/ src/app/features/admin/admin.routes.ts
git commit -m "feat(admin): add temporadas management section"
```

---

## Task 8: Verificación manual

- [ ] **Step 1: Levantar la app**

```bash
cd /c/Users/cristina.mf/Desktop/tap/appTap
npm start
```

- [ ] **Step 2: Verificar lista de socios sin temporada activa**

Entrar a `/admin/socios`. Los socios no deben mostrar círculo de cuota (sin `cuotaId`). Verificar que la lista carga sin errores en consola.

- [ ] **Step 3: Crear una temporada**

Entrar a `/admin/temporadas`. Pulsar el FAB, introducir nombre `2025-2026` y una fecha. Pulsar "Crear temporada". Verificar que aparece en la lista marcada como "Activa".

- [ ] **Step 4: Verificar círculos en lista de socios**

Volver a `/admin/socios`. Todos los socios deben mostrar un círculo **gris** (cuota pendiente).

- [ ] **Step 5: Marcar cuota como pagada**

Hacer click en el círculo gris de un socio. Debe cambiar a **verde**. Recargar la página — el estado debe persistir.

- [ ] **Step 6: Verificar historial en detalle**

Expandir el detalle de un socio. Verificar que aparece la sección "Historial cuotas" con la temporada actual y su estado.

- [ ] **Step 7: Crear segunda temporada**

En `/admin/temporadas`, crear una segunda temporada. Verificar que la primera deja de estar "Activa" y la nueva aparece como activa. Volver a la lista de socios y verificar que los círculos se han reseteado a gris.
