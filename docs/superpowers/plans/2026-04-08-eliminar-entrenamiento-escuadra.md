# Eliminar entrenamiento y escuadra Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir eliminar un entrenamiento completo (con todas sus escuadras y datos) o una escuadra individual desde la UI de admin, con confirmación modal.

**Architecture:** Borrado explícito en orden de hijos a padres (fallos → resultados → tiradores → escuadras → entrenamiento) sin depender de CASCADE. Dos puntos de entrada: botón papelera en la tabla de `AdminScoresComponent` para entrenamientos, y botón papelera en cada `escuadra-card` del `DetalleDiaEntrenamientoComponent` en modo edición. Confirmación via `ConfirmDialogComponent` ya existente.

**Tech Stack:** Angular 17+ (signals, standalone components), Supabase JS client, SCSS con Tailwind utilities.

---

## Archivos afectados

| Acción | Archivo |
|--------|---------|
| Modificar | `src/app/features/admin/entrenamientos/entrenamiento.service.ts` |
| Modificar | `src/app/features/scores/escuadra.service.ts` |
| Modificar | `src/app/features/admin/scores/admin-scores/admin-scores.component.ts` |
| Modificar | `src/app/features/admin/scores/admin-scores/admin-scores.component.html` |
| Modificar | `src/app/features/admin/scores/admin-scores/admin-scores.component.scss` |
| Modificar | `src/app/features/admin/entrenamientos/detalle-dia-entrenamiento/detalle-dia-entrenamiento.component.ts` |
| Modificar | `src/app/features/admin/entrenamientos/detalle-dia-entrenamiento/detalle-dia-entrenamiento.component.html` |
| Modificar | `src/app/features/admin/entrenamientos/detalle-dia-entrenamiento/detalle-dia-entrenamiento.component.scss` |

---

## Task 1: Añadir `deleteEntrenamiento` en `EntrenamientoService`

**Files:**
- Modify: `src/app/features/admin/entrenamientos/entrenamiento.service.ts`

- [ ] **Step 1: Añadir el método al servicio**

Al final de la clase `EntrenamientoService`, antes del cierre `}`, añadir:

```typescript
async deleteEntrenamiento(id: string): Promise<void> {
  // 1. Obtener IDs de escuadras del entrenamiento
  const { data: escuadras, error: escuadrasError } = await supabase
    .from('escuadras')
    .select('id')
    .eq('entrenamiento_id', id);
  if (escuadrasError) throw new Error(escuadrasError.message);

  const ids = (escuadras ?? []).map((e: Record<string, unknown>) => e['id'] as string);

  if (ids.length > 0) {
    // 2. Borrar fallos
    const { error: fallosError } = await supabase
      .from('entrenamiento_fallos')
      .delete()
      .in('escuadra_id', ids);
    if (fallosError) throw new Error(fallosError.message);

    // 3. Borrar resultados
    const { error: resultadosError } = await supabase
      .from('resultados_entrenamiento')
      .delete()
      .in('escuadra_id', ids);
    if (resultadosError) throw new Error(resultadosError.message);

    // 4. Borrar tiradores
    const { error: tiradoresError } = await supabase
      .from('escuadra_tiradores')
      .delete()
      .in('escuadra_id', ids);
    if (tiradoresError) throw new Error(tiradoresError.message);

    // 5. Borrar escuadras
    const { error: escuadrasBorrarError } = await supabase
      .from('escuadras')
      .delete()
      .eq('entrenamiento_id', id);
    if (escuadrasBorrarError) throw new Error(escuadrasBorrarError.message);
  }

  // 6. Borrar el entrenamiento
  const { error } = await supabase
    .from('entrenamientos')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/features/admin/entrenamientos/entrenamiento.service.ts
git commit -m "feat(entrenamientos): add deleteEntrenamiento with explicit cascade"
```

---

## Task 2: Añadir `deleteEscuadraEntrenamiento` en `EscuadraService`

**Files:**
- Modify: `src/app/features/scores/escuadra.service.ts`

- [ ] **Step 1: Añadir el método al servicio**

Al final de la clase `EscuadraService`, antes del cierre `}`, añadir:

```typescript
async deleteEscuadraEntrenamiento(id: string): Promise<void> {
  // 1. Borrar fallos
  const { error: fallosError } = await supabase
    .from('entrenamiento_fallos')
    .delete()
    .eq('escuadra_id', id);
  if (fallosError) throw new Error(fallosError.message);

  // 2. Borrar resultados
  const { error: resultadosError } = await supabase
    .from('resultados_entrenamiento')
    .delete()
    .eq('escuadra_id', id);
  if (resultadosError) throw new Error(resultadosError.message);

  // 3. Borrar tiradores
  const { error: tiradoresError } = await supabase
    .from('escuadra_tiradores')
    .delete()
    .eq('escuadra_id', id);
  if (tiradoresError) throw new Error(tiradoresError.message);

  // 4. Borrar la escuadra
  const { error } = await supabase
    .from('escuadras')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/features/scores/escuadra.service.ts
git commit -m "feat(escuadras): add deleteEscuadraEntrenamiento with explicit cascade"
```

---

## Task 3: Eliminar entrenamiento desde `AdminScoresComponent`

**Files:**
- Modify: `src/app/features/admin/scores/admin-scores/admin-scores.component.ts`
- Modify: `src/app/features/admin/scores/admin-scores/admin-scores.component.html`
- Modify: `src/app/features/admin/scores/admin-scores/admin-scores.component.scss`

### Step 1: Actualizar el componente TS

- [ ] **Step 1a: Cambiar el import y añadir Subject de refresh**

El archivo completo debe quedar así (reemplazar contenido):

```typescript
import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subject, switchMap, startWith } from 'rxjs';
import { CompeticionService } from '../../../scores/competicion.service';
import { EntrenamientoService } from '../../entrenamientos/entrenamiento.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { Competicion } from '../../../../core/models/competicion.model';
import { EntrenamientoDia } from '../../../../core/models/entrenamiento.model';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-admin-scores',
  standalone: true,
  imports: [DatePipe, FormsModule, ConfirmDialogComponent],
  templateUrl: './admin-scores.component.html',
  styleUrl: './admin-scores.component.scss',
})
export class AdminScoresComponent {
  private competicionService = inject(CompeticionService);
  private entrenamientoService = inject(EntrenamientoService);
  private authService = inject(AuthService);
  private router = inject(Router);

  private refresh$ = new Subject<void>();

  competiciones = toSignal(this.competicionService.getAll(), { initialValue: [] as Competicion[] });
  entrenamientos = toSignal(
    this.refresh$.pipe(startWith(null), switchMap(() => this.entrenamientoService.getAllAgrupado())),
    { initialValue: [] as EntrenamientoDia[] }
  );

  // Inline date picker state
  mostrarPicker = signal(false);
  fechaNueva = signal(new Date().toISOString().split('T')[0]);
  creando = signal(false);
  errorCrear = signal('');

  // Delete state
  pendingDeleteFecha = signal<string | null>(null);
  eliminando = signal(false);
  errorEliminar = signal('');

  abrirPicker(): void {
    this.fechaNueva.set(new Date().toISOString().split('T')[0]);
    this.errorCrear.set('');
    this.mostrarPicker.set(true);
  }

  cancelarPicker(): void {
    this.mostrarPicker.set(false);
  }

  async confirmarEntrenamiento(): Promise<void> {
    this.creando.set(true);
    this.errorCrear.set('');
    try {
      const user = await firstValueFrom(this.authService.currentUser$);
      if (!user) throw new Error('No autenticado');
      const id = await this.entrenamientoService.create(this.fechaNueva(), user.id);
      this.mostrarPicker.set(false);
      this.router.navigate(['/admin/entrenamientos', id]);
    } catch (err) {
      this.errorCrear.set(err instanceof Error ? err.message : 'Error al crear');
    } finally {
      this.creando.set(false);
    }
  }

  verEntrenamiento(fecha: string): void {
    this.router.navigate(['/admin/entrenamientos/dia', fecha]);
  }

  editarEntrenamiento(fecha: string): void {
    this.router.navigate(['/admin/entrenamientos/dia', fecha], { queryParams: { modo: 'editar' } });
  }

  confirmarEliminarEntrenamiento(fecha: string): void {
    this.errorEliminar.set('');
    this.pendingDeleteFecha.set(fecha);
  }

  cancelarEliminarEntrenamiento(): void {
    this.pendingDeleteFecha.set(null);
  }

  async eliminarEntrenamiento(): Promise<void> {
    const fecha = this.pendingDeleteFecha();
    if (!fecha) return;
    const dia = this.entrenamientos().find(e => e.fecha === fecha);
    if (!dia) return;

    this.eliminando.set(true);
    this.errorEliminar.set('');
    this.pendingDeleteFecha.set(null);
    try {
      for (const id of dia.ids) {
        await this.entrenamientoService.deleteEntrenamiento(id);
      }
      this.refresh$.next();
    } catch (err) {
      this.errorEliminar.set(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      this.eliminando.set(false);
    }
  }

  nuevaCompeticion(): void {
    this.router.navigate(['/admin/competiciones/nueva']);
  }

  totalPlatos(c: Competicion): number {
    return c.platosPorSerie * c.numSeries;
  }
}
```

- [ ] **Step 1b: Actualizar el HTML**

Reemplazar el contenido de `admin-scores.component.html`:

```html
<div class="admin-scores">

  <!-- ── ENTRENAMIENTOS (sección principal) ───────────────────── -->
  <section class="admin-scores__section">
    <h2 class="admin-scores__section-title">Entrenamientos</h2>

    @if (!mostrarPicker()) {
      <button (click)="abrirPicker()" class="admin-scores__btn-primary">
        <i class="bi bi-plus-circle admin-scores__btn-primary-icon"></i>
        <span>Nuevo entrenamiento</span>
      </button>
    } @else {
      <div class="admin-scores__picker">
        <label class="form-label">Fecha del entrenamiento</label>
        <input
          type="date"
          [ngModel]="fechaNueva()"
          (ngModelChange)="fechaNueva.set($event)"
          class="form-input"
        />
        @if (errorCrear()) {
          <p class="admin-scores__picker-error">{{ errorCrear() }}</p>
        }
        <div class="admin-scores__picker-actions">
          <button (click)="cancelarPicker()" class="btn-secondary">Cancelar</button>
          <button (click)="confirmarEntrenamiento()" [disabled]="creando()" class="btn-primary">
            {{ creando() ? 'Creando...' : 'Crear' }}
          </button>
        </div>
      </div>
    }

    @if (errorEliminar()) {
      <p class="admin-scores__picker-error">{{ errorEliminar() }}</p>
    }

    @if (entrenamientos().length === 0) {
      <div class="admin-scores__empty">
        <i class="bi bi-bullseye admin-scores__empty-icon"></i>
        <p class="admin-scores__empty-title">Sin entrenamientos</p>
        <p class="admin-scores__empty-subtitle">Crea el primero con el botón de arriba</p>
      </div>
    } @else {
      <div class="entrena-tabla">
        <!-- Cabecera -->
        <div class="entrena-tabla__head">
          <span class="entrena-tabla__th entrena-tabla__th--fecha">Entrenamientos</span>
          <span class="entrena-tabla__th entrena-tabla__th--num">Esc.</span>
          <span class="entrena-tabla__th entrena-tabla__th--num">Tir.</span>
          <span class="entrena-tabla__th entrena-tabla__th--acciones">Acciones</span>
        </div>
        <!-- Filas (una por día) -->
        @for (e of entrenamientos(); track e.fecha) {
          <div class="entrena-tabla__row">
            <span class="entrena-tabla__td entrena-tabla__td--fecha">
              {{ e.fecha | date:'d MMM yy' : '' : 'es' }}
            </span>
            <span class="entrena-tabla__td entrena-tabla__td--num">{{ e.numEscuadras }}</span>
            <span class="entrena-tabla__td entrena-tabla__td--num">{{ e.numTiradores }}</span>
            <span class="entrena-tabla__td entrena-tabla__td--acciones">
              <button (click)="verEntrenamiento(e.fecha)" class="entrena-tabla__btn" title="Ver resultados">
                <i class="bi bi-eye"></i>
              </button>
              <button (click)="editarEntrenamiento(e.fecha)" class="entrena-tabla__btn" title="Editar">
                <i class="bi bi-pencil-square"></i>
              </button>
              <button (click)="confirmarEliminarEntrenamiento(e.fecha)" class="entrena-tabla__btn entrena-tabla__btn--danger" title="Eliminar" [disabled]="eliminando()">
                <i class="bi bi-trash"></i>
              </button>
            </span>
          </div>
        }
      </div>
    }
  </section>

  <!-- ── COMPETICIONES (oculto temporalmente, pendiente de implementar) ───
  <section class="admin-scores__section admin-scores__section--secondary">
    ...
  </section>
  ─────────────────────────────────────────────────────────────────────── -->

</div>

@if (pendingDeleteFecha()) {
  <app-confirm-dialog
    titulo="Eliminar entrenamiento"
    [mensaje]="'¿Seguro que quieres eliminar el entrenamiento del día ' + (pendingDeleteFecha() | date:'d MMM yyyy' : '' : 'es') + '? Se borrarán todas las escuadras y resultados. Esta acción no se puede deshacer.'"
    labelConfirmar="Eliminar"
    (confirmado)="eliminarEntrenamiento()"
    (cancelado)="cancelarEliminarEntrenamiento()"
  />
}
```

- [ ] **Step 1c: Añadir estilo del botón danger en el SCSS**

En `admin-scores.component.scss`, dentro del bloque `&__btn`, añadir la variante danger al final del bloque `.entrena-tabla`:

```scss
  &__btn {
    @apply bg-transparent border-0 p-1 cursor-pointer
           text-neutral-400 text-[18px] leading-none
           active:text-secondary transition-colors;

    &--danger {
      @apply text-danger active:text-red-700;
    }
  }
```

- [ ] **Step 2: Verificar en el navegador**

Arrancar el servidor de desarrollo:
```bash
cd frontend && npm run dev
```
Navegar a `http://localhost:5173/generador-scorm/` → admin → scores. Verificar que aparece el icono de papelera en cada fila, que al hacer clic aparece la modal, que "Cancelar" la cierra sin hacer nada, y que "Eliminar" borra el entrenamiento y refresca la lista.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/admin/scores/admin-scores/admin-scores.component.ts \
        src/app/features/admin/scores/admin-scores/admin-scores.component.html \
        src/app/features/admin/scores/admin-scores/admin-scores.component.scss
git commit -m "feat(admin-scores): add delete entrenamiento with confirm dialog"
```

---

## Task 4: Eliminar escuadra desde `DetalleDiaEntrenamientoComponent`

**Files:**
- Modify: `src/app/features/admin/entrenamientos/detalle-dia-entrenamiento/detalle-dia-entrenamiento.component.ts`
- Modify: `src/app/features/admin/entrenamientos/detalle-dia-entrenamiento/detalle-dia-entrenamiento.component.html`
- Modify: `src/app/features/admin/entrenamientos/detalle-dia-entrenamiento/detalle-dia-entrenamiento.component.scss`

### Step 1: Actualizar el componente TS

- [ ] **Step 1a: Reemplazar el componente TS completo**

```typescript
import { Component, inject, signal, effect } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap, startWith } from 'rxjs';
import { Subject, firstValueFrom } from 'rxjs';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { EntrenamientoService } from '../entrenamiento.service';
import { EscuadraService } from '../../../../features/scores/escuadra.service';
import { UserService } from '../../socios/user.service';
import { Entrenamiento, ResultadoEntrenamiento } from '../../../../core/models/entrenamiento.model';
import { Escuadra } from '../../../../core/models/escuadra.model';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

interface FilaResultado {
  puesto: number;
  nombre: string;
  platosRotos: number;
}

interface EscuadraConResultados {
  escuadra: Escuadra;
  entrenamientoId: string;
  filas: FilaResultado[];
  total: number;
  cargando: boolean;
}

@Component({
  selector: 'app-detalle-dia-entrenamiento',
  standalone: true,
  imports: [DatePipe, TitleCasePipe, EmptyStateComponent, ConfirmDialogComponent],
  templateUrl: './detalle-dia-entrenamiento.component.html',
  styleUrl: './detalle-dia-entrenamiento.component.scss',
})
export class DetalleDiaEntrenamientoComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private entrenamientoService = inject(EntrenamientoService);
  private escuadraService = inject(EscuadraService);
  private userService = inject(UserService);

  fecha = this.route.snapshot.paramMap.get('fecha')!;
  modoEdicion = this.route.snapshot.queryParamMap.get('modo') === 'editar';

  private refresh$ = new Subject<void>();

  private entrenamientosDelDia = toSignal(
    this.refresh$.pipe(
      startWith(null),
      switchMap(() => this.entrenamientoService.getByFecha(this.fecha))
    ),
    { initialValue: [] as Entrenamiento[] }
  );

  escuadrasConResultados = signal<EscuadraConResultados[]>([]);

  // Delete state
  pendingDeleteEscuadraId = signal<string | null>(null);
  eliminando = signal(false);
  errorEliminar = signal('');

  constructor() {
    effect(async () => {
      const entrenamientos = this.entrenamientosDelDia();
      if (entrenamientos.length === 0) {
        this.escuadrasConResultados.set([]);
        return;
      }

      const escuadrasPorEntrenamiento = await Promise.all(
        entrenamientos.map(e =>
          firstValueFrom(this.escuadraService.getByEntrenamiento(e.id))
            .then(escuadras => escuadras.map(esc => ({ ...esc, entrenamientoId: e.id })))
        )
      );
      const todasEscuadras = escuadrasPorEntrenamiento.flat();

      if (todasEscuadras.length === 0) {
        this.escuadrasConResultados.set([]);
        return;
      }

      this.escuadrasConResultados.set(
        todasEscuadras.map(e => ({ escuadra: e, entrenamientoId: e.entrenamientoId, filas: [], total: 0, cargando: true }))
      );

      const socios = await firstValueFrom(this.userService.getAll());

      const resultados = await Promise.all(
        todasEscuadras.map(e =>
          firstValueFrom(this.entrenamientoService.getResultadosByEscuadra(e.id))
        )
      );

      this.escuadrasConResultados.set(
        todasEscuadras.map((e, i) => {
          const filas: FilaResultado[] = (resultados[i] as ResultadoEntrenamiento[])
            .map(r => {
              const socio = socios.find(s => s.id === r.userId);
              return {
                puesto: r.puesto,
                nombre: socio ? `${socio.nombre} ${socio.apellidos}` : r.userId,
                platosRotos: r.platosRotos,
              };
            })
            .sort((a, b) => a.puesto - b.puesto);

          return {
            escuadra: e,
            entrenamientoId: e.entrenamientoId,
            filas,
            total: filas.reduce((s, f) => s + f.platosRotos, 0),
            cargando: false,
          };
        })
      );
    });
  }

  irResultados(entrenamientoId: string, escuadraId: string): void {
    this.router.navigate([
      '/admin/entrenamientos', entrenamientoId,
      'escuadra', escuadraId, 'resultados',
    ], { queryParams: { fecha: this.fecha } });
  }

  nuevaEscuadra(): void {
    const primero = this.entrenamientosDelDia()[0];
    if (primero) {
      this.router.navigate(['/admin/entrenamientos', primero.id, 'escuadra', 'nueva']);
    }
  }

  confirmarEliminarEscuadra(id: string): void {
    this.errorEliminar.set('');
    this.pendingDeleteEscuadraId.set(id);
  }

  cancelarEliminarEscuadra(): void {
    this.pendingDeleteEscuadraId.set(null);
  }

  async eliminarEscuadra(): Promise<void> {
    const id = this.pendingDeleteEscuadraId();
    if (!id) return;
    this.eliminando.set(true);
    this.errorEliminar.set('');
    this.pendingDeleteEscuadraId.set(null);
    try {
      await this.escuadraService.deleteEscuadraEntrenamiento(id);
      this.refresh$.next();
    } catch (err) {
      this.errorEliminar.set(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      this.eliminando.set(false);
    }
  }

  goBack(): void {
    this.router.navigate(['/admin/scores']);
  }
}
```

- [ ] **Step 1b: Actualizar el HTML**

Reemplazar el contenido de `detalle-dia-entrenamiento.component.html`:

```html
<div class="detalle-dia">
  <div class="page-header">
    <button (click)="goBack()" class="detalle-dia__back-btn">
      <i class="bi bi-chevron-left"></i>
    </button>
    <h2 class="detalle-dia__title">
      {{ fecha | date:'EEEE d MMM yyyy' : '' : 'es' | titlecase }}
    </h2>
  </div>

  @if (errorEliminar()) {
    <p class="detalle-dia__error">{{ errorEliminar() }}</p>
  }

  @if (escuadrasConResultados().length === 0) {
    <app-empty-state icon="bi-people" mensaje="Sin escuadras todavía" />
  } @else {
    @for (item of escuadrasConResultados(); track item.escuadra.id) {
      <div class="escuadra-card card">

        <!-- Cabecera -->
        <div class="escuadra-card__header">
          <div class="escuadra-card__header-info">
            <p class="escuadra-card__titulo">Escuadra {{ item.escuadra.numero }}</p>
            @if (!item.cargando) {
              <p class="escuadra-card__meta">
                {{ item.filas.length }} tirador{{ item.filas.length !== 1 ? 'es' : '' }}
                @if (item.filas.length > 0) {
                  &nbsp;·&nbsp; {{ item.total }}/{{ item.filas.length * 25 }} platos
                }
              </p>
            }
          </div>
          @if (modoEdicion) {
            <div class="escuadra-card__acciones">
              <button (click)="irResultados(item.entrenamientoId, item.escuadra.id)" class="escuadra-card__btn-editar">
                <i class="bi bi-pencil-square"></i>
              </button>
              <button (click)="confirmarEliminarEscuadra(item.escuadra.id)" class="escuadra-card__btn-eliminar" [disabled]="eliminando()">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          }
        </div>

        <!-- Resultados -->
        @if (item.cargando) {
          <p class="escuadra-card__cargando">Cargando resultados...</p>
        } @else if (item.filas.length === 0) {
          <p class="escuadra-card__sin-resultados">Sin resultados registrados</p>
        } @else {
          <div class="escuadra-card__resultados">
            @for (fila of item.filas; track fila.puesto) {
              <div class="resultado-fila">
                <span class="resultado-fila__puesto">{{ fila.puesto }}</span>
                <span class="resultado-fila__nombre">{{ fila.nombre }}</span>
                <span class="resultado-fila__rotos"
                  [class.resultado-fila__rotos--bueno]="fila.platosRotos >= 20"
                  [class.resultado-fila__rotos--malo]="fila.platosRotos < 15">
                  {{ fila.platosRotos }}/25
                </span>
              </div>
            }
          </div>
        }

      </div>
    }
  }

  @if (modoEdicion) {
    <button (click)="nuevaEscuadra()" class="fab">
      <i class="bi bi-plus-lg"></i>
    </button>
  }
</div>

@if (pendingDeleteEscuadraId()) {
  <app-confirm-dialog
    titulo="Eliminar escuadra"
    mensaje="¿Seguro que quieres eliminar esta escuadra? Se borrarán todos sus resultados y fallos. Esta acción no se puede deshacer."
    labelConfirmar="Eliminar"
    (confirmado)="eliminarEscuadra()"
    (cancelado)="cancelarEliminarEscuadra()"
  />
}
```

- [ ] **Step 1c: Añadir estilos al SCSS**

En `detalle-dia-entrenamiento.component.scss`, añadir dentro del bloque `.escuadra-card` las clases nuevas, y el error inline:

```scss
.detalle-dia {
  @apply p-3 flex flex-col gap-3;

  &__back-btn { @apply text-gray-400; }
  &__title { @apply text-[18px] font-extrabold text-secondary capitalize; }
  &__error { @apply text-danger text-sm font-semibold px-1; }
}

.escuadra-card {
  @apply flex flex-col gap-2 p-0 overflow-hidden;

  &__header {
    @apply flex items-center justify-between px-4 pt-4 pb-2;
  }

  &__header-info { @apply flex-1 min-w-0; }

  &__titulo { @apply text-base font-bold text-secondary; }

  &__meta { @apply text-sm text-neutral-400 font-medium mt-0.5; }

  &__acciones {
    @apply flex items-center gap-1 flex-shrink-0;
  }

  &__btn-editar {
    @apply bg-transparent border-0 text-neutral-300 text-[18px] p-1 cursor-pointer
           active:text-secondary transition-colors flex-shrink-0;
  }

  &__btn-eliminar {
    @apply bg-transparent border-0 text-danger text-[18px] p-1 cursor-pointer
           active:text-red-700 transition-colors flex-shrink-0;
  }

  &__cargando { @apply text-sm text-neutral-400 font-medium px-4 pb-3; }

  &__sin-resultados { @apply text-sm text-neutral-400 font-medium italic px-4 pb-3; }

  &__resultados { @apply flex flex-col divide-y divide-neutral-100; }
}

.resultado-fila {
  @apply flex items-center gap-3 px-4 py-2.5;

  &__puesto { @apply w-5 text-center text-sm font-bold text-neutral-400 flex-shrink-0; }

  &__nombre { @apply flex-1 text-sm font-semibold text-secondary truncate; }

  &__rotos {
    @apply text-sm font-extrabold text-secondary flex-shrink-0;
    &--bueno { @apply text-success; }
    &--malo  { @apply text-danger; }
  }
}
```

- [ ] **Step 2: Verificar en el navegador**

Navegar a un entrenamiento en modo edición (`/admin/entrenamientos/dia/{fecha}?modo=editar`). Verificar que aparece el icono papelera rojo junto al lápiz en cada escuadra, que la modal aparece al hacer clic, que "Cancelar" la cierra sin hacer nada, y que "Eliminar" borra la escuadra y refresca la lista.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/admin/entrenamientos/detalle-dia-entrenamiento/detalle-dia-entrenamiento.component.ts \
        src/app/features/admin/entrenamientos/detalle-dia-entrenamiento/detalle-dia-entrenamiento.component.html \
        src/app/features/admin/entrenamientos/detalle-dia-entrenamiento/detalle-dia-entrenamiento.component.scss
git commit -m "feat(detalle-dia): add delete escuadra with confirm dialog"
```
