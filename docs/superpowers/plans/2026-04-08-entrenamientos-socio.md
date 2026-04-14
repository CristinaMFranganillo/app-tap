# Entrenamientos Socio en /scores — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir una pestaña "Entrenamientos" en la sección /scores del socio que muestre los entrenamientos en los que participó y, al pulsar uno, sus platos fallados.

**Architecture:** Se crea un componente shell `scores-shell` que envuelve las rutas hijas de /scores con tabs de navegación. Se añaden dos componentes nuevos: lista de entrenamientos del socio y detalle con platos fallados. Las rutas existentes pasan a ser hijas del shell.

**Tech Stack:** Angular 17 standalone components, signals, Tailwind CSS vía clases @apply en SCSS, Supabase.

---

## Mapa de archivos

| Acción | Archivo |
|--------|---------|
| Crear | `src/app/features/scores/scores-shell/scores-shell.component.ts` |
| Crear | `src/app/features/scores/scores-shell/scores-shell.component.html` |
| Crear | `src/app/features/scores/scores-shell/scores-shell.component.scss` |
| Crear | `src/app/features/scores/entrenamiento-socio-lista/entrenamiento-socio-lista.component.ts` |
| Crear | `src/app/features/scores/entrenamiento-socio-lista/entrenamiento-socio-lista.component.html` |
| Crear | `src/app/features/scores/entrenamiento-socio-lista/entrenamiento-socio-lista.component.scss` |
| Crear | `src/app/features/scores/entrenamiento-socio-detalle/entrenamiento-socio-detalle.component.ts` |
| Crear | `src/app/features/scores/entrenamiento-socio-detalle/entrenamiento-socio-detalle.component.html` |
| Crear | `src/app/features/scores/entrenamiento-socio-detalle/entrenamiento-socio-detalle.component.scss` |
| Modificar | `src/app/features/scores/scores.routes.ts` |

---

### Task 1: Crear scores-shell con tabs de navegación

El shell es un contenedor con 3 tabs (Ranking / Historial / Entrenamientos) y un `<router-outlet>` para los hijos.

**Files:**
- Create: `src/app/features/scores/scores-shell/scores-shell.component.ts`
- Create: `src/app/features/scores/scores-shell/scores-shell.component.html`
- Create: `src/app/features/scores/scores-shell/scores-shell.component.scss`

- [ ] **Step 1: Crear el componente TypeScript**

```typescript
// src/app/features/scores/scores-shell/scores-shell.component.ts
import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-scores-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './scores-shell.component.html',
  styleUrl: './scores-shell.component.scss',
})
export class ScoresShellComponent {}
```

- [ ] **Step 2: Crear el template HTML**

```html
<!-- src/app/features/scores/scores-shell/scores-shell.component.html -->
<div class="scores-shell">
  <div class="scores-shell__tabs">
    <a
      routerLink="/scores"
      routerLinkActive="scores-shell__tab--active"
      [routerLinkActiveOptions]="{ exact: true }"
      class="scores-shell__tab"
    >Ranking</a>
    <a
      routerLink="/scores/historial"
      routerLinkActive="scores-shell__tab--active"
      class="scores-shell__tab"
    >Historial</a>
    <a
      routerLink="/scores/entrenamientos"
      routerLinkActive="scores-shell__tab--active"
      class="scores-shell__tab"
    >Entrenamientos</a>
  </div>
  <router-outlet />
</div>
```

- [ ] **Step 3: Crear los estilos SCSS**

```scss
// src/app/features/scores/scores-shell/scores-shell.component.scss
.scores-shell {
  @apply flex flex-col h-full;

  &__tabs {
    @apply flex border-b border-neutral-100 bg-white px-3;
  }

  &__tab {
    @apply flex-1 text-center py-3 text-[13px] font-semibold text-neutral-400
           border-b-2 border-transparent transition-colors;

    &--active {
      @apply text-secondary border-secondary;
    }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/features/scores/scores-shell/
git commit -m "feat(scores): crear scores-shell con tabs de navegación"
```

---

### Task 2: Actualizar scores.routes.ts para usar el shell

Las rutas existentes pasan a ser hijas del shell. Se añaden las dos rutas nuevas.

**Files:**
- Modify: `src/app/features/scores/scores.routes.ts`

- [ ] **Step 1: Reescribir el archivo de rutas**

```typescript
// src/app/features/scores/scores.routes.ts
import { Routes } from '@angular/router';

export const scoresRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./scores-shell/scores-shell.component').then(m => m.ScoresShellComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./ranking/scores-ranking.component').then(m => m.ScoresRankingComponent),
      },
      {
        path: 'historial',
        loadComponent: () =>
          import('./historial/scores-historial.component').then(m => m.ScoresHistorialComponent),
      },
      {
        path: 'entrenamientos',
        loadComponent: () =>
          import('./entrenamiento-socio-lista/entrenamiento-socio-lista.component')
            .then(m => m.EntrenamientoSocioListaComponent),
      },
      {
        path: 'entrenamientos/:escuadraId',
        loadComponent: () =>
          import('./entrenamiento-socio-detalle/entrenamiento-socio-detalle.component')
            .then(m => m.EntrenamientoSocioDetalleComponent),
      },
    ],
  },
];
```

- [ ] **Step 2: Verificar en el navegador que /scores y /scores/historial siguen funcionando**

Abrir `http://localhost:4200/scores` y `http://localhost:4200/scores/historial`. Deben mostrar el contenido previo con los 3 tabs visibles en la cabecera.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/scores/scores.routes.ts
git commit -m "feat(scores): reorganizar rutas con scores-shell como contenedor"
```

---

### Task 3: Crear entrenamiento-socio-lista

Lista de entrenamientos del socio logueado, ordenados por fecha descendente. Al pulsar navega al detalle pasando fecha y platosRotos como query params.

**Files:**
- Create: `src/app/features/scores/entrenamiento-socio-lista/entrenamiento-socio-lista.component.ts`
- Create: `src/app/features/scores/entrenamiento-socio-lista/entrenamiento-socio-lista.component.html`
- Create: `src/app/features/scores/entrenamiento-socio-lista/entrenamiento-socio-lista.component.scss`

- [ ] **Step 1: Crear el componente TypeScript**

```typescript
// src/app/features/scores/entrenamiento-socio-lista/entrenamiento-socio-lista.component.ts
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../../core/auth/auth.service';
import { EntrenamientoService } from '../../admin/entrenamientos/entrenamiento.service';
import { ResultadoEntrenamientoConFecha } from '../../../core/models/entrenamiento.model';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-entrenamiento-socio-lista',
  standalone: true,
  imports: [DatePipe, EmptyStateComponent],
  templateUrl: './entrenamiento-socio-lista.component.html',
  styleUrl: './entrenamiento-socio-lista.component.scss',
})
export class EntrenamientoSocioListaComponent {
  private auth = inject(AuthService);
  private entrenamientoService = inject(EntrenamientoService);
  private router = inject(Router);

  private anio = new Date().getFullYear();

  entrenamientos = toSignal(
    this.auth.currentUser$.pipe(
      switchMap(user =>
        this.entrenamientoService.getByUser(user?.id ?? '', this.anio)
      )
    ),
    { initialValue: [] as ResultadoEntrenamientoConFecha[] }
  );

  irDetalle(e: ResultadoEntrenamientoConFecha): void {
    this.router.navigate(
      ['/scores/entrenamientos', e.escuadraId],
      { queryParams: { fecha: e.fecha, platosRotos: e.platosRotos } }
    );
  }
}
```

- [ ] **Step 2: Crear el template HTML**

```html
<!-- src/app/features/scores/entrenamiento-socio-lista/entrenamiento-socio-lista.component.html -->
<div class="entrena-lista">
  @if (entrenamientos().length === 0) {
    <app-empty-state icon="bi-bullseye" mensaje="Sin entrenamientos registrados" />
  } @else {
    @for (e of entrenamientos(); track e.escuadraId) {
      <button type="button" class="entrena-lista__item card" (click)="irDetalle(e)">
        <div class="entrena-lista__fecha">
          <i class="bi bi-calendar3"></i>
          {{ e.fecha | date:'d MMM yyyy' : '' : 'es' }}
        </div>
        <div class="entrena-lista__resultado"
          [class.entrena-lista__resultado--bueno]="e.platosRotos >= 20"
          [class.entrena-lista__resultado--malo]="e.platosRotos < 15">
          {{ e.platosRotos }}/25
        </div>
      </button>
    }
  }
</div>
```

- [ ] **Step 3: Crear los estilos SCSS**

```scss
// src/app/features/scores/entrenamiento-socio-lista/entrenamiento-socio-lista.component.scss
.entrena-lista {
  @apply p-3 flex flex-col gap-3;

  &__item {
    @apply flex items-center justify-between w-full text-left cursor-pointer
           active:opacity-70 transition-opacity;
  }

  &__fecha {
    @apply flex items-center gap-2 text-[14px] font-semibold text-secondary;

    i { @apply text-neutral-300; }
  }

  &__resultado {
    @apply text-[16px] font-black text-secondary flex-shrink-0;

    &--bueno { @apply text-success; }
    &--malo  { @apply text-danger; }
  }
}
```

- [ ] **Step 4: Verificar en el navegador que /scores/entrenamientos muestra la lista**

Navegar a `http://localhost:4200/scores/entrenamientos`. Si el socio tiene entrenamientos deben aparecer; si no, el empty state.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/scores/entrenamiento-socio-lista/
git commit -m "feat(scores): lista de entrenamientos del socio"
```

---

### Task 4: Crear entrenamiento-socio-detalle

Detalle de un entrenamiento: muestra la fecha, el resultado y las pills rojas con los platos fallados del socio logueado.

**Files:**
- Create: `src/app/features/scores/entrenamiento-socio-detalle/entrenamiento-socio-detalle.component.ts`
- Create: `src/app/features/scores/entrenamiento-socio-detalle/entrenamiento-socio-detalle.component.html`
- Create: `src/app/features/scores/entrenamiento-socio-detalle/entrenamiento-socio-detalle.component.scss`

- [ ] **Step 1: Crear el componente TypeScript**

```typescript
// src/app/features/scores/entrenamiento-socio-detalle/entrenamiento-socio-detalle.component.ts
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../../core/auth/auth.service';
import { EntrenamientoService } from '../../admin/entrenamientos/entrenamiento.service';

@Component({
  selector: 'app-entrenamiento-socio-detalle',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './entrenamiento-socio-detalle.component.html',
  styleUrl: './entrenamiento-socio-detalle.component.scss',
})
export class EntrenamientoSocioDetalleComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);
  private entrenamientoService = inject(EntrenamientoService);

  // Datos del encabezado vía query params (evita query extra)
  fecha = this.route.snapshot.queryParamMap.get('fecha') ?? '';
  platosRotos = Number(this.route.snapshot.queryParamMap.get('platosRotos') ?? 0);
  escuadraId = this.route.snapshot.paramMap.get('escuadraId')!;

  fallos = signal<number[]>([]);

  constructor() {
    const userId = this.auth.currentUser?.id;
    if (userId && this.escuadraId) {
      firstValueFrom(
        this.entrenamientoService.getFallosByEscuadra(this.escuadraId)
      ).then(todos => {
        const mios = todos
          .filter(f => f.userId === userId)
          .map(f => f.numeroPlato)
          .sort((a, b) => a - b);
        this.fallos.set(mios);
      });
    }
  }

  goBack(): void {
    this.router.navigate(['/scores/entrenamientos']);
  }
}
```

- [ ] **Step 2: Crear el template HTML**

```html
<!-- src/app/features/scores/entrenamiento-socio-detalle/entrenamiento-socio-detalle.component.html -->
<div class="entrena-detalle">

  <div class="page-header">
    <button (click)="goBack()" class="entrena-detalle__back-btn">
      <i class="bi bi-chevron-left"></i>
    </button>
    <h2 class="entrena-detalle__title">
      {{ fecha | date:'d MMM yyyy' : '' : 'es' }}
    </h2>
  </div>

  <div class="card entrena-detalle__card">

    <div class="entrena-detalle__resultado"
      [class.entrena-detalle__resultado--bueno]="platosRotos >= 20"
      [class.entrena-detalle__resultado--malo]="platosRotos < 15">
      {{ platosRotos }}/25
    </div>
    <p class="entrena-detalle__label">platos rotos</p>

    <div class="entrena-detalle__fallos-titulo">
      @if (fallos().length === 0) {
        <p class="entrena-detalle__sin-fallos">Sin fallos registrados</p>
      } @else {
        <p class="entrena-detalle__fallos-label">Platos fallados</p>
        <div class="entrena-detalle__pills">
          @for (n of fallos(); track n) {
            <span class="fallo-pill">{{ n }}</span>
          }
        </div>
      }
    </div>

  </div>

</div>
```

- [ ] **Step 3: Crear los estilos SCSS**

```scss
// src/app/features/scores/entrenamiento-socio-detalle/entrenamiento-socio-detalle.component.scss
.entrena-detalle {
  @apply p-3 flex flex-col gap-3;

  &__back-btn { @apply text-gray-400; }

  &__title { @apply text-[18px] font-bold text-secondary; }

  &__card {
    @apply flex flex-col items-center gap-1 py-6;
  }

  &__resultado {
    @apply text-[48px] font-black text-secondary leading-none;

    &--bueno { @apply text-success; }
    &--malo  { @apply text-danger; }
  }

  &__label {
    @apply text-[13px] font-medium text-neutral-400 mb-4;
  }

  &__fallos-titulo {
    @apply w-full px-2 flex flex-col items-center gap-3;
  }

  &__sin-fallos {
    @apply text-[13px] text-neutral-400 italic;
  }

  &__fallos-label {
    @apply text-[12px] font-bold text-neutral-400 uppercase tracking-wide;
  }

  &__pills {
    @apply flex flex-wrap justify-center gap-2;
  }
}

.fallo-pill {
  @apply inline-flex items-center justify-center
         w-7 h-7 rounded-full
         bg-red-50 text-danger
         text-[13px] font-bold leading-none flex-shrink-0;
}
```

- [ ] **Step 4: Verificar en el navegador**

Desde la lista de entrenamientos, pulsar una tarjeta. Debe navegar al detalle mostrando la fecha, resultado y pills rojas con los fallos. Si no hay fallos, "Sin fallos registrados".

- [ ] **Step 5: Commit**

```bash
git add src/app/features/scores/entrenamiento-socio-detalle/
git commit -m "feat(scores): detalle de entrenamiento del socio con fallos"
```

---

### Task 5: Ajustar scores-ranking para eliminar su título propio

El título "Ranking" estaba en el propio `scores-ranking.component.html`. Ahora que el shell proporciona el contexto de navegación con tabs, el título interno del ranking puede mantenerse o eliminarse según preferencia visual. Se verifica y ajusta si queda duplicado.

**Files:**
- Modify: `src/app/features/scores/ranking/scores-ranking.component.html`

- [ ] **Step 1: Comprobar si el h2 "Ranking" queda redundante**

Abrir `http://localhost:4200/scores`. Si el tab "Ranking" activo ya identifica la sección claramente, eliminar el `<h2>` interno:

```html
<!-- scores-ranking.component.html — eliminar esta línea si queda redundante: -->
<!-- <h2 class="page-title scores-ranking__title">Ranking</h2> -->
```

Dejar el resto del template igual.

- [ ] **Step 2: Commit (solo si se hizo cambio)**

```bash
git add src/app/features/scores/ranking/scores-ranking.component.html
git commit -m "fix(scores): eliminar título redundante en ranking tras añadir tabs"
```
