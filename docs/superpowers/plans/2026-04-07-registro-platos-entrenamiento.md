# Registro de Platos por Tirador en Entrenamiento

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el input numérico de platos rotos por una cuadrícula interactiva de 25 platos toggle, navegando tirador a tirador dentro de la misma escuadra.

**Architecture:** Se reescribe completamente `RegistrarResultadoEntrenamientoComponent`. El componente mantiene un índice de tirador activo (`tiradoreActual`) y un array de 25 booleanos por tirador (`platos`). El moderador pulsa los platos rotos (toggle verde/gris); los no pulsados son fallos. Al pulsar "Siguiente" avanza al próximo tirador; en el último guarda todos los resultados de una vez via `EntrenamientoService.upsertResultados`. No se crea ningún componente nuevo ni servicio adicional.

**Tech Stack:** Angular 17+ standalone · signals · Tailwind CSS · SCSS BEM · Supabase (sin cambios de BD)

---

## File Map

### Modificar
- `src/app/features/admin/entrenamientos/registrar-resultado-entrenamiento/registrar-resultado-entrenamiento.component.ts` — lógica tirador-a-tirador con array de platos booleanos
- `src/app/features/admin/entrenamientos/registrar-resultado-entrenamiento/registrar-resultado-entrenamiento.component.html` — cuadrícula 25 platos + navegación
- `src/app/features/admin/entrenamientos/registrar-resultado-entrenamiento/registrar-resultado-entrenamiento.component.scss` — estilos botón plato roto/fallo

---

## Task 1: Reescribir el componente TS

**Files:**
- Modify: `src/app/features/admin/entrenamientos/registrar-resultado-entrenamiento/registrar-resultado-entrenamiento.component.ts`

El componente actual usa `puestosForm` con `platosRotos: number`. Lo reemplazamos por:
- `tiradores`: array de tiradores cargados de la escuadra (computed desde signals existentes)
- `tiradoreActual`: índice del tirador activo (0-based)
- `platos`: `boolean[][]` — 25 booleans por tirador (true = roto, false = fallo)
- `togglePlato(plato: number)`: alterna el plato en el tirador actual
- `platosRotosActual()`: cuenta de `true` en el tirador actual
- `siguiente()`: avanza al próximo tirador o guarda si es el último
- `guardar()`: llama a `upsertResultados` con el total de `true` por tirador

- [ ] **Step 1: Reemplazar el contenido del TS**

```typescript
// src/app/features/admin/entrenamientos/registrar-resultado-entrenamiento/registrar-resultado-entrenamiento.component.ts
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { EntrenamientoService } from '../entrenamiento.service';
import { EscuadraService } from '../../../../features/scores/escuadra.service';
import { UserService } from '../../socios/user.service';
import { AuthService } from '../../../../core/auth/auth.service';

interface TiradorSession {
  userId: string;
  nombre: string;
  puesto: number;
  platos: boolean[];   // 25 elementos, true = roto
}

@Component({
  selector: 'app-registrar-resultado-entrenamiento',
  standalone: true,
  imports: [],
  templateUrl: './registrar-resultado-entrenamiento.component.html',
  styleUrl: './registrar-resultado-entrenamiento.component.scss',
})
export class RegistrarResultadoEntrenamientoComponent implements OnInit {
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

  session = signal<TiradorSession[]>([]);
  tiradoreActual = signal(0);
  saving = signal(false);
  error = signal('');

  // Índices 0..24 para el @for del template
  readonly indices = Array.from({ length: 25 }, (_, i) => i);

  ngOnInit(): void {
    // Esperar a que lleguen los datos antes de inicializar
    const init = () => {
      const socios = this.socios();
      const tiradores = this.tiradores();
      if (tiradores.length === 0) return;
      this.session.set(
        tiradores.map(t => {
          const socio = socios.find(s => s.id === t.userId);
          return {
            userId: t.userId,
            nombre: socio ? `${socio.nombre} ${socio.apellidos}` : t.userId,
            puesto: t.puesto,
            platos: Array(25).fill(false),
          };
        })
      );
    };

    // Intentar init inmediato; si no hay datos aún, reintentar con efecto
    init();
    if (this.session().length === 0) {
      const interval = setInterval(() => {
        init();
        if (this.session().length > 0) clearInterval(interval);
      }, 200);
    }
  }

  tirador(): TiradorSession | null {
    return this.session()[this.tiradoreActual()] ?? null;
  }

  platosRotosActual(): number {
    return this.tirador()?.platos.filter(Boolean).length ?? 0;
  }

  esUltimo(): boolean {
    return this.tiradoreActual() === this.session().length - 1;
  }

  togglePlato(i: number): void {
    this.session.update(session => {
      const idx = this.tiradoreActual();
      const updated = session.map((t, ti) => {
        if (ti !== idx) return t;
        const platos = [...t.platos];
        platos[i] = !platos[i];
        return { ...t, platos };
      });
      return updated;
    });
  }

  siguiente(): void {
    if (this.esUltimo()) {
      this.guardar();
    } else {
      this.tiradoreActual.update(i => i + 1);
    }
  }

  anterior(): void {
    if (this.tiradoreActual() > 0) {
      this.tiradoreActual.update(i => i - 1);
    }
  }

  async guardar(): Promise<void> {
    this.saving.set(true);
    this.error.set('');
    try {
      const user = await firstValueFrom(this.authService.currentUser$);
      if (!user) throw new Error('No autenticado');
      await this.entrenamientoService.upsertResultados(
        this.session().map(t => ({
          escuadraId: this.escuadraId,
          userId: t.userId,
          puesto: t.puesto,
          platosRotos: t.platos.filter(Boolean).length,
        })),
        user.id
      );
      this.router.navigate(['/admin/entrenamientos', this.entrenamientoId]);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Error al guardar');
      this.saving.set(false);
    }
  }

  goBack(): void {
    this.router.navigate(['/admin/entrenamientos', this.entrenamientoId]);
  }
}
```

- [ ] **Step 2: Verificar que compila**

```bash
cd C:/Users/cristina.mf/Desktop/tap/appTap
npx tsc --noEmit 2>&1 | grep "registrar-resultado-entrenamiento"
```

Expected: sin salida (sin errores en ese archivo).

- [ ] **Step 3: Commit**

```bash
git add src/app/features/admin/entrenamientos/registrar-resultado-entrenamiento/registrar-resultado-entrenamiento.component.ts
git commit -m "feat: rewrite registrar-resultado-entrenamiento with per-plate toggle logic"
```

---

## Task 2: Reescribir el HTML con cuadrícula de 25 platos

**Files:**
- Modify: `src/app/features/admin/entrenamientos/registrar-resultado-entrenamiento/registrar-resultado-entrenamiento.component.html`

Layout:
- Header con flecha atrás + nombre del tirador + "Puesto N"
- Indicador de progreso: "Tirador 1 de 4"
- Contador "X / 25 platos rotos"
- Cuadrícula 5×5 de botones (platos 1-25)
- Botones de navegación: "← Anterior" (si no es el primero) + "Siguiente →" / "Guardar"

- [ ] **Step 1: Reemplazar el HTML**

```html
<!-- src/app/features/admin/entrenamientos/registrar-resultado-entrenamiento/registrar-resultado-entrenamiento.component.html -->
<div class="registrar-e">

  @if (tirador(); as t) {

    <!-- Header -->
    <div class="page-header">
      <button (click)="goBack()" class="registrar-e__back-btn">
        <i class="bi bi-chevron-left"></i>
      </button>
      <div class="registrar-e__header-info">
        <h2 class="registrar-e__nombre">{{ t.nombre }}</h2>
        <p class="registrar-e__puesto">Puesto {{ t.puesto }}</p>
      </div>
      <span class="registrar-e__progreso">{{ tiradoreActual() + 1 }}/{{ session().length }}</span>
    </div>

    <!-- Contador -->
    <div class="registrar-e__contador">
      <span class="registrar-e__contador-num">{{ platosRotosActual() }}</span>
      <span class="registrar-e__contador-de">/ 25 platos rotos</span>
    </div>

    <!-- Cuadrícula 25 platos -->
    <div class="platos-grid">
      @for (i of indices; track i) {
        <button
          type="button"
          (click)="togglePlato(i)"
          class="plato-btn"
          [class.plato-btn--roto]="t.platos[i]"
        >
          {{ i + 1 }}
        </button>
      }
    </div>

    @if (error()) {
      <p class="registrar-e__error">{{ error() }}</p>
    }

    <!-- Navegación -->
    <div class="registrar-e__nav">
      @if (tiradoreActual() > 0) {
        <button type="button" (click)="anterior()" class="btn-secondary registrar-e__nav-btn">
          <i class="bi bi-chevron-left"></i> Anterior
        </button>
      } @else {
        <span></span>
      }

      <button
        type="button"
        (click)="siguiente()"
        [disabled]="saving()"
        class="btn-primary registrar-e__nav-btn"
      >
        @if (esUltimo()) {
          {{ saving() ? 'Guardando...' : 'Guardar' }}
        } @else {
          Siguiente <i class="bi bi-chevron-right"></i>
        }
      </button>
    </div>

  } @else {
    <div class="registrar-e__loading">
      <p>Cargando tiradores...</p>
    </div>
  }

</div>
```

- [ ] **Step 2: Verificar en navegador**

Navegar a `/admin/entrenamientos/:id/escuadra/:escuadraId/resultados`. Comprobar que:
- Aparece el nombre del primer tirador
- Se ven 25 botones numerados
- Al pulsar un botón cambia de color (roto)
- El contador se actualiza

- [ ] **Step 3: Commit**

```bash
git add src/app/features/admin/entrenamientos/registrar-resultado-entrenamiento/registrar-resultado-entrenamiento.component.html
git commit -m "feat: add 25-plate toggle grid UI for entrenamiento result registration"
```

---

## Task 3: Estilos SCSS

**Files:**
- Modify: `src/app/features/admin/entrenamientos/registrar-resultado-entrenamiento/registrar-resultado-entrenamiento.component.scss`

Diseño visual:
- Botón plato en reposo: círculo gris neutro, número pequeño centrado
- Botón plato roto: fondo `primary` (#D4E600), texto `secondary` (#1A1A1A), sombra sutil
- Cuadrícula: 5 columnas iguales, gap uniforme
- Contador: número grande y llamativo
- Nav: dos botones en fila justified

- [ ] **Step 1: Reemplazar el SCSS**

```scss
// src/app/features/admin/entrenamientos/registrar-resultado-entrenamiento/registrar-resultado-entrenamiento.component.scss
.registrar-e {
  @apply p-3 flex flex-col gap-4;

  &__back-btn { @apply text-gray-400 text-[15px]; }

  &__header-info { @apply flex-1 min-w-0; }
  &__nombre { @apply text-[18px] font-extrabold text-secondary truncate; }
  &__puesto { @apply text-xs text-neutral-300 font-medium; }
  &__progreso { @apply text-xs font-bold text-neutral-300 flex-shrink-0; }

  &__contador {
    @apply flex items-baseline gap-2 justify-center py-2;
  }

  &__contador-num {
    @apply text-[48px] font-black text-secondary leading-none;
  }

  &__contador-de {
    @apply text-sm text-neutral-300 font-medium;
  }

  &__error { @apply text-danger text-sm font-semibold text-center; }

  &__nav {
    @apply flex items-center justify-between gap-3 pt-2;
  }

  &__nav-btn {
    @apply flex items-center gap-1;
  }

  &__loading {
    @apply flex items-center justify-center py-16 text-neutral-300 text-sm;
  }
}

// ── Cuadrícula de platos ───────────────────────────────────────

.platos-grid {
  @apply grid gap-2;
  grid-template-columns: repeat(5, 1fr);
}

.plato-btn {
  @apply aspect-square rounded-[10px] bg-neutral-100 text-neutral-400
         font-bold text-sm flex items-center justify-center
         active:scale-95 transition-all duration-fast
         select-none;

  &--roto {
    @apply bg-primary text-secondary shadow-sm;
  }
}
```

- [ ] **Step 2: Verificar visual**

Comprobar en el navegador:
- Los botones forman una cuadrícula 5×5 equilibrada
- Al pulsar un plato se vuelve amarillo (#D4E600)
- El número grande muestra el conteo correcto
- Los botones Anterior/Siguiente están bien alineados

- [ ] **Step 3: Commit**

```bash
git add src/app/features/admin/entrenamientos/registrar-resultado-entrenamiento/registrar-resultado-entrenamiento.component.scss
git commit -m "feat: style 25-plate grid for entrenamiento registration"
```

---

## Self-Review

### Cobertura de spec
- ✅ 25 platos toggle (roto/fallo) — cuadrícula 5×5
- ✅ Navegación tirador a tirador (Anterior / Siguiente)
- ✅ El último tirador muestra "Guardar" en lugar de "Siguiente"
- ✅ Contador en tiempo real de platos rotos del tirador activo
- ✅ Guarda el total de platos rotos por tirador via `upsertResultados` existente
- ✅ Sin cambios de BD — usa la tabla `resultados_entrenamiento` ya creada
- ✅ Solo accesible para admin/moderador (rutas con `roleGuard` ya configuradas)

### Tipos consistentes
- `TiradorSession.platos` es `boolean[]` (25 elementos) en TS, HTML y guardar
- `platosRotos` en `upsertResultados` es `number` = `filter(Boolean).length` ✅
- `indices` es `number[]` (0..24), usado en `@for` y `togglePlato(i)` ✅

### Placeholder scan
- Sin TBDs ni TODOs
- Todo el código está completo y es ejecutable
