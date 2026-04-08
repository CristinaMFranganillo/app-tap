# Gestión de Temporadas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir editar/eliminar temporadas, ver socios con cuota pendiente por temporada, y mostrar un modal de alerta al crear una nueva temporada con los socios que no pagaron la anterior.

**Architecture:** Se añaden métodos a `CuotaService` para editar/eliminar temporadas y obtener socios pendientes por temporada. `ListaTemporadasComponent` se extiende con bottom sheets de edición y detalle de pendientes. Al crear temporada, si la anterior tiene socios sin pagar se muestra un modal de confirmación con lista de esos socios y opción de darlos de baja. El círculo de cuota se agranda con un cambio de tamaño en el SCSS.

**Tech Stack:** Angular 17 standalone signals, Supabase, Tailwind CSS, Bootstrap Icons

---

## Archivos afectados

| Archivo | Acción |
|---|---|
| `src/app/features/admin/socios/cuota.service.ts` | Modificar — añadir `editarTemporada`, `eliminarTemporada`, `getSociosPendientesByTemporada` |
| `src/app/features/admin/temporadas/lista-temporadas/lista-temporadas.component.ts` | Modificar — lógica edición, eliminación, detalle pendientes, modal al crear |
| `src/app/features/admin/temporadas/lista-temporadas/lista-temporadas.component.html` | Modificar — cards clicables, bottom sheets edición y pendientes, modal socios sin pagar |
| `src/app/features/admin/temporadas/lista-temporadas/lista-temporadas.component.scss` | Modificar — estilos bottom sheet edición, lista pendientes |
| `src/app/features/admin/socios/lista-socios/lista-socios.component.scss` | Modificar — agrandar círculo de cuota |

---

## Task 1: Agrandar el círculo de cuota en lista-socios

**Files:**
- Modify: `src/app/features/admin/socios/lista-socios/lista-socios.component.scss`

- [ ] **Step 1: Leer el SCSS actual para localizar el tamaño del círculo**

Abrir `src/app/features/admin/socios/lista-socios/lista-socios.component.scss` y buscar `.socio-item__cuota-dot`.

- [ ] **Step 2: Aumentar el tamaño del círculo**

Encontrar el bloque `.socio-item__cuota-dot` (o el equivalente en Tailwind dentro del HTML si no hay regla SCSS explícita).

Si el tamaño está en el HTML con clases Tailwind como `w-3 h-3`, cambiarlas a `w-4 h-4`.

Si hay regla SCSS, actualizar:
```scss
.socio-item__cuota-dot {
  // cambiar width/height de 12px → 16px (o equivalente actual)
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: inline-block;
}
```

- [ ] **Step 3: Verificar visualmente en el navegador**

Abrir la app en `http://localhost:4200` (o el puerto activo), navegar a Admin → Socios y comprobar que el círculo es visiblemente más grande.

- [ ] **Step 4: Commit**

```bash
git add src/app/features/admin/socios/lista-socios/lista-socios.component.scss src/app/features/admin/socios/lista-socios/lista-socios.component.html
git commit -m "feat(socios): increase cuota dot size"
```

---

## Task 2: Métodos de servicio — editar, eliminar temporada y socios pendientes

**Files:**
- Modify: `src/app/features/admin/socios/cuota.service.ts`

- [ ] **Step 1: Añadir `editarTemporada`**

En `src/app/features/admin/socios/cuota.service.ts`, añadir al final de la clase `CuotaService`:

```typescript
async editarTemporada(id: string, nombre: string, fechaInicio: Date): Promise<void> {
  const { error } = await supabase
    .from('temporadas')
    .update({ nombre, fecha_inicio: fechaInicio.toISOString().split('T')[0] })
    .eq('id', id);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 2: Añadir `eliminarTemporada`**

Justo debajo de `editarTemporada`, añadir:

```typescript
async eliminarTemporada(id: string): Promise<void> {
  const { error } = await supabase
    .from('temporadas')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}
```

Nota: La tabla `cuotas` tiene `ON DELETE CASCADE` referenciando `temporadas`, por lo que las cuotas asociadas se eliminan automáticamente en la BD.

- [ ] **Step 3: Añadir `getSociosPendientesByTemporada`**

Añadir un método que devuelva los perfiles de socios que tienen cuota no pagada en una temporada concreta:

```typescript
getSociosPendientesByTemporada(temporadaId: string): Observable<{ id: string; nombre: string; apellidos: string }[]> {
  return from(
    supabase
      .from('cuotas')
      .select('user_id, pagada, profiles!inner(id, nombre, apellidos)')
      .eq('temporada_id', temporadaId)
      .eq('pagada', false)
  ).pipe(
    map(({ data }) =>
      (data ?? []).map(row => {
        const p = (row as Record<string, unknown>)['profiles'] as Record<string, unknown>;
        return {
          id: p['id'] as string,
          nombre: p['nombre'] as string,
          apellidos: p['apellidos'] as string,
        };
      })
    )
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/features/admin/socios/cuota.service.ts
git commit -m "feat(cuotas): add editarTemporada, eliminarTemporada, getSociosPendientesByTemporada"
```

---

## Task 3: Lógica en ListaTemporadasComponent

**Files:**
- Modify: `src/app/features/admin/temporadas/lista-temporadas/lista-temporadas.component.ts`

- [ ] **Step 1: Añadir imports necesarios**

Al inicio del archivo, asegurarse de que están importados `Observable` y el modelo correcto. Añadir también `UserService` para poder llamar a `eliminar`:

```typescript
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subject, switchMap, startWith } from 'rxjs';
import { CuotaService } from '../../socios/cuota.service';
import { UserService } from '../../socios/user.service';
import { Temporada } from '../../../../core/models/cuota.model';
```

- [ ] **Step 2: Añadir signals de estado**

Dentro de la clase `ListaTemporadasComponent`, añadir tras los signals existentes:

```typescript
// Edición
editandoTemporada = signal<Temporada | null>(null);
editNombre = signal('');
editFechaInicio = signal('');
editSaving = signal(false);
editError = signal('');

// Confirmación eliminar temporada
pendingDeleteTemporadaId = signal<string | null>(null);

// Detalle socios pendientes (al pulsar en temporada)
temporadaDetalle = signal<Temporada | null>(null);
sociosPendientes = signal<{ id: string; nombre: string; apellidos: string }[]>([]);
loadingPendientes = signal(false);

// Modal socios sin pagar al crear nueva temporada
sociosSinPagarAnterior = signal<{ id: string; nombre: string; apellidos: string }[]>([]);
mostrarModalSinPagar = signal(false);
```

- [ ] **Step 3: Inyectar UserService**

Añadir la inyección junto a `cuotaService`:

```typescript
private userService = inject(UserService);
```

- [ ] **Step 4: Añadir método `abrirDetalle`**

```typescript
abrirDetalle(temporada: Temporada): void {
  this.temporadaDetalle.set(temporada);
  this.sociosPendientes.set([]);
  this.loadingPendientes.set(true);
  this.cuotaService.getSociosPendientesByTemporada(temporada.id).subscribe({
    next: (socios) => {
      this.sociosPendientes.set(socios);
      this.loadingPendientes.set(false);
    },
    error: () => this.loadingPendientes.set(false),
  });
}

cerrarDetalle(): void {
  this.temporadaDetalle.set(null);
}
```

- [ ] **Step 5: Añadir métodos de edición**

```typescript
abrirEdicion(temporada: Temporada, event: Event): void {
  event.stopPropagation();
  this.editandoTemporada.set(temporada);
  this.editNombre.set(temporada.nombre);
  const yyyy = temporada.fechaInicio.toISOString().split('T')[0];
  this.editFechaInicio.set(yyyy);
  this.editError.set('');
}

cerrarEdicion(): void {
  this.editandoTemporada.set(null);
}

async guardarEdicion(): Promise<void> {
  const t = this.editandoTemporada();
  if (!t) return;
  if (!this.editNombre() || !this.editFechaInicio()) {
    this.editError.set('El nombre y la fecha son obligatorios.');
    return;
  }
  this.editSaving.set(true);
  this.editError.set('');
  try {
    await this.cuotaService.editarTemporada(t.id, this.editNombre(), new Date(this.editFechaInicio()));
    this.editandoTemporada.set(null);
    this.refresh$.next();
  } catch (err: unknown) {
    this.editError.set(err instanceof Error ? err.message : 'Error al guardar.');
  } finally {
    this.editSaving.set(false);
  }
}
```

- [ ] **Step 6: Añadir métodos de eliminación de temporada**

```typescript
confirmarEliminarTemporada(id: string, event: Event): void {
  event.stopPropagation();
  this.pendingDeleteTemporadaId.set(id);
}

cancelarEliminarTemporada(): void {
  this.pendingDeleteTemporadaId.set(null);
}

async eliminarTemporada(): Promise<void> {
  const id = this.pendingDeleteTemporadaId();
  if (!id) return;
  this.pendingDeleteTemporadaId.set(null);
  try {
    await this.cuotaService.eliminarTemporada(id);
    this.refresh$.next();
  } catch (err: unknown) {
    this.error.set(err instanceof Error ? err.message : 'Error al eliminar.');
  }
}
```

- [ ] **Step 7: Modificar `crearTemporada` para mostrar modal de socios sin pagar**

Reemplazar el método `crearTemporada` existente:

```typescript
async crearTemporada(): Promise<void> {
  if (!this.nuevoNombre() || !this.nuevaFechaInicio()) {
    this.error.set('El nombre y la fecha de inicio son obligatorios.');
    return;
  }

  // Buscar temporada activa actual para obtener socios pendientes antes de cerrarla
  const temporadaActual = this.temporadas().find(t => t.activa) ?? null;

  this.saving.set(true);
  this.error.set('');
  try {
    // Si hay temporada activa, obtener socios sin pagar antes de crear la nueva
    if (temporadaActual) {
      const pendientes = await new Promise<{ id: string; nombre: string; apellidos: string }[]>((resolve) => {
        this.cuotaService.getSociosPendientesByTemporada(temporadaActual.id).subscribe({
          next: resolve,
          error: () => resolve([]),
        });
      });
      if (pendientes.length > 0) {
        this.sociosSinPagarAnterior.set(pendientes);
        this.mostrarModalSinPagar.set(true);
        // Detener aquí — el modal tiene su propio botón para continuar creando
        this.saving.set(false);
        return;
      }
    }

    await this._ejecutarCrearTemporada();
  } catch (err: unknown) {
    this.error.set(err instanceof Error ? err.message : 'Error al crear la temporada.');
    this.saving.set(false);
  }
}

async _ejecutarCrearTemporada(): Promise<void> {
  this.saving.set(true);
  this.error.set('');
  try {
    await this.cuotaService.crearTemporada(
      this.nuevoNombre(),
      new Date(this.nuevaFechaInicio())
    );
    this.mostrarFormulario.set(false);
    this.mostrarModalSinPagar.set(false);
    this.refresh$.next();
  } catch (err: unknown) {
    this.error.set(err instanceof Error ? err.message : 'Error al crear la temporada.');
  } finally {
    this.saving.set(false);
  }
}

cerrarModalSinPagar(): void {
  this.mostrarModalSinPagar.set(false);
  this.sociosSinPagarAnterior.set([]);
}

async darDeBajaSocio(id: string): Promise<void> {
  try {
    await this.userService.eliminar(id);
    this.sociosSinPagarAnterior.update(list => list.filter(s => s.id !== id));
  } catch {
    // silenciar — no bloquea el flujo principal
  }
}
```

- [ ] **Step 8: Commit**

```bash
git add src/app/features/admin/temporadas/lista-temporadas/lista-temporadas.component.ts
git commit -m "feat(temporadas): add edit, delete, pending socios logic"
```

---

## Task 4: HTML — cards clicables, bottom sheets y modal socios sin pagar

**Files:**
- Modify: `src/app/features/admin/temporadas/lista-temporadas/lista-temporadas.component.html`
- Modify: `src/app/features/admin/temporadas/lista-temporadas/lista-temporadas.component.scss`

- [ ] **Step 1: Hacer las cards de temporada clicables y añadir botones de editar/eliminar**

Reemplazar el bloque `@for` en el HTML:

```html
@for (temporada of temporadas(); track temporada.id) {
  <div
    class="card temporada-item"
    [class.temporada-item--activa]="temporada.activa"
    (click)="abrirDetalle(temporada)"
  >
    <div class="temporada-item__row">
      <div class="temporada-item__info">
        <p class="temporada-item__nombre">{{ temporada.nombre }}</p>
        <p class="temporada-item__meta">Inicio: {{ temporada.fechaInicio | date:'dd/MM/yyyy' }}</p>
      </div>
      <div class="temporada-item__actions">
        @if (temporada.activa) {
          <span class="temporada-item__badge">Activa</span>
        }
        <button class="temporada-item__btn-edit" (click)="abrirEdicion(temporada, $event)" title="Editar">
          <i class="bi bi-pencil-fill"></i>
        </button>
        <button class="temporada-item__btn-delete" (click)="confirmarEliminarTemporada(temporada.id, $event)" title="Eliminar">
          <i class="bi bi-trash-fill"></i>
        </button>
      </div>
    </div>
  </div>
}
```

- [ ] **Step 2: Añadir bottom sheet de detalle (socios pendientes)**

Tras el bloque del FAB y el diálogo de nueva temporada, añadir:

```html
<!-- Detalle temporada: socios con cuota pendiente -->
@if (temporadaDetalle()) {
  <div class="modal-overlay" (click)="cerrarDetalle()">
    <div class="modal-card modal-card--tall" (click)="$event.stopPropagation()">
      <div class="modal-card__header">
        <h4 class="modal-card__title">{{ temporadaDetalle()!.nombre }}</h4>
        <button class="modal-card__close" (click)="cerrarDetalle()">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
      <p class="modal-card__subtitle">Socios con cuota pendiente</p>

      @if (loadingPendientes()) {
        <p class="modal-card__empty">Cargando...</p>
      } @else if (sociosPendientes().length === 0) {
        <p class="modal-card__empty">Todos los socios han pagado la cuota.</p>
      } @else {
        <ul class="pendientes-list">
          @for (socio of sociosPendientes(); track socio.id) {
            <li class="pendientes-list__item">
              <span class="pendientes-list__nombre">{{ socio.nombre }} {{ socio.apellidos }}</span>
            </li>
          }
        </ul>
      }
    </div>
  </div>
}
```

- [ ] **Step 3: Añadir bottom sheet de edición**

```html
<!-- Editar temporada -->
@if (editandoTemporada()) {
  <div class="modal-overlay" (click)="cerrarEdicion()">
    <div class="modal-card" (click)="$event.stopPropagation()">
      <h4 class="modal-card__title">Editar temporada</h4>

      @if (editError()) {
        <p class="form-error">{{ editError() }}</p>
      }

      <div class="modal-card__field">
        <label class="form-label">Nombre <span class="form-required">*</span></label>
        <input
          [ngModel]="editNombre()"
          (ngModelChange)="editNombre.set($event)"
          class="form-input-surface"
        />
      </div>

      <div class="modal-card__field">
        <label class="form-label">Fecha inicio <span class="form-required">*</span></label>
        <input
          type="date"
          [ngModel]="editFechaInicio()"
          (ngModelChange)="editFechaInicio.set($event)"
          class="form-input-surface"
        />
      </div>

      <div class="modal-card__actions">
        <button type="button" (click)="cerrarEdicion()" class="btn-secondary">Cancelar</button>
        <button
          type="button"
          (click)="guardarEdicion()"
          [disabled]="editSaving()"
          class="btn-primary"
        >
          {{ editSaving() ? 'Guardando...' : 'Guardar' }}
        </button>
      </div>
    </div>
  </div>
}
```

- [ ] **Step 4: Añadir bottom sheet de confirmación eliminar temporada**

Importar `ConfirmDialogComponent` en el componente TS:

```typescript
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
```

Y añadirlo a `imports: [FormsModule, DatePipe, ConfirmDialogComponent]`.

En el HTML, tras los bottom sheets anteriores:

```html
@if (pendingDeleteTemporadaId()) {
  <app-confirm-dialog
    titulo="Eliminar temporada"
    mensaje="¿Seguro que quieres eliminar esta temporada? Se eliminarán también todas sus cuotas."
    labelConfirmar="Eliminar"
    (confirmado)="eliminarTemporada()"
    (cancelado)="cancelarEliminarTemporada()"
  />
}
```

- [ ] **Step 5: Añadir modal socios sin pagar al crear nueva temporada**

```html
<!-- Modal socios sin pagar antes de crear nueva temporada -->
@if (mostrarModalSinPagar()) {
  <div class="modal-overlay" (click)="cerrarModalSinPagar()">
    <div class="modal-card modal-card--tall" (click)="$event.stopPropagation()">
      <div class="cd-icon-wrap" style="background:#FEF3C7; margin-bottom: 8px;">
        <i class="bi bi-exclamation-triangle-fill" style="color:#D97706; font-size:22px;"></i>
      </div>
      <h4 class="modal-card__title">Socios con cuota pendiente</h4>
      <p class="modal-card__subtitle">
        Los siguientes socios no han pagado la temporada actual. Puedes darlos de baja ahora o continuar sin hacer cambios.
      </p>

      <ul class="pendientes-list">
        @for (socio of sociosSinPagarAnterior(); track socio.id) {
          <li class="pendientes-list__item">
            <span class="pendientes-list__nombre">{{ socio.nombre }} {{ socio.apellidos }}</span>
            <button class="pendientes-list__baja-btn" (click)="darDeBajaSocio(socio.id)">
              Dar de baja
            </button>
          </li>
        }
      </ul>

      <div class="modal-card__actions">
        <button type="button" (click)="cerrarModalSinPagar()" class="btn-secondary">Cancelar</button>
        <button type="button" (click)="_ejecutarCrearTemporada()" [disabled]="saving()" class="btn-primary">
          {{ saving() ? 'Creando...' : 'Crear temporada' }}
        </button>
      </div>
    </div>
  </div>
}
```

- [ ] **Step 6: Añadir estilos al SCSS**

En `lista-temporadas.component.scss`, añadir al final:

```scss
.temporada-item {
  cursor: pointer;

  &__actions {
    @apply flex items-center gap-2;
  }

  &__btn-edit {
    @apply text-[13px] text-gray-400 bg-transparent border-0 p-1 leading-none cursor-pointer;
    &:hover { @apply text-brand-dark; }
  }

  &__btn-delete {
    @apply text-[13px] text-gray-300 bg-transparent border-0 p-1 leading-none cursor-pointer;
    &:hover { @apply text-danger; }
  }
}

.modal-card {
  &--tall {
    max-height: 70vh;
    overflow-y: auto;
  }

  &__header {
    @apply flex items-center justify-between;
  }

  &__close {
    @apply text-gray-400 bg-transparent border-0 text-[16px] cursor-pointer p-1;
  }

  &__subtitle {
    @apply text-[12px] text-gray-400 font-medium mt-[-8px];
  }

  &__empty {
    @apply text-[13px] text-gray-400 text-center py-4;
  }
}

.pendientes-list {
  @apply w-full flex flex-col gap-2 list-none p-0 m-0;

  &__item {
    @apply flex items-center justify-between py-2 border-b border-gray-100 last:border-0;
  }

  &__nombre {
    @apply text-[13px] font-semibold text-brand-dark;
  }

  &__baja-btn {
    @apply text-[11px] font-bold text-danger bg-transparent border border-danger rounded-lg px-2 py-1 cursor-pointer;
    &:hover { @apply bg-red-50; }
  }
}

.cd-icon-wrap {
  width: 52px;
  height: 52px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: center;
}
```

- [ ] **Step 7: Commit**

```bash
git add src/app/features/admin/temporadas/lista-temporadas/lista-temporadas.component.html src/app/features/admin/temporadas/lista-temporadas/lista-temporadas.component.scss
git commit -m "feat(temporadas): add detail sheet, edit sheet, delete confirm, sin-pagar modal"
```

---

## Task 5: Verificación final

- [ ] **Step 1: Verificar círculo de cuota**

En Admin → Socios, el círculo de cuota debe ser visiblemente más grande que antes.

- [ ] **Step 2: Verificar edición de temporada**

En Admin → Temporadas, pulsar el lápiz de una temporada → aparece bottom sheet con nombre y fecha precargados → modificar y guardar → la lista se actualiza.

- [ ] **Step 3: Verificar eliminación de temporada**

Pulsar la papelera de una temporada → aparece confirm dialog con texto "Se eliminarán también todas sus cuotas" → confirmar → la temporada desaparece de la lista.

- [ ] **Step 4: Verificar detalle socios pendientes**

Pulsar sobre el nombre/cuerpo de una temporada → aparece bottom sheet con la lista de socios que no han pagado (o mensaje "Todos han pagado").

- [ ] **Step 5: Verificar modal al crear nueva temporada con socios sin pagar**

Desde Admin → Temporadas, pulsar FAB para crear nueva temporada → si la temporada activa tiene socios sin pagar, aparece el modal de advertencia con la lista y botones de "Dar de baja" → pulsar "Dar de baja" en un socio → desaparece de la lista → pulsar "Crear temporada" → se crea correctamente.

- [ ] **Step 6: Verificar que si no hay socios sin pagar no aparece el modal**

Marcar todos los socios como pagados en la temporada activa y repetir el flujo → el modal no debe aparecer, la temporada se crea directamente.
