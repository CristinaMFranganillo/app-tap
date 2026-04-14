# Config Admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la sección vacía de entrenamientos en la pantalla Config del admin por un resumen útil del club: socios activos, estado de cuotas, entrenamientos recientes y accesos rápidos.

**Architecture:** Se bifurca el template de `perfil.component.html` según el rol del usuario usando un computed `esAdmin`. El admin ve resumen del club; el socio sigue viendo sus entrenamientos. Todos los datos se obtienen de servicios ya existentes (`UserService`, `EntrenamientoService`).

**Tech Stack:** Angular 17 standalone components, signals, computed, Tailwind CSS vía @apply en SCSS, Supabase.

---

## Mapa de archivos

| Acción | Archivo |
|--------|---------|
| Modificar | `src/app/features/perfil/perfil.component.ts` |
| Modificar | `src/app/features/perfil/perfil.component.html` |
| Modificar | `src/app/features/perfil/perfil.component.scss` |

---

### Task 1: Añadir signals de datos del club en perfil.component.ts

Se añaden las cargas de datos solo necesarias para el admin y los computed signals derivados.

**Files:**
- Modify: `src/app/features/perfil/perfil.component.ts`

- [ ] **Step 1: Añadir imports y signals de datos del club**

Abrir `src/app/features/perfil/perfil.component.ts`. Añadir los imports que faltan y los signals al final de los existentes:

```typescript
// Añadir a los imports existentes del archivo:
import { UserService } from '../admin/socios/user.service';
import { Entrenamiento } from '../../core/models/entrenamiento.model';
import { User } from '../../core/models/user.model';
```

En la clase `PerfilComponent`, añadir la inyección de `UserService` y los signals:

```typescript
// Inyecciones (junto a las existentes)
private userService = inject(UserService);

// ── Bifurcación por rol ────────────────────────────────────────
esAdmin = computed(() => {
  const rol = this.user()?.rol;
  return rol === 'admin' || rol === 'moderador';
});

// ── Datos del club (solo admin) ────────────────────────────────
private todosLosSocios = toSignal(
  this.authService.currentUser$.pipe(
    switchMap(u => u && (u.rol === 'admin' || u.rol === 'moderador')
      ? this.userService.getAll()
      : []
    )
  ),
  { initialValue: [] as User[] }
);

private todosLosEntrenamientos = toSignal(
  this.authService.currentUser$.pipe(
    switchMap(u => u && (u.rol === 'admin' || u.rol === 'moderador')
      ? this.entrenamientoService.getAll()
      : []
    )
  ),
  { initialValue: [] as Entrenamiento[] }
);

sociosActivos = computed(() =>
  this.todosLosSocios().filter(s => s.activo)
);

totalActivos = computed(() => this.sociosActivos().length);

cuotaPct = computed(() => {
  const activos = this.sociosActivos();
  if (activos.length === 0) return null;
  if (activos.every(s => s.cuotaPagada === undefined)) return null;
  const pagados = activos.filter(s => s.cuotaPagada === true).length;
  return Math.round((pagados / activos.length) * 100);
});

entrenamientosMes = computed(() => {
  const hoy = new Date();
  return this.todosLosEntrenamientos().filter(e => {
    const d = new Date(e.fecha);
    return d.getFullYear() === hoy.getFullYear() && d.getMonth() === hoy.getMonth();
  }).length;
});

ultimos5 = computed(() =>
  this.todosLosEntrenamientos().slice(0, 5)
);

irSocios(): void {
  this.router.navigate(['/admin/socios']);
}

irTemporadas(): void {
  this.router.navigate(['/admin/temporadas']);
}
```

- [ ] **Step 2: Verificar que compila sin errores**

```bash
cd frontend  # si aplica, o desde la raíz del proyecto Angular
npx ng build --configuration development 2>&1 | tail -20
```

Esperado: sin errores de compilación.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/perfil/perfil.component.ts
git commit -m "feat(perfil): añadir signals de datos del club para admin"
```

---

### Task 2: Actualizar el template HTML para bifurcar por rol

Se envuelve la sección de entrenamientos del socio en `@if (!esAdmin())` y se añade la sección del admin dentro de `@if (esAdmin())`.

**Files:**
- Modify: `src/app/features/perfil/perfil.component.html`

- [ ] **Step 1: Reemplazar la sección de entrenamientos con bifurcación por rol**

Localizar en `perfil.component.html` el bloque que empieza con:
```html
<!-- ── Sección entrenamientos ─────────────────────────────── -->
<div class="perfil-entrena">
```
y termina con su `</div>` de cierre. Reemplazarlo íntegramente por:

```html
<!-- ── Sección según rol ──────────────────────────────────── -->

@if (esAdmin()) {

  <!-- ADMIN: Resumen del club -->
  <div class="perfil-club">

    <h3 class="page-title perfil-club__titulo">Resumen del club</h3>

    <!-- 3 stat cards -->
    <div class="perfil-stats">
      <div class="perfil-stat perfil-stat--border">
        <p class="perfil-stat__value">{{ totalActivos() }}</p>
        <p class="perfil-stat__label">Socios activos</p>
      </div>
      <div class="perfil-stat perfil-stat--border">
        @if (cuotaPct() !== null) {
          <p class="perfil-stat__value">{{ cuotaPct() }}%</p>
        } @else {
          <p class="perfil-stat__value">—</p>
        }
        <p class="perfil-stat__label">Cuota pagada</p>
      </div>
      <div class="perfil-stat">
        <p class="perfil-stat__value">{{ entrenamientosMes() }}</p>
        <p class="perfil-stat__label">Este mes</p>
      </div>
    </div>

    <!-- Últimos entrenamientos -->
    <h3 class="page-title perfil-club__titulo perfil-club__titulo--mt">Últimos entrenamientos</h3>

    @if (ultimos5().length === 0) {
      <app-empty-state icon="bi-bullseye" mensaje="Sin entrenamientos registrados" />
    } @else {
      <div class="perfil-club__entrenamientos">
        @for (e of ultimos5(); track e.id) {
          <div class="perfil-club__entrena-fila card">
            <span class="perfil-club__entrena-fecha">
              <i class="bi bi-calendar3"></i>
              {{ e.fecha | date:'d MMM yyyy' : '' : 'es' }}
            </span>
            <span class="perfil-club__entrena-badge">
              {{ e.numTiradores ?? 0 }} tirador{{ (e.numTiradores ?? 0) !== 1 ? 'es' : '' }}
            </span>
          </div>
        }
      </div>
    }

    <!-- Accesos rápidos -->
    <div class="perfil-club__accesos">
      <button (click)="irSocios()" class="btn-primary perfil-club__acceso-btn">
        <i class="bi bi-people-fill"></i> Gestionar Socios
      </button>
      <button (click)="irTemporadas()" class="perfil-club__acceso-btn perfil-club__acceso-btn--sec">
        <i class="bi bi-calendar-check"></i> Temporadas
      </button>
    </div>

  </div>

} @else {

  <!-- SOCIO: Mis entrenamientos -->
  <div class="perfil-entrena">

    <div class="perfil-entrena__header">
      <h3 class="page-title">Mis Entrenamientos</h3>
      <select
        class="perfil-entrena__anio-select"
        [value]="anioSeleccionado()"
        (change)="anioSeleccionado.set(+$any($event.target).value)"
      >
        @for (a of anios; track a) {
          <option [value]="a">{{ a }}</option>
        }
      </select>
    </div>

    @if (totalEntrenamientos() === 0) {
      <app-empty-state icon="bi-bullseye" mensaje="Sin entrenamientos este año" />
    } @else {

      <div class="perfil-stats perfil-stats--entrena">
        <div class="perfil-stat perfil-stat--border">
          <p class="perfil-stat__value">{{ totalEntrenamientos() }}</p>
          <p class="perfil-stat__label">Sesiones</p>
        </div>
        <div class="perfil-stat perfil-stat--border">
          <p class="perfil-stat__value">{{ mediaEntrenamientos() }}</p>
          <p class="perfil-stat__label">Media</p>
        </div>
        <div class="perfil-stat">
          <p class="perfil-stat__value">{{ mejorResultado() }}</p>
          <p class="perfil-stat__label">Mejor</p>
        </div>
      </div>

      @if (posicionClub(); as pos) {
        <div class="perfil-posicion card">
          <div class="perfil-posicion__puesto">
            <span class="perfil-posicion__num">{{ pos.posicion }}º</span>
            <span class="perfil-posicion__de">de {{ pos.total }}</span>
          </div>
          <div class="perfil-posicion__metas">
            <p class="perfil-posicion__linea">Tu media: <strong>{{ mediaEntrenamientos() }}</strong></p>
            <p class="perfil-posicion__linea">Media club: <strong>{{ mediaClub() }}</strong></p>
          </div>
        </div>
      }

      @if (puntosSvg().dots.length >= 2) {
        <div class="perfil-grafico card">
          <p class="perfil-grafico__titulo">Evolución {{ anioSeleccionado() }}</p>
          <svg class="perfil-grafico__svg" viewBox="0 0 300 80" preserveAspectRatio="none">
            <line x1="8" y1="8" x2="292" y2="8" stroke="#E5E7EB" stroke-width="0.5"/>
            <line x1="8" y1="40" x2="292" y2="40" stroke="#E5E7EB" stroke-width="0.5"/>
            <line x1="8" y1="72" x2="292" y2="72" stroke="#E5E7EB" stroke-width="0.5"/>
            <polyline
              [attr.points]="puntosSvg().points"
              fill="none"
              stroke="#FFAE00"
              stroke-width="2"
              stroke-linejoin="round"
              stroke-linecap="round"
            />
            @for (d of puntosSvg().dots; track $index) {
              <circle [attr.cx]="d.x" [attr.cy]="d.y" r="3" fill="#FFAE00" stroke="white" stroke-width="1.5"/>
            }
          </svg>
          <div class="perfil-grafico__leyenda">
            <span>0</span>
            <span>12</span>
            <span>25</span>
          </div>
        </div>
      }

    }
  </div>

}
```

- [ ] **Step 2: Verificar que `EmptyStateComponent` y `DatePipe` están en el `imports` del componente**

En `perfil.component.ts`, confirmar que `imports` incluye `DatePipe` y `EmptyStateComponent`. Ya deben estar. Si falta alguno, añadirlo.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/perfil/perfil.component.html
git commit -m "feat(perfil): bifurcar template por rol — admin ve resumen del club"
```

---

### Task 3: Añadir estilos SCSS para la sección del admin

**Files:**
- Modify: `src/app/features/perfil/perfil.component.scss`

- [ ] **Step 1: Añadir los estilos de la sección del club al final del archivo**

```scss
// ── Sección club (admin) ───────────────────────────────────────

.perfil-club {
  @apply flex flex-col gap-3 px-3 pb-2;

  &__titulo {
    @apply mt-1;

    &--mt {
      @apply mt-2;
    }
  }

  &__entrenamientos {
    @apply flex flex-col gap-2;
  }

  &__entrena-fila {
    @apply flex items-center justify-between;
  }

  &__entrena-fecha {
    @apply flex items-center gap-2 text-[14px] font-semibold text-secondary;

    i { @apply text-neutral-300; }
  }

  &__entrena-badge {
    @apply text-[12px] font-bold text-neutral-400 bg-neutral-100
           px-2 py-0.5 rounded-full flex-shrink-0;
  }

  &__accesos {
    @apply flex flex-col gap-2 mt-1;
  }

  &__acceso-btn {
    @apply w-full py-3 rounded-[12px] text-[14px] font-bold
           flex items-center justify-center gap-2;

    &--sec {
      @apply bg-white border border-secondary text-secondary;
    }
  }
}
```

- [ ] **Step 2: Verificar visualmente en el navegador**

Iniciar sesión como admin y navegar a `/perfil`. Debe mostrar: hero con avatar, 3 stat cards (Socios activos / Cuota pagada / Este mes), lista de últimos entrenamientos y 2 botones de acceso rápido.

Iniciar sesión como socio y navegar a `/perfil`. Debe mostrar la sección de entrenamientos personales exactamente igual que antes.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/perfil/perfil.component.scss
git commit -m "feat(perfil): estilos sección resumen del club para admin"
```
